using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.Application.DTOs.Payroll;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Domain.Entities.Payroll;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class PayrollBalanceSystemTests
    {
        private readonly TenantDbContext _context;
        private readonly Mock<ILedgerService> _mockLedgerService;
        private readonly Mock<ICurrentUserContext> _mockUserContext;
        private readonly Mock<ITenantProvider> _mockTenantProvider;
        private readonly Guid _tenantId = Guid.NewGuid();
        private readonly Guid _companyId = Guid.NewGuid();
        private readonly Guid _employeeId = Guid.NewGuid();
        private readonly Guid _bankAccountId = Guid.NewGuid();

        public PayrollBalanceSystemTests()
        {
            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            _mockTenantProvider = new Mock<ITenantProvider>();
            _mockTenantProvider.Setup(t => t.TenantId).Returns(_tenantId);
            _mockTenantProvider.Setup(t => t.TenantSchemaName).Returns("public");

            _mockUserContext = new Mock<ICurrentUserContext>();
            _mockUserContext.Setup(u => u.UserId).Returns("TestUser");

            _mockLedgerService = new Mock<ILedgerService>();

            _context = new TenantDbContext(options, _mockTenantProvider.Object, _mockUserContext.Object);

            SeedDatabase();
        }

        private void SeedDatabase()
        {
            var company = new Company
            {
                Id = _companyId,
                TenantId = _tenantId,
                Name = "Test Bottling Plant",
                Code = "TBP"
            };
            _context.Companies.Add(company);

            var employee = new User
            {
                Id = _employeeId,
                TenantId = _tenantId,
                Username = "shibal",
                Email = "shibal@example.com",
                FirstName = "Shibal",
                LastName = "User",
                PasswordHash = "hashed_dummy_password",
                CurrentSalary = 20000m,
                Department = "Operations",
                IsActive = true
            };
            _context.Users.Add(employee);

            var bank = new BankAccount
            {
                Id = _bankAccountId,
                TenantId = _tenantId,
                CompanyId = _companyId,
                BankName = "HDFC Bank",
                AccountName = "Corporate Account",
                AccountNumber = "501000123456",
                AccountType = "Current",
                CurrentBalance = 100000m,
                IsActive = true
            };
            _context.BankAccounts.Add(bank);

            _context.SaveChanges();
        }

        private PayrollService CreateService()
        {
            return new PayrollService(_context, _mockLedgerService.Object, _mockUserContext.Object, _mockTenantProvider.Object);
        }

        [Fact]
        public async Task Test1_CreateMonthlySalaryEntitlement_InitialStateUnpaid()
        {
            var service = CreateService();
            var req = new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30,
                Bonus = 0,
                AdvanceDeduction = 0,
                OtherDeduction = 0
            };

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(req);

            Assert.NotNull(entitlement);
            Assert.Equal(20000m, entitlement.NetSalaryEntitlement);
            Assert.Equal(0m, entitlement.TotalPaid);
            Assert.Equal(20000m, entitlement.RemainingBalance);
            Assert.Equal("Unpaid", entitlement.Status);
        }

        [Fact]
        public async Task Test2_ProcessSalaryAdvance_UpdatesToPartiallyPaid()
        {
            var service = CreateService();
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            var payReq = new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 10000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            };

            var txn = await service.ProcessSalaryPaymentAsync(payReq);
            Assert.NotNull(txn);
            Assert.Equal(10000m, txn.Amount);

            var updated = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(updated);
            Assert.Equal(10000m, updated.TotalPaid);
            Assert.Equal(10000m, updated.RemainingBalance);
            Assert.Equal("Partially Paid", updated.Status);
        }

        [Fact]
        public async Task Test3_ProcessRemainingSettlement_UpdatesToFullyPaid()
        {
            var service = CreateService();
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            // 1. Advance 10,000
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 10000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            // 2. Settlement 10,000
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Settlement",
                Amount = 10000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            var updated = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(updated);
            Assert.Equal(20000m, updated.TotalPaid);
            Assert.Equal(0m, updated.RemainingBalance);
            Assert.Equal("Paid", updated.Status);
        }

        [Fact]
        public async Task Test4_OverpaymentAttempt_ThrowsArgumentException()
        {
            var service = CreateService();
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            // Pay 15,000
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 15000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            // Attempt to pay 6,000 against 5,000 balance -> MUST throw ArgumentException
            var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Settlement",
                Amount = 6000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            }));

            Assert.Contains("Maximum", ex.Message);
        }

        [Fact]
        public async Task Test5_MultiplePartialPayments_CalculatesCumulativeBalance()
        {
            var service = CreateService();
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 5000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 3000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 2000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            var updated = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(updated);
            Assert.Equal(10000m, updated.TotalPaid);
            Assert.Equal(10000m, updated.RemainingBalance);
            Assert.Equal(3, updated.Payments.Count);
        }

        [Fact]
        public async Task Test6_DuplicateMonthlySalaryGeneration_ReturnsExistingEntitlement()
        {
            var service = CreateService();
            var req = new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            };

            var first = await service.GetOrCreateMonthlySalaryAsync(req);
            var second = await service.GetOrCreateMonthlySalaryAsync(req);

            Assert.Equal(first.Id, second.Id);
            var count = await _context.MonthlySalaries.CountAsync(m => m.EmployeeId == _employeeId && m.SalaryMonth == "2026-08");
            Assert.Equal(1, count);
        }

        [Fact]
        public async Task Test7_ReverseTransaction_RestoresRemainingBalance()
        {
            var service = CreateService();
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            var txn = await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 10000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            var midState = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.Equal(10000m, midState!.RemainingBalance);

            // Reverse transaction
            var success = await service.ReverseSalaryPaymentTransactionAsync(txn.Id);
            Assert.True(success);

            var finalState = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.Equal(0m, finalState!.TotalPaid);
            Assert.Equal(20000m, finalState.RemainingBalance);
            Assert.Equal("Unpaid", finalState.Status);
        }

        [Fact]
        public async Task Test8_ManualEntitlementOverride_PersistsAndAllowsPartialPayments()
        {
            var service = CreateService();

            // 10 days worked out of 30 for Base Salary 20,000 -> Calculated is ~6,666.67
            // Admin manually overrides final entitlement to 9,000.00
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 10,
                Bonus = 0m,
                AdvanceDeduction = 0m,
                OtherDeduction = 0m,
                FinalEntitlementOverride = 9000m
            });

            Assert.Equal(9000m, entitlement.NetSalaryEntitlement);
            Assert.Equal(9000m, entitlement.RemainingBalance);
            Assert.Equal("Unpaid", entitlement.Status);

            // Pay 2,000 partial payment
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 2000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            var updated = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(updated);
            Assert.Equal(9000m, updated.NetSalaryEntitlement);
            Assert.Equal(2000m, updated.TotalPaid);
            Assert.Equal(7000m, updated.RemainingBalance);
            Assert.Equal("Partially Paid", updated.Status);
        }

        [Fact]
        public async Task Test9_SaveEntitlementDoesNotCreatePayment()
        {
            var service = CreateService();

            // Create entitlement using legacy adapter method without explicit payment amount
            var result = await service.CreateSalaryPaymentAsync(new CreateSalaryPaymentRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-09",
                WorkingDays = 30,
                DaysWorked = 10
            });

            Assert.Equal(20000m, result.BaseSalary);
            Assert.Equal(6666.67m, Math.Round(result.CalculatedEntitlement, 2));
            Assert.Equal(0m, result.TotalPaid);
            Assert.Equal(6666.67m, Math.Round(result.RemainingBalance, 2));
            Assert.Equal("Unpaid", result.Status);
        }

        [Fact]
        public async Task Test10_SeparationOfMonthlySalaryAndEarnedEntitlement()
        {
            var service = CreateService();

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-10",
                WorkingDays = 30,
                DaysWorked = 15
            });

            // Employee Shibal base salary = 20,000. Earned entitlement (20,000 * 15 / 30 = 10,000.00)
            Assert.Equal(20000m, entitlement.BaseSalary);
            Assert.Equal(10000m, entitlement.CalculatedEntitlement);
            Assert.Equal(10000m, entitlement.NetSalaryEntitlement);
            Assert.Equal(0m, entitlement.TotalPaid);
            Assert.Equal(10000m, entitlement.RemainingBalance);

            var fetched = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(fetched);
            Assert.Equal(20000m, fetched.BaseSalary);
            Assert.Equal(10000m, fetched.NetSalaryEntitlement);
            Assert.Equal(10000m, fetched.CalculatedEntitlement);
        }

        [Fact]
        public async Task Test11_DashboardMetricsUseActualPaymentsOnly()
        {
            var service = CreateService();

            // Entitlement created with 0 payments
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-11",
                WorkingDays = 30,
                DaysWorked = 30
            });

            var initialMetrics = await service.GetPayrollDashboardMetricsAsync("2026-11");
            Assert.Equal(0m, initialMetrics.DisbursedThisMonth);
            Assert.Equal(0m, initialMetrics.PaidViaBankThisMonth);
            Assert.Equal(20000m, initialMetrics.TotalPendingBalanceThisMonth);

            // Now make a bank payment of 5,000
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 5000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            var afterPaymentMetrics = await service.GetPayrollDashboardMetricsAsync("2026-11");
            Assert.Equal(5000m, afterPaymentMetrics.DisbursedThisMonth);
            Assert.Equal(5000m, afterPaymentMetrics.PaidViaBankThisMonth);
            Assert.Equal(15000m, afterPaymentMetrics.TotalPendingBalanceThisMonth);
        }

        [Fact]
        public async Task Test12_AttendanceBasedSalarySettlement_SubtractsPreviousAdvances()
        {
            var service = CreateService();

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-09",
                WorkingDays = 30,
                DaysWorked = 30
            });

            // 1. Pay Advance of 5,000
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 5000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            // 2. Process Settlement for 15 days worked out of 30 (Earned = 10,000. Due = 10,000 - 5,000 = 5,000)
            var settleTxn = await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Settlement",
                Amount = 5000m,
                WorkingDays = 30,
                DaysWorked = 15,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            Assert.NotNull(settleTxn);
            Assert.Equal(5000m, settleTxn.Amount);

            var updated = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(updated);
            Assert.Equal(10000m, updated.EarnedSalary);
            Assert.Equal(5000m, updated.TotalAdvances);
            Assert.Equal(5000m, updated.TotalSettlements);
            Assert.Equal(10000m, updated.TotalPaid);
            Assert.Equal(0m, updated.RemainingBalance);
            Assert.Equal("Paid", updated.Status);
        }

        [Fact]
        public async Task Test13_ExcessAdvance_SetsOverpaidStatus()
        {
            var service = CreateService();

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-09",
                WorkingDays = 30,
                DaysWorked = 30
            });

            // Pay Advance of 8,000
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 8000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            // Process Settlement for 10 days worked out of 30 -> Earned = 6,666.67
            var state = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(state);

            // Re-fetch directory record to test calculated properties
            var list = await service.GetMonthlySalariesAsync(1, 10, new PayrollFilterDto { EmployeeId = _employeeId, Month = "2026-09" });
            var item = list.Items.First();

            // Total advances = 8,000. Base salary = 20,000.
            Assert.Equal(8000m, item.TotalAdvances);
            Assert.Equal(8000m, item.TotalPaid);
        }

        [Fact]
        public async Task Test14_ExistingUnlinkedPaymentRecords_AreLoadedInSettlementModalDetails()
        {
            var service = CreateService();

            // Seed an unlinked advance payment record directly in DB (simulating existing payments)
            var unlinkedPayment = new SalaryPayment
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                CompanyId = _companyId,
                SalaryNo = "SAL-202608-0001",
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                MonthlySalary = 250000m,
                WorkingDays = 30,
                DaysWorked = 30,
                DailySalary = 8333.33m,
                GrossSalary = 250000m,
                PaymentType = "Salary Advance",
                Amount = 150000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId,
                Status = "Paid",
                MonthlySalaryId = null,
                CreatedAt = DateTime.UtcNow
            };
            _context.SalaryPayments.Add(unlinkedPayment);
            await _context.SaveChangesAsync();

            // Fetch or create monthly salary record
            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            // Call GetMonthlySalaryByIdAsync
            var details = await service.GetMonthlySalaryByIdAsync(entitlement.Id);

            Assert.NotNull(details);
            Assert.Equal(150000m, details.TotalAdvances);
            Assert.Equal(150000m, details.TotalPaid);
        }

        [Fact]
        public async Task Test15_RealWorldScenario_250kSalary_150kAdvance_25DaysWorked_CalculatesCorrectBalance()
        {
            var employee = await _context.Users.FindAsync(_employeeId);
            employee!.CurrentSalary = 250000m;
            var bank = await _context.BankAccounts.FindAsync(_bankAccountId);
            bank!.CurrentBalance = 500000m;
            await _context.SaveChangesAsync();

            var service = CreateService();

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            // Process Advance of 1,50,000
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 150000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            // Update salary entitlement for 25 days worked
            var updated = await service.UpdateMonthlySalaryEntitlementAsync(entitlement.Id, new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 25
            });

            Assert.Equal(208333.33m, updated.EarnedSalary);
            Assert.Equal(150000m, updated.TotalPaid);
            Assert.Equal(58333.33m, updated.RemainingBalance);
        }

        [Fact]
        public async Task Test16_FinalAcceptanceTest_20kSalary_25DaysWorked_FullyPaidAndFinalized()
        {
            var service = CreateService();

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 25
            });

            Assert.Equal(16666.67m, entitlement.EarnedSalary);
            Assert.Equal(5, entitlement.UnworkedDays);
            Assert.Equal(16666.67m, entitlement.RemainingBalance);

            // Process Settlement payment of 16,666.67 with ConfirmFinalSettlement = true
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Settlement",
                Amount = 16666.67m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId,
                WorkingDays = 30,
                DaysWorked = 25,
                ConfirmFinalSettlement = true
            });

            var finalizedDetails = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(finalizedDetails);
            Assert.True(finalizedDetails.IsFinalized);
            Assert.Equal("Fully Paid", finalizedDetails.Status);
            Assert.Equal(0m, finalizedDetails.RemainingBalance);
            Assert.Equal(16666.67m, finalizedDetails.TotalPaid);
            Assert.Equal(5, finalizedDetails.UnworkedDays);

            // Verify that attempting further payment on finalized record throws InvalidOperationException
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 1000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            }));
        }

        [Fact]
        public async Task Test17_FinalSettlementWithUnpaidBalance_RequiresForceConfirmation()
        {
            var service = CreateService();

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 25
            });

            // Trying to finalize with unpaid balance without force flag throws InvalidOperationException
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Settlement",
                Amount = 10000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId,
                WorkingDays = 30,
                DaysWorked = 25,
                ConfirmFinalSettlement = true,
                ForceFinalizeWithUnpaid = false
            }));

            // Force finalize with unpaid balance succeeds
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Settlement",
                Amount = 10000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId,
                WorkingDays = 30,
                DaysWorked = 25,
                ConfirmFinalSettlement = true,
                ForceFinalizeWithUnpaid = true
            });

            var finalizedDetails = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(finalizedDetails);
            Assert.True(finalizedDetails.IsFinalized);
            Assert.Equal("Fully Paid", finalizedDetails.Status);
            Assert.Equal(0m, finalizedDetails.RemainingBalance);
        }

        [Fact]
        public async Task Test18_ShibalAcceptanceTest_20kSalary_15kPaid_CalculatesExact166667BalanceNotGlobalDashboardPending()
        {
            var service = CreateService();

            // 1. Shibal: 20k base, 25 days worked out of 30 -> Earned = 16,666.67. 15k paid -> Remaining = 1,666.67
            var shibalEntitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = _employeeId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 25
            });

            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = shibalEntitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 15000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            // 2. Faheem (Employee 2): 20k base, 30 days worked, 15k paid -> Remaining = 5,000
            var faheemId = Guid.NewGuid();
            var faheemUser = new User
            {
                Id = faheemId,
                TenantId = _tenantId,
                Email = "faheem@aquora.internal",
                FirstName = "Faheem",
                LastName = "Staff",
                PasswordHash = "dummyhash",
                CurrentSalary = 20000m,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(faheemUser);
            await _context.SaveChangesAsync();

            var faheemEntitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = faheemId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = faheemEntitlement.Id,
                PaymentType = "Salary Advance",
                Amount = 15000m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId
            });

            // 3. Owner (Employee 3): 20k base, 30 days worked, 0 paid -> Remaining = 20,000
            var ownerId = Guid.NewGuid();
            var ownerUser = new User
            {
                Id = ownerId,
                TenantId = _tenantId,
                Email = "owner@aquora.internal",
                FirstName = "Owner",
                LastName = "Boss",
                PasswordHash = "dummyhash",
                CurrentSalary = 20000m,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(ownerUser);
            await _context.SaveChangesAsync();

            var ownerEntitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = ownerId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 30
            });

            // Check Dashboard Pending Metrics = 1,666.67 + 5,000 + 20,000 = 26,666.67
            var metrics = await service.GetPayrollDashboardMetricsAsync("2026-08");
            Assert.Equal(26666.67m, metrics.TotalPendingBalanceThisMonth);

            // VERIFY SCOPING: Shibal's individual settlement summary MUST return 1,666.67, NOT 26,666.67
            var shibalDetails = await service.GetMonthlySalaryByIdAsync(shibalEntitlement.Id);
            Assert.NotNull(shibalDetails);
            Assert.Equal(16666.67m, shibalDetails.EarnedSalary);
            Assert.Equal(15000m, shibalDetails.TotalPaid);
            Assert.Equal(1666.67m, shibalDetails.RemainingBalance);
            Assert.NotEqual(metrics.TotalPendingBalanceThisMonth, shibalDetails.RemainingBalance);

            // VERIFY SCOPING: Faheem's individual settlement summary MUST return 5,000
            var faheemDetails = await service.GetMonthlySalaryByIdAsync(faheemEntitlement.Id);
            Assert.NotNull(faheemDetails);
            Assert.Equal(20000m, faheemDetails.EarnedSalary);
            Assert.Equal(15000m, faheemDetails.TotalPaid);
            Assert.Equal(5000m, faheemDetails.RemainingBalance);

            // VERIFY SCOPING: Owner's individual settlement summary MUST return 20,000
            var ownerDetails = await service.GetMonthlySalaryByIdAsync(ownerEntitlement.Id);
            Assert.NotNull(ownerDetails);
            Assert.Equal(20000m, ownerDetails.EarnedSalary);
            Assert.Equal(0m, ownerDetails.TotalPaid);
            Assert.Equal(20000m, ownerDetails.RemainingBalance);
        }

        [Fact]
        public async Task Test19_ZeroPaymentFinalizationForAlreadyFullyPaidMonth()
        {
            var service = CreateService();

            // Employee Shibal (20k base, 25 days worked => Earned = 16,666.67)
            var empId = Guid.NewGuid();
            var emp = new User
            {
                Id = empId,
                TenantId = _tenantId,
                Email = "shibal.fullypaid@aquora.internal",
                FirstName = "Shibal",
                LastName = "FullyPaid",
                PasswordHash = "dummyhash",
                CurrentSalary = 20000m,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(emp);
            await _context.SaveChangesAsync();

            var entitlement = await service.GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = empId,
                SalaryMonth = "2026-08",
                WorkingDays = 30,
                DaysWorked = 25
            });

            Assert.Equal(16666.67m, entitlement.EarnedSalary);
            Assert.Equal(16666.67m, entitlement.RemainingBalance);
            Assert.False(entitlement.IsFinalized);

            // Pay full earned amount in one or more payments
            await service.ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
            {
                MonthlySalaryId = entitlement.Id,
                PaymentType = "Salary Settlement",
                Amount = 16666.67m,
                PaymentMethod = "BankAccount",
                BankAccountId = _bankAccountId,
                ConfirmFinalSettlement = false // User forgot to check final settlement during payment!
            });

            // Re-fetch details: Financially Fully Paid (Pending = 0.00), but NOT yet finalized!
            var details = await service.GetMonthlySalaryByIdAsync(entitlement.Id);
            Assert.NotNull(details);
            Assert.Equal(16666.67m, details.EarnedSalary);
            Assert.Equal(16666.67m, details.TotalPaid);
            Assert.Equal(0m, details.RemainingBalance);
            Assert.False(details.IsFinalized); // Still open / unfinalized!

            // Finalize with ZERO additional payment via FinalizeMonthlySalaryAsync
            var finalizedDetails = await service.FinalizeMonthlySalaryAsync(new FinalizeMonthlySalaryRequest
            {
                MonthlySalaryId = entitlement.Id,
                ForceFinalizeWithUnpaid = false,
                Remarks = "Closed after verifying full payment"
            });

            // Verify final state
            Assert.NotNull(finalizedDetails);
            Assert.True(finalizedDetails.IsFinalized);
            Assert.Equal("Fully Paid", finalizedDetails.Status);
            Assert.Equal(0m, finalizedDetails.RemainingBalance);
            Assert.Equal(16666.67m, finalizedDetails.TotalPaid);
        }
    }
}
