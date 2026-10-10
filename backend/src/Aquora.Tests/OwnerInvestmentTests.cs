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
    }
}
