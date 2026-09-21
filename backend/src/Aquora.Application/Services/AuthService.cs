using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Common.Exceptions;
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
        private readonly ICurrentUserContext _currentUserContext;

        public AuthService(
            IPlatformDbContext platformContext,
            ITokenService tokenService,
            IPasswordHasher passwordHasher,
            IServiceScopeFactory scopeFactory,
            IEmailService emailService,
            IBackgroundTaskQueue taskQueue,
            ICurrentUserContext currentUserContext)
        {
            _platformContext = platformContext;
            _tokenService = tokenService;
            _passwordHasher = passwordHasher;
            _scopeFactory = scopeFactory;
            _emailService = emailService;
            _taskQueue = taskQueue;
            _currentUserContext = currentUserContext;
        }

        public async Task<bool> RegisterAsync(RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || !Regex.IsMatch(request.Email.Trim(), @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                throw new InvalidOperationException("A valid email address is required.");

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8 ||
                !Regex.IsMatch(request.Password, "[A-Z]") ||
                !Regex.IsMatch(request.Password, "[a-z]") ||
                !Regex.IsMatch(request.Password, "[0-9]"))
                throw new InvalidOperationException("Password must be at least 8 characters and include uppercase, lowercase, and a number.");

            if (request.Password != request.ConfirmPassword)
                throw new InvalidOperationException("Passwords do not match.");

            var email = request.Email.Trim().ToLowerInvariant();
            
            // Comprehensive pre-check (including soft-deleted and unverified accounts)
            var existingUser = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            if (existingUser != null)
            {
                if (existingUser.EmailVerified || existingUser.IsDeleted)
                {
                    Console.WriteLine($"[USER REGISTRATION REJECTED]: Email '{GetSafeEmailIdentifier(email)}' already registered (Verified: {existingUser.EmailVerified}, Deleted: {existingUser.IsDeleted}).");
                    throw new InvalidOperationException("An account with this email already exists.");
                }

                // Unverified active user re-registering: update password/details and send fresh OTP without duplicate INSERT
                Console.WriteLine($"[USER REGISTRATION RE-VERIFY]: Re-triggering verification for unverified email '{GetSafeEmailIdentifier(email)}'.");
                var nameParts = (request.FullName ?? string.Empty).Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                existingUser.FirstName = nameParts.Length > 0 ? nameParts[0] : string.Empty;
                existingUser.LastName = nameParts.Length > 1 ? nameParts[1] : string.Empty;
                existingUser.PasswordHash = _passwordHasher.HashPassword(request.Password);
                existingUser.IsActive = true;

                await _platformContext.SaveChangesAsync();
                await SendOtpAsync(new SendOtpRequest { Email = email, Purpose = "Registration" });
                return true;
            }

            var parts = (request.FullName ?? string.Empty).Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

            using (var transaction = await _platformContext.Database.BeginTransactionAsync())
            {
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
                    await transaction.CommitAsync();
                    Console.WriteLine($"[USER REGISTRATION SUCCESS]: User '{GetSafeEmailIdentifier(email)}' saved and committed to database.");
                }
                catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
                {
                    await transaction.RollbackAsync();
                    Console.WriteLine($"[USER REGISTRATION RACE CONDITION]: Prevented duplicate INSERT for '{GetSafeEmailIdentifier(email)}'.");
                    throw new InvalidOperationException("An account with this email already exists.");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    Console.WriteLine($"[USER REGISTRATION ERROR]: Failed to register user '{GetSafeEmailIdentifier(email)}': {ex.Message}");
                    throw;
                }
            }

            // Deliver OTP email outside the database transaction
            try
            {
                await SendOtpAsync(new SendOtpRequest { Email = email, Purpose = "Registration" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USER REGISTRATION SMTP WARN]: User registered successfully, but OTP email delivery encountered issue: {ex.Message}");
            }

            return true;
        }

        private static string GetSafeEmailIdentifier(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return "***";
            var parts = email.Split('@');
            if (parts.Length != 2) return "***";
            var prefix = parts[0];
            var domain = parts[1];
            if (prefix.Length <= 2) return $"{prefix}***@{domain}";
            return $"{prefix[0]}***{prefix[^1]}@{domain}";
        }

        private static bool IsUniqueConstraintViolation(DbUpdateException ex)
        {
            var current = ex.InnerException;
            while (current != null)
            {
                if (current.GetType().Name.Equals("PostgresException", StringComparison.OrdinalIgnoreCase))
                {
                    var sqlStateProp = current.GetType().GetProperty("SqlState");
                    var sqlState = sqlStateProp?.GetValue(current)?.ToString();
                    if (sqlState == "23505") return true;
                }
                if (current.Message.Contains("23505") || current.Message.Contains("IX_Users_Email") || current.Message.Contains("duplicate key"))
                {
                    return true;
                }
                current = current.InnerException;
            }
            return ex.Message.Contains("23505") || ex.Message.Contains("IX_Users_Email");
        }

        public async Task<bool> SendOtpAsync(SendOtpRequest request, CancellationToken cancellationToken = default)
        {
            var totalSw = System.Diagnostics.Stopwatch.StartNew();
            var stepSw = System.Diagnostics.Stopwatch.StartNew();

            if (string.IsNullOrWhiteSpace(request.Email))
                throw new InvalidOperationException("Email address is required.");

            var email = request.Email.Trim().ToLowerInvariant();
            var rawPurpose = string.IsNullOrWhiteSpace(request.Purpose) ? "Registration" : request.Purpose.Trim();
            var purpose = rawPurpose.Equals("EmailVerification", StringComparison.OrdinalIgnoreCase) ? "Registration" : rawPurpose;
            var now = DateTime.UtcNow;

            Console.WriteLine($"[SendOtp Timeline] Request received for recipient '{GetSafeEmailIdentifier(email)}', Purpose '{purpose}'.");

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted, cancellationToken);
            var userLookupMs = stepSw.ElapsedMilliseconds;

            if (purpose == "Registration" && user != null && user.EmailVerified)
            {
                Console.WriteLine($"[SendOtp Timeline] User lookup ({userLookupMs}ms) - REJECTED: User '{GetSafeEmailIdentifier(email)}' is already verified.");
                throw new InvalidOperationException("ALREADY_VERIFIED");
            }
            
            // Account enumeration defense for password reset:
            if (purpose == "PasswordReset" && user == null)
            {
                Console.WriteLine($"[SendOtp Timeline] User lookup ({userLookupMs}ms) - SAFE IGNORE: Non-registered email '{GetSafeEmailIdentifier(email)}'.");
                return true;
            }

            stepSw.Restart();
            var existing = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == email && 
                    (o.Purpose == purpose || (purpose == "Registration" && o.Purpose == "EmailVerification")) && 
                    !o.IsUsed, cancellationToken);
            var dbLookupMs = stepSw.ElapsedMilliseconds;

            // 60-second cooldown check
            if (existing != null && existing.LastSentAt.HasValue && existing.LastSentAt.Value.AddMinutes(1) > now)
            {
                var elapsedSeconds = (int)(now - existing.LastSentAt.Value).TotalSeconds;
                var remainingSeconds = Math.Max(1, 60 - elapsedSeconds);
                Console.WriteLine($"[SendOtp Timeline] Cooldown check - Rate limited. {remainingSeconds}s remaining.");
                throw new OtpRateLimitException($"Please wait {remainingSeconds} seconds before requesting another OTP.", remainingSeconds);
            }

            // Hourly send cap check (max 5)
            if (existing != null && existing.CreatedAt.AddHours(1) > now && existing.SendCount >= 5)
            {
                var remainingMinutes = Math.Max(1, 60 - (int)(now - existing.CreatedAt).TotalMinutes);
                Console.WriteLine($"[SendOtp Timeline] Hourly cap check - Rate limited for {remainingMinutes}m.");
                throw new OtpRateLimitException("OTP rate limit exceeded. Please try again later.", remainingMinutes * 60);
            }

            stepSw.Restart();
            var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            var otpGenMs = stepSw.ElapsedMilliseconds;

            stepSw.Restart();
            try
            {
                await _emailService.SendOtpEmailAsync(email, code, 10, purpose, user?.FirstName, cancellationToken);
            }
            catch (Exception ex)
            {
                var smtpFailMs = stepSw.ElapsedMilliseconds;
                Console.WriteLine($"[SendOtp Timeline] SMTP send FAILED after {smtpFailMs}ms: {ex.Message}");
                throw new InvalidOperationException($"Unable to send OTP email. Please verify email configuration or try again later. Details: {ex.Message}");
            }
            var smtpMs = stepSw.ElapsedMilliseconds;

            stepSw.Restart();
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

            existing.Purpose = purpose; // Ensure normalized purpose
            existing.OtpHash = _passwordHasher.HashPassword(code);
            existing.ExpiryTime = now.AddMinutes(10);
            existing.Attempts = 0;
            existing.SendCount = existing.CreatedAt.AddHours(1) > now ? existing.SendCount + 1 : 1;
            existing.LastSentAt = now;
            existing.IsVerified = false;
            existing.IsUsed = false;
            existing.ResetToken = null;
            existing.ResetTokenExpiryTime = null;
            existing.CreatedAt = existing.CreatedAt == default ? now : existing.CreatedAt;

            await _platformContext.SaveChangesAsync(cancellationToken);
            var dbSaveMs = stepSw.ElapsedMilliseconds;

            totalSw.Stop();
            Console.WriteLine($"[SendOtp Timeline COMPLETE] Total: {totalSw.ElapsedMilliseconds}ms (UserLookup: {userLookupMs}ms, DbLookup: {dbLookupMs}ms, OtpGen: {otpGenMs}ms, SmtpSend: {smtpMs}ms, DbSave: {dbSaveMs}ms).");

            return true;
        }

        public async Task<LoginResponse> VerifyOtpAsync(VerifyOtpRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var rawPurpose = string.IsNullOrWhiteSpace(request.Purpose) ? "Registration" : request.Purpose.Trim();
            var purpose = rawPurpose.Equals("EmailVerification", StringComparison.OrdinalIgnoreCase) ? "Registration" : rawPurpose;

            Console.WriteLine($"[OTP VERIFY INITIATED]: Email '{email}', Requested Purpose '{rawPurpose}', Normalized Purpose '{purpose}'.");

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
            if (user == null)
            {
                Console.WriteLine($"[OTP VERIFY FAILED]: User '{email}' not found.");
                throw new InvalidOperationException("User not found.");
            }

            if (purpose == "Registration" && user.EmailVerified)
            {
                Console.WriteLine($"[OTP VERIFY]: User '{email}' is already verified.");
                throw new InvalidOperationException("ALREADY_VERIFIED");
            }

            var otp = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == email && 
                    (o.Purpose == purpose || (purpose == "Registration" && o.Purpose == "EmailVerification")) && 
                    !o.IsUsed &&
                    !o.IsVerified);

            if (otp == null)
            {
                Console.WriteLine($"[OTP VERIFY FAILED]: No unverified OTP record found in database for Email '{email}', Purpose '{purpose}'.");
                throw new InvalidOperationException("No verification code found for this email.");
            }
            if (otp.ExpiryTime <= DateTime.UtcNow)
            {
                Console.WriteLine($"[OTP VERIFY FAILED]: OTP expired for Email '{email}', ExpiryTime '{otp.ExpiryTime}', CurrentTime '{DateTime.UtcNow}'.");
                throw new InvalidOperationException("Verification code has expired.");
            }
            if (otp.Attempts >= 5)
            {
                Console.WriteLine($"[OTP VERIFY FAILED]: Maximum verification attempts ({otp.Attempts}) exceeded for Email '{email}'.");
                throw new InvalidOperationException("Maximum verification attempts exceeded.");
            }
            
            if (!_passwordHasher.VerifyPassword(request.Code, otp.OtpHash))
            {
                otp.Attempts++;
                await _platformContext.SaveChangesAsync();
                Console.WriteLine($"[OTP VERIFY FAILED]: Invalid verification PIN entered for Email '{email}'. Attempt {otp.Attempts}/5.");
                throw new InvalidOperationException("Invalid verification code.");
            }

            otp.IsVerified = true;
            otp.VerifiedAt = DateTime.UtcNow;
            otp.IsUsed = true;
            otp.UsedAt = DateTime.UtcNow;

            user.EmailVerified = true;
            user.EmailVerifiedAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;

            var (roles, permissions) = await GetUserRolesAndPermissionsAsync(user);
            var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
            var refreshToken = _tokenService.GenerateRefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _platformContext.SaveChangesAsync();

            Console.WriteLine($"[OTP VERIFICATION SUCCESS]: Email '{email}' verified successfully. User ID '{user.Id}'.");

            // Self-heal: If user.TenantId is missing, resolve by owner identity or memberships
            if (!user.TenantId.HasValue)
            {
                var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                var userGuidStr = user.Id.ToString();
                var resolvedTenant = await _platformContext.Tenants
                    .OrderByDescending(t => t.CreatedAt)
                    .FirstOrDefaultAsync(t => !t.IsDeleted &&
                        (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr));

                if (resolvedTenant == null)
                {
                    var membership = await _platformContext.UserMemberships
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id);

                    if (membership != null)
                    {
                        resolvedTenant = await _platformContext.Tenants
                            .FirstOrDefaultAsync(t => t.Id == membership.TenantId && !t.IsDeleted);
                    }
                }

                if (resolvedTenant != null)
                {
                    user.TenantId = resolvedTenant.Id;
                    await _platformContext.SaveChangesAsync();
                }
            }

            string companyName = "";
            if (user.TenantId.HasValue)
            {
                var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
                if (tenant != null)
                {
                    companyName = tenant.Name;
                }
            }

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);
            return ToLoginResponse(user, accessToken, refreshToken, roles, permissions, onboarding.IsInitialized, onboarding.Status, onboarding.Progress, onboarding.Step, onboarding.FailureReason, companyName);
        }

        private async Task LogLoginAttemptAsync(string username, User? user, Tenant? tenant, bool isSuccess, string reason)
        {
            try
            {
                var auditLog = new PlatformAuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = user?.TenantId ?? Guid.Empty,
                    UserId = user?.Id.ToString(),
                    UserEmail = user?.Email ?? username,
                    Action = isSuccess ? "Login_Success" : "Login_Failure",
                    TableName = "Users",
                    PrimaryKey = user?.Id.ToString(),
                    OldValues = null,
                    NewValues = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        InputUsername = username,
                        ResolvedCompany = tenant?.Name,
                        ResolvedSchema = tenant?.SchemaName,
                        ClientIP = _currentUserContext.IpAddress,
                        UserAgent = _currentUserContext.UserAgent
                    }),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = _currentUserContext.IpAddress,
                    Reason = reason,
                    Module = "Authentication"
                };
                _platformContext.PlatformAuditLogs.Add(auditLog);
                await _platformContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                var innerMsg = ex.InnerException != null ? $" Inner: {ex.InnerException.Message}" : "";
                Console.WriteLine($"[AUDIT LOG EXCEPTION] Failed to log login attempt: {ex.Message}{innerMsg}");
            }
        }

        public async Task<LoginResponse> LoginAsync(LoginRequest request)
        {
            var inputIdentifier = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var user = await _platformContext.Users
                .FirstOrDefaultAsync(u => (u.Email.ToLower() == inputIdentifier || (u.Username != null && u.Username.ToLower() == inputIdentifier)) && !u.IsDeleted);

            if (user == null)
            {
                await LogLoginAttemptAsync(inputIdentifier, null, null, false, "Invalid username/email or PIN.");
                throw new UnauthorizedAccessException("Invalid username/email or PIN.");
            }

            // Self-heal: If user.TenantId is missing, resolve by owner identity or memberships
            if (!user.TenantId.HasValue)
            {
                var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                var userGuidStr = user.Id.ToString();
                var resolvedTenant = await _platformContext.Tenants
                    .OrderByDescending(t => t.CreatedAt)
                    .FirstOrDefaultAsync(t => !t.IsDeleted &&
                        (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr));

                if (resolvedTenant == null)
                {
                    var membership = await _platformContext.UserMemberships
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id);

                    if (membership != null)
                    {
                        resolvedTenant = await _platformContext.Tenants
                            .FirstOrDefaultAsync(t => t.Id == membership.TenantId && !t.IsDeleted);
                    }
                }

                if (resolvedTenant != null)
                {
                    user.TenantId = resolvedTenant.Id;
                    await _platformContext.SaveChangesAsync();
                }
            }

            Tenant? tenant = null;
            string companyName = "";
            if (user.TenantId.HasValue)
            {
                tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
                if (tenant == null || tenant.IsDeleted)
                {
                    await LogLoginAttemptAsync(inputIdentifier, user, null, false, "This company could not be found.");
                    throw new UnauthorizedAccessException("This company could not be found.");
                }

                companyName = tenant.Name;

                if (!tenant.IsActive)
                {
                    await LogLoginAttemptAsync(inputIdentifier, user, tenant, false, "This company account is inactive.");
                    throw new UnauthorizedAccessException("This company account is inactive.");
                }
            }

            bool passwordValid = _passwordHasher.VerifyPassword(request.Password, user.PasswordHash);
            bool pinValid = !string.IsNullOrEmpty(user.PinHash) && _passwordHasher.VerifyPassword(request.Password, user.PinHash);

            if (!passwordValid && !pinValid)
            {
                await LogLoginAttemptAsync(inputIdentifier, user, tenant, false, "Incorrect PIN.");
                throw new UnauthorizedAccessException("Invalid username/email or PIN.");
            }

            if (!user.IsActive)
            {
                await LogLoginAttemptAsync(inputIdentifier, user, tenant, false, "Your account is inactive.");
                throw new UnauthorizedAccessException("Your account is inactive.");
            }

            user.LastLoginAt = DateTime.UtcNow;

            var (roles, permissions) = await GetUserRolesAndPermissionsAsync(user);

            var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
            var refreshToken = _tokenService.GenerateRefreshToken();

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

            await _platformContext.SaveChangesAsync();

            await LogLoginAttemptAsync(inputIdentifier, user, tenant, true, "User logged in successfully.");

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);
            return ToLoginResponse(user, accessToken, refreshToken, roles, permissions, onboarding.IsInitialized, onboarding.Status, onboarding.Progress, onboarding.Step, onboarding.FailureReason, companyName);
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

            string companyName = "";
            if (user.TenantId.HasValue)
            {
                var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
                if (tenant != null)
                {
                    companyName = tenant.Name;
                }
            }

            var onboarding = await GetTenantInitializationStatusAsync(user.TenantId);
            return ToLoginResponse(user, newAccessToken, newRefreshToken, roles, permissions, onboarding.IsInitialized, onboarding.Status, onboarding.Progress, onboarding.Step, onboarding.FailureReason, companyName);
        }

        public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request, string? ipAddress = null, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
                return true; // Safe generic response

            var email = request.Email.Trim().ToLowerInvariant();
            await SendOtpAsync(new SendOtpRequest
            {
                Email = email,
                Purpose = "PasswordReset"
            }, cancellationToken);

            return true;
        }

        public async Task<VerifyPasswordResetOtpResponse> VerifyPasswordResetOtpAsync(VerifyPasswordResetOtpRequest request, string? ipAddress = null)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Code))
                throw new InvalidOperationException("Email and verification code are required.");

            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
            if (user == null)
            {
                throw new InvalidOperationException("Invalid verification code.");
            }

            var otp = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == email && o.Purpose == "PasswordReset" && !o.IsUsed);

            if (otp == null)
            {
                throw new InvalidOperationException("No active password recovery request found for this email.");
            }

            if (otp.ExpiryTime <= DateTime.UtcNow)
            {
                throw new InvalidOperationException("Verification code has expired. Please request a new recovery code.");
            }

            if (otp.Attempts >= 5)
            {
                throw new InvalidOperationException("Maximum verification attempts exceeded. Please request a new recovery code.");
            }

            if (!_passwordHasher.VerifyPassword(request.Code, otp.OtpHash))
            {
                otp.Attempts++;
                await _platformContext.SaveChangesAsync();
                throw new InvalidOperationException("Invalid verification code.");
            }

            // Generate cryptographically secure URL-safe reset token
            var randomBytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(randomBytes);
            }
            var resetToken = Convert.ToBase64String(randomBytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");

            otp.IsVerified = true;
            otp.VerifiedAt = DateTime.UtcNow;
            otp.ResetToken = resetToken;
            otp.ResetTokenExpiryTime = DateTime.UtcNow.AddMinutes(15);
            otp.UpdatedAt = DateTime.UtcNow;
            otp.UpdatedByIP = ipAddress ?? _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            return new VerifyPasswordResetOtpResponse
            {
                Success = true,
                Message = "Verification code validated successfully.",
                Email = email,
                ResetToken = resetToken,
                ExpiresInMinutes = 15
            };
        }

        public async Task<bool> ResetPasswordAsync(PasswordResetRequest request, string? ipAddress = null)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
                throw new InvalidOperationException("Email address is required.");

            if (string.IsNullOrWhiteSpace(request.NewPassword))
                throw new InvalidOperationException("New password is required.");

            if (request.NewPassword.Length < 8 ||
                !Regex.IsMatch(request.NewPassword, "[A-Z]") ||
                !Regex.IsMatch(request.NewPassword, "[a-z]") ||
                !Regex.IsMatch(request.NewPassword, "[0-9]"))
            {
                throw new InvalidOperationException("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.");
            }

            if (!string.IsNullOrWhiteSpace(request.ConfirmPassword) && request.NewPassword != request.ConfirmPassword)
            {
                throw new InvalidOperationException("The new password and confirmation password do not match.");
            }

            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
            if (user == null)
            {
                throw new InvalidOperationException("Account could not be found.");
            }

            // Authorize password reset via ResetToken or valid OTP Code (backward compatibility)
            OTPVerification? otp = null;
            if (!string.IsNullOrWhiteSpace(request.ResetToken))
            {
                otp = await _platformContext.OTPVerifications
                    .FirstOrDefaultAsync(o => o.Email.ToLower() == email &&
                        o.Purpose == "PasswordReset" &&
                        o.ResetToken == request.ResetToken &&
                        !o.IsUsed);

                if (otp == null || !otp.ResetTokenExpiryTime.HasValue || otp.ResetTokenExpiryTime.Value <= DateTime.UtcNow)
                {
                    throw new InvalidOperationException("Password reset authorization has expired or is invalid. Please request a new recovery code.");
                }
            }
            else if (!string.IsNullOrWhiteSpace(request.Code))
            {
                otp = await _platformContext.OTPVerifications
                    .FirstOrDefaultAsync(o => o.Email.ToLower() == email &&
                        o.Purpose == "PasswordReset" &&
                        !o.IsUsed);

                if (otp == null || otp.ExpiryTime <= DateTime.UtcNow || !_passwordHasher.VerifyPassword(request.Code, otp.OtpHash))
                {
                    throw new InvalidOperationException("Invalid or expired verification code.");
                }
            }
            else
            {
                throw new InvalidOperationException("Password reset authorization token or verification code is required.");
            }

            // Reject password reuse
            if (_passwordHasher.VerifyPassword(request.NewPassword, user.PasswordHash))
            {
                throw new InvalidOperationException("New password cannot be the same as your current password.");
            }

            // Hash new password and invalidate active sessions
            var newHash = _passwordHasher.HashPassword(request.NewPassword);
            user.PasswordHash = newHash;
            user.PinHash = newHash;
            user.TokenVersion++;
            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedByIP = ipAddress ?? _currentUserContext.IpAddress;

            // Invalidate OTP / Reset token
            if (otp != null)
            {
                otp.IsUsed = true;
                otp.UsedAt = DateTime.UtcNow;
                otp.UpdatedAt = DateTime.UtcNow;
                otp.ResetToken = null;
            }

            await _platformContext.SaveChangesAsync();

            // Record security audit event
            try
            {
                var auditLog = new PlatformAuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = user.TenantId ?? Guid.Empty,
                    UserId = user.Id.ToString(),
                    UserEmail = user.Email,
                    Action = "Password_Reset_Completed",
                    TableName = "Users",
                    PrimaryKey = user.Id.ToString(),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = ipAddress ?? _currentUserContext.IpAddress,
                    Device = _currentUserContext.UserAgent,
                    Reason = "User successfully reset account password via OTP verification.",
                    Module = "Authentication"
                };
                _platformContext.PlatformAuditLogs.Add(auditLog);
                await _platformContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AUTH AUDIT WARN]: Could not write password reset audit log: {ex.Message}");
            }

            // Send confirmation alert email
            try
            {
                await _emailService.SendPasswordChangedNotificationAsync(user.Email, user.FirstName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AUTH EMAIL WARN]: Password updated, but security alert email failed: {ex.Message}");
            }

            return true;
        }

        public async Task<bool> ResendOtpAsync(ResendOtpRequest request, string? ipAddress = null, CancellationToken cancellationToken = default)
        {
            return await SendOtpAsync(new SendOtpRequest
            {
                Email = request.Email,
                Purpose = request.Purpose
            }, cancellationToken);
        }

        public async Task<bool> RequestEmailChangeAsync(string userId, RequestEmailChangeRequest request, string? ipAddress = null, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.NewEmail) || !Regex.IsMatch(request.NewEmail.Trim(), @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            {
                throw new InvalidOperationException("A valid new email address is required.");
            }

            if (!Guid.TryParse(userId, out var guidId))
            {
                throw new UnauthorizedAccessException("Invalid user identifier.");
            }

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == guidId && !u.IsDeleted);
            if (user == null)
            {
                throw new UnauthorizedAccessException("User profile not found.");
            }

            var newEmail = request.NewEmail.Trim().ToLowerInvariant();
            if (string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("The new email address is the same as your current email address.");
            }

            var duplicate = await _platformContext.Users.AnyAsync(u => u.Id != user.Id && u.Email.ToLower() == newEmail && !u.IsDeleted);
            if (duplicate)
            {
                throw new InvalidOperationException("An account with this email address already exists.");
            }

            // Dispatch OTP to the NEW email address
            return await SendOtpAsync(new SendOtpRequest
            {
                Email = newEmail,
                Purpose = "EmailChange"
            }, cancellationToken);
        }

        public async Task<bool> VerifyEmailChangeAsync(string userId, VerifyEmailChangeRequest request, string? ipAddress = null)
        {
            if (string.IsNullOrWhiteSpace(request.NewEmail) || string.IsNullOrWhiteSpace(request.Code))
            {
                throw new InvalidOperationException("New email address and verification code are required.");
            }

            if (!Guid.TryParse(userId, out var guidId))
            {
                throw new UnauthorizedAccessException("Invalid user identifier.");
            }

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == guidId && !u.IsDeleted);
            if (user == null)
            {
                throw new UnauthorizedAccessException("User profile not found.");
            }

            var newEmail = request.NewEmail.Trim().ToLowerInvariant();
            var duplicate = await _platformContext.Users.AnyAsync(u => u.Id != user.Id && u.Email.ToLower() == newEmail && !u.IsDeleted);
            if (duplicate)
            {
                throw new InvalidOperationException("An account with this email address already exists.");
            }

            var otp = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == newEmail && o.Purpose == "EmailChange" && !o.IsUsed);

            if (otp == null)
            {
                throw new InvalidOperationException("No active email verification request found for this email address.");
            }

            if (otp.ExpiryTime <= DateTime.UtcNow)
            {
                throw new InvalidOperationException("Verification code has expired. Please request a new code.");
            }

            if (otp.Attempts >= 5)
            {
                throw new InvalidOperationException("Maximum verification attempts exceeded. Please request a new code.");
            }

            if (!_passwordHasher.VerifyPassword(request.Code, otp.OtpHash))
            {
                otp.Attempts++;
                await _platformContext.SaveChangesAsync();
                throw new InvalidOperationException("Invalid verification code.");
            }

            var oldEmail = user.Email;
            otp.IsVerified = true;
            otp.VerifiedAt = DateTime.UtcNow;
            otp.IsUsed = true;
            otp.UsedAt = DateTime.UtcNow;

            user.Email = newEmail;
            user.EmailVerified = true;
            user.EmailVerifiedAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            user.UpdatedByIP = ipAddress ?? _currentUserContext.IpAddress;

            await _platformContext.SaveChangesAsync();

            // Record security audit event
            try
            {
                var auditLog = new PlatformAuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = user.TenantId ?? Guid.Empty,
                    UserId = user.Id.ToString(),
                    UserEmail = newEmail,
                    Action = "Email_Changed",
                    TableName = "Users",
                    PrimaryKey = user.Id.ToString(),
                    OldValues = System.Text.Json.JsonSerializer.Serialize(new { Email = oldEmail }),
                    NewValues = System.Text.Json.JsonSerializer.Serialize(new { Email = newEmail }),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = ipAddress ?? _currentUserContext.IpAddress,
                    Device = _currentUserContext.UserAgent,
                    Reason = $"User changed account email from '{oldEmail}' to '{newEmail}'.",
                    Module = "AccountProfile"
                };
                _platformContext.PlatformAuditLogs.Add(auditLog);
                await _platformContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AUTH AUDIT WARN]: Could not record email change audit log: {ex.Message}");
            }

            // Dispatch alert to OLD email
            try
            {
                await _emailService.SendEmailChangedNotificationAsync(oldEmail, newEmail, user.FirstName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AUTH EMAIL WARN]: Email updated, but alert notification to old email failed: {ex.Message}");
            }

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

            // Self-heal: If user.TenantId is missing, resolve by owner identity or memberships
            if (!user.TenantId.HasValue)
            {
                var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                var userGuidStr = user.Id.ToString();
                var resolvedTenant = await _platformContext.Tenants
                    .OrderByDescending(t => t.CreatedAt)
                    .FirstOrDefaultAsync(t => !t.IsDeleted &&
                        (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr));

                if (resolvedTenant == null)
                {
                    var membership = await _platformContext.UserMemberships
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id);

                    if (membership != null)
                    {
                        resolvedTenant = await _platformContext.Tenants
                            .FirstOrDefaultAsync(t => t.Id == membership.TenantId && !t.IsDeleted);
                    }
                }

                if (resolvedTenant != null)
                {
                    user.TenantId = resolvedTenant.Id;
                    await _platformContext.SaveChangesAsync();
                }
            }

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

            // Self-heal: If user.TenantId is missing, resolve by owner identity or memberships
            if (!user.TenantId.HasValue)
            {
                var normalizedEmail = user.Email.Trim().ToLowerInvariant();
                var userGuidStr = user.Id.ToString();
                var resolvedTenant = await _platformContext.Tenants
                    .OrderByDescending(t => t.CreatedAt)
                    .FirstOrDefaultAsync(t => !t.IsDeleted &&
                        (t.OwnerEmail == normalizedEmail || t.CreatedBy == userGuidStr));

                if (resolvedTenant == null)
                {
                    var membership = await _platformContext.UserMemberships
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefaultAsync(m => m.PlatformUserId == user.Id);

                    if (membership != null)
                    {
                        resolvedTenant = await _platformContext.Tenants
                            .FirstOrDefaultAsync(t => t.Id == membership.TenantId && !t.IsDeleted);
                    }
                }

                if (resolvedTenant != null)
                {
                    user.TenantId = resolvedTenant.Id;
                    await _platformContext.SaveChangesAsync();
                }
            }

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
            else if (!isTenantInitialized)
            {
                dashboard = "/account-setup";
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
            else if (roles.Contains("CompanyAdmin") || roles.Contains("Accountant"))
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
                try
                {
                    var tenant = await _platformContext.Tenants.FindAsync(user.TenantId.Value);
                    if (tenant != null && tenant.IsInitialized)
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
                                    var roleCode = ur.Role.Name;
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
                    else
                    {
                        // Tenant schema is currently provisioning/initializing — assign default onboarding owner role
                        Console.WriteLine($"[AUTH SERVICE]: Tenant {user.TenantId} is currently initializing ({tenant?.Status ?? "Provisioning"}). Assigning default onboarding role 'CompanyAdmin'.");
                        roles.Add("CompanyAdmin");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AUTH SERVICE WARN]: Could not query tenant roles/permissions for tenant {user.TenantId}: {ex.Message}.");
                    if (!string.IsNullOrWhiteSpace(user.RoleName))
                    {
                        roles.Add(user.RoleName);
                    }
                    else if (!roles.Contains("CompanyAdmin"))
                    {
                        roles.Add("CompanyAdmin");
                    }
                }
            }

            if (roles.Count == 0)
            {
                roles.Add(!string.IsNullOrWhiteSpace(user.RoleName) ? user.RoleName : "Operator");
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
            string failureReason = "",
            string companyName = "")
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
                CompanyName = companyName,
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
