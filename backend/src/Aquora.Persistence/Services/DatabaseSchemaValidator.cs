using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Aquora.Persistence.Context;

namespace Aquora.Persistence.Services
{
    public class DatabaseSchemaValidator
    {
        private readonly ILogger<DatabaseSchemaValidator> _logger;

        public DatabaseSchemaValidator(ILogger<DatabaseSchemaValidator> logger)
        {
            _logger = logger;
        }

        public async Task ValidateSchemaAsync(DbContext dbContext, string schemaName = "public")
        {
            var connection = dbContext.Database.GetDbConnection() as NpgsqlConnection;
            if (connection == null)
            {
                _logger.LogWarning("Schema validation is only supported for PostgreSQL.");
                return;
            }

            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            var model = dbContext.Model;
            var entityTypes = model.GetEntityTypes().Where(e => !e.IsOwned()).ToList();

            var errors = new List<string>();

            foreach (var entityType in entityTypes)
            {
                var tableName = entityType.GetTableName();
                if (tableName == null) continue;

                var expectedSchema = entityType.GetSchema() ?? schemaName;

                // Query postgres for existing columns
                var command = connection.CreateCommand();
                command.CommandText = @"
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = @schema AND table_name = @table;";
                
                command.Parameters.AddWithValue("schema", expectedSchema);
                command.Parameters.AddWithValue("table", tableName);

                var actualColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        actualColumns.Add(reader.GetString(0));
                    }
                }

                if (!actualColumns.Any())
                {
                    errors.Add($"Table {expectedSchema}.{tableName} does not exist in the database.");
                    continue;
                }

                var expectedProperties = entityType.GetProperties().Select(p => p.GetColumnName(Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(tableName, expectedSchema))).ToList();
                
                foreach (var expectedProp in expectedProperties)
                {
                    if (expectedProp != null && !actualColumns.Contains(expectedProp))
                    {
                        errors.Add($"Missing column: {expectedSchema}.{tableName}.{expectedProp}");
                    }
                }

                // Specifically look for RowVersion if it shouldn't be there
                if (actualColumns.Contains("RowVersion") && !expectedProperties.Contains("RowVersion"))
                {
                    errors.Add($"Unexpected orphaned column (RowVersion): {expectedSchema}.{tableName}.RowVersion. This may cause Postgres schema mismatch errors.");
                }
            }

            if (errors.Any())
            {
                var errorMsg = "Database schema validation failed! The Entity Framework model does not match the PostgreSQL database.\n" + string.Join("\n", errors);
                _logger.LogCritical(errorMsg);
                throw new InvalidOperationException(errorMsg);
            }

            _logger.LogInformation("Database schema validation passed for schema: {Schema}", schemaName);
        }
    }
}
