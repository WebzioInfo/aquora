using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.DTOs.User;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

namespace Aquora.Application.Services
{
    public class UserProfileService : IUserProfileService
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly IPasswordHasher _passwordHasher;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IUserRoleResolver _roleResolver;
        private readonly ICloudinaryMediaService _cloudinaryService;

        public UserProfileService(
            IPlatformDbContext platformContext,
            IPasswordHasher passwordHasher,
            ICurrentUserContext currentUserContext,
            IServiceScopeFactory scopeFactory,
            IUserRoleResolver roleResolver,
            ICloudinaryMediaService cloudinaryService)
        {
            _platformContext = platformContext;
            _passwordHasher = passwordHasher;
            _currentUserContext = currentUserContext;
            _scopeFactory = scopeFactory;
            _roleResolver = roleResolver;
            _cloudinaryService = cloudinaryService;
        }

        public async Task<UserProfileDto> GetProfileAsync(string userId)
        {
            var user = await GetUserByIdAsync(userId);
            return await MapToProfileDtoAsync(user);
        }

        public async Task<UserProfileDto> UpdateProfileAsync(string userId, UpdateUserProfileRequest request)
        {
            var user = await GetUserByIdAsync(userId);

            var oldValuesObj = new
            {
                user.FirstName,
                user.LastName,
                user.Username,
                user.Phone,
                user.Department,
                user.Qualification,
                user.CertificationDetails,
                user.ExperienceYears,
                user.AssignedLabStation,
                user.QcResponsibilities
            };

            // 1. Validate and update Username if provided
            if (!string.IsNullOrWhiteSpace(request.Username))
            {
                var normalizedUsername = request.Username.Trim();
                if (!Regex.IsMatch(normalizedUsername, @"^[a-zA-Z0-9_.-]{3,50}$"))
                {
                    throw new InvalidOperationException("Username must be 3-50 characters and contain only letters, numbers, underscores, dots, or hyphens.");
                }

                if (!string.Equals(user.Username, normalizedUsername, StringComparison.OrdinalIgnoreCase))
                {
                    var exists = await _platformContext.Users
                        .AnyAsync(u => u.Id != user.Id && u.Username != null && u.Username.ToLower() == normalizedUsername.ToLower() && !u.IsDeleted);

                    if (exists)
                    {
                        throw new InvalidOperationException("Username is already taken. Please choose another username.");
                    }

                    user.Username = normalizedUsername;
                }
            }

            // 2. Update Personal Information
            if (request.FirstName != null)
            {
                user.FirstName = request.FirstName.Trim();
            }

            if (request.LastName != null)
            {
                user.LastName = request.LastName.Trim();
            }

            if (request.Phone != null)
            {
                user.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
            }

            if (request.PhotoUrl != null)
            {
                user.PhotoUrl = string.IsNullOrWhiteSpace(request.PhotoUrl) ? null : request.PhotoUrl.Trim();
            }

            if (request.Department != null)
            {
                user.Department = string.IsNullOrWhiteSpace(request.Department) ? null : request.Department.Trim();
            }

            // 3. Update Professional & QC Metadata
            if (request.Qualification != null)
            {
                user.Qualification = string.IsNullOrWhiteSpace(request.Qualification) ? null : request.Qualification.Trim();
            }

            if (request.CertificationDetails != null)
            {
                user.CertificationDetails = string.IsNullOrWhiteSpace(request.CertificationDetails) ? null : request.CertificationDetails.Trim();
            }

            if (request.ExperienceYears.HasValue)
            {
                user.ExperienceYears = request.ExperienceYears.Value;
            }

            if (request.AssignedLabStation != null)
            {
                user.AssignedLabStation = string.IsNullOrWhiteSpace(request.AssignedLabStation) ? null : request.AssignedLabStation.Trim();
            }

            if (request.QcResponsibilities != null)
            {
                user.QcResponsibilities = string.IsNullOrWhiteSpace(request.QcResponsibilities) ? null : request.QcResponsibilities.Trim();
            }

            if (request.SignatureUrl != null)
            {
                user.SignatureUrl = string.IsNullOrWhiteSpace(request.SignatureUrl) ? null : request.SignatureUrl.Trim();
            }

            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedBy = user.Id.ToString();
            user.UpdatedByIP = _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            // Log security audit event for profile update
            await LogSecurityAuditEventAsync(user, "Profile_Updated", "User updated personal profile details.",
                JsonSerializer.Serialize(oldValuesObj),
                JsonSerializer.Serialize(new
                {
                    user.FirstName,
                    user.LastName,
                    user.Username,
                    user.Phone,
                    user.Department,
                    user.Qualification,
                    user.CertificationDetails,
                    user.ExperienceYears,
                    user.AssignedLabStation,
                    user.QcResponsibilities
                }));

            return await MapToProfileDtoAsync(user);
        }

        public async Task<bool> ChangePasswordAsync(string userId, ChangePasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword))
                throw new InvalidOperationException("Current password is required.");

            if (string.IsNullOrWhiteSpace(request.NewPassword))
                throw new InvalidOperationException("New password is required.");

            if (request.NewPassword.Length < 8 ||
                !Regex.IsMatch(request.NewPassword, "[A-Z]") ||
                !Regex.IsMatch(request.NewPassword, "[a-z]") ||
                !Regex.IsMatch(request.NewPassword, "[0-9]"))
            {
                throw new InvalidOperationException("New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.");
            }

            if (request.NewPassword != request.ConfirmPassword)
                throw new InvalidOperationException("The new password and confirmation password do not match.");

            var user = await GetUserByIdAsync(userId);

            // 1. Verify current password
            bool passwordValid = _passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash);
            bool pinValid = !string.IsNullOrEmpty(user.PinHash) && _passwordHasher.VerifyPassword(request.CurrentPassword, user.PinHash);

            if (!passwordValid && !pinValid)
            {
                await LogSecurityAuditEventAsync(user, "Password_Change_Failed", "Failed attempt to change password due to incorrect current password.");
                throw new InvalidOperationException("Current password is incorrect.");
            }

            // 2. Reject password reuse
            if (_passwordHasher.VerifyPassword(request.NewPassword, user.PasswordHash))
            {
                throw new InvalidOperationException("New password cannot be the same as your current password.");
            }

            // 3. Atomically update password hash & increment token version
            var newHash = _passwordHasher.HashPassword(request.NewPassword);
            user.PasswordHash = newHash;
            user.PinHash = newHash;
            user.TokenVersion++;
            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedBy = user.Id.ToString();
            user.UpdatedByIP = _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            // 4. Audit the security event
            await LogSecurityAuditEventAsync(user, "Password_Changed", "User successfully changed their account password.");

            return true;
        }

        public async Task<UserSecuritySummaryDto> GetSecuritySummaryAsync(string userId)
        {
            var user = await GetUserByIdAsync(userId);

            var recentAuditLogs = await _platformContext.PlatformAuditLogs
                .AsNoTracking()
                .Where(a => a.UserId == user.Id.ToString() || a.UserEmail == user.Email)
                .OrderByDescending(a => a.Timestamp)
                .Take(15)
                .Select(a => new UserAuditEventDto
                {
                    Action = a.Action ?? "Activity",
                    Timestamp = a.Timestamp,
                    IpAddress = a.IpAddress,
                    Device = a.Device,
                    Reason = a.Reason
                })
                .ToListAsync();

            return new UserSecuritySummaryDto
            {
                LastLoginAt = user.LastLoginAt,
                EmailVerified = user.EmailVerified,
                EmailVerifiedAt = user.EmailVerifiedAt,
                DevicesCount = user.DevicesCount,
                TokenVersion = user.TokenVersion,
                TwoFactorEnabled = user.EmailVerified,
                RecentAuditEvents = recentAuditLogs
            };
        }

        public async Task<UserProfileDto> UpdateAvatarAsync(string userId, string? photoUrl)
        {
            var user = await GetUserByIdAsync(userId);
            
            // If photoUrl is set to null or empty, clean up old Cloudinary asset if present
            if (string.IsNullOrWhiteSpace(photoUrl) && !string.IsNullOrWhiteSpace(user.PhotoPublicId))
            {
                var oldPublicId = user.PhotoPublicId;
                user.PhotoUrl = null;
                user.PhotoPublicId = null;
                user.UpdatedAt = DateTime.UtcNow;
                user.UpdatedBy = user.Id.ToString();
                user.UpdatedByIP = _currentUserContext.IpAddress;

                await _platformContext.SaveChangesAsync();
                await _cloudinaryService.DeleteAssetAsync(oldPublicId, "image");
            }
            else
            {
                user.PhotoUrl = string.IsNullOrWhiteSpace(photoUrl) ? null : photoUrl.Trim();
                user.UpdatedAt = DateTime.UtcNow;
                user.UpdatedBy = user.Id.ToString();
                user.UpdatedByIP = _currentUserContext.IpAddress;

                await _platformContext.SaveChangesAsync();
            }

            await LogSecurityAuditEventAsync(user, "Avatar_Updated", "User updated profile photo / avatar.");

            return await MapToProfileDtoAsync(user);
        }

        public async Task<UserProfileDto> UploadAvatarAsync(string userId, System.IO.Stream fileStream, string fileName, string contentType)
        {
            var user = await GetUserByIdAsync(userId);
            var oldPublicId = user.PhotoPublicId;

            // 1. Upload new image to Cloudinary (folder: aquzio/tenants/{tenantId}/users/{userId}/profile or platform)
            var uploadResult = await _cloudinaryService.UploadImageAsync(
                fileStream,
                fileName,
                contentType,
                Aquora.Application.DTOs.Media.MediaAssetType.UserProfilePhoto,
                user.TenantId,
                user.Id);

            // 2. Persist new image URL & PublicId in Database
            user.PhotoUrl = uploadResult.Url;
            user.PhotoPublicId = uploadResult.PublicId;
            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedBy = user.Id.ToString();
            user.UpdatedByIP = _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            // 3. Compensating cleanup: Delete old asset only AFTER database successfully saved
            if (!string.IsNullOrWhiteSpace(oldPublicId) && oldPublicId != uploadResult.PublicId)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _cloudinaryService.DeleteAssetAsync(oldPublicId, "image");
                    }
                    catch { }
                });
            }

            await LogSecurityAuditEventAsync(user, "Avatar_Uploaded", $"User uploaded new profile photo via Cloudinary: {uploadResult.PublicId}");

            return await MapToProfileDtoAsync(user);
        }

        public async Task<UserProfileDto> RemoveAvatarAsync(string userId)
        {
            var user = await GetUserByIdAsync(userId);
            var oldPublicId = user.PhotoPublicId;

            user.PhotoUrl = null;
            user.PhotoPublicId = null;
            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedBy = user.Id.ToString();
            user.UpdatedByIP = _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(oldPublicId))
            {
                await _cloudinaryService.DeleteAssetAsync(oldPublicId, "image");
            }

            await LogSecurityAuditEventAsync(user, "Avatar_Removed", "User removed profile photo / avatar.");

            return await MapToProfileDtoAsync(user);
        }

        public async Task<UserProfileDto> UploadSignatureAsync(string userId, System.IO.Stream fileStream, string fileName, string contentType)
        {
            var user = await GetUserByIdAsync(userId);
            var oldPublicId = user.SignaturePublicId;

            // 1. Upload signature to Cloudinary (folder: aquzio/tenants/{tenantId}/qc/{userId}/signature)
            var uploadResult = await _cloudinaryService.UploadImageAsync(
                fileStream,
                fileName,
                contentType,
                Aquora.Application.DTOs.Media.MediaAssetType.QcSignature,
                user.TenantId,
                user.Id);

            // 2. Persist in Database
            user.SignatureUrl = uploadResult.Url;
            user.SignaturePublicId = uploadResult.PublicId;
            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedBy = user.Id.ToString();
            user.UpdatedByIP = _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            // 3. Compensating cleanup of old signature
            if (!string.IsNullOrWhiteSpace(oldPublicId) && oldPublicId != uploadResult.PublicId)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _cloudinaryService.DeleteAssetAsync(oldPublicId, "image");
                    }
                    catch { }
                });
            }

            await LogSecurityAuditEventAsync(user, "Signature_Uploaded", $"User uploaded QC digital signature via Cloudinary: {uploadResult.PublicId}");

            return await MapToProfileDtoAsync(user);
        }

        public async Task<UserProfileDto> RemoveSignatureAsync(string userId)
        {
            var user = await GetUserByIdAsync(userId);
            var oldPublicId = user.SignaturePublicId;

            user.SignatureUrl = null;
            user.SignaturePublicId = null;
            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedBy = user.Id.ToString();
            user.UpdatedByIP = _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(oldPublicId))
            {
                await _cloudinaryService.DeleteAssetAsync(oldPublicId, "image");
            }

            await LogSecurityAuditEventAsync(user, "Signature_Removed", "User removed QC digital signature.");

            return await MapToProfileDtoAsync(user);
        }

        private async Task<User> GetUserByIdAsync(string userId)
        {
            if (!Guid.TryParse(userId, out var guidId))
            {
                throw new UnauthorizedAccessException("Invalid user identity.");
            }

            var user = await _platformContext.Users
                .FirstOrDefaultAsync(u => u.Id == guidId && !u.IsDeleted);

            if (user == null)
            {
                throw new UnauthorizedAccessException("User profile could not be found or has been deactivated.");
            }

            return user;
        }

        private async Task<UserProfileDto> MapToProfileDtoAsync(User user)
        {
            var roles = new List<string>();
            var permissions = new List<string>();

            string companyName = "";
            string tenantSchema = "";
            bool ownsCompany = false;

            if (user.IsPlatformAdmin)
            {
                roles.Add("SuperAdmin");
                roles.Add("PlatformAdmin");
                permissions.AddRange(new[]
                {
                    Aquora.Shared.Constants.Permissions.TenantRead,
                    Aquora.Shared.Constants.Permissions.TenantWrite,
                    Aquora.Shared.Constants.Permissions.UsersRead,
                    Aquora.Shared.Constants.Permissions.UsersWrite,
                    Aquora.Shared.Constants.Permissions.RolesRead,
                    Aquora.Shared.Constants.Permissions.RolesWrite,
                    Aquora.Shared.Constants.Permissions.AuditRead,
                    Aquora.Shared.Constants.Permissions.HierarchyRead,
                    Aquora.Shared.Constants.Permissions.HierarchyWrite,
                    Aquora.Shared.Constants.Permissions.DashboardRead
                });
            }
            else if (user.TenantId.HasValue)
            {
                var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
                if (tenant != null)
                {
                    companyName = tenant.Name;
                    tenantSchema = tenant.SchemaName;
                    ownsCompany = tenant.OwnerEmail == user.Email.ToLower() || tenant.CreatedBy == user.Id.ToString();

                    if (tenant.IsInitialized)
                    {
                        try
                        {
                            using var scope = _scopeFactory.CreateScope();
                            var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
                            tenantProvider.SetTenantId(user.TenantId.Value);
                            tenantProvider.SetTenantSchemaName(tenant.SchemaName);

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
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[UserProfileService WARN]: Could not query tenant roles for {user.Email}: {ex.Message}");
                        }
                    }
                }
            }

            // Fallback resolved role
            if (roles.Count == 0)
            {
                var resolved = await _roleResolver.ResolveUserRoleAsync(user, user.TenantId);
                roles.Add(resolved);
            }

            var displayName = $"{user.FirstName} {user.LastName}".Trim();
            if (string.IsNullOrWhiteSpace(displayName))
            {
                displayName = user.Username ?? user.Email;
            }

            return new UserProfileDto
            {
                Id = user.Id,
                Email = user.Email,
                Username = user.Username,
                FirstName = user.FirstName,
                LastName = user.LastName,
                DisplayName = displayName,
                Phone = user.Phone,
                PhotoUrl = user.PhotoUrl,
                PhotoPublicId = user.PhotoPublicId,
                Department = user.Department,
                Designation = user.Designation,
                Shift = user.Shift,
                JoiningDate = user.JoiningDate,
                IsActive = user.IsActive,
                EmailVerified = user.EmailVerified,
                EmailVerifiedAt = user.EmailVerifiedAt,
                LastLoginAt = user.LastLoginAt,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt,

                IsPlatformAdmin = user.IsPlatformAdmin,
                TenantId = user.TenantId,
                CompanyName = companyName,
                TenantSchema = tenantSchema,
                RoleName = roles.FirstOrDefault() ?? user.RoleName ?? "Operator",
                Roles = roles.Distinct().ToList(),
                Permissions = permissions.Distinct().ToList(),
                DevicesCount = user.DevicesCount,
                OwnsCompany = ownsCompany,
                AssignedProductionLineId = user.AssignedProductionLineId,

                // Professional & QC Metadata
                Qualification = user.Qualification,
                CertificationDetails = user.CertificationDetails,
                ExperienceYears = user.ExperienceYears,
                AssignedLabStation = user.AssignedLabStation,
                QcResponsibilities = user.QcResponsibilities,
                SignatureUrl = user.SignatureUrl,
                SignaturePublicId = user.SignaturePublicId
            };
        }

        private async Task LogSecurityAuditEventAsync(User user, string action, string reason, string? oldValues = null, string? newValues = null)
        {
            try
            {
                var auditLog = new PlatformAuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = user.TenantId ?? Guid.Empty,
                    UserId = user.Id.ToString(),
                    UserEmail = user.Email,
                    Action = action,
                    TableName = "Users",
                    PrimaryKey = user.Id.ToString(),
                    OldValues = oldValues ?? "{}",
                    NewValues = newValues ?? "{}",
                    Timestamp = DateTime.UtcNow,
                    IpAddress = _currentUserContext.IpAddress,
                    Device = _currentUserContext.UserAgent,
                    Reason = reason,
                    Module = "AccountProfile"
                };

                _platformContext.PlatformAuditLogs.Add(auditLog);
                await _platformContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UserProfileService AUDIT WARN]: Failed to record audit log: {ex.Message}");
            }
        }
    }
}
