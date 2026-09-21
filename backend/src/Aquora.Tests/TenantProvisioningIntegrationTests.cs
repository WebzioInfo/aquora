using System;
using System.Collections.Generic;
using System.Linq;
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
using Aquora.Persistence.Services;

namespace Aquora.Tests
{
    public class TenantProvisioningIntegrationTests
    {
        [Fact]
        public async Task Test1_FreshTenantProvisioning_CreatesExactlyOneCompanyInTenantSchema()
        {
            // Arrange
            var platformDbName = Guid.NewGuid().ToString();
            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: platformDbName)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var tenantDbName = Guid.NewGuid().ToString();
            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: tenantDbName)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var tenantId = Guid.NewGuid();
            var ownerUserId = Guid.NewGuid();
            var schemaName = "aquora_tenant_fresh_test";

            using var platformContext = new PlatformDbContext(platformOptions);
            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "Fresh Bottling Corp",
                Code = "FBC",
                Subdomain = "fbc",
                SchemaName = schemaName,
                Status = "Provisioning",
                Progress = 10,
                CurrentStep = "TenantCreated",
                IsInitialized = false
            };
            var user = new User
            {
                Id = ownerUserId,
                Email = "owner@fbc.com",
                PasswordHash = "hash",
                EmailVerified = true,
                TenantId = tenantId
            };
            platformContext.Tenants.Add(tenant);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var services = new ServiceCollection();
            services.AddScoped<ITenantProvider>(sp =>
            {
                var mock = new Mock<ITenantProvider>();
                mock.Setup(t => t.TenantId).Returns(tenantId);
                mock.Setup(t => t.TenantSchemaName).Returns(schemaName);
                return mock.Object;
            });
            services.AddScoped<ICurrentUserContext>(sp => Mock.Of<ICurrentUserContext>());
            services.AddScoped<TenantDbContext>(sp => new TenantDbContext(tenantOptions, sp.GetRequiredService<ITenantProvider>(), sp.GetRequiredService<ICurrentUserContext>()));
            var serviceProvider = services.BuildServiceProvider();

            var scopeFactory = serviceProvider.GetRequiredService<IServiceScopeFactory>();
            var tenantDatabaseService = new TenantDatabaseService(platformContext, scopeFactory);

            // Act
            var progressUpdates = new List<(int progress, string step, string message)>();
            var result = await tenantDatabaseService.ProvisionTenantAsync(
                tenantId,
                schemaName,
                "Fresh Bottling Corp",
                "FBC",
                ownerUserId,
                new List<string> { "Blowing", "Filling", "Packing" },
                (prog, step, msg) =>
                {
                    progressUpdates.Add((prog, step, msg));
                    return Task.CompletedTask;
                });

            // Assert
            Assert.NotEqual(Guid.Empty, result.CompanyId);
            Assert.Equal("Owner", result.OwnerRoleName);
            Assert.True(progressUpdates.Any(p => p.step == "ManufacturingModulesInitialized"));

            // Verify TenantDbContext has exactly 1 Company record
            using (var scope = scopeFactory.CreateScope())
            {
                var tenantContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();
                var companies = await tenantContext.Companies.Where(c => !c.IsDeleted).ToListAsync();
                Assert.Single(companies);
                Assert.Equal("Fresh Bottling Corp", companies[0].Name);
                Assert.Equal("FBC", companies[0].Code);
                Assert.Equal(tenantId, companies[0].TenantId);
            }
        }

        [Fact]
        public async Task Test2_ProvisioningRetry_IsIdempotent_DoesNotDuplicateCompany()
        {
            // Arrange
            var platformDbName = Guid.NewGuid().ToString();
            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: platformDbName)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var tenantDbName = Guid.NewGuid().ToString();
            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: tenantDbName)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var tenantId = Guid.NewGuid();
            var ownerUserId = Guid.NewGuid();
            var schemaName = "aquora_tenant_retry_test";

            using var platformContext = new PlatformDbContext(platformOptions);
            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "Retry Bottling Corp",
                Code = "RBC",
                Subdomain = "rbc",
                SchemaName = schemaName,
                Status = "Provisioning",
                Progress = 10,
                CurrentStep = "TenantCreated",
                IsInitialized = false
            };
            var user = new User
            {
                Id = ownerUserId,
                Email = "owner@rbc.com",
                PasswordHash = "hash",
                EmailVerified = true,
                TenantId = tenantId
            };
            platformContext.Tenants.Add(tenant);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var services = new ServiceCollection();
            services.AddScoped<ITenantProvider>(sp =>
            {
                var mock = new Mock<ITenantProvider>();
                mock.Setup(t => t.TenantId).Returns(tenantId);
                mock.Setup(t => t.TenantSchemaName).Returns(schemaName);
                return mock.Object;
            });
            services.AddScoped<ICurrentUserContext>(sp => Mock.Of<ICurrentUserContext>());
            services.AddScoped<TenantDbContext>(sp => new TenantDbContext(tenantOptions, sp.GetRequiredService<ITenantProvider>(), sp.GetRequiredService<ICurrentUserContext>()));
            var serviceProvider = services.BuildServiceProvider();

            var scopeFactory = serviceProvider.GetRequiredService<IServiceScopeFactory>();
            var tenantDatabaseService = new TenantDatabaseService(platformContext, scopeFactory);

            // Act 1: First Run
            var result1 = await tenantDatabaseService.ProvisionTenantAsync(
                tenantId,
                schemaName,
                "Retry Bottling Corp",
                "RBC",
                ownerUserId,
                new List<string> { "Blowing", "Filling" });

            Assert.NotEqual(Guid.Empty, result1.CompanyId);

            // Act 2: Retry Run
            var result2 = await tenantDatabaseService.ProvisionTenantAsync(
                tenantId,
                schemaName,
                "Retry Bottling Corp",
                "RBC",
                ownerUserId,
                new List<string> { "Blowing", "Filling" });

            Assert.NotEqual(Guid.Empty, result2.CompanyId);
            Assert.Equal(result1.CompanyId, result2.CompanyId);

            // Assert: Verify exactly ONE Company exists
            using (var scope = scopeFactory.CreateScope())
            {
                var tenantContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();
                var companies = await tenantContext.Companies.Where(c => !c.IsDeleted).ToListAsync();
                Assert.Single(companies);
            }
        }

        [Fact]
        public async Task Test3_ConcurrentProvisioning_TwoTenants_MaintainsStrictIsolation()
        {
            // Arrange
            var platformDbName = Guid.NewGuid().ToString();
            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: platformDbName)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            using var platformContext = new PlatformDbContext(platformOptions);

            var tenant1Id = Guid.NewGuid();
            var tenant1Schema = "aquora_tenant_concurr_1";
            var tenant2Id = Guid.NewGuid();
            var tenant2Schema = "aquora_tenant_concurr_2";

            platformContext.Tenants.Add(new Tenant { Id = tenant1Id, Name = "Tenant One", Code = "T1", SchemaName = tenant1Schema, Subdomain = "t1" });
            platformContext.Tenants.Add(new Tenant { Id = tenant2Id, Name = "Tenant Two", Code = "T2", SchemaName = tenant2Schema, Subdomain = "t2" });
            await platformContext.SaveChangesAsync();

            var tenant1DbName = Guid.NewGuid().ToString();
            var tenant1Options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: tenant1DbName)
                .Options;

            var tenant2DbName = Guid.NewGuid().ToString();
            var tenant2Options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: tenant2DbName)
                .Options;

            var services = new ServiceCollection();
            services.AddScoped<ITenantProvider>(sp =>
            {
                var mock = new Mock<ITenantProvider>();
                mock.Setup(t => t.TenantSchemaName).Returns(TenantSchemaResolver.CurrentSchemaName ?? "public");
                mock.Setup(t => t.TenantId).Returns(tenant1Id);
                return mock.Object;
            });
            services.AddScoped<ICurrentUserContext>(sp => Mock.Of<ICurrentUserContext>());
            services.AddScoped<TenantDbContext>(sp =>
            {
                var schema = TenantSchemaResolver.CurrentSchemaName;
                var opt = schema == tenant2Schema ? tenant2Options : tenant1Options;
                return new TenantDbContext(opt, sp.GetRequiredService<ITenantProvider>(), sp.GetRequiredService<ICurrentUserContext>());
            });
            var serviceProvider = services.BuildServiceProvider();
            var scopeFactory = serviceProvider.GetRequiredService<IServiceScopeFactory>();

            // Act: Run concurrently with separate platform contexts
            var task1 = Task.Run(async () =>
            {
                using var pContext = new PlatformDbContext(platformOptions);
                var dbService = new TenantDatabaseService(pContext, scopeFactory);
                return await dbService.ProvisionTenantAsync(tenant1Id, tenant1Schema, "Tenant One", "T1", Guid.NewGuid(), new List<string> { "Filling" });
            });

            var task2 = Task.Run(async () =>
            {
                using var pContext = new PlatformDbContext(platformOptions);
                var dbService = new TenantDatabaseService(pContext, scopeFactory);
                return await dbService.ProvisionTenantAsync(tenant2Id, tenant2Schema, "Tenant Two", "T2", Guid.NewGuid(), new List<string> { "Blowing" });
            });

            var results = await Task.WhenAll(task1, task2);

            // Assert
            Assert.NotEqual(Guid.Empty, results[0].CompanyId);
            Assert.NotEqual(Guid.Empty, results[1].CompanyId);
            Assert.NotEqual(results[0].CompanyId, results[1].CompanyId);
        }

        [Fact]
        public void Test4_MissingSchemaContext_FailsFastBeforeMigrationSql()
        {
            // Reset resolver state
            TenantSchemaResolver.CurrentSchemaName = null;
            TenantSchemaResolver.IsDesignTime = false;

            // Assert that resolving required schema throws immediately
            var ex = Assert.Throws<InvalidOperationException>(() =>
            {
                TenantSchemaResolver.ResolveRequiredSchema();
            });

            Assert.Contains("Tenant schema context is missing", ex.Message);
        }

        [Fact]
        public async Task Test5_AsyncLocal_SchemaContext_SurvivesNestedAsyncTasks()
        {
            TenantSchemaResolver.CurrentSchemaName = "aquora_tenant_parent_context";

            var nestedResult = await Task.Run(async () =>
            {
                await Task.Delay(10);
                var innerSchema = TenantSchemaResolver.ResolveRequiredSchema();
                return innerSchema;
            });

            Assert.Equal("aquora_tenant_parent_context", nestedResult);
            Assert.Equal("aquora_tenant_parent_context", TenantSchemaResolver.CurrentSchemaName);
        }
    }
}
