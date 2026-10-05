using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;
using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces
{
    public interface ITenantDbContext
    {
        string SchemaName { get; }
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
        DbSet<TwentyLDistributorProfile> TwentyLDistributorProfiles { get; }
        DbSet<TwentyLJarMovement> TwentyLJarMovements { get; }
        DbSet<TwentyLJarPosition> TwentyLJarPositions { get; }
        DbSet<TwentyLRateRule> TwentyLRateRules { get; }
        DbSet<TwentyLDelivery> TwentyLDeliveries { get; }
        DbSet<TwentyLCommissionRule> TwentyLCommissionRules { get; }
        DbSet<TwentyLCommissionTransaction> TwentyLCommissionTransactions { get; }
        DbSet<TwentyLTrip> TwentyLTrips { get; }
        DbSet<TwentyLTripStop> TwentyLTripStops { get; }
        DbSet<TwentyLOperation> TwentyLOperations { get; }
        DbSet<TwentyLJarInspection> TwentyLJarInspections { get; }
        DbSet<TwentyLDistributorSupply> TwentyLDistributorSupplies { get; }
        DbSet<TwentyLDistributorRoute> TwentyLDistributorRoutes { get; }
        DbSet<TwentyLDistributorVehicle> TwentyLDistributorVehicles { get; }
        DbSet<TwentyLDistributorDriver> TwentyLDistributorDrivers { get; }
        DbSet<TwentyLDistributorCustomer> TwentyLDistributorCustomers { get; }
        DbSet<TwentyLDistributorDelivery> TwentyLDistributorDeliveries { get; }

        // God Mode Finance Module
        DbSet<Aquora.Domain.Entities.Finance.AccountGroup> AccountGroups { get; }
        DbSet<Aquora.Domain.Entities.Finance.Account> Accounts { get; }
        DbSet<Aquora.Domain.Entities.Finance.JournalEntry> JournalEntries { get; }
        DbSet<Aquora.Domain.Entities.Finance.JournalEntryLine> JournalEntryLines { get; }
        DbSet<Aquora.Domain.Entities.Finance.Asset> Assets { get; }
        DbSet<Aquora.Domain.Entities.Finance.AssetCategory> AssetCategories { get; }
        DbSet<Aquora.Domain.Entities.Finance.AssetMaintenanceRecord> AssetMaintenanceRecords { get; }
        DbSet<Aquora.Domain.Entities.Finance.ExpenseRecord> ExpenseRecords { get; }
        DbSet<Aquora.Domain.Entities.Finance.BankLedgerEntry> BankLedgerEntries { get; }
        DbSet<Aquora.Domain.Entities.Finance.BankAccount> BankAccounts { get; }
        DbSet<Aquora.Domain.Entities.Finance.CashBook> CashBooks { get; }
        DbSet<Aquora.Domain.Entities.Finance.PettyCashSession> PettyCashSessions { get; }
        
        // Simple Accounts V1 Module
        DbSet<Aquora.Domain.Entities.Finance.SimpleExpense> SimpleExpenses { get; }
        DbSet<Aquora.Domain.Entities.Finance.ExpenseCategory> ExpenseCategories { get; }
        DbSet<Aquora.Domain.Entities.Finance.Owner> Owners { get; }
        DbSet<Aquora.Domain.Entities.Finance.OwnerInvestmentTransaction> OwnerInvestmentTransactions { get; }
        DbSet<Aquora.Domain.Entities.Finance.BankLedgerAuditEntry> BankLedgerAuditEntries { get; }
        DbSet<Aquora.Domain.Entities.Payroll.MonthlySalary> MonthlySalaries { get; }
        DbSet<Aquora.Domain.Entities.Payroll.SalaryPayment> SalaryPayments { get; }
        DbSet<User> Users { get; }

        // Purchase Management & Asset History Module
        DbSet<Aquora.Domain.Entities.Finance.Vendor> Vendors { get; }
        DbSet<Aquora.Domain.Entities.Finance.Purchase> Purchases { get; }
        DbSet<Aquora.Domain.Entities.Finance.PurchaseCategory> PurchaseCategories { get; }
        DbSet<Aquora.Domain.Entities.Finance.PurchaseItem> PurchaseItems { get; }
        DbSet<Aquora.Domain.Entities.Finance.PurchasePayment> PurchasePayments { get; }
        DbSet<Aquora.Domain.Entities.Finance.PurchaseTimelineEvent> PurchaseTimelineEvents { get; }
        DbSet<Aquora.Domain.Entities.Finance.AssetHistory> AssetHistories { get; }

        // Quality Control Module
        DbSet<Aquora.Domain.Entities.QC.WaterTestReport> WaterTestReports { get; }
        DbSet<Aquora.Domain.Entities.QC.WaterTestParameter> WaterTestParameters { get; }
        DbSet<Aquora.Domain.Entities.QC.WaterTestResult> WaterTestResults { get; }
        DbSet<Aquora.Domain.Entities.QC.ComplianceRecord> ComplianceRecords { get; }
        DbSet<Aquora.Domain.Entities.QC.QCAuditLog> QCAuditLogs { get; }
        DbSet<Aquora.Domain.Entities.QC.QCSettings> QCSettings { get; }

        // Administration & Backup Module
        DbSet<Aquora.Domain.Entities.Administration.BackupHistory> BackupHistories { get; }
        DbSet<Aquora.Domain.Entities.Administration.RestoreHistory> RestoreHistories { get; }

        // Operations Issue Management System Module
        DbSet<Aquora.Domain.Entities.Operations.OperationsIssue> OperationsIssues { get; }
        DbSet<Aquora.Domain.Entities.Operations.OperationsIssueAffectedMachine> OperationsIssueAffectedMachines { get; }
        DbSet<Aquora.Domain.Entities.Operations.OperationsIssueComment> OperationsIssueComments { get; }
        DbSet<Aquora.Domain.Entities.Operations.OperationsIssueHistory> OperationsIssueHistories { get; }

        Microsoft.EntityFrameworkCore.Infrastructure.DatabaseFacade Database { get; }
        Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
