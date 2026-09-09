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
                        await tenantContext.Database.MigrateAsync();
                    }

                    // Repair schema for ProductionShifts and Simple Accounts tables
                    if (tenantContext.Database.IsRelational())
                    {
                        try
                        {
                        var repairSql = $@"
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
                        // 1. Seed security roles inside schema
                        var roleNames = new[]
                        {
                            "Owner", "CompanyAdmin", "Accountant", "Admin", "Manager", "Supervisor", "Operator",
                            "Store Keeper", "Sales", "HR", "QC"
                        };
                        Console.WriteLine($"[ROLE SEEDING]: Seeding roles: {string.Join(", ", roleNames)} inside schema '{schemaName}'.");

                        Role ownerRole = null!;
                        Role companyAdminRole = null!;
                        Role accountantRole = null!;
                        Role qcRole = null!;
                        foreach (var roleName in roleNames)
                        {
                            var code = roleName.Replace(" ", "_").ToUpperInvariant();
                            var role = new Role { Name = roleName, Code = code, TenantId = tenantId };
                            tenantContext.Roles.Add(role);
                            if (roleName == "Owner")
                            {
                                ownerRole = role;
                            }
                            if (roleName == "CompanyAdmin")
                            {
                                companyAdminRole = role;
                            }
                            if (roleName == "Accountant")
                            {
                                accountantRole = role;
                            }
                            if (roleName == "QC")
                            {
                                qcRole = role;
                            }
                        }
                        await tenantContext.SaveChangesAsync();

                        if (onProgress != null)
                        {
                            await onProgress(70, "DefaultRolesCreated", "Configuring security settings...");
                        }

                        result.OwnerRoleId = ownerRole.Id;
                        result.OwnerRoleName = ownerRole.Name;

                        // 2. Seed dynamic permissions inside schema
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

                        var seededPermissions = new List<Permission>();
                        foreach (var permStr in permissionStrings)
                        {
                            var p = new Permission
                            {
                                Name = permStr.Replace("Permissions.", "").Replace(".", " "),
                                Code = permStr
                            };
                            tenantContext.Permissions.Add(p);
                            seededPermissions.Add(p);
                        }
                        await tenantContext.SaveChangesAsync();

                        if (onProgress != null)
                        {
                            await onProgress(80, "AdministratorUserInitialized", "Setting up your administrator profile...");
                        }

                        // 3. Map permissions: CompanyAdmin and Accountant get all permissions, Owner gets Read-Only permissions
                        var ownerReadPerms = seededPermissions.Where(p => p.Code.EndsWith(".Read")).ToList();
                        foreach (var perm in ownerReadPerms)
                        {
                            tenantContext.RolePermissions.Add(new RolePermission
                            {
                                RoleId = ownerRole.Id,
                                PermissionId = perm.Id,
                                TenantId = tenantId
                            });
                        }

                        if (companyAdminRole != null)
                        {
                            foreach (var perm in seededPermissions)
                            {
                                tenantContext.RolePermissions.Add(new RolePermission
                                {
                                    RoleId = companyAdminRole.Id,
                                    PermissionId = perm.Id,
                                    TenantId = tenantId
                                });
                            }
                        }

                        if (accountantRole != null)
                        {
                            foreach (var perm in seededPermissions)
                            {
                                tenantContext.RolePermissions.Add(new RolePermission
                                {
                                    RoleId = accountantRole.Id,
                                    PermissionId = perm.Id,
                                    TenantId = tenantId
                                });
                            }
                        }

                        // Map QC permissions to QC Role
                        if (qcRole != null)
                        {
                            var qcPerms = seededPermissions.Where(p => p.Code.StartsWith("Permissions.QC") || p.Code == Permissions.DashboardRead);
                            foreach (var perm in qcPerms)
                            {
                                tenantContext.RolePermissions.Add(new RolePermission
                                {
                                    RoleId = qcRole.Id,
                                    PermissionId = perm.Id,
                                    TenantId = tenantId
                                });
                            }
                        }

                        var userRole = new UserRole
                        {
                            UserId = ownerUserId,
                            RoleId = ownerRole.Id,
                            TenantId = tenantId
                        };
                        tenantContext.UserRoles.Add(userRole);
                        await tenantContext.SaveChangesAsync();
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
                await DropTenantSchemaAsync(schemaName);
                throw;
            }
            finally
            {
                AuditState.IsDisabled = false;
            }
        }
    }
}
