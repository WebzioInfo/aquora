using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs.Payroll;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities.Payroll;
using Aquora.Domain.Entities.Finance;
using Aquora.Shared.Models;

namespace Aquora.Application.Services
{
    public class PayrollService : IPayrollService
    {
        private readonly ITenantDbContext _context;
        private readonly ILedgerService _ledgerService;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ITenantProvider _tenantProvider;

        public PayrollService(
            ITenantDbContext context,
            ILedgerService ledgerService,
            ICurrentUserContext currentUserContext,
            ITenantProvider tenantProvider)
        {
            _context = context;
            _ledgerService = ledgerService;
            _currentUserContext = currentUserContext;
            _tenantProvider = tenantProvider;
        }

        private Guid GetTenantId()
        {
            return _tenantProvider.TenantId;
        }

        private async Task<Guid> GetCompanyIdAsync()
        {
            var tenantId = GetTenantId();
            var company = await _context.Companies
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && !c.IsDeleted);
            if (company == null)
            {
                throw new InvalidOperationException("No company context found for this tenant.");
            }
            return company.Id;
        }

        public async Task<PagedResult<SalaryPaymentDto>> GetSalaryPaymentsAsync(int pageNumber, int pageSize, PayrollFilterDto filter)
        {
            var tenantId = GetTenantId();
            var query = _context.SalaryPayments
                .Include(s => s.Employee)
                .Where(s => s.TenantId == tenantId && !s.IsDeleted)
                .AsQueryable();

            if (filter.EmployeeId.HasValue)
            {
                query = query.Where(s => s.EmployeeId == filter.EmployeeId.Value);
            }

            if (!string.IsNullOrWhiteSpace(filter.Month))
            {
                query = query.Where(s => s.SalaryMonth == filter.Month.Trim());
            }

            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                var term = filter.Search.Trim().ToLowerInvariant();
                query = query.Where(s => 
                    s.SalaryNo.ToLower().Contains(term) ||
                    (s.Employee.FirstName != null && s.Employee.FirstName.ToLower().Contains(term)) ||
                    (s.Employee.LastName != null && s.Employee.LastName.ToLower().Contains(term)));
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(s => s.PaymentDate)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var dtos = new List<SalaryPaymentDto>();
            foreach (var item in items)
            {
                string paidFrom = string.Empty;
                if (item.PaymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase) && item.BankAccountId.HasValue)
                {
                    var bank = await _context.BankAccounts.FindAsync(item.BankAccountId.Value);
                    paidFrom = bank != null ? $"{bank.BankName} ({bank.AccountName})" : "Bank Account";
                }
                else if (item.PaymentMethod.Equals("CashBook", StringComparison.OrdinalIgnoreCase) && item.CashBookId.HasValue)
                {
                    var cash = await _context.CashBooks.FindAsync(item.CashBookId.Value);
                    paidFrom = cash != null ? cash.Name : "Cash Book";
                }

                dtos.Add(new SalaryPaymentDto
                {
                    Id = item.Id,
                    SalaryNo = item.SalaryNo,
                    EmployeeId = item.EmployeeId,
                    EmployeeName = $"{item.Employee.FirstName} {item.Employee.LastName}".Trim(),
                    Department = item.Employee.Department ?? "Operations",
                    Designation = item.Employee.Designation ?? string.Empty,
                    SalaryMonth = item.SalaryMonth,
                    MonthlySalary = item.MonthlySalary,
                    WorkingDays = item.WorkingDays,
                    DaysWorked = item.DaysWorked,
                    NetSalary = item.NetSalary,
                    PaymentMethod = item.PaymentMethod,
                    PaidFrom = paidFrom,
                    PaymentDate = item.PaymentDate,
                    Status = item.Status
                });
            }

            return new PagedResult<SalaryPaymentDto>(dtos, totalCount, pageNumber, pageSize);
        }

        public async Task<SalaryPaymentDetailsDto?> GetSalaryPaymentByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var item = await _context.SalaryPayments
                .Include(s => s.Employee)
                .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);

            if (item == null) return null;

            string paidFrom = string.Empty;
            if (item.PaymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase) && item.BankAccountId.HasValue)
            {
                var bank = await _context.BankAccounts.FindAsync(item.BankAccountId.Value);
                paidFrom = bank != null ? $"{bank.BankName} ({bank.AccountName})" : "Bank Account";
            }
            else if (item.PaymentMethod.Equals("CashBook", StringComparison.OrdinalIgnoreCase) && item.CashBookId.HasValue)
            {
                var cash = await _context.CashBooks.FindAsync(item.CashBookId.Value);
                paidFrom = cash != null ? cash.Name : "Cash Book";
            }

            return new SalaryPaymentDetailsDto
            {
                Id = item.Id,
                SalaryNo = item.SalaryNo,
                EmployeeId = item.EmployeeId,
                EmployeeName = $"{item.Employee.FirstName} {item.Employee.LastName}".Trim(),
                Department = item.Employee.Department ?? "Operations",
                Designation = item.Employee.Designation ?? string.Empty,
                SalaryMonth = item.SalaryMonth,
                MonthlySalary = item.MonthlySalary,
                WorkingDays = item.WorkingDays,
                DaysWorked = item.DaysWorked,
                DailySalary = item.DailySalary,
                GrossSalary = item.GrossSalary,
                Bonus = item.Bonus,
                AdvanceDeduction = item.AdvanceDeduction,
                OtherDeduction = item.OtherDeduction,
                NetSalary = item.NetSalary,
                PaymentMethod = item.PaymentMethod,
                BankAccountId = item.BankAccountId,
                CashBookId = item.CashBookId,
                PaidFrom = paidFrom,
                PaymentDate = item.PaymentDate,
                Remarks = item.Remarks,
                Status = item.Status
            };
        }

        public async Task<SalaryPaymentDto> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";

            // Validate Employee
            var employee = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.EmployeeId && u.TenantId == tenantId && !u.IsDeleted);
            if (employee == null)
            {
                throw new ArgumentException("Selected employee not found.");
            }

            if (!employee.CurrentSalary.HasValue || employee.CurrentSalary.Value <= 0)
            {
                throw new ArgumentException("Current Salary must be set in employee profile and greater than zero.");
            }

            // Calculations
            if (request.WorkingDays <= 0)
            {
                throw new ArgumentException("Working Days must be greater than zero.");
            }
            if (request.DaysWorked < 0)
            {
                throw new ArgumentException("Days Worked cannot be negative.");
            }
            if (request.DaysWorked > request.WorkingDays)
            {
                throw new ArgumentException("Days Worked cannot exceed Working Days.");
            }

            var dailySalary = Math.Round(employee.CurrentSalary.Value / request.WorkingDays, 2);
            var grossSalary = Math.Round(dailySalary * request.DaysWorked, 2);
            var netSalary = Math.Round(grossSalary + request.Bonus - request.AdvanceDeduction - request.OtherDeduction, 2);

            if (netSalary < 0)
            {
                throw new ArgumentException("Net Salary cannot become negative.");
            }

            // Verify account and balance limit
            BankAccount? bank = null;
            CashBook? cash = null;

            if (request.PaymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.BankAccountId.HasValue)
                {
                    throw new ArgumentException("Bank Account is required.");
                }
                bank = await _context.BankAccounts
                    .FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);
                if (bank == null)
                {
                    throw new ArgumentException("Selected Bank Account not found.");
                }
                if (!bank.AccountType.Equals("OD", StringComparison.OrdinalIgnoreCase) && (bank.CurrentBalance - netSalary) < 0)
                {
                    throw new ArgumentException($"Insufficient balance in the selected Bank Account. Current balance: INR {bank.CurrentBalance:N2}");
                }
            }
            else if (request.PaymentMethod.Equals("CashBook", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.CashBookId.HasValue)
                {
                    throw new ArgumentException("Cash Book is required.");
                }
                cash = await _context.CashBooks
                    .FirstOrDefaultAsync(c => c.Id == request.CashBookId.Value && c.TenantId == tenantId && !c.IsDeleted);
                if (cash == null)
                {
                    throw new ArgumentException("Selected Cash Book not found.");
                }
                if ((cash.CurrentBalance - netSalary) < 0)
                {
                    throw new ArgumentException($"Insufficient balance in the selected Cash Book. Current balance: INR {cash.CurrentBalance:N2}");
                }
            }
            else
            {
                throw new ArgumentException("Invalid Payment Method.");
            }

            // Generate Salary Number
            var count = await _context.SalaryPayments
                .CountAsync(x => x.SalaryMonth == request.SalaryMonth && x.TenantId == tenantId) + 1;
            var salaryNo = $"SAL-{request.SalaryMonth.Replace("-", "")}-{count:D4}";

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    var payment = new SalaryPayment
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        SalaryNo = salaryNo,
                        EmployeeId = request.EmployeeId,
                        SalaryMonth = request.SalaryMonth,
                        MonthlySalary = employee.CurrentSalary.Value,
                        WorkingDays = request.WorkingDays,
                        DaysWorked = request.DaysWorked,
                        DailySalary = dailySalary,
                        GrossSalary = grossSalary,
                        Bonus = request.Bonus,
                        AdvanceDeduction = request.AdvanceDeduction,
                        OtherDeduction = request.OtherDeduction,
                        NetSalary = netSalary,
                        PaymentMethod = request.PaymentMethod,
                        BankAccountId = request.BankAccountId,
                        CashBookId = request.CashBookId,
                        PaymentDate = DateTime.UtcNow,
                        Remarks = request.Remarks?.Trim(),
                        Status = "Paid",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userId
                    };

                    _context.SalaryPayments.Add(payment);
                    await _context.SaveChangesAsync();

                    // Create ledger entry
                    var description = $"Salary paid to {employee.FirstName} {employee.LastName}".Trim();
                    if (payment.PaymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
                    {
                        await _ledgerService.RecordTransactionAsync(
                            bankAccountId: payment.BankAccountId!.Value,
                            transactionDate: payment.PaymentDate,
                            referenceNumber: payment.SalaryNo,
                            transactionType: "Salary Payment",
                            description: description,
                            debit: payment.NetSalary,
                            credit: 0m,
                            relatedEntityId: payment.Id,
                            relatedEntityType: "SalaryPayment"
                        );
                    }
                    else
                    {
                        await _ledgerService.RecordCashTransactionAsync(
                            cashBookId: payment.CashBookId!.Value,
                            transactionDate: payment.PaymentDate,
                            referenceNumber: payment.SalaryNo,
                            transactionType: "Salary Payment",
                            description: description,
                            debit: payment.NetSalary,
                            credit: 0m,
                            relatedEntityId: payment.Id,
                            relatedEntityType: "SalaryPayment"
                        );
                    }

                    await dbTxn.CommitAsync();

                    var paidFrom = bank != null ? $"{bank.BankName} ({bank.AccountName})" : (cash != null ? cash.Name : string.Empty);
                    return new SalaryPaymentDto
                    {
                        Id = payment.Id,
                        SalaryNo = payment.SalaryNo,
                        EmployeeId = payment.EmployeeId,
                        EmployeeName = $"{employee.FirstName} {employee.LastName}".Trim(),
                        Department = employee.Department ?? "Operations",
                        Designation = employee.Designation ?? string.Empty,
                        SalaryMonth = payment.SalaryMonth,
                        MonthlySalary = payment.MonthlySalary,
                        WorkingDays = payment.WorkingDays,
                        DaysWorked = payment.DaysWorked,
                        NetSalary = payment.NetSalary,
                        PaymentMethod = payment.PaymentMethod,
                        PaidFrom = paidFrom,
                        PaymentDate = payment.PaymentDate,
                        Status = payment.Status
                    };
                }
                catch
                {
                    await dbTxn.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task<SalaryPaymentDto> UpdateSalaryPaymentAsync(Guid id, UpdateSalaryPaymentRequest request)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var payment = await _context.SalaryPayments
                .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);
            if (payment == null)
            {
                throw new KeyNotFoundException("Salary Payment not found.");
            }

            var employee = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.EmployeeId && u.TenantId == tenantId && !u.IsDeleted);
            if (employee == null)
            {
                throw new ArgumentException("Selected employee not found.");
            }

            if (!employee.CurrentSalary.HasValue || employee.CurrentSalary.Value <= 0)
            {
                throw new ArgumentException("Current Salary must be set in employee profile and greater than zero.");
            }

            // Capture old state for audit tracking
            var oldWorkingDays = payment.WorkingDays;
            var oldDaysWorked = payment.DaysWorked;
            var oldBonus = payment.Bonus;
            var oldAdvanceDeduction = payment.AdvanceDeduction;
            var oldOtherDeduction = payment.OtherDeduction;
            var oldNetSalary = payment.NetSalary;
            var oldRemarks = payment.Remarks ?? string.Empty;
            var oldPaymentMethod = payment.PaymentMethod;

            // Calculations
            if (request.WorkingDays <= 0)
            {
                throw new ArgumentException("Working Days must be greater than zero.");
            }
            if (request.DaysWorked < 0)
            {
                throw new ArgumentException("Days Worked cannot be negative.");
            }
            if (request.DaysWorked > request.WorkingDays)
            {
                throw new ArgumentException("Days Worked cannot exceed Working Days.");
            }

            var dailySalary = Math.Round(employee.CurrentSalary.Value / request.WorkingDays, 2);
            var grossSalary = Math.Round(dailySalary * request.DaysWorked, 2);
            var netSalary = Math.Round(grossSalary + request.Bonus - request.AdvanceDeduction - request.OtherDeduction, 2);

            if (netSalary < 0)
            {
                throw new ArgumentException("Net Salary cannot become negative.");
            }

            // Build detailed audit remarks comparing old and new values
            var changes = new List<string>();

            if (oldWorkingDays != request.WorkingDays)
                changes.Add($"Working Days: {oldWorkingDays} → {request.WorkingDays}");

            if (oldDaysWorked != request.DaysWorked)
                changes.Add($"Days Worked: {oldDaysWorked} → {request.DaysWorked}");

            if (oldBonus != request.Bonus)
                changes.Add($"Bonus: ₹{oldBonus:N2} → ₹{request.Bonus:N2}");

            if (oldAdvanceDeduction != request.AdvanceDeduction)
                changes.Add($"Advance: ₹{oldAdvanceDeduction:N2} → ₹{request.AdvanceDeduction:N2}");

            if (oldOtherDeduction != request.OtherDeduction)
                changes.Add($"Other Deduction: ₹{oldOtherDeduction:N2} → ₹{request.OtherDeduction:N2}");

            if (oldNetSalary != netSalary)
                changes.Add($"Net Salary: ₹{oldNetSalary:N2} → ₹{netSalary:N2}");

            if (oldRemarks != (request.Remarks?.Trim() ?? string.Empty))
                changes.Add("Remarks updated");

            if (oldPaymentMethod != request.PaymentMethod)
                changes.Add($"Payment Method: {oldPaymentMethod} → {request.PaymentMethod}");

            var auditRemarks = changes.Count > 0 ? string.Join(", ", changes) : "Salary Payment updated.";

            // Re-fetch account to verify balance limit
            BankAccount? bank = null;
            CashBook? cash = null;

            if (request.PaymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.BankAccountId.HasValue)
                {
                    throw new ArgumentException("Bank Account is required.");
                }
                bank = await _context.BankAccounts
                    .FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);
                if (bank == null)
                {
                    throw new ArgumentException("Selected Bank Account not found.");
                }
            }
            else if (request.PaymentMethod.Equals("CashBook", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.CashBookId.HasValue)
                {
                    throw new ArgumentException("Cash Book is required.");
                }
                cash = await _context.CashBooks
                    .FirstOrDefaultAsync(c => c.Id == request.CashBookId.Value && c.TenantId == tenantId && !c.IsDeleted);
                if (cash == null)
                {
                    throw new ArgumentException("Selected Cash Book not found.");
                }
            }
            else
            {
                throw new ArgumentException("Invalid Payment Method.");
            }

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    payment.EmployeeId = request.EmployeeId;
                    payment.SalaryMonth = request.SalaryMonth;
                    payment.MonthlySalary = employee.CurrentSalary.Value;
                    payment.WorkingDays = request.WorkingDays;
                    payment.DaysWorked = request.DaysWorked;
                    payment.DailySalary = dailySalary;
                    payment.GrossSalary = grossSalary;
                    payment.Bonus = request.Bonus;
                    payment.AdvanceDeduction = request.AdvanceDeduction;
                    payment.OtherDeduction = request.OtherDeduction;
                    payment.NetSalary = netSalary;
                    payment.PaymentMethod = request.PaymentMethod;
                    payment.BankAccountId = request.BankAccountId;
                    payment.CashBookId = request.CashBookId;
                    payment.Remarks = request.Remarks?.Trim();
                    payment.UpdatedAt = DateTime.UtcNow;
                    payment.UpdatedBy = userId;

                    await _context.SaveChangesAsync();

                    // Sync ledger entry and insert NEW audit history entry
                    var description = $"Salary paid to {employee.FirstName} {employee.LastName}".Trim();
                    await _ledgerService.SyncSalaryPaymentLedgerAsync(
                        salaryPaymentId: payment.Id,
                        bankAccountId: payment.BankAccountId,
                        cashBookId: payment.CashBookId,
                        paymentMethod: payment.PaymentMethod,
                        paymentDate: payment.PaymentDate,
                        salaryNo: payment.SalaryNo,
                        description: description,
                        oldNetSalary: oldNetSalary,
                        newNetSalary: payment.NetSalary,
                        auditRemarks: auditRemarks
                    );

                    await dbTxn.CommitAsync();

                    var paidFrom = bank != null ? $"{bank.BankName} ({bank.AccountName})" : (cash != null ? cash.Name : string.Empty);
                    return new SalaryPaymentDto
                    {
                        Id = payment.Id,
                        SalaryNo = payment.SalaryNo,
                        EmployeeId = payment.EmployeeId,
                        EmployeeName = $"{employee.FirstName} {employee.LastName}".Trim(),
                        Department = employee.Department ?? "Operations",
                        Designation = employee.Designation ?? string.Empty,
                        SalaryMonth = payment.SalaryMonth,
                        MonthlySalary = payment.MonthlySalary,
                        WorkingDays = payment.WorkingDays,
                        DaysWorked = payment.DaysWorked,
                        NetSalary = payment.NetSalary,
                        PaymentMethod = payment.PaymentMethod,
                        PaidFrom = paidFrom,
                        PaymentDate = payment.PaymentDate,
                        Status = payment.Status
                    };
                }
                catch
                {
                    await dbTxn.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task<bool> DeleteSalaryPaymentAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var payment = await _context.SalaryPayments
                .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);
            if (payment == null) return false;

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    // Reverse ledger & restore balance
                    await _ledgerService.RemoveLedgerEntryForEntityAsync(payment.Id, "SalaryPayment");

                    // Soft delete salary
                    payment.IsDeleted = true;
                    payment.DeletedAt = DateTime.UtcNow;
                    payment.DeletedBy = userId;

                    await _context.SaveChangesAsync();
                    await dbTxn.CommitAsync();
                    return true;
                }
                catch
                {
                    await dbTxn.RollbackAsync();
                    throw;
                }
            });
        }

        public async Task<List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>> GetSalaryPaymentHistoryAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var ledgerEntry = await _context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.RelatedEntityId == id && e.RelatedEntityType == "SalaryPayment");

            if (ledgerEntry == null)
            {
                return new List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>();
            }

            return await _ledgerService.GetLedgerHistoryAsync(ledgerEntry.Id);
        }
    }
}
