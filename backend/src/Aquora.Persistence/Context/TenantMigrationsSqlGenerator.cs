using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure.Internal;
using Npgsql.EntityFrameworkCore.PostgreSQL.Migrations;

namespace Aquora.Persistence.Context
{
    #pragma warning disable EF1001 // Internal EF Core API usage
    public class TenantMigrationsSqlGenerator : NpgsqlMigrationsSqlGenerator
    {
        private readonly ICurrentDbContext _currentDbContext;

        public TenantMigrationsSqlGenerator(
            MigrationsSqlGeneratorDependencies dependencies,
            INpgsqlSingletonOptions npgsqlSingletonOptions,
            ICurrentDbContext currentDbContext)
            : base(dependencies, npgsqlSingletonOptions)
        {
            _currentDbContext = currentDbContext;
        }

        public override IReadOnlyList<MigrationCommand> Generate(
            IReadOnlyList<MigrationOperation> operations,
            IModel? model,
            MigrationsSqlGenerationOptions options)
        {
            string? schema = null;
            if (_currentDbContext.Context is TenantDbContext tenantContext)
            {
                schema = tenantContext.SchemaName;
            }

            if (!string.IsNullOrWhiteSpace(schema) && schema != "public")
            {
                foreach (var operation in operations)
                {
                    RewriteSchema(operation, schema);
                }
            }
            
            var commands = base.Generate(operations, model, options);
            
            // Post-process the generated SQL commands to automatically enforce "IF EXISTS" and "IF NOT EXISTS"
            foreach (var cmd in commands)
            {
                var sql = cmd.CommandText;
                if (string.IsNullOrWhiteSpace(sql)) continue;

                if (sql.Contains("__EFMigrationsHistory"))
                {
                    // Skip post-processing migrations history table commands, since NpgsqlHistoryRepository
                    // already does custom post-processing which will double-up "IF NOT EXISTS" if we modify it.
                    continue;
                }

                var originalSql = sql;

                // 1. ADD COLUMN -> ADD COLUMN IF NOT EXISTS
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bADD\s+(?:COLUMN\s+)?(?!\s*IF\s+NOT\s+EXISTS\b)\s*""([^""]+)""", "ADD COLUMN IF NOT EXISTS \"$1\"", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                // 2. DROP COLUMN -> DROP COLUMN IF EXISTS
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bDROP\s+COLUMN\b(?!\s*IF\s+EXISTS\b)\s*""([^""]+)""", "DROP COLUMN IF EXISTS \"$1\"", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                // 3. DROP CONSTRAINT -> DROP CONSTRAINT IF EXISTS
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bDROP\s+CONSTRAINT\b(?!\s*IF\s+EXISTS\b)\s*""([^""]+)""", "DROP CONSTRAINT IF EXISTS \"$1\"", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                // 4. CREATE TABLE -> CREATE TABLE IF NOT EXISTS
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bCREATE\s+TABLE\b(?!\s*IF\s+NOT\s+EXISTS\b)", "CREATE TABLE IF NOT EXISTS", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                // 5. DROP TABLE -> DROP TABLE IF EXISTS
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bDROP\s+TABLE\b(?!\s*IF\s+EXISTS\b)", "DROP TABLE IF EXISTS", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                // 6. CREATE INDEX -> CREATE INDEX IF NOT EXISTS
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bCREATE\s+UNIQUE\s+INDEX\b(?!\s*IF\s+NOT\s+EXISTS\b)", "CREATE UNIQUE INDEX IF NOT EXISTS", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bCREATE\s+INDEX\b(?!\s*IF\s+NOT\s+EXISTS\b)", "CREATE INDEX IF NOT EXISTS", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                // 7. DROP INDEX -> DROP INDEX IF EXISTS
                sql = System.Text.RegularExpressions.Regex.Replace(sql, @"\bDROP\s+INDEX\b(?!\s*IF\s+EXISTS\b)", "DROP INDEX IF EXISTS", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (sql != originalSql)
                {
                    bool setSuccessful = false;
                    
                    // 1. Try to set on MigrationCommand itself first
                    var type = typeof(MigrationCommand);
                    while (type != null && !setSuccessful)
                    {
                        var fields = type.GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                        foreach (var f in fields)
                        {
                            if (f.FieldType == typeof(string) && (f.Name.ToLower().Contains("text") || f.Name.Contains("BackingField")))
                            {
                                f.SetValue(cmd, sql);
                                setSuccessful = true;
                                break;
                            }
                        }
                        type = type.BaseType;
                    }

                    // 2. If not successful, set on private _relationalCommand field inside MigrationCommand
                    if (!setSuccessful)
                    {
                        var relationalCommandField = typeof(MigrationCommand).GetField("_relationalCommand", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                        if (relationalCommandField != null)
                        {
                            var relationalCmd = relationalCommandField.GetValue(cmd);
                            if (relationalCmd != null)
                            {
                                var cmdType = relationalCmd.GetType();
                                while (cmdType != null && !setSuccessful)
                                {
                                    var fields = cmdType.GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                                    foreach (var f in fields)
                                    {
                                        if (f.FieldType == typeof(string) && (f.Name.ToLower().Contains("text") || f.Name.Contains("BackingField")))
                                        {
                                            f.SetValue(relationalCmd, sql);
                                            setSuccessful = true;
                                            break;
                                        }
                                    }
                                    cmdType = cmdType.BaseType;
                                }
                            }
                        }
                    }

                    if (!setSuccessful)
                    {
                    }
                }
            }

            return commands;
        }

        private static readonly HashSet<string> PlatformTables = new HashSet<string>(System.StringComparer.OrdinalIgnoreCase)
        {
            "Tenants",
            "Users",
            "TenantDomains"
        };

        private void RewriteSchema(MigrationOperation operation, string schema)
        {
            switch (operation)
            {
                case CreateTableOperation createTable:
                    if (createTable.Schema == "public" || string.IsNullOrEmpty(createTable.Schema))
                        createTable.Schema = schema;
                    foreach (var fk in createTable.ForeignKeys)
                    {
                        if (fk.Schema == "public" || string.IsNullOrEmpty(fk.Schema))
                            fk.Schema = schema;
                        
                        // Keep platform tables in public schema
                        if (PlatformTables.Contains(fk.PrincipalTable))
                        {
                            fk.PrincipalSchema = "public";
                        }
                        else if (fk.PrincipalSchema == "public" || string.IsNullOrEmpty(fk.PrincipalSchema))
                        {
                            fk.PrincipalSchema = schema;
                        }
                    }
                    foreach (var uc in createTable.UniqueConstraints)
                    {
                        if (uc.Schema == "public" || string.IsNullOrEmpty(uc.Schema))
                            uc.Schema = schema;
                    }
                    if (createTable.PrimaryKey != null)
                    {
                        if (createTable.PrimaryKey.Schema == "public" || string.IsNullOrEmpty(createTable.PrimaryKey.Schema))
                            createTable.PrimaryKey.Schema = schema;
                    }
                    break;

                case DropTableOperation dropTable:
                    if (dropTable.Schema == "public" || string.IsNullOrEmpty(dropTable.Schema))
                        dropTable.Schema = schema;
                    break;

                case AddColumnOperation addColumn:
                    if (addColumn.Schema == "public" || string.IsNullOrEmpty(addColumn.Schema))
                        addColumn.Schema = schema;
                    break;

                case DropColumnOperation dropColumn:
                    if (dropColumn.Schema == "public" || string.IsNullOrEmpty(dropColumn.Schema))
                        dropColumn.Schema = schema;
                    break;

                case AlterColumnOperation alterColumn:
                    if (alterColumn.Schema == "public" || string.IsNullOrEmpty(alterColumn.Schema))
                        alterColumn.Schema = schema;
                    break;

                case RenameTableOperation renameTable:
                    if (renameTable.Schema == "public" || string.IsNullOrEmpty(renameTable.Schema))
                        renameTable.Schema = schema;
                    if (renameTable.NewSchema == "public" || string.IsNullOrEmpty(renameTable.NewSchema))
                        renameTable.NewSchema = schema;
                    break;

                case RenameColumnOperation renameColumn:
                    if (renameColumn.Schema == "public" || string.IsNullOrEmpty(renameColumn.Schema))
                        renameColumn.Schema = schema;
                    break;

                case CreateIndexOperation createIndex:
                    if (createIndex.Schema == "public" || string.IsNullOrEmpty(createIndex.Schema))
                        createIndex.Schema = schema;
                    break;

                case DropIndexOperation dropIndex:
                    if (dropIndex.Schema == "public" || string.IsNullOrEmpty(dropIndex.Schema))
                        dropIndex.Schema = schema;
                    break;

                case AddForeignKeyOperation addFk:
                    if (addFk.Schema == "public" || string.IsNullOrEmpty(addFk.Schema))
                        addFk.Schema = schema;
                    
                    if (PlatformTables.Contains(addFk.PrincipalTable))
                    {
                        addFk.PrincipalSchema = "public";
                    }
                    else if (addFk.PrincipalSchema == "public" || string.IsNullOrEmpty(addFk.PrincipalSchema))
                    {
                        addFk.PrincipalSchema = schema;
                    }
                    break;

                case DropForeignKeyOperation dropFk:
                    if (dropFk.Schema == "public" || string.IsNullOrEmpty(dropFk.Schema))
                        dropFk.Schema = schema;
                    break;

                case AddUniqueConstraintOperation addUc:
                    if (addUc.Schema == "public" || string.IsNullOrEmpty(addUc.Schema))
                        addUc.Schema = schema;
                    break;

                case DropUniqueConstraintOperation dropUc:
                    if (dropUc.Schema == "public" || string.IsNullOrEmpty(dropUc.Schema))
                        dropUc.Schema = schema;
                    break;

                case AddPrimaryKeyOperation addPk:
                    if (addPk.Schema == "public" || string.IsNullOrEmpty(addPk.Schema))
                        addPk.Schema = schema;
                    break;

                case DropPrimaryKeyOperation dropPk:
                    if (dropPk.Schema == "public" || string.IsNullOrEmpty(dropPk.Schema))
                        dropPk.Schema = schema;
                    break;

                case InsertDataOperation insertData:
                    if (insertData.Schema == "public" || string.IsNullOrEmpty(insertData.Schema))
                        insertData.Schema = schema;
                    break;

                case UpdateDataOperation updateData:
                    if (updateData.Schema == "public" || string.IsNullOrEmpty(updateData.Schema))
                        updateData.Schema = schema;
                    break;

                case DeleteDataOperation deleteData:
                    if (deleteData.Schema == "public" || string.IsNullOrEmpty(deleteData.Schema))
                        deleteData.Schema = schema;
                    break;
            }
        }
    }
    #pragma warning restore EF1001
}
