using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using Aquora.Application.DTOs.User;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;

namespace Aquora.Tests
{
    public class UserProfileServiceTests
    {
        private readonly PlatformDbContext _platformContext;
        private readonly Mock<IPasswordHasher> _mockPasswordHasher;
        private readonly Mock<ICurrentUserContext> _mockCurrentUserContext;
        private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
        private readonly IUserRoleResolver _roleResolver;
        private readonly Mock<ICloudinaryMediaService> _mockCloudinaryService;

        public UserProfileServiceTests()
        {
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: $"UserProfileDb_{Guid.NewGuid()}")
                .Options;

            _platformContext = new PlatformDbContext(options);

            _mockPasswordHasher = new Mock<IPasswordHasher>();
            _mockPasswordHasher.Setup(h => h.HashPassword(It.IsAny<string>()))
                .Returns<string>(p => $"hashed_{p}");
            _mockPasswordHasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()))
                .Returns<string, string>((pwd, hash) => hash == $"hashed_{pwd}" || hash == pwd);

            _mockCurrentUserContext = new Mock<ICurrentUserContext>();
            _mockCurrentUserContext.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            _mockCurrentUserContext.Setup(c => c.IpAddress).Returns("127.0.0.1");
            _mockCurrentUserContext.Setup(c => c.UserAgent).Returns("Mozilla/5.0 Test");

            _mockScopeFactory = new Mock<IServiceScopeFactory>();

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(Guid.NewGuid());
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: $"UserProfileTenantDb_{Guid.NewGuid()}")
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            var tenantContext = new TenantDbContext(tenantOptions, mockTenantProvider.Object, _mockCurrentUserContext.Object);

            _roleResolver = new UserRoleResolver(_platformContext, tenantContext);
            _mockCloudinaryService = new Mock<ICloudinaryMediaService>();
        }

        private UserProfileService CreateService()
        {
            return new UserProfileService(
                _platformContext,
                _mockPasswordHasher.Object,
                _mockCurrentUserContext.Object,
                _mockScopeFactory.Object,
                _roleResolver,
                _mockCloudinaryService.Object);
        }

        [Fact]
        public async Task GetProfileAsync_WithValidUserId_ReturnsCorrectNonSensitiveProfileData()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var tenantId = Guid.NewGuid();

            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "Apex Water Pvt Ltd",
                Code = "APEX",
                SchemaName = "aquora_tenant_apex",
                Subdomain = "apex",
                OwnerEmail = "owner@apex.com",
                IsActive = true
            };
            _platformContext.Tenants.Add(tenant);

            var user = new User
            {
                Id = userId,
                Email = "analyst@apex.com",
                Username = "analyst_qc",
                FirstName = "Rajesh",
                LastName = "Kumar",
                Phone = "+919876543210",
                Department = "Quality Assurance",
                Designation = "Senior QC Chemist",
                Shift = "Morning",
                RoleName = "QC",
                TenantId = tenantId,
                IsActive = true,
                EmailVerified = true,
                EmailVerifiedAt = DateTime.UtcNow.AddMonths(-1),
                LastLoginAt = DateTime.UtcNow.AddHours(-2),
                Qualification = "M.Sc Analytical Chemistry",
                CertificationDetails = "ISO 17025 Certified Water Analyst",
                ExperienceYears = 7,
                AssignedLabStation = "Microbiology Lab B",
                QcResponsibilities = "Bacterial culturing, TDS testing, pH calibrations",
                SignatureUrl = "/signatures/rajesh_qc.png",
                PasswordHash = "hashed_Secret@123",
                PinHash = "hashed_1234"
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var service = CreateService();

            // Act
            var profile = await service.GetProfileAsync(userId.ToString());

            // Assert
            Assert.NotNull(profile);
            Assert.Equal(userId, profile.Id);
            Assert.Equal("analyst@apex.com", profile.Email);
            Assert.Equal("analyst_qc", profile.Username);
            Assert.Equal("Rajesh", profile.FirstName);
            Assert.Equal("Kumar", profile.LastName);
            Assert.Equal("Rajesh Kumar", profile.DisplayName);
            Assert.Equal("+919876543210", profile.Phone);
            Assert.Equal("Quality Assurance", profile.Department);
            Assert.Equal("QC", profile.RoleName);
            Assert.Equal("Apex Water Pvt Ltd", profile.CompanyName);
            Assert.Equal("M.Sc Analytical Chemistry", profile.Qualification);
            Assert.Equal("ISO 17025 Certified Water Analyst", profile.CertificationDetails);
            Assert.Equal(7, profile.ExperienceYears);
            Assert.Equal("Microbiology Lab B", profile.AssignedLabStation);
            Assert.Equal("/signatures/rajesh_qc.png", profile.SignatureUrl);
            Assert.True(profile.EmailVerified);
        }

        [Fact]
        public async Task GetProfileAsync_WithInvalidOrNonExistentUserId_ThrowsUnauthorizedAccessException()
        {
            // Arrange
            var service = CreateService();

            // Act & Assert
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                service.GetProfileAsync(Guid.NewGuid().ToString()));

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                service.GetProfileAsync("invalid-guid-string"));
        }

        [Fact]
        public async Task UpdateProfileAsync_UpdatesAllowedFields_AndPreservesProtectedFields()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var tenantId = Guid.NewGuid();

            var user = new User
            {
                Id = userId,
                Email = "sanoof@aquzio.com",
                Username = "sanoof_dev",
                FirstName = "Muhammed",
                LastName = "Sanoof",
                Phone = "9876543210",
                Department = "Engineering",
                RoleName = "Operator",
                CurrentSalary = 35000,
                IsPlatformAdmin = false,
                TenantId = tenantId,
                IsActive = true,
                PasswordHash = "hashed_pass123"
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var service = CreateService();

            var updateRequest = new UpdateUserProfileRequest
            {
                FirstName = "Muhammed Sanoof",
                LastName = "K",
                Username = "sanoof_lead",
                Phone = "+91 9988776655",
                Department = "Operations & QC",
                Qualification = "B.Tech Mech",
                CertificationDetails = "Six Sigma Green Belt",
                ExperienceYears = 4,
                AssignedLabStation = "Station 1",
                QcResponsibilities = "Washing line inspection",
                PhotoUrl = "https://example.com/avatar.jpg"
            };

            // Act
            var updated = await service.UpdateProfileAsync(userId.ToString(), updateRequest);

            // Assert
            Assert.Equal("Muhammed Sanoof", updated.FirstName);
            Assert.Equal("K", updated.LastName);
            Assert.Equal("sanoof_lead", updated.Username);
            Assert.Equal("+91 9988776655", updated.Phone);
            Assert.Equal("Operations & QC", updated.Department);
            Assert.Equal("B.Tech Mech", updated.Qualification);
            Assert.Equal(4, updated.ExperienceYears);

            // Verify in database that system fields are completely intact
            var dbUser = await _platformContext.Users.FindAsync(userId);
            Assert.NotNull(dbUser);
            Assert.Equal("sanoof@aquzio.com", dbUser.Email); // Email protected
            Assert.Equal("Operator", dbUser.RoleName); // Role protected
            Assert.Equal(35000, dbUser.CurrentSalary); // Salary protected
            Assert.Equal(tenantId, dbUser.TenantId); // TenantId protected
            Assert.False(dbUser.IsPlatformAdmin); // Admin status protected
            Assert.Equal("hashed_pass123", dbUser.PasswordHash); // Password hash protected
        }

        [Fact]
        public async Task UpdateProfileAsync_WhenDuplicateUsernameProvided_ThrowsInvalidOperationException()
        {
            // Arrange
            var user1 = new User
            {
                Id = Guid.NewGuid(),
                Email = "user1@domain.com",
                Username = "tech_lead",
                PasswordHash = "hash1"
            };
            var user2 = new User
            {
                Id = Guid.NewGuid(),
                Email = "user2@domain.com",
                Username = "junior_dev",
                PasswordHash = "hash2"
            };
            _platformContext.Users.AddRange(user1, user2);
            await _platformContext.SaveChangesAsync();

            var service = CreateService();

            var updateRequest = new UpdateUserProfileRequest
            {
                Username = "tech_lead" // Conflict with user1
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.UpdateProfileAsync(user2.Id.ToString(), updateRequest));

            Assert.Contains("already taken", ex.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task ChangePasswordAsync_WithCorrectCurrentPassword_SuccessfullyUpdatesPasswordHashAndTokenVersion()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var user = new User
            {
                Id = userId,
                Email = "security@aquzio.com",
                PasswordHash = "hashed_OldPassword@123",
                TokenVersion = 1,
                IsActive = true
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var service = CreateService();

            var request = new ChangePasswordRequest
            {
                CurrentPassword = "OldPassword@123",
                NewPassword = "NewStrongPassword@2026",
                ConfirmPassword = "NewStrongPassword@2026"
            };

            // Act
            var result = await service.ChangePasswordAsync(userId.ToString(), request);

            // Assert
            Assert.True(result);

            var dbUser = await _platformContext.Users.FindAsync(userId);
            Assert.NotNull(dbUser);
            Assert.Equal("hashed_NewStrongPassword@2026", dbUser.PasswordHash);
            Assert.Equal(2, dbUser.TokenVersion); // Token version incremented
        }

        [Fact]
        public async Task ChangePasswordAsync_WithIncorrectCurrentPassword_ThrowsInvalidOperationException()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var user = new User
            {
                Id = userId,
                Email = "user@aquzio.com",
                PasswordHash = "hashed_CorrectPassword@123",
                TokenVersion = 1
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var service = CreateService();

            var request = new ChangePasswordRequest
            {
                CurrentPassword = "WrongPassword@123",
                NewPassword = "NewStrongPassword@2026",
                ConfirmPassword = "NewStrongPassword@2026"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ChangePasswordAsync(userId.ToString(), request));

            Assert.Contains("incorrect", ex.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task ChangePasswordAsync_WhenReusingCurrentPassword_ThrowsInvalidOperationException()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var user = new User
            {
                Id = userId,
                Email = "user@aquzio.com",
                PasswordHash = "hashed_CurrentPassword@123",
                TokenVersion = 1
            };
            _platformContext.Users.Add(user);
            await _platformContext.SaveChangesAsync();

            var service = CreateService();

            var request = new ChangePasswordRequest
            {
                CurrentPassword = "CurrentPassword@123",
                NewPassword = "CurrentPassword@123", // Same password
                ConfirmPassword = "CurrentPassword@123"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ChangePasswordAsync(userId.ToString(), request));

            Assert.Contains("cannot be the same", ex.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task ChangePasswordAsync_WhenPasswordsDoNotMatch_ThrowsInvalidOperationException()
        {
            // Arrange
            var service = CreateService();
            var request = new ChangePasswordRequest
            {
                CurrentPassword = "OldPassword@123",
                NewPassword = "NewStrongPassword@2026",
                ConfirmPassword = "MismatchPassword@2026"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ChangePasswordAsync(Guid.NewGuid().ToString(), request));

            Assert.Contains("do not match", ex.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task GetSecuritySummaryAsync_ReturnsAuditHistoryAndSecurityStatus()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var user = new User
            {
                Id = userId,
                Email = "audited@aquzio.com",
                PasswordHash = "hash",
                EmailVerified = true,
                EmailVerifiedAt = DateTime.UtcNow.AddDays(-10),
                LastLoginAt = DateTime.UtcNow.AddMinutes(-5),
                DevicesCount = 2,
                TokenVersion = 3
            };
            _platformContext.Users.Add(user);

            var auditLog = new PlatformAuditLog
            {
                Id = Guid.NewGuid(),
                UserId = userId.ToString(),
                UserEmail = "audited@aquzio.com",
                Action = "Password_Changed",
                Reason = "User successfully changed their account password.",
                Timestamp = DateTime.UtcNow.AddDays(-1),
                IpAddress = "192.168.1.50"
            };
            _platformContext.PlatformAuditLogs.Add(auditLog);
            await _platformContext.SaveChangesAsync();

            var service = CreateService();

            // Act
            var summary = await service.GetSecuritySummaryAsync(userId.ToString());

            // Assert
            Assert.NotNull(summary);
            Assert.True(summary.EmailVerified);
            Assert.Equal(2, summary.DevicesCount);
            Assert.Equal(3, summary.TokenVersion);
            Assert.NotEmpty(summary.RecentAuditEvents);
            Assert.Equal("Password_Changed", summary.RecentAuditEvents[0].Action);
        }
    }
}
