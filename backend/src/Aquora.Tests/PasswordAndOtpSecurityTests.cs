using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using Aquora.Application.Common.Exceptions;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.DTOs.User;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;

namespace Aquora.Tests
{
    public class PasswordAndOtpSecurityTests
    {
        private readonly PlatformDbContext _platformContext;
        private readonly Mock<ITokenService> _mockTokenService;
        private readonly Mock<IPasswordHasher> _mockPasswordHasher;
        private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
        private readonly Mock<IEmailService> _mockEmailService;
        private readonly Mock<IBackgroundTaskQueue> _mockTaskQueue;
        private readonly Mock<ICurrentUserContext> _mockCurrentUserContext;
        private readonly AuthService _authService;
        private readonly UserProfileService _userProfileService;

        public PasswordAndOtpSecurityTests()
        {
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: $"AuthSecurityDb_{Guid.NewGuid()}")
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            _platformContext = new PlatformDbContext(options);

            _mockTokenService = new Mock<ITokenService>();
            _mockTokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
                .Returns("mock_access_token_123");
            _mockTokenService.Setup(t => t.GenerateRefreshToken())
                .Returns("mock_refresh_token_456");

            _mockPasswordHasher = new Mock<IPasswordHasher>();
            _mockPasswordHasher.Setup(h => h.HashPassword(It.IsAny<string>()))
                .Returns<string>(p => $"hashed_{p}");
            _mockPasswordHasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()))
                .Returns<string, string>((pwd, hash) => hash == $"hashed_{pwd}" || hash == pwd);

            _mockScopeFactory = new Mock<IServiceScopeFactory>();
            _mockEmailService = new Mock<IEmailService>();
            _mockTaskQueue = new Mock<IBackgroundTaskQueue>();

            _mockCurrentUserContext = new Mock<ICurrentUserContext>();
            _mockCurrentUserContext.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            _mockCurrentUserContext.Setup(c => c.IpAddress).Returns("192.168.1.100");
            _mockCurrentUserContext.Setup(c => c.UserAgent).Returns("xUnit Test Runner");

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(Guid.NewGuid());
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_security");

            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: $"AuthTenantDb_{Guid.NewGuid()}")
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            var tenantContext = new TenantDbContext(tenantOptions, mockTenantProvider.Object, _mockCurrentUserContext.Object);

            var roleResolver = new UserRoleResolver(_platformContext, tenantContext);
            var mockCloudinary = new Mock<ICloudinaryMediaService>();

            _authService = new AuthService(
                _platformContext,
                _mockTokenService.Object,
                _mockPasswordHasher.Object,
                _mockScopeFactory.Object,
                _mockEmailService.Object,
                _mockTaskQueue.Object,
                _mockCurrentUserContext.Object);

            _userProfileService = new UserProfileService(
                _platformContext,
                _mockPasswordHasher.Object,
                _mockCurrentUserContext.Object,
                _mockScopeFactory.Object,
                roleResolver,
                mockCloudinary.Object);
        }

        [Fact]
        public async Task PasswordChange_CorrectCurrentPassword_SuccessfullyUpdatesAndIncrementsTokenVersion()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "user1@aquzio.com",
                PasswordHash = "hashed_OldPassword123!",
                PinHash = "hashed_OldPassword123!",
                FirstName = "Test",
                LastName = "User",
                IsActive = true,
                EmailVerified = true,
                TokenVersion = 1
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var req = new ChangePasswordRequest
            {
                CurrentPassword = "OldPassword123!",
                NewPassword = "NewStrongPassword456!",
                ConfirmPassword = "NewStrongPassword456!"
            };

            // Act
            var result = await _userProfileService.ChangePasswordAsync(user.Id.ToString(), req);

            // Assert
            Assert.True(result);
            var updatedUser = await _platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(updatedUser);
            Assert.Equal("hashed_NewStrongPassword456!", updatedUser.PasswordHash);
            Assert.Equal(2, updatedUser.TokenVersion); // Incremented token version invalidates existing JWTs
        }

        [Fact]
        public async Task PasswordChange_WrongCurrentPassword_ThrowsInvalidOperationException()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "user2@aquzio.com",
                PasswordHash = "hashed_CorrectPassword123!",
                IsActive = true,
                EmailVerified = true
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var req = new ChangePasswordRequest
            {
                CurrentPassword = "WrongPassword!",
                NewPassword = "NewStrongPassword456!",
                ConfirmPassword = "NewStrongPassword456!"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                _userProfileService.ChangePasswordAsync(user.Id.ToString(), req));
            Assert.Contains("Current password is incorrect", ex.Message);
        }

        [Fact]
        public async Task PasswordChange_PasswordMismatch_ThrowsInvalidOperationException()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "user3@aquzio.com",
                PasswordHash = "hashed_OldPassword123!",
                IsActive = true
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var req = new ChangePasswordRequest
            {
                CurrentPassword = "OldPassword123!",
                NewPassword = "NewStrongPassword456!",
                ConfirmPassword = "MismatchedPassword789!"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                _userProfileService.ChangePasswordAsync(user.Id.ToString(), req));
            Assert.Contains("do not match", ex.Message);
        }

        [Fact]
        public async Task PasswordChange_SamePasswordReuse_ThrowsInvalidOperationException()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "user4@aquzio.com",
                PasswordHash = "hashed_CurrentPassword123!",
                IsActive = true
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var req = new ChangePasswordRequest
            {
                CurrentPassword = "CurrentPassword123!",
                NewPassword = "CurrentPassword123!",
                ConfirmPassword = "CurrentPassword123!"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                _userProfileService.ChangePasswordAsync(user.Id.ToString(), req));
            Assert.Contains("same as your current password", ex.Message);
        }

        [Fact]
        public async Task PasswordChange_WeakPassword_FailsValidation()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "user5@aquzio.com",
                PasswordHash = "hashed_OldPassword123!",
                IsActive = true
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var req = new ChangePasswordRequest
            {
                CurrentPassword = "OldPassword123!",
                NewPassword = "weak",
                ConfirmPassword = "weak"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                _userProfileService.ChangePasswordAsync(user.Id.ToString(), req));
            Assert.Contains("at least 8 characters", ex.Message);
        }

        [Fact]
        public async Task ForgotPassword_ValidAccount_DispatchesOtpEmail()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "forgot_user@aquzio.com",
                PasswordHash = "hashed_OldPassword123!",
                IsActive = true
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest
            {
                Email = "forgot_user@aquzio.com"
            });

            // Assert
            Assert.True(result);
            _mockEmailService.Verify(e => e.SendOtpEmailAsync(
                "forgot_user@aquzio.com",
                It.IsAny<string>(),
                10,
                "PasswordReset",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()), Times.Once);

            var otpRecord = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email == "forgot_user@aquzio.com" && o.Purpose == "PasswordReset");
            Assert.NotNull(otpRecord);
            Assert.False(otpRecord.IsUsed);
        }

        [Fact]
        public async Task ForgotPassword_UnknownEmail_ReturnsSafeGenericSuccessWithoutThrowing()
        {
            // Act
            var result = await _authService.ForgotPasswordAsync(new ForgotPasswordRequest
            {
                Email = "nonexistent_unknown_email@aquzio.com"
            });

            // Assert: Safe generic response to prevent account enumeration
            Assert.True(result);
            _mockEmailService.Verify(e => e.SendOtpEmailAsync(
                "nonexistent_unknown_email@aquzio.com",
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task VerifyPasswordResetOtp_ValidOtp_ReturnsShortLivedResetToken()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "reset_user@aquzio.com",
                PasswordHash = "hashed_OldPass123!",
                IsActive = true
            };
            _platformContext.Users.Add(user);

            var otpRecord = new OTPVerification
            {
                Id = Guid.NewGuid(),
                Email = "reset_user@aquzio.com",
                Purpose = "PasswordReset",
                OtpHash = "hashed_123456",
                ExpiryTime = DateTime.UtcNow.AddMinutes(10),
                Attempts = 0,
                IsUsed = false,
                RequestId = Guid.NewGuid().ToString()
            };
            _platformContext.OTPVerifications.Add(otpRecord);
            await _platformContext.SaveChangesAsync();

            // Act
            var response = await _authService.VerifyPasswordResetOtpAsync(new VerifyPasswordResetOtpRequest
            {
                Email = "reset_user@aquzio.com",
                Code = "123456"
            });

            // Assert
            Assert.True(response.Success);
            Assert.False(string.IsNullOrWhiteSpace(response.ResetToken));
            Assert.Equal("reset_user@aquzio.com", response.Email);

            var updatedOtp = await _platformContext.OTPVerifications.FindAsync(otpRecord.Id);
            Assert.NotNull(updatedOtp);
            Assert.True(updatedOtp.IsVerified);
            Assert.Equal(response.ResetToken, updatedOtp.ResetToken);
        }

        [Fact]
        public async Task VerifyPasswordResetOtp_WrongOtp_IncrementsAttemptsAndRejects()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "wrong_otp_user@aquzio.com",
                PasswordHash = "hashed_OldPass123!",
                IsActive = true
            };
            _platformContext.Users.Add(user);

            var otpRecord = new OTPVerification
            {
                Id = Guid.NewGuid(),
                Email = "wrong_otp_user@aquzio.com",
                Purpose = "PasswordReset",
                OtpHash = "hashed_654321",
                ExpiryTime = DateTime.UtcNow.AddMinutes(10),
                Attempts = 0,
                IsUsed = false,
                RequestId = Guid.NewGuid().ToString()
            };
            _platformContext.OTPVerifications.Add(otpRecord);
            await _platformContext.SaveChangesAsync();

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                _authService.VerifyPasswordResetOtpAsync(new VerifyPasswordResetOtpRequest
                {
                    Email = "wrong_otp_user@aquzio.com",
                    Code = "000000"
                }));

            Assert.Contains("Invalid verification code", ex.Message);
            var updatedOtp = await _platformContext.OTPVerifications.FindAsync(otpRecord.Id);
            Assert.NotNull(updatedOtp);
            Assert.Equal(1, updatedOtp.Attempts);
        }

        [Fact]
        public async Task VerifyPasswordResetOtp_ExpiredOtp_ThrowsInvalidOperationException()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "expired_user@aquzio.com",
                PasswordHash = "hashed_OldPass123!",
                IsActive = true
            };
            _platformContext.Users.Add(user);

            var otpRecord = new OTPVerification
            {
                Id = Guid.NewGuid(),
                Email = "expired_user@aquzio.com",
                Purpose = "PasswordReset",
                OtpHash = "hashed_123456",
                ExpiryTime = DateTime.UtcNow.AddMinutes(-5), // Expired 5 mins ago
                Attempts = 0,
                IsUsed = false,
                RequestId = Guid.NewGuid().ToString()
            };
            _platformContext.OTPVerifications.Add(otpRecord);
            await _platformContext.SaveChangesAsync();

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                _authService.VerifyPasswordResetOtpAsync(new VerifyPasswordResetOtpRequest
                {
                    Email = "expired_user@aquzio.com",
                    Code = "123456"
                }));

            Assert.Contains("expired", ex.Message);
        }

        [Fact]
        public async Task ResetPassword_WithValidResetToken_UpdatesPasswordAndInvalidatesSessionTokens()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "complete_reset@aquzio.com",
                PasswordHash = "hashed_OldPass123!",
                PinHash = "hashed_OldPass123!",
                TokenVersion = 3,
                RefreshToken = "active_refresh_token_xyz",
                RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7),
                IsActive = true
            };
            _platformContext.Users.Add(user);

            var resetToken = "valid_secure_reset_token_abc123";
            var otpRecord = new OTPVerification
            {
                Id = Guid.NewGuid(),
                Email = "complete_reset@aquzio.com",
                Purpose = "PasswordReset",
                OtpHash = "hashed_123456",
                ResetToken = resetToken,
                ResetTokenExpiryTime = DateTime.UtcNow.AddMinutes(15),
                IsVerified = true,
                IsUsed = false,
                RequestId = Guid.NewGuid().ToString()
            };
            _platformContext.OTPVerifications.Add(otpRecord);
            await _platformContext.SaveChangesAsync();

            // Act
            var result = await _authService.ResetPasswordAsync(new PasswordResetRequest
            {
                Email = "complete_reset@aquzio.com",
                ResetToken = resetToken,
                NewPassword = "BrandNewSecurePassword999!",
                ConfirmPassword = "BrandNewSecurePassword999!"
            });

            // Assert
            Assert.True(result);
            var updatedUser = await _platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(updatedUser);
            Assert.Equal("hashed_BrandNewSecurePassword999!", updatedUser.PasswordHash);
            Assert.Equal(4, updatedUser.TokenVersion); // Incremented TokenVersion invalidates previous access tokens
            Assert.Null(updatedUser.RefreshToken); // Cleared refresh token

            var updatedOtp = await _platformContext.OTPVerifications.FindAsync(otpRecord.Id);
            Assert.NotNull(updatedOtp);
            Assert.True(updatedOtp.IsUsed); // Single-use OTP marked used

            _mockEmailService.Verify(e => e.SendPasswordChangedNotificationAsync(
                "complete_reset@aquzio.com",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task EmailChangeFlow_FullCycle_UpdatesPrimaryEmailSafely()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "old_address@aquzio.com",
                PasswordHash = "hashed_Pass123!",
                IsActive = true,
                EmailVerified = true
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            // 1. Request Email Change
            var requestResult = await _authService.RequestEmailChangeAsync(
                user.Id.ToString(),
                new RequestEmailChangeRequest { NewEmail = "new_address@aquzio.com" });

            Assert.True(requestResult);

            // Fetch OTP created for new email
            var otp = await _platformContext.OTPVerifications
                .FirstOrDefaultAsync(o => o.Email == "new_address@aquzio.com" && o.Purpose == "EmailChange");
            Assert.NotNull(otp);

            // Mock the code verification
            otp.OtpHash = "hashed_888999";
            await _platformContext.SaveChangesAsync();

            // 2. Verify Email Change
            var verifyResult = await _authService.VerifyEmailChangeAsync(
                user.Id.ToString(),
                new VerifyEmailChangeRequest
                {
                    NewEmail = "new_address@aquzio.com",
                    Code = "888999"
                });

            // Assert
            Assert.True(verifyResult);
            var updatedUser = await _platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(updatedUser);
            Assert.Equal("new_address@aquzio.com", updatedUser.Email);
            Assert.True(updatedUser.EmailVerified);

            _mockEmailService.Verify(e => e.SendEmailChangedNotificationAsync(
                "old_address@aquzio.com",
                "new_address@aquzio.com",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
