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
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class CashBookAddCashOwnerLinkageTests
    {
        private (TenantDbContext Context, BankLedgerService LedgerService, SimpleAccountsService SimpleAccountsService, Guid TenantId, Guid CompanyId) CreateTestSetup()
        {
            var tenantId = Guid.NewGuid();
            var companyId = Guid.NewGuid();

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns("public");

            var mockCurrentUserContext = new Mock<ICurrentUserContext>();
            mockCurrentUserContext.Setup(x => x.UserId).Returns("test-admin-id");
            mockCurrentUserContext.Setup(x => x.Email).Returns("admin@aquora.com");

            var mockDateTimeProvider = new Mock<IDateTimeProvider>();
            mockDateTimeProvider.Setup(x => x.UtcNow).Returns(DateTime.UtcNow);

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);
            var platformContext = new PlatformDbContext(platformOptions);

            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Aquora Test Plant",
                Code = "ATP"
            };
            context.Companies.Add(company);
            context.SaveChanges();

            var bankLedgerService = new BankLedgerService(
                context,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object
            );

            var simpleAccountsService = new SimpleAccountsService(
                context,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object,
                bankLedgerService
            );

            return (context, bankLedgerService, simpleAccountsService, tenantId, companyId);
        }

        [Fact]
        public async Task AddCash_OwnerLinkedCashbook_OwnerContribution_IncreasesBalanceFrom50000To60000_AndUpdatesOwnerInvestment()
        {
            // Case 1 & 3 & 4: A ₹10,000 contribution increases a ₹50,000 balance to ₹60,000
            // and records owner investment history atomically.
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            // 1. Create Owner
            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan",
                Phone = "+91 9999999999",
                OwnershipPercentage = 50,
                InitialInvestment = 50000m,
                CurrentInvestment = 50000m,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "Admin"
            };
            context.Owners.Add(owner);

            // 2. Create Owner-linked Cashbook
            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan Cashbook",
                OpeningBalance = 50000m,
                CurrentBalance = 50000m,
                OwnerId = owner.Id,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "Admin"
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // 3. Act: Add Cash ₹10,000 with Source = "Owner Investment"
            var request = new AddMoneyRequest
            {
                Amount = 10000m,
                Source = "Owner Investment",
                Date = DateTime.UtcNow,
                Description = "Additional capital contribution",
                OwnerId = owner.Id
            };

            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, request);

            // 4. Assert
            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            Assert.Equal(10000m, entry.Credit);
            Assert.Equal(0m, entry.Debit);
            Assert.Equal("Owner Investment", entry.TransactionType);
            Assert.Equal(60000m, entry.RunningBalance);

            // Verify Cashbook Persisted Balance
            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(60000m, updatedCashBook.CurrentBalance);

            // Verify Owner Persisted CurrentInvestment
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(60000m, updatedOwner.CurrentInvestment);

            // Verify Single Owner Investment History Record
            var ownerTx = await context.OwnerInvestmentTransactions
                .Where(t => t.OwnerId == owner.Id && t.Amount == 10000m)
                .ToListAsync();
            Assert.Single(ownerTx);
            Assert.Equal("Investment", ownerTx[0].TransactionType);
            Assert.Equal("Additional capital contribution", ownerTx[0].Notes);

            // Verify Ledger Entry Links to Owner Investment Transaction
            Assert.Equal("OwnerInvestmentTransaction", entry.RelatedEntityType);
            Assert.Equal(ownerTx[0].Id, entry.RelatedEntityId);
        }

        [Fact]
        public async Task AddCash_OwnerLinkedCashbook_NonInvestmentReceipt_IncreasesBalance_DoesNotModifyOwnerEquity()
        {
            // Case 2 & 5: Distinguish owner contributions from other cash receipts
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan",
                Phone = "+91 9999999999",
                OwnershipPercentage = 50,
                InitialInvestment = 50000m,
                CurrentInvestment = 50000m
            };
            context.Owners.Add(owner);

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan Cashbook",
                OpeningBalance = 50000m,
                CurrentBalance = 50000m,
                OwnerId = owner.Id,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // Act: Add Cash ₹5,000 with Source = "Customer Advance" (operational receipt)
            var request = new AddMoneyRequest
            {
                Amount = 5000m,
                Source = "Customer Advance",
                Date = DateTime.UtcNow,
                Description = "Cash collected from distribution party"
            };

            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, request);

            // Assert
            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            Assert.Equal(5000m, entry.Credit);
            Assert.Equal("Deposit", entry.TransactionType);
            Assert.Equal(55000m, entry.RunningBalance);

            // Cashbook balance updated: 50,000 + 5,000 = 55,000
            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(55000m, updatedCashBook.CurrentBalance);

            // Owner investment remains UNCHANGED at 50,000
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(50000m, updatedOwner.CurrentInvestment);

            // No OwnerInvestmentTransaction created
            var ownerTransactions = await context.OwnerInvestmentTransactions
                .Where(t => t.OwnerId == owner.Id)
                .ToListAsync();
            Assert.Empty(ownerTransactions);
        }

        [Fact]
        public async Task AddCash_OrdinaryCashbook_WorksNormallyWithoutOwner()
        {
            // Case: Add Cash on an ordinary cashbook continues to work
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Plant Floor Petty Cash",
                OpeningBalance = 15000m,
                CurrentBalance = 15000m,
                OwnerId = null,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            var request = new AddMoneyRequest
            {
                Amount = 5000m,
                Source = "Cash Deposit",
                Date = DateTime.UtcNow,
                Description = "Top up petty cash"
            };

            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, request);

            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            Assert.Equal(20000m, entry.RunningBalance);

            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(20000m, updatedCashBook.CurrentBalance);
            Assert.Null(updatedCashBook.OwnerId);
        }

        [Fact]
        public async Task AddCash_NegativeBalance_CalculatesSignedBalanceCorrectly()
        {
            // Signed balance calculation: -15,000 + 20,000 = +5,000
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Overdrawn Cashbook",
                OpeningBalance = -15000m,
                CurrentBalance = -15000m,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            var request = new AddMoneyRequest
            {
                Amount = 20000m,
                Source = "Cash Deposit",
                Date = DateTime.UtcNow
            };

            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, request);

            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            Assert.Equal(5000m, entry.RunningBalance);

            var updated = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updated);
            Assert.Equal(5000m, updated.CurrentBalance);
        }

        [Fact]
        public async Task AddCash_ZeroOrNegativeAmount_ThrowsArgumentException()
        {
            var (_, ledgerService, _, _, _) = CreateTestSetup();

            var request = new AddMoneyRequest
            {
                Amount = 0m,
                Source = "Cash Deposit",
                Date = DateTime.UtcNow
            };

            await Assert.ThrowsAsync<ArgumentException>(() => ledgerService.AddMoneyAsync(null, Guid.NewGuid(), request));
        }

        [Fact]
        public async Task SimpleAccountsService_GetCashBooksAsync_IncludesLinkedOwnerMetadata()
        {
            // Case: The row action must retrieve the selected cashbook's linked owner
            var (context, _, simpleAccountsService, tenantId, companyId) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan",
                Phone = "+91 9999999999",
                OwnershipPercentage = 100,
                InitialInvestment = 100000m,
                CurrentInvestment = 100000m
            };
            context.Owners.Add(owner);

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan Cashbook",
                OpeningBalance = 100000m,
                CurrentBalance = 100000m,
                OwnerId = owner.Id,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            var result = await simpleAccountsService.GetCashBooksAsync(1, 10, null, null);

            Assert.Single(result.Items);
            Assert.Equal(owner.Id, result.Items[0].OwnerId);
            Assert.Equal("sinan", result.Items[0].OwnerName);
            Assert.Equal("sinan Cashbook", result.Items[0].Name);
        }

        [Fact]
        public async Task DeleteDepositAsync_OwnerInvestment_RevertsBothCashBookAndOwnerInvestmentAtomically()
        {
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan",
                Phone = "+91 9999999999",
                OwnershipPercentage = 50,
                InitialInvestment = 50000m,
                CurrentInvestment = 50000m
            };
            context.Owners.Add(owner);

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "sinan Cashbook",
                OpeningBalance = 50000m,
                CurrentBalance = 50000m,
                OwnerId = owner.Id,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // Add Cash ₹10,000
            var addRequest = new AddMoneyRequest
            {
                Amount = 10000m,
                Source = "Owner Investment",
                Date = DateTime.UtcNow,
                OwnerId = owner.Id
            };
            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, addRequest);

            // Revert by calling DeleteDepositAsync
            await ledgerService.DeleteDepositAsync(entryId);

            // Cashbook reverted to 50,000
            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(50000m, updatedCashBook.CurrentBalance);

            // Owner current investment reverted to 50,000
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(50000m, updatedOwner.CurrentInvestment);

            // Owner transaction marked deleted
            var ownerTx = await context.OwnerInvestmentTransactions
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.OwnerId == owner.Id && t.Amount == 10000m);
            Assert.NotNull(ownerTx);
            Assert.True(ownerTx.IsDeleted);
        }

        [Fact]
        public async Task AddCash_OwnerInvestment_MissingOwnerId_ThrowsArgumentException()
        {
            // Acceptance: Server-side rejection of missing owner ID for Owner Investment
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "General Cash Register",
                OpeningBalance = 10000m,
                CurrentBalance = 10000m,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            var request = new AddMoneyRequest
            {
                Amount = 5000m,
                Source = "Owner Investment",
                Date = DateTime.UtcNow,
                OwnerId = null // Missing owner ID
            };

            var ex = await Assert.ThrowsAsync<ArgumentException>(() => ledgerService.AddMoneyAsync(null, cashBook.Id, request));
            Assert.Contains("Investing owner must be selected", ex.Message);
        }

        [Fact]
        public async Task AddCash_OrdinaryCashbook_OwnerInvestment_SucceedsAndLinksOwnerInvestment()
        {
            // Primary failing scenario from screenshots: Normal non-owner cashbook with Owner Investment
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "John Investor",
                Phone = "+91 9876543210",
                OwnershipPercentage = 40,
                InitialInvestment = 200000m,
                CurrentInvestment = 200000m
            };
            context.Owners.Add(owner);

            // Ordinary cashbook (OwnerId is null)
            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Cashbook 1 (Operating)",
                OpeningBalance = 10000m,
                CurrentBalance = 10000m,
                OwnerId = null,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // Act: Owner invests ₹10,000 into Cashbook 1
            var request = new AddMoneyRequest
            {
                Amount = 10000m,
                Source = "Owner Investment",
                Date = DateTime.UtcNow,
                Description = "Fresh capital injection",
                OwnerId = owner.Id
            };

            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, request);

            // Assert: Cashbook balance increased from 10,000 to 20,000
            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(20000m, updatedCashBook.CurrentBalance);
            Assert.Null(updatedCashBook.OwnerId); // Remains an ordinary cashbook

            // Owner investment increased from 200,000 to 210,000
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(210000m, updatedOwner.CurrentInvestment);

            // Ledger entry created and linked
            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            Assert.Equal("Owner Investment", entry.TransactionType);
            Assert.Equal(10000m, entry.Credit);
            Assert.Equal(20000m, entry.RunningBalance);
            Assert.Equal("OwnerInvestmentTransaction", entry.RelatedEntityType);

            var ownerTxn = await context.OwnerInvestmentTransactions.FindAsync(entry.RelatedEntityId);
            Assert.NotNull(ownerTxn);
            Assert.Equal(owner.Id, ownerTxn.OwnerId);
            Assert.Equal(10000m, ownerTxn.Amount);
            Assert.Equal("Investment", ownerTxn.TransactionType);
        }

        [Fact]
        public async Task AddCash_OwnerCashbook_DifferentOwner_PreservesActualContributingOwner()
        {
            // Case: Contributing owner identity is preserved, not silently attributed to cashbook's associated owner
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var cashBookOwner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Owner Alice",
                OwnershipPercentage = 50,
                CurrentInvestment = 100000m
            };
            var contributingOwner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Owner Bob",
                OwnershipPercentage = 50,
                CurrentInvestment = 80000m
            };
            context.Owners.AddRange(cashBookOwner, contributingOwner);

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Alice Dedicated Cashbook",
                OpeningBalance = 50000m,
                CurrentBalance = 50000m,
                OwnerId = cashBookOwner.Id,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // Bob contributes ₹15,000
            var request = new AddMoneyRequest
            {
                Amount = 15000m,
                Source = "Owner Investment",
                Date = DateTime.UtcNow,
                Description = "Bob's capital contribution",
                OwnerId = contributingOwner.Id
            };

            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, request);

            // Alice's investment remains unchanged
            var updatedAlice = await context.Owners.FindAsync(cashBookOwner.Id);
            Assert.NotNull(updatedAlice);
            Assert.Equal(100000m, updatedAlice.CurrentInvestment);

            // Bob's investment is credited
            var updatedBob = await context.Owners.FindAsync(contributingOwner.Id);
            Assert.NotNull(updatedBob);
            Assert.Equal(95000m, updatedBob.CurrentInvestment);

            // Cashbook balance is updated
            var updatedBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedBook);
            Assert.Equal(65000m, updatedBook.CurrentBalance);

            // Transaction links to Bob
            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            var ownerTxn = await context.OwnerInvestmentTransactions.FindAsync(entry.RelatedEntityId);
            Assert.NotNull(ownerTxn);
            Assert.Equal(contributingOwner.Id, ownerTxn.OwnerId);
        }

        [Fact]
        public async Task AddCash_NonInvestmentSource_WithStaleOwnerId_DoesNotCreateOwnerInvestment()
        {
            // Case: Non-investment source must not create owner investment even if client sent stale OwnerId
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Test Owner",
                CurrentInvestment = 50000m
            };
            context.Owners.Add(owner);

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Main Cashbook",
                OpeningBalance = 20000m,
                CurrentBalance = 20000m,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            var request = new AddMoneyRequest
            {
                Amount = 5000m,
                Source = "Cash Deposit", // Non-investment source
                Date = DateTime.UtcNow,
                Description = "Cash from sales counter",
                OwnerId = owner.Id // Stale ID from prior selection
            };

            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, request);

            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            Assert.Equal("Deposit", entry.TransactionType);
            Assert.Null(entry.RelatedEntityId);

            // Owner investment remains 50,000
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(50000m, updatedOwner.CurrentInvestment);

            // No OwnerInvestmentTransaction created
            var ownerTxns = await context.OwnerInvestmentTransactions.Where(t => t.OwnerId == owner.Id).ToListAsync();
            Assert.Empty(ownerTxns);
        }

        [Fact]
        public async Task UpdateDepositAsync_CategorySwitching_MaintainsFinancialIntegrity()
        {
            // Case: Switch from regular deposit to Owner Investment, and update amounts atomically
            var (context, ledgerService, _, tenantId, companyId) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Dynamic Owner",
                CurrentInvestment = 100000m
            };
            context.Owners.Add(owner);

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Plant Petty Cash",
                OpeningBalance = 30000m,
                CurrentBalance = 30000m,
                IsActive = true
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // 1. Initial Deposit as "Cash Deposit" ₹10,000
            var initialRequest = new AddMoneyRequest
            {
                Amount = 10000m,
                Source = "Cash Deposit",
                Date = DateTime.UtcNow
            };
            var entryId = await ledgerService.AddMoneyAsync(null, cashBook.Id, initialRequest);

            // 2. Edit Deposit: Switch to "Owner Investment" ₹12,000 with selected Owner
            var updateRequest = new AddMoneyRequest
            {
                Amount = 12000m,
                Source = "Owner Investment",
                Date = DateTime.UtcNow,
                Description = "Corrected to owner capital contribution",
                OwnerId = owner.Id
            };
            await ledgerService.UpdateDepositAsync(entryId, updateRequest);

            // Verify cashbook balance: 30,000 + 12,000 = 42,000
            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(42000m, updatedCashBook.CurrentBalance);

            // Verify owner investment increased from 100,000 to 112,000
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(112000m, updatedOwner.CurrentInvestment);

            // Verify ledger entry updated to Owner Investment
            var entry = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry);
            Assert.Equal("Owner Investment", entry.TransactionType);
            Assert.Equal(12000m, entry.Credit);
            Assert.Equal("OwnerInvestmentTransaction", entry.RelatedEntityType);

            // 3. Edit again: Switch away from "Owner Investment" to "Cash Deposit" ₹8,000
            var updateRequest2 = new AddMoneyRequest
            {
                Amount = 8000m,
                Source = "Cash Deposit",
                Date = DateTime.UtcNow,
                Description = "Switched to standard cash deposit"
            };
            await ledgerService.UpdateDepositAsync(entryId, updateRequest2);

            // Owner investment reverted back to 100,000
            var revertedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(revertedOwner);
            Assert.Equal(100000m, revertedOwner.CurrentInvestment);

            // Cashbook balance updated to 30,000 + 8,000 = 38,000
            var revertedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(revertedCashBook);
            Assert.Equal(38000m, revertedCashBook.CurrentBalance);

            // Ledger entry reverted to Deposit
            var entry2 = await context.BankLedgerEntries.FindAsync(entryId);
            Assert.NotNull(entry2);
            Assert.Equal("Deposit", entry2.TransactionType);
            Assert.Null(entry2.RelatedEntityId);
        }
    }
}
