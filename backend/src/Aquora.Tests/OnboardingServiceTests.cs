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
    }
}
