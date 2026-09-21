using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Infrastructure.Services;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace Aquora.Tests
{
    public class TenantSchemaInspectionTests
    {
        private readonly ITestOutputHelper _output;
        private const string ConnectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        public TenantSchemaInspectionTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public async Task TestCorrectSchemaOrderMigrationExecution()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            var tenantSchemas = new[] { "aquora_tenant_greenway_manufactures", "aquora_tenant_accountant_company", "aquora_tenant_gangothri_2" };

            var sb = new StringBuilder();

            foreach (var schema in tenantSchemas)
            {
                sb.AppendLine($"==================================================");
                sb.AppendLine($"CORRECT ORDER MIGRATION FOR SCHEMA: {schema}");
                sb.AppendLine($"==================================================");

                var services = new ServiceCollection();
                services.AddDbContext<PlatformDbContext>(options => options.UseNpgsql(ConnectionString));
                services.AddScoped<ITenantProvider, TenantProvider>();
                services.AddHttpContextAccessor();
                services.AddScoped<ICurrentUserContext, CurrentUserContext>();
                services.AddDbContext<TenantDbContext>((sp, options) => 
                {
                    var tenantProvider = sp.GetRequiredService<ITenantProvider>();
                    var schema = !string.IsNullOrWhiteSpace(tenantProvider.TenantSchemaName)
                        ? tenantProvider.TenantSchemaName
                        : "public";
                    options.UseNpgsql(ConnectionString,
                        b => b.MigrationsAssembly(typeof(TenantDbContext).Assembly.FullName)
                              .MigrationsHistoryTable("__EFMigrationsHistory", schema))
                           .ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>()
                           .ReplaceService<IMigrationsSqlGenerator, TenantMigrationsSqlGenerator>()
                           .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
                });
                services.AddLogging();

                var sp = services.BuildServiceProvider();
                using var scope = sp.CreateScope();
                var platformContext = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
                var tenantObj = await platformContext.Tenants.FirstOrDefaultAsync(t => t.SchemaName == schema);

                if (tenantObj != null)
                {
                    // CRITICAL: SET SCHEMA BEFORE RESOLVING TenantDbContext!
                    TenantSchemaResolver.CurrentSchemaName = schema;
                    var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
                    tenantProvider.SetTenantId(tenantObj.Id);
                    tenantProvider.SetTenantSchemaName(schema);

                    var tenantContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();

                    // Verify search_path and current schema on connection
                    var dbConn = tenantContext.Database.GetDbConnection();
                    if (dbConn.State != ConnectionState.Open) await dbConn.OpenAsync();
                    await tenantContext.Database.ExecuteSqlRawAsync($"SET search_path TO \"{schema}\", public;");

                    var pending = (await tenantContext.Database.GetPendingMigrationsAsync()).ToList();
                    sb.AppendLine($"Pending Migrations count for {schema}: {pending.Count}");
                    foreach (var p in pending)
                    {
                        sb.AppendLine($"  - Pending: {p}");
                    }

                    try
                    {
                        await tenantContext.Database.MigrateAsync();
                        sb.AppendLine($"MigrateAsync() SUCCEEDED for {schema}!");
                    }
                    catch (Exception ex)
                    {
                        sb.AppendLine($"MigrateAsync() FAILED for {schema}: {ex.Message}");
                        if (ex.InnerException != null)
                        {
                            sb.AppendLine($"  Inner Exception: {ex.InnerException.Message}");
                        }
                    }
                }
                sb.AppendLine();
            }

            var reportPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "correct_order_migration_report.txt");
            await File.WriteAllTextAsync(reportPath, sb.ToString());
            _output.WriteLine(sb.ToString());

            // Inspect after migration
            await InspectAllTenantSchemas();
        }

        [Fact]
        public async Task InspectAllTenantSchemas()
        {
            var sb = new StringBuilder();
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();
            sb.AppendLine("Connected to Live Database successfully.");

            // 1. Get all tenant records from public.Tenants
            var tenants = new List<(Guid Id, string Name, string SchemaName, bool IsActive, bool IsInitialized, string Status)>();
            await using (var cmd = new NpgsqlCommand("SELECT \"Id\", \"Name\", \"SchemaName\", \"IsActive\", \"IsInitialized\", \"Status\" FROM public.\"Tenants\";", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    tenants.Add((
                        reader.GetGuid(0),
                        reader.GetString(1),
                        reader.GetString(2),
                        reader.GetBoolean(3),
                        reader.GetBoolean(4),
                        reader.IsDBNull(5) ? "NULL" : reader.GetString(5)
                    ));
                }
            }

            sb.AppendLine($"Total Tenants in public.Tenants: {tenants.Count}");
            foreach (var t in tenants)
            {
                sb.AppendLine($"Tenant: ID={t.Id}, Name='{t.Name}', Schema='{t.SchemaName}', Active={t.IsActive}, Initialized={t.IsInitialized}, Status='{t.Status}'");
            }

            // Also check for any schemas in postgres matching aquora_tenant_%
            var allSchemas = new List<string>();
            await using (var cmd = new NpgsqlCommand("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'aquora_tenant_%';", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    allSchemas.Add(reader.GetString(0));
                }
            }
            sb.AppendLine($"\nAll PostgreSQL Schemas matching aquora_tenant_%: {string.Join(", ", allSchemas)}");

            var expectedTwentyLTables = new[]
            {
                "TwentyLDeliveries",
                "TwentyLDistributorProfiles",
                "TwentyLJarMovements",
                "TwentyLRateRules",
                "TwentyLCommissionRules",
                "TwentyLCommissionTransactions",
                "TwentyLJarPositions",
                "TwentyLDistributorSupplies",
                "TwentyLDistributorRoutes",
                "TwentyLDistributorVehicles",
                "TwentyLDistributorDrivers",
                "TwentyLDistributorCustomers",
                "TwentyLDistributorDeliveries",
                "TwentyLTrips",
                "TwentyLTripStops",
                "TwentyLOperations",
                "TwentyLJarInspections"
            };

            foreach (var schemaName in allSchemas)
            {
                sb.AppendLine($"\n--------------------------------------------------");
                sb.AppendLine($"INSPECTING SCHEMA: {schemaName}");

                // Get applied migrations
                bool hasHistoryTable = false;
                await using (var checkCmd = new NpgsqlCommand($@"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{schemaName}' AND table_name = '__EFMigrationsHistory');", conn))
                {
                    hasHistoryTable = (bool)(await checkCmd.ExecuteScalarAsync() ?? false);
                }

                var appliedMigrations = new List<string>();
                if (hasHistoryTable)
                {
                    await using var migCmd = new NpgsqlCommand($@"SELECT ""MigrationId"" FROM ""{schemaName}"".""__EFMigrationsHistory"" ORDER BY ""MigrationId"";", conn);
                    await using var migReader = await migCmd.ExecuteReaderAsync();
                    while (await migReader.ReadAsync())
                    {
                        appliedMigrations.Add(migReader.GetString(0));
                    }
                }

                sb.AppendLine($"__EFMigrationsHistory count: {appliedMigrations.Count}");
                if (appliedMigrations.Count > 0)
                {
                    sb.AppendLine($"  First Applied Migration: {appliedMigrations.First()}");
                    sb.AppendLine($"  Last Applied Migration:  {appliedMigrations.Last()}");
                }
                else
                {
                    sb.AppendLine("  No EF migrations history table or no records!");
                }

                // Check 20L tables
                var missingTables = new List<string>();
                var existingTables = new List<string>();
                foreach (var table in expectedTwentyLTables)
                {
                    bool tableExists = false;
                    await using (var checkTableCmd = new NpgsqlCommand($@"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{schemaName}' AND table_name = '{table}');", conn))
                    {
                        tableExists = (bool)(await checkTableCmd.ExecuteScalarAsync() ?? false);
                    }
                    if (tableExists) existingTables.Add(table);
                    else missingTables.Add(table);
                }

                sb.AppendLine($"20L Existing Tables ({existingTables.Count}): {string.Join(", ", existingTables)}");
                sb.AppendLine($"20L MISSING Tables ({missingTables.Count}): {string.Join(", ", missingTables)}");
            }

            var reportPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "schema_inspection_report.txt");
            await File.WriteAllTextAsync(reportPath, sb.ToString());
            _output.WriteLine(sb.ToString());
        }

        [Fact]
        public async Task VerifyGreenwayTwentyLQueriesAndFullSchemaParity()
        {
            var services = new ServiceCollection();
            services.AddDbContext<PlatformDbContext>(options => options.UseNpgsql(ConnectionString));
            services.AddScoped<ITenantProvider, TenantProvider>();
            services.AddHttpContextAccessor();
            services.AddScoped<ICurrentUserContext, CurrentUserContext>();
            services.AddDbContext<TenantDbContext>((sp, options) => 
            {
                var tenantProvider = sp.GetRequiredService<ITenantProvider>();
                var schema = !string.IsNullOrWhiteSpace(tenantProvider.TenantSchemaName)
                    ? tenantProvider.TenantSchemaName
                    : "public";
                options.UseNpgsql(ConnectionString,
                    b => b.MigrationsAssembly(typeof(TenantDbContext).Assembly.FullName)
                          .MigrationsHistoryTable("__EFMigrationsHistory", schema))
                       .ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>()
                       .ReplaceService<IMigrationsSqlGenerator, TenantMigrationsSqlGenerator>()
                       .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
            });
            services.AddScoped<IMigrationService, MigrationService>();
            services.AddLogging();

            var sp = services.BuildServiceProvider();

            // Run full migration service (as app startup does)
            using (var migrationScope = sp.CreateScope())
            {
                var migrationService = migrationScope.ServiceProvider.GetRequiredService<IMigrationService>();
                await migrationService.MigrateAllAsync();
            }

            using var scope = sp.CreateScope();
            var platformContext = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var greenwayTenant = await platformContext.Tenants.FirstOrDefaultAsync(t => t.SchemaName == "aquora_tenant_greenway_manufactures");

            Assert.NotNull(greenwayTenant);

            TenantSchemaResolver.CurrentSchemaName = greenwayTenant.SchemaName;
            var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
            tenantProvider.SetTenantId(greenwayTenant.Id);
            tenantProvider.SetTenantSchemaName(greenwayTenant.SchemaName);

            var tenantContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();

            // Verify distributor profiles query works cleanly
            var distributors = await tenantContext.TwentyLDistributorProfiles.ToListAsync();
            _output.WriteLine($"[GREENWAY VERIFICATION] TwentyLDistributorProfiles count: {distributors.Count}");

            // Verify jar movements query works cleanly
            var jarMovements = await tenantContext.TwentyLJarMovements.ToListAsync();
            _output.WriteLine($"[GREENWAY VERIFICATION] TwentyLJarMovements count: {jarMovements.Count}");

            // Verify companies query still works cleanly
            var companies = await tenantContext.Companies.ToListAsync();
            _output.WriteLine($"[GREENWAY VERIFICATION] Companies count: {companies.Count}");

            // Verify schema parity across all schemas
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            var expectedTwentyLTables = new[]
            {
                "TwentyLDeliveries", "TwentyLDistributorProfiles", "TwentyLJarMovements", "TwentyLRateRules",
                "TwentyLCommissionRules", "TwentyLCommissionTransactions", "TwentyLJarPositions", "TwentyLDistributorSupplies",
                "TwentyLDistributorRoutes", "TwentyLDistributorVehicles", "TwentyLDistributorDrivers", "TwentyLDistributorCustomers",
                "TwentyLDistributorDeliveries", "TwentyLTrips", "TwentyLTripStops", "TwentyLOperations", "TwentyLJarInspections"
            };

            var schemas = new[]
            {
                "aquora_tenant_greenway_manufactures",
                "aquora_tenant_accountant_company",
                "aquora_tenant_gangothri_2",
                "aquora_tenant_greenmount_aquaa_2",
                "aquora_tenant_sinan_company"
            };

            foreach (var schema in schemas)
            {
                foreach (var table in expectedTwentyLTables)
                {
                    await using var cmd = new NpgsqlCommand($"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{schema}' AND table_name = '{table}');", conn);
                    bool exists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                    Assert.True(exists, $"Table '{table}' should exist in tenant schema '{schema}'");
                }
            }
        }
    }
}
