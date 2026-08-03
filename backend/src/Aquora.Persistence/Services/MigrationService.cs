using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;

namespace Aquora.Persistence.Services
{
    public class MigrationService : IMigrationService
    {
        private readonly PlatformDbContext _platformContext;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MigrationService> _logger;

        public MigrationService(PlatformDbContext platformContext, IServiceProvider serviceProvider, ILogger<MigrationService> logger)
        {
            _platformContext = platformContext;
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task MigrateAllAsync()
        {
            try
            {
                _logger.LogInformation("Executing Platform Database Migrations (public schema)...");
                await _platformContext.Database.MigrateAsync();
                _logger.LogInformation("Platform Database Migrations applied successfully.");

                // Auto-repair missing columns in public."Tenants" and public."Users" tables
                _logger.LogInformation("[SCHEMA REPAIR] Ensuring missing columns exist on public.Tenants and public.Users...");
                var platformRepairScript = @"
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""OwnerName"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""OwnerEmail"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""OwnerPhone"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""Address"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""GstNumber"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""PanNumber"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""LicenseNumber"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""SubscriptionPlan"" text NOT NULL DEFAULT 'Starter';
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""Timezone"" text NOT NULL DEFAULT 'UTC';
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""Currency"" text NOT NULL DEFAULT 'USD';
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""Language"" text NOT NULL DEFAULT 'en';
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""LogoUrl"" text NULL;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""Theme"" text NOT NULL DEFAULT 'light';
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""StorageUsedMb"" double precision NOT NULL DEFAULT 0.0;
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""ActiveUsersCount"" integer NOT NULL DEFAULT 0;

                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Phone"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""RoleName"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Designation"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Shift"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Salary"" numeric NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""JoiningDate"" timestamp with time zone NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""PhotoUrl"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""DevicesCount"" integer NOT NULL DEFAULT 1;

                CREATE TABLE IF NOT EXISTS public.""SubscriptionPlans"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""Name"" text NOT NULL,
                    ""Code"" text NOT NULL,
                    ""Description"" text NOT NULL,
                    ""MonthlyPrice"" numeric NOT NULL,
                    ""YearlyPrice"" numeric NOT NULL,
                    ""OfferPrice"" numeric NULL,
                    ""DiscountPercent"" numeric NULL,
                    ""Currency"" text NOT NULL DEFAULT 'USD',
                    ""BillingCycle"" text NOT NULL DEFAULT 'Monthly',
                    ""TrialDays"" integer NOT NULL DEFAULT 14,
                    ""DurationDays"" integer NOT NULL DEFAULT 30,
                    ""DisplayOrder"" integer NOT NULL DEFAULT 1,
                    ""IsPopular"" boolean NOT NULL DEFAULT false,
                    ""IsRecommended"" boolean NOT NULL DEFAULT false,
                    ""Color"" text NOT NULL DEFAULT '#3B82F6',
                    ""Status"" text NOT NULL DEFAULT 'Published',
                    ""TaxType"" text NOT NULL DEFAULT 'Tax Exclusive',
                    ""AutoActivateTrial"" boolean NOT NULL DEFAULT true,
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

                CREATE TABLE IF NOT EXISTS public.""SubscriptionPlanLimits"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""PlanId"" uuid NOT NULL REFERENCES public.""SubscriptionPlans""(""Id"") ON DELETE CASCADE,
                    ""ProductionLines"" integer NOT NULL DEFAULT 3,
                    ""Machines"" integer NOT NULL DEFAULT 10,
                    ""Employees"" integer NOT NULL DEFAULT 25,
                    ""Customers"" integer NOT NULL DEFAULT 100,
                    ""Suppliers"" integer NOT NULL DEFAULT 50,
                    ""Warehouses"" integer NOT NULL DEFAULT 2,
                    ""ProductionBatches"" integer NOT NULL DEFAULT 500,
                    ""Products"" integer NOT NULL DEFAULT 100,
                    ""RawMaterials"" integer NOT NULL DEFAULT 200,
                    ""StorageGB"" integer NOT NULL DEFAULT 50,
                    ""APIRequestsPerMin"" integer NOT NULL DEFAULT 1000,
                    ""FileUploadSizeMB"" integer NOT NULL DEFAULT 25,
                    ""DailyExports"" integer NOT NULL DEFAULT 50,
                    ""ConcurrentUsers"" integer NOT NULL DEFAULT 10,
                    ""SMSLimit"" integer NOT NULL DEFAULT 100,
                    ""EmailLimit"" integer NOT NULL DEFAULT 1000,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" timestamp with time zone NULL
                );

                CREATE TABLE IF NOT EXISTS public.""SubscriptionFeatures"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""PlanId"" uuid NOT NULL REFERENCES public.""SubscriptionPlans""(""Id"") ON DELETE CASCADE,
                    ""FeatureName"" text NOT NULL,
                    ""FeatureDescription"" text NULL,
                    ""FeatureCategory"" text NOT NULL DEFAULT 'Core Modules',
                    ""FeatureValue"" text NOT NULL DEFAULT 'Yes',
                    ""FeatureUnit"" text NULL,
                    ""DisplayOrder"" integer NOT NULL DEFAULT 1,
                    ""IsHighlighted"" boolean NOT NULL DEFAULT false,
                    ""IsUnlimited"" boolean NOT NULL DEFAULT false,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS public.""TenantSubscriptions"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""PlanId"" uuid NOT NULL,
                    ""PlanName"" text NOT NULL,
                    ""Status"" text NOT NULL DEFAULT 'Active',
                    ""BillingCycle"" text NOT NULL DEFAULT 'Monthly',
                    ""PricePaid"" numeric NOT NULL DEFAULT 0.0,
                    ""Currency"" text NOT NULL DEFAULT 'USD',
                    ""StartDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""EndDate"" timestamp with time zone NOT NULL,
                    ""TrialEndDate"" timestamp with time zone NULL,
                    ""AutoRenew"" boolean NOT NULL DEFAULT true,
                    ""AssignedByUserId"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" timestamp with time zone NULL
                );

                CREATE TABLE IF NOT EXISTS public.""SubscriptionAuditLogs"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""PlanId"" uuid NULL,
                    ""TenantId"" uuid NULL,
                    ""Action"" text NOT NULL,
                    ""PerformerUserId"" text NOT NULL,
                    ""PerformerUserEmail"" text NOT NULL,
                    ""OldValuesJson"" text NULL,
                    ""NewValuesJson"" text NULL,
                    ""Reason"" text NOT NULL,
                    ""Timestamp"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""IpAddress"" text NOT NULL DEFAULT '127.0.0.1'
                );
                ";
                await _platformContext.Database.ExecuteSqlRawAsync(platformRepairScript);

                _logger.LogInformation("Executing Tenant Database Migrations for active tenants...");
                var tenants = await _platformContext.Set<Aquora.Domain.Entities.Tenant>()
                    .Where(t => t.IsActive && !t.IsDeleted)
                    .ToListAsync();

                _logger.LogInformation("--- Platform Database Dump (public schema) ---");
                _logger.LogInformation("Total Tenants found: {Count}", tenants.Count);
                foreach (var t in tenants)
                {
                    _logger.LogInformation("  Tenant: ID={Id}, Name='{Name}', Code='{Code}', Schema='{Schema}', Created={Created}", 
                        t.Id, t.Name, t.Code, t.SchemaName, t.CreatedAt);
                }

                var users = await _platformContext.Set<Aquora.Domain.Entities.User>()
                    .Where(u => !u.IsDeleted)
                    .ToListAsync();
                _logger.LogInformation("Total Users found: {Count}", users.Count);
                foreach (var u in users)
                {
                    _logger.LogInformation("  User: ID={Id}, Name='{Name}', Email='{Email}', TenantId={TenantId}, Created={Created}", 
                        u.Id, $"{u.FirstName} {u.LastName}", u.Email, u.TenantId, u.CreatedAt);
                }
                _logger.LogInformation("----------------------------------------------");

                foreach (var tenant in tenants)
                {
                    try
                    {
                        _logger.LogInformation($"Migrating tenant: {tenant.Name} (Schema: {tenant.SchemaName})...");
                        using (var tenantScope = _serviceProvider.CreateScope())
                        {
                            var tenantProvider = tenantScope.ServiceProvider.GetRequiredService<ITenantProvider>();
                            tenantProvider.SetTenantId(tenant.Id);
                            tenantProvider.SetTenantSchemaName(tenant.SchemaName);

                            var tenantContext = tenantScope.ServiceProvider.GetRequiredService<TenantDbContext>();
                            TenantSchemaResolver.CurrentSchemaName = tenant.SchemaName;

                            try
                            {
                                await tenantContext.Database.MigrateAsync();
                            }
                            catch (Npgsql.NpgsqlException npgEx) when (npgEx.SqlState == "42P07" || npgEx.Message.Contains("already exists"))
                            {
                                _logger.LogWarning($"[MIGRATION WARN]: Schema '{tenant.SchemaName}' tables already exist. Resuming setup safely.");
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning($"[MIGRATION WARN]: Non-fatal migration error: {ex.Message}");
                            }


                            // [ADDED] Auto-repair multi-tenant schema generation bug
                            // If EF migrations were evaluated with `public` schema in cache, 
                            // they might skip creating tables in tenant schemas.
                            _logger.LogInformation($"[SCHEMA REPAIR] Ensuring missing tables exist for {tenant.SchemaName}...");
                            var repairScript = $@"
                            CREATE TABLE IF NOT EXISTS ""{tenant.SchemaName}"".""ProductionShifts"" (
                                ""Id"" uuid NOT NULL,
                                ""Name"" text NOT NULL,
                                ""StartTime"" text NOT NULL,
                                ""EndTime"" text NOT NULL,
                                ""Description"" text NULL,
                                ""IsActive"" boolean NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""CreatedBy"" text NULL,
                                ""UpdatedBy"" text NULL,
                                ""DeletedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""DeletedByIP"" text NULL,
                                ""CreatedAt"" timestamp with time zone NOT NULL,
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""IsDeleted"" boolean NOT NULL,
                                CONSTRAINT ""PK_ProductionShifts"" PRIMARY KEY (""Id"")
                            );
                            
                            ALTER TABLE ""{tenant.SchemaName}"".""ProductionShifts"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;
                            
                            -- Completely drop orphaned RowVersion from EF model mismatch
                            ALTER TABLE ""{tenant.SchemaName}"".""Products"" DROP COLUMN IF EXISTS ""RowVersion"";
                            ALTER TABLE ""{tenant.SchemaName}"".""Products"" DROP COLUMN IF EXISTS ""UnitCost"";
                            ALTER TABLE ""{tenant.SchemaName}"".""Brands"" DROP COLUMN IF EXISTS ""RowVersion"";
                            ALTER TABLE ""{tenant.SchemaName}"".""InventoryMovements"" DROP COLUMN IF EXISTS ""RowVersion"";
                            ALTER TABLE ""{tenant.SchemaName}"".""RawMaterials"" DROP COLUMN IF EXISTS ""RowVersion"";
                            ALTER TABLE ""{tenant.SchemaName}"".""Companies"" DROP COLUMN IF EXISTS ""RowVersion"";
                            ALTER TABLE ""{tenant.SchemaName}"".""Customers"" DROP COLUMN IF EXISTS ""RowVersion"";
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" DROP COLUMN IF EXISTS ""RowVersion"";

                            -- Simple Accounts V1 Module Tables & Columns Repair
                            CREATE TABLE IF NOT EXISTS ""{tenant.SchemaName}"".""SimpleExpenses"" (
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
                                CONSTRAINT ""PK_SimpleExpenses_{tenant.SchemaName}"" PRIMARY KEY (""Id"")
                            );
                            ALTER TABLE ""{tenant.SchemaName}"".""SimpleExpenses"" ADD COLUMN IF NOT EXISTS ""BankAccountId"" uuid NULL;

                            CREATE TABLE IF NOT EXISTS ""{tenant.SchemaName}"".""BankAccounts"" (
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
                                CONSTRAINT ""PK_BankAccounts_{tenant.SchemaName}"" PRIMARY KEY (""Id"")
                            );

                            CREATE TABLE IF NOT EXISTS ""{tenant.SchemaName}"".""Owners"" (
                                ""Id"" uuid NOT NULL,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
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
                                CONSTRAINT ""PK_Owners_{tenant.SchemaName}"" PRIMARY KEY (""Id"")
                            );

                            CREATE TABLE IF NOT EXISTS ""{tenant.SchemaName}"".""OwnerInvestmentTransactions"" (
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
                                CONSTRAINT ""PK_OwnerInvestmentTransactions_{tenant.SchemaName}"" PRIMARY KEY (""Id"")
                            );

                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""TotalAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""AmountReceived"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""OutstandingAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""PaymentStatus"" text NOT NULL DEFAULT 'Pending';
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""ReturnedAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""RefundAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""AdjustmentAmount"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""ReturnType"" text NULL;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""IsReplacementRequired"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""ProductValue"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""DamageCost"" numeric NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""DamageReason"" text NULL;

                            ALTER TABLE ""{tenant.SchemaName}"".""Products"" ADD COLUMN IF NOT EXISTS ""SellingPrice"" numeric NOT NULL DEFAULT 15.0;
                            ALTER TABLE ""{tenant.SchemaName}"".""Products"" ADD COLUMN IF NOT EXISTS ""CostPrice"" numeric NOT NULL DEFAULT 10.0;

                            ALTER TABLE ""{tenant.SchemaName}"".""RawMaterials"" ADD COLUMN IF NOT EXISTS ""CostPerUnit"" numeric NOT NULL DEFAULT 5.0;
                            ";
                            await tenantContext.Database.ExecuteSqlRawAsync(repairScript);

                            // Reconcile and migrate historical raw material stock to inventory movements
                            var rawMaterials = await tenantContext.RawMaterials.Where(rm => !rm.IsDeleted).ToListAsync();
                            bool reconciledAny = false;
                            foreach (var rm in rawMaterials)
                            {
                                var movementsSum = await tenantContext.InventoryMovements
                                    .Where(m => m.RawMaterialId == rm.Id && !m.IsDeleted)
                                    .SumAsync(m => m.Quantity);

                                var diff = rm.CurrentStock - movementsSum;
                                if (diff != 0)
                                {
                                    _logger.LogInformation($"[RECONCILIATION] RawMaterial '{rm.Name}' (ID: {rm.Id}) stock mismatch in '{tenant.SchemaName}': CurrentStock={rm.CurrentStock}, MovementsSum={movementsSum}. Reconciling diff of {diff}.");
                                    
                                    var reconciliationMovement = new InventoryMovement
                                    {
                                        Id = Guid.NewGuid(),
                                        RawMaterialId = rm.Id,
                                        Quantity = diff,
                                        ReferenceType = "OpeningStock",
                                        ReferenceId = rm.Id,
                                        TenantId = tenant.Id,
                                        CompanyId = rm.CompanyId,
                                        CreatedAt = DateTime.UtcNow,
                                        CreatedBy = "System Migration",
                                        IsDeleted = false
                                    };
                                    tenantContext.InventoryMovements.Add(reconciliationMovement);
                                    reconciledAny = true;
                                }
                            }
                            if (reconciledAny)
                            {
                                await tenantContext.SaveChangesAsync();
                            }

                            // Auto-repair product categories for Jar products
                            var jarProducts = await tenantContext.Products
                                .Where(p => p.Name.ToLower().Contains("jar") && p.Category != "20L Jar")
                                .ToListAsync();
                            if (jarProducts.Any())
                            {
                                _logger.LogInformation($"[REPAIR] Found {jarProducts.Count} jar products in '{tenant.SchemaName}' with incorrect category. Fixing...");
                                foreach (var jp in jarProducts)
                                {
                                    jp.Category = "20L Jar";
                                }
                                await tenantContext.SaveChangesAsync();
                            }

                            // GOD MODE ENFORCEMENT: Validate the Tenant Schema after repair
                            var validator = _serviceProvider.GetRequiredService<DatabaseSchemaValidator>();
                            await validator.ValidateSchemaAsync(tenantContext, tenant.SchemaName);
                        }
                        _logger.LogInformation($"Tenant {tenant.Name} migrated successfully.");
                    }
                    catch (Exception tenantEx)
                    {
                        _logger.LogError(tenantEx, $"Failed to migrate tenant schema for: {tenant.Name}");
                    }
                }
                _logger.LogInformation("Tenant Database Migrations completed.");
            }
            catch (Exception migrationEx)
            {
                _logger.LogError(migrationEx, "A critical error occurred during database migrations.");
                throw;
            }
        }
    }
}
