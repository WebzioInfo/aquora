using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace Aquora.Tests
{
    public class TenantDatabaseAuditTests
    {
        private readonly ITestOutputHelper _output;
        private const string ConnectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        public TenantDatabaseAuditTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public async Task AuditLiveTenantsAndMigrations()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();
            _output.WriteLine("Connected to Supabase PostgreSQL.");

            // 1. Check if schema "Id" exists
            await using (var cmd = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'Id');", conn))
            {
                var idSchemaExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                _output.WriteLine($"Schema 'Id' exists in database: {idSchemaExists}");
            }

            // 2. Query all tenants from public."Tenants"
            var tenants = new List<(Guid Id, string Name, string Code, string SchemaName, string Status, string CurrentStep, int Progress, bool IsInitialized)>();
            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""Id"", ""Name"", ""Code"", ""SchemaName"", ""Status"", ""CurrentStep"", ""Progress"", ""IsInitialized""
                FROM ""public"".""Tenants"";", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    tenants.Add((
                        reader.GetGuid(0),
                        reader.GetString(1),
                        reader.GetString(2),
                        reader.GetString(3),
                        reader.IsDBNull(4) ? "" : reader.GetString(4),
                        reader.IsDBNull(5) ? "" : reader.GetString(5),
                        reader.IsDBNull(6) ? 0 : reader.GetInt32(6),
                        reader.IsDBNull(7) ? false : reader.GetBoolean(7)
                    ));
                }
            }

            _output.WriteLine($"Found {tenants.Count} tenants in platform database:");
            foreach (var t in tenants)
            {
                _output.WriteLine($"  Tenant: {t.Name} (ID: {t.Id}, Code: {t.Code}, Schema: {t.SchemaName}, Status: {t.Status}, Step: {t.CurrentStep}, Progress: {t.Progress}%, Initialized: {t.IsInitialized})");
            }

            // 3. For each tenant, check schema existence and migration history
            foreach (var t in tenants)
            {
                _output.WriteLine($"\n--- Inspecting Tenant Schema: {t.SchemaName} ---");
                bool schemaExists = false;
                await using (var cmd = new NpgsqlCommand($@"SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = '{t.SchemaName}');", conn))
                {
                    schemaExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                    _output.WriteLine($"  Schema exists: {schemaExists}");
                }

                if (!schemaExists) continue;

                // Check __EFMigrationsHistory
                bool historyExists = false;
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = '{t.SchemaName}' AND table_name = '__EFMigrationsHistory'
                    );", conn))
                {
                    historyExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                    _output.WriteLine($"  __EFMigrationsHistory exists: {historyExists}");
                }

                if (historyExists)
                {
                    var migrations = new List<string>();
                    await using (var cmd = new NpgsqlCommand($@"SELECT ""MigrationId"" FROM ""{t.SchemaName}"".""__EFMigrationsHistory"" ORDER BY ""MigrationId"";", conn))
                    await using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            migrations.Add(reader.GetString(0));
                        }
                    }
                    _output.WriteLine($"  Total applied migrations: {migrations.Count}");
                    if (migrations.Count > 0)
                    {
                        _output.WriteLine($"  Last applied migration: {migrations[^1]}");
                        var twentyLMigration = migrations.Find(m => m.Contains("20L") || m.Contains("TwentyL"));
                        _output.WriteLine($"  Contains TwentyL migration: {twentyLMigration ?? "None"}");
                    }
                }

                // Check if TwentyLDistributorProfiles table exists
                bool distProfilesExists = false;
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = '{t.SchemaName}' AND table_name = 'TwentyLDistributorProfiles'
                    );", conn))
                {
                    distProfilesExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                    _output.WriteLine($"  TwentyLDistributorProfiles exists: {distProfilesExists}");
                }

                // Check if any foreign key points to a schema named 'Id'
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT tc.table_name, kcu.column_name, ccu.table_schema AS foreign_schema_name, ccu.table_name AS foreign_table_name
                    FROM information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = '{t.SchemaName}' AND ccu.table_schema = 'Id';", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        _output.WriteLine($"  [ALERT] Invalid FK pointing to 'Id': {reader.GetString(0)}.{reader.GetString(1)} -> {reader.GetString(2)}.{reader.GetString(3)}");
                    }
                }
            }
        }
    }
}
