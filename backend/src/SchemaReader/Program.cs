using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Npgsql;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Domain.Entities.Payroll;

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

            string[] tenantSchemas = new[] { "aquora_tenant_fyntric_company", "aquora_tenant_sinan_company" };

            foreach (var schema in tenantSchemas)
            {
                Console.WriteLine($"\nRepairing BankAccounts columns in schema: {schema}...");
                try
                {
                    await using var alterCmd = new NpgsqlCommand($@"
                        ALTER TABLE ""{schema}"".""BankAccounts""
                            ALTER COLUMN ""OpeningBalance"" DROP DEFAULT,
                            ALTER COLUMN ""OpeningBalance"" TYPE numeric USING COALESCE(NULLIF(trim(""OpeningBalance""::text), ''), '0')::numeric,
                            ALTER COLUMN ""OpeningBalance"" SET DEFAULT 0.0,
                            ALTER COLUMN ""OpeningBalance"" SET NOT NULL;

                        ALTER TABLE ""{schema}"".""BankAccounts""
                            ALTER COLUMN ""CurrentBalance"" DROP DEFAULT,
                            ALTER COLUMN ""CurrentBalance"" TYPE numeric USING COALESCE(NULLIF(trim(""CurrentBalance""::text), ''), '0')::numeric,
                            ALTER COLUMN ""CurrentBalance"" SET DEFAULT 0.0,
                            ALTER COLUMN ""CurrentBalance"" SET NOT NULL;
                    ", conn);

                    await alterCmd.ExecuteNonQueryAsync();
                    Console.WriteLine($"Successfully repaired schema: {schema}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error repairing schema {schema}: {ex.Message}");
                }
            }

            Console.WriteLine("\nQuerying information_schema.columns for Verification...");
            await using var cmd = new NpgsqlCommand(@"
                SELECT table_schema, table_name, column_name, data_type, udt_name 
                FROM information_schema.columns 
                ORDER BY table_schema, table_name, ordinal_position;", conn);
            
            await using var reader = await cmd.ExecuteReaderAsync();
            
            var dbColumnDetails = new List<(string schema, string table, string column, string dataType, string udtName)>();
            
            while (await reader.ReadAsync())
            {
                string schema = reader.GetString(0);
                string table = reader.GetString(1);
                string column = reader.GetString(2);
                string dataType = reader.GetString(3);
                string udtName = reader.GetString(4);

                dbColumnDetails.Add((schema, table, column, dataType, udtName));
            }

            Console.WriteLine($"Found {dbColumnDetails.Count} columns in database.\n");

            Console.WriteLine("==========================================");
            Console.WriteLine("AUDITING ALL DECIMAL PROPERTIES IN DOMAIN:");
            Console.WriteLine("==========================================");

            var domainAssembly = typeof(Customer).Assembly;
            var entityTypes = domainAssembly.GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract && t.Namespace != null && t.Namespace.StartsWith("Aquora.Domain.Entities"))
                .ToList();

            int mismatchCount = 0;

            foreach (var entity in entityTypes)
            {
                var decimalProps = entity.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .Where(p => p.CanWrite && (p.PropertyType == typeof(decimal) || p.PropertyType == typeof(decimal?)))
                    .ToList();

                if (!decimalProps.Any()) continue;

                foreach (var prop in decimalProps)
                {
                    string propName = prop.Name;
                    bool isNullable = prop.PropertyType == typeof(decimal?);

                    var matchingDbCols = dbColumnDetails.Where(c => 
                        c.column.Equals(propName, StringComparison.OrdinalIgnoreCase) && 
                        (c.table.Equals(entity.Name, StringComparison.OrdinalIgnoreCase) ||
                         c.table.Equals(entity.Name + "s", StringComparison.OrdinalIgnoreCase) ||
                         c.table.Equals(entity.Name + "es", StringComparison.OrdinalIgnoreCase) ||
                         (entity.Name.EndsWith("y") && c.table.Equals(entity.Name.Substring(0, entity.Name.Length - 1) + "ies", StringComparison.OrdinalIgnoreCase)))
                    ).ToList();

                    if (!matchingDbCols.Any())
                    {
                        var broadMatches = dbColumnDetails.Where(c => c.column.Equals(propName, StringComparison.OrdinalIgnoreCase)).ToList();
                        Console.WriteLine($"[INFO] Entity {entity.Name}.{propName} (decimal{(isNullable ? "?" : "")}) -> Broad matches: {string.Join(", ", broadMatches.Select(m => $"{m.schema}.{m.table}.{m.column} ({m.dataType})"))}");
                    }
                    else
                    {
                        foreach (var match in matchingDbCols)
                        {
                            bool isNumeric = match.dataType.Equals("numeric", StringComparison.OrdinalIgnoreCase) || 
                                            match.dataType.Equals("decimal", StringComparison.OrdinalIgnoreCase) ||
                                            match.dataType.Equals("double precision", StringComparison.OrdinalIgnoreCase) ||
                                            match.dataType.Equals("real", StringComparison.OrdinalIgnoreCase) ||
                                            match.dataType.Equals("integer", StringComparison.OrdinalIgnoreCase) ||
                                            match.dataType.Equals("bigint", StringComparison.OrdinalIgnoreCase);

                            if (!isNumeric)
                            {
                                mismatchCount++;
                                Console.WriteLine($"*** [MISMATCH DETECTED] *** Entity: {entity.Name}, Property: {propName} (decimal{(isNullable ? "?" : "")}), Table: {match.schema}.{match.table}, DB Column: {match.column}, DB DataType: {match.dataType} ({match.udtName})");
                            }
                            else
                            {
                                Console.WriteLine($"[OK] Entity: {entity.Name}.{propName} -> {match.schema}.{match.table}.{match.column} ({match.dataType})");
                            }
                        }
                    }
                }
            }

            Console.WriteLine($"\n==========================================");
            Console.WriteLine($"FINAL VERIFICATION RESULT: Total Mismatches = {mismatchCount}");
            Console.WriteLine($"==========================================");
        }
    }
}
