using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Npgsql;

namespace SchemaReader
{
    class Program
    {
        static async Task Main(string[] args)
        {
            string connectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";
            Console.WriteLine("Connecting to PostgreSQL...");
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            // Find all tenant schemas
            var schemas = new List<string>();
            await using (var schemaCmd = new NpgsqlCommand("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'aquora_tenant_%';", conn))
            await using (var reader = await schemaCmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    schemas.Add(reader.GetString(0));
                }
            }

            Console.WriteLine($"Found {schemas.Count} tenant schemas.");

            foreach (var schema in schemas)
            {
                Console.WriteLine($"\nProcessing schema: {schema}...");
                try
                {
                    var sql = $@"
                    DO $$ 
                    BEGIN
                        IF EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = '{schema}' AND table_name = 'Owners'
                        ) THEN
                            -- 1. Add UserId column
                            ALTER TABLE ""{schema}"".""Owners"" ADD COLUMN IF NOT EXISTS ""UserId"" uuid NULL;

                            -- 2. Create unique filtered index
                            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Owners_TenantId_UserId_{schema}"" 
                                ON ""{schema}"".""Owners"" (""TenantId"", ""UserId"") 
                                WHERE ""UserId"" IS NOT NULL AND ""IsDeleted"" = false;

                            -- 3. Link existing Owners to Users by email
                            UPDATE ""{schema}"".""Owners"" o
                            SET ""UserId"" = u.""Id""
                            FROM public.""Users"" u
                            WHERE o.""UserId"" IS NULL
                              AND o.""TenantId"" = u.""TenantId""
                              AND o.""Email"" IS NOT NULL
                              AND LOWER(TRIM(o.""Email"")) = LOWER(TRIM(u.""Email""))
                              AND u.""IsDeleted"" = false
                              AND o.""IsDeleted"" = false;
                        END IF;

                        IF EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = '{schema}' AND table_name = 'Roles'
                        ) THEN
                            INSERT INTO ""{schema}"".""Roles"" (""Id"", ""Name"", ""Code"", ""TenantId"", ""CreatedAt"", ""CreatedBy"", ""IsDeleted"")
                            SELECT gen_random_uuid(), 'Owner', 'OWNER', COALESCE((SELECT ""TenantId"" FROM ""{schema}"".""Roles"" LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid), CURRENT_TIMESTAMP, 'System', false
                            WHERE NOT EXISTS (
                                SELECT 1 FROM ""{schema}"".""Roles"" WHERE UPPER(""Code"") = 'OWNER' OR UPPER(""Name"") = 'OWNER'
                            );
                        END IF;
                    END $$;";

                    await using var cmd = new NpgsqlCommand(sql, conn);
                    await cmd.ExecuteNonQueryAsync();
                    Console.WriteLine($"Successfully updated Owners table in schema: {schema}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error processing schema {schema}: {ex.Message}");
                }
            }

            // Verify UserId exists in all schemas
            Console.WriteLine("\nVerifying Owners.UserId column existence across schemas:");
            await using (var verifyCmd = new NpgsqlCommand(@"
                SELECT table_schema, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'Owners' AND column_name = 'UserId'
                ORDER BY table_schema;", conn))
            await using (var vReader = await verifyCmd.ExecuteReaderAsync())
            {
                while (await vReader.ReadAsync())
                {
                    Console.WriteLine($"  {vReader.GetString(0)}.{vReader.GetString(1)} ({vReader.GetString(2)}) -> OK");
                }
            }

            Console.WriteLine("\nMigration script complete.");
        }
    }
}
