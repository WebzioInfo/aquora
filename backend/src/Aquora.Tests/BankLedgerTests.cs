using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class BankLedgerTests
    {
        private TenantDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(Guid.NewGuid());
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns("public");

            var mockCurrentUserContext = new Mock<ICurrentUserContext>();
            mockCurrentUserContext.Setup(x => x.UserId).Returns("test-user");

            var mockDateTimeProvider = new Mock<IDateTimeProvider>();
            mockDateTimeProvider.Setup(x => x.UtcNow).Returns(DateTime.UtcNow);

            return new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);
        }

        [Fact]
        public async Task Test_OpeningBalance_And_MultipleDebits()
        {
            using var context = CreateContext();

            // 1. Create Bank Account
            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                BankName = "Test Bank",
                OpeningBalance = 1000m,
                CurrentBalance = 1000m
            };
            context.BankAccounts.Add(bankAccount);
            await context.SaveChangesAsync();

            // 2. Add multiple debits
            var entry1 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 100m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-10)
            };
            var entry2 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 200m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-5)
            };
            var entry3 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 300m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow
            };

            context.BankLedgerEntries.AddRange(entry1, entry2, entry3);
            await context.SaveChangesAsync();

            // 3. Assert balances
            var updatedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.Equal(400m, updatedBank.CurrentBalance);

            var dbEntries = await context.BankLedgerEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync();

            Assert.Equal(900m, dbEntries[0].RunningBalance);
            Assert.Equal(700m, dbEntries[1].RunningBalance);
            Assert.Equal(400m, dbEntries[2].RunningBalance);
        }

        [Fact]
        public async Task Test_OpeningBalance_Credits_And_Debits()
        {
            using var context = CreateContext();

            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                BankName = "Test Bank",
                OpeningBalance = 500m,
                CurrentBalance = 500m
            };
            context.BankAccounts.Add(bankAccount);
            await context.SaveChangesAsync();

            var entry1 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 0m,
                Credit = 300m,
                TransactionType = "Credit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-10)
            };
            var entry2 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 150m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow
            };

            context.BankLedgerEntries.AddRange(entry1, entry2);
            await context.SaveChangesAsync();

            var updatedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.Equal(650m, updatedBank.CurrentBalance);

            var dbEntries = await context.BankLedgerEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync();

            Assert.Equal(800m, dbEntries[0].RunningBalance);
            Assert.Equal(650m, dbEntries[1].RunningBalance);
        }

        [Fact]
        public async Task Test_Editing_Historical_Transactions()
        {
            using var context = CreateContext();

            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                BankName = "Test Bank",
                OpeningBalance = 1000m,
                CurrentBalance = 1000m
            };
            context.BankAccounts.Add(bankAccount);
            await context.SaveChangesAsync();

            var entry1 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 100m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-20)
            };
            var entry2 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 200m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-10)
            };
            var entry3 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 300m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow
            };

            context.BankLedgerEntries.AddRange(entry1, entry2, entry3);
            await context.SaveChangesAsync();

            // Edit historical second entry
            var dbEntry2 = await context.BankLedgerEntries.FindAsync(entry2.Id);
            dbEntry2.Debit = 50m;
            await context.SaveChangesAsync();

            // Assert sequential updates
            var updatedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.Equal(550m, updatedBank.CurrentBalance);

            var dbEntries = await context.BankLedgerEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync();

            Assert.Equal(900m, dbEntries[0].RunningBalance);
            Assert.Equal(850m, dbEntries[1].RunningBalance);
            Assert.Equal(550m, dbEntries[2].RunningBalance);
        }

        [Fact]
        public async Task Test_Deleting_Transactions()
        {
            using var context = CreateContext();

            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                BankName = "Test Bank",
                OpeningBalance = 1000m,
                CurrentBalance = 1000m
            };
            context.BankAccounts.Add(bankAccount);
            await context.SaveChangesAsync();

            var entry1 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 100m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-20)
            };
            var entry2 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 200m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-10)
            };
            var entry3 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 300m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow
            };

            context.BankLedgerEntries.AddRange(entry1, entry2, entry3);
            await context.SaveChangesAsync();

            // Delete entry 2
            var dbEntry2 = await context.BankLedgerEntries.FindAsync(entry2.Id);
            context.BankLedgerEntries.Remove(dbEntry2);
            await context.SaveChangesAsync();

            // Assert
            var updatedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.Equal(600m, updatedBank.CurrentBalance);

            var dbEntries = await context.BankLedgerEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync();

            Assert.Equal(2, dbEntries.Count);
            Assert.Equal(900m, dbEntries[0].RunningBalance);
            Assert.Equal(600m, dbEntries[1].RunningBalance);
        }

        [Fact]
        public async Task Test_Backdated_Transactions_Chronological_Insertion()
        {
            using var context = CreateContext();

            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                BankName = "Test Bank",
                OpeningBalance = 1000m,
                CurrentBalance = 1000m
            };
            context.BankAccounts.Add(bankAccount);
            await context.SaveChangesAsync();

            var entry1 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 100m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-20)
            };
            var entry2 = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 300m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow // T4
            };

            context.BankLedgerEntries.AddRange(entry1, entry2);
            await context.SaveChangesAsync();

            // Verify initial state
            var dbEntriesBefore = await context.BankLedgerEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync();
            Assert.Equal(900m, dbEntriesBefore[0].RunningBalance);
            Assert.Equal(600m, dbEntriesBefore[1].RunningBalance);

            // Add backdated transaction (T3) between entry1 (T2) and entry2 (T4)
            var backdatedEntry = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                BankAccountId = bankAccount.Id,
                Debit = 200m,
                Credit = 0m,
                TransactionType = "Debit",
                CreatedAt = DateTime.UtcNow.AddMinutes(-10) // Chronologically between T2 and T4
            };

            context.BankLedgerEntries.Add(backdatedEntry);
            await context.SaveChangesAsync();

            // Assert updated sequence
            var updatedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.Equal(400m, updatedBank.CurrentBalance);

            var dbEntriesAfter = await context.BankLedgerEntries
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .ToListAsync();

            Assert.Equal(3, dbEntriesAfter.Count);
            Assert.Equal(900m, dbEntriesAfter[0].RunningBalance);
            Assert.Equal(700m, dbEntriesAfter[1].RunningBalance); // Backdated transaction
            Assert.Equal(400m, dbEntriesAfter[2].RunningBalance); // Downstream entry recalculated
        }

        [Fact]
        public async Task Test_SettleCashBook_Partial_And_Full_Settlement()
        {
            var tenantId = Guid.NewGuid();
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

            var mockPlatformContext = new Mock<IPlatformDbContext>();

            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            var service = new Aquora.Application.Services.BankLedgerService(
                context,
                mockPlatformContext.Object,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object
            );

            // 1. Create Target Cashbook with negative balance
            var targetCashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Target Deficit Cashbook",
                OpeningBalance = 0m,
                CurrentBalance = -5000m
            };

            var deficitEntry = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBookId = targetCashBook.Id,
                LedgerAccountType = "CashBook",
                TransactionType = "Expense",
                Debit = 5000m,
                Credit = 0m,
                RunningBalance = -5000m,
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            };

            // 2. Create Source Cashbook with positive balance
            var sourceCashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Main Vault Cash",
                OpeningBalance = 10000m,
                CurrentBalance = 10000m
            };

            context.CashBooks.AddRange(targetCashBook, sourceCashBook);
            context.BankLedgerEntries.Add(deficitEntry);
            await context.SaveChangesAsync();

            // 3. Test Partial Settlement of 2000
            var settle1Req = new Aquora.Application.DTOs.SimpleAccounts.SettleCashBookRequest
            {
                Amount = 2000m,
                SettlementVia = "Cash",
                SourceCashBookId = sourceCashBook.Id,
                Date = DateTime.UtcNow,
                ReferenceNo = "SETTLE-TEST-01"
            };

            var settle1Id = await service.SettleCashBookAsync(targetCashBook.Id, settle1Req);
            Assert.NotEqual(Guid.Empty, settle1Id);

            var updatedTarget1 = await context.CashBooks.FindAsync(targetCashBook.Id);
            var updatedSource1 = await context.CashBooks.FindAsync(sourceCashBook.Id);

            Assert.Equal(-3000m, updatedTarget1.CurrentBalance);
            Assert.Equal(8000m, updatedSource1.CurrentBalance);

            // 4. Test Full Settlement of remaining 3000
            var settle2Req = new Aquora.Application.DTOs.SimpleAccounts.SettleCashBookRequest
            {
                Amount = 3000m,
                SettlementVia = "Cash",
                SourceCashBookId = sourceCashBook.Id,
                Date = DateTime.UtcNow,
                ReferenceNo = "SETTLE-TEST-02"
            };

            var settle2Id = await service.SettleCashBookAsync(targetCashBook.Id, settle2Req);
            Assert.NotEqual(Guid.Empty, settle2Id);

            var updatedTarget2 = await context.CashBooks.FindAsync(targetCashBook.Id);
            var updatedSource2 = await context.CashBooks.FindAsync(sourceCashBook.Id);

            Assert.Equal(0m, updatedTarget2.CurrentBalance);
            Assert.Equal(5000m, updatedSource2.CurrentBalance);

            // 5. Test Invalid Operation: attempting to settle when balance is 0
            var settleZeroReq = new Aquora.Application.DTOs.SimpleAccounts.SettleCashBookRequest
            {
                Amount = 100m,
                SettlementVia = "Cash",
                SourceCashBookId = sourceCashBook.Id,
                Date = DateTime.UtcNow
            };
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.SettleCashBookAsync(targetCashBook.Id, settleZeroReq));
        }

        [Fact]
        public async Task Test_SettleCashBook_WithOwnerContribution_DirectCash()
        {
            var tenantId = Guid.NewGuid();
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

            var mockPlatformContext = new Mock<IPlatformDbContext>();

            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            var service = new Aquora.Application.Services.BankLedgerService(
                context,
                mockPlatformContext.Object,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object
            );

            // 1. Create Owner
            var owner = new Aquora.Domain.Entities.Finance.Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Rajesh Sharma",
                Phone = "9876543210",
                OwnershipPercentage = 50,
                InitialInvestment = 10000m,
                CurrentInvestment = 10000m
            };
            context.Owners.Add(owner);

            // 2. Create Target CashBook with negative balance of -4000
            var targetCashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Daily Retail Register",
                OpeningBalance = 0m,
                CurrentBalance = -4000m
            };
            var deficitEntry = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBookId = targetCashBook.Id,
                LedgerAccountType = "CashBook",
                TransactionType = "Expense",
                Debit = 4000m,
                Credit = 0m,
                RunningBalance = -4000m,
                CreatedAt = DateTime.UtcNow.AddHours(-2)
            };
            context.CashBooks.Add(targetCashBook);
            context.BankLedgerEntries.Add(deficitEntry);
            await context.SaveChangesAsync();

            // 3. Settle with Owner Contribution Direct to Target CashBook
            var req = new Aquora.Application.DTOs.SimpleAccounts.SettleCashBookRequest
            {
                Amount = 4000m,
                SettlementVia = "Cash",
                SourceCashBookId = targetCashBook.Id, // Direct deposit
                IsOwnerContribution = true,
                OwnerId = owner.Id,
                Date = DateTime.UtcNow,
                ReferenceNo = "OC-SETTLE-001",
                Description = "Capital infusion by Rajesh to clear deficit"
            };

            var settlementId = await service.SettleCashBookAsync(targetCashBook.Id, req);
            Assert.NotEqual(Guid.Empty, settlementId);

            // Verify Target CashBook balance is now settled to 0
            var updatedTarget = await context.CashBooks.FindAsync(targetCashBook.Id);
            Assert.NotNull(updatedTarget);
            Assert.Equal(0m, updatedTarget!.CurrentBalance);

            // Verify Owner Investment Transaction created
            var ownerTxn = await context.OwnerInvestmentTransactions
                .FirstOrDefaultAsync(t => t.OwnerId == owner.Id && t.Amount == 4000m);
            Assert.NotNull(ownerTxn);
            Assert.Equal("Investment", ownerTxn!.TransactionType);

            // Verify Owner CurrentInvestment increased
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(14000m, updatedOwner!.CurrentInvestment);

            // Verify BankLedgerEntry for Owner Investment
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.RelatedEntityId == settlementId && e.TransactionType == "Owner Investment");
            Assert.NotNull(ledgerEntry);
            Assert.Equal(targetCashBook.Id, ledgerEntry!.CashBookId);
            Assert.Equal(4000m, ledgerEntry.Credit);
            Assert.Equal(0m, ledgerEntry.Debit);
        }

        [Fact]
        public async Task Test_SettleCashBook_WithOwnerContribution_ViaBank()
        {
            var tenantId = Guid.NewGuid();
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

            var mockPlatformContext = new Mock<IPlatformDbContext>();

            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            var service = new Aquora.Application.Services.BankLedgerService(
                context,
                mockPlatformContext.Object,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object
            );

            // 1. Create Owner
            var owner = new Aquora.Domain.Entities.Finance.Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Priya Patel",
                Phone = "9871112223",
                OwnershipPercentage = 30,
                InitialInvestment = 50000m,
                CurrentInvestment = 50000m
            };
            context.Owners.Add(owner);

            // 2. Create Target CashBook (-2500 deficit)
            var targetCashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Factory Register",
                OpeningBalance = 0m,
                CurrentBalance = -2500m
            };
            var deficitEntry = new BankLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CashBookId = targetCashBook.Id,
                LedgerAccountType = "CashBook",
                TransactionType = "Expense",
                Debit = 2500m,
                Credit = 0m,
                RunningBalance = -2500m,
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            };

            // 3. Create Existing Bank Account
            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BankName = "ICICI Bank",
                AccountName = "Aquora Operations",
                AccountNumber = "00234567890",
                IfscCode = "ICIC0000023",
                OpeningBalance = 10000m,
                CurrentBalance = 10000m
            };

            context.CashBooks.Add(targetCashBook);
            context.BankLedgerEntries.Add(deficitEntry);
            context.BankAccounts.Add(bankAccount);
            await context.SaveChangesAsync();

            // 4. Settle via Bank Account with Owner Contribution
            var req = new Aquora.Application.DTOs.SimpleAccounts.SettleCashBookRequest
            {
                Amount = 2500m,
                SettlementVia = "Bank",
                SourceBankAccountId = bankAccount.Id,
                IsOwnerContribution = true,
                OwnerId = owner.Id,
                Date = DateTime.UtcNow,
                ReferenceNo = "BNK-SETTLE-001"
            };

            var settlementId = await service.SettleCashBookAsync(targetCashBook.Id, req);
            Assert.NotEqual(Guid.Empty, settlementId);

            // Target Cashbook is settled from -2500 to 0
            var updatedTarget = await context.CashBooks.FindAsync(targetCashBook.Id);
            Assert.NotNull(updatedTarget);
            Assert.Equal(0m, updatedTarget!.CurrentBalance);

            // Bank Account received 2500 credit from owner, and disbursed 2500 debit to settle cashbook
            // Net bank balance remains 10000m
            var updatedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.NotNull(updatedBank);
            Assert.Equal(10000m, updatedBank!.CurrentBalance);

            // Owner investment transaction recorded
            var ownerTxn = await context.OwnerInvestmentTransactions
                .FirstOrDefaultAsync(t => t.OwnerId == owner.Id && t.Amount == 2500m);
            Assert.NotNull(ownerTxn);
            Assert.Equal("Investment", ownerTxn!.TransactionType);

            // Owner current investment increased by 2500 to 52500
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(52500m, updatedOwner!.CurrentInvestment);

            // Verify entries on bank ledger: one Owner Investment credit (+2500), one Cashbook Settlement debit (-2500)
            var bankEntries = await context.BankLedgerEntries
                .Where(e => e.RelatedEntityId == settlementId && e.BankAccountId == bankAccount.Id)
                .ToListAsync();
            Assert.Equal(2, bankEntries.Count);
            Assert.Contains(bankEntries, e => e.TransactionType == "Owner Investment" && e.Credit == 2500m);
            Assert.Contains(bankEntries, e => e.TransactionType == "Cashbook Settlement" && e.Debit == 2500m);
        }

        [Fact]
        public async Task Test_SettleCashBook_WithOwnerContribution_Validation_MissingAndCrossTenant()
        {
            var tenantId = Guid.NewGuid();
            var otherTenantId = Guid.NewGuid();
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

            var mockPlatformContext = new Mock<IPlatformDbContext>();

            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            var service = new Aquora.Application.Services.BankLedgerService(
                context,
                mockPlatformContext.Object,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object
            );

            // Create target cashbook with negative balance
            var targetCashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Register 1",
                OpeningBalance = 0m,
                CurrentBalance = -1000m
            };
            context.CashBooks.Add(targetCashBook);

            // Owner in other tenant
            var crossTenantOwner = new Aquora.Domain.Entities.Finance.Owner
            {
                Id = Guid.NewGuid(),
                TenantId = otherTenantId,
                Name = "Intruder Owner",
                Phone = "1234567890"
            };
            context.Owners.Add(crossTenantOwner);
            await context.SaveChangesAsync();

            // 1. Missing OwnerId when IsOwnerContribution is true -> ArgumentException
            var missingOwnerReq = new Aquora.Application.DTOs.SimpleAccounts.SettleCashBookRequest
            {
                Amount = 500m,
                SettlementVia = "Cash",
                IsOwnerContribution = true,
                OwnerId = null
            };
            await Assert.ThrowsAsync<ArgumentException>(() => service.SettleCashBookAsync(targetCashBook.Id, missingOwnerReq));

            // 2. Cross-tenant or non-existent OwnerId -> KeyNotFoundException
            var crossTenantReq = new Aquora.Application.DTOs.SimpleAccounts.SettleCashBookRequest
            {
                Amount = 500m,
                SettlementVia = "Cash",
                IsOwnerContribution = true,
                OwnerId = crossTenantOwner.Id
            };
            await Assert.ThrowsAsync<KeyNotFoundException>(() => service.SettleCashBookAsync(targetCashBook.Id, crossTenantReq));
        }
    }
}
