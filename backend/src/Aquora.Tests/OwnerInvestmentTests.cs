using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class OwnerInvestmentTests
    {
        private (TenantDbContext Context, SimpleAccountsService Service, Guid TenantId, Guid CompanyId, BankAccount BankAccount) CreateTestSetup()
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

            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BankName = "State Bank of India",
                AccountName = "Operating Current Account",
                AccountNumber = "SBI-9876543210",
                OpeningBalance = 500000m,
                CurrentBalance = 500000m,
                IsActive = true
            };
            context.BankAccounts.Add(bankAccount);
            context.SaveChanges();

            var bankLedgerService = new BankLedgerService(
                context,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object
            );

            var service = new SimpleAccountsService(
                context,
                platformContext,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object,
                bankLedgerService
            );

            return (context, service, tenantId, companyId, bankAccount);
        }

        [Fact]
        public async Task CreateOwnerAsync_WithCashInvestment_CreatesDedicatedCashbook_AndCreditsBalance()
        {
            var (context, service, tenantId, companyId, _) = CreateTestSetup();

            var request = new CreateOwnerRequest
            {
                Name = "Sanoof Sinan",
                Phone = "+91 9876543210",
                Email = "sanoof@example.com",
                OwnershipPercentage = 50m,
                InitialInvestment = 250000m,
                InvestmentReceivedIn = "Cash",
                Notes = "Founding equity partner"
            };

            var result = await service.CreateOwnerAsync(request);

            Assert.NotNull(result);
            Assert.Equal("Sanoof Sinan", result.Name);
            Assert.Equal(250000m, result.InitialInvestment);
            Assert.Equal(250000m, result.CurrentInvestment);

            // Verify dedicated cashbook was created
            var cashBook = await context.CashBooks
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Name == "Sanoof Sinan Cashbook");
            Assert.NotNull(cashBook);
            Assert.Equal("Dedicated cashbook for owner Sanoof Sinan", cashBook.Description);
            Assert.Equal(250000m, cashBook.CurrentBalance);

            // Verify BankLedgerEntry was recorded for the cashbook
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.CashBookId == cashBook.Id && e.TransactionType == "Owner Investment");
            Assert.NotNull(ledgerEntry);
            Assert.Equal(0m, ledgerEntry.Debit);
            Assert.Equal(250000m, ledgerEntry.Credit);
            Assert.Equal(250000m, ledgerEntry.RunningBalance);
            Assert.Equal(result.Id, ledgerEntry.RelatedEntityId);
            Assert.Equal("Owner", ledgerEntry.RelatedEntityType);
        }

        [Fact]
        public async Task CreateOwnerAsync_WithBankAccountInvestment_CreditsBankAccountBalance_AndRecordsLedgerEntry()
        {
            var (context, service, tenantId, companyId, bankAccount) = CreateTestSetup();

            var initialBankBalance = bankAccount.CurrentBalance; // 500,000

            var request = new CreateOwnerRequest
            {
                Name = "Fathima Noor",
                Phone = "+91 9123456789",
                Email = "fathima@example.com",
                OwnershipPercentage = 30m,
                InitialInvestment = 300000m,
                InvestmentReceivedIn = "BankAccount",
                BankAccountId = bankAccount.Id,
                Notes = "Angel investment direct to SBI account"
            };

            var result = await service.CreateOwnerAsync(request);

            Assert.NotNull(result);
            Assert.Equal("Fathima Noor", result.Name);
            Assert.Equal(300000m, result.InitialInvestment);

            // Bank balance should be incremented by 300,000 (500,000 + 300,000 = 800,000)
            var refreshedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.NotNull(refreshedBank);
            Assert.Equal(initialBankBalance + 300000m, refreshedBank.CurrentBalance);

            // Ledger entry should be posted to bank account
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.BankAccountId == bankAccount.Id && e.TransactionType == "Owner Investment");
            Assert.NotNull(ledgerEntry);
            Assert.Equal(0m, ledgerEntry.Debit);
            Assert.Equal(300000m, ledgerEntry.Credit);
            Assert.Equal(initialBankBalance + 300000m, ledgerEntry.RunningBalance);
            Assert.Equal(result.Id, ledgerEntry.RelatedEntityId);
            Assert.Equal("Owner", ledgerEntry.RelatedEntityType);
        }

        [Fact]
        public async Task CreateOwnerAsync_WithZeroInvestment_CreatesDedicatedCashbookWithZeroBalance()
        {
            var (context, service, tenantId, _, _) = CreateTestSetup();

            var request = new CreateOwnerRequest
            {
                Name = "Rahul Sharma",
                Phone = "+91 9988776655",
                OwnershipPercentage = 10m,
                InitialInvestment = 0m,
                InvestmentReceivedIn = "Cash"
            };

            var result = await service.CreateOwnerAsync(request);

            Assert.NotNull(result);
            Assert.Equal(0m, result.InitialInvestment);

            var cashBook = await context.CashBooks
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Name == "Rahul Sharma Cashbook");
            Assert.NotNull(cashBook);
            Assert.Equal(0m, cashBook.CurrentBalance);

            // No ledger entry should be created since investment was 0
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.CashBookId == cashBook.Id);
            Assert.Null(ledgerEntry);
        }

        [Fact]
        public async Task CreateOwnerAsync_BankAccountOptionWithoutAccountId_ThrowsArgumentException()
        {
            var (_, service, _, _, _) = CreateTestSetup();

            var request = new CreateOwnerRequest
            {
                Name = "Arjun Patel",
                Phone = "+91 9898989898",
                OwnershipPercentage = 20m,
                InitialInvestment = 100000m,
                InvestmentReceivedIn = "BankAccount",
                BankAccountId = null // Missing required account
            };

            await Assert.ThrowsAsync<ArgumentException>(() => service.CreateOwnerAsync(request));
        }

        [Fact]
        public async Task CreateOwnerAsync_NonExistentBankAccount_ThrowsKeyNotFoundException()
        {
            var (_, service, _, _, _) = CreateTestSetup();

            var request = new CreateOwnerRequest
            {
                Name = "Kiran Rao",
                Phone = "+91 9797979797",
                OwnershipPercentage = 20m,
                InitialInvestment = 150000m,
                InvestmentReceivedIn = "BankAccount",
                BankAccountId = Guid.NewGuid() // Non-existent account
            };

            await Assert.ThrowsAsync<KeyNotFoundException>(() => service.CreateOwnerAsync(request));
        }

        [Fact]
        public async Task CreateOwnerAsync_DuplicateOwnerName_CreatesUniqueCashbookName()
        {
            var (context, service, tenantId, _, _) = CreateTestSetup();

            var request1 = new CreateOwnerRequest
            {
                Name = "John Doe",
                Phone = "+91 9000000001",
                OwnershipPercentage = 20m,
                InitialInvestment = 50000m,
                InvestmentReceivedIn = "Cash"
            };

            var owner1 = await service.CreateOwnerAsync(request1);
            Assert.NotNull(owner1);

            var request2 = new CreateOwnerRequest
            {
                Name = "John Doe",
                Phone = "+91 9000000002",
                OwnershipPercentage = 20m,
                InitialInvestment = 60000m,
                InvestmentReceivedIn = "Cash"
            };

            var owner2 = await service.CreateOwnerAsync(request2);
            Assert.NotNull(owner2);

            var cashbooks = await context.CashBooks
                .Where(c => c.TenantId == tenantId && c.Name.Contains("John Doe Cashbook"))
                .ToListAsync();

            Assert.Equal(2, cashbooks.Count);
            Assert.Contains(cashbooks, c => c.Name == "John Doe Cashbook");
            Assert.Contains(cashbooks, c => c.Name.StartsWith("John Doe Cashbook ("));
        }

        [Fact]
        public async Task AddOwnerTransactionAsync_CashInvestment_IncreasesCashbookBalance_AndCreatesLedgerEntry()
        {
            // Arrange
            var (context, service, tenantId, companyId, _) = CreateTestSetup();

            // Create owner with initial investment
            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Sinaan",
                Phone = "+91 9999999999",
                OwnershipPercentage = 40m,
                InitialInvestment = 50000m,
                CurrentInvestment = 50000m,
                CreatedAt = DateTime.UtcNow
            };
            context.Owners.Add(owner);

            // Create cashbook with ₹50,000 starting balance
            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Sinaan Cashbook",
                OpeningBalance = 50000m,
                CurrentBalance = 50000m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // Act: Additional owner investment of ₹10,000 to Sinaan Cashbook
            var request = new CreateOwnerInvestmentTransactionRequest
            {
                TransactionDate = DateTime.UtcNow,
                Amount = 10000m,
                TransactionType = "Investment",
                PaymentMethod = "CashBook",
                CashBookId = cashBook.Id,
                Notes = "Q3 capital infusion"
            };

            var result = await service.AddOwnerTransactionAsync(owner.Id, request);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(10000m, result.Amount);
            Assert.Equal("Investment", result.TransactionType);

            // Owner investment total updated
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(60000m, updatedOwner.CurrentInvestment); // 50,000 + 10,000

            // Cashbook balance updated to ₹60,000
            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(60000m, updatedCashBook.CurrentBalance);

            // Financial ledger entry created
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.CashBookId == cashBook.Id && e.RelatedEntityId == result.Id);
            Assert.NotNull(ledgerEntry);
            Assert.Equal("Owner Investment", ledgerEntry.TransactionType);
            Assert.Equal(0m, ledgerEntry.Debit);
            Assert.Equal(10000m, ledgerEntry.Credit);
            Assert.Equal(60000m, ledgerEntry.RunningBalance);
            Assert.Equal("OwnerInvestmentTransaction", ledgerEntry.RelatedEntityType);
        }

        [Fact]
        public async Task AddOwnerTransactionAsync_BankInvestment_IncreasesBankAccountBalance_AndCreatesLedgerEntry()
        {
            // Arrange
            var (context, service, tenantId, companyId, _) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Equity Partner",
                OwnershipPercentage = 25m,
                InitialInvestment = 100000m,
                CurrentInvestment = 100000m,
                CreatedAt = DateTime.UtcNow
            };
            context.Owners.Add(owner);

            // Create bank account with exact prompt balance: ₹6,31,339.04
            var bankAccount = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BankName = "SBI Bank",
                AccountName = "Primary Operating Account",
                AccountNumber = "SBI-631339",
                OpeningBalance = 631339.04m,
                CurrentBalance = 631339.04m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            context.BankAccounts.Add(bankAccount);
            await context.SaveChangesAsync();

            // Act: Additional owner investment of ₹10,000 to SBI Bank
            var request = new CreateOwnerInvestmentTransactionRequest
            {
                TransactionDate = DateTime.UtcNow,
                Amount = 10000m,
                TransactionType = "Investment",
                PaymentMethod = "BankAccount",
                BankAccountId = bankAccount.Id,
                Notes = "Growth investment"
            };

            var result = await service.AddOwnerTransactionAsync(owner.Id, request);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(10000m, result.Amount);

            // Bank balance updated: ₹6,31,339.04 + ₹10,000 = ₹6,41,339.04
            var updatedBank = await context.BankAccounts.FindAsync(bankAccount.Id);
            Assert.NotNull(updatedBank);
            Assert.Equal(641339.04m, updatedBank.CurrentBalance);

            // Owner total updated
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(110000m, updatedOwner.CurrentInvestment);

            // Ledger entry created
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.BankAccountId == bankAccount.Id && e.RelatedEntityId == result.Id);
            Assert.NotNull(ledgerEntry);
            Assert.Equal("Owner Investment", ledgerEntry.TransactionType);
            Assert.Equal(0m, ledgerEntry.Debit);
            Assert.Equal(10000m, ledgerEntry.Credit);
            Assert.Equal(641339.04m, ledgerEntry.RunningBalance);
            Assert.Equal("OwnerInvestmentTransaction", ledgerEntry.RelatedEntityType);
        }

        [Fact]
        public async Task AddOwnerTransactionAsync_CashWithdrawal_DecreasesCashbookBalance_AndOwnerInvestment()
        {
            // Arrange
            var (context, service, tenantId, companyId, _) = CreateTestSetup();

            var owner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Withdrawing Owner",
                OwnershipPercentage = 30m,
                InitialInvestment = 60000m,
                CurrentInvestment = 60000m,
                CreatedAt = DateTime.UtcNow
            };
            context.Owners.Add(owner);

            var cashBook = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Main Cashbook",
                OpeningBalance = 60000m,
                CurrentBalance = 60000m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            context.CashBooks.Add(cashBook);
            await context.SaveChangesAsync();

            // Act: Withdrawal of ₹5,000 from Main Cashbook
            var request = new CreateOwnerInvestmentTransactionRequest
            {
                TransactionDate = DateTime.UtcNow,
                Amount = 5000m,
                TransactionType = "Withdrawal",
                PaymentMethod = "CashBook",
                CashBookId = cashBook.Id,
                Notes = "Personal withdrawal"
            };

            var result = await service.AddOwnerTransactionAsync(owner.Id, request);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(5000m, result.Amount);
            Assert.Equal("Withdrawal", result.TransactionType);

            // Cashbook decreased: 60,000 - 5,000 = 55,000
            var updatedCashBook = await context.CashBooks.FindAsync(cashBook.Id);
            Assert.NotNull(updatedCashBook);
            Assert.Equal(55000m, updatedCashBook.CurrentBalance);

            // Owner investment decreased: 60,000 - 5,000 = 55,000
            var updatedOwner = await context.Owners.FindAsync(owner.Id);
            Assert.NotNull(updatedOwner);
            Assert.Equal(55000m, updatedOwner.CurrentInvestment);

            // Ledger entry has Debit = 5,000, Credit = 0
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.CashBookId == cashBook.Id && e.RelatedEntityId == result.Id);
            Assert.NotNull(ledgerEntry);
            Assert.Equal("Owner Withdrawal", ledgerEntry.TransactionType);
            Assert.Equal(5000m, ledgerEntry.Debit);
            Assert.Equal(0m, ledgerEntry.Credit);
            Assert.Equal(55000m, ledgerEntry.RunningBalance);
        }

        [Fact]
        public async Task AddOwnerTransactionAsync_CrossTenantAccount_ThrowsKeyNotFoundException()
        {
            var (_, service, _, companyId, _) = CreateTestSetup();
            var (otherContext, _, otherTenantId, _, _) = CreateTestSetup();

            // Account belonging to another tenant
            var foreignBank = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = otherTenantId,
                CompanyId = companyId,
                BankName = "Foreign Bank",
                AccountName = "Foreign Account",
                AccountNumber = "FOR-123",
                OpeningBalance = 10000m,
                CurrentBalance = 10000m
            };
            otherContext.BankAccounts.Add(foreignBank);
            await otherContext.SaveChangesAsync();

            // Request targeting foreign bank
            var request = new CreateOwnerInvestmentTransactionRequest
            {
                TransactionDate = DateTime.UtcNow,
                Amount = 10000m,
                TransactionType = "Investment",
                PaymentMethod = "BankAccount",
                BankAccountId = foreignBank.Id
            };

            await Assert.ThrowsAsync<KeyNotFoundException>(() => service.AddOwnerTransactionAsync(Guid.NewGuid(), request));
        }
    }
}
