using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Application.Services
{
    public class ExportService : IExportService
    {
        private readonly ITenantDbContext _context;
        private readonly ITenantProvider _tenantProvider;

        public ExportService(ITenantDbContext context, ITenantProvider tenantProvider)
        {
            _context = context;
            _tenantProvider = tenantProvider;
        }

        public async Task<byte[]> GenerateExportAsync(string format)
        {
            var schemaName = _tenantProvider.TenantSchemaName;
            if (string.IsNullOrWhiteSpace(schemaName) || schemaName.Equals("public", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Cannot perform export on the public schema.");
            }

            if (!string.Equals(format, "SQL", StringComparison.OrdinalIgnoreCase) && 
                !string.Equals(format, "SQL_FULL", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"Unsupported export format: '{format}'. Only 'AQB' and 'SQL' formats are supported.");
            }

            string sqlScript = await GenerateTenantSqlDumpAsync(schemaName);
            return Encoding.UTF8.GetBytes(sqlScript);
        }

        public async Task<string> GenerateTenantSqlDumpAsync(string schemaName)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"-- Aquora ERP Tenant Database Backup (.sql)");
            sb.AppendLine($"-- Schema Name : \"{schemaName}\"");
            sb.AppendLine($"-- Generated   : {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
            sb.AppendLine($"-- Engine      : Aquora Backup Engine v2.5.0");
            sb.AppendLine();

            sb.AppendLine("SET statement_timeout = 0;");
            sb.AppendLine("SET client_encoding = 'UTF8';");
            sb.AppendLine($"SELECT pg_catalog.set_config('search_path', '{schemaName}', false);");
            sb.AppendLine("BEGIN;");
            sb.AppendLine();

            var connStr = _context.Database.GetConnectionString();
            var connType = _context.Database.GetDbConnection().GetType();
            using var connection = (System.Data.Common.DbConnection)Activator.CreateInstance(connType, connStr)!;
            await connection.OpenAsync();

            try
            {
                // 1. Fetch all tables
                var tables = await GetTenantTablesOrderedByDependenciesAsync(schemaName);
                
                // 2. Drop existing tables safely
                foreach (var table in tables)
                {
                    if (table.Equals("BackupHistories", StringComparison.OrdinalIgnoreCase) ||
                        table.Equals("RestoreHistories", StringComparison.OrdinalIgnoreCase)) continue;
                    sb.AppendLine($"DROP TABLE IF EXISTS \"{schemaName}\".\"{table}\" CASCADE;");
                }
                sb.AppendLine();

                // 3. Create Tables DDL
                foreach (var table in tables)
                {
                    if (table.Equals("BackupHistories", StringComparison.OrdinalIgnoreCase) ||
                        table.Equals("RestoreHistories", StringComparison.OrdinalIgnoreCase)) continue;

                    sb.AppendLine($"-- Table: \"{table}\"");
                    sb.AppendLine($"CREATE TABLE \"{schemaName}\".\"{table}\" (");

                    using (var cmd = connection.CreateCommand())
                    {
                        cmd.CommandText = @"
                            SELECT 
                                column_name, 
                                data_type, 
                                character_maximum_length, 
                                is_nullable, 
                                column_default,
                                udt_name
                            FROM information_schema.columns 
                            WHERE table_schema = @schemaName AND table_name = @tableName
                            ORDER BY ordinal_position;";

                        var p1 = cmd.CreateParameter(); p1.ParameterName = "@schemaName"; p1.Value = schemaName; cmd.Parameters.Add(p1);
                        var p2 = cmd.CreateParameter(); p2.ParameterName = "@tableName"; p2.Value = table; cmd.Parameters.Add(p2);

                        var colDefs = new List<string>();
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var colName = reader.GetString(0);
                                var dataType = reader.GetString(1);
                                var charLen = reader.IsDBNull(2) ? (int?)null : reader.GetInt32(2);
                                var isNullable = reader.GetString(3);
                                var colDefault = reader.IsDBNull(4) ? null : reader.GetString(4);
                                var udtName = reader.GetString(5);

                                string typeStr = dataType.ToUpper() switch
                                {
                                    "CHARACTER VARYING" => charLen.HasValue ? $"VARCHAR({charLen.Value})" : "TEXT",
                                    "USER-DEFINED" => $"\"{udtName}\"",
                                    "ARRAY" => "text[]",
                                    _ => dataType.ToUpper()
                                };

                                string colDef = $"    \"{colName}\" {typeStr}";
                                if (colDefault != null && !colDefault.StartsWith("nextval"))
                                {
                                    colDef += $" DEFAULT {colDefault}";
                                }
                                if (isNullable == "NO")
                                {
                                    colDef += " NOT NULL";
                                }
                                colDefs.Add(colDef);
                            }
                        } // reader is closed & disposed HERE
                        sb.AppendLine(string.Join(",\n", colDefs));
                    }
                    sb.AppendLine(");");
                    sb.AppendLine();
                }

                // 4. Data Inserts
                foreach (var table in tables)
                {
                    if (table.Equals("BackupHistories", StringComparison.OrdinalIgnoreCase) ||
                        table.Equals("RestoreHistories", StringComparison.OrdinalIgnoreCase)) continue;

                    sb.AppendLine($"-- Data for \"{table}\"");
                    using (var cmd = connection.CreateCommand())
                    {
                        cmd.CommandText = $"SELECT * FROM \"{schemaName}\".\"{table}\"";
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var columns = new List<string>();
                                var values = new List<string>();

                                for (int i = 0; i < reader.FieldCount; i++)
                                {
                                    columns.Add($"\"{reader.GetName(i)}\"");

                                    if (reader.IsDBNull(i))
                                    {
                                        values.Add("NULL");
                                    }
                                    else
                                    {
                                        var type = reader.GetFieldType(i);
                                        var val = reader.GetValue(i);

                                        if (type == typeof(string) || type == typeof(Guid) || type == typeof(DateTime))
                                        {
                                            values.Add($"'{val.ToString()?.Replace("'", "''")}'");
                                        }
                                        else if (type == typeof(bool))
                                        {
                                            values.Add((bool)val ? "TRUE" : "FALSE");
                                        }
                                        else if (type == typeof(byte[]))
                                        {
                                            values.Add($"'\\x{Convert.ToHexString((byte[])val)}'");
                                        }
                                        else
                                        {
                                            values.Add(val.ToString()!);
                                        }
                                    }
                                }

                                sb.AppendLine($"INSERT INTO \"{schemaName}\".\"{table}\" ({string.Join(", ", columns)}) VALUES ({string.Join(", ", values)});");
                            }
                        } // reader is closed & disposed HERE
                    }
                    sb.AppendLine();
                }

                // 5. Sequences Reset
                var sequences = await GetTenantSequencesAsync(schemaName);
                foreach (var seq in sequences)
                {
                    sb.AppendLine($"SELECT setval('\"{schemaName}\".\"{seq}\"', (SELECT COALESCE(MAX(id), 1) FROM \"{schemaName}\".\"{seq.Replace("_id_seq", "")}\"), true);");
                }
                sb.AppendLine();

                // 6. Constraints & Primary/Foreign Keys
                foreach (var table in tables)
                {
                    if (table.Equals("BackupHistories", StringComparison.OrdinalIgnoreCase) ||
                        table.Equals("RestoreHistories", StringComparison.OrdinalIgnoreCase)) continue;

                    using (var cmd = connection.CreateCommand())
                    {
                        cmd.CommandText = @"
                            SELECT 
                                tc.constraint_name, 
                                tc.constraint_type,
                                kcu.column_name,
                                ccu.table_name AS foreign_table_name,
                                ccu.column_name AS foreign_column_name
                            FROM information_schema.table_constraints AS tc
                            JOIN information_schema.key_column_usage AS kcu
                              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                            LEFT JOIN information_schema.constraint_column_usage AS ccu
                              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
                            WHERE tc.table_schema = @schemaName AND tc.table_name = @tableName;";

                        var p1 = cmd.CreateParameter(); p1.ParameterName = "@schemaName"; p1.Value = schemaName; cmd.Parameters.Add(p1);
                        var p2 = cmd.CreateParameter(); p2.ParameterName = "@tableName"; p2.Value = table; cmd.Parameters.Add(p2);

                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var cName = reader.GetString(0);
                                var cType = reader.GetString(1);
                                var colName = reader.GetString(2);

                                if (cType == "PRIMARY KEY")
                                {
                                    sb.AppendLine($"ALTER TABLE ONLY \"{schemaName}\".\"{table}\" ADD CONSTRAINT \"{cName}\" PRIMARY KEY (\"{colName}\");");
                                }
                                else if (cType == "FOREIGN KEY" && !reader.IsDBNull(3) && !reader.IsDBNull(4))
                                {
                                    var fTable = reader.GetString(3);
                                    var fCol = reader.GetString(4);
                                    sb.AppendLine($"ALTER TABLE ONLY \"{schemaName}\".\"{table}\" ADD CONSTRAINT \"{cName}\" FOREIGN KEY (\"{colName}\") REFERENCES \"{schemaName}\".\"{fTable}\"(\"{fCol}\") ON DELETE CASCADE;");
                                }
                            }
                        } // reader is closed & disposed HERE
                    }
                }
                sb.AppendLine();

                sb.AppendLine("COMMIT;");
                return sb.ToString();
            }
            finally { }
        }

        private async Task<List<string>> GetTenantTablesOrderedByDependenciesAsync(string schemaName)
        {
            var tables = new List<string>();
            var connection = _context.Database.GetDbConnection();
            bool wasClosed = connection.State == ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();

            try
            {
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = @schemaName 
                          AND table_type = 'BASE TABLE'
                          AND table_name NOT LIKE '__EF%';";
                    
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@schemaName";
                    p.Value = schemaName;
                    cmd.Parameters.Add(p);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            tables.Add(reader.GetString(0));
                        }
                    } // reader is closed & disposed HERE
                }
                return tables;
            }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }
        }

        private async Task<List<string>> GetTenantSequencesAsync(string schemaName)
        {
            var sequences = new List<string>();
            var connection = _context.Database.GetDbConnection();
            bool wasClosed = connection.State == ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();

            try
            {
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT sequence_name 
                        FROM information_schema.sequences 
                        WHERE sequence_schema = @schemaName;";
                    
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@schemaName";
                    p.Value = schemaName;
                    cmd.Parameters.Add(p);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            sequences.Add(reader.GetString(0));
                        }
                    } // reader is closed & disposed HERE
                }
            }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }
            return sequences;
        }
    }
}
