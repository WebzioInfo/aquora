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

                            await tenantContext.Database.MigrateAsync();

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
                            );";
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
