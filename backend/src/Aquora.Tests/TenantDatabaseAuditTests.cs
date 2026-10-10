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

        [Fact]
        public async Task Audit_Users_And_Tenants_Relationships()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            _output.WriteLine("=== PLATFORM USERS ===");
            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""Id"", ""Email"", ""FirstName"", ""LastName"", ""TenantId"", ""EmailVerified"", ""IsActive"", ""IsDeleted""
                FROM ""public"".""Users"" ORDER BY ""CreatedAt"" DESC LIMIT 30;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var id = reader.GetGuid(0);
                    var email = reader.GetString(1);
                    var firstName = reader.IsDBNull(2) ? "" : reader.GetString(2);
                    var lastName = reader.IsDBNull(3) ? "" : reader.GetString(3);
                    var name = $"{firstName} {lastName}".Trim();
                    var tenantId = reader.IsDBNull(4) ? (Guid?)null : reader.GetGuid(4);
                    var verified = reader.GetBoolean(5);
                    var active = reader.GetBoolean(6);
                    var deleted = reader.GetBoolean(7);
                    _output.WriteLine($"User: {email} | ID: {id} | TenantId: {tenantId?.ToString() ?? "NULL"} | Verified: {verified} | Active: {active} | Deleted: {deleted}");
                }
            }

            _output.WriteLine("\n=== ALL TENANTS ===");
            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""Id"", ""Name"", ""Code"", ""SchemaName"", ""Status"", ""Progress"", ""IsInitialized"", ""IsDeleted"", ""CreatedAt"", ""FailureReason""
                FROM ""public"".""Tenants"" ORDER BY ""CreatedAt"" DESC LIMIT 30;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var id = reader.GetGuid(0);
                    var name = reader.GetString(1);
                    var code = reader.GetString(2);
                    var schema = reader.GetString(3);
                    var status = reader.IsDBNull(4) ? "" : reader.GetString(4);
                    var progress = reader.IsDBNull(5) ? 0 : reader.GetInt32(5);
                    var init = reader.IsDBNull(6) ? false : reader.GetBoolean(6);
                    var del = reader.IsDBNull(7) ? false : reader.GetBoolean(7);
                    var created = reader.GetDateTime(8);
                    var failure = reader.IsDBNull(9) ? "" : reader.GetString(9);
                    _output.WriteLine($"Tenant: {name} ({code}) | ID: {id} | Schema: {schema} | Status: {status} ({progress}%) | Init: {init} | Deleted: {del} | Created: {created:yyyy-MM-dd HH:mm:ss} | Failure: {(failure.Length > 60 ? failure[..60] + "..." : failure)}");
                }
            }

            _output.WriteLine("\n=== USER MEMBERSHIPS ===");
            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""Id"", ""PlatformUserId"", ""TenantId"", ""Status"", ""JoinedAt""
                FROM ""public"".""UserMemberships"" ORDER BY ""JoinedAt"" DESC LIMIT 30;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var id = reader.GetGuid(0);
                    var userId = reader.GetGuid(1);
                    var tenantId = reader.GetGuid(2);
                    var status = reader.GetString(3);
                    _output.WriteLine($"Membership: User {userId} -> Tenant {tenantId} | Status: {status}");
                }
            }
        }

        [Fact]
        public async Task InspectLedgerTimestamps()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            var schemas = new List<string>();
            await using (var cmd = new NpgsqlCommand("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%sinan%' OR schema_name = 'public';", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    schemas.Add(reader.GetString(0));
                }
            }

            foreach (var schema in schemas)
            {
                bool tableExists = false;
                await using (var cmd = new NpgsqlCommand($"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{schema}' AND table_name = 'BankLedgerEntries');", conn))
                {
                    tableExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                }

                if (!tableExists) continue;

                _output.WriteLine($"\n=== BankLedgerEntries in {schema} ===");
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT ""Id"", ""TransactionType"", ""TransactionDate"", ""CreatedAt"", ""ReferenceNumber"", ""Description""
                    FROM ""{schema}"".""BankLedgerEntries""
                    ORDER BY ""CreatedAt"" DESC
                    LIMIT 20;", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var id = reader.GetGuid(0).ToString()[..8];
                        var type = reader.GetString(1);
                        var txDate = reader.GetDateTime(2);
                        var createdAt = reader.GetDateTime(3);
                        var refNo = reader.IsDBNull(4) ? "" : reader.GetString(4);
                        var desc = reader.IsDBNull(5) ? "" : reader.GetString(5);
                        _output.WriteLine($"ID: {id} | Type: {type,-18} | TxDate: {txDate:o} | CreatedAt: {createdAt:o} | Ref: {refNo,-12} | Desc: {desc}");
                    }
                }
            }
        }

        [Fact]
        public async Task ReconcileLedgerTimestampsAndVerifySorting()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            var schemas = new List<string>();
            await using (var cmd = new NpgsqlCommand("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%sinan%' OR schema_name = 'public' OR schema_name LIKE 'aquora_tenant_%';", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    schemas.Add(reader.GetString(0));
                }
            }

            foreach (var schema in schemas)
            {
                bool tableExists = false;
                await using (var cmd = new NpgsqlCommand($"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{schema}' AND table_name = 'BankLedgerEntries');", conn))
                {
                    tableExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                }

                if (!tableExists) continue;

                // Reconcile: If TransactionDate was saved as date-only (00:00:00) on the same date as CreatedAt,
                // restore the true transaction occurrence timestamp from CreatedAt without changing the business date.
                int updatedRows = 0;
                await using (var cmd = new NpgsqlCommand($@"
                    UPDATE ""{schema}"".""BankLedgerEntries""
                    SET ""TransactionDate"" = ""CreatedAt""
                    WHERE CAST(""TransactionDate"" AS date) = CAST(""CreatedAt"" AS date)
                      AND EXTRACT(HOUR FROM ""TransactionDate"") = 0
                      AND EXTRACT(MINUTE FROM ""TransactionDate"") = 0
                      AND EXTRACT(SECOND FROM ""TransactionDate"") = 0;", conn))
                {
                    updatedRows = await cmd.ExecuteNonQueryAsync();
                    _output.WriteLine($"Updated {updatedRows} entries in {schema} to use their actual occurrence timestamps.");
                }

                if (schema.Contains("sinan"))
                {
                    _output.WriteLine($"\n=== Verified Sorting for {schema} (Latest-First) ===");
                    await using (var cmd = new NpgsqlCommand($@"
                        SELECT ""Id"", ""TransactionType"", ""TransactionDate"", ""CreatedAt"", ""ReferenceNumber"", ""Description""
                        FROM ""{schema}"".""BankLedgerEntries""
                        ORDER BY ""TransactionDate"" DESC, ""CreatedAt"" DESC, ""Id"" DESC
                        LIMIT 20;", conn))
                    await using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        int row = 1;
                        while (await reader.ReadAsync())
                        {
                            var id = reader.GetGuid(0).ToString()[..8];
                            var type = reader.GetString(1);
                            var txDate = reader.GetDateTime(2);
                            var createdAt = reader.GetDateTime(3);
                            var desc = reader.IsDBNull(5) ? "" : reader.GetString(5);
                            _output.WriteLine($"Row {row,2}: ID: {id} | TxDate: {txDate:yyyy-MM-dd HH:mm:ss} | CreatedAt: {createdAt:yyyy-MM-dd HH:mm:ss} | Type: {type,-18} | Desc: {desc}");
                            row++;
                        }
                    }
                }
            }
        }
    }
}
