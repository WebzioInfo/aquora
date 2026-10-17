using System;
using System.Threading.Tasks;
using Npgsql;

class Program
{
    static async Task Main(string[] args)
    {
        string connStr = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        string sql = @"
            SELECT table_schema, ""Category"", ""Name"", ""Unit"", ""BaseUnit""
            FROM information_schema.tables t
            CROSS JOIN LATERAL (
                SELECT ""Category"", ""Name"", ""Unit"", ""BaseUnit""
                FROM information_schema.columns
                WHERE table_name = 'RawMaterials'
                LIMIT 0
            ) c
            WHERE table_name = 'RawMaterials' AND table_schema LIKE 'aquora_tenant_%';";

        // Query directly using union over tenant schemas
        string listSchemasSql = @"
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'aquora_tenant_%';";

        await using var schemaCmd = new NpgsqlCommand(listSchemasSql, conn);
        await using var schemaReader = await schemaCmd.ExecuteReaderAsync();
        var schemas = new System.Collections.Generic.List<string>();
        while (await schemaReader.ReadAsync())
        {
            schemas.Add(schemaReader.GetString(0));
        }
        await schemaReader.CloseAsync();

        Console.WriteLine("================================================================================");
        Console.WriteLine("Found tenant schemas: " + string.Join(", ", schemas));
        Console.WriteLine("================================================================================");

        foreach (var s in schemas)
        {
            try
            {
                var q = $@"SELECT DISTINCT ""Category"", ""Unit"", ""BaseUnit"", COUNT(*) as cnt 
                           FROM ""{s}"".""RawMaterials"" 
                           WHERE ""IsDeleted"" = false 
                           GROUP BY ""Category"", ""Unit"", ""BaseUnit"";";
                await using var cmd = new NpgsqlCommand(q, conn);
                await using var r = await cmd.ExecuteReaderAsync();
                Console.WriteLine($"Schema: {s}");
                while (await r.ReadAsync())
                {
                    Console.WriteLine($"  Category: '{r["Category"]}', Unit: '{r["Unit"]}', BaseUnit: '{r["BaseUnit"]}', Count: {r["cnt"]}");
                }
                await r.CloseAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Schema {s} error: {ex.Message}");
            }
        }
    }
}
