using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Aquora.Application.DTOs.Purchase;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class PurchasePaymentTests
    {
        private (TenantDbContext Context, PurchaseService Service, Guid TenantId, Guid CompanyId, BankAccount Bank, BankAccount Bank2, CashBook Cash, Vendor Vendor) CreateTestSetup()
        {
            var tenantId = Guid.NewGuid();
            var companyId = Guid.NewGuid();

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns("public");

            var mockCurrentUserContext = new Mock<ICurrentUserContext>();
            mockCurrentUserContext.Setup(x => x.UserId).Returns("test-user-id");
            mockCurrentUserContext.Setup(x => x.Email).Returns("admin@aquora.com");

            var mockDateTimeProvider = new Mock<IDateTimeProvider>();
            mockDateTimeProvider.Setup(x => x.UtcNow).Returns(DateTime.UtcNow);

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Aquora Test Plant",
                Code = "ATP"
            };
            context.Companies.Add(company);

            var bank1 = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BankName = "Canara Bank",
                AccountName = "Operating Account",
                AccountNumber = "CAN123456",
                OpeningBalance = 1000000m,
                CurrentBalance = 1000000m,
                IsActive = true
            };
            var bank2 = new BankAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BankName = "HDFC Bank",
                AccountName = "Current Account",
                AccountNumber = "HDFC987654",
                OpeningBalance = 500000m,
                CurrentBalance = 500000m,
                IsActive = true
            };
            var cash = new CashBook
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Office Cash",
                OpeningBalance = 200000m,
                CurrentBalance = 200000m,
                IsActive = true
            };
            var vendor = new Vendor
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Supreme Polymers",
                VendorCode = "VND-SUP-01",
                OpeningBalance = 0m,
                CurrentBalance = 0m,
                IsActive = true
            };

            context.BankAccounts.AddRange(bank1, bank2);
            context.CashBooks.Add(cash);
            context.Vendors.Add(vendor);
            context.SaveChanges();

            var mockPlatformContext = new Mock<IPlatformDbContext>();
            var mockLedgerService = new Mock<ILedgerService>();
            var mockLogger = new Mock<ILogger<PurchaseService>>();

            var service = new PurchaseService(
                context,
                mockPlatformContext.Object,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object,
                mockLedgerService.Object,
                mockLogger.Object);

            return (context, service, tenantId, companyId, bank1, bank2, cash, vendor);
        }

        [Fact]
        public async Task EditPayment_IncreaseAmount_RecalculatesPurchaseAndLedger()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            // Create a purchase of 1,00,000 with initial payment of 50,000 from Canara Bank
            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 100000m,
                GrandTotal = 100000m,
                AmountPaid = 50000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Preforms", Quantity = 1000, UnitPrice = 100, TotalAmount = 100000m }
                }
            });

            Assert.Equal(50000m, purchase.AmountPaid);
            Assert.Equal(50000m, purchase.BalanceAmount);
            Assert.Equal("PartiallyPaid", purchase.PaymentStatus);
            Assert.Single(purchase.Payments);

            var initialPayment = purchase.Payments.First();

            // Update payment amount from 50,000 to 70,000
            var updated = await service.UpdatePaymentAsync(purchase.Id, initialPayment.Id, new UpdatePurchasePaymentRequest
            {
                Amount = 70000m,
                PaymentDate = DateTime.UtcNow,
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                ReferenceNo = "TXN-EDIT-001",
                Notes = "Corrected payment amount"
            });

            Assert.NotNull(updated);
            Assert.Equal(70000m, updated.AmountPaid);
            Assert.Equal(30000m, updated.BalanceAmount);
            Assert.Equal("PartiallyPaid", updated.PaymentStatus);

            var paymentInDb = updated.Payments.First(p => p.Id == initialPayment.Id);
            Assert.Equal(70000m, paymentInDb.Amount);
            Assert.Equal("TXN-EDIT-001", paymentInDb.ReferenceNo);

            // Verify BankLedgerEntry updated
            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.RelatedEntityId == initialPayment.Id && e.RelatedEntityType == "PurchasePayment");
            Assert.NotNull(ledgerEntry);
            Assert.Equal(70000m, ledgerEntry.Debit);
            Assert.Equal("UPDATED", ledgerEntry.EventType);

            // Verify Vendor CurrentBalance decreased by delta (20,000 more paid -> 30,000 outstanding)
            var vendorInDb = await context.Vendors.FindAsync(vendor.Id);
            Assert.NotNull(vendorInDb);
            Assert.Equal(30000m, vendorInDb.CurrentBalance);
        }

        [Fact]
        public async Task EditPayment_SwitchFromBankToCash_UpdatesAccountsCorrectly()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 50000m,
                GrandTotal = 50000m,
                AmountPaid = 50000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Caps", Quantity = 500, UnitPrice = 100, TotalAmount = 50000m }
                }
            });

            var payment = purchase.Payments.First();

            // Switch to Office Cash with 40,000
            var updated = await service.UpdatePaymentAsync(purchase.Id, payment.Id, new UpdatePurchasePaymentRequest
            {
                Amount = 40000m,
                PaymentDate = DateTime.UtcNow,
                PaymentMethod = "Cash",
                CashBookId = cash.Id,
                ReferenceNo = "CASH-VOUCHER-99",
                Notes = "Paid via cash instead of bank"
            });

            Assert.NotNull(updated);
            Assert.Equal(40000m, updated.AmountPaid);
            Assert.Equal(10000m, updated.BalanceAmount);
            Assert.Equal("PartiallyPaid", updated.PaymentStatus);

            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.RelatedEntityId == payment.Id);
            Assert.NotNull(ledgerEntry);
            Assert.Equal("CashBook", ledgerEntry.LedgerAccountType);
            Assert.Equal(cash.Id, ledgerEntry.CashBookId);
            Assert.Null(ledgerEntry.BankAccountId);
            Assert.Equal(40000m, ledgerEntry.Debit);
        }

        [Fact]
        public async Task DeletePayment_MultiplePayments_RemovesTargetPaymentAndUpdatesTotals()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            // Purchase of 1,00,000 with initial payment 50,000
            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 100000m,
                GrandTotal = 100000m,
                AmountPaid = 50000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Labels", Quantity = 1000, UnitPrice = 100, TotalAmount = 100000m }
                }
            });

            // Add second payment of 30,000 via Cash
            var withSecondPayment = await service.AddPaymentAsync(purchase.Id, new AddPurchasePaymentRequest
            {
                Amount = 30000m,
                PaymentDate = DateTime.UtcNow,
                PaymentMethod = "Cash",
                CashBookId = cash.Id,
                ReferenceNo = "PAY-2",
                Notes = "Second payment in cash"
            });

            Assert.NotNull(withSecondPayment);
            Assert.Equal(80000m, withSecondPayment.AmountPaid);
            Assert.Equal(20000m, withSecondPayment.BalanceAmount);
            Assert.Equal(2, withSecondPayment.Payments.Count);

            var secondPayment = withSecondPayment.Payments.First(p => p.Amount == 30000m);

            // Delete second payment
            var afterDelete = await service.DeletePaymentAsync(purchase.Id, secondPayment.Id);

            Assert.NotNull(afterDelete);
            Assert.Single(afterDelete.Payments);
            Assert.Equal(50000m, afterDelete.AmountPaid);
            Assert.Equal(50000m, afterDelete.BalanceAmount);
            Assert.Equal("PartiallyPaid", afterDelete.PaymentStatus);

            // Ledger entry for second payment must be removed
            var deletedLedgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.RelatedEntityId == secondPayment.Id && e.RelatedEntityType == "PurchasePayment");
            Assert.Null(deletedLedgerEntry);

            // Remaining payment intact
            var remainingPayment = afterDelete.Payments.First();
            Assert.Equal(50000m, remainingPayment.Amount);

            // Vendor balance reflects restored liability (50,000 outstanding)
            var vendorInDb = await context.Vendors.FindAsync(vendor.Id);
            Assert.NotNull(vendorInDb);
            Assert.Equal(50000m, vendorInDb.CurrentBalance);
        }

        [Fact]
        public async Task DeletePayment_FinalPayment_PurchaseBecomesUnpaid()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 50000m,
                GrandTotal = 50000m,
                AmountPaid = 50000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Shrink Film", Quantity = 500, UnitPrice = 100, TotalAmount = 50000m }
                }
            });

            Assert.Equal("Paid", purchase.PaymentStatus);
            var payment = purchase.Payments.First();

            var afterDelete = await service.DeletePaymentAsync(purchase.Id, payment.Id);

            Assert.NotNull(afterDelete);
            Assert.Empty(afterDelete.Payments);
            Assert.Equal(0m, afterDelete.AmountPaid);
            Assert.Equal(50000m, afterDelete.BalanceAmount);
            Assert.Equal("Unpaid", afterDelete.PaymentStatus);
            Assert.Equal("Credit", afterDelete.PaymentMethod);

            // Vendor balance increases by 50,000
            var vendorInDb = await context.Vendors.FindAsync(vendor.Id);
            Assert.NotNull(vendorInDb);
            Assert.Equal(50000m, vendorInDb.CurrentBalance);
        }

        [Fact]
        public async Task GetPaymentById_ReturnsCorrectDetails()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 50000m,
                GrandTotal = 50000m,
                AmountPaid = 25000m,
                ReferenceNumber = "REF-INIT-01",
                Notes = "Initial payment",
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Item 1", Quantity = 250, UnitPrice = 100, TotalAmount = 50000m }
                }
            });

            var paymentId = purchase.Payments.First().Id;
            var paymentDto = await service.GetPaymentByIdAsync(purchase.Id, paymentId);

            Assert.NotNull(paymentDto);
            Assert.Equal(paymentId, paymentDto.Id);
            Assert.Equal(25000m, paymentDto.Amount);
            Assert.Equal("BankAccount", paymentDto.PaymentMethod);
            Assert.Equal("Canara Bank", paymentDto.BankAccountName);
            Assert.Equal(bank1.Id, paymentDto.BankAccountId);
        }

        [Fact]
        public async Task EditPayment_SwitchBetweenTwoBankAccounts()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 40000m,
                GrandTotal = 40000m,
                AmountPaid = 40000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Item 1", Quantity = 400, UnitPrice = 100, TotalAmount = 40000m }
                }
            });

            var payment = purchase.Payments.First();

            // Edit payment to use Bank 2 (HDFC Bank)
            var updated = await service.UpdatePaymentAsync(purchase.Id, payment.Id, new UpdatePurchasePaymentRequest
            {
                Amount = 40000m,
                PaymentDate = DateTime.UtcNow,
                PaymentMethod = "BankAccount",
                BankAccountId = bank2.Id,
                ReferenceNo = "HDFC-NEFT-88",
                Notes = "Transferred from HDFC"
            });

            Assert.NotNull(updated);
            var updatedPayment = updated.Payments.First();
            Assert.Equal(bank2.Id, updatedPayment.BankAccountId);
            Assert.Equal("HDFC Bank", updatedPayment.BankAccountName);

            var ledgerEntry = await context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.RelatedEntityId == payment.Id);
            Assert.NotNull(ledgerEntry);
            Assert.Equal(bank2.Id, ledgerEntry.BankAccountId);
        }

        [Fact]
        public async Task EditPayment_DecreaseAmount_IncreasesOutstandingBalance()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 100000m,
                GrandTotal = 100000m,
                AmountPaid = 80000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Item 1", Quantity = 1000, UnitPrice = 100, TotalAmount = 100000m }
                }
            });

            var payment = purchase.Payments.First();

            // Decrease payment from 80,000 to 50,000
            var updated = await service.UpdatePaymentAsync(purchase.Id, payment.Id, new UpdatePurchasePaymentRequest
            {
                Amount = 50000m,
                PaymentDate = DateTime.UtcNow,
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                ReferenceNo = "DEC-01",
                Notes = "Amount adjusted down"
            });

            Assert.NotNull(updated);
            Assert.Equal(50000m, updated.AmountPaid);
            Assert.Equal(50000m, updated.BalanceAmount); // 100,000 - 50,000
            Assert.Equal("PartiallyPaid", updated.PaymentStatus);

            // Vendor balance increases by 30,000 (from 20,000 to 50,000)
            var vendorInDb = await context.Vendors.FindAsync(vendor.Id);
            Assert.NotNull(vendorInDb);
            Assert.Equal(50000m, vendorInDb.CurrentBalance);
        }

        [Fact]
        public async Task UpdatePayment_InvalidZeroOrNegativeAmount_ThrowsArgumentException()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 50000m,
                GrandTotal = 50000m,
                AmountPaid = 20000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Item 1", Quantity = 500, UnitPrice = 100, TotalAmount = 50000m }
                }
            });

            var payment = purchase.Payments.First();

            await Assert.ThrowsAsync<ArgumentException>(() =>
                service.UpdatePaymentAsync(purchase.Id, payment.Id, new UpdatePurchasePaymentRequest
                {
                    Amount = 0m,
                    PaymentMethod = "BankAccount",
                    BankAccountId = bank1.Id
                }));

            await Assert.ThrowsAsync<ArgumentException>(() =>
                service.UpdatePaymentAsync(purchase.Id, payment.Id, new UpdatePurchasePaymentRequest
                {
                    Amount = -500m,
                    PaymentMethod = "BankAccount",
                    BankAccountId = bank1.Id
                }));
        }

        [Fact]
        public async Task ModifyPayment_OnCancelledPurchase_ThrowsInvalidOperationException()
        {
            var (context, service, tenantId, companyId, bank1, bank2, cash, vendor) = CreateTestSetup();

            var purchase = await service.CreatePurchaseAsync(new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                PurchaseCategory = "RawMaterial",
                PaymentMethod = "BankAccount",
                BankAccountId = bank1.Id,
                SubTotal = 50000m,
                GrandTotal = 50000m,
                AmountPaid = 20000m,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest { ItemName = "Item 1", Quantity = 500, UnitPrice = 100, TotalAmount = 50000m }
                }
            });

            var payment = purchase.Payments.First();
            await service.CancelPurchaseAsync(purchase.Id);

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.UpdatePaymentAsync(purchase.Id, payment.Id, new UpdatePurchasePaymentRequest
                {
                    Amount = 30000m,
                    PaymentMethod = "BankAccount",
                    BankAccountId = bank1.Id
                }));

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.DeletePaymentAsync(purchase.Id, payment.Id));
        }
    }
}
