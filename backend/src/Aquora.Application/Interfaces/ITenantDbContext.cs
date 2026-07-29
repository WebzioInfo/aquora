using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;
using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces
{
    public interface ITenantDbContext
    {
        DbSet<Company> Companies { get; }
        DbSet<ProductionLine> ProductionLines { get; }
        DbSet<Station> Stations { get; }
        DbSet<Role> Roles { get; }
        DbSet<Permission> Permissions { get; }
        DbSet<UserRole> UserRoles { get; }
        DbSet<RolePermission> RolePermissions { get; }
        DbSet<AuditLog> AuditLogs { get; }
        DbSet<ProductionBatch> ProductionBatches { get; }
        DbSet<ProductionStationData> ProductionStationData { get; }
        DbSet<SkuProduct> SkuProducts { get; }
        DbSet<CaseConfiguration> CaseConfigurations { get; }
        DbSet<RawMaterial> RawMaterials { get; }
        DbSet<InventoryMovement> InventoryMovements { get; }
        DbSet<ProductionEntry> ProductionEntries { get; }
        DbSet<ProductionSession> ProductionSessions { get; }
        DbSet<Brand> Brands { get; }
        DbSet<Product> Products { get; }
        DbSet<ProductionShift> ProductionShifts { get; }
        DbSet<OperatorContextLog> OperatorContextLogs { get; }
        DbSet<Customer> Customers { get; }
        DbSet<SalesTransaction> SalesTransactions { get; }
        DbSet<PriceList> PriceLists { get; }
        DbSet<DiscountGroup> DiscountGroups { get; }
        
        // 20L Operations Module
        DbSet<OperationsVisit> OperationsVisits { get; }
        DbSet<OperationsUnloading> OperationsUnloadings { get; }
        DbSet<OperationsJarCondition> OperationsJarConditions { get; }
        DbSet<OperationsQuarantine> OperationsQuarantines { get; }
        DbSet<OperationsFillingQueue> OperationsFillingQueues { get; }
        DbSet<OperationsLoading> OperationsLoadings { get; }
        DbSet<OperationsReservedJar> OperationsReservedJars { get; }
        DbSet<OperationsWashingLog> OperationsWashingLogs { get; }
        DbSet<OperationsFillingLog> OperationsFillingLogs { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
