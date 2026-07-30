using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Npgsql;

namespace SchemaReader
{
    class Program
    {
        static async Task Main(string[] args)
        {
            string connectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            await using var cmd = new NpgsqlCommand(@"
                SELECT table_name, column_name 
                FROM information_schema.columns 
                ORDER BY table_schema, table_name, ordinal_position;", conn);
            
            await using var reader = await cmd.ExecuteReaderAsync();
            
            var dbSchema = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            
            while (await reader.ReadAsync())
            {
                string tableName = reader.GetString(0);
                string columnName = reader.GetString(1);
                
                if (!dbSchema.ContainsKey(tableName))
                    dbSchema[tableName] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    
                dbSchema[tableName].Add(columnName);
            }
            
            Console.WriteLine("Global Schema Audit");
            Console.WriteLine("===================");
            
            // Load Domain Assembly
            var domainAssembly = Assembly.LoadFrom(@"..\Aquora.Domain\bin\Debug\net10.0\Aquora.Domain.dll");
            var entities = domainAssembly.GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract && t.Namespace == "Aquora.Domain.Entities")
                .ToList();
                
            foreach (var entity in entities)
            {
                // Simple pluralization for table names
                string tableName = entity.Name + "s";
                if (entity.Name.EndsWith("y")) tableName = entity.Name.Substring(0, entity.Name.Length - 1) + "ies";
                if (entity.Name.EndsWith("s") || entity.Name.EndsWith("x") || entity.Name.EndsWith("ch")) tableName = entity.Name + "es";
                if (entity.Name == "RawMaterial") tableName = "RawMaterials"; // custom overrides if needed
                
                if (!dbSchema.ContainsKey(tableName))
                {
                    // Maybe singular table name? Or different schema? 
                    // Let's just try both or skip if not found
                    if (dbSchema.ContainsKey(entity.Name)) tableName = entity.Name;
                    else
                    {
                        Console.WriteLine($"[SKIPPED] Cannot find table for entity {entity.Name} (Tried: {tableName})");
                        continue;
                    }
                }
                
                var entityProperties = entity.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                                             .Where(p => p.CanWrite) // ignore computed getters
                                             .ToList();
                                             
                var dbColumns = dbSchema[tableName];
                
                bool hasMismatch = false;
                foreach (var prop in entityProperties)
                {
                    // Ignore navigation properties (simple heuristic: if it's a generic collection or another entity)
                    if (prop.PropertyType.IsGenericType && prop.PropertyType.GetGenericTypeDefinition() == typeof(ICollection<>))
                        continue;
                    if (entities.Contains(prop.PropertyType))
                        continue;
                        
                    if (!dbColumns.Contains(prop.Name))
                    {
                        if (!hasMismatch)
                        {
                            Console.WriteLine($"\n[MISMATCH FOUND] Entity: {entity.Name} (Table: {tableName})");
                            hasMismatch = true;
                        }
                        Console.WriteLine($"  -> Property '{prop.Name}' exists in C# but NOT in PostgreSQL database.");
                    }
                }
            }
        }
    }
}
