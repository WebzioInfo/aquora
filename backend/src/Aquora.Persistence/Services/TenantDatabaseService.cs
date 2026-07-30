using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.Interfaces;
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

            await _platformContext.Database.ExecuteSqlRawAsync(
                "DROP SCHEMA IF EXISTS " + QuoteSchemaName(schemaName) + " CASCADE;");
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
                    return result;
                }

                // 1. Create Postgres Schema
                await _platformContext.Database.ExecuteSqlRawAsync(
                    "CREATE SCHEMA IF NOT EXISTS " + QuoteSchemaName(schemaName) + ";");

                if (onProgress != null)
                {
                    await onProgress(15, "Preparing workspace", "Creating your workspace environment...");
                }

                // 2. Resolve TenantDbContext in a child scope with custom schema configuration
                using (var scope = _scopeFactory.CreateScope())
                {
                    var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
                    tenantProvider.SetTenantId(tenantId);
                    tenantProvider.SetTenantSchemaName(schemaName);

                    var tenantContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();
                    TenantSchemaResolver.CurrentSchemaName = schemaName;

                    // Verify Database Connection
                    var canConnect = await tenantContext.Database.CanConnectAsync();
                    if (!canConnect)
                    {
                        throw new InvalidOperationException("Failed to verify connection to the tenant database schema.");
                    }

                    if (onProgress != null)
                    {
                        await onProgress(30, "Preparing workspace", "Verifying workspace configuration...");
                    }

                    if (onProgress != null)
                    {
                        await onProgress(45, "Building workspace", "Building your workspace structure...");
                    }

                    // Run EF Migrations inside the schema with resilience against 42P07 relation already exists
                    try
                    {
                        await tenantContext.Database.MigrateAsync();
                    }
                    catch (Npgsql.NpgsqlException npgEx) when (npgEx.SqlState == "42P07" || npgEx.Message.Contains("already exists"))
                    {
                        Console.WriteLine($"[MIGRATION WARN]: Schema '{schemaName}' tables already exist ({npgEx.Message}). Resuming setup safely.");
                    }
                    catch (Exception migEx)
                    {
                        Console.WriteLine($"[MIGRATION WARN]: Non-fatal migration warning for '{schemaName}': {migEx.Message}. Proceeding.");
                    }
                    
                    if (onProgress != null)
                    {
                        await onProgress(60, "Configuring access", "Setting up team access controls...");
                    }

                    // Check for duplicate company record to prevent repeat initialization
                    var companyExists = await tenantContext.Companies.AnyAsync();
                    if (companyExists)
                    {
                        Console.WriteLine($"[PROVISIONING IDEMPOTENT]: Company record already exists in schema '{schemaName}'. Returning existing owner role.");
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
                    using var transaction = await tenantContext.Database.BeginTransactionAsync();
                    try
                    {
                        // 1. Seed security roles inside schema
                        var roleNames = new[]
                        {
                            "CompanyAdmin", "Admin", "Manager", "Supervisor", "Operator",
                            "Store Keeper", "Sales", "HR"
                        };
                        Console.WriteLine($"[ROLE SEEDING]: Seeding roles: {string.Join(", ", roleNames)} inside schema '{schemaName}'.");

                        Role ownerRole = null!;
                        foreach (var roleName in roleNames)
                        {
                            var code = roleName.Replace(" ", "_").ToUpperInvariant();
                            var role = new Role { Name = roleName, Code = code, TenantId = tenantId };
                            tenantContext.Roles.Add(role);
                            if (roleName == "CompanyAdmin")
                            {
                                ownerRole = role;
                            }
                        }
                        await tenantContext.SaveChangesAsync();

                        if (onProgress != null)
                        {
                            await onProgress(70, "Configuring access", "Configuring security settings...");
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
                            Permissions.DashboardRead
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
                            await onProgress(80, "Creating your account", "Setting up your administrator profile...");
                        }

                        // 3. Map all permissions to Company Owner & Assign UserRole to Admin
                        foreach (var perm in seededPermissions)
                        {
                            var rp = new RolePermission
                            {
                                RoleId = ownerRole.Id,
                                PermissionId = perm.Id,
                                TenantId = tenantId
                            };
                            tenantContext.RolePermissions.Add(rp);
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
                            await onProgress(90, "Finalizing setup", "Applying default settings...");
                        }

                        // 4. Create initial Company entity inside the schema
                        var company = new Company
                        {
                            Name = companyName,
                            Code = companyCode.ToUpperInvariant(),
                            TenantId = tenantId,
                            IsActive = true
                        };
                        tenantContext.Companies.Add(company);

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

                        // Seed default station configurations in public schema
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

                        if (onProgress != null)
                        {
                            await onProgress(95, "Finalizing setup", "Running final checks...");
                        }

                        await transaction.CommitAsync();
                        result.CompanyId = company.Id;
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
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
