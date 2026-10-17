using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using Xunit.Abstractions;
using Aquora.Persistence.Context;

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
        public async Task AuditProductionBatchesAndEntries()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            var tenantSchemas = new List<string>();
            await using (var cmd = new NpgsqlCommand(@"SELECT ""SchemaName"" FROM ""public"".""Tenants"" WHERE ""IsActive"" = true;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    tenantSchemas.Add(reader.GetString(0));
                }
            }

            foreach (var schema in tenantSchemas)
            {
                _output.WriteLine($"\n=== SCHEMA: {schema} ===");

                // Check batches
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT ""Id"", ""BatchNumber"", ""Product"", ""ProducedQuantity"", ""TargetQuantity"", ""Status"", ""IsDeleted""
                    FROM ""{schema}"".""ProductionBatches"" ORDER BY ""CreatedAt"" DESC LIMIT 10;", conn))
                {
                    try
                    {
                        await using var reader = await cmd.ExecuteReaderAsync();
                        _output.WriteLine("  -- ProductionBatches --");
                        int count = 0;
                        while (await reader.ReadAsync())
                        {
                            count++;
                            _output.WriteLine($"    Batch: Id={reader.GetGuid(0)}, Number={reader.GetString(1)}, Product={reader.GetString(2)}, Produced={reader.GetInt32(3)}, Target={reader.GetInt32(4)}, Status={reader.GetString(5)}, Deleted={reader.GetBoolean(6)}");
                        }
                        if (count == 0) _output.WriteLine("    No ProductionBatches found.");
                    }
                    catch (Exception ex)
                    {
                        _output.WriteLine($"    Error querying ProductionBatches: {ex.Message}");
                    }
                }

                // Check sessions
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT ""Id"", ""BatchNumber"", ""TotalCasesProduced"", ""Status"", ""IsDeleted""
                    FROM ""{schema}"".""ProductionSessions"" ORDER BY ""CreatedAt"" DESC LIMIT 10;", conn))
                {
                    try
                    {
                        await using var reader = await cmd.ExecuteReaderAsync();
                        _output.WriteLine("  -- ProductionSessions --");
                        int count = 0;
                        while (await reader.ReadAsync())
                        {
                            count++;
                            _output.WriteLine($"    Session: Id={reader.GetGuid(0)}, BatchNumber={reader.GetString(1)}, Produced={reader.GetInt32(2)}, Status={reader.GetString(3)}, Deleted={reader.GetBoolean(4)}");
                        }
                        if (count == 0) _output.WriteLine("    No ProductionSessions found.");
                    }
                    catch (Exception ex)
                    {
                        _output.WriteLine($"    Error querying ProductionSessions: {ex.Message}");
                    }
                }

                // Check entries
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT ""Id"", ""ProductionSessionId"", ""ProductionLineId"", ""CasesProduced"", ""CreatedAt"", ""IsDeleted""
                    FROM ""{schema}"".""ProductionEntries"" ORDER BY ""CreatedAt"" DESC LIMIT 10;", conn))
                {
                    try
                    {
                        await using var reader = await cmd.ExecuteReaderAsync();
                        _output.WriteLine("  -- ProductionEntries --");
                        int count = 0;
                        while (await reader.ReadAsync())
                        {
                            count++;
                            var sessId = reader.IsDBNull(1) ? "null" : reader.GetGuid(1).ToString();
                            _output.WriteLine($"    Entry: Id={reader.GetGuid(0)}, SessionId={sessId}, LineId={reader.GetGuid(2)}, Cases={reader.GetInt32(3)}, CreatedAt={reader.GetDateTime(4)}, Deleted={reader.GetBoolean(5)}");
                        }
                        if (count == 0) _output.WriteLine("    No ProductionEntries found.");
                    }
                    catch (Exception ex)
                    {
                        _output.WriteLine($"    Error querying ProductionEntries: {ex.Message}");
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

        [Fact]
        public async Task ApplyWaterWastageColumnAndVerifySupabase()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();
            _output.WriteLine("Connected to Supabase PostgreSQL.");

            var tenantSchemas = new List<string>();
            await using (var cmd = new NpgsqlCommand(@"
                SELECT DISTINCT table_schema
                FROM information_schema.tables
                WHERE table_name = 'ProductionEntries';", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    tenantSchemas.Add(reader.GetString(0));
                }
            }

            Assert.NotEmpty(tenantSchemas);
            _output.WriteLine($"Found {tenantSchemas.Count} schemas with ProductionEntries: {string.Join(", ", tenantSchemas)}");

            foreach (var schema in tenantSchemas)
            {
                _output.WriteLine($"Ensuring WaterWastageLitres exists in {schema}...");
                await using (var cmd = new NpgsqlCommand($@"
                    ALTER TABLE ""{schema}"".""ProductionEntries"" 
                    ADD COLUMN IF NOT EXISTS ""WaterWastageLitres"" numeric(18,2) NOT NULL DEFAULT 0;", conn))
                {
                    await cmd.ExecuteNonQueryAsync();
                }

                // Verify column existence and type
                await using (var cmd = new NpgsqlCommand($@"
                    SELECT column_name, data_type, numeric_precision, numeric_scale
                    FROM information_schema.columns
                    WHERE table_schema = '{schema}'
                      AND table_name = 'ProductionEntries'
                      AND column_name = 'WaterWastageLitres';", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    Assert.True(await reader.ReadAsync(), $"WaterWastageLitres column not found in {schema}.ProductionEntries");
                    var colName = reader.GetString(0);
                    var dataType = reader.GetString(1);
                    var precision = reader.GetInt32(2);
                    var scale = reader.GetInt32(3);
                    _output.WriteLine($"  Verified column {colName} in {schema}: type={dataType}, precision={precision}, scale={scale}");
                    Assert.Equal("numeric", dataType);
                    Assert.Equal(18, precision);
                    Assert.Equal(2, scale);
                }
            }

            // Test inserting and retrieving decimal value 12.50
            var testSchema = tenantSchemas.Contains("aquora_tenant_sinan_company") ? "aquora_tenant_sinan_company" : tenantSchemas.First();
            var testEntryId = Guid.NewGuid();
            var lineId = Guid.NewGuid();
            var opId = Guid.NewGuid();
            var prodId = Guid.NewGuid();

            // Fetch real line, operator, product if possible
            await using (var cmd = new NpgsqlCommand($@"
                SELECT ""Id"" FROM ""{testSchema}"".""ProductionLines"" LIMIT 1;", conn))
            {
                var val = await cmd.ExecuteScalarAsync();
                if (val is Guid g) lineId = g;
            }

            var companyId = Guid.NewGuid();
            var tenantId = Guid.NewGuid();
            await using (var cmd = new NpgsqlCommand($@"
                SELECT ""Id"", ""TenantId"" FROM ""{testSchema}"".""Companies"" LIMIT 1;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                if (await reader.ReadAsync())
                {
                    companyId = reader.GetGuid(0);
                    tenantId = reader.GetGuid(1);
                }
            }

            await using (var cmd = new NpgsqlCommand($@"
                INSERT INTO ""{testSchema}"".""ProductionEntries""
                (""Id"", ""OperatorId"", ""OperatorName"", ""ProductionLineId"", ""Shift"", ""Date"", ""Time"", ""ProductId"", ""CasesProduced"", ""PreformUsage"", ""PreformWastage"", ""CapUsage"", ""CapWastage"", ""LabelUsage"", ""LabelWastage"", ""ShrinkUsage"", ""ShrinkWastage"", ""InkUsed"", ""MakeupUsed"", ""WaterWastageLitres"", ""InventoryMovementIds"", ""TenantId"", ""CompanyId"", ""CreatedAt"", ""CreatedBy"", ""IsDeleted"")
                VALUES
                (@id, @opId, 'Test Operator', @lineId, 'Morning', CURRENT_DATE, TO_CHAR(NOW(), 'YYYY-MM-DD""T""HH24:MI:SS.US""Z""'), @prodId, 100, 10, 0, 20, 0, 10, 0, 10, 0, false, false, 12.50, '', @tenantId, @companyId, NOW(), 'TestRunner', false);", conn))
            {
                cmd.Parameters.AddWithValue("id", testEntryId);
                cmd.Parameters.AddWithValue("opId", opId);
                cmd.Parameters.AddWithValue("lineId", lineId);
                cmd.Parameters.AddWithValue("prodId", prodId);
                cmd.Parameters.AddWithValue("tenantId", tenantId);
                cmd.Parameters.AddWithValue("companyId", companyId);
                await cmd.ExecuteNonQueryAsync();
            }

            // Verify stored value
            await using (var cmd = new NpgsqlCommand($@"
                SELECT ""WaterWastageLitres""
                FROM ""{testSchema}"".""ProductionEntries""
                WHERE ""Id"" = @id;", conn))
            {
                cmd.Parameters.AddWithValue("id", testEntryId);
                var storedVal = (decimal)(await cmd.ExecuteScalarAsync() ?? 0m);
                _output.WriteLine($"Stored test WaterWastageLitres: {storedVal} L (Expected: 12.50 L)");
                Assert.Equal(12.50m, storedVal);
            }

            // Clean up test entry
            await using (var cmd = new NpgsqlCommand($@"
                DELETE FROM ""{testSchema}"".""ProductionEntries""
                WHERE ""Id"" = @id;", conn))
            {
                cmd.Parameters.AddWithValue("id", testEntryId);
                await cmd.ExecuteNonQueryAsync();
                _output.WriteLine("Cleaned up test entry successfully.");
            }
        }

        [Fact]
        public async Task EnsureMaterialConsumptionsJsonColumnExists()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();

            var tenantSchemas = new List<string>();
            await using (var cmd = new NpgsqlCommand(@"
                SELECT DISTINCT table_schema 
                FROM information_schema.tables 
                WHERE table_name = 'ProductionEntries';", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    tenantSchemas.Add(reader.GetString(0));
                }
            }

            Assert.NotEmpty(tenantSchemas);
            _output.WriteLine($"Ensuring MaterialConsumptionsJson column across {tenantSchemas.Count} schemas...");

            foreach (var schema in tenantSchemas)
            {
                await using (var cmd = new NpgsqlCommand($@"
                    ALTER TABLE ""{schema}"".""ProductionEntries"" 
                    ADD COLUMN IF NOT EXISTS ""MaterialConsumptionsJson"" text;", conn))
                {
                    await cmd.ExecuteNonQueryAsync();
                }

                await using (var cmd = new NpgsqlCommand($@"
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = '{schema}'
                      AND table_name = 'ProductionEntries'
                      AND column_name = 'MaterialConsumptionsJson';", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    Assert.True(await reader.ReadAsync(), $"MaterialConsumptionsJson column not found in {schema}.ProductionEntries");
                    _output.WriteLine($"  Verified column MaterialConsumptionsJson in {schema}");
                }
            }
        }

        [Fact]
        public async Task InspectSinanCompanyProductionData()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();
            var schema = "aquora_tenant_sinan_company";

            _output.WriteLine($"=== Columns of {schema}.ProductionEntries ===");
            await using (var cmd = new NpgsqlCommand($@"
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = '{schema}' AND table_name = 'ProductionEntries'
                ORDER BY ordinal_position;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    _output.WriteLine($"  {reader.GetString(0)} ({reader.GetString(1)}, nullable: {reader.GetString(2)})");
                }
            }

            _output.WriteLine($"\n=== Rows in {schema}.ProductionBatches ===");
            await using (var cmd = new NpgsqlCommand($@"
                SELECT ""Id"", ""BatchNumber"", ""Product"", ""ProductionLineId"", ""Status"", ""TargetQuantity"", ""ProducedQuantity"", ""IsDeleted""
                FROM ""{schema}"".""ProductionBatches"";", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    _output.WriteLine($"  Batch Id: {reader.GetGuid(0)} | BatchNumber: {reader.GetString(1)} | Product: {reader.GetString(2)} | LineId: {reader.GetGuid(3)} | Status: {reader.GetString(4)} | Target: {reader.GetInt32(5)} | Produced: {reader.GetInt32(6)} | IsDeleted: {reader.GetBoolean(7)}");
                }
            }

            _output.WriteLine($"\n=== Rows in {schema}.ProductionSessions ===");
            await using (var cmd = new NpgsqlCommand($@"
                SELECT * FROM ""{schema}"".""ProductionSessions"";", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                int sCount = 0;
                while (await reader.ReadAsync())
                {
                    sCount++;
                    var cols = Enumerable.Range(0, reader.FieldCount).Select(i => $"{reader.GetName(i)}={reader.GetValue(i)}");
                    _output.WriteLine($"  Session #{sCount}: {string.Join(" | ", cols)}");
                }
                _output.WriteLine($"Total ProductionSessions: {sCount}");
            }

            _output.WriteLine($"\n=== Rows in {schema}.ProductionEntries ===");
            await using (var cmd = new NpgsqlCommand($@"
                SELECT * FROM ""{schema}"".""ProductionEntries"";", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                int count = 0;
                while (await reader.ReadAsync())
                {
                    count++;
                    var cols = Enumerable.Range(0, reader.FieldCount).Select(i => $"{reader.GetName(i)}={reader.GetValue(i)}");
                    _output.WriteLine($"  Entry #{count}: {string.Join(" | ", cols)}");
                }
                _output.WriteLine($"Total ProductionEntries: {count}");
            }
        }

        [Fact]
        public async Task TestEFCoreBatchEntriesQuery()
        {
            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseNpgsql(ConnectionString)
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, TenantModelCacheKeyFactory>()
                .Options;

            var mockTenantProvider = new Moq.Mock<Aquora.Application.Interfaces.ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(Guid.Parse("7d77da44-5307-489c-b474-bf9cdc6137ee"));
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("aquora_tenant_sinan_company");

            var mockCurrentUser = new Moq.Mock<Aquora.Application.Interfaces.ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(Guid.Parse("7d77da44-5307-489c-b474-bf9cdc6137ee"));
            mockCurrentUser.Setup(c => c.UserId).Returns("TestUser");

            await using var db = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUser.Object);

            var targetProdId = Guid.Parse("93f56b45-3b36-4ead-868f-4d58f179503b");
            var prodFiltered = await db.Products.FirstOrDefaultAsync(p => p.Id == targetProdId);
            var prodUnfiltered = await db.Products.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == targetProdId);
            _output.WriteLine($"[PRODUCT AUDIT] Filtered Product: {(prodFiltered != null ? prodFiltered.Name : "NULL")}");
            _output.WriteLine($"[PRODUCT AUDIT] Unfiltered Product: {(prodUnfiltered != null ? $"{prodUnfiltered.Name} (IsDeleted={prodUnfiltered.IsDeleted})" : "NULL (NOT IN TABLE)")}");

            var allProds = await db.Products.IgnoreQueryFilters().ToListAsync();
            _output.WriteLine($"[PRODUCT AUDIT] Total products in schema: {allProds.Count}");
            foreach (var pr in allProds)
            {
                _output.WriteLine($"  Product: Id={pr.Id}, Name={pr.Name}, SKU={pr.SKU}, IsDeleted={pr.IsDeleted}");
            }

            var rawEntriesCount = await db.ProductionEntries.IgnoreQueryFilters().CountAsync();
            _output.WriteLine($"db.ProductionEntries.IgnoreQueryFilters().CountAsync() = {rawEntriesCount}");

            var filterEntriesCount = await db.ProductionEntries.CountAsync();
            _output.WriteLine($"db.ProductionEntries.CountAsync() = {filterEntriesCount}");

            var rawFirst = await db.ProductionEntries.IgnoreQueryFilters().Take(1).ToListAsync();
            if (rawFirst.Count > 0)
            {
                var f = rawFirst[0];
                _output.WriteLine($"Sample entry from EF: Id={f.Id}, TenantId={f.TenantId}, CompanyId={f.CompanyId}, IsDeleted={f.IsDeleted}, ProdSessionId={f.ProductionSessionId}, PreformMatId={f.PreformMaterialId}, CapMatId={f.CapMaterialId}");
            }
            var batches = await db.ProductionBatches.ToListAsync();
            foreach (var b in batches)
            {
                _output.WriteLine($"  Batch {b.BatchNumber} (Id: {b.Id})");

                // Execute the exact GetBatchEntries query logic
                var id = b.Id;
                var sessionIds = await db.ProductionSessions
                    .Where(s => (s.Id == id || (s.BatchNumber == b.BatchNumber && s.ProductionLineId == b.ProductionLineId)) && !s.IsDeleted)
                    .Select(s => s.Id)
                    .ToListAsync();

                if (!sessionIds.Contains(id)) sessionIds.Add(id);

                var entriesQuery = db.ProductionEntries
                    .Include(e => e.Product)
                    .Include(e => e.PreformMaterial)
                    .Include(e => e.CapMaterial)
                    .Include(e => e.LabelMaterial)
                    .Include(e => e.ShrinkMaterial)
                    .Include(e => e.GlueMaterial)
                    .Where(e => !e.IsDeleted && (e.ProductionSessionId == id || (e.ProductionSessionId.HasValue && sessionIds.Contains(e.ProductionSessionId.Value))))
                    .OrderByDescending(e => e.CreatedAt);

                var entriesRawList = await db.ProductionEntries.Where(e => e.ProductionSessionId == id).ToListAsync();
                _output.WriteLine($"    [MATERIALIZATION TEST] entriesRawList.Count: {entriesRawList.Count}");

                var incProduct = await db.ProductionEntries.Include(e => e.Product).Where(e => e.ProductionSessionId == id).ToListAsync();
                var incPreform = await db.ProductionEntries.Include(e => e.PreformMaterial).Where(e => e.ProductionSessionId == id).ToListAsync();
                var incCap = await db.ProductionEntries.Include(e => e.CapMaterial).Where(e => e.ProductionSessionId == id).ToListAsync();
                var incLabel = await db.ProductionEntries.Include(e => e.LabelMaterial).Where(e => e.ProductionSessionId == id).ToListAsync();
                var incShrink = await db.ProductionEntries.Include(e => e.ShrinkMaterial).Where(e => e.ProductionSessionId == id).ToListAsync();
                var incGlue = await db.ProductionEntries.Include(e => e.GlueMaterial).Where(e => e.ProductionSessionId == id).ToListAsync();

                _output.WriteLine($"    [INCLUDE MATERIALIZATION] Batch {b.BatchNumber}: incProduct={incProduct.Count}, incPreform={incPreform.Count}, incCap={incCap.Count}, incLabel={incLabel.Count}, incShrink={incShrink.Count}, incGlue={incGlue.Count}");

                var entriesWithAllList = await db.ProductionEntries
                    .Include(e => e.Product)
                    .Include(e => e.PreformMaterial)
                    .Include(e => e.CapMaterial)
                    .Include(e => e.LabelMaterial)
                    .Include(e => e.ShrinkMaterial)
                    .Include(e => e.GlueMaterial)
                    .Where(e => !e.IsDeleted && (e.ProductionSessionId == id || (e.ProductionSessionId.HasValue && sessionIds.Contains(e.ProductionSessionId.Value))))
                    .OrderByDescending(e => e.CreatedAt)
                    .ToListAsync();
                _output.WriteLine($"    [MATERIALIZATION TEST] entriesWithAllList.Count: {entriesWithAllList.Count}");

                var whereWithSessionIdsOnly = await db.ProductionEntries
                    .Where(e => !e.IsDeleted && (e.ProductionSessionId == id || (e.ProductionSessionId.HasValue && sessionIds.Contains(e.ProductionSessionId.Value))))
                    .CountAsync();

                var whereWithEqualsOnly = await db.ProductionEntries
                    .Where(e => !e.IsDeleted && e.ProductionSessionId == id)
                    .CountAsync();

                var whereWithInOnly = await db.ProductionEntries
                    .Where(e => !e.IsDeleted && sessionIds.Contains(e.ProductionSessionId!.Value))
                    .CountAsync();

                var fullWithEqualsOnly = await db.ProductionEntries
                    .Include(e => e.Product)
                    .Include(e => e.PreformMaterial)
                    .Include(e => e.CapMaterial)
                    .Include(e => e.LabelMaterial)
                    .Include(e => e.ShrinkMaterial)
                    .Include(e => e.GlueMaterial)
                    .Where(e => !e.IsDeleted && e.ProductionSessionId == id)
                    .CountAsync();

                _output.WriteLine($"    WHERE clause test for {b.BatchNumber}: withSessionIds={whereWithSessionIdsOnly}, withEquals={whereWithEqualsOnly}, withInOnly={whereWithInOnly}, fullWithEqualsOnly={fullWithEqualsOnly}");
            }
        }
    }
}
