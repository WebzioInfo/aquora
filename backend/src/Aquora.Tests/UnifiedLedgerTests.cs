using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class UnifiedLedgerTests
    {
        private (TenantDbContext context, Guid tenantId, BankLedgerService service) CreateService(Guid? specificTenantId = null)
        {
            var tenantId = specificTenantId ?? Guid.NewGuid();
            var companyId = Guid.NewGuid();

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns("public");

            var mockCurrentUserContext = new Mock<ICurrentUserContext>();
            mockCurrentUserContext.Setup(x => x.UserId).Returns("test-user");

            var mockDateTimeProvider = new Mock<IDateTimeProvider>();
            mockDateTimeProvider.Setup(x => x.UtcNow).Returns(DateTime.UtcNow);

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            // Add Company
            context.Companies.Add(new Aquora.Domain.Entities.Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Test Company",
                Code = "TEST",
                IsDeleted = false
            });
            context.SaveChanges();

            var mockPlatformContext = new Mock<IPlatformDbContext>();

            var service = new BankLedgerService(context, mockPlatformContext.Object, mockTenantProvider.Object, mockCurrentUserContext.Object);

            return (context, tenantId, service);
        }

        [Fact]
        public async Task Test1_And_Test2_Unified_All_Mixes_Bank_And_Cash_Chronologically()
        {
            var (context, tenantId, service) = CreateService();

            var bank = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankName = "HDFC Bank",
                AccountName = "Primary Current",
                AccountNumber = "5020001",
                OpeningBalance = 25000m,
                CurrentBalance = 25000m,
                Status = "Active",
                IsActive = true
            };
            context.BankAccounts.Add(bank);

            var cash = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Main Cash Book",
                OpeningBalance = 5000m,
                CurrentBalance = 5000m,
                Status = "Active",
                IsActive = true
            };
            context.CashBooks.Add(cash);

            // Transaction 1: 01 Oct 2026 - Cash Expense (2,500)
            context.BankLedgerEntries.Add(new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBookId = cash.Id,
                LedgerAccountType = "CashBook",
                TransactionDate = new DateTime(2026, 10, 1, 10, 0, 0, DateTimeKind.Utc),
                TransactionType = "Expense",
                Description = "Cash Expense",
                Debit = 2500m,
                Credit = 0m,
                CreatedAt = new DateTime(2026, 10, 1, 10, 0, 0, DateTimeKind.Utc)
            });

            // Transaction 2: 01 Oct 2026 - Bank Supplier Payment (12,000)
            context.BankLedgerEntries.Add(new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankAccountId = bank.Id,
                LedgerAccountType = "BankAccount",
                TransactionDate = new DateTime(2026, 10, 1, 14, 0, 0, DateTimeKind.Utc),
                TransactionType = "Supplier Payment",
                Description = "Supplier Payment",
                Debit = 12000m,
                Credit = 0m,
                CreatedAt = new DateTime(2026, 10, 1, 14, 0, 0, DateTimeKind.Utc)
            });

            // Transaction 3: 02 Oct 2026 - Cash Customer Payment (5,000)
            context.BankLedgerEntries.Add(new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBookId = cash.Id,
                LedgerAccountType = "CashBook",
                TransactionDate = new DateTime(2026, 10, 2, 9, 0, 0, DateTimeKind.Utc),
                TransactionType = "Customer Payment",
                Description = "Customer Payment",
                Debit = 0m,
                Credit = 5000m,
                CreatedAt = new DateTime(2026, 10, 2, 9, 0, 0, DateTimeKind.Utc)
            });

            // Transaction 4: 02 Oct 2026 - Bank Payment Received (25,000)
            context.BankLedgerEntries.Add(new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankAccountId = bank.Id,
                LedgerAccountType = "BankAccount",
                TransactionDate = new DateTime(2026, 10, 2, 11, 0, 0, DateTimeKind.Utc),
                TransactionType = "Payment Received",
                Description = "Payment Received",
                Debit = 0m,
                Credit = 25000m,
                CreatedAt = new DateTime(2026, 10, 2, 11, 0, 0, DateTimeKind.Utc)
            });

            await context.SaveChangesAsync();

            // Act: Query ALL
            var filter = new UnifiedLedgerFilterDto { AccountType = "ALL", PageNumber = 1, PageSize = 20 };
            var result = await service.GetUnifiedLedgerAsync(filter);

            // Assert
            Assert.Equal(4, result.TotalCount);
            var items = result.Items.ToList();

            // Sorted latest first
            Assert.Equal("Payment Received", items[0].TransactionType);
            Assert.Equal("BANK", items[0].AccountType);
            Assert.Contains("HDFC Bank", items[0].AccountName);
            Assert.Equal(25000m, items[0].Credit);

            Assert.Equal("Customer Payment", items[1].TransactionType);
            Assert.Equal("CASH", items[1].AccountType);
            Assert.Equal("Main Cash Book", items[1].AccountName);
            Assert.Equal(5000m, items[1].Credit);

            Assert.Equal("Supplier Payment", items[2].TransactionType);
            Assert.Equal("BANK", items[2].AccountType);
            Assert.Equal(12000m, items[2].Debit);

            Assert.Equal("Expense", items[3].TransactionType);
            Assert.Equal("CASH", items[3].AccountType);
            Assert.Equal(2500m, items[3].Debit);
        }

        [Fact]
        public async Task Test3_And_Test5_Bank_Filter_And_Specific_Bank_Account()
        {
            var (context, tenantId, service) = CreateService();

            var hdfc = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankName = "HDFC Bank",
                AccountName = "HDFC Current",
                AccountNumber = "111",
                Status = "Active"
            };
            var sbi = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankName = "SBI Bank",
                AccountName = "SBI Current",
                AccountNumber = "222",
                Status = "Active"
            };
            var cash = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Office Cash",
                Status = "Active"
            };

            context.BankAccounts.AddRange(hdfc, sbi);
            context.CashBooks.Add(cash);

            // Transactions
            context.BankLedgerEntries.Add(new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankAccountId = hdfc.Id,
                Description = "HDFC Deposit",
                Credit = 10000m,
                TransactionDate = DateTime.UtcNow
            });
            context.BankLedgerEntries.Add(new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankAccountId = sbi.Id,
                Description = "SBI Deposit",
                Credit = 5000m,
                TransactionDate = DateTime.UtcNow
            });
            context.BankLedgerEntries.Add(new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBookId = cash.Id,
                LedgerAccountType = "CashBook",
                Description = "Cash Deposit",
                Credit = 2000m,
                TransactionDate = DateTime.UtcNow
            });
            await context.SaveChangesAsync();

            // 1. Filter BANK (all banks)
            var allBankResult = await service.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "BANK" });
            Assert.Equal(2, allBankResult.TotalCount);
            Assert.All(allBankResult.Items, x => Assert.Equal("BANK", x.AccountType));

            // 2. Filter BANK + specific HDFC
            var hdfcResult = await service.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "BANK", BankAccountId = hdfc.Id });
            Assert.Single(hdfcResult.Items);
            Assert.Equal(hdfc.Id, hdfcResult.Items.First().BankAccountId);
            Assert.Contains("HDFC Bank", hdfcResult.Items.First().AccountName);
        }

        [Fact]
        public async Task Test4_And_Test6_Cash_Filter_And_Specific_Cash_Book()
        {
            var (context, tenantId, service) = CreateService();

            var cash1 = new CashBook { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Main Cash", Status = "Active" };
            var cash2 = new CashBook { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Petty Cash", Status = "Active" };
            var bank = new BankAccount { Id = Guid.NewGuid(), TenantId = tenantId, BankName = "Axis Bank", AccountName = "Axis A/C", AccountNumber = "333", Status = "Active" };

            context.CashBooks.AddRange(cash1, cash2);
            context.BankAccounts.Add(bank);

            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CashBookId = cash1.Id, LedgerAccountType = "CashBook", Description = "Main Cash In", Credit = 1000m, TransactionDate = DateTime.UtcNow });
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CashBookId = cash2.Id, LedgerAccountType = "CashBook", Description = "Petty Cash In", Credit = 500m, TransactionDate = DateTime.UtcNow });
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, BankAccountId = bank.Id, Description = "Axis In", Credit = 20000m, TransactionDate = DateTime.UtcNow });
            await context.SaveChangesAsync();

            // 1. Filter CASH (all cash books)
            var allCashResult = await service.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "CASH" });
            Assert.Equal(2, allCashResult.TotalCount);
            Assert.All(allCashResult.Items, x => Assert.Equal("CASH", x.AccountType));

            // 2. Filter CASH + specific Main Cash
            var mainCashResult = await service.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "CASH", CashBookId = cash1.Id });
            Assert.Single(mainCashResult.Items);
            Assert.Equal(cash1.Id, mainCashResult.Items.First().CashBookId);
            Assert.Equal("Main Cash", mainCashResult.Items.First().AccountName);
        }

        [Fact]
        public async Task Test7_And_Test8_Search_Across_Dataset()
        {
            var (context, tenantId, service) = CreateService();

            var bank = new BankAccount { Id = Guid.NewGuid(), TenantId = tenantId, BankName = "ICICI Bank", AccountName = "ICICI Main", AccountNumber = "999", Status = "Active" };
            var cash = new CashBook { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Drawer Cash", Status = "Active" };
            context.BankAccounts.Add(bank);
            context.CashBooks.Add(cash);

            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, BankAccountId = bank.Id, ReferenceNumber = "INV-1001", Description = "Monthly Office Lease", Debit = 50000m, TransactionDate = DateTime.UtcNow });
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CashBookId = cash.Id, LedgerAccountType = "CashBook", ReferenceNumber = "CASH-2002", Description = "Office Supplies Paper", Debit = 800m, TransactionDate = DateTime.UtcNow });
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CashBookId = cash.Id, LedgerAccountType = "CashBook", ReferenceNumber = "CASH-3003", Description = "Tea and snacks", Debit = 300m, TransactionDate = DateTime.UtcNow });
            await context.SaveChangesAsync();

            // ALL + Search "Office" -> should return both Bank (Lease) and Cash (Supplies)
            var allSearch = await service.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "ALL", Search = "Office" });
            Assert.Equal(2, allSearch.TotalCount);

            // BANK + Search "Office" -> should only return the Bank lease
            var bankSearch = await service.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "BANK", Search = "Office" });
            Assert.Single(bankSearch.Items);
            Assert.Equal("INV-1001", bankSearch.Items.First().ReferenceNumber);
        }

        [Fact]
        public async Task Test9_Date_Range_Filtering()
        {
            var (context, tenantId, service) = CreateService();

            var bank = new BankAccount { Id = Guid.NewGuid(), TenantId = tenantId, BankName = "Bank 1", AccountName = "A1", AccountNumber = "1", Status = "Active" };
            var cash = new CashBook { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Cash 1", Status = "Active" };
            context.BankAccounts.Add(bank);
            context.CashBooks.Add(cash);

            // Past month entry
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, BankAccountId = bank.Id, TransactionDate = new DateTime(2026, 8, 15, 0, 0, 0, DateTimeKind.Utc), Credit = 1000m });
            // Target month entry (Bank)
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, BankAccountId = bank.Id, TransactionDate = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc), Credit = 2000m });
            // Target month entry (Cash)
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CashBookId = cash.Id, LedgerAccountType = "CashBook", TransactionDate = new DateTime(2026, 9, 20, 0, 0, 0, DateTimeKind.Utc), Credit = 3000m });
            // Future month entry
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CashBookId = cash.Id, LedgerAccountType = "CashBook", TransactionDate = new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc), Credit = 4000m });
            await context.SaveChangesAsync();

            // Date Range: 2026-09-01 to 2026-09-30
            var dateFilter = new UnifiedLedgerFilterDto
            {
                AccountType = "ALL",
                DateFrom = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                DateTo = new DateTime(2026, 9, 30, 23, 59, 59, DateTimeKind.Utc)
            };
            var dateResult = await service.GetUnifiedLedgerAsync(dateFilter);

            Assert.Equal(2, dateResult.TotalCount);
            Assert.Contains(dateResult.Items, x => x.Credit == 2000m && x.AccountType == "BANK");
            Assert.Contains(dateResult.Items, x => x.Credit == 3000m && x.AccountType == "CASH");
        }

        [Fact]
        public async Task Test10_Summary_KPIs_Are_Authoritative()
        {
            var (context, tenantId, service) = CreateService();

            var bank = new BankAccount { Id = Guid.NewGuid(), TenantId = tenantId, BankName = "Bank A", AccountName = "Current A", AccountNumber = "1", OpeningBalance = 100000m, CurrentBalance = 150000m, Status = "Active", IsActive = true };
            var cash = new CashBook { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Main Cash", OpeningBalance = 10000m, CurrentBalance = 15000m, Status = "Active", IsActive = true };
            context.BankAccounts.Add(bank);
            context.CashBooks.Add(cash);

            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, BankAccountId = bank.Id, Credit = 60000m, Debit = 10000m, TransactionDate = DateTime.UtcNow });
            context.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantId, CashBookId = cash.Id, LedgerAccountType = "CashBook", Credit = 7000m, Debit = 2000m, TransactionDate = DateTime.UtcNow });
            await context.SaveChangesAsync();

            var summary = await service.GetUnifiedLedgerSummaryAsync(new UnifiedLedgerFilterDto { AccountType = "ALL" });

            Assert.Equal(165000m, summary.TotalBalance); // 150000 + 15000
            Assert.Equal(150000m, summary.TotalBankBalance);
            Assert.Equal(15000m, summary.TotalCashBalance);
            Assert.Equal(1, summary.ActiveBankAccountsCount);
            Assert.Equal(1, summary.ActiveCashBooksCount);
            Assert.Equal(2, summary.TotalTransactions);
            Assert.Equal(67000m, summary.TotalMoneyReceived); // 60000 + 7000
            Assert.Equal(12000m, summary.TotalMoneyPaid);     // 10000 + 2000
            Assert.Equal(55000m, summary.NetCashFlow);        // 67000 - 12000
        }

        [Fact]
        public async Task Test11_Multi_Tenant_Safety()
        {
            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();

            var (contextA, _, serviceA) = CreateService(tenantA);

            // Tenant A data
            var bankA = new BankAccount { Id = Guid.NewGuid(), TenantId = tenantA, BankName = "TenantA Bank", AccountName = "A", AccountNumber = "A1", CurrentBalance = 50000m, Status = "Active", IsActive = true };
            contextA.BankAccounts.Add(bankA);
            contextA.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantA, BankAccountId = bankA.Id, Credit = 50000m, TransactionDate = DateTime.UtcNow });

            // Tenant B data into the same DB context
            var bankB = new BankAccount { Id = Guid.NewGuid(), TenantId = tenantB, BankName = "TenantB Bank", AccountName = "B", AccountNumber = "B1", CurrentBalance = 90000m, Status = "Active", IsActive = true };
            contextA.BankAccounts.Add(bankB);
            contextA.BankLedgerEntries.Add(new BankLedgerEntry { Id = Guid.NewGuid(), TenantId = tenantB, BankAccountId = bankB.Id, Credit = 90000m, TransactionDate = DateTime.UtcNow });
            await contextA.SaveChangesAsync();

            // ServiceA (bound to TenantA) should only see TenantA transactions and balance
            var ledgerA = await serviceA.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "ALL" });
            Assert.Single(ledgerA.Items);
            Assert.Equal("TenantA Bank - A", ledgerA.Items.First().AccountName);

            var summaryA = await serviceA.GetUnifiedLedgerSummaryAsync(new UnifiedLedgerFilterDto { AccountType = "ALL" });
            Assert.Equal(50000m, summaryA.TotalBalance);
            Assert.Equal(1, summaryA.ActiveBankAccountsCount);
        }

        [Fact]
        public async Task Test12_Empty_State()
        {
            var (_, _, service) = CreateService();

            var result = await service.GetUnifiedLedgerAsync(new UnifiedLedgerFilterDto { AccountType = "ALL" });
            Assert.Empty(result.Items);
            Assert.Equal(0, result.TotalCount);

            var summary = await service.GetUnifiedLedgerSummaryAsync(new UnifiedLedgerFilterDto { AccountType = "ALL" });
            Assert.Equal(0m, summary.TotalBalance);
            Assert.Equal(0, summary.TotalTransactions);
        }
    }
}
