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
    }
}
