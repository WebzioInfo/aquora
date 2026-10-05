using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Npgsql;

class Program
{
    static async Task Main(string[] args)
    {
        string connStr = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        Console.WriteLine("================================================================================");
        Console.WriteLine("AQUZIO LIVE DB — CASE CONFIGURATION MIGRATION AND VERIFICATION");
        Console.WriteLine("================================================================================");

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();
        Console.WriteLine("Connected to PostgreSQL successfully.");

        // 1. Get All Active Tenants
        var tenants = new List<(Guid Id, string Name, string SchemaName)>();
        await using (var cmd = new NpgsqlCommand("SELECT \"Id\", \"Name\", \"SchemaName\" FROM public.\"Tenants\" WHERE \"IsDeleted\" = false;", conn))
        await using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                tenants.Add((reader.GetGuid(0), reader.GetString(1), reader.GetString(2)));
            }
        }

        Console.WriteLine($"Found {tenants.Count} active tenants to update.\n");

        string migrationId = "20261005183000_AddDescriptionAndIndexesToCaseConfigurations";
        string productVersion = "10.0.3";

        foreach (var t in tenants)
        {
            Console.WriteLine($"Processing Tenant '{t.Name}' in schema \"{t.SchemaName}\"...");

            // 1. Ensure Description column exists
            string sqlAddCol = $@"
                ALTER TABLE ""{t.SchemaName}"".""CaseConfigurations"" 
                ADD COLUMN IF NOT EXISTS ""Description"" character varying(500) NULL;";
            await using (var cmd = new NpgsqlCommand(sqlAddCol, conn))
            {
                await cmd.ExecuteNonQueryAsync();
            }

            // 2. Ensure indexes exist
            string sqlIdx1 = $@"
                CREATE INDEX IF NOT EXISTS ""IX_CaseConfigurations_TenantId_ProductId""
                ON ""{t.SchemaName}"".""CaseConfigurations"" (""TenantId"", ""ProductId"");";
            await using (var cmd = new NpgsqlCommand(sqlIdx1, conn))
            {
                await cmd.ExecuteNonQueryAsync();
            }

            string sqlIdx2 = $@"
                CREATE INDEX IF NOT EXISTS ""IX_CaseConfigurations_TenantId_UnitsPerCase""
                ON ""{t.SchemaName}"".""CaseConfigurations"" (""TenantId"", ""UnitsPerCase"");";
            await using (var cmd = new NpgsqlCommand(sqlIdx2, conn))
            {
                await cmd.ExecuteNonQueryAsync();
            }

            // 3. Record migration in __EFMigrationsHistory if table exists
            try
            {
                string sqlMigration = $@"
                    CREATE TABLE IF NOT EXISTS ""{t.SchemaName}"".""__EFMigrationsHistory"" (
                        ""MigrationId"" character varying(150) NOT NULL PRIMARY KEY,
                        ""ProductVersion"" character varying(32) NOT NULL
                    );
                    INSERT INTO ""{t.SchemaName}"".""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                    VALUES ('{migrationId}', '{productVersion}')
                    ON CONFLICT (""MigrationId"") DO NOTHING;";
                await using var cmdMig = new NpgsqlCommand(sqlMigration, conn);
                await cmdMig.ExecuteNonQueryAsync();
                Console.WriteLine($"  ✓ Recorded migration {migrationId} in schema \"{t.SchemaName}\"");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  Note on migration record: {ex.Message}");
            }

            // 4. Verify columns
            await using var cmdCols = new NpgsqlCommand($@"
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = '{t.SchemaName}' AND table_name = 'CaseConfigurations' 
                ORDER BY ordinal_position;", conn);
            var cols = new List<string>();
            await using (var rCols = await cmdCols.ExecuteReaderAsync())
            {
                while (await rCols.ReadAsync())
                {
                    cols.Add($"{rCols.GetString(0)}");
                }
            }
            Console.WriteLine($"  Columns present: {string.Join(", ", cols)}");
        }

        Console.WriteLine("\n================================================================================");
        Console.WriteLine("ALL TENANT SCHEMAS UP TO DATE!");
        Console.WriteLine("================================================================================");
    }
}
