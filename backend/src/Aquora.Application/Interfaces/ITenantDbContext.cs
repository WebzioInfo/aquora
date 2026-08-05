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

        // God Mode Finance Module
        DbSet<Aquora.Domain.Entities.Finance.AccountGroup> AccountGroups { get; }
        DbSet<Aquora.Domain.Entities.Finance.Account> Accounts { get; }
        DbSet<Aquora.Domain.Entities.Finance.JournalEntry> JournalEntries { get; }
        DbSet<Aquora.Domain.Entities.Finance.JournalEntryLine> JournalEntryLines { get; }
        DbSet<Aquora.Domain.Entities.Finance.Asset> Assets { get; }
        DbSet<Aquora.Domain.Entities.Finance.ExpenseRecord> ExpenseRecords { get; }
        DbSet<Aquora.Domain.Entities.Finance.BankLedgerEntry> BankLedgerEntries { get; }
        DbSet<Aquora.Domain.Entities.Finance.BankAccount> BankAccounts { get; }
        DbSet<Aquora.Domain.Entities.Finance.CashBook> CashBooks { get; }
        DbSet<Aquora.Domain.Entities.Finance.PettyCashSession> PettyCashSessions { get; }
        
        // Simple Accounts V1 Module
        DbSet<Aquora.Domain.Entities.Finance.SimpleExpense> SimpleExpenses { get; }
        DbSet<Aquora.Domain.Entities.Finance.Owner> Owners { get; }
        DbSet<Aquora.Domain.Entities.Finance.OwnerInvestmentTransaction> OwnerInvestmentTransactions { get; }
        DbSet<Aquora.Domain.Entities.Finance.BankLedgerAuditEntry> BankLedgerAuditEntries { get; }
        DbSet<User> Users { get; }
        DbSet<Aquora.Domain.Entities.Payroll.SalaryPayment> SalaryPayments { get; }

        // Purchase Management & Asset History Module
        DbSet<Aquora.Domain.Entities.Finance.Vendor> Vendors { get; }
        DbSet<Aquora.Domain.Entities.Finance.Purchase> Purchases { get; }
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

        Microsoft.EntityFrameworkCore.Infrastructure.DatabaseFacade Database { get; }
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
