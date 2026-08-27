using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Shared.Constants;

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

                // Self-heal: Drop NOT NULL constraint on PlatformAuditLogs columns which causes login crash
                _logger.LogInformation("[SCHEMA FIX] Altering PlatformAuditLogs columns to nullable...");
                try
                {
#pragma warning disable EF1003
                    await _platformContext.Database.ExecuteSqlRawAsync(@"
                        ALTER TABLE public.""PlatformAuditLogs"" ALTER COLUMN ""OldValues"" DROP NOT NULL;
                        ALTER TABLE public.""PlatformAuditLogs"" ALTER COLUMN ""NewValues"" DROP NOT NULL;
                    ");
#pragma warning restore EF1003
                    _logger.LogInformation("[SCHEMA FIX] PlatformAuditLogs columns altered successfully.");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[SCHEMA FIX WARN] Failed to drop NOT NULL constraints on PlatformAuditLogs: {Message}", ex.Message);
                }

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
                ALTER TABLE public.""Tenants"" ADD COLUMN IF NOT EXISTS ""IsBiodropsProduction"" boolean NOT NULL DEFAULT false;

                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Phone"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""RoleName"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Designation"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Shift"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""Salary"" numeric NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""JoiningDate"" timestamp with time zone NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""PhotoUrl"" text NULL;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""DevicesCount"" integer NOT NULL DEFAULT 1;
                ALTER TABLE public.""Users"" ADD COLUMN IF NOT EXISTS ""CurrentSalary"" numeric NULL;

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
#pragma warning disable EF1003
                await _platformContext.Database.ExecuteSqlRawAsync(platformRepairScript);
#pragma warning restore EF1003

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

                             // Check migration history and clean up legacy manually-created tables
                              bool hasFinanceModule = false;
                              bool hasSimpleAccounts = false;
                              bool hasBankLedger = false;
                              bool hasProductPricing = false;
                              bool hasConcurrencyTokens = false;
                              bool hasRemoveRowVersion = false;
                               try
                               {
                                   var conn = tenantContext.Database.GetDbConnection();
                                   if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
                                   
                                   using (var cmd = conn.CreateCommand())
                                   {
                                       cmd.CommandText = $@"
                                           SELECT EXISTS (
                                               SELECT FROM information_schema.tables 
                                               WHERE table_schema = '{tenant.SchemaName}' 
                                               AND table_name = '__EFMigrationsHistory'
                                           );";
                                       var historyExists = (bool)(await cmd.ExecuteScalarAsync() ?? false);
                                       if (historyExists)
                                       {
                                           cmd.CommandText = $@"SELECT ""MigrationId"" FROM ""{tenant.SchemaName}"".""__EFMigrationsHistory"";";
                                           using (var reader = await cmd.ExecuteReaderAsync())
                                           {
                                               var applied = new HashSet<string>();
                                               while (await reader.ReadAsync())
                                               {
                                                   applied.Add(reader.GetString(0));
                                               }
                                               hasFinanceModule = applied.Contains("20260729191421_AddFinanceModule");
                                               hasSimpleAccounts = applied.Contains("20260803120000_AddSimpleAccountsModule");
                                               hasBankLedger = applied.Contains("20260803073729_AddBankLedgerEntry");
                                               hasProductPricing = applied.Contains("20260729200058_AddProductPricing");
                                               hasConcurrencyTokens = applied.Contains("20260725103118_AddConcurrencyTokens");
                                               hasRemoveRowVersion = applied.Contains("20260730071552_RemoveRowVersion");
                                           }
                                       }
                                   }

                                   using (var cmd = conn.CreateCommand())
                                   {
                                       if (!hasProductPricing)
                                       {
                                           _logger.LogInformation($"[SELF-HEAL] Dropping legacy Product pricing columns for {tenant.SchemaName} to allow EF migration...");
                                           cmd.CommandText = $@"
                                               ALTER TABLE ""{tenant.SchemaName}"".""Products"" DROP COLUMN IF EXISTS ""SellingPrice"";
                                               ALTER TABLE ""{tenant.SchemaName}"".""Products"" DROP COLUMN IF EXISTS ""UnitCost"";";
                                           await cmd.ExecuteNonQueryAsync();
                                       }

                                       // Only drop RowVersion from DB if AddConcurrencyTokens has NOT run yet, or if RemoveRowVersion HAS run.
                                       // If AddConcurrencyTokens HAS run but RemoveRowVersion has NOT, we must leave RowVersion there so EF Core's RemoveRowVersion migration can drop it.
                                       if (!hasConcurrencyTokens)
                                       {
                                           _logger.LogInformation($"[SELF-HEAL] Dropping legacy RowVersion columns from {tenant.SchemaName} to allow EF Core to add them...");
                                           cmd.CommandText = $@"
                                               ALTER TABLE ""{tenant.SchemaName}"".""Products"" DROP COLUMN IF EXISTS ""RowVersion"";
                                               ALTER TABLE ""{tenant.SchemaName}"".""RawMaterials"" DROP COLUMN IF EXISTS ""RowVersion"";";
                                           await cmd.ExecuteNonQueryAsync();
                                       }
                                       else if (!hasRemoveRowVersion)
                                       {
                                           _logger.LogInformation($"[SELF-HEAL] Ensuring RowVersion columns exist in {tenant.SchemaName} so EF Core's RemoveRowVersion migration can drop them...");
                                           cmd.CommandText = $@"
                                               ALTER TABLE ""{tenant.SchemaName}"".""Products"" ADD COLUMN IF NOT EXISTS ""RowVersion"" bytea NULL;
                                               ALTER TABLE ""{tenant.SchemaName}"".""RawMaterials"" ADD COLUMN IF NOT EXISTS ""RowVersion"" bytea NULL;";
                                           await cmd.ExecuteNonQueryAsync();
                                       }
                                       else if (hasRemoveRowVersion)
                                       {
                                           _logger.LogInformation($"[SELF-HEAL] Cleaning up orphaned RowVersion columns from {tenant.SchemaName}...");
                                           cmd.CommandText = $@"
                                               ALTER TABLE ""{tenant.SchemaName}"".""Products"" DROP COLUMN IF EXISTS ""RowVersion"";
                                               ALTER TABLE ""{tenant.SchemaName}"".""RawMaterials"" DROP COLUMN IF EXISTS ""RowVersion"";";
                                           await cmd.ExecuteNonQueryAsync();
                                       }
                                   }
                               }
                               catch (Exception ex)
                               {
                                   _logger.LogWarning($"[SELF-HEAL WARN]: Failed legacy tables cleanup for {tenant.SchemaName}: {ex.Message}");
                               }

                             await tenantContext.Database.MigrateAsync();

                            _logger.LogInformation($"[SCHEMA SYNC] Applying EF Core migrations for {tenant.SchemaName}...");

                            // Ensure EventType, EventLabel, AuditNotes exist and populate legacy nulls
                            try
                            {
                                var conn = tenantContext.Database.GetDbConnection();
                                if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
                                using (var cmd = conn.CreateCommand())
                                {
                                    cmd.CommandText = $@"
                                         ALTER TABLE ""{tenant.SchemaName}"".""BankLedgerEntries"" ADD COLUMN IF NOT EXISTS ""EventType"" text NULL DEFAULT 'CREATED';
                                         ALTER TABLE ""{tenant.SchemaName}"".""BankLedgerEntries"" ADD COLUMN IF NOT EXISTS ""EventLabel"" text NULL;
                                         ALTER TABLE ""{tenant.SchemaName}"".""BankLedgerEntries"" ADD COLUMN IF NOT EXISTS ""AuditNotes"" text NULL;
                                         ALTER TABLE ""{tenant.SchemaName}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Price"" numeric NOT NULL DEFAULT 0;
                                         ALTER TABLE ""{tenant.SchemaName}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Discount"" numeric NOT NULL DEFAULT 0;
                                         ALTER TABLE ""{tenant.SchemaName}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""ProductId"" uuid NULL;
                                         ALTER TABLE ""{tenant.SchemaName}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""UnitsPerCase"" integer NOT NULL DEFAULT 24;
                                         ALTER TABLE ""{tenant.SchemaName}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""ParentTransactionId"" uuid NULL;
                                         CREATE INDEX IF NOT EXISTS ""IX_SalesTransactions_ParentTransactionId"" ON ""{tenant.SchemaName}"".""SalesTransactions"" (""ParentTransactionId"");
                                         
                                         CREATE TABLE IF NOT EXISTS ""{tenant.SchemaName}"".""MonthlySalaries"" (
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

                                          ALTER TABLE ""{tenant.SchemaName}"".""MonthlySalaries"" ADD COLUMN IF NOT EXISTS ""IsFinalized"" boolean NOT NULL DEFAULT false;
                                          ALTER TABLE ""{tenant.SchemaName}"".""MonthlySalaries"" ADD COLUMN IF NOT EXISTS ""FinalizedAt"" timestamp with time zone NULL;
                                          ALTER TABLE ""{tenant.SchemaName}"".""MonthlySalaries"" ADD COLUMN IF NOT EXISTS ""FinalizedBy"" text NULL;
                                          ALTER TABLE ""{tenant.SchemaName}"".""SalaryPayments"" ADD COLUMN IF NOT EXISTS ""MonthlySalaryId"" uuid NULL;
                                         ALTER TABLE ""{tenant.SchemaName}"".""SalaryPayments"" ADD COLUMN IF NOT EXISTS ""PaymentType"" text NOT NULL DEFAULT 'Salary Settlement';
                                         ALTER TABLE ""{tenant.SchemaName}"".""SalaryPayments"" ADD COLUMN IF NOT EXISTS ""Amount"" numeric NOT NULL DEFAULT 0.0;
                                         UPDATE ""{tenant.SchemaName}"".""SalaryPayments"" SET ""Amount"" = ""NetSalary"" WHERE (""Amount"" IS NULL OR ""Amount"" = 0.0) AND ""NetSalary"" > 0.0;
                                         ALTER TABLE ""{tenant.SchemaName}"".""WaterTestReports"" ADD COLUMN IF NOT EXISTS ""ConcurrencyToken"" text NULL;
                                         UPDATE ""{tenant.SchemaName}"".""WaterTestReports"" SET ""ConcurrencyToken"" = md5(random()::text || clock_timestamp()::text) WHERE ""ConcurrencyToken"" IS NULL OR ""ConcurrencyToken"" = '';
                                         ALTER TABLE ""{tenant.SchemaName}"".""WaterTestReports"" ALTER COLUMN ""ConcurrencyToken"" SET NOT NULL;
                                         ALTER TABLE ""{tenant.SchemaName}"".""WaterTestReports"" ALTER COLUMN ""ConcurrencyToken"" SET DEFAULT md5(random()::text || clock_timestamp()::text);
                                         UPDATE ""{tenant.SchemaName}"".""BankLedgerEntries"" SET ""EventType"" = 'CREATED' WHERE ""EventType"" IS NULL OR ""EventType"" = '';

                                         CREATE TABLE IF NOT EXISTS ""{tenant.SchemaName}"".""OperationsIssueAffectedMachines"" (
                                             ""Id"" uuid NOT NULL PRIMARY KEY,
                                             ""IssueId"" uuid NOT NULL,
                                             ""MachineId"" uuid NOT NULL,
                                             ""MachineName"" text NOT NULL,
                                             ""MachineCode"" text NULL,
                                             CONSTRAINT fk_issue_affected_machines FOREIGN KEY (""IssueId"") REFERENCES ""{tenant.SchemaName}"".""OperationsIssues"" (""Id"") ON DELETE CASCADE
                                         );

                                         CREATE UNIQUE INDEX IF NOT EXISTS uq_issue_affected_machines ON ""{tenant.SchemaName}"".""OperationsIssueAffectedMachines"" (""IssueId"", ""MachineId"");

                                         INSERT INTO ""{tenant.SchemaName}"".""OperationsIssueAffectedMachines"" (""Id"", ""IssueId"", ""MachineId"", ""MachineName"")
                                         SELECT gen_random_uuid(), ""Id"", ""MachineId"", COALESCE(""MachineName"", 'Primary Machine')
                                         FROM ""{tenant.SchemaName}"".""OperationsIssues""
                                         WHERE ""MachineId"" IS NOT NULL
                                         AND NOT EXISTS (
                                             SELECT 1 FROM ""{tenant.SchemaName}"".""OperationsIssueAffectedMachines"" m WHERE m.""IssueId"" = ""{tenant.SchemaName}"".""OperationsIssues"".""Id"" AND m.""MachineId"" = ""{tenant.SchemaName}"".""OperationsIssues"".""MachineId""
                                         );";
                                    await cmd.ExecuteNonQueryAsync();
                                }
                            }
                            catch (Exception repairEx)
                            {
                                _logger.LogWarning($"[SCHEMA REPAIR WARN] EventType column repair failed for {tenant.SchemaName}: {repairEx.Message}");
                            }

                            // Reconcile and migrate historical raw material stock to inventory movements
                            var rawMaterials = await tenantContext.RawMaterials.Where(rm => !rm.IsDeleted).ToListAsync();
                            var movementsSums = await tenantContext.InventoryMovements
                                .Where(m => m.RawMaterialId != null && !m.IsDeleted)
                                .GroupBy(m => m.RawMaterialId!.Value)
                                .Select(g => new { RawMaterialId = g.Key, TotalQuantity = g.Sum(m => m.Quantity) })
                                .ToDictionaryAsync(x => x.RawMaterialId, x => x.TotalQuantity);

                            bool reconciledAny = false;
                            foreach (var rm in rawMaterials)
                            {
                                var movementsSum = movementsSums.TryGetValue(rm.Id, out var sum) ? sum : 0m;
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
                            }
                            // Ensure QC Role exists for the tenant
                            var qcRole = await tenantContext.Roles.FirstOrDefaultAsync(r => r.Code == "QC");
                            if (qcRole == null)
                            {
                                _logger.LogInformation($"[REPAIR] Adding missing QC role to schema '{tenant.SchemaName}'...");
                                qcRole = new Role { Name = "QC", Code = "QC", TenantId = tenant.Id };
                                tenantContext.Roles.Add(qcRole);
                                await tenantContext.SaveChangesAsync();
                            }

                            // Ensure QC Permissions exist
                            var permQCRead = await tenantContext.Permissions.FirstOrDefaultAsync(p => p.Code == Permissions.QCRead);
                            if (permQCRead == null)
                            {
                                permQCRead = new Permission { Name = "QC Read", Code = Permissions.QCRead };
                                tenantContext.Permissions.Add(permQCRead);
                                await tenantContext.SaveChangesAsync();
                            }
                            var permQCWrite = await tenantContext.Permissions.FirstOrDefaultAsync(p => p.Code == Permissions.QCWrite);
                            if (permQCWrite == null)
                            {
                                permQCWrite = new Permission { Name = "QC Write", Code = Permissions.QCWrite };
                                tenantContext.Permissions.Add(permQCWrite);
                                await tenantContext.SaveChangesAsync();
                            }
                            var permDashboard = await tenantContext.Permissions.FirstOrDefaultAsync(p => p.Code == Permissions.DashboardRead);

                            // Map QC permissions to QC Role
                            var qcPermIds = new List<Guid> { permQCRead.Id, permQCWrite.Id };
                            if (permDashboard != null) qcPermIds.Add(permDashboard.Id);
                            
                            foreach (var pId in qcPermIds)
                            {
                                if (!await tenantContext.RolePermissions.AnyAsync(rp => rp.RoleId == qcRole.Id && rp.PermissionId == pId))
                                {
                                    tenantContext.RolePermissions.Add(new RolePermission { RoleId = qcRole.Id, PermissionId = pId, TenantId = tenant.Id });
                                }
                            }

                            // Map QC permissions to CompanyAdmin Role
                            var adminRole = await tenantContext.Roles.FirstOrDefaultAsync(r => r.Code == "COMPANYADMIN" || r.Name == "CompanyAdmin");
                            if (adminRole != null)
                            {
                                foreach (var pId in new[] { permQCRead.Id, permQCWrite.Id })
                                {
                                    if (!await tenantContext.RolePermissions.AnyAsync(rp => rp.RoleId == adminRole.Id && rp.PermissionId == pId))
                                    {
                                        tenantContext.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = pId, TenantId = tenant.Id });
                                    }
                                }
                            }

                            // Ensure Accountant Role exists and inherits exactly all permissions from CompanyAdmin
                            var accountantRole = await tenantContext.Roles.FirstOrDefaultAsync(r => r.Code == "ACCOUNTANT" || r.Name == "Accountant");
                            if (accountantRole == null)
                            {
                                _logger.LogInformation($"[REPAIR] Adding missing Accountant role to schema '{tenant.SchemaName}'...");
                                accountantRole = new Role { Name = "Accountant", Code = "ACCOUNTANT", TenantId = tenant.Id };
                                tenantContext.Roles.Add(accountantRole);
                                await tenantContext.SaveChangesAsync();
                            }

                            if (adminRole != null && accountantRole != null)
                            {
                                var adminPermIds = await tenantContext.RolePermissions
                                    .Where(rp => rp.RoleId == adminRole.Id)
                                    .Select(rp => rp.PermissionId)
                                    .ToListAsync();

                                foreach (var pId in adminPermIds)
                                {
                                    if (!await tenantContext.RolePermissions.AnyAsync(rp => rp.RoleId == accountantRole.Id && rp.PermissionId == pId))
                                    {
                                        tenantContext.RolePermissions.Add(new RolePermission { RoleId = accountantRole.Id, PermissionId = pId, TenantId = tenant.Id });
                                    }
                                }
                            }
                            
                            await tenantContext.SaveChangesAsync();

                            // Auto-repair invalid default dates (0001-01-01, default/empty values, etc.)
                            _logger.LogInformation($"[REPAIR-DATETIME] Repairing default/invalid timestamps in schema '{tenant.SchemaName}'...");
                            var schema = tenant.SchemaName;
                            try
                            {
                                using (var cmd = tenantContext.Database.GetDbConnection().CreateCommand())
                                {
                                    if (cmd.Connection != null && cmd.Connection.State != System.Data.ConnectionState.Open)
                                    {
                                        await cmd.Connection.OpenAsync();
                                    }

                                    var tables = new[] {
                                        "Purchases", "PurchasePayments", "PurchaseTimelineEvents", "SimpleExpenses", 
                                        "BankLedgerEntries", "BankLedgerAuditEntries", "SalaryPayments", "Users", 
                                        "Vendors", "Customers", "InventoryMovements", "PlatformAuditLogs", "Companies"
                                    };

                                    foreach (var table in tables)
                                    {
                                        try
                                        {
                                            cmd.CommandText = $@"
                                                UPDATE ""{schema}"".""{table}"" 
                                                SET ""CreatedAt"" = NOW() AT TIME ZONE 'utc'
                                                WHERE ""CreatedAt"" IS NULL OR ""CreatedAt"" < '2020-01-01'::timestamp;";
                                            await cmd.ExecuteNonQueryAsync();
                                        }
                                        catch { }
                                        
                                        try
                                        {
                                            cmd.CommandText = $@"
                                                UPDATE ""{schema}"".""{table}"" 
                                                SET ""UpdatedAt"" = NOW() AT TIME ZONE 'utc'
                                                WHERE ""UpdatedAt"" IS NOT NULL AND ""UpdatedAt"" < '2020-01-01'::timestamp;";
                                            await cmd.ExecuteNonQueryAsync();
                                        }
                                        catch { }
                                    }

                                    try
                                    {
                                        cmd.CommandText = $@"
                                            UPDATE ""{schema}"".""Purchases"" 
                                            SET ""PurchaseDate"" = NOW() AT TIME ZONE 'utc'
                                            WHERE ""PurchaseDate"" IS NULL OR ""PurchaseDate"" < '2020-01-01'::timestamp;";
                                        await cmd.ExecuteNonQueryAsync();
                                    }
                                    catch {}

                                    try
                                    {
                                        cmd.CommandText = $@"
                                            UPDATE ""{schema}"".""PurchasePayments"" 
                                            SET ""PaymentDate"" = NOW() AT TIME ZONE 'utc'
                                            WHERE ""PaymentDate"" IS NULL OR ""PaymentDate"" < '2020-01-01'::timestamp;";
                                        await cmd.ExecuteNonQueryAsync();
                                    }
                                    catch {}

                                    try
                                    {
                                        cmd.CommandText = $@"
                                            UPDATE ""{schema}"".""SimpleExpenses"" 
                                            SET ""ExpenseDate"" = NOW() AT TIME ZONE 'utc'
                                            WHERE ""ExpenseDate"" IS NULL OR ""ExpenseDate"" < '2020-01-01'::timestamp;";
                                        await cmd.ExecuteNonQueryAsync();
                                    }
                                    catch {}

                                    try
                                    {
                                        cmd.CommandText = $@"
                                            UPDATE ""{schema}"".""BankLedgerEntries"" 
                                            SET ""TransactionDate"" = NOW() AT TIME ZONE 'utc'
                                            WHERE ""TransactionDate"" IS NULL OR ""TransactionDate"" < '2020-01-01'::timestamp;";
                                        await cmd.ExecuteNonQueryAsync();
                                    }
                                    catch {}

                                    try
                                    {
                                        cmd.CommandText = $@"
                                            UPDATE ""{schema}"".""SalaryPayments"" 
                                            SET ""PaymentDate"" = NOW() AT TIME ZONE 'utc'
                                            WHERE ""PaymentDate"" IS NULL OR ""PaymentDate"" < '2020-01-01'::timestamp;";
                                        await cmd.ExecuteNonQueryAsync();
                                    }
                                    catch {}
                                    try
                                    {
                                        cmd.CommandText = $@"
                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""Companies"" (
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

                                            ALTER TABLE ""{schema}"".""Companies"" ADD COLUMN IF NOT EXISTS ""AdminPinHash"" text NULL;
                                            ALTER TABLE ""{schema}"".""Companies"" ADD COLUMN IF NOT EXISTS ""ApiKey"" text NULL;
                                            
                                            UPDATE ""{schema}"".""Companies"" 
                                            SET ""TimeZone"" = 'Asia/Kolkata'
                                            WHERE ""TimeZone"" IS NULL;
                                            
                                            UPDATE ""{schema}"".""Companies"" 
                                            SET ""DateFormat"" = 'dd MMM yyyy'
                                            WHERE ""DateFormat"" IS NULL;
                                            
                                            UPDATE ""{schema}"".""Companies"" 
                                            SET ""TimeFormat"" = '12h'
                                            WHERE ""TimeFormat"" IS NULL;

                                            UPDATE ""public"".""Tenants"" SET ""Currency"" = 'INR' WHERE ""Currency"" = 'USD' OR ""Currency"" IS NULL;

                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""PaymentMethod"" text NULL;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""BankAccountId"" uuid NULL;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""CashBookId"" uuid NULL;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""UnitPrice"" numeric(18,2) NOT NULL DEFAULT 0.0;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""DiscountAmount"" numeric(18,2) NOT NULL DEFAULT 0.0;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""TaxAmount"" numeric(18,2) NOT NULL DEFAULT 0.0;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""CGST"" numeric(18,2) NOT NULL DEFAULT 0.0;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""SGST"" numeric(18,2) NOT NULL DEFAULT 0.0;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""IGST"" numeric(18,2) NOT NULL DEFAULT 0.0;
                                            ALTER TABLE ""{schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""MetadataJson"" text NULL;

                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""WaterTestParameters"" (
                                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                                ""Name"" text NOT NULL,
                                                ""Category"" text NOT NULL,
                                                ""Unit"" text NOT NULL,
                                                ""MinAcceptable"" double precision NULL,
                                                ""MaxAcceptable"" double precision NULL,
                                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                ""CreatedBy"" text NOT NULL,
                                                ""UpdatedAt"" timestamp with time zone NULL,
                                                ""UpdatedBy"" text NULL
                                            );

                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""WaterTestReports"" (
                                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                                ""TenantId"" uuid NOT NULL,
                                                ""CompanyId"" uuid NOT NULL,
                                                ""BatchNumber"" text NOT NULL,
                                                ""SampleNumber"" text NULL,
                                                ""ProductionDate"" timestamp with time zone NULL,
                                                ""ReportType"" text NOT NULL DEFAULT 'DAILY',
                                                ""Status"" text NOT NULL DEFAULT 'DRAFT',
                                                ""SampleTime"" timestamp with time zone NULL,
                                                ""TestedBy"" text NULL,
                                                ""CollectedBy"" text NULL,
                                                ""VerifiedBy"" text NULL,
                                                ""Remarks"" text NULL,
                                                ""Attachments"" text NULL,
                                                ""ConcurrencyToken"" text NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
                                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                ""CreatedBy"" text NOT NULL,
                                                ""UpdatedAt"" timestamp with time zone NULL,
                                                ""UpdatedBy"" text NULL,
                                                ""DeletedAt"" timestamp with time zone NULL,
                                                ""DeletedBy"" text NULL
                                            );

                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""WaterTestResults"" (
                                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                                ""ReportId"" uuid NOT NULL,
                                                ""ParameterId"" uuid NOT NULL,
                                                ""Value"" double precision NULL,
                                                ""StringValue"" text NULL,
                                                ""IsPass"" boolean NOT NULL,
                                                ""QualityStatus"" text NOT NULL DEFAULT 'PASS',
                                                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                ""CreatedBy"" text NOT NULL,
                                                ""UpdatedAt"" timestamp with time zone NULL,
                                                ""UpdatedBy"" text NULL,
                                                CONSTRAINT fk_report FOREIGN KEY (""ReportId"") REFERENCES ""{schema}"".""WaterTestReports"" (""Id"") ON DELETE CASCADE,
                                                CONSTRAINT fk_parameter FOREIGN KEY (""ParameterId"") REFERENCES ""{schema}"".""WaterTestParameters"" (""Id"") ON DELETE RESTRICT
                                            );

                                            CREATE UNIQUE INDEX IF NOT EXISTS uq_water_test_results ON ""{schema}"".""WaterTestResults"" (""ReportId"", ""ParameterId"");

                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""OperationsIssues"" (
                                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                                ""TenantId"" uuid NOT NULL,
                                                ""CompanyId"" uuid NOT NULL,
                                                ""IssueNumber"" text NOT NULL,
                                                ""Title"" text NOT NULL,
                                                ""Description"" text NOT NULL,
                                                ""Department"" text NOT NULL DEFAULT 'Production',
                                                ""Category"" text NOT NULL DEFAULT 'Machine Breakdown',
                                                ""Priority"" text NOT NULL DEFAULT 'Medium',
                                                ""Status"" text NOT NULL DEFAULT 'Open',
                                                ""ReportedByUserId"" text NOT NULL,
                                                ""ReportedByName"" text NOT NULL,
                                                ""AssignedToUserId"" text NULL,
                                                ""AssignedToName"" text NULL,
                                                ""MachineId"" uuid NULL,
                                                ""MachineName"" text NULL,
                                                ""ProductionLineId"" uuid NULL,
                                                ""ProductionLineName"" text NULL,
                                                ""BatchNumber"" text NULL,
                                                ""ShiftId"" uuid NULL,
                                                ""ReportedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                ""DueDate"" timestamp with time zone NULL,
                                                ""ResolvedAt"" timestamp with time zone NULL,
                                                ""ClosedAt"" timestamp with time zone NULL,
                                                ""VerifiedAt"" timestamp with time zone NULL,
                                                ""EstimatedCost"" numeric NULL,
                                                ""ActualCost"" numeric NULL,
                                                ""DowntimeMinutes"" integer NULL,
                                                ""RequiresMaintenance"" boolean NOT NULL DEFAULT false,
                                                ""MaintenanceWorkOrderId"" uuid NULL,
                                                ""RootCause"" text NULL,
                                                ""CorrectiveAction"" text NULL,
                                                ""PreventiveAction"" text NULL,
                                                ""Attachments"" text NULL,
                                                ""IsRead"" boolean NOT NULL DEFAULT false,
                                                ""ReadAt"" timestamp with time zone NULL,
                                                ""ReadBy"" text NULL,
                                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                ""CreatedBy"" text NOT NULL,
                                                ""UpdatedAt"" timestamp with time zone NULL,
                                                ""UpdatedBy"" text NULL,
                                                ""DeletedAt"" timestamp with time zone NULL,
                                                ""DeletedBy"" text NULL
                                            );

                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""OperationsIssueAffectedMachines"" (
                                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                                ""IssueId"" uuid NOT NULL,
                                                ""MachineId"" uuid NOT NULL,
                                                ""MachineName"" text NOT NULL,
                                                ""MachineCode"" text NULL,
                                                CONSTRAINT fk_issue_affected_machines FOREIGN KEY (""IssueId"") REFERENCES ""{schema}"".""OperationsIssues"" (""Id"") ON DELETE CASCADE
                                            );

                                            CREATE UNIQUE INDEX IF NOT EXISTS uq_issue_affected_machines ON ""{schema}"".""OperationsIssueAffectedMachines"" (""IssueId"", ""MachineId"");

                                            INSERT INTO ""{schema}"".""OperationsIssueAffectedMachines"" (""Id"", ""IssueId"", ""MachineId"", ""MachineName"")
                                            SELECT gen_random_uuid(), ""Id"", ""MachineId"", COALESCE(""MachineName"", 'Primary Machine')
                                            FROM ""{schema}"".""OperationsIssues""
                                            WHERE ""MachineId"" IS NOT NULL
                                            AND NOT EXISTS (
                                                SELECT 1 FROM ""{schema}"".""OperationsIssueAffectedMachines"" m WHERE m.""IssueId"" = ""{schema}"".""OperationsIssues"".""Id"" AND m.""MachineId"" = ""{schema}"".""OperationsIssues"".""MachineId""
                                            );

                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""OperationsIssueComments"" (
                                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                                ""IssueId"" uuid NOT NULL,
                                                ""AuthorId"" text NOT NULL,
                                                ""AuthorName"" text NOT NULL,
                                                ""AuthorRole"" text NOT NULL,
                                                ""Message"" text NOT NULL,
                                                ""AttachmentUrl"" text NULL,
                                                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                CONSTRAINT fk_issue_comments FOREIGN KEY (""IssueId"") REFERENCES ""{schema}"".""OperationsIssues"" (""Id"") ON DELETE CASCADE
                                            );

                                            CREATE TABLE IF NOT EXISTS ""{schema}"".""OperationsIssueHistories"" (
                                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                                ""IssueId"" uuid NOT NULL,
                                                ""PerformedBy"" text NOT NULL,
                                                ""Action"" text NOT NULL,
                                                ""Details"" text NULL,
                                                ""Timestamp"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                                CONSTRAINT fk_issue_history FOREIGN KEY (""IssueId"") REFERENCES ""{schema}"".""OperationsIssues"" (""Id"") ON DELETE CASCADE
                                            );";
                                        await cmd.ExecuteNonQueryAsync();
                                    }
                                    catch {}
                                }
                            }
                            catch (Exception repairEx)
                            {
                                _logger.LogWarning($"[REPAIR-DATETIME WARN]: Failed timestamp cleanup for {tenant.SchemaName}: {repairEx.Message}");
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
