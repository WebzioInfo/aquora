using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

using Microsoft.Extensions.DependencyInjection;

namespace Aquora.Application.Services
{
    public class AuthService : IAuthService
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly ITokenService _tokenService;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IEmailService _emailService;
        private readonly IBackgroundTaskQueue _taskQueue;

        public AuthService(
            IPlatformDbContext platformContext,
            ITokenService tokenService,
            IPasswordHasher passwordHasher,
            IServiceScopeFactory scopeFactory,
            IEmailService emailService,
            IBackgroundTaskQueue taskQueue)
        {
            _platformContext = platformContext;
            _tokenService = tokenService;
            _passwordHasher = passwordHasher;
            _scopeFactory = scopeFactory;
            _emailService = emailService;
            _taskQueue = taskQueue;
        }

        public async Task<bool> RegisterAsync(RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || !Regex.IsMatch(request.Email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                throw new InvalidOperationException("A valid email address is required.");

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8 ||
                !Regex.IsMatch(request.Password, "[A-Z]") ||
                !Regex.IsMatch(request.Password, "[a-z]") ||
                !Regex.IsMatch(request.Password, "[0-9]"))
                throw new InvalidOperationException("Password must be at least 8 characters and include uppercase, lowercase, and a number.");

            if (request.Password != request.ConfirmPassword)
                throw new InvalidOperationException("Passwords do not match.");

            var email = request.Email.Trim().ToLowerInvariant();
            var existingUser = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
            if (existingUser != null)
                throw new InvalidOperationException("Email is already registered.");

            var parts = (request.FullName ?? string.Empty).Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

            using var transaction = await _platformContext.Database.BeginTransactionAsync();
            try
            {
                var user = new User
                {
                    Email = email,
                    FirstName = parts.Length > 0 ? parts[0] : string.Empty,
                    LastName = parts.Length > 1 ? parts[1] : string.Empty,
                    PasswordHash = _passwordHasher.HashPassword(request.Password),
                    IsActive = true,
                    EmailVerified = false,
                    TokenVersion = 0
                };

                _platformContext.Users.Add(user);
                await _platformContext.SaveChangesAsync();
                
                await SendOtpAsync(new SendOtpRequest { Email = email, Purpose = "Registration" });

                await transaction.CommitAsync();
                Console.WriteLine($"[USER REGISTRATION]: User '{user.Email}' registered successfully with ID '{user.Id}'.");
                
                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<bool> SendOtpAsync(SendOtpRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var purpose = string.IsNullOrWhiteSpace(request.Purpose) ? "Registration" : request.Purpose.Trim();
            var now = DateTime.UtcNow;

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
            if (purpose == "Registration" && user != null && user.EmailVerified)
            {
                throw new InvalidOperationException("ALREADY_VERIFIED");
            }

            var existing = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == email && o.Purpose == purpose && !o.IsVerified);

            if (existing != null && existing.LastSentAt.HasValue && existing.LastSentAt.Value.AddMinutes(1) > now)
                throw new InvalidOperationException("Please wait before requesting another OTP.");

            if (existing != null && existing.CreatedAt.AddHours(1) > now && existing.SendCount >= 5)
                throw new InvalidOperationException("OTP rate limit exceeded. Try again later.");

            // Generate cryptographically secure OTP
            var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            
            if (existing == null)
            {
                existing = new OTPVerification
                {
                    Email = email,
                    Purpose = purpose,
                    RequestId = Guid.NewGuid().ToString()
                };
                _platformContext.OTPVerifications.Add(existing);
            }

            existing.OtpHash = _passwordHasher.HashPassword(code);
            existing.ExpiryTime = now.AddMinutes(10);
            existing.Attempts = 0;
            existing.SendCount = existing.CreatedAt.AddHours(1) > now ? existing.SendCount + 1 : 1;
            existing.LastSentAt = now;
            existing.CreatedAt = existing.CreatedAt == default ? now : existing.CreatedAt;

            await _platformContext.SaveChangesAsync();
            
            // Queue the OTP email in background worker
            _taskQueue.QueueOtpJob(email, code, 10);
            
            return true;
        }

        public async Task<LoginResponse> VerifyOtpAsync(VerifyOtpRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var purpose = string.IsNullOrWhiteSpace(request.Purpose) ? "Registration" : request.Purpose.Trim();

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
            if (user == null)
                throw new InvalidOperationException("User not found.");

            if (purpose == "Registration" && user.EmailVerified)
            {
                throw new InvalidOperationException("ALREADY_VERIFIED");
            }

            var otp = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == email && o.Purpose == purpose && !o.IsVerified);

            if (otp == null)
                throw new InvalidOperationException("No verification code found for this email.");
            if (otp.ExpiryTime <= DateTime.UtcNow)
                throw new InvalidOperationException("Verification code has expired.");
            if (otp.Attempts >= 5)
                throw new InvalidOperationException("Maximum verification attempts exceeded.");
            
            if (!_passwordHasher.VerifyPassword(request.Code, otp.OtpHash))
            {
                otp.Attempts++;
                await _platformContext.SaveChangesAsync();
                throw new InvalidOperationException("Invalid verification code.");
            }

            otp.IsVerified = true;
            user.EmailVerified = true;
            user.EmailVerifiedAt = DateTime.UtcNow;

            var (roles, permissions) = await GetUserRolesAndPermissionsAsync(user);
            var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
            var refreshToken = _tokenService.GenerateRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _platformContext.SaveChangesAsync();

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);
            return ToLoginResponse(user, accessToken, refreshToken, roles, permissions, onboarding.IsInitialized, onboarding.Status, onboarding.Progress, onboarding.Step, onboarding.FailureReason);
        }

        public async Task<LoginResponse> LoginAsync(LoginRequest request)
        {
            var inputIdentifier = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var user = await _platformContext.Users
                .FirstOrDefaultAsync(u => (u.Email.ToLower() == inputIdentifier || (u.Username != null && u.Username.ToLower() == inputIdentifier)) && !u.IsDeleted);

            if (user == null)
            {
                throw new UnauthorizedAccessException("Invalid email, username, or password/PIN.");
            }

            bool passwordValid = _passwordHasher.VerifyPassword(request.Password, user.PasswordHash);
            bool pinValid = !string.IsNullOrEmpty(user.PinHash) && _passwordHasher.VerifyPassword(request.Password, user.PinHash);

            if (!passwordValid && !pinValid)
            {
                throw new UnauthorizedAccessException("Invalid email, username, or password/PIN.");
            }

            if (!user.IsActive)
            {
                throw new UnauthorizedAccessException("User account is inactive.");
            }

            user.LastLoginAt = DateTime.UtcNow;

            var (roles, permissions) = await GetUserRolesAndPermissionsAsync(user);

            var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
            var refreshToken = _tokenService.GenerateRefreshToken();

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

            await _platformContext.SaveChangesAsync();

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);
            return ToLoginResponse(user, accessToken, refreshToken, roles, permissions, onboarding.IsInitialized, onboarding.Status, onboarding.Progress, onboarding.Step, onboarding.FailureReason);
        }

        public async Task<LoginResponse> RefreshTokenAsync(RefreshTokenRequest request)
        {
            var principal = _tokenService.GetPrincipalFromExpiredToken(request.AccessToken);
            var emailClaim = principal.FindFirst(ClaimTypes.Email) ?? principal.FindFirst("email");
            
            if (emailClaim == null)
            {
                throw new UnauthorizedAccessException("Invalid access token.");
            }

            var inputIdentifier = emailClaim.Value.ToLowerInvariant();
            var user = await _platformContext.Users
                .FirstOrDefaultAsync(u => (u.Email.ToLower() == inputIdentifier || (u.Username != null && u.Username.ToLower() == inputIdentifier)) && !u.IsDeleted);

            if (user == null || user.RefreshToken != request.RefreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                throw new UnauthorizedAccessException("Invalid or expired refresh token.");
            }

            var (roles, permissions) = await GetUserRolesAndPermissionsAsync(user);

            var newAccessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
            var newRefreshToken = _tokenService.GenerateRefreshToken();

            user.RefreshToken = newRefreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

            await _platformContext.SaveChangesAsync();

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);
            return ToLoginResponse(user, newAccessToken, newRefreshToken, roles, permissions, onboarding.IsInitialized, onboarding.Status, onboarding.Progress, onboarding.Step, onboarding.FailureReason);
        }

        public async Task<bool> ResetPasswordAsync(PasswordResetRequest request)
        {
            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower() && !u.IsDeleted);
            if (user == null)
            {
                return false;
            }

            user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task LogoutAsync(string userId)
        {
            if (Guid.TryParse(userId, out var guidId))
            {
                var user = await _platformContext.Users.FindAsync(guidId);
                if (user != null)
                {
                    user.RefreshToken = null;
                    user.RefreshTokenExpiryTime = null;
                    await _platformContext.SaveChangesAsync();
                }
            }
        }

        public async Task<AuthMeResponse> GetMeAsync(string userId)
        {
            if (!Guid.TryParse(userId, out var guidId))
                throw new UnauthorizedAccessException("Invalid user id.");

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == guidId && !u.IsDeleted);
            if (user == null)
                throw new UnauthorizedAccessException("User not found.");

            var membershipCount = await _platformContext.UserMemberships
                .CountAsync(m => m.PlatformUserId == user.Id && m.Status == "Active");

            var ownsCompany = user.TenantId.HasValue && await _platformContext.Tenants
                .AnyAsync(t => t.Id == user.TenantId.Value && !t.IsDeleted);

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);

            return new AuthMeResponse
            {
                UserId = user.Id,
                Name = $"{user.FirstName} {user.LastName}".Trim(),
                Email = user.Email,
                EmailVerified = user.EmailVerified,
                OwnsCompany = ownsCompany,
                MembershipCount = membershipCount,
                IsTenantInitialized = onboarding.IsInitialized,
                TenantStatus = onboarding.Status
            };
        }

        public async Task<UserSessionResponse> GetSessionAsync(string userId)
        {
            if (!Guid.TryParse(userId, out var guidId))
                throw new UnauthorizedAccessException("Invalid user id.");

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == guidId && !u.IsDeleted);
            if (user == null)
                throw new UnauthorizedAccessException("User not found.");

            var ownsCompany = user.TenantId.HasValue && await _platformContext.Tenants
                .AnyAsync(t => t.Id == user.TenantId.Value && !t.IsDeleted);

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);
            var isTenantInitialized = onboarding.IsInitialized;
            var tenantStatus = onboarding.Status;

            var (roles, permissions) = await GetUserRolesAndPermissionsAsync(user);

            string tenantSchema = "";
            string companyName = "";
            int onboardingProgress = 0;
            string onboardingStep = "";
            string onboardingFailureReason = "";

            if (user.TenantId.HasValue)
            {
                var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
                if (tenant != null)
                {
                    tenantSchema = tenant.SchemaName;
                    companyName = tenant.Name;
                    onboardingProgress = tenant.Progress;
                    onboardingStep = tenant.CurrentStep ?? "";
                    onboardingFailureReason = tenant.FailureReason ?? "";
                }
            }

            // Determine Dashboard Route based on Roles and Status
            string dashboard = "/company/dashboard";
            if (!user.EmailVerified)
            {
                dashboard = "/verify-otp";
            }
            else if (user.IsPlatformAdmin || roles.Contains("SuperAdmin") || roles.Contains("PlatformAdmin"))
            {
                dashboard = "/platform/dashboard";
            }
            else if (!user.TenantId.HasValue)
            {
                dashboard = "/onboarding";
            }
            else if (roles.Contains("Operator"))
            {
                dashboard = "/operator/dashboard";
            }
            else if (roles.Contains("Worker"))
            {
                dashboard = "/worker/dashboard";
            }
            else if (roles.Contains("Store Keeper") || roles.Contains("StoreKeeper") || roles.Contains("STORE_KEEPER"))
            {
                dashboard = "/store/dashboard";
            }
            else if (roles.Contains("Sales"))
            {
                dashboard = "/sales/dashboard";
            }
            else if (roles.Contains("HR"))
            {
                dashboard = "/hr/dashboard";
            }
            else if (roles.Contains("CompanyAdmin"))
            {
                dashboard = "/company/dashboard";
            }
            else if (roles.Contains("Manager"))
            {
                dashboard = "/manager/dashboard";
            }
            else if (roles.Contains("Supervisor"))
            {
                dashboard = "/supervisor/dashboard";
            }

            // Temporary Logging as requested by prompt
            Console.WriteLine($"[SESSION LOG] UserId: {user.Id}, CompanyId: {user.TenantId}, TenantId: {user.TenantId}, HasCompany: {ownsCompany}, HasCompletedOnboarding: {isTenantInitialized}, Selected Route: {dashboard}");

            return new UserSessionResponse
            {
                UserId = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                TenantId = user.TenantId,
                TenantSchema = tenantSchema,
                CompanyName = companyName,
                Roles = roles,
                Permissions = permissions,
                OwnsCompany = ownsCompany,
                IsTenantInitialized = isTenantInitialized,
                TenantStatus = tenantStatus,
                EmailVerified = user.EmailVerified,
                Dashboard = dashboard,
                AssignedProductionLineId = user.AssignedProductionLineId,
                OnboardingProgress = onboardingProgress,
                OnboardingStep = onboardingStep,
                OnboardingFailureReason = onboardingFailureReason
            };
        }

        private async Task<(List<string> Roles, List<string> Permissions)> GetUserRolesAndPermissionsAsync(User user)
        {
            var roles = new List<string>();
            var permissions = new List<string>();

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
                
                return (roles, permissions);
            }

            if (user.TenantId.HasValue)
            {
                var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
                if (tenant != null)
                {
                    using (var scope = _scopeFactory.CreateScope())
                    {
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
                                var roleCode = (ur.Role.Code == "OWNER" || ur.Role.Name.Equals("Owner", StringComparison.OrdinalIgnoreCase)) 
                                    ? "CompanyAdmin" 
                                    : ur.Role.Name;

                                roles.Add(roleCode);

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
            }

            Console.WriteLine($"[AUTH SERVICE] Authenticated User: {user.Email}, TenantId: {user.TenantId}, Loaded Roles: [{string.Join(", ", roles)}], Permissions Count: {permissions.Count}");
            return (roles, permissions);
        }

        private async Task<(bool IsInitialized, string Status, int Progress, string Step, string FailureReason)> GetTenantInitializationStatusAsync(Guid? tenantId)
        {
            if (!tenantId.HasValue)
            {
                return (false, "Pending", 0, "", "");
            }

            var tenant = await _platformContext.Tenants.FindAsync(tenantId.Value);
            if (tenant == null)
            {
                return (false, "Pending", 0, "", "");
            }

            return (tenant.IsInitialized, tenant.Status ?? "Pending", tenant.Progress, tenant.CurrentStep ?? "", tenant.FailureReason ?? "");
        }

        private static LoginResponse ToLoginResponse(
            User user, 
            string accessToken, 
            string refreshToken, 
            List<string> roles, 
            List<string> permissions, 
            bool isTenantInitialized, 
            string tenantStatus,
            int progress = 0,
            string step = "",
            string failureReason = "")
        {
            return new LoginResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = 3600,
                UserId = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                TenantId = user.TenantId,
                Roles = roles,
                Permissions = permissions,
                IsTenantInitialized = isTenantInitialized,
                TenantStatus = tenantStatus,
                EmailVerified = user.EmailVerified,
                AssignedProductionLineId = user.AssignedProductionLineId,
                OnboardingProgress = progress,
                OnboardingStep = step,
                OnboardingFailureReason = failureReason
            };
        }
    }
}
