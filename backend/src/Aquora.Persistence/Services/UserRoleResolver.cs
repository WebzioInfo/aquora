using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;

namespace Aquora.Persistence.Services
{
    public class UserRoleResolver : IUserRoleResolver
    {
        private readonly PlatformDbContext _platformContext;
        private readonly TenantDbContext _tenantContext;

        public UserRoleResolver(PlatformDbContext platformContext, TenantDbContext tenantContext)
        {
            _platformContext = platformContext;
            _tenantContext = tenantContext;
        }

        public async Task<string> ResolveUserRoleAsync(User user, Guid? tenantId = null)
        {
            if (user == null) return "Operator";

            if (user.IsPlatformAdmin)
            {
                return !string.IsNullOrWhiteSpace(user.RoleName) && user.RoleName != "CompanyAdmin"
                    ? user.RoleName
                    : "SuperAdmin";
            }

            var activeTenantId = tenantId ?? user.TenantId;

            // 1. Try resolving role from TenantDbContext UserRoles & Roles
            if (activeTenantId.HasValue)
            {
                try
                {
                    var userRole = await _tenantContext.UserRoles
                        .AsNoTracking()
                        .Include(ur => ur.Role)
                        .FirstOrDefaultAsync(ur => ur.UserId == user.Id);

                    if (userRole?.Role != null && !string.IsNullOrWhiteSpace(userRole.Role.Name))
                    {
                        var tenantRoleName = userRole.Role.Name;
                        if (userRole.Role.Code == "OWNER" || tenantRoleName.Equals("Owner", StringComparison.OrdinalIgnoreCase))
                        {
                            tenantRoleName = "CompanyAdmin";
                        }

                        if (user.RoleName != tenantRoleName)
                        {
                            await UpdateUserRoleNameInMemoryAndDbAsync(user.Id, tenantRoleName);
                        }

                        return tenantRoleName;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[UserRoleResolver WARN]: Could not query TenantDbContext UserRoles for userId {user.Id}: {ex.Message}");
                }
            }

            // 2. Try resolving from PlatformDbContext UserMemberships & Roles
            if (activeTenantId.HasValue)
            {
                try
                {
                    var membership = await _platformContext.UserMemberships
                        .AsNoTracking()
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id && m.TenantId == activeTenantId.Value);

                    if (membership != null && membership.RoleId != Guid.Empty)
                    {
                        var role = await _tenantContext.Roles
                            .AsNoTracking()
                            .FirstOrDefaultAsync(r => r.Id == membership.RoleId);

                        if (role != null && !string.IsNullOrWhiteSpace(role.Name))
                        {
                            var roleName = role.Name;
                            if (role.Code == "OWNER" || roleName.Equals("Owner", StringComparison.OrdinalIgnoreCase))
                            {
                                roleName = "CompanyAdmin";
                            }

                            if (user.RoleName != roleName)
                            {
                                await UpdateUserRoleNameInMemoryAndDbAsync(user.Id, roleName);
                            }

                            return roleName;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[UserRoleResolver WARN]: Could not query UserMemberships for userId {user.Id}: {ex.Message}");
                }
            }

            // 3. Fallback to User.RoleName property on User entity
            if (!string.IsNullOrWhiteSpace(user.RoleName))
            {
                return user.RoleName;
            }

            // 4. Default fallback for standard employees is Operator
            return "Operator";
        }

        public async Task<Dictionary<Guid, string>> ResolveUsersRolesAsync(IEnumerable<User> users, Guid? tenantId = null)
        {
            var result = new Dictionary<Guid, string>();
            var userList = users.Where(u => u != null).ToList();
            if (!userList.Any()) return result;

            var userIds = userList.Select(u => u.Id).Distinct().ToList();

            // Batch query tenant roles
            var tenantRoleMap = new Dictionary<Guid, string>();
            try
            {
                var userRoles = await _tenantContext.UserRoles
                    .AsNoTracking()
                    .Include(ur => ur.Role)
                    .Where(ur => userIds.Contains(ur.UserId))
                    .ToListAsync();

                foreach (var ur in userRoles)
                {
                    if (ur.Role != null && !string.IsNullOrWhiteSpace(ur.Role.Name))
                    {
                        var rName = ur.Role.Name;
                        if (ur.Role.Code == "OWNER" || rName.Equals("Owner", StringComparison.OrdinalIgnoreCase))
                        {
                            rName = "CompanyAdmin";
                        }
                        tenantRoleMap[ur.UserId] = rName;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UserRoleResolver WARN]: Batch query of UserRoles failed: {ex.Message}");
            }

            // Batch query memberships
            var membershipRoleMap = new Dictionary<Guid, Guid>();
            try
            {
                var memberships = await _platformContext.UserMemberships
                    .AsNoTracking()
                    .Where(m => userIds.Contains(m.PlatformUserId))
                    .ToListAsync();

                foreach (var m in memberships)
                {
                    if (!membershipRoleMap.ContainsKey(m.PlatformUserId))
                    {
                        membershipRoleMap[m.PlatformUserId] = m.RoleId;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UserRoleResolver WARN]: Batch query of UserMemberships failed: {ex.Message}");
            }

            var allRolesMap = new Dictionary<Guid, string>();
            try
            {
                allRolesMap = await _tenantContext.Roles
                    .AsNoTracking()
                    .ToDictionaryAsync(r => r.Id, r => (r.Code == "OWNER" || r.Name.Equals("Owner", StringComparison.OrdinalIgnoreCase)) ? "CompanyAdmin" : r.Name);
            }
            catch { }

            var usersNeedingDbUpdate = new List<User>();

            foreach (var user in userList)
            {
                string resolvedRole = "Operator";

                if (user.IsPlatformAdmin)
                {
                    resolvedRole = !string.IsNullOrWhiteSpace(user.RoleName) && user.RoleName != "CompanyAdmin"
                        ? user.RoleName
                        : "SuperAdmin";
                }
                else if (tenantRoleMap.TryGetValue(user.Id, out var trName))
                {
                    resolvedRole = trName;
                }
                else if (membershipRoleMap.TryGetValue(user.Id, out var roleId) && allRolesMap.TryGetValue(roleId, out var memRoleName))
                {
                    resolvedRole = memRoleName;
                }
                else if (!string.IsNullOrWhiteSpace(user.RoleName))
                {
                    resolvedRole = user.RoleName;
                }
                else
                {
                    resolvedRole = "Operator";
                }

                result[user.Id] = resolvedRole;

                if (user.RoleName != resolvedRole && !user.IsPlatformAdmin)
                {
                    user.RoleName = resolvedRole;
                    usersNeedingDbUpdate.Add(user);
                }
            }

            if (usersNeedingDbUpdate.Any())
            {
                try
                {
                    foreach (var u in usersNeedingDbUpdate)
                    {
                        var dbUser = await _platformContext.Users.FirstOrDefaultAsync(x => x.Id == u.Id);
                        if (dbUser != null)
                        {
                            dbUser.RoleName = u.RoleName;
                        }
                    }
                    await _platformContext.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[UserRoleResolver WARN]: Failed to persist synchronized RoleName on Users table: {ex.Message}");
                }
            }

            return result;
        }

        public async Task SynchronizeUserRoleAsync(Guid userId, string newRoleName, Guid? tenantId = null)
        {
            if (string.IsNullOrWhiteSpace(newRoleName)) return;
            newRoleName = newRoleName.Trim();

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return;

            user.RoleName = newRoleName;

            var activeTenantId = tenantId ?? user.TenantId;

            if (activeTenantId.HasValue)
            {
                Role? matchingRole = null;
                try
                {
                    matchingRole = await _tenantContext.Roles
                        .FirstOrDefaultAsync(r => r.Name.ToLower() == newRoleName.ToLower() || r.Code.ToLower() == newRoleName.ToLower().Replace(" ", "_"));

                    if (matchingRole == null && newRoleName.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase))
                    {
                        matchingRole = await _tenantContext.Roles
                            .FirstOrDefaultAsync(r => r.Code == "OWNER" || r.Name == "CompanyAdmin" || r.Name == "Owner");
                    }

                    if (matchingRole == null)
                    {
                        var code = newRoleName.ToUpperInvariant().Replace(" ", "_");
                        matchingRole = new Role
                        {
                            Id = Guid.NewGuid(),
                            TenantId = activeTenantId.Value,
                            Name = newRoleName,
                            Code = code,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = "System"
                        };
                        _tenantContext.Roles.Add(matchingRole);
                        await _tenantContext.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[UserRoleResolver WARN]: Error finding/creating role '{newRoleName}' in TenantDbContext: {ex.Message}");
                }

                if (matchingRole != null)
                {
                    try
                    {
                        var tenantUserRole = await _tenantContext.UserRoles
                            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.TenantId == activeTenantId.Value);

                        if (tenantUserRole != null)
                        {
                            tenantUserRole.RoleId = matchingRole.Id;
                        }
                        else
                        {
                            _tenantContext.UserRoles.Add(new UserRole
                            {
                                Id = Guid.NewGuid(),
                                UserId = userId,
                                RoleId = matchingRole.Id,
                                TenantId = activeTenantId.Value,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = "System"
                            });
                        }
                        await _tenantContext.SaveChangesAsync();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[UserRoleResolver WARN]: Error syncing UserRole link in TenantDbContext: {ex.Message}");
                    }

                    try
                    {
                        var membership = await _platformContext.UserMemberships
                            .FirstOrDefaultAsync(m => m.PlatformUserId == userId && m.TenantId == activeTenantId.Value);

                        if (membership != null)
                        {
                            membership.RoleId = matchingRole.Id;
                        }
                        else
                        {
                            _platformContext.UserMemberships.Add(new UserMembership
                            {
                                Id = Guid.NewGuid(),
                                PlatformUserId = userId,
                                TenantId = activeTenantId.Value,
                                RoleId = matchingRole.Id,
                                Status = "Active",
                                JoinedAt = DateTime.UtcNow
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[UserRoleResolver WARN]: Error syncing UserMembership in PlatformDbContext: {ex.Message}");
                    }
                }
            }

            await _platformContext.SaveChangesAsync();
        }

        private async Task UpdateUserRoleNameInMemoryAndDbAsync(Guid userId, string roleName)
        {
            try
            {
                var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user != null)
                {
                    user.RoleName = roleName;
                    await _platformContext.SaveChangesAsync();
                }
            }
            catch { }
        }
    }
}
