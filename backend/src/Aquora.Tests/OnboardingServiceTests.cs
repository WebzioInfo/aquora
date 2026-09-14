using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Infrastructure.Services;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class OnboardingServiceTests
    {
        [Fact]
        public async Task OnboardCompanyAsync_ShouldAssignTenantIdAndGenerateTokens()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "owner@testcompany.com",
                FirstName = "Test",
                LastName = "Owner",
                PasswordHash = "hashed_pwd",
                EmailVerified = true,
                TokenVersion = 0
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var mockTenantDbService = new Mock<ITenantDatabaseService>();
            var mockTokenService = new Mock<ITokenService>();
            mockTokenService.Setup(t => t.GenerateAccessToken(
                It.IsAny<User>(),
                It.IsAny<IEnumerable<string>>(),
                It.IsAny<IEnumerable<string>>()
            )).Returns("mock-access-token");

            mockTokenService.Setup(t => t.GenerateRefreshToken())
                .Returns("mock-refresh-token");

            var mockScopeFactory = new Mock<IServiceScopeFactory>();
            var mockSchemaNameGenerator = new Mock<ISchemaNameGenerator>();
            mockSchemaNameGenerator
                .Setup(x => x.GenerateSchemaNameAsync(It.IsAny<string>()))
                .ReturnsAsync((string name) => "aquora_tenant_" + name.Replace(" ", "_").ToLower());

            var mockQueue = new Mock<ITenantProvisioningQueue>();

            var service = new CompanyOnboardingService(
                platformContext,
                mockTenantDbService.Object,
                mockTokenService.Object,
                mockScopeFactory.Object,
                mockSchemaNameGenerator.Object,
                mockQueue.Object
            );

            var request = new CompanyOnboardingRequest
            {
                CompanyName = "Test Company LLC",
                EmployeeCount = 10,
                HowDidYouHearAboutUs = "Google Search"
            };

            // Act
            var result = await service.OnboardCompanyAsync(user.Id, request);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Provisioning", result.ProvisioningStatus);
            Assert.Equal("mock-access-token", result.AccessToken);
            Assert.Equal("mock-refresh-token", result.RefreshToken);
            Assert.Equal("Owner", result.OwnerRole);
            
            // Verify user was updated with the tenant ID
            var updatedUser = await platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(updatedUser);
            Assert.NotNull(updatedUser.TenantId);

            // Verify queue was called with the job
            mockQueue.Verify(q => q.QueueProvisioning(It.Is<TenantProvisioningJob>(j => 
                j.OwnerUserId == user.Id && 
                j.CompanyName == "Test Company LLC")), Times.Once);
        }

        [Fact]
        public async Task GetProvisioningStatusAsync_WhenTenantIdNull_ReturnsPendingNoWorkspace()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "freshuser@example.com",
                PasswordHash = "hashed",
                EmailVerified = true,
                TenantId = null
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                Mock.Of<ITokenService>(),
                Mock.Of<IServiceScopeFactory>(),
                Mock.Of<ISchemaNameGenerator>(),
                Mock.Of<ITenantProvisioningQueue>()
            );

            // Act
            var statusObj = await service.GetProvisioningStatusAsync(user.Id);

            // Assert
            var json = JsonSerializer.Serialize(statusObj);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.Equal("Pending", root.GetProperty("Status").GetString());
            Assert.Equal(0, root.GetProperty("Progress").GetInt32());
            Assert.Equal("No workspace created yet.", root.GetProperty("Message").GetString());
            Assert.Equal(JsonValueKind.Null, root.GetProperty("TenantId").ValueKind);
        }

        [Fact]
        public async Task GetProvisioningStatusAsync_WhenTenantProvisioning_ReflectsStepProgress()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var tenantId = Guid.NewGuid();
            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "Active Factory",
                Code = "ACT",
                Subdomain = "act",
                SchemaName = "aquora_tenant_act",
                Status = "Provisioning",
                Progress = 45,
                CurrentStep = "SchemaMigrationsRun",
                IsInitialized = false
            };

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "active@factory.com",
                PasswordHash = "pwd",
                EmailVerified = true,
                TenantId = tenantId
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Tenants.Add(tenant);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                Mock.Of<ITokenService>(),
                Mock.Of<IServiceScopeFactory>(),
                Mock.Of<ISchemaNameGenerator>(),
                Mock.Of<ITenantProvisioningQueue>()
            );

            // Act
            var statusObj = await service.GetProvisioningStatusAsync(user.Id);

            // Assert
            var json = JsonSerializer.Serialize(statusObj);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.Equal("Provisioning", root.GetProperty("Status").GetString());
            Assert.True(root.GetProperty("Progress").GetInt32() >= 22);
            Assert.Equal("SchemaMigrationsRun", root.GetProperty("CurrentStep").GetString());
            Assert.True(root.GetProperty("Steps").GetArrayLength() > 0);
        }

        [Fact]
        public async Task RetryOnboardingAsync_WhenTenantFailed_RequeuesJobAndResetsStatus()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var tenantId = Guid.NewGuid();
            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "Failed Factory",
                Code = "FAILCORP",
                Subdomain = "failcorp",
                SchemaName = "aquora_tenant_fail",
                Status = "Failed",
                Progress = 0,
                CurrentStep = "DatabaseCreated",
                FailureReason = "Connection timeout",
                IsInitialized = false
            };

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "fail@factory.com",
                PasswordHash = "pwd",
                EmailVerified = true,
                TenantId = tenantId
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Tenants.Add(tenant);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var mockQueue = new Mock<ITenantProvisioningQueue>();
            var mockTokenService = new Mock<ITokenService>();
            mockTokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
                .Returns("retry-token");
            mockTokenService.Setup(t => t.GenerateRefreshToken())
                .Returns("retry-refresh-token");

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                mockTokenService.Object,
                Mock.Of<IServiceScopeFactory>(),
                Mock.Of<ISchemaNameGenerator>(),
                mockQueue.Object
            );

            // Act
            var result = await service.RetryOnboardingAsync(user.Id);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Provisioning", result.ProvisioningStatus);
            mockQueue.Verify(q => q.QueueProvisioning(It.Is<TenantProvisioningJob>(j => j.TenantId == tenantId)), Times.Once);

            var updatedTenant = await platformContext.Tenants.FindAsync(tenantId);
            Assert.Equal("Provisioning", updatedTenant!.Status);
            Assert.Null(updatedTenant.FailureReason);
        }

        [Fact]
        public async Task TenantProvisioningQueue_ChannelsJobsCorrectly()
        {
            // Arrange
            var queue = new TenantProvisioningQueue();
            var job = new TenantProvisioningJob
            {
                TenantId = Guid.NewGuid(),
                CompanyName = "Channel Test",
                CompanyCode = "CT",
                OwnerUserId = Guid.NewGuid(),
                SchemaName = "aquora_tenant_ct"
            };

            // Act
            queue.QueueProvisioning(job);
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            var dequeuedJob = await queue.DequeueAsync(cts.Token);

            // Assert
            Assert.NotNull(dequeuedJob);
            Assert.Equal(job.TenantId, dequeuedJob.TenantId);
            Assert.Equal("Channel Test", dequeuedJob.CompanyName);
        }

        [Fact]
        public async Task OnboardCompanyAsync_WhenProvisioningFailedAndUserReOnboards_ReusesSameTenantAndDoesNotDuplicate()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var userId = Guid.NewGuid();
            var userEmail = "founder@startup.com";
            var user = new User
            {
                Id = userId,
                Email = userEmail,
                FirstName = "Jane",
                LastName = "Founder",
                PasswordHash = "hash",
                EmailVerified = true,
                TenantId = null // Simulated: lost or unlinked after failed attempt
            };

            var existingFailedTenantId = Guid.NewGuid();
            var existingFailedTenant = new Tenant
            {
                Id = existingFailedTenantId,
                Name = "Startup Water Co",
                Code = "STARTUP_WATER",
                SchemaName = "aquora_tenant_startup_water",
                Subdomain = "startup_water",
                Status = "Failed",
                Progress = 45,
                CurrentStep = "SchemaMigrationsRun",
                FailureReason = "42703: column w.MaxWarning does not exist",
                IsInitialized = false,
                OwnerEmail = userEmail,
                CreatedBy = userId.ToString(),
                CreatedAt = DateTime.UtcNow.AddMinutes(-10)
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            platformContext.Tenants.Add(existingFailedTenant);
            await platformContext.SaveChangesAsync();

            var mockQueue = new Mock<ITenantProvisioningQueue>();
            var mockTokenService = new Mock<ITokenService>();
            mockTokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
                .Returns("token-xyz");
            mockTokenService.Setup(t => t.GenerateRefreshToken())
                .Returns("refresh-xyz");

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                mockTokenService.Object,
                Mock.Of<IServiceScopeFactory>(),
                Mock.Of<ISchemaNameGenerator>(),
                mockQueue.Object
            );

            var request = new CompanyOnboardingRequest
            {
                CompanyName = "Startup Water Co",
                EmployeeCount = 15,
                HowDidYouHearAboutUs = "Conference"
            };

            // Act: User re-submits onboarding form
            var response = await service.OnboardCompanyAsync(userId, request);

            // Assert: Must REUSE existing tenant ID and schema, NOT create a second tenant
            Assert.NotNull(response);
            Assert.Equal(existingFailedTenantId, response.TenantId);
            Assert.Equal("aquora_tenant_startup_water", response.SchemaName);
            Assert.Equal("Provisioning", response.ProvisioningStatus);

            // Exactly ONE tenant must exist in database
            var allTenants = await platformContext.Tenants.ToListAsync();
            Assert.Single(allTenants);
            Assert.Equal(existingFailedTenantId, allTenants[0].Id);
            Assert.Equal("Provisioning", allTenants[0].Status);
            Assert.Null(allTenants[0].FailureReason);

            // User must be healed to this tenant
            var updatedUser = await platformContext.Users.FindAsync(userId);
            Assert.Equal(existingFailedTenantId, updatedUser!.TenantId);

            // Provisioning job must be queued for the SAME tenant and schema
            mockQueue.Verify(q => q.QueueProvisioning(It.Is<TenantProvisioningJob>(j =>
                j.TenantId == existingFailedTenantId &&
                j.SchemaName == "aquora_tenant_startup_water")), Times.Once);
        }

        [Fact]
        public async Task GetProvisioningStatusAsync_WhenTenantIdNullOnUser_SelfHealsFromOwnerEmailAndReturnsFailedStatus()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var userId = Guid.NewGuid();
            var userEmail = "returning@founder.com";
            var user = new User
            {
                Id = userId,
                Email = userEmail,
                PasswordHash = "hash",
                EmailVerified = true,
                TenantId = null // User has no tenantId in local state
            };

            var tenantId = Guid.NewGuid();
            var failedTenant = new Tenant
            {
                Id = tenantId,
                Name = "Returning Water",
                Code = "RETURNING_WATER",
                Subdomain = "returning_water",
                SchemaName = "aquora_tenant_returning_water",
                Status = "Failed",
                Progress = 50,
                CurrentStep = "SchemaMigrationsRun",
                FailureReason = "42703: column w.MaxWarning does not exist",
                IsInitialized = false,
                OwnerEmail = userEmail,
                CreatedBy = userId.ToString()
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            platformContext.Tenants.Add(failedTenant);
            await platformContext.SaveChangesAsync();

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                Mock.Of<ITokenService>(),
                Mock.Of<IServiceScopeFactory>(),
                Mock.Of<ISchemaNameGenerator>(),
                Mock.Of<ITenantProvisioningQueue>()
            );

            // Act
            var statusObj = await service.GetProvisioningStatusAsync(userId);

            // Assert
            var json = JsonSerializer.Serialize(statusObj);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Must NOT return Pending / No Workspace! Must return the real Failed status with TenantId!
            Assert.Equal("Failed", root.GetProperty("Status").GetString());
            Assert.Equal(tenantId, root.GetProperty("TenantId").GetGuid());
            Assert.Contains("MaxWarning", root.GetProperty("FailureReason").GetString()!);

            // User must now be self-healed in platform DB
            var updatedUser = await platformContext.Users.FindAsync(userId);
            Assert.Equal(tenantId, updatedUser!.TenantId);
        }

        [Fact]
        public async Task RetryOnboardingAsync_WhenTenantIdNullOnUser_SelfHealsAndRequeuesSameTenant()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var userId = Guid.NewGuid();
            var userEmail = "retry@owner.com";
            var user = new User
            {
                Id = userId,
                Email = userEmail,
                PasswordHash = "hash",
                EmailVerified = true,
                TenantId = null // User has null TenantId
            };

            var tenantId = Guid.NewGuid();
            var failedTenant = new Tenant
            {
                Id = tenantId,
                Name = "Retry Aqua",
                Code = "RETRY_AQUA",
                Subdomain = "retry_aqua",
                SchemaName = "aquora_tenant_retry_aqua",
                Status = "Failed",
                Progress = 50,
                CurrentStep = "SchemaMigrationsRun",
                FailureReason = "Timeout during seeding",
                IsInitialized = false,
                OwnerEmail = userEmail,
                CreatedBy = userId.ToString()
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            platformContext.Tenants.Add(failedTenant);
            await platformContext.SaveChangesAsync();

            var mockQueue = new Mock<ITenantProvisioningQueue>();
            var mockTokenService = new Mock<ITokenService>();
            mockTokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
                .Returns("token-retry");
            mockTokenService.Setup(t => t.GenerateRefreshToken())
                .Returns("refresh-retry");

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                mockTokenService.Object,
                Mock.Of<IServiceScopeFactory>(),
                Mock.Of<ISchemaNameGenerator>(),
                mockQueue.Object
            );

            // Act
            var result = await service.RetryOnboardingAsync(userId);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(tenantId, result.TenantId);
            Assert.Equal("Provisioning", result.ProvisioningStatus);

            // Job requeued with exact same tenant and schema
            mockQueue.Verify(q => q.QueueProvisioning(It.Is<TenantProvisioningJob>(j =>
                j.TenantId == tenantId && j.SchemaName == "aquora_tenant_retry_aqua")), Times.Once);

            // Exactly 1 tenant row
            Assert.Equal(1, await platformContext.Tenants.CountAsync());
        }

        [Fact]
        public async Task OnboardCompanyAsync_WhenTenantCompleted_ReturnsCompletedWithoutCreatingNewTenant()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var userId = Guid.NewGuid();
            var userEmail = "active@owner.com";
            var tenantId = Guid.NewGuid();

            var user = new User
            {
                Id = userId,
                Email = userEmail,
                PasswordHash = "hash",
                EmailVerified = true,
                TenantId = tenantId
            };

            var completedTenant = new Tenant
            {
                Id = tenantId,
                Name = "Active Enterprise",
                Code = "ACTIVE_ENT",
                Subdomain = "active_ent",
                SchemaName = "aquora_tenant_active_ent",
                Status = "Completed",
                IsInitialized = true,
                Progress = 100,
                OwnerEmail = userEmail
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            platformContext.Tenants.Add(completedTenant);
            await platformContext.SaveChangesAsync();

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                Mock.Of<ITokenService>(),
                Mock.Of<IServiceScopeFactory>(),
                Mock.Of<ISchemaNameGenerator>(),
                Mock.Of<ITenantProvisioningQueue>()
            );

            var request = new CompanyOnboardingRequest
            {
                CompanyName = "Active Enterprise",
                EmployeeCount = 20,
                HowDidYouHearAboutUs = "Google"
            };

            // Act
            var result = await service.OnboardCompanyAsync(userId, request);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(tenantId, result.TenantId);
            Assert.Equal("Completed", result.ProvisioningStatus);
            Assert.Equal(1, await platformContext.Tenants.CountAsync());
        }

        [Fact]
        public async Task OnboardCompanyAsync_ConcurrentRequests_CreatesExactlyOneTenant()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var userId = Guid.NewGuid();
            var user = new User
            {
                Id = userId,
                Email = "parallel@tester.com",
                PasswordHash = "hash",
                EmailVerified = true,
                TenantId = null
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var mockQueue = new Mock<ITenantProvisioningQueue>();
            var mockTokenService = new Mock<ITokenService>();
            mockTokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>(), It.IsAny<IEnumerable<string>>(), It.IsAny<IEnumerable<string>>()))
                .Returns("token-conc");
            mockTokenService.Setup(t => t.GenerateRefreshToken())
                .Returns("refresh-conc");

            var mockSchemaNameGenerator = new Mock<ISchemaNameGenerator>();
            mockSchemaNameGenerator.Setup(x => x.GenerateSchemaNameAsync(It.IsAny<string>()))
                .ReturnsAsync("aquora_tenant_parallel_test");

            var service = new CompanyOnboardingService(
                platformContext,
                Mock.Of<ITenantDatabaseService>(),
                mockTokenService.Object,
                Mock.Of<IServiceScopeFactory>(),
                mockSchemaNameGenerator.Object,
                mockQueue.Object
            );

            var request = new CompanyOnboardingRequest
            {
                CompanyName = "Parallel Bottling",
                EmployeeCount = 10,
                HowDidYouHearAboutUs = "Web"
            };

            // Act: Fire two concurrent onboarding requests simultaneously (simulate double-click or two browser tabs)
            var task1 = service.OnboardCompanyAsync(userId, request);
            var task2 = service.OnboardCompanyAsync(userId, request);

            var responses = await Task.WhenAll(task1, task2);

            // Assert: Both must succeed, return the SAME TenantId, and exactly ONE tenant record in DB
            Assert.Equal(responses[0].TenantId, responses[1].TenantId);
            Assert.Equal(1, await platformContext.Tenants.CountAsync());
        }

        [Fact]
        public async Task AuthService_GetSessionAsync_WhenTenantIdNullOnUser_SelfHealsAndRoutesToAccountSetupWhenFailed()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var userId = Guid.NewGuid();
            var userEmail = "sessionheal@owner.com";
            var user = new User
            {
                Id = userId,
                Email = userEmail,
                FirstName = "Heal",
                LastName = "Owner",
                PasswordHash = "hashed",
                EmailVerified = true,
                TenantId = null // Simulated: lost or cleared in user record
            };

            var tenantId = Guid.NewGuid();
            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "Session Heal Co",
                Code = "SESSION_HEAL",
                Subdomain = "session_heal",
                SchemaName = "aquora_tenant_session_heal",
                Status = "Failed",
                Progress = 40,
                CurrentStep = "SchemaMigrationsRun",
                FailureReason = "42703: column w.MaxWarning does not exist",
                IsInitialized = false,
                OwnerEmail = userEmail,
                CreatedBy = userId.ToString()
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            platformContext.Tenants.Add(tenant);
            await platformContext.SaveChangesAsync();

            var mockTokenService = new Mock<ITokenService>();
            var mockPasswordHasher = new Mock<IPasswordHasher>();
            var mockEmailService = new Mock<IEmailService>();
            var mockUserContext = new Mock<ICurrentUserContext>();
            var mockScopeFactory = new Mock<IServiceScopeFactory>();
            var mockTaskQueue = new Mock<IBackgroundTaskQueue>();

            var authService = new AuthService(
                platformContext,
                mockTokenService.Object,
                mockPasswordHasher.Object,
                mockScopeFactory.Object,
                mockEmailService.Object,
                mockTaskQueue.Object,
                mockUserContext.Object
            );

            // Act
            var session = await authService.GetSessionAsync(userId.ToString());

            // Assert: Must self-heal tenantId, recognize tenant is not initialized, and route to /account-setup
            Assert.NotNull(session);
            Assert.Equal(tenantId, session.TenantId);
            Assert.False(session.IsTenantInitialized);
            Assert.Equal("Failed", session.TenantStatus);
            Assert.Equal("/account-setup", session.Dashboard);

            // Verify User record in platformContext was healed
            var updatedUser = await platformContext.Users.FindAsync(userId);
            Assert.Equal(tenantId, updatedUser!.TenantId);
        }
    }
}
