using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Shared.Constants;
using Aquora.Persistence.Context;

namespace Aquora.Persistence.Services
{
    public class TenantDatabaseService : ITenantDatabaseService
    {
        private static readonly Regex ValidSchemaName = new("^[a-z][a-z0-9_]*$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private readonly PlatformDbContext _platformContext;
        private readonly IServiceScopeFactory _scopeFactory;

        public TenantDatabaseService(PlatformDbContext platformContext, IServiceScopeFactory scopeFactory)
        {
            _platformContext = platformContext;
            _scopeFactory = scopeFactory;
        }

        public async Task<Guid> CreateAndMigrateTenantAsync(
            Guid tenantId, 
            string schemaName, 
            string subdomain, 
            string companyName, 
            Guid userId)
        {
            var result = await ProvisionTenantAsync(
                tenantId,
                schemaName,
                companyName,
                $"{subdomain.ToUpper()}_CORP",
                userId);

            return result.OwnerRoleId;
        }

        public async Task DropTenantSchemaAsync(string schemaName)
        {
            if (string.IsNullOrWhiteSpace(schemaName))
            {
                return;
            }

            if (_platformContext.Database.IsRelational())
            {
#pragma warning disable EF1003
                await _platformContext.Database.ExecuteSqlRawAsync(
                    "DROP SCHEMA IF EXISTS " + QuoteSchemaName(schemaName) + " CASCADE;");
#pragma warning restore EF1003
            }
        }

        public static string QuoteSchemaName(string schemaName)
        {
            if (string.IsNullOrWhiteSpace(schemaName) || !ValidSchemaName.IsMatch(schemaName))
            {
                throw new InvalidOperationException($"Invalid tenant schema name: {schemaName}");
            }

            return "\"" + schemaName.Replace("\"", "\"\"") + "\"";
        }

        public async Task<TenantProvisioningResult> ProvisionTenantAsync(
            Guid tenantId,
            string schemaName,
            string companyName,
            string companyCode,
            Guid ownerUserId,
            System.Collections.Generic.List<string>? enabledStations = null,
            Func<int, string, string, Task>? onProgress = null)
        {
            var result = new TenantProvisioningResult();
            try
            {
                AuditState.IsDisabled = true;

                // Idempotency check: if tenant is already marked as initialized or completed, return immediately
                var existingTenant = await _platformContext.Tenants.FindAsync(tenantId);
                if (existingTenant != null && (existingTenant.IsInitialized || existingTenant.Status == "Completed"))
                {
                    Console.WriteLine($"[PROVISIONING SKIPPED]: Tenant {tenantId} ({companyName}) is already provisioned and completed.");
                    if (onProgress != null)
                    {
                        await onProgress(100, "ProvisioningCompleted", "Your workspace is ready!");
                    }

                    using (var checkScope = _scopeFactory.CreateScope())
                    {
                        TenantSchemaResolver.CurrentSchemaName = schemaName;
                        var checkTenantProvider = checkScope.ServiceProvider.GetRequiredService<ITenantProvider>();
                        checkTenantProvider.SetTenantId(tenantId);
                        checkTenantProvider.SetTenantSchemaName(schemaName);
                        var checkContext = checkScope.ServiceProvider.GetRequiredService<TenantDbContext>();

                        if (checkContext.Database.IsRelational())
                        {
                            try
                            {
                                await checkContext.Database.MigrateAsync();
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[TENANT MIGRATION WARN]: Failed to apply pending migrations for {schemaName}: {ex.Message}");
                            }
                        }

                        var company = await checkContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                        if (company != null)
                        {
                            result.CompanyId = company.Id;
                        }
                    }
                    return result;
                }

                // 1. Create Postgres Schema
                if (_platformContext.Database.IsRelational())
                {
#pragma warning disable EF1003
                    await _platformContext.Database.ExecuteSqlRawAsync(
                        "CREATE SCHEMA IF NOT EXISTS " + QuoteSchemaName(schemaName) + ";");
#pragma warning restore EF1003
                }

                if (onProgress != null)
                {
                    await onProgress(15, "DatabaseCreated", "Creating your workspace environment...");
                }

                // 2. Resolve TenantDbContext in a child scope with custom schema configuration
                using (var scope = _scopeFactory.CreateScope())
                {
                    TenantSchemaResolver.CurrentSchemaName = schemaName;

                    var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
                    tenantProvider.SetTenantId(tenantId);
                    tenantProvider.SetTenantSchemaName(schemaName);

                    var tenantContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();

                    // Verify Database Connection
                    var canConnect = await tenantContext.Database.CanConnectAsync();
                    if (!canConnect)
                    {
                        throw new InvalidOperationException("Failed to verify connection to the tenant database schema.");
                    }

                    // Explicitly configure search_path for the connection to protect against any third-party or legacy raw SQL
                    if (tenantContext.Database.IsRelational())
                    {
                        await tenantContext.Database.ExecuteSqlRawAsync($"SET search_path TO \"{schemaName}\", public;");
                    }

                    if (onProgress != null)
                    {
                        await onProgress(30, "DatabaseCreated", "Verifying workspace configuration...");
                    }

                    if (onProgress != null)
                    {
                        await onProgress(45, "SchemaMigrationsRun", "Building your workspace structure...");
                    }

                    // Run EF migrations inside the tenant schema. Any failure must abort provisioning.
                    if (tenantContext.Database.IsRelational())
                    {
                        try
                        {
                            await tenantContext.Database.MigrateAsync();
                        }
                        catch (Exception ex)
                        {
                            var dbConnection = tenantContext.Database.GetDbConnection();
                            string sqlState = "UNKNOWN";
                            string pgDetail = "";
                            string pgHint = "";
                            string pgSchema = "";
                            string pgTable = "";

                            if (ex is Npgsql.PostgresException pgEx)
                            {
                                sqlState = pgEx.SqlState ?? "UNKNOWN";
                                pgDetail = pgEx.Detail ?? "";
                                pgHint = pgEx.Hint ?? "";
                                pgSchema = pgEx.SchemaName ?? "";
                                pgTable = pgEx.TableName ?? "";
                            }
                            else if (ex.InnerException is Npgsql.PostgresException innerPgEx)
                            {
                                sqlState = innerPgEx.SqlState ?? "UNKNOWN";
                                pgDetail = innerPgEx.Detail ?? "";
                                pgHint = innerPgEx.Hint ?? "";
                                pgSchema = innerPgEx.SchemaName ?? "";
                                pgTable = innerPgEx.TableName ?? "";
                            }

                            IEnumerable<string> pendingMigrations = Array.Empty<string>();
                            IEnumerable<string> appliedMigrations = Array.Empty<string>();
                            try
                            {
                                pendingMigrations = await tenantContext.Database.GetPendingMigrationsAsync();
                                appliedMigrations = await tenantContext.Database.GetAppliedMigrationsAsync();
                            }
                            catch
                            {
                                // Ignore failure during diagnostic inspection
                            }

                            var pendingList = pendingMigrations.ToList();
                            var appliedList = appliedMigrations.ToList();
                            var failingMigration = pendingList.Count > 0 ? pendingList[0] : "Unknown";
                            var lastApplied = appliedList.Count > 0 ? appliedList[^1] : "None";

                            var diagnosticMessage = new System.Text.StringBuilder();
                            diagnosticMessage.AppendLine("================================================================================");
                            diagnosticMessage.AppendLine("CRITICAL PROVISIONING FAILURE: EF CORE MIGRATION ERROR");
                            diagnosticMessage.AppendLine($"  Tenant ID:           {tenantId}");
                            diagnosticMessage.AppendLine($"  Tenant Schema:       {schemaName}");
                            diagnosticMessage.AppendLine($"  Database Server:     {dbConnection.DataSource}");
                            diagnosticMessage.AppendLine($"  Database Name:       {dbConnection.Database}");
                            diagnosticMessage.AppendLine($"  Failing Migration:   {failingMigration}");
                            diagnosticMessage.AppendLine($"  Last Applied:        {lastApplied}");
                            diagnosticMessage.AppendLine($"  Postgres SQLSTATE:   {sqlState}");
                            if (!string.IsNullOrWhiteSpace(pgSchema)) diagnosticMessage.AppendLine($"  Target Schema:       {pgSchema}");
                            if (!string.IsNullOrWhiteSpace(pgTable)) diagnosticMessage.AppendLine($"  Target Table:        {pgTable}");
                            if (!string.IsNullOrWhiteSpace(pgDetail)) diagnosticMessage.AppendLine($"  Detail:              {pgDetail}");
                            if (!string.IsNullOrWhiteSpace(pgHint)) diagnosticMessage.AppendLine($"  Hint:                {pgHint}");
                            diagnosticMessage.AppendLine($"  Error Message:       {ex.Message}");
                            if (ex.InnerException != null) diagnosticMessage.AppendLine($"  Inner Error:         {ex.InnerException.Message}");
                            diagnosticMessage.AppendLine("================================================================================");

                            Console.Error.WriteLine(diagnosticMessage.ToString());

                            throw new InvalidOperationException(
                                $"Tenant database migration failed for Tenant '{tenantId}' (Schema: '{schemaName}', Database: '{dbConnection.Database}'). " +
                                $"Failed Migration: '{failingMigration}', SQLSTATE: {sqlState}. Error: {ex.Message}", ex);
                        }
                    }

                    // Repair schema for ProductionShifts and Simple Accounts tables
                    if (tenantContext.Database.IsRelational())
                    {
                        try
                        {
                        var repairSql = $@"
                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""Brands"" (
                                ""Id"" uuid NOT NULL,
                                ""Name"" character varying(150) NOT NULL,
                                ""Code"" character varying(50) NULL,
                                ""Description"" character varying(500) NULL,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_Brands_{schemaName}"" PRIMARY KEY (""Id"")
                            );
                            CREATE INDEX IF NOT EXISTS ""IX_Brands_Name_{schemaName}"" ON ""{schemaName}"".""Brands"" (""Name"");
                            CREATE INDEX IF NOT EXISTS ""IX_Brands_Code_{schemaName}"" ON ""{schemaName}"".""Brands"" (""Code"");

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""RawMaterials"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""Name"" text NOT NULL,
                                ""Code"" text NOT NULL,
                                ""Category"" text NOT NULL,
                                ""Unit"" text NOT NULL,
                                ""BaseUnit"" text NULL,
                                ""ConversionFactor"" numeric NOT NULL DEFAULT 1.0,
                                ""CurrentStock"" numeric NOT NULL DEFAULT 0.0,
                                ""CostPerUnit"" numeric NOT NULL DEFAULT 5.0,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_RawMaterials_{schemaName}"" PRIMARY KEY (""Id"")
                            );
                            CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_TenantId_{schemaName}"" ON ""{schemaName}"".""RawMaterials"" (""TenantId"");
                            CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_CompanyId_{schemaName}"" ON ""{schemaName}"".""RawMaterials"" (""CompanyId"");
                            CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_Category_{schemaName}"" ON ""{schemaName}"".""RawMaterials"" (""Category"");
                            CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_Name_{schemaName}"" ON ""{schemaName}"".""RawMaterials"" (""Name"");

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""CaseConfigurations"" (
                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                ""Name"" text NOT NULL DEFAULT '',
                                ""Description"" text NULL,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""ProductId"" uuid NULL,
                                ""UnitsPerCase"" integer NOT NULL DEFAULT 24,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
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
                            ALTER TABLE ""{schemaName}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Name"" text NOT NULL DEFAULT '';
                            ALTER TABLE ""{schemaName}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;
                            ALTER TABLE ""{schemaName}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""ProductId"" uuid NULL;
                            ALTER TABLE ""{schemaName}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""UnitsPerCase"" integer NOT NULL DEFAULT 24;
                            CREATE INDEX IF NOT EXISTS ""IX_CaseConfigurations_TenantId_ProductId_{schemaName}"" ON ""{schemaName}"".""CaseConfigurations"" (""TenantId"", ""ProductId"");
                            CREATE INDEX IF NOT EXISTS ""IX_CaseConfigurations_CompanyId_{schemaName}"" ON ""{schemaName}"".""CaseConfigurations"" (""CompanyId"");

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""ProductionShifts"" (
                                ""Id"" uuid NOT NULL,
                                ""Name"" text NOT NULL,
                                ""StartTime"" text NOT NULL,
                                ""EndTime"" text NOT NULL,
                                ""IsActive"" boolean NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""IsDeleted"" boolean NOT NULL,
                                CONSTRAINT ""PK_ProductionShifts_{schemaName}"" PRIMARY KEY (""Id"")
                            );
                            ALTER TABLE ""{schemaName}"".""ProductionShifts"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""ExpenseCategories"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""Name"" text NOT NULL,
                                ""Description"" text NULL,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_ExpenseCategories_{schemaName}"" PRIMARY KEY (""Id"")
                            );
                            CREATE INDEX IF NOT EXISTS ""IX_ExpenseCategories_TenantId_{schemaName}"" ON ""{schemaName}"".""ExpenseCategories"" (""TenantId"");
                            CREATE INDEX IF NOT EXISTS ""IX_ExpenseCategories_CompanyId_{schemaName}"" ON ""{schemaName}"".""ExpenseCategories"" (""CompanyId"");
                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""AssetCategories"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""Code"" text NOT NULL,
                                ""Name"" text NOT NULL,
                                ""Description"" text NULL,
                                ""IsSystem"" boolean NOT NULL DEFAULT false,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_AssetCategories_{schemaName}"" PRIMARY KEY (""Id"")
                            );
                            CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_TenantId_{schemaName}"" ON ""{schemaName}"".""AssetCategories"" (""TenantId"");
                            CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_CompanyId_{schemaName}"" ON ""{schemaName}"".""AssetCategories"" (""CompanyId"");
                            CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_Code_{schemaName}"" ON ""{schemaName}"".""AssetCategories"" (""Code"");
                            CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_Name_{schemaName}"" ON ""{schemaName}"".""AssetCategories"" (""Name"");
                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""PurchaseCategories"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""Code"" text NOT NULL,
                                ""Name"" text NOT NULL,
                                ""Description"" text NULL,
                                ""Treatment"" text NOT NULL DEFAULT 'Expense',
                                ""IsSystem"" boolean NOT NULL DEFAULT false,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""DefaultLedgerAccount"" text NULL,
                                ""AffectsInventory"" boolean NOT NULL DEFAULT false,
                                ""RequiresAsset"" boolean NOT NULL DEFAULT false,
                                ""RequiresExpense"" boolean NOT NULL DEFAULT false,
                                ""AffectsVendorLedger"" boolean NOT NULL DEFAULT true,
                                ""IsGstApplicable"" boolean NOT NULL DEFAULT true,
                                ""DefaultGstRate"" numeric(18,2) NOT NULL DEFAULT 18.0,
                                ""AllowGstRateChange"" boolean NOT NULL DEFAULT true,
                                ""AllowCustomGstRate"" boolean NOT NULL DEFAULT true,
                                ""RequireQuantity"" boolean NOT NULL DEFAULT false,
                                ""RequireUnit"" boolean NOT NULL DEFAULT false,
                                ""RequireItem"" boolean NOT NULL DEFAULT false,
                                ""RequireServiceDescription"" boolean NOT NULL DEFAULT false,
                                ""RequireAssetDetails"" boolean NOT NULL DEFAULT false,
                                ""RequireInvoiceNumber"" boolean NOT NULL DEFAULT false,
                                ""RequireVendor"" boolean NOT NULL DEFAULT true,
                                ""RequirePaymentDetails"" boolean NOT NULL DEFAULT true,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_PurchaseCategories_{schemaName}"" PRIMARY KEY (""Id"")
                            );
                            CREATE INDEX IF NOT EXISTS ""IX_PurchaseCategories_TenantId_{schemaName}"" ON ""{schemaName}"".""PurchaseCategories"" (""TenantId"");
                            CREATE INDEX IF NOT EXISTS ""IX_PurchaseCategories_Code_{schemaName}"" ON ""{schemaName}"".""PurchaseCategories"" (""Code"");
                            CREATE INDEX IF NOT EXISTS ""IX_PurchaseCategories_Name_{schemaName}"" ON ""{schemaName}"".""PurchaseCategories"" (""Name"");

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""SimpleExpenses"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""ExpenseNumber"" text NOT NULL,
                                ""ExpenseDate"" timestamp with time zone NOT NULL,
                                ""Category"" text NOT NULL,
                                ""Vendor"" text NULL,
                                ""Description"" text NOT NULL,
                                ""Amount"" numeric NOT NULL,
                                ""PaymentMethod"" text NOT NULL,
                                ""BankAccountId"" uuid NULL,
                                ""Notes"" text NULL,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_SimpleExpenses_{schemaName}"" PRIMARY KEY (""Id"")
                            );
                            ALTER TABLE ""{schemaName}"".""SimpleExpenses"" ADD COLUMN IF NOT EXISTS ""BankAccountId"" uuid NULL;

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""BankAccounts"" (
                                ""Id"" uuid NOT NULL,
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
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_BankAccounts_{schemaName}"" PRIMARY KEY (""Id"")
                            );

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""Owners"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""UserId"" uuid NULL,
                                ""Name"" text NOT NULL,
                                ""Phone"" text NOT NULL,
                                ""Email"" text NULL,
                                ""OwnershipPercentage"" numeric NOT NULL,
                                ""InitialInvestment"" numeric NOT NULL,
                                ""CurrentInvestment"" numeric NOT NULL,
                                ""Notes"" text NULL,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_Owners_{schemaName}"" PRIMARY KEY (""Id"")
                            );

                            ALTER TABLE ""{schemaName}"".""Owners"" ADD COLUMN IF NOT EXISTS ""UserId"" uuid NULL;
                            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Owners_TenantId_UserId_{schemaName}"" ON ""{schemaName}"".""Owners"" (""TenantId"", ""UserId"") WHERE ""UserId"" IS NOT NULL AND ""IsDeleted"" = false;

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""OwnerInvestmentTransactions"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""OwnerId"" uuid NOT NULL,
                                ""TransactionDate"" timestamp with time zone NOT NULL,
                                ""Amount"" numeric NOT NULL,
                                ""TransactionType"" text NOT NULL,
                                ""Notes"" text NULL,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL,
                                CONSTRAINT ""PK_OwnerInvestmentTransactions_{schemaName}"" PRIMARY KEY (""Id"")
                            );

                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""TotalAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""AmountReceived"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""OutstandingAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""PaymentStatus"" text NOT NULL DEFAULT 'Pending';
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""ReturnedAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""RefundAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""AdjustmentAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""ReturnType"" text NULL;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""IsReplacementRequired"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""ProductValue"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""DamageCost"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""DamageReason"" text NULL;

                            ALTER TABLE ""{schemaName}"".""Products"" ADD COLUMN IF NOT EXISTS ""SellingPrice"" numeric NOT NULL DEFAULT 15.0;
                            ALTER TABLE ""{schemaName}"".""Products"" ADD COLUMN IF NOT EXISTS ""CostPrice"" numeric NOT NULL DEFAULT 10.0;

                            ALTER TABLE ""{schemaName}"".""RawMaterials"" ADD COLUMN IF NOT EXISTS ""CostPerUnit"" numeric NOT NULL DEFAULT 5.0;

                            CREATE TABLE IF NOT EXISTS ""{schemaName}"".""Companies"" (
                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                ""Name"" text NOT NULL,
                                ""Code"" text NOT NULL,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""TimeZone"" text NULL DEFAULT 'Asia/Kolkata',
                                ""DateFormat"" text NULL DEFAULT 'dd MMM yyyy',
                                ""TimeFormat"" text NULL DEFAULT '12h',
                                ""AdminPinHash"" text NULL,
                                ""ApiKey"" text NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""CreatedBy"" text NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL
                            );

                            ALTER TABLE ""{schemaName}"".""Companies"" ADD COLUMN IF NOT EXISTS ""AdminPinHash"" text NULL;
                            ALTER TABLE ""{schemaName}"".""Companies"" ADD COLUMN IF NOT EXISTS ""ApiKey"" text NULL;
                            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Companies_SingleActiveRoot"" ON ""{schemaName}"".""Companies"" (""TenantId"") WHERE ""IsDeleted"" = false;
                        ";
#pragma warning disable EF1003
                        await tenantContext.Database.ExecuteSqlRawAsync(repairSql);
#pragma warning restore EF1003
                        }
                        catch (Exception repairEx)
                        {
                            Console.WriteLine($"[SCHEMA REPAIR ERROR]: Failed to repair ProductionShifts schema for {schemaName}: {repairEx.Message}");
                        }
                    }
                    
                    if (onProgress != null)
                    {
                        await onProgress(60, "DefaultRolesCreated", "Setting up team access controls...");
                    }

                    // Check for duplicate company record to prevent repeat initialization
                    var existingCompany = await tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                    if (existingCompany != null)
                    {
                        Console.WriteLine($"[PROVISIONING IDEMPOTENT]: Company record already exists in schema '{schemaName}'. Returning existing company and owner role.");
                        result.CompanyId = existingCompany.Id;
                        var existingOwnerRole = await tenantContext.Roles.FirstOrDefaultAsync(r => r.Name == "CompanyAdmin" || r.Name == "Owner");
                        if (existingOwnerRole != null)
                        {
                            result.OwnerRoleId = existingOwnerRole.Id;
                            result.OwnerRoleName = existingOwnerRole.Name;
                        }
                        if (onProgress != null)
                        {
                            await onProgress(100, "ProvisioningCompleted", "Your workspace is ready!");
                        }
                        return result;
                    }

                    // Wrap all seed data updates in a single Postgres transaction
                    var transaction = tenantContext.Database.IsRelational() ? await tenantContext.Database.BeginTransactionAsync() : null;
                    try
                    {
                        // 1. Seed security roles inside schema (Idempotent)
                        var roleNames = new[]
                        {
                            "Owner", "CompanyAdmin", "Accountant", "Admin", "Manager", "Supervisor", "Operator",
                            "Store Keeper", "Sales", "HR", "QC"
                        };
                        Console.WriteLine($"[ROLE SEEDING]: Seeding roles: {string.Join(", ", roleNames)} inside schema '{schemaName}'.");

                        var existingRoles = await tenantContext.Roles.Where(r => r.TenantId == tenantId).ToListAsync();
                        Role ownerRole = existingRoles.FirstOrDefault(r => r.Name == "Owner")!;
                        Role companyAdminRole = existingRoles.FirstOrDefault(r => r.Name == "CompanyAdmin")!;
                        Role accountantRole = existingRoles.FirstOrDefault(r => r.Name == "Accountant")!;
                        Role qcRole = existingRoles.FirstOrDefault(r => r.Name == "QC")!;

                        foreach (var roleName in roleNames)
                        {
                            var code = roleName.Replace(" ", "_").ToUpperInvariant();
                            var role = existingRoles.FirstOrDefault(r => r.Name == roleName || r.Code == code);
                            if (role == null)
                            {
                                role = new Role { Name = roleName, Code = code, TenantId = tenantId };
                                tenantContext.Roles.Add(role);
                                existingRoles.Add(role);
                            }
                            if (roleName == "Owner") ownerRole = role;
                            if (roleName == "CompanyAdmin") companyAdminRole = role;
                            if (roleName == "Accountant") accountantRole = role;
                            if (roleName == "QC") qcRole = role;
                        }
                        await tenantContext.SaveChangesAsync();

                        if (onProgress != null)
                        {
                            await onProgress(70, "DefaultRolesCreated", "Configuring security settings...");
                        }

                        result.OwnerRoleId = ownerRole.Id;
                        result.OwnerRoleName = ownerRole.Name;

                        // 2. Seed dynamic permissions inside schema (Idempotent)
                        var permissionStrings = new[]
                        {
                            Permissions.TenantRead, Permissions.TenantWrite,
                            Permissions.UsersRead, Permissions.UsersWrite,
                            Permissions.RolesRead, Permissions.RolesWrite,
                            Permissions.AuditRead,
                            Permissions.HierarchyRead, Permissions.HierarchyWrite,
                            Permissions.DashboardRead,
                            Permissions.QCRead, Permissions.QCWrite
                        };

                        var existingPermissions = await tenantContext.Permissions.ToListAsync();
                        var seededPermissions = new List<Permission>();
                        foreach (var permStr in permissionStrings)
                        {
                            var p = existingPermissions.FirstOrDefault(ep => ep.Code == permStr);
                            if (p == null)
                            {
                                p = new Permission
                                {
                                    Name = permStr.Replace("Permissions.", "").Replace(".", " "),
                                    Code = permStr
                                };
                                tenantContext.Permissions.Add(p);
                                existingPermissions.Add(p);
                            }
                            seededPermissions.Add(p);
                        }
                        await tenantContext.SaveChangesAsync();

                        if (onProgress != null)
                        {
                            await onProgress(80, "AdministratorUserInitialized", "Setting up your administrator profile...");
                        }

                        // 3. Map permissions: CompanyAdmin and Accountant get all permissions, Owner gets Read-Only permissions (Idempotent)
                        var existingRolePerms = await tenantContext.RolePermissions.Where(rp => rp.TenantId == tenantId).ToListAsync();
                        void EnsureRolePermission(Guid roleId, Guid permId)
                        {
                            if (!existingRolePerms.Any(rp => rp.RoleId == roleId && rp.PermissionId == permId))
                            {
                                var rp = new RolePermission { RoleId = roleId, PermissionId = permId, TenantId = tenantId };
                                tenantContext.RolePermissions.Add(rp);
                                existingRolePerms.Add(rp);
                            }
                        }

                        var ownerReadPerms = seededPermissions.Where(p => p.Code.EndsWith(".Read")).ToList();
                        foreach (var perm in ownerReadPerms)
                        {
                            EnsureRolePermission(ownerRole.Id, perm.Id);
                        }

                        if (companyAdminRole != null)
                        {
                            foreach (var perm in seededPermissions)
                            {
                                EnsureRolePermission(companyAdminRole.Id, perm.Id);
                            }
                        }

                        if (accountantRole != null)
                        {
                            foreach (var perm in seededPermissions)
                            {
                                EnsureRolePermission(accountantRole.Id, perm.Id);
                            }
                        }

                        // Map QC permissions to QC Role
                        if (qcRole != null)
                        {
                            var qcPerms = seededPermissions.Where(p => p.Code.StartsWith("Permissions.QC") || p.Code == Permissions.DashboardRead);
                            foreach (var perm in qcPerms)
                            {
                                EnsureRolePermission(qcRole.Id, perm.Id);
                            }
                        }

                        var existingUserRole = await tenantContext.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == ownerUserId && ur.RoleId == ownerRole.Id && ur.TenantId == tenantId);
                        if (existingUserRole == null)
                        {
                            var userRole = new UserRole
                            {
                                UserId = ownerUserId,
                                RoleId = ownerRole.Id,
                                TenantId = tenantId
                            };
                            tenantContext.UserRoles.Add(userRole);
                            await tenantContext.SaveChangesAsync();
                        }
                        Console.WriteLine($"[USERROLE ASSIGNMENT]: Assigned role '{ownerRole.Name}' (ID: {ownerRole.Id}) to user '{ownerUserId}' inside schema '{schemaName}'.");

                        if (onProgress != null)
                        {
                            await onProgress(90, "ManufacturingModulesInitialized", "Applying default settings...");
                        }

                        // 4. Create initial Company entity inside the schema if not already present
                        var companyInDb = await tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                        var companyId = companyInDb?.Id ?? Guid.NewGuid();
                        if (companyInDb == null)
                        {
                            var company = new Company
                            {
                                Id = companyId,
                                Name = companyName,
                                Code = companyCode.ToUpperInvariant(),
                                TenantId = tenantId,
                                IsActive = true
                            };
                            tenantContext.Companies.Add(company);
                        }

                        // Create default onboarding audit record
                        var auditLog = new AuditLog
                        {
                            Action = "TenantOnboardingCompleted",
                            TableName = "Tenant",
                            UserId = ownerUserId.ToString(),
                            UserEmail = "system@aquora.com",
                            TenantId = tenantId,
                            Timestamp = DateTime.UtcNow,
                            Reason = "Tenant onboarding initialized and completed successfully. Seeding default roles, permissions, main warehouse, units (Bag, PCS, KG, Unit), material categories, and initial settings.",
                            Module = "Onboarding",
                            IpAddress = "127.0.0.1",
                            Device = "Server"
                        };
                        tenantContext.AuditLogs.Add(auditLog);
                        await tenantContext.SaveChangesAsync();

                        // Seed default station configurations in public schema if not already present
                        var existingConfigs = await _platformContext.TenantProductionConfigurations
                            .Where(c => c.TenantId == tenantId)
                            .ToListAsync();
                        if (!existingConfigs.Any())
                        {
                            var allStations = new[] { "Blowing", "Filling", "Labeling", "Packing" };
                            foreach (var station in allStations)
                            {
                                var isEnabled = enabledStations == null || enabledStations.Contains(station, StringComparer.OrdinalIgnoreCase);
                                var config = new TenantProductionConfiguration
                                {
                                    Id = Guid.NewGuid(),
                                    TenantId = tenantId,
                                    StationName = station,
                                    IsEnabled = isEnabled,
                                    CreatedAt = DateTime.UtcNow,
                                    CreatedBy = "System Onboarding"
                                };
                                _platformContext.TenantProductionConfigurations.Add(config);
                            }
                            await _platformContext.SaveChangesAsync();
                        }

                        // 5. Seed complete canonical QC default parameters and settings inside tenant schema
                        await QCDataSeeder.SeedQCDefaultParametersAsync(tenantContext, "System Provisioning");

                        if (transaction != null)
                        {
                            await transaction.CommitAsync();
                            await transaction.DisposeAsync();
                        }
                        result.CompanyId = companyId;
                    }
                    catch
                    {
                        if (transaction != null)
                        {
                            await transaction.RollbackAsync();
                            await transaction.DisposeAsync();
                        }
                        throw;
                    }
                }

                return result;
            }
            catch
            {
                // Preserve schema for safe incremental retry and diagnostic investigation
                throw;
            }
            finally
            {
                AuditState.IsDisabled = false;
            }
        }
    }
}
