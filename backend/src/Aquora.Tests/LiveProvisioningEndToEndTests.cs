using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Npgsql;
using Xunit;
using Xunit.Abstractions;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Infrastructure.Services;
using Aquora.Persistence;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;

namespace Aquora.Tests
{
    public class LiveProvisioningEndToEndTests
    {
        private readonly ITestOutputHelper _output;
        private const string ConnectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        public LiveProvisioningEndToEndTests(ITestOutputHelper output)
        {
            _output = output;
        }

        private (IServiceProvider Provider, ITenantDatabaseService TenantDbService, PlatformDbContext PlatformContext) CreateServices()
        {
            var services = new ServiceCollection();
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "ConnectionStrings:DefaultConnection", ConnectionString }
                })
                .Build();

            services.AddSingleton<IConfiguration>(configuration);
            services.AddPersistence(configuration);
            services.AddScoped<ITenantProvider, TenantProvider>();
            services.AddScoped<ICurrentUserContext>(sp => Mock.Of<ICurrentUserContext>());

            var sp = services.BuildServiceProvider();
            var platformContext = sp.GetRequiredService<PlatformDbContext>();
            var tenantDbService = sp.GetRequiredService<ITenantDatabaseService>();

            return (sp, tenantDbService, platformContext);
        }

        [Fact]
        public async Task Test_GreenmountAqua_ProvisioningResumesAndCompletesSuccessfully()
        {
            var (provider, tenantDbService, platformContext) = CreateServices();
            var tenantId = Guid.Parse("8d9490da-cc37-45b1-a5ae-36bb30d7bbbe");
            var schemaName = "aquora_tenant_greenmount_aqua";

            var tenant = await platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId)
                ?? await platformContext.Tenants.FirstOrDefaultAsync(t => t.Name.Contains("Greenmount") || t.Code.Contains("GREENMOUNT"));
            if (tenant == null)
            {
                _output.WriteLine("No existing Greenmount Aqua tenant found in this database environment; skipping existing-tenant resume test.");
                return;
            }
            tenantId = tenant.Id;
            schemaName = tenant.SchemaName;

            var user = await platformContext.Users.FirstOrDefaultAsync(u => u.TenantId == tenantId);
            var ownerUserId = user?.Id ?? Guid.NewGuid();

            _output.WriteLine($"Resuming provisioning for Greenmount Aqua (ID: {tenantId}, Schema: {schemaName}, User: {ownerUserId})");

            var progressSteps = new List<(int Progress, string Step, string Message)>();
            var result = await tenantDbService.ProvisionTenantAsync(
                tenantId,
                schemaName,
                tenant.Name,
                tenant.Code,
                ownerUserId,
                new List<string> { "Blowing", "Filling", "Packing" },
                (prog, step, msg) =>
                {
                    progressSteps.Add((prog, step, msg));
                    _output.WriteLine($"  [{prog}%] Step: {step} - {msg}");
                    return Task.CompletedTask;
                });

            _output.WriteLine($"Provisioning result: CompanyId={result.CompanyId}, OwnerRole={result.OwnerRoleName}");
            Assert.NotEqual(Guid.Empty, result.CompanyId);

            // Verify live database state
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            // 1. Check all 55 migrations applied in Greenmount schema
            var migrationCount = 0L;
            await using (var cmd = new NpgsqlCommand($@"SELECT COUNT(*) FROM ""{schemaName}"".""__EFMigrationsHistory"";", conn))
            {
                migrationCount = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
            }
            _output.WriteLine($"Total migrations in Greenmount schema: {migrationCount}");
            Assert.True(migrationCount >= 55, $"Expected at least 55 migrations, got {migrationCount}");

            // 2. Check TwentyLDistributorProfiles exists
            bool distProfilesTableExists = false;
            await using (var cmd = new NpgsqlCommand($@"
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = '{schemaName}' AND table_name = 'TwentyLDistributorProfiles'
                );", conn))
            {
                distProfilesTableExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
            }
            _output.WriteLine($"TwentyLDistributorProfiles exists: {distProfilesTableExists}");
            Assert.True(distProfilesTableExists);

            // 3. Verify no table or constraint was created in rogue schema 'Id'
            await using (var cmd = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'Id');", conn))
            {
                var idSchemaExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                Assert.False(idSchemaExists, "Rogue schema 'Id' should never be created!");
            }

            // 4. Verify no table or constraint was created in schema 'Id'
            await using (var cmd = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'Id');", conn))
            {
                var idExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                _output.WriteLine($"Schema 'Id' exists: {idExists}");
                Assert.False(idExists);
            }

            // 5. Verify provisioning result
            Assert.NotEqual(Guid.Empty, result.CompanyId);
            Assert.Equal("CompanyAdmin", result.OwnerRoleName);
        }

        [Fact]
        public async Task Test_FreshTenant_FullEndToEndProvisioning()
        {
            var (provider, tenantDbService, platformContext) = CreateServices();
            var freshTenantId = Guid.NewGuid();
            var freshOwnerUserId = Guid.NewGuid();
            var schemaSuffix = freshTenantId.ToString("N")[..8];
            var schemaName = $"aquora_tenant_e2e_{schemaSuffix}";
            var companyName = "Apex Water Systems";
            var companyCode = $"APEX_{schemaSuffix.ToUpper()}";

            _output.WriteLine($"Creating brand new workspace for {companyName} (TenantId: {freshTenantId}, Schema: {schemaName})");

            // Create tenant workspace entry
            var freshTenant = new Tenant
            {
                Id = freshTenantId,
                Name = companyName,
                Code = companyCode,
                Subdomain = $"apex{schemaSuffix}",
                SchemaName = schemaName,
                Status = "Provisioning",
                Progress = 10,
                CurrentStep = "TenantCreated",
                IsInitialized = false,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "E2ETest"
            };
            var freshUser = new User
            {
                Id = freshOwnerUserId,
                TenantId = freshTenantId,
                Email = $"admin@apex{schemaSuffix}.com",
                PasswordHash = "TestHash123!",
                EmailVerified = true,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "E2ETest"
            };

            platformContext.Tenants.Add(freshTenant);
            platformContext.Users.Add(freshUser);
            await platformContext.SaveChangesAsync();

            try
            {
                var progressSteps = new List<(int Progress, string Step, string Message)>();
                var result = await tenantDbService.ProvisionTenantAsync(
                    freshTenantId,
                    schemaName,
                    companyName,
                    companyCode,
                    freshOwnerUserId,
                    new List<string> { "Blowing", "Filling", "Packing" },
                    (prog, step, msg) =>
                    {
                        progressSteps.Add((prog, step, msg));
                        _output.WriteLine($"  [{prog}%] {step}: {msg}");
                        return Task.CompletedTask;
                    });

                _output.WriteLine($"Provisioning succeeded! Result CompanyId: {result.CompanyId}");
                Assert.NotEqual(Guid.Empty, result.CompanyId);

                // Verify live database
                await using var conn = new NpgsqlConnection(ConnectionString);
                await conn.OpenAsync();

                // Schema exists
                await using (var cmd = new NpgsqlCommand($"SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = '{schemaName}');", conn))
                {
                    var exists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                    Assert.True(exists);
                }

                // Verify tables in schema
                var tableCount = 0L;
                await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '{schemaName}';", conn))
                {
                    tableCount = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                }
                _output.WriteLine($"Total tables in fresh schema: {tableCount}");
                Assert.True(tableCount > 30, $"Expected > 30 tables in new schema, found {tableCount}");

                // Verify migration count
                var migrationCount = 0L;
                await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{schemaName}\".\"__EFMigrationsHistory\";", conn))
                {
                    migrationCount = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                }
                _output.WriteLine($"Total migrations applied in fresh schema: {migrationCount}");
                Assert.True(migrationCount >= 55);

                // Verify QC parameters were seeded and have MaxWarning / MinWarning
                await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{schemaName}\".\"WaterTestParameters\";", conn))
                {
                    var qcCount = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                    _output.WriteLine($"Total QC parameters seeded: {qcCount}");
                    Assert.True(qcCount > 0, "QC default parameters should have been seeded");
                }

                await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{schemaName}\".\"WaterTestParameters\" WHERE \"MaxWarning\" IS NOT NULL;", conn))
                {
                    var warningCount = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                    _output.WriteLine($"QC parameters with MaxWarning: {warningCount}");
                    Assert.True(warningCount > 0, "Parameters with MaxWarning should exist");
                }

                // Verify Roles were seeded
                await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{schemaName}\".\"Roles\";", conn))
                {
                    var roleCount = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                    _output.WriteLine($"Total roles seeded: {roleCount}");
                    Assert.True(roleCount >= 5, "Default roles should have been seeded");
                }

                // Test Idempotent Retry: running ProvisionTenantAsync again on the same schema must succeed without duplicate key errors
                _output.WriteLine("Testing Idempotency: Re-running ProvisionTenantAsync on the existing tenant schema...");
                var retryResult = await tenantDbService.ProvisionTenantAsync(
                    freshTenantId,
                    schemaName,
                    companyName,
                    companyCode,
                    freshOwnerUserId,
                    new List<string> { "Blowing", "Filling", "Packing" });
                Assert.NotNull(retryResult);
                _output.WriteLine("Idempotent retry successfully completed without any errors!");
            }
            finally
            {
                // Clean up the temporary test schema and platform records safely
                try
                {
                    await using var cleanupConn = new NpgsqlConnection(ConnectionString);
                    await cleanupConn.OpenAsync();
                    await using var dropCmd = new NpgsqlCommand($"DROP SCHEMA IF EXISTS \"{schemaName}\" CASCADE;", cleanupConn);
                    await dropCmd.ExecuteNonQueryAsync();

                    var delUser = await platformContext.Users.FirstOrDefaultAsync(u => u.Id == freshOwnerUserId);
                    if (delUser != null) platformContext.Users.Remove(delUser);

                    var delTenant = await platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == freshTenantId);
                    if (delTenant != null) platformContext.Tenants.Remove(delTenant);

                    await platformContext.SaveChangesAsync();
                    _output.WriteLine($"Cleaned up temporary test tenant {freshTenantId} safely.");
                }
                catch (Exception cleanupEx)
                {
                    _output.WriteLine($"Cleanup notice: {cleanupEx.Message}");
                }
            }
        }
    }
}
