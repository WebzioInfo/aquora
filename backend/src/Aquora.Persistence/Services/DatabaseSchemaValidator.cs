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
            var connStr = dbContext.Database.GetConnectionString();
            if (string.IsNullOrWhiteSpace(connStr))
            {
                _logger.LogWarning("Schema validation requires a valid PostgreSQL connection string.");
                return;
            }

            using var connection = new NpgsqlConnection(connStr);
            await connection.OpenAsync();

            var model = dbContext.Model;
            var entityTypes = model.GetEntityTypes().Where(e => !e.IsOwned()).ToList();

            var errors = new List<string>();

            foreach (var entityType in entityTypes)
            {
                var tableName = entityType.GetTableName();
                if (tableName == null) continue;

                var entitySchema = entityType.GetSchema();
                var expectedSchema = (entitySchema == "public" && (tableName == "Tenants" || tableName == "Users" || tableName == "TenantDomains"))
                    ? "public"
                    : schemaName;

                // Query postgres for existing columns
                var command = connection.CreateCommand();
                command.CommandText = @"
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE LOWER(table_schema) = LOWER(@schema) AND LOWER(table_name) = LOWER(@table);";
                
                command.Parameters.AddWithValue("schema", expectedSchema);
                command.Parameters.AddWithValue("table", tableName);

                var actualColumns = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        actualColumns[reader.GetString(0)] = reader.GetString(1);
                    }
                }

                if (!actualColumns.Any())
                {
                    _logger.LogInformation("[SCHEMA AUTO-REPAIR] Table {Schema}.{Table} is missing. Attempting automatic table creation...", expectedSchema, tableName);
                    await AutoRepairTableAsync(connection, expectedSchema, tableName);

                    // Re-query postgres for existing columns after repair
                    actualColumns.Clear();
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            actualColumns[reader.GetString(0)] = reader.GetString(1);
                        }
                    }

                    if (!actualColumns.Any())
                    {
                        errors.Add($"Table {expectedSchema}.{tableName} does not exist in the database.");
                        continue;
                    }
                }

                if (tableName.Equals("BankLedgerEntries", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        using var alterCmd = connection.CreateCommand();
                        alterCmd.CommandText = $@"ALTER TABLE ""{expectedSchema}"".""BankLedgerEntries"" ALTER COLUMN ""BankAccountId"" DROP NOT NULL;";
                        await alterCmd.ExecuteNonQueryAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR DROP NOT NULL WARN] Failed to drop NOT NULL constraint on {Schema}.BankLedgerEntries.BankAccountId: {Message}", expectedSchema, ex.Message);
                    }
                }

                var storeObject = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(tableName, expectedSchema);
                var expectedProperties = entityType.GetProperties()
                    .Select(p => new
                    {
                        Property = p,
                        Column = p.GetColumnName(storeObject)
                    })
                    .Where(p => p.Column != null)
                    .ToList();
                
                foreach (var expectedProp in expectedProperties)
                {
                    if (expectedProp.Column != null && !actualColumns.ContainsKey(expectedProp.Column))
                    {
                        _logger.LogInformation("[SCHEMA AUTO-REPAIR] Column {Schema}.{Table}.{Column} is missing. Attempting automatic column addition...", expectedSchema, tableName, expectedProp.Column);
                        await AutoRepairColumnAsync(connection, expectedSchema, tableName, expectedProp.Column, expectedProp.Property.ClrType);
                        actualColumns[expectedProp.Column] = GetExpectedPostgresDataType(expectedProp.Property.ClrType);
                    }
                    else if (expectedProp.Column != null &&
                             !ColumnTypeMatches(expectedProp.Property.ClrType, actualColumns[expectedProp.Column]))
                    {
                        _logger.LogInformation(
                            "[SCHEMA AUTO-REPAIR] Column {Schema}.{Table}.{Column} has PostgreSQL type {ActualType}, but EF expects {ExpectedType}. Attempting type repair...",
                            expectedSchema,
                            tableName,
                            expectedProp.Column,
                            actualColumns[expectedProp.Column],
                            GetExpectedPostgresDataType(expectedProp.Property.ClrType));

                        var repaired = await AutoRepairColumnTypeAsync(connection, expectedSchema, tableName, expectedProp.Column, expectedProp.Property.ClrType);
                        if (repaired)
                        {
                            actualColumns[expectedProp.Column] = GetExpectedPostgresDataType(expectedProp.Property.ClrType);
                        }
                        else
                        {
                            errors.Add($"Column {expectedSchema}.{tableName}.{expectedProp.Column} has PostgreSQL type {actualColumns[expectedProp.Column]}, but EF expects {GetExpectedPostgresDataType(expectedProp.Property.ClrType)}.");
                        }
                    }
                }

                if (tableName.Equals("BankLedgerEntries", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        using var updateCmd = connection.CreateCommand();
                        updateCmd.CommandText = $@"
                            UPDATE ""{expectedSchema}"".""BankLedgerEntries"" 
                            SET ""LedgerAccountType"" = CASE 
                                WHEN ""CashBookId"" IS NOT NULL THEN 'CashBook' 
                                ELSE 'BankAccount' 
                            END 
                            WHERE ""LedgerAccountType"" IS NULL;";
                        await updateCmd.ExecuteNonQueryAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR BACKFILL WARN] Failed to backfill LedgerAccountType in {Schema}.BankLedgerEntries: {Message}", expectedSchema, ex.Message);
                    }
                }

                // Specifically look for RowVersion if it shouldn't be there
                if (actualColumns.ContainsKey("RowVersion") && !expectedProperties.Any(p => p.Column == "RowVersion"))
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

        private async Task AutoRepairTableAsync(NpgsqlConnection connection, string schema, string table)
        {
            try
            {
                using var cmd = connection.CreateCommand();
                if (table.Equals("SimpleExpenses", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""SimpleExpenses"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""ExpenseNumber"" text NOT NULL,
                            ""ExpenseDate"" timestamp with time zone NOT NULL,
                            ""Category"" text NOT NULL,
                            ""Vendor"" text NULL,
                            ""Description"" text NOT NULL,
                            ""Amount"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentMethod"" text NOT NULL DEFAULT 'Cash',
                            ""BankAccountId"" uuid NULL,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("BankAccounts", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""BankAccounts"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""BankName"" text NOT NULL,
                            ""AccountName"" text NOT NULL,
                            ""AccountNumber"" text NOT NULL,
                            ""AccountType"" text NOT NULL DEFAULT 'Current',
                            ""Branch"" text NULL,
                            ""IFSC"" text NULL,
                            ""OpeningBalance"" numeric NOT NULL DEFAULT 0.0,
                            ""CurrentBalance"" numeric NOT NULL DEFAULT 0.0,
                            ""Notes"" text NULL,
                            ""Status"" text NOT NULL DEFAULT 'Active',
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("Owners", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""Owners"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""Name"" text NOT NULL,
                            ""Phone"" text NOT NULL,
                            ""Email"" text NULL,
                            ""OwnershipPercentage"" numeric NOT NULL DEFAULT 0.0,
                            ""InitialInvestment"" numeric NOT NULL DEFAULT 0.0,
                            ""CurrentInvestment"" numeric NOT NULL DEFAULT 0.0,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("OwnerInvestmentTransactions", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""OwnerInvestmentTransactions"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""OwnerId"" uuid NOT NULL,
                            ""TransactionDate"" timestamp with time zone NOT NULL,
                            ""Amount"" numeric NOT NULL DEFAULT 0.0,
                            ""TransactionType"" text NOT NULL DEFAULT 'Investment',
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("BankLedgerEntries", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""BankLedgerEntries"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""BankAccountId"" uuid NULL,
                            ""CashBookId"" uuid NULL,
                            ""LedgerAccountType"" text NOT NULL DEFAULT 'BankAccount',
                            ""TransactionDate"" timestamp with time zone NOT NULL,
                            ""ReferenceNumber"" text NOT NULL,
                            ""TransactionType"" text NOT NULL,
                            ""Description"" text NOT NULL,
                            ""Debit"" numeric NOT NULL DEFAULT 0.0,
                            ""Credit"" numeric NOT NULL DEFAULT 0.0,
                            ""RunningBalance"" numeric NOT NULL DEFAULT 0.0,
                            ""RelatedEntityId"" uuid NULL,
                            ""RelatedEntityType"" text NULL,
                            ""LedgerSequence"" SERIAL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("BankLedgerAuditEntries", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""BankLedgerAuditEntries"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""BankLedgerEntryId"" uuid NOT NULL,
                            ""Action"" text NOT NULL,
                            ""OldAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""NewAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""Remarks"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("CashBooks", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""CashBooks"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""Name"" text NOT NULL,
                            ""Description"" text NULL,
                            ""OpeningBalance"" numeric(18,2) NOT NULL DEFAULT 0.0,
                            ""CurrentBalance"" numeric(18,2) NOT NULL DEFAULT 0.0,
                            ""Status"" text NOT NULL DEFAULT 'Active',
                            ""Notes"" text NULL,
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("MonthlySalaries", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""MonthlySalaries"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""SalaryNo"" text NOT NULL,
                            ""EmployeeId"" uuid NOT NULL,
                            ""SalaryMonth"" text NOT NULL,
                            ""BaseSalary"" numeric NOT NULL DEFAULT 0.0,
                            ""WorkingDays"" integer NOT NULL DEFAULT 0,
                            ""DaysWorked"" integer NOT NULL DEFAULT 0,
                            ""DailySalary"" numeric NOT NULL DEFAULT 0.0,
                            ""GrossSalary"" numeric NOT NULL DEFAULT 0.0,
                            ""Bonus"" numeric NOT NULL DEFAULT 0.0,
                            ""AdvanceDeduction"" numeric NOT NULL DEFAULT 0.0,
                            ""OtherDeduction"" numeric NOT NULL DEFAULT 0.0,
                            ""NetSalaryEntitlement"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalPaid"" numeric NOT NULL DEFAULT 0.0,
                            ""RemainingBalance"" numeric NOT NULL DEFAULT 0.0,
                            ""Status"" text NOT NULL DEFAULT 'Unpaid',
                            ""Remarks"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("SalaryPayments", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""SalaryPayments"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""SalaryNo"" text NOT NULL,
                            ""EmployeeId"" uuid NOT NULL,
                            ""SalaryMonth"" text NOT NULL,
                            ""MonthlySalary"" numeric NOT NULL DEFAULT 0.0,
                            ""WorkingDays"" integer NOT NULL DEFAULT 0,
                            ""DaysWorked"" integer NOT NULL DEFAULT 0,
                            ""DailySalary"" numeric NOT NULL DEFAULT 0.0,
                            ""GrossSalary"" numeric NOT NULL DEFAULT 0.0,
                            ""Bonus"" numeric NOT NULL DEFAULT 0.0,
                            ""AdvanceDeduction"" numeric NOT NULL DEFAULT 0.0,
                            ""OtherDeduction"" numeric NOT NULL DEFAULT 0.0,
                            ""NetSalary"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentMethod"" text NOT NULL,
                            ""BankAccountId"" uuid NULL,
                            ""CashBookId"" uuid NULL,
                            ""PaymentDate"" timestamp with time zone NOT NULL,
                            ""Remarks"" text NULL,
                            ""Status"" text NOT NULL DEFAULT 'Paid',
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("Vendors", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""Vendors"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""Name"" text NOT NULL,
                            ""Phone"" text NULL,
                            ""Email"" text NULL,
                            ""GST"" text NULL,
                            ""Address"" text NULL,
                            ""OpeningBalance"" numeric NOT NULL DEFAULT 0.0,
                            ""CurrentBalance"" numeric NOT NULL DEFAULT 0.0,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("Purchases", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""Purchases"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""PurchaseNo"" text NOT NULL,
                            ""PurchaseDate"" timestamp with time zone NOT NULL,
                            ""VendorId"" uuid NULL,
                            ""VendorName"" text NOT NULL,
                            ""PurchaseCategory"" text NOT NULL,
                            ""InvoiceNumber"" text NULL,
                            ""ReferenceNumber"" text NULL,
                            ""PaymentMethod"" text NOT NULL DEFAULT 'Credit',
                            ""BankAccountId"" uuid NULL,
                            ""CashBookId"" uuid NULL,
                            ""SubTotal"" numeric NOT NULL DEFAULT 0.0,
                            ""TaxAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""DiscountAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""OtherCharges"" numeric NOT NULL DEFAULT 0.0,
                            ""GrandTotal"" numeric NOT NULL DEFAULT 0.0,
                            ""AmountPaid"" numeric NOT NULL DEFAULT 0.0,
                            ""BalanceAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentStatus"" text NOT NULL DEFAULT 'Unpaid',
                            ""Notes"" text NULL,
                            ""AttachmentUrl"" text NULL,
                            ""AssetId"" uuid NULL,
                            ""CategoryMetadataJson"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("PurchaseItems", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""PurchaseItems"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""PurchaseId"" uuid NOT NULL,
                            ""RawMaterialId"" uuid NULL,
                            ""ItemName"" text NOT NULL,
                            ""Quantity"" numeric NOT NULL DEFAULT 0.0,
                            ""Unit"" text NOT NULL DEFAULT 'Pcs',
                            ""UnitPrice"" numeric NOT NULL DEFAULT 0.0,
                            ""GSTPercent"" numeric NOT NULL DEFAULT 0.0,
                            ""DiscountAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalAmount"" numeric NOT NULL DEFAULT 0.0
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("PurchasePayments", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""PurchasePayments"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""PurchaseId"" uuid NOT NULL,
                            ""PaymentDate"" timestamp with time zone NOT NULL,
                            ""PaymentMethod"" text NOT NULL,
                            ""BankAccountId"" uuid NULL,
                            ""CashBookId"" uuid NULL,
                            ""Amount"" numeric NOT NULL DEFAULT 0.0,
                            ""ReferenceNo"" text NULL,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System'
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("PurchaseTimelineEvents", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""PurchaseTimelineEvents"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""PurchaseId"" uuid NOT NULL,
                            ""EventDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""Action"" text NOT NULL,
                            ""PerformedBy"" text NOT NULL,
                            ""Details"" text NOT NULL,
                            ""Notes"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("AssetHistories", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""AssetHistories"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""AssetId"" uuid NOT NULL,
                            ""Date"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""Action"" text NOT NULL,
                            ""PerformedBy"" text NOT NULL,
                            ""PreviousValue"" text NULL,
                            ""NewValue"" text NULL,
                            ""Remarks"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("AssetMaintenanceRecords", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""AssetMaintenanceRecords"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""AssetId"" uuid NOT NULL,
                            ""MaintenanceType"" text NOT NULL,
                            ""MaintenanceDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""ServiceProvider"" text NOT NULL,
                            ""Description"" text NOT NULL,
                            ""PartsCost"" numeric(18,2) NOT NULL DEFAULT 0,
                            ""LabourCost"" numeric(18,2) NOT NULL DEFAULT 0,
                            ""OtherCost"" numeric(18,2) NOT NULL DEFAULT 0,
                            ""TotalCost"" numeric(18,2) NOT NULL DEFAULT 0,
                            ""NextMaintenanceDate"" timestamp with time zone NULL,
                            ""IsWarrantyClaim"" boolean NOT NULL DEFAULT false,
                            ""TechnicianName"" text NULL,
                            ""Notes"" text NULL,
                            ""AttachmentUrl"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("Assets", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""Assets"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""AssetCode"" text NOT NULL,
                            ""AssetTag"" text NOT NULL,
                            ""AssetName"" text NOT NULL,
                            ""AssetCategory"" text NOT NULL,
                            ""AssetType"" text NULL,
                            ""SerialNumber"" text NULL,
                            ""ModelNumber"" text NULL,
                            ""Manufacturer"" text NULL,
                            ""Description"" text NULL,
                            ""PurchaseDate"" timestamp with time zone NOT NULL,
                            ""PurchasePrice"" numeric NOT NULL DEFAULT 0.0,
                            ""SupplierId"" uuid NULL,
                            ""SupplierName"" text NULL,
                            ""PurchaseInvoiceNumber"" text NULL,
                            ""PurchaseOrderNumber"" text NULL,
                            ""TaxAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""FreightCost"" numeric NOT NULL DEFAULT 0.0,
                            ""InstallationCost"" numeric NOT NULL DEFAULT 0.0,
                            ""OtherCapitalizedCost"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalCapitalizedCost"" numeric NOT NULL DEFAULT 0.0,
                            ""DepreciationMethod"" text NOT NULL DEFAULT 'StraightLine',
                            ""UsefulLifeYears"" numeric NOT NULL DEFAULT 5,
                            ""ResidualValue"" numeric NOT NULL DEFAULT 0,
                            ""DepreciationStartDate"" timestamp with time zone NULL,
                            ""DepreciationFrequency"" text NOT NULL DEFAULT 'Yearly',
                            ""DepreciationRate"" numeric NOT NULL DEFAULT 0.0,
                            ""AccumulatedDepreciation"" numeric NOT NULL DEFAULT 0.0,
                            ""CurrentValue"" numeric NOT NULL DEFAULT 0.0,
                            ""Location"" text NULL,
                            ""Department"" text NULL,
                            ""AssignedEmployeeId"" uuid NULL,
                            ""AssignedEmployeeName"" text NULL,
                            ""AssignedDate"" timestamp with time zone NULL,
                            ""CurrentStatus"" text NOT NULL DEFAULT 'Active',
                            ""Condition"" text NOT NULL DEFAULT 'Good',
                            ""WarrantyDetails"" text NULL,
                            ""WarrantyStartDate"" timestamp with time zone NULL,
                            ""WarrantyEndDate"" timestamp with time zone NULL,
                            ""WarrantyProvider"" text NULL,
                            ""WarrantyNumber"" text NULL,
                            ""WarrantyNotes"" text NULL,
                            ""LastMaintenanceDate"" timestamp with time zone NULL,
                            ""NextMaintenanceDate"" timestamp with time zone NULL,
                            ""TotalMaintenanceCost"" numeric NOT NULL DEFAULT 0.0,
                            ""DisposalDate"" timestamp with time zone NULL,
                            ""DisposalMethod"" text NULL,
                            ""DisposalReason"" text NULL,
                            ""SaleValue"" numeric NOT NULL DEFAULT 0.0,
                            ""DisposalCost"" numeric NOT NULL DEFAULT 0.0,
                            ""BuyerParty"" text NULL,
                            ""DisposalRefNo"" text NULL,
                            ""DisposedBy"" text NULL,
                            ""Notes"" text NULL,
                            ""PhotoUrl"" text NULL,
                            ""DocumentUrl"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDistributorSupplies", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDistributorSupplies"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""SupplyNumber"" text NOT NULL,
                            ""DistributorId"" uuid NOT NULL,
                            ""DistributorName"" text NOT NULL DEFAULT '',
                            ""ProductId"" uuid NOT NULL,
                            ""ProductName"" text NOT NULL DEFAULT '20L Water Jar',
                            ""Stage"" text NOT NULL DEFAULT 'COMPLETED',
                            ""QuantityRequested"" integer NOT NULL DEFAULT 0,
                            ""QuantitySupplied"" integer NOT NULL DEFAULT 0,
                            ""QuantityEmptyReturned"" integer NOT NULL DEFAULT 0,
                            ""QuantityDamaged"" integer NOT NULL DEFAULT 0,
                            ""AppliedRate"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""AmountPaid"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentStatus"" text NOT NULL DEFAULT 'PENDING',
                            ""PaymentMode"" text NULL,
                            ""VehicleNumber"" text NULL,
                            ""DriverName"" text NULL,
                            ""DispatcherNotes"" text NULL,
                            ""ReceiverNotes"" text NULL,
                            ""DispatchedAt"" timestamp with time zone NULL,
                            ""ReceivedAt"" timestamp with time zone NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDistributorSupplies_TenantId_Number"" ON ""{schema}"".""TwentyLDistributorSupplies"" (""TenantId"", ""SupplyNumber"");
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorSupplies_TenantId_DistributorId"" ON ""{schema}"".""TwentyLDistributorSupplies"" (""TenantId"", ""DistributorId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDistributorProfiles", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDistributorProfiles"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""CustomerId"" uuid NOT NULL,
                            ""DistributorType"" text NOT NULL DEFAULT 'EXTERNAL',
                            ""JarOwnershipModel"" text NOT NULL DEFAULT 'MIXED',
                            ""VehicleOwnership"" text NOT NULL DEFAULT 'DISTRIBUTOR',
                            ""RouteOwnership"" text NOT NULL DEFAULT 'DISTRIBUTOR',
                            ""PricingModel"" text NOT NULL DEFAULT 'RATE_CARD',
                            ""CommissionModel"" text NOT NULL DEFAULT 'NONE',
                            ""CreditLimit"" numeric NOT NULL DEFAULT 0.0,
                            ""SecurityDeposit"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentTerms"" text NULL,
                            ""EffectiveFrom"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""EffectiveTo"" timestamp with time zone NULL,
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""AgreementReference"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorProfiles_CustomerId"" ON ""{schema}"".""TwentyLDistributorProfiles"" (""CustomerId"");
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDistributorProfiles_TenantId_CustomerId"" ON ""{schema}"".""TwentyLDistributorProfiles"" (""TenantId"", ""CustomerId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDeliveries", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDeliveries"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""CustomerId"" uuid NOT NULL,
                            ""DistributorId"" uuid NULL,
                            ""ProductId"" uuid NOT NULL,
                            ""RateRuleId"" uuid NULL,
                            ""SalesTransactionId"" uuid NULL,
                            ""RefillType"" text NOT NULL DEFAULT 'DIRECT_CUSTOMER_REFILL',
                            ""JarOwnerType"" text NOT NULL DEFAULT 'COMPANY',
                            ""OrderedQuantity"" integer NOT NULL DEFAULT 0,
                            ""FilledDeliveredQuantity"" integer NOT NULL DEFAULT 0,
                            ""EmptyCollectedQuantity"" integer NOT NULL DEFAULT 0,
                            ""FailedQuantity"" integer NOT NULL DEFAULT 0,
                            ""AppliedUnitRate"" numeric NOT NULL DEFAULT 0.0,
                            ""DiscountAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""TaxAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentMode"" text NOT NULL DEFAULT 'CREDIT',
                            ""Status"" text NOT NULL DEFAULT 'COMPLETED',
                            ""RouteReference"" text NULL,
                            ""VehicleReference"" text NULL,
                            ""DriverReference"" text NULL,
                            ""DeliveredAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""FailureReason"" text NULL,
                            ""Notes"" text NULL,
                            ""IdempotencyKey"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDeliveries_TenantId_CustomerId_DeliveredAt"" ON ""{schema}"".""TwentyLDeliveries"" (""TenantId"", ""CustomerId"", ""DeliveredAt"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLJarMovements", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLJarMovements"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""ProductId"" uuid NULL,
                            ""OwnerCustomerId"" uuid NULL,
                            ""FromCustomerId"" uuid NULL,
                            ""ToCustomerId"" uuid NULL,
                            ""OwnerType"" text NOT NULL DEFAULT 'COMPANY',
                            ""HolderType"" text NOT NULL DEFAULT 'COMPANY',
                            ""HolderCustomerId"" uuid NULL,
                            ""FromLocationType"" text NOT NULL DEFAULT 'PLANT',
                            ""ToLocationType"" text NOT NULL DEFAULT 'PLANT',
                            ""FromLocationReference"" text NULL,
                            ""ToLocationReference"" text NULL,
                            ""MovementType"" text NOT NULL DEFAULT '',
                            ""ContainerStatus"" text NOT NULL DEFAULT 'EMPTY',
                            ""Quantity"" integer NOT NULL DEFAULT 0,
                            ""ReferenceId"" uuid NULL,
                            ""ReferenceType"" text NULL,
                            ""OccurredAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""Reason"" text NULL,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLJarMovements_Ledger"" ON ""{schema}"".""TwentyLJarMovements"" (""TenantId"", ""OwnerType"", ""OwnerCustomerId"", ""ToLocationType"", ""ToCustomerId"", ""OccurredAt"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLJarPositions", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLJarPositions"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""PositionKey"" text NOT NULL,
                            ""ProductId"" uuid NULL,
                            ""OwnerType"" text NOT NULL DEFAULT 'COMPANY',
                            ""OwnerCustomerId"" uuid NULL,
                            ""HolderType"" text NOT NULL DEFAULT 'COMPANY',
                            ""HolderCustomerId"" uuid NULL,
                            ""LocationType"" text NOT NULL DEFAULT 'PLANT',
                            ""LocationReference"" text NULL,
                            ""ContainerStatus"" text NOT NULL DEFAULT 'EMPTY',
                            ""Quantity"" integer NOT NULL DEFAULT 0,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLJarPositions_Position"" ON ""{schema}"".""TwentyLJarPositions"" (""TenantId"", ""CompanyId"", ""PositionKey"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLRateRules", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLRateRules"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""ProductId"" uuid NOT NULL,
                            ""CustomerId"" uuid NULL,
                            ""PartyType"" text NOT NULL DEFAULT 'ANY',
                            ""RefillType"" text NOT NULL DEFAULT 'COMPANY_TO_DISTRIBUTOR',
                            ""JarOwnerType"" text NOT NULL DEFAULT 'ANY',
                            ""MinimumQuantity"" numeric NOT NULL DEFAULT 1,
                            ""Priority"" integer NOT NULL DEFAULT 0,
                            ""UnitRate"" numeric NOT NULL DEFAULT 0.0,
                            ""DiscountRate"" numeric NULL,
                            ""TaxRate"" numeric NULL,
                            ""EffectiveFrom"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""EffectiveTo"" timestamp with time zone NULL,
                            ""RequiresAuthorization"" boolean NOT NULL DEFAULT false,
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLRateRules_Effective"" ON ""{schema}"".""TwentyLRateRules"" (""TenantId"", ""ProductId"", ""CustomerId"", ""EffectiveFrom"", ""EffectiveTo"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLCommissionRules", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLCommissionRules"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""BeneficiaryCustomerId"" uuid NULL,
                            ""ProductId"" uuid NULL,
                            ""BeneficiaryType"" text NOT NULL DEFAULT 'EMPLOYEE',
                            ""CalculationType"" text NOT NULL DEFAULT 'PERCENTAGE',
                            ""Value"" numeric NOT NULL DEFAULT 0.0,
                            ""MinimumQuantity"" numeric NOT NULL DEFAULT 0.0,
                            ""EffectiveFrom"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""EffectiveTo"" timestamp with time zone NULL,
                            ""Priority"" integer NOT NULL DEFAULT 0,
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLCommissionRules_Effective"" ON ""{schema}"".""TwentyLCommissionRules"" (""TenantId"", ""BeneficiaryCustomerId"", ""ProductId"", ""EffectiveFrom"", ""EffectiveTo"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLCommissionTransactions", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLCommissionTransactions"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""DeliveryId"" uuid NOT NULL,
                            ""RuleId"" uuid NULL,
                            ""BeneficiaryCustomerId"" uuid NULL,
                            ""BeneficiaryType"" text NOT NULL DEFAULT 'EMPLOYEE',
                            ""TransactionType"" text NOT NULL DEFAULT 'EARNED',
                            ""Amount"" numeric NOT NULL DEFAULT 0.0,
                            ""OccurredAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""ReversalOfId"" uuid NULL,
                            ""Reason"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLCommissionTransactions_Delivery"" ON ""{schema}"".""TwentyLCommissionTransactions"" (""TenantId"", ""DeliveryId"", ""BeneficiaryCustomerId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLTrips", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLTrips"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""TripNumber"" text NOT NULL,
                            ""DriverName"" text NOT NULL DEFAULT '',
                            ""DriverCustomerId"" uuid NULL,
                            ""VehicleNumber"" text NOT NULL DEFAULT '',
                            ""RouteCode"" text NULL,
                            ""PlannedDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""Status"" text NOT NULL DEFAULT 'PLANNED',
                            ""LoadedFilledJars"" integer NOT NULL DEFAULT 0,
                            ""LoadedEmptyJars"" integer NOT NULL DEFAULT 0,
                            ""DeliveredFilledJars"" integer NOT NULL DEFAULT 0,
                            ""CollectedEmptyJars"" integer NOT NULL DEFAULT 0,
                            ""ReturnedFilledJars"" integer NOT NULL DEFAULT 0,
                            ""ReturnedEmptyJars"" integer NOT NULL DEFAULT 0,
                            ""DamagedJarsCount"" integer NOT NULL DEFAULT 0,
                            ""LostJarsCount"" integer NOT NULL DEFAULT 0,
                            ""CondemnedJarsCount"" integer NOT NULL DEFAULT 0,
                            ""TotalTripRevenue"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalCashCollected"" numeric NOT NULL DEFAULT 0.0,
                            ""ReconciliationStatus"" text NOT NULL DEFAULT 'PENDING',
                            ""DiscrepancyNotes"" text NULL,
                            ""DispatchedAt"" timestamp with time zone NULL,
                            ""ReturnedAt"" timestamp with time zone NULL,
                            ""ReconciledAt"" timestamp with time zone NULL,
                            ""ReconciledBy"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLTrips_TenantId_TripNumber"" ON ""{schema}"".""TwentyLTrips"" (""TenantId"", ""TripNumber"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLTripStops", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLTripStops"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""TripId"" uuid NOT NULL,
                            ""StopSequence"" integer NOT NULL DEFAULT 1,
                            ""CustomerId"" uuid NOT NULL,
                            ""ProductId"" uuid NULL,
                            ""PlannedFilledJars"" integer NOT NULL DEFAULT 0,
                            ""DeliveredFilledJars"" integer NOT NULL DEFAULT 0,
                            ""CollectedEmptyJars"" integer NOT NULL DEFAULT 0,
                            ""DamagedEmptyJars"" integer NOT NULL DEFAULT 0,
                            ""LostJars"" integer NOT NULL DEFAULT 0,
                            ""UnitRate"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentMode"" text NOT NULL DEFAULT 'CREDIT',
                            ""PaymentStatus"" text NOT NULL DEFAULT 'PENDING',
                            ""Status"" text NOT NULL DEFAULT 'PENDING',
                            ""FailureReason"" text NULL,
                            ""Notes"" text NULL,
                            ""DeliveredAt"" timestamp with time zone NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLTripStops_TenantId_TripId_Sequence"" ON ""{schema}"".""TwentyLTripStops"" (""TenantId"", ""TripId"", ""StopSequence"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLOperations", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLOperations"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""OperationNumber"" text NOT NULL,
                            ""OperationType"" text NOT NULL,
                            ""Stage"" text NOT NULL DEFAULT 'COMPLETED',
                            ""TripId"" uuid NULL,
                            ""CustomerId"" uuid NULL,
                            ""DistributorId"" uuid NULL,
                            ""DriverName"" text NULL,
                            ""VehicleNumber"" text NULL,
                            ""ProductId"" uuid NULL,
                            ""QuantityFilled"" integer NOT NULL DEFAULT 0,
                            ""QuantityEmpty"" integer NOT NULL DEFAULT 0,
                            ""QuantityDamaged"" integer NOT NULL DEFAULT 0,
                            ""QuantityLost"" integer NOT NULL DEFAULT 0,
                            ""QuantityCondemned"" integer NOT NULL DEFAULT 0,
                            ""AppliedRate"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentStatus"" text NOT NULL DEFAULT 'PENDING',
                            ""Status"" text NOT NULL DEFAULT 'COMPLETED',
                            ""ReferenceNumber"" text NULL,
                            ""Reason"" text NULL,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLOperations_TenantId_Number"" ON ""{schema}"".""TwentyLOperations"" (""TenantId"", ""OperationNumber"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLJarInspections", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLJarInspections"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""InspectionNumber"" text NOT NULL,
                            ""ReferenceType"" text NOT NULL DEFAULT '',
                            ""ReferenceId"" uuid NULL,
                            ""SourceHolderType"" text NOT NULL DEFAULT 'DRIVER',
                            ""SourceHolderId"" uuid NULL,
                            ""SourceHolderName"" text NULL,
                            ""InspectedCount"" integer NOT NULL DEFAULT 0,
                            ""ReusableCount"" integer NOT NULL DEFAULT 0,
                            ""DamagedCount"" integer NOT NULL DEFAULT 0,
                            ""CondemnedCount"" integer NOT NULL DEFAULT 0,
                            ""InspectionOutcome"" text NOT NULL DEFAULT 'PASSED',
                            ""ResponsibleParty"" text NULL,
                            ""DamageReason"" text NULL,
                            ""CondemnationReason"" text NULL,
                            ""AuthorizedBy"" text NULL,
                            ""DisposalReference"" text NULL,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLJarInspections_TenantId_Number"" ON ""{schema}"".""TwentyLJarInspections"" (""TenantId"", ""InspectionNumber"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDistributorRoutes", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDistributorRoutes"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""DistributorId"" uuid NOT NULL,
                            ""RouteCode"" text NOT NULL DEFAULT '',
                            ""RouteName"" text NOT NULL DEFAULT '',
                            ""AreaDescription"" text NULL,
                            ""DefaultDriverName"" text NULL,
                            ""DefaultVehicleNumber"" text NULL,
                            ""ScheduleDays"" text NOT NULL DEFAULT 'DAILY',
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorRoutes_TenantId_DistributorId"" ON ""{schema}"".""TwentyLDistributorRoutes"" (""TenantId"", ""DistributorId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDistributorVehicles", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDistributorVehicles"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""DistributorId"" uuid NOT NULL,
                            ""RegistrationNumber"" text NOT NULL,
                            ""VehicleType"" text NOT NULL DEFAULT 'MINI_TRUCK',
                            ""CapacityJars"" integer NOT NULL DEFAULT 50,
                            ""AssignedDriverName"" text NULL,
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorVehicles_TenantId_DistributorId"" ON ""{schema}"".""TwentyLDistributorVehicles"" (""TenantId"", ""DistributorId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDistributorDrivers", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDistributorDrivers"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""DistributorId"" uuid NOT NULL,
                            ""DriverName"" text NOT NULL DEFAULT '',
                            ""Phone"" text NOT NULL DEFAULT '',
                            ""LicenseNumber"" text NULL,
                            ""AssignedVehicleNumber"" text NULL,
                            ""CurrentRouteId"" uuid NULL,
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorDrivers_TenantId_DistributorId"" ON ""{schema}"".""TwentyLDistributorDrivers"" (""TenantId"", ""DistributorId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDistributorCustomers", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDistributorCustomers"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""DistributorId"" uuid NOT NULL,
                            ""CustomerName"" text NOT NULL DEFAULT '',
                            ""Phone"" text NOT NULL DEFAULT '',
                            ""Address"" text NULL,
                            ""Area"" text NULL,
                            ""RouteId"" uuid NULL,
                            ""RouteName"" text NULL,
                            ""DeliveryFrequency"" text NOT NULL DEFAULT 'DAILY',
                            ""DefaultRate"" numeric NOT NULL DEFAULT 40.0,
                            ""AssignedDriverName"" text NULL,
                            ""AssignedVehicleNumber"" text NULL,
                            ""FilledJarsHeld"" integer NOT NULL DEFAULT 0,
                            ""EmptyJarsHeld"" integer NOT NULL DEFAULT 0,
                            ""SecurityDeposit"" numeric NOT NULL DEFAULT 0.0,
                            ""OutstandingBalance"" numeric NOT NULL DEFAULT 0.0,
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorCustomers_TenantId_DistributorId"" ON ""{schema}"".""TwentyLDistributorCustomers"" (""TenantId"", ""DistributorId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
                else if (table.Equals("TwentyLDistributorDeliveries", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.CommandText = $@"
                        CREATE TABLE IF NOT EXISTS ""{schema}"".""TwentyLDistributorDeliveries"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""DeliveryNumber"" text NOT NULL,
                            ""DistributorId"" uuid NOT NULL,
                            ""DistributorCustomerId"" uuid NOT NULL,
                            ""CustomerName"" text NOT NULL DEFAULT '',
                            ""RouteId"" uuid NULL,
                            ""RouteName"" text NULL,
                            ""DriverName"" text NULL,
                            ""VehicleNumber"" text NULL,
                            ""ProductId"" uuid NULL,
                            ""QuantityFilledDelivered"" integer NOT NULL DEFAULT 0,
                            ""QuantityEmptyCollected"" integer NOT NULL DEFAULT 0,
                            ""QuantityDamaged"" integer NOT NULL DEFAULT 0,
                            ""SellingRate"" numeric NOT NULL DEFAULT 0.0,
                            ""CompanyRefillRate"" numeric NOT NULL DEFAULT 0.0,
                            ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                            ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                            ""PaymentMode"" text NOT NULL DEFAULT 'CASH',
                            ""PaymentStatus"" text NOT NULL DEFAULT 'PAID',
                            ""GrossMargin"" numeric NOT NULL DEFAULT 0.0,
                            ""DeliveryDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""Notes"" text NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL
                        );
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDistributorDeliveries_TenantId_Number"" ON ""{schema}"".""TwentyLDistributorDeliveries"" (""TenantId"", ""DeliveryNumber"");
                        CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorDeliveries_DistributorId"" ON ""{schema}"".""TwentyLDistributorDeliveries"" (""TenantId"", ""DistributorId"");";
                    await cmd.ExecuteNonQueryAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR TABLE WARN] Auto repair failed for table {Schema}.{Table}: {Message}", schema, table, ex.Message);
            }
        }

        private async Task AutoRepairColumnAsync(NpgsqlConnection connection, string schema, string table, string column, Type clrType)
        {
            try
            {
                using var cmd = connection.CreateCommand();
                var typeDef = GetColumnDefinition(column, clrType);

                cmd.CommandText = $@"ALTER TABLE ""{schema}"".""{table}"" ADD COLUMN IF NOT EXISTS ""{column}"" {typeDef};";
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR COLUMN WARN] Auto repair failed for column {Schema}.{Table}.{Column}: {Message}", schema, table, column, ex.Message);
            }
        }

        private async Task<bool> AutoRepairColumnTypeAsync(NpgsqlConnection connection, string schema, string table, string column, Type clrType)
        {
            var underlyingType = Nullable.GetUnderlyingType(clrType) ?? clrType;
            if (underlyingType == typeof(decimal))
            {
                try
                {
                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = $@"
                        ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" DROP DEFAULT;
                        ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" TYPE numeric
                        USING COALESCE(NULLIF(trim(""{column}""::text), ''), '0')::numeric;
                        ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" SET DEFAULT 0.0;
                        ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" SET NOT NULL;";

                    await cmd.ExecuteNonQueryAsync();
                    _logger.LogInformation("[SCHEMA AUTO-REPAIR TYPE SUCCESS] Successfully converted column {Schema}.{Table}.{Column} to numeric.", schema, table, column);
                    return true;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR TYPE WARN] Auto repair failed to convert column {Schema}.{Table}.{Column} to numeric: {Message}", schema, table, column, ex.Message);
                    return false;
                }
            }

            if (underlyingType != typeof(bool))
            {
                _logger.LogWarning(
                    "[SCHEMA AUTO-REPAIR TYPE WARN] Automatic type conversion is only enabled for boolean and decimal columns. Skipping {Schema}.{Table}.{Column}.",
                    schema,
                    table,
                    column);
                return false;
            }

            try
            {
                using var cmd = connection.CreateCommand();
                cmd.CommandText = $@"
                    ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" DROP DEFAULT;
                    ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" TYPE boolean
                    USING CASE
                        WHEN ""{column}"" IS NULL THEN false
                        WHEN lower(trim(""{column}""::text)) IN ('true', 't', '1', 'yes', 'y') THEN true
                        WHEN lower(trim(""{column}""::text)) IN ('false', 'f', '0', 'no', 'n', '') THEN false
                        ELSE false
                    END;
                    ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" SET DEFAULT false;
                    ALTER TABLE ""{schema}"".""{table}"" ALTER COLUMN ""{column}"" SET NOT NULL;";

                await cmd.ExecuteNonQueryAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR TYPE WARN] Auto repair failed for column {Schema}.{Table}.{Column}: {Message}", schema, table, column, ex.Message);
                return false;
            }
        }

        private static bool ColumnTypeMatches(Type clrType, string actualPostgresDataType)
        {
            var underlyingType = Nullable.GetUnderlyingType(clrType) ?? clrType;
            if (underlyingType == typeof(bool) || underlyingType == typeof(decimal))
            {
                return string.Equals(GetExpectedPostgresDataType(clrType), actualPostgresDataType, StringComparison.OrdinalIgnoreCase);
            }

            return true;
        }

        private static string GetColumnDefinition(string column, Type clrType)
        {
            var underlyingType = Nullable.GetUnderlyingType(clrType) ?? clrType;
            var nullable = Nullable.GetUnderlyingType(clrType) != null;

            if (column.Equals("LedgerSequence", StringComparison.OrdinalIgnoreCase))
            {
                return "SERIAL";
            }

            if (underlyingType == typeof(bool))
            {
                return nullable ? "boolean NULL" : "boolean NOT NULL DEFAULT false";
            }

            if (underlyingType == typeof(Guid))
            {
                return nullable ? "uuid NULL" : "uuid NOT NULL";
            }

            if (underlyingType == typeof(decimal))
            {
                return nullable ? "numeric NULL" : "numeric NOT NULL DEFAULT 0.0";
            }

            if (underlyingType == typeof(DateTime))
            {
                return nullable ? "timestamp with time zone NULL" : "timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP";
            }

            if (underlyingType == typeof(int))
            {
                return nullable ? "integer NULL" : "integer NOT NULL DEFAULT 0";
            }

            if (column.Equals("PaymentStatus", StringComparison.OrdinalIgnoreCase))
            {
                return "text NOT NULL DEFAULT 'Pending'";
            }

            return "text NULL";
        }

        private static string GetExpectedPostgresDataType(Type clrType)
        {
            var underlyingType = Nullable.GetUnderlyingType(clrType) ?? clrType;

            if (underlyingType == typeof(bool)) return "boolean";
            if (underlyingType == typeof(Guid)) return "uuid";
            if (underlyingType == typeof(decimal)) return "numeric";
            if (underlyingType == typeof(DateTime)) return "timestamp with time zone";
            if (underlyingType == typeof(int)) return "integer";

            return "text";
        }

        public async Task EnsureAllTenantSchemasRepairedAsync(DbContext platformDbContext)
        {
            try
            {
                var connStr = platformDbContext.Database.GetConnectionString();
                if (string.IsNullOrWhiteSpace(connStr)) return;

                using var connection = new NpgsqlConnection(connStr);
                await connection.OpenAsync();

                var schemas = new List<string>();
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT schema_name 
                        FROM information_schema.schemata 
                        WHERE schema_name = 'public' 
                           OR schema_name LIKE 'aquora_tenant_%' 
                           OR schema_name LIKE 'tenant_%';";

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        schemas.Add(reader.GetString(0));
                    }
                }

                foreach (var schema in schemas)
                {
                    try
                    {
                        using var alterCmd = connection.CreateCommand();
                        alterCmd.CommandText = $@"
                            DO $$ 
                            BEGIN 
                                IF EXISTS (
                                    SELECT FROM information_schema.tables 
                                    WHERE table_schema = '{schema}' AND table_name = 'Tenants'
                                ) THEN
                                    ALTER TABLE ""{schema}"".""Tenants"" ADD COLUMN IF NOT EXISTS ""IsBiodropsProduction"" boolean NOT NULL DEFAULT false;
                                END IF;

                                IF EXISTS (
                                    SELECT FROM information_schema.tables 
                                    WHERE table_schema = '{schema}' AND table_name = 'Companies'
                                ) THEN
                                    ALTER TABLE ""{schema}"".""Companies"" ADD COLUMN IF NOT EXISTS ""IsBiodropsProduction"" boolean NOT NULL DEFAULT false;
                                END IF;

                                CREATE TABLE IF NOT EXISTS ""{schema}"".""MonthlySalaries"" (
                                    ""Id"" uuid NOT NULL PRIMARY KEY,
                                    ""TenantId"" uuid NOT NULL,
                                    ""CompanyId"" uuid NOT NULL,
                                    ""SalaryNo"" text NOT NULL,
                                    ""EmployeeId"" uuid NOT NULL,
                                    ""SalaryMonth"" text NOT NULL,
                                    ""BaseSalary"" numeric NOT NULL DEFAULT 0.0,
                                    ""WorkingDays"" integer NOT NULL DEFAULT 0,
                                    ""DaysWorked"" integer NOT NULL DEFAULT 0,
                                    ""DailySalary"" numeric NOT NULL DEFAULT 0.0,
                                    ""GrossSalary"" numeric NOT NULL DEFAULT 0.0,
                                    ""Bonus"" numeric NOT NULL DEFAULT 0.0,
                                    ""AdvanceDeduction"" numeric NOT NULL DEFAULT 0.0,
                                    ""OtherDeduction"" numeric NOT NULL DEFAULT 0.0,
                                    ""CalculatedEntitlement"" numeric NOT NULL DEFAULT 0.0,
                                    ""NetSalaryEntitlement"" numeric NOT NULL DEFAULT 0.0,
                                    ""TotalPaid"" numeric NOT NULL DEFAULT 0.0,
                                    ""RemainingBalance"" numeric NOT NULL DEFAULT 0.0,
                                    ""Status"" text NOT NULL DEFAULT 'Unpaid',
                                    ""Remarks"" text NULL,
                                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                                    ""UpdatedAt"" timestamp with time zone NULL,
                                    ""UpdatedBy"" text NULL,
                                    ""CreatedByIP"" text NULL,
                                    ""UpdatedByIP"" text NULL,
                                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                    ""DeletedAt"" timestamp with time zone NULL,
                                    ""DeletedBy"" text NULL
                                );

                                IF EXISTS (
                                    SELECT FROM information_schema.tables 
                                    WHERE table_schema = '{schema}' AND table_name = 'MonthlySalaries'
                                ) THEN
                                     ALTER TABLE ""{schema}"".""MonthlySalaries"" ADD COLUMN IF NOT EXISTS ""CalculatedEntitlement"" numeric NOT NULL DEFAULT 0.0;
                                     ALTER TABLE ""{schema}"".""MonthlySalaries"" ADD COLUMN IF NOT EXISTS ""IsFinalized"" boolean NOT NULL DEFAULT false;
                                     ALTER TABLE ""{schema}"".""MonthlySalaries"" ADD COLUMN IF NOT EXISTS ""FinalizedAt"" timestamp with time zone NULL;
                                     ALTER TABLE ""{schema}"".""MonthlySalaries"" ADD COLUMN IF NOT EXISTS ""FinalizedBy"" text NULL;
                                     UPDATE ""{schema}"".""MonthlySalaries"" SET ""CalculatedEntitlement"" = ""NetSalaryEntitlement"" WHERE (""CalculatedEntitlement"" IS NULL OR ""CalculatedEntitlement"" = 0.0) AND ""NetSalaryEntitlement"" > 0.0;
                                END IF;

                                IF EXISTS (
                                    SELECT FROM information_schema.tables 
                                    WHERE table_schema = '{schema}' AND table_name = 'SalaryPayments'
                                ) THEN
                                    ALTER TABLE ""{schema}"".""SalaryPayments"" ADD COLUMN IF NOT EXISTS ""MonthlySalaryId"" uuid NULL;
                                    ALTER TABLE ""{schema}"".""SalaryPayments"" ADD COLUMN IF NOT EXISTS ""PaymentType"" text NOT NULL DEFAULT 'Salary Settlement';
                                    ALTER TABLE ""{schema}"".""SalaryPayments"" ADD COLUMN IF NOT EXISTS ""Amount"" numeric NOT NULL DEFAULT 0.0;

                                    UPDATE ""{schema}"".""SalaryPayments"" 
                                    SET ""Amount"" = ""NetSalary"" 
                                    WHERE (""Amount"" IS NULL OR ""Amount"" = 0.0) AND ""NetSalary"" > 0.0;
                                END IF;

                                IF EXISTS (
                                    SELECT FROM information_schema.tables 
                                    WHERE table_schema = '{schema}' AND table_name = 'Customers'
                                ) THEN
                                    ALTER TABLE ""{schema}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Price"" numeric NOT NULL DEFAULT 0;
                                    ALTER TABLE ""{schema}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Discount"" numeric NOT NULL DEFAULT 0;
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
                        await alterCmd.ExecuteNonQueryAsync();
                        _logger.LogInformation("[SCHEMA AUTO-REPAIR] Verified Price, Discount columns, and Owner Role for schema {Schema}", schema);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR WARN] Failed to add Price/Discount columns for schema {Schema}: {Message}", schema, ex.Message);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SCHEMA AUTO-REPAIR WARN] Tenant schema repair loop encountered an issue: {Message}", ex.Message);
            }
        }
    }
}
