using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

namespace Aquora.Application.Services
{
    public class TenantService : ITenantService
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly IPasswordHasher _passwordHasher;
        private readonly ITokenService _tokenService;
        private readonly ITenantDatabaseService _tenantDatabaseService;
        private readonly ISchemaNameGenerator _schemaNameGenerator;
        private readonly Aquora.Application.Interfaces.Services.IEmailService _emailService;
        private readonly IBackgroundTaskQueue _taskQueue;

        public TenantService(
            IPlatformDbContext platformContext,
            IPasswordHasher passwordHasher,
            ITokenService tokenService,
            ITenantDatabaseService tenantDatabaseService,
            ISchemaNameGenerator schemaNameGenerator,
            Aquora.Application.Interfaces.Services.IEmailService emailService,
            IBackgroundTaskQueue taskQueue)
        {
            _platformContext = platformContext;
            _passwordHasher = passwordHasher;
            _tokenService = tokenService;
            _tenantDatabaseService = tenantDatabaseService;
            _schemaNameGenerator = schemaNameGenerator;
            _emailService = emailService;
            _taskQueue = taskQueue;
        }

        public async Task<bool> SendOtpAsync(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email is required.");

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.Trim().ToLower() && !u.IsDeleted);
            if (user != null && user.EmailVerified)
            {
                throw new InvalidOperationException("ALREADY_VERIFIED");
            }

            // 1. Generate 6-digit secure random code
            var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            var otpHash = _passwordHasher.HashPassword(code);

            // 2. Check if a code already exists for this email
            var existing = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == email.ToLower() && !o.IsVerified);

            if (existing != null)
            {
                existing.OtpHash = otpHash;
                existing.ExpiryTime = DateTime.UtcNow.AddMinutes(10);
                existing.Attempts = 0;
                existing.CreatedAt = DateTime.UtcNow;
            }
            else
            {
                var otp = new OTPVerification
                {
                    Email = email.ToLower(),
                    OtpHash = otpHash,
                    ExpiryTime = DateTime.UtcNow.AddMinutes(10),
                    Attempts = 0,
                    IsVerified = false,
                    RequestId = Guid.NewGuid().ToString()
                };
                _platformContext.OTPVerifications.Add(otp);
            }

            await _platformContext.SaveChangesAsync();

            // Queue the OTP email in background worker
            _taskQueue.QueueOtpJob(email, code, 10);
            
            return true;
        }

        public async Task<LoginResponse> VerifyOtpAndCreateUserAsync(OTPRegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
                throw new ArgumentException("Email is required.");

            var email = request.Email.Trim().ToLowerInvariant();

            // 1. Verify unique email (including soft-deleted)
            var emailExists = await _platformContext.Users
                .AnyAsync(u => u.Email.ToLower() == email);
            if (emailExists)
            {
                throw new InvalidOperationException("An account with this email already exists.");
            }

            // 2. Retrieve OTP verification record
            Console.WriteLine($"[TENANT OTP VERIFY INITIATED]: Email '{email}'.");

            var otp = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email.ToLower() == email && !o.IsVerified);

            if (otp == null)
            {
                Console.WriteLine($"[TENANT OTP VERIFY FAILED]: No unverified OTP found for Email '{email}'.");
                throw new InvalidOperationException("No verification code found for this email.");
            }

            if (otp.ExpiryTime <= DateTime.UtcNow)
            {
                Console.WriteLine($"[TENANT OTP VERIFY FAILED]: OTP expired for Email '{email}'.");
                throw new InvalidOperationException("Verification code has expired.");
            }

            if (otp.Attempts >= 5)
            {
                Console.WriteLine($"[TENANT OTP VERIFY FAILED]: Max attempts ({otp.Attempts}) reached for Email '{email}'.");
                throw new InvalidOperationException("Maximum verification attempts exceeded. Please request a new OTP.");
            }

            if (!_passwordHasher.VerifyPassword(request.Code, otp.OtpHash))
            {
                otp.Attempts++;
                await _platformContext.SaveChangesAsync();
                Console.WriteLine($"[TENANT OTP VERIFY FAILED]: Invalid PIN for Email '{email}', attempt {otp.Attempts}/5.");
                throw new InvalidOperationException("Invalid verification code.");
            }

            otp.IsVerified = true;
            await _platformContext.SaveChangesAsync();
            Console.WriteLine($"[TENANT OTP VERIFY SUCCESS]: OTP verified for Email '{email}'.");

            // 3. Create User record globally
            try
            {
                var user = new User
                {
                    Email = email,
                    FirstName = request.FirstName?.Trim() ?? string.Empty,
                    LastName = request.LastName?.Trim() ?? string.Empty,
                    PasswordHash = _passwordHasher.HashPassword(request.Password),
                    IsActive = true,
                    EmailVerified = true,
                    EmailVerifiedAt = DateTime.UtcNow
                };
                _platformContext.Users.Add(user);
                await _platformContext.SaveChangesAsync();

                // Generate autologin details
                var accessToken = _tokenService.GenerateAccessToken(user, new List<string>(), new List<string>());
                var refreshToken = _tokenService.GenerateRefreshToken();

                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
                await _platformContext.SaveChangesAsync();

                return new LoginResponse
                {
                    AccessToken = accessToken,
                    RefreshToken = refreshToken,
                    ExpiresIn = 3600,
                    UserId = user.Id,
                    Email = user.Email,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    TenantId = null,
                    Roles = new List<string>(),
                    Permissions = new List<string>()
                };
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                throw new InvalidOperationException("An account with this email already exists.");
            }
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

        public async Task<Guid> OnboardTenantAsync(Guid userId, OnboardingRequest request)
        {
            var subdomain = request.Subdomain.ToLower().Trim();
            
            // 1. Verify subdomain is unique
            var tenantExists = await _platformContext.Tenants.AnyAsync(t => t.Subdomain == subdomain && !t.IsDeleted);
            if (tenantExists)
            {
                throw new InvalidOperationException("Subdomain is already taken.");
            }

            var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);
            if (user == null)
            {
                throw new InvalidOperationException("User not found.");
            }

            // 2. Generate Schema Name
            var schemaName = await _schemaNameGenerator.GenerateSchemaNameAsync(request.CompanyName);

            // 3. Create Tenant
            var tenant = new Tenant
            {
                Name = request.CompanyName,
                Code = subdomain.ToUpper(),
                SchemaName = schemaName,
                Subdomain = subdomain,
                IsActive = true
            };
            _platformContext.Tenants.Add(tenant);

            // Add TenantDomain
            var domainRecord = new TenantDomain
            {
                TenantId = tenant.Id,
                Domain = $"{subdomain}.aquora.com",
                IsPrimary = true,
                IsActive = true
            };
            _platformContext.TenantDomains.Add(domainRecord);

            // Link User to Tenant
            user.TenantId = tenant.Id;
            await _platformContext.SaveChangesAsync();

            // 4. Delegate Postgres Schema creation and migrations to ITenantDatabaseService in Persistence layer
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            await _tenantDatabaseService.CreateAndMigrateTenantAsync(
                tenant.Id,
                schemaName,
                subdomain,
                request.CompanyName,
                user.Id);
            stopwatch.Stop();

            Console.WriteLine($"[TENANT CREATION SUCCESS] Tenant Created: {request.CompanyName.Trim()}, Schema Name: {schemaName}, ID: {tenant.Id}, Migration Success: True, Provisioning Time: {stopwatch.ElapsedMilliseconds} ms");

            return tenant.Id;
        }

        public async Task<Guid> InviteMemberAsync(Guid ownerUserId, Guid tenantId, InviteTenantMemberRequest request)
        {
            if (ownerUserId == Guid.Empty)
            {
                throw new ArgumentException("Owner user id is required.", nameof(ownerUserId));
            }

            if (tenantId == Guid.Empty)
            {
                throw new ArgumentException("Tenant id is required.", nameof(tenantId));
            }

            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                throw new ArgumentException("Email is required.", nameof(request.Email));
            }

            if (request.RoleId == Guid.Empty)
            {
                throw new ArgumentException("Role id is required.", nameof(request.RoleId));
            }

            var email = request.Email.Trim().ToLower();

            var tenantExists = await _platformContext.Tenants
                .AnyAsync(t => t.Id == tenantId && !t.IsDeleted && t.IsActive);
            if (!tenantExists)
            {
                throw new InvalidOperationException("Tenant not found.");
            }

            var ownerExists = await _platformContext.Users
                .AnyAsync(u => u.Id == ownerUserId && !u.IsDeleted && u.IsActive);
            if (!ownerExists)
            {
                throw new InvalidOperationException("Owner user not found.");
            }

            var existingUser = await _platformContext.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email && !u.IsDeleted);

            if (existingUser != null)
            {
                var existingMembership = await _platformContext.UserMemberships
                    .AnyAsync(m => m.PlatformUserId == existingUser.Id && m.TenantId == tenantId);
                if (existingMembership)
                {
                    throw new InvalidOperationException("User is already a member of this tenant.");
                }
            }

            var existingInvitation = await _platformContext.TenantInvitations
                .FirstOrDefaultAsync(i => i.TenantId == tenantId && i.Email.ToLower() == email && i.Status == "Pending");
            if (existingInvitation != null && existingInvitation.ExpiresAt > DateTime.UtcNow)
            {
                throw new InvalidOperationException("An active invitation already exists for this email.");
            }

            if (existingInvitation != null)
            {
                existingInvitation.Status = "Expired";
            }

            var invitation = new TenantInvitation
            {
                TenantId = tenantId,
                Email = email,
                RoleId = request.RoleId,
                Message = request.Message,
                Token = Guid.NewGuid().ToString("N"),
                Status = "Pending",
                InvitedByUserId = ownerUserId,
                ExpiresAt = DateTime.UtcNow.AddDays(7)
            };

            _platformContext.TenantInvitations.Add(invitation);
            await _platformContext.SaveChangesAsync();

            return invitation.Id;
        }

        public async Task<Guid> AcceptInviteAsync(AcceptInviteRequest request, Guid? existingUserId)
        {
            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            if (string.IsNullOrWhiteSpace(request.Token))
            {
                throw new ArgumentException("Invitation token is required.", nameof(request.Token));
            }

            var token = request.Token.Trim();
            var invitation = await _platformContext.TenantInvitations
                .FirstOrDefaultAsync(i => i.Token == token && i.Status == "Pending");

            if (invitation == null)
            {
                throw new InvalidOperationException("Invitation not found.");
            }

            if (invitation.ExpiresAt <= DateTime.UtcNow)
            {
                invitation.Status = "Expired";
                await _platformContext.SaveChangesAsync();
                throw new InvalidOperationException("Invitation has expired.");
            }

            User user;
            if (existingUserId.HasValue)
            {
                user = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.Id == existingUserId.Value && !u.IsDeleted && u.IsActive);
                if (user == null)
                {
                    throw new InvalidOperationException("User not found.");
                }

                if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Invitation email does not match the current user.");
                }
            }
            else
            {
                var existingUser = await _platformContext.Users
                    .FirstOrDefaultAsync(u => u.Email.ToLower() == invitation.Email.ToLower() && !u.IsDeleted);
                if (existingUser != null)
                {
                    user = existingUser;
                }
                else
                {
                    if (string.IsNullOrWhiteSpace(request.Password))
                    {
                        throw new ArgumentException("Password is required for new users.", nameof(request.Password));
                    }

                    var names = (request.FullName ?? string.Empty)
                        .Trim()
                        .Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

                    user = new User
                    {
                        Email = invitation.Email.ToLower(),
                        FirstName = names.Length > 0 ? names[0] : null,
                        LastName = names.Length > 1 ? names[1] : null,
                        PasswordHash = _passwordHasher.HashPassword(request.Password),
                        IsActive = true,
                        EmailVerified = true,
                        TenantId = invitation.TenantId
                    };

                    _platformContext.Users.Add(user);
                    await _platformContext.SaveChangesAsync();
                }
            }

            var membershipExists = await _platformContext.UserMemberships
                .AnyAsync(m => m.PlatformUserId == user.Id && m.TenantId == invitation.TenantId);
            if (membershipExists)
            {
                invitation.Status = "Accepted";
                invitation.AcceptedAt = DateTime.UtcNow;
                await _platformContext.SaveChangesAsync();
                return user.Id;
            }

            var membership = new UserMembership
            {
                PlatformUserId = user.Id,
                TenantId = invitation.TenantId,
                RoleId = invitation.RoleId,
                Status = "Active",
                InvitedByUserId = invitation.InvitedByUserId,
                JoinedAt = DateTime.UtcNow
            };

            _platformContext.UserMemberships.Add(membership);
            invitation.Status = "Accepted";
            invitation.AcceptedAt = DateTime.UtcNow;

            if (!user.TenantId.HasValue)
            {
                user.TenantId = invitation.TenantId;
            }

            await _platformContext.SaveChangesAsync();

            return membership.Id;
        }

        public async Task<TenantMembersResponse> GetMembersAsync(Guid tenantId)
        {
            if (tenantId == Guid.Empty)
            {
                throw new ArgumentException("Tenant id is required.", nameof(tenantId));
            }

            var tenantExists = await _platformContext.Tenants
                .AnyAsync(t => t.Id == tenantId && !t.IsDeleted);
            if (!tenantExists)
            {
                throw new InvalidOperationException("Tenant not found.");
            }

            var members = await _platformContext.UserMemberships
                .Where(m => m.TenantId == tenantId)
                .Select(m => new UserMembershipDto
                {
                    Id = m.Id,
                    PlatformUserId = m.PlatformUserId,
                    TenantId = m.TenantId,
                    RoleId = m.RoleId,
                    Status = m.Status,
                    JoinedAt = m.JoinedAt
                })
                .ToListAsync();

            return new TenantMembersResponse
            {
                Members = members
            };
        }

        public async Task<bool> UpdateMemberRoleAsync(Guid tenantId, Guid membershipId, UpdateTenantMemberRoleRequest request)
        {
            if (tenantId == Guid.Empty)
            {
                throw new ArgumentException("Tenant id is required.", nameof(tenantId));
            }

            if (membershipId == Guid.Empty)
            {
                throw new ArgumentException("Membership id is required.", nameof(membershipId));
            }

            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            if (request.RoleId == Guid.Empty)
            {
                throw new ArgumentException("Role id is required.", nameof(request.RoleId));
            }

            var membership = await _platformContext.UserMemberships
                .FirstOrDefaultAsync(m => m.Id == membershipId && m.TenantId == tenantId);

            if (membership == null)
            {
                throw new InvalidOperationException("Membership not found.");
            }

            membership.RoleId = request.RoleId;
            await _platformContext.SaveChangesAsync();

            return true;
        }

        public async Task<bool> DeleteMemberAsync(Guid tenantId, Guid membershipId)
        {
            if (tenantId == Guid.Empty)
            {
                throw new ArgumentException("Tenant id is required.", nameof(tenantId));
            }

            if (membershipId == Guid.Empty)
            {
                throw new ArgumentException("Membership id is required.", nameof(membershipId));
            }

            var membership = await _platformContext.UserMemberships
                .FirstOrDefaultAsync(m => m.Id == membershipId && m.TenantId == tenantId);

            if (membership == null)
            {
                throw new InvalidOperationException("Membership not found.");
            }

            _platformContext.UserMemberships.Remove(membership);
            await _platformContext.SaveChangesAsync();

            return true;
        }
    }
}
