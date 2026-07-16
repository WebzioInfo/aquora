using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Shared.Constants;

namespace Aquora.Application.Services
{
    public class CompanyOnboardingService : ICompanyOnboardingService
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantDatabaseService _tenantDatabaseService;
        private readonly ITokenService _tokenService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ISchemaNameGenerator _schemaNameGenerator;
        private readonly ITenantProvisioningQueue _queue;

        public CompanyOnboardingService(
            IPlatformDbContext platformContext,
            ITenantDatabaseService tenantDatabaseService,
            ITokenService tokenService,
            IServiceScopeFactory scopeFactory,
            ISchemaNameGenerator schemaNameGenerator,
            ITenantProvisioningQueue queue)
        {
            _platformContext = platformContext;
            _tenantDatabaseService = tenantDatabaseService;
            _tokenService = tokenService;
            _scopeFactory = scopeFactory;
            _schemaNameGenerator = schemaNameGenerator;
            _queue = queue;
        }

        public async Task<CompanyOnboardingResponse> OnboardCompanyAsync(Guid userId, CompanyOnboardingRequest request)
        {
            if (userId == Guid.Empty)
            {
                throw new UnauthorizedAccessException("Invalid user.");
            }

            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            Validate(request);

            var user = await _platformContext.Users
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted && u.IsActive);
            if (user == null)
            {
                throw new UnauthorizedAccessException("User not found.");
            }

            if (!user.EmailVerified)
            {
                throw new InvalidOperationException("Email verification is required before company onboarding.");
            }

            var ownsCompany = user.TenantId.HasValue && await _platformContext.Tenants
                .AnyAsync(t => t.Id == user.TenantId.Value && !t.IsDeleted);
            if (ownsCompany)
            {
                throw new InvalidOperationException("User already owns a company.");
            }

            var companyCode = await GenerateUniqueCompanyCodeAsync(request.CompanyName);

            var tenantId = Guid.NewGuid();
            var schemaName = await _schemaNameGenerator.GenerateSchemaNameAsync(request.CompanyName);
            var subdomain = companyCode.ToLowerInvariant();

            // 1. Commit Tenant Creation in Platform Db
            await using (var transaction = await _platformContext.Database.BeginTransactionAsync())
            {
                try
                {
                    var tenant = new Tenant
                    {
                        Id = tenantId,
                        Name = request.CompanyName.Trim(),
                        Code = companyCode.ToUpperInvariant(),
                        SchemaName = schemaName,
                        Subdomain = subdomain,
                        IsInitialized = false,
                        Status = "Provisioning",
                        Progress = 10,
                        CurrentStep = "Queueing provisioning",
                        StartedAt = DateTime.UtcNow
                    };

                    _platformContext.Tenants.Add(tenant);
                    user.TenantId = tenant.Id;
                    await _platformContext.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }

            // 2. Queue Background Tenant Provisioning
            _queue.QueueProvisioning(new TenantProvisioningJob
            {
                TenantId = tenantId,
                SchemaName = schemaName,
                CompanyName = request.CompanyName.Trim(),
                CompanyCode = companyCode,
                OwnerUserId = user.Id,
                EnabledStations = request.EnabledStations
            });

            // 3. Generate dynamic token with default role and permission claims during provisioning
            var roles = new System.Collections.Generic.List<string> { "CompanyAdmin" };
            var permissions = new System.Collections.Generic.List<string>
            {
                Permissions.TenantRead, Permissions.TenantWrite,
                Permissions.UsersRead, Permissions.UsersWrite,
                Permissions.RolesRead, Permissions.RolesWrite,
                Permissions.AuditRead,
                Permissions.HierarchyRead, Permissions.HierarchyWrite,
                Permissions.DashboardRead
            };

            var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
            var refreshToken = _tokenService.GenerateRefreshToken();

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _platformContext.SaveChangesAsync();

            return new CompanyOnboardingResponse
            {
                TenantId = tenantId,
                CompanyId = Guid.Empty, // Created asynchronously in background
                CompanyName = request.CompanyName.Trim(),
                SchemaName = schemaName,
                OwnerRole = "CompanyAdmin",
                ProvisioningStatus = "Provisioning",
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = 3600,
                Permissions = permissions
            };
        }

        private static void Validate(CompanyOnboardingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CompanyName))
            {
                throw new ArgumentException("Company name is required.", nameof(request.CompanyName));
            }

            if (request.EmployeeCount <= 0)
            {
                throw new ArgumentException("Employee count must be greater than zero.", nameof(request.EmployeeCount));
            }

            if (string.IsNullOrWhiteSpace(request.HowDidYouHearAboutUs))
            {
                throw new ArgumentException("How did you hear about us is required.", nameof(request.HowDidYouHearAboutUs));
            }
        }

        private async Task<string> GenerateUniqueCompanyCodeAsync(string companyName)
        {
            var baseCode = NormalizeCode(companyName);
            var code = baseCode;
            var suffix = 1;

            while (await _platformContext.Tenants.AnyAsync(t => t.Code == code && !t.IsDeleted))
            {
                code = $"{baseCode}_{suffix}";
                suffix++;
            }

            return code;
        }

        private static string NormalizeCode(string code)
        {
            var normalized = Regex.Replace(code.Trim().ToUpperInvariant(), "[^A-Z0-9]+", "_").Trim('_');
            return string.IsNullOrWhiteSpace(normalized) ? $"COMPANY_{Guid.NewGuid():N}" : normalized;
        }

        private async Task<(System.Collections.Generic.List<string> Roles, System.Collections.Generic.List<string> Permissions)> GetUserRolesAndPermissionsAsync(User user, string schemaName)
        {
            var roles = new System.Collections.Generic.List<string>();
            var permissions = new System.Collections.Generic.List<string>();

            if (user.IsPlatformAdmin)
            {
                roles.Add("SuperAdmin");
                permissions.Add("*:*");
                return (roles, permissions);
            }

            try
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
                    tenantProvider.SetTenantId(user.TenantId.Value);
                    tenantProvider.SetTenantSchemaName(schemaName);

                    var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantDbContext>();

                    var userRoles = await tenantContext.UserRoles
                        .Where(ur => ur.UserId == user.Id)
                        .Include(ur => ur.Role)
                        .ToListAsync();

                    foreach (var ur in userRoles)
                    {
                        if (ur.Role != null)
                        {
                            roles.Add(ur.Role.Name);
                            
                            var rolePerms = await tenantContext.RolePermissions
                                .Where(rp => rp.RoleId == ur.RoleId)
                                .Include(rp => rp.Permission)
                                .ToListAsync();

                            foreach (var rp in rolePerms)
                            {
                                if (rp.Permission != null)
                                {
                                    permissions.Add(rp.Permission.Code);
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading user roles/permissions during onboarding token gen: {ex.Message}");
            }

            return (roles, permissions);
        }
    }
}
