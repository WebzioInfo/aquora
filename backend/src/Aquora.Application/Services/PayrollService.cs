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

        private Guid GetTenantId() => _tenantProvider.TenantId;

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

        // ==========================================
        // 1. MONTHLY SALARY ENTITLEMENT DIRECTORY
        // ==========================================
        public async Task<PagedResult<MonthlySalaryDirectoryDto>> GetMonthlySalariesAsync(int pageNumber, int pageSize, PayrollFilterDto filter)
        {
            var tenantId = GetTenantId();
            await ReconcileLegacyPaymentsAsync(tenantId);

            var query = _context.MonthlySalaries
                .Include(m => m.Employee)
                .Include(m => m.Payments.Where(p => !p.IsDeleted))
                .Where(m => m.TenantId == tenantId && !m.IsDeleted)
                .AsQueryable();

            if (filter.EmployeeId.HasValue)
            {
                query = query.Where(m => m.EmployeeId == filter.EmployeeId.Value);
            }

            if (!string.IsNullOrWhiteSpace(filter.Month))
            {
                query = query.Where(m => m.SalaryMonth == filter.Month.Trim());
            }

            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                var term = filter.Search.Trim().ToLowerInvariant();
                query = query.Where(m =>
                    m.SalaryNo.ToLower().Contains(term) ||
                    (m.Employee.FirstName != null && m.Employee.FirstName.ToLower().Contains(term)) ||
                    (m.Employee.LastName != null && m.Employee.LastName.ToLower().Contains(term)));
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(m => m.SalaryMonth)
                .ThenByDescending(m => m.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Populate all cumulative payments per EmployeeId + SalaryMonth for absolute single-source-of-truth accuracy
            var allPaymentsForTenant = await _context.SalaryPayments
                .Where(p => p.TenantId == tenantId && !p.IsDeleted)
                .ToListAsync();

            foreach (var item in items)
            {
                var matchingPayments = allPaymentsForTenant
                    .Where(p => p.MonthlySalaryId == item.Id || (p.EmployeeId == item.EmployeeId && p.SalaryMonth == item.SalaryMonth))
                    .ToList();
                item.Payments = matchingPayments;
            }

            var dtos = items.Select(m => MapToDirectoryDto(m)).ToList();
            return new PagedResult<MonthlySalaryDirectoryDto>(dtos, totalCount, pageNumber, pageSize);
        }

        public async Task<MonthlySalaryDetailsDto?> GetMonthlySalaryByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var item = await _context.MonthlySalaries
                .Include(m => m.Employee)
                .Include(m => m.Payments.Where(p => !p.IsDeleted))
                .FirstOrDefaultAsync(m => m.Id == id && m.TenantId == tenantId && !m.IsDeleted);

            if (item == null) return null;

            // Retrieve all payment records belonging to this EmployeeId + SalaryMonth
            var allPaymentsForEmployeeMonth = await _context.SalaryPayments
                .Where(p => p.TenantId == tenantId && !p.IsDeleted && p.EmployeeId == item.EmployeeId && p.SalaryMonth == item.SalaryMonth)
                .ToListAsync();

            // Ensure any payments not linked or linked elsewhere are correctly assigned to this MonthlySalary record
            var unlinkedPayments = allPaymentsForEmployeeMonth
                .Where(p => p.MonthlySalaryId == null || p.MonthlySalaryId != item.Id)
                .ToList();

            if (unlinkedPayments.Any())
            {
                foreach (var p in unlinkedPayments)
                {
                    p.MonthlySalaryId = item.Id;
                }
                await _context.SaveChangesAsync();
            }

            item.Payments = allPaymentsForEmployeeMonth;
            return await MapToDetailsDtoAsync(item);
        }

        // ==========================================
        // 2. CREATE / INITIALIZE MONTHLY SALARY ENTITLEMENT
        // ==========================================
        public async Task<MonthlySalaryDetailsDto> GetOrCreateMonthlySalaryAsync(CreateOrGetMonthlySalaryRequest request)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";

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

            if (request.WorkingDays <= 0) throw new ArgumentException("Working Days must be greater than zero.");
            if (request.DaysWorked < 0) throw new ArgumentException("Days Worked cannot be negative.");
            if (request.DaysWorked > request.WorkingDays) throw new ArgumentException("Days Worked cannot exceed Working Days.");

            var dailySalary = Math.Round(employee.CurrentSalary.Value / request.WorkingDays, 2);
            var grossSalary = request.DaysWorked == request.WorkingDays 
                ? employee.CurrentSalary.Value 
                : Math.Round((employee.CurrentSalary.Value * request.DaysWorked) / request.WorkingDays, 2);
            var calculatedEntitlement = Math.Round(grossSalary + request.Bonus - request.AdvanceDeduction - request.OtherDeduction, 2);
            var finalEntitlement = request.FinalEntitlementOverride.HasValue && request.FinalEntitlementOverride.Value >= 0
                ? Math.Round(request.FinalEntitlementOverride.Value, 2)
                : calculatedEntitlement;

            if (finalEntitlement < 0) throw new ArgumentException("Salary entitlement cannot become negative.");

            // Check if monthly salary entitlement already exists for this tenant + company + employee + month
            var existing = await _context.MonthlySalaries
                .Include(m => m.Employee)
                .Include(m => m.Payments.Where(p => !p.IsDeleted))
                .FirstOrDefaultAsync(m => m.TenantId == tenantId &&
                                         m.CompanyId == companyId &&
                                         m.EmployeeId == request.EmployeeId &&
                                         m.SalaryMonth == request.SalaryMonth &&
                                         !m.IsDeleted);

            if (existing != null)
            {
                var totalPaid = existing.Payments.Where(p => !p.IsDeleted && p.Status == "Paid").Sum(p => p.Amount);
                if (finalEntitlement < totalPaid && !request.FinalEntitlementOverride.HasValue)
                {
                    // If not manually overriding lower, keep existing entitlement or update
                    finalEntitlement = Math.Max(finalEntitlement, totalPaid);
                }

                existing.BaseSalary = employee.CurrentSalary.Value;
                existing.WorkingDays = request.WorkingDays;
                existing.DaysWorked = request.DaysWorked;
                existing.DailySalary = dailySalary;
                existing.GrossSalary = grossSalary;
                existing.Bonus = request.Bonus;
                existing.AdvanceDeduction = request.AdvanceDeduction;
                existing.OtherDeduction = request.OtherDeduction;
                existing.CalculatedEntitlement = calculatedEntitlement;
                existing.NetSalaryEntitlement = finalEntitlement;

                existing.TotalPaid = totalPaid;
                existing.RemainingBalance = Math.Max(0m, finalEntitlement - totalPaid);
                existing.Status = RecalculateStatus(finalEntitlement, totalPaid);
                existing.Remarks = request.Remarks?.Trim() ?? existing.Remarks;
                existing.UpdatedAt = DateTime.UtcNow;
                existing.UpdatedBy = userId;

                await _context.SaveChangesAsync();
                return await MapToDetailsDtoAsync(existing);
            }

            // Generate Salary Entitlement Number
            var count = await _context.MonthlySalaries
                .CountAsync(x => x.SalaryMonth == request.SalaryMonth && x.TenantId == tenantId) + 1;
            var salaryNo = $"SAL-{request.SalaryMonth.Replace("-", "")}-{count:D4}";

            var entitlement = new MonthlySalary
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                SalaryNo = salaryNo,
                EmployeeId = request.EmployeeId,
                SalaryMonth = request.SalaryMonth,
                BaseSalary = employee.CurrentSalary.Value,
                WorkingDays = request.WorkingDays,
                DaysWorked = request.DaysWorked,
                DailySalary = dailySalary,
                GrossSalary = grossSalary,
                Bonus = request.Bonus,
                AdvanceDeduction = request.AdvanceDeduction,
                OtherDeduction = request.OtherDeduction,
                CalculatedEntitlement = calculatedEntitlement,
                NetSalaryEntitlement = finalEntitlement,
                TotalPaid = 0m,
                RemainingBalance = finalEntitlement,
                Status = "Unpaid",
                Remarks = request.Remarks?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId
            };

            _context.MonthlySalaries.Add(entitlement);
            await _context.SaveChangesAsync();

            entitlement.Employee = employee;
            return await MapToDetailsDtoAsync(entitlement);
        }

        public async Task<MonthlySalaryDetailsDto> UpdateMonthlySalaryEntitlementAsync(Guid id, CreateOrGetMonthlySalaryRequest request)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var entitlement = await _context.MonthlySalaries
                .Include(m => m.Employee)
                .Include(m => m.Payments.Where(p => !p.IsDeleted))
                .FirstOrDefaultAsync(m => m.Id == id && m.TenantId == tenantId && !m.IsDeleted);

            if (entitlement == null) throw new KeyNotFoundException("Monthly Salary entitlement record not found.");

            var employee = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.EmployeeId && u.TenantId == tenantId && !u.IsDeleted);
            if (employee == null) throw new ArgumentException("Selected employee not found.");

            var dailySalary = Math.Round(employee.CurrentSalary.Value / request.WorkingDays, 2);
            var grossSalary = request.DaysWorked == request.WorkingDays 
                ? employee.CurrentSalary.Value 
                : Math.Round((employee.CurrentSalary.Value * request.DaysWorked) / request.WorkingDays, 2);
            var calculatedEntitlement = Math.Round(grossSalary + request.Bonus - request.AdvanceDeduction - request.OtherDeduction, 2);
            var finalEntitlement = request.FinalEntitlementOverride.HasValue && request.FinalEntitlementOverride.Value >= 0
                ? Math.Round(request.FinalEntitlementOverride.Value, 2)
                : calculatedEntitlement;

            var currentTotalPaid = entitlement.Payments.Where(p => !p.IsDeleted && p.Status == "Paid").Sum(p => p.Amount);
            if (finalEntitlement < currentTotalPaid)
            {
                throw new ArgumentException($"Cannot reduce salary entitlement to ₹{finalEntitlement:N2} because total payments of ₹{currentTotalPaid:N2} have already been processed.");
            }

            entitlement.BaseSalary = employee.CurrentSalary.Value;
            entitlement.WorkingDays = request.WorkingDays;
            entitlement.DaysWorked = request.DaysWorked;
            entitlement.DailySalary = dailySalary;
            entitlement.GrossSalary = grossSalary;
            entitlement.Bonus = request.Bonus;
            entitlement.AdvanceDeduction = request.AdvanceDeduction;
            entitlement.OtherDeduction = request.OtherDeduction;
            entitlement.CalculatedEntitlement = calculatedEntitlement;
            entitlement.NetSalaryEntitlement = finalEntitlement;
            entitlement.TotalPaid = currentTotalPaid;
            entitlement.RemainingBalance = Math.Max(0m, finalEntitlement - currentTotalPaid);
            entitlement.Status = RecalculateStatus(finalEntitlement, currentTotalPaid);
            entitlement.Remarks = request.Remarks?.Trim();
            entitlement.UpdatedAt = DateTime.UtcNow;
            entitlement.UpdatedBy = userId;

            await _context.SaveChangesAsync();
            return await MapToDetailsDtoAsync(entitlement);
        }

        // ==========================================
        // 3. PROCESS SALARY PAYMENT TRANSACTION (ADVANCE OR SETTLEMENT)
        // ==========================================
        public async Task<SalaryPaymentTransactionDto> ProcessSalaryPaymentAsync(ProcessSalaryPaymentRequest request)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var userId = _currentUserContext.UserId ?? "System";

            if (request.Amount <= 0)
            {
                throw new ArgumentException("Payment amount must be greater than zero.");
            }

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    var entitlement = await _context.MonthlySalaries
                        .Include(m => m.Employee)
                        .Include(m => m.Payments.Where(p => !p.IsDeleted))
                        .FirstOrDefaultAsync(m => m.Id == request.MonthlySalaryId && m.TenantId == tenantId && !m.IsDeleted);

                    if (entitlement == null)
                    {
                        throw new KeyNotFoundException("Monthly Salary entitlement record not found.");
                    }

                    if (entitlement.IsFinalized)
                    {
                        throw new InvalidOperationException("This payroll month has already been finalized and locked. No further advances or settlements can be processed.");
                    }

                    // Idempotency: Prevent duplicate payment submissions within a 5-second window
                    var recentDuplicate = await _context.SalaryPayments
                        .FirstOrDefaultAsync(p =>
                            p.TenantId == tenantId &&
                            !p.IsDeleted &&
                            p.EmployeeId == entitlement.EmployeeId &&
                            p.SalaryMonth == entitlement.SalaryMonth &&
                            p.PaymentType == request.PaymentType &&
                            p.Amount == request.Amount &&
                            p.CreatedAt >= DateTime.UtcNow.AddSeconds(-5));

                    if (recentDuplicate != null)
                    {
                        throw new InvalidOperationException("A duplicate payment request was detected and prevented. Your transaction has already been recorded.");
                    }

                    // Update attendance & entitlement parameters if provided (for Settlement flow)
                    if (request.WorkingDays.HasValue && request.WorkingDays.Value > 0)
                    {
                        entitlement.WorkingDays = request.WorkingDays.Value;
                    }
                    if (request.DaysWorked.HasValue && request.DaysWorked.Value >= 0)
                    {
                        entitlement.DaysWorked = request.DaysWorked.Value;
                    }

                    // Attendance validation
                    if (entitlement.DaysWorked > entitlement.WorkingDays)
                    {
                        throw new ArgumentException($"Days worked ({entitlement.DaysWorked}) cannot be greater than working days in the month ({entitlement.WorkingDays}).");
                    }
                    if (request.Bonus.HasValue) entitlement.Bonus = request.Bonus.Value;
                    if (request.AdvanceDeduction.HasValue) entitlement.AdvanceDeduction = request.AdvanceDeduction.Value;
                    if (request.OtherDeduction.HasValue) entitlement.OtherDeduction = request.OtherDeduction.Value;

                    var wDays = entitlement.WorkingDays > 0 ? entitlement.WorkingDays : 30;
                    var dWorked = entitlement.DaysWorked >= 0 ? entitlement.DaysWorked : wDays;
                    var dailySalary = wDays > 0 ? Math.Round(entitlement.BaseSalary / wDays, 2) : 0m;
                    var grossSalary = dWorked == wDays ? entitlement.BaseSalary : Math.Round((entitlement.BaseSalary * (decimal)dWorked) / (decimal)wDays, 2);
                    var calcEntitlement = Math.Round(grossSalary + entitlement.Bonus - entitlement.AdvanceDeduction - entitlement.OtherDeduction, 2);

                    entitlement.DailySalary = dailySalary;
                    entitlement.GrossSalary = grossSalary;
                    entitlement.CalculatedEntitlement = calcEntitlement;
                    
                    // For Settlement, NetSalaryEntitlement becomes the attendance-earned salary
                    if (request.PaymentType.Equals("Salary Settlement", StringComparison.OrdinalIgnoreCase))
                    {
                        entitlement.NetSalaryEntitlement = calcEntitlement;
                    }

                    // Calculate existing totals across ALL payments for this EmployeeId + SalaryMonth
                    var validPayments = await _context.SalaryPayments
                        .Where(p => p.TenantId == tenantId && !p.IsDeleted && (p.MonthlySalaryId == entitlement.Id || (p.EmployeeId == entitlement.EmployeeId && p.SalaryMonth == entitlement.SalaryMonth)) && (p.Status == null || p.Status == "Paid"))
                        .ToListAsync();

                    var currentTotalPaid = Math.Round(validPayments.Sum(p => p.Amount), 2, MidpointRounding.AwayFromZero);
                    var currentTotalAdvances = Math.Round(validPayments
                        .Where(p => p.PaymentType != null && p.PaymentType.Contains("Advance", StringComparison.OrdinalIgnoreCase))
                        .Sum(p => p.Amount), 2, MidpointRounding.AwayFromZero);

                    var requestAmount = Math.Round(request.Amount, 2, MidpointRounding.AwayFromZero);

                    if (request.PaymentType.Equals("Salary Advance", StringComparison.OrdinalIgnoreCase))
                    {
                        if (currentTotalAdvances + requestAmount > entitlement.BaseSalary)
                        {
                            throw new ArgumentException($"Total advances (₹{(currentTotalAdvances + requestAmount):N2}) cannot exceed employee's monthly base salary of ₹{entitlement.BaseSalary:N2}.");
                        }
                    }
                    else // Salary Settlement
                    {
                        var remainingSettlementDue = Math.Max(0m, Math.Round(entitlement.NetSalaryEntitlement - currentTotalPaid, 2, MidpointRounding.AwayFromZero));
                        if (requestAmount > (remainingSettlementDue + 0.005m))
                        {
                            throw new ArgumentException($"Maximum settlement payment allowed is ₹{remainingSettlementDue:N2} because ₹{currentTotalPaid:N2} has already been paid for this month.");
                        }
                    }

                    // Bank / Cash Account validation
                    BankAccount? bank = null;
                    CashBook? cash = null;

                    if (request.PaymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!request.BankAccountId.HasValue) throw new ArgumentException("Bank Account is required.");
                        bank = await _context.BankAccounts
                            .FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value && b.TenantId == tenantId && !b.IsDeleted);
                        if (bank == null) throw new ArgumentException("Selected Bank Account not found.");
                        if (!bank.AccountType.Equals("OD", StringComparison.OrdinalIgnoreCase) && (bank.CurrentBalance - requestAmount) < 0)
                        {
                            throw new ArgumentException($"Insufficient balance in the selected Bank Account. Current balance: INR {bank.CurrentBalance:N2}");
                        }
                    }
                    else if (request.PaymentMethod.Equals("CashBook", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!request.CashBookId.HasValue) throw new ArgumentException("Cash Book is required.");
                        cash = await _context.CashBooks
                            .FirstOrDefaultAsync(c => c.Id == request.CashBookId.Value && c.TenantId == tenantId && !c.IsDeleted);
                        if (cash == null) throw new ArgumentException("Selected Cash Book not found.");
                        if ((cash.CurrentBalance - requestAmount) < 0)
                        {
                            throw new ArgumentException($"Insufficient balance in the selected Cash Book. Current balance: INR {cash.CurrentBalance:N2}");
                        }
                    }
                    else
                    {
                        throw new ArgumentException("Invalid Payment Method.");
                    }

                    var pDate = request.PaymentDate ?? DateTime.UtcNow;

                    // Create Payment Transaction
                    var payment = new SalaryPayment
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        MonthlySalaryId = entitlement.Id,
                        SalaryNo = entitlement.SalaryNo,
                        EmployeeId = entitlement.EmployeeId,
                        SalaryMonth = entitlement.SalaryMonth,
                        MonthlySalary = entitlement.BaseSalary,
                        WorkingDays = entitlement.WorkingDays,
                        DaysWorked = entitlement.DaysWorked,
                        DailySalary = entitlement.DailySalary,
                        GrossSalary = entitlement.GrossSalary,
                        Bonus = entitlement.Bonus,
                        AdvanceDeduction = entitlement.AdvanceDeduction,
                        OtherDeduction = entitlement.OtherDeduction,
                        NetSalary = entitlement.NetSalaryEntitlement,
                        PaymentType = request.PaymentType,
                        Amount = requestAmount,
                        PaymentMethod = request.PaymentMethod,
                        BankAccountId = request.BankAccountId,
                        CashBookId = request.CashBookId,
                        PaymentDate = pDate,
                        Remarks = request.Remarks?.Trim(),
                        Status = "Paid",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userId
                    };

                    _context.SalaryPayments.Add(payment);

                    // Recalculate MonthlySalary entitlement status & totals
                    var newTotalPaid = Math.Round(currentTotalPaid + requestAmount, 2, MidpointRounding.AwayFromZero);
                    entitlement.TotalPaid = newTotalPaid;
                    var newRemaining = Math.Max(0m, Math.Round(entitlement.NetSalaryEntitlement - newTotalPaid, 2, MidpointRounding.AwayFromZero));

                    if (request.ConfirmFinalSettlement)
                    {
                        if (newRemaining > 0.005m && !request.ForceFinalizeWithUnpaid)
                        {
                            throw new InvalidOperationException($"₹{newRemaining:N2} will remain unpaid. Pay the full remaining amount before finalizing this payroll month.");
                        }

                        entitlement.IsFinalized = true;
                        entitlement.FinalizedAt = DateTime.UtcNow;
                        entitlement.FinalizedBy = userId;
                        entitlement.RemainingBalance = 0m;
                        entitlement.Status = "Fully Paid";
                    }
                    else
                    {
                        entitlement.RemainingBalance = newRemaining;
                        entitlement.Status = RecalculateStatus(entitlement.NetSalaryEntitlement, newTotalPaid, entitlement.IsFinalized);
                    }
                    entitlement.UpdatedAt = DateTime.UtcNow;
                    entitlement.UpdatedBy = userId;

                    await _context.SaveChangesAsync();

                    // Record General Ledger Entry
                    var employee = entitlement.Employee;
                    var description = $"{payment.PaymentType} paid to {employee.FirstName} {employee.LastName} ({entitlement.SalaryMonth})".Trim();

                    if (payment.PaymentMethod.Equals("BankAccount", StringComparison.OrdinalIgnoreCase))
                    {
                        await _ledgerService.RecordTransactionAsync(
                            bankAccountId: payment.BankAccountId!.Value,
                            transactionDate: payment.PaymentDate,
                            referenceNumber: payment.SalaryNo,
                            transactionType: request.PaymentType,
                            description: description,
                            debit: payment.Amount,
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
                            transactionType: request.PaymentType,
                            description: description,
                            debit: payment.Amount,
                            credit: 0m,
                            relatedEntityId: payment.Id,
                            relatedEntityType: "SalaryPayment"
                        );
                    }

                    await dbTxn.CommitAsync();

                    string paidFrom = bank != null ? $"{bank.BankName} ({bank.AccountName})" : (cash != null ? cash.Name : string.Empty);
                    return new SalaryPaymentTransactionDto
                    {
                        Id = payment.Id,
                        MonthlySalaryId = entitlement.Id,
                        SalaryNo = payment.SalaryNo,
                        PaymentType = payment.PaymentType,
                        Amount = payment.Amount,
                        PaymentMethod = payment.PaymentMethod,
                        PaidFrom = paidFrom,
                        BankAccountId = payment.BankAccountId,
                        CashBookId = payment.CashBookId,
                        PaymentDate = payment.PaymentDate,
                        Remarks = payment.Remarks,
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

        public async Task<SalaryPaymentTransactionDto> UpdateSalaryPaymentTransactionAsync(Guid transactionId, UpdateSalaryPaymentTransactionRequest request)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var payment = await _context.SalaryPayments
                .FirstOrDefaultAsync(p => p.Id == transactionId && p.TenantId == tenantId && !p.IsDeleted);

            if (payment == null) throw new KeyNotFoundException("Salary payment transaction not found.");
            if (!payment.MonthlySalaryId.HasValue) throw new InvalidOperationException("Payment transaction is not linked to a valid monthly salary entitlement.");

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    var entitlement = await _context.MonthlySalaries
                        .Include(m => m.Employee)
                        .Include(m => m.Payments.Where(p => !p.IsDeleted))
                        .FirstOrDefaultAsync(m => m.Id == payment.MonthlySalaryId.Value && m.TenantId == tenantId && !m.IsDeleted);

                    if (entitlement == null) throw new KeyNotFoundException("Monthly salary entitlement record not found.");

                    // Calculate total paid excluding current transaction
                    var otherPaidTotal = entitlement.Payments
                        .Where(p => p.Id != transactionId && !p.IsDeleted && p.Status == "Paid")
                        .Sum(p => p.Amount);

                    var allowedMax = entitlement.NetSalaryEntitlement - otherPaidTotal;

                    if (request.Amount > allowedMax)
                    {
                        throw new ArgumentException($"Edited amount exceeds maximum allowed balance.\n\n" +
                            $"Monthly Salary: ₹{entitlement.NetSalaryEntitlement:N2}\n" +
                            $"Other Payments Total: ₹{otherPaidTotal:N2}\n" +
                            $"Maximum allowed for this transaction: ₹{allowedMax:N2}");
                    }

                    var oldAmount = payment.Amount;
                    payment.Amount = request.Amount;
                    payment.PaymentMethod = request.PaymentMethod;
                    payment.BankAccountId = request.BankAccountId;
                    payment.CashBookId = request.CashBookId;
                    payment.Remarks = request.Remarks?.Trim();
                    payment.UpdatedAt = DateTime.UtcNow;
                    payment.UpdatedBy = userId;

                    // Update Entitlement Summary
                    var newTotalPaid = otherPaidTotal + request.Amount;
                    entitlement.TotalPaid = newTotalPaid;
                    entitlement.RemainingBalance = Math.Max(0m, entitlement.NetSalaryEntitlement - newTotalPaid);
                    entitlement.Status = RecalculateStatus(entitlement.NetSalaryEntitlement, newTotalPaid);
                    entitlement.UpdatedAt = DateTime.UtcNow;
                    entitlement.UpdatedBy = userId;

                    await _context.SaveChangesAsync();

                    // Sync Ledger Entry
                    var employee = entitlement.Employee;
                    var description = $"{payment.PaymentType} paid to {employee.FirstName} {employee.LastName} ({entitlement.SalaryMonth})".Trim();
                    var auditRemarks = $"Updated payment amount: ₹{oldAmount:N2} → ₹{request.Amount:N2}";

                    await _ledgerService.SyncSalaryPaymentLedgerAsync(
                        salaryPaymentId: payment.Id,
                        bankAccountId: payment.BankAccountId,
                        cashBookId: payment.CashBookId,
                        paymentMethod: payment.PaymentMethod,
                        paymentDate: payment.PaymentDate,
                        salaryNo: payment.SalaryNo,
                        description: description,
                        oldNetSalary: oldAmount,
                        newNetSalary: request.Amount,
                        auditRemarks: auditRemarks
                    );

                    await dbTxn.CommitAsync();

                    string paidFrom = string.Empty;
                    if (payment.PaymentMethod == "BankAccount" && payment.BankAccountId.HasValue)
                    {
                        var b = await _context.BankAccounts.FindAsync(payment.BankAccountId.Value);
                        paidFrom = b != null ? $"{b.BankName} ({b.AccountName})" : "Bank Account";
                    }
                    else if (payment.PaymentMethod == "CashBook" && payment.CashBookId.HasValue)
                    {
                        var c = await _context.CashBooks.FindAsync(payment.CashBookId.Value);
                        paidFrom = c != null ? c.Name : "Cash Book";
                    }

                    return new SalaryPaymentTransactionDto
                    {
                        Id = payment.Id,
                        MonthlySalaryId = entitlement.Id,
                        SalaryNo = payment.SalaryNo,
                        PaymentType = payment.PaymentType,
                        Amount = payment.Amount,
                        PaymentMethod = payment.PaymentMethod,
                        PaidFrom = paidFrom,
                        BankAccountId = payment.BankAccountId,
                        CashBookId = payment.CashBookId,
                        PaymentDate = payment.PaymentDate,
                        Remarks = payment.Remarks,
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

        public async Task<bool> ReverseSalaryPaymentTransactionAsync(Guid transactionId)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var payment = await _context.SalaryPayments
                .FirstOrDefaultAsync(p => p.Id == transactionId && p.TenantId == tenantId && !p.IsDeleted);

            if (payment == null) return false;

            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var dbTxn = await _context.Database.BeginTransactionAsync();
                try
                {
                    // Reverse general ledger entry
                    await _ledgerService.RemoveLedgerEntryForEntityAsync(payment.Id, "SalaryPayment");

                    payment.IsDeleted = true;
                    payment.DeletedAt = DateTime.UtcNow;
                    payment.DeletedBy = userId;

                    await _context.SaveChangesAsync();

                    if (payment.MonthlySalaryId.HasValue)
                    {
                        var entitlement = await _context.MonthlySalaries
                            .Include(m => m.Payments.Where(p => !p.IsDeleted))
                            .FirstOrDefaultAsync(m => m.Id == payment.MonthlySalaryId.Value && m.TenantId == tenantId && !m.IsDeleted);

                        if (entitlement != null)
                        {
                            var totalPaid = entitlement.Payments.Where(p => !p.IsDeleted && p.Status == "Paid").Sum(p => p.Amount);
                            entitlement.TotalPaid = totalPaid;
                            entitlement.RemainingBalance = Math.Max(0m, entitlement.NetSalaryEntitlement - totalPaid);
                            entitlement.Status = RecalculateStatus(entitlement.NetSalaryEntitlement, totalPaid);
                            entitlement.UpdatedAt = DateTime.UtcNow;
                            entitlement.UpdatedBy = userId;

                            await _context.SaveChangesAsync();
                        }
                    }

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

        public async Task<List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>> GetSalaryPaymentHistoryAsync(Guid transactionId)
        {
            var tenantId = GetTenantId();
            var ledgerEntry = await _context.BankLedgerEntries
                .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.RelatedEntityId == transactionId && e.RelatedEntityType == "SalaryPayment");

            if (ledgerEntry == null) return new List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>();
            return await _ledgerService.GetLedgerHistoryAsync(ledgerEntry.Id);
        }

        public async Task<PayrollDashboardMetricsDto> GetPayrollDashboardMetricsAsync(string? month)
        {
            var tenantId = GetTenantId();
            var targetMonth = !string.IsNullOrWhiteSpace(month) ? month.Trim() : DateTime.UtcNow.ToString("yyyy-MM");

            // Query actual payment transactions for the target month (only real disbursements)
            var payments = await _context.SalaryPayments
                .Where(p => p.TenantId == tenantId && !p.IsDeleted && p.Status == "Paid" && p.SalaryMonth == targetMonth && (p.BankAccountId != null || p.CashBookId != null) && p.Amount > 0)
                .ToListAsync();

            var totalDisbursed = payments.Sum(p => p.Amount);
            var bankDisbursed = payments.Where(p => p.PaymentMethod == "BankAccount").Sum(p => p.Amount);
            var cashDisbursed = payments.Where(p => p.PaymentMethod == "CashBook").Sum(p => p.Amount);

            var pendingBalance = await _context.MonthlySalaries
                .Where(m => m.TenantId == tenantId && !m.IsDeleted && m.SalaryMonth == targetMonth)
                .SumAsync(m => m.RemainingBalance);

            return new PayrollDashboardMetricsDto
            {
                DisbursedThisMonth = totalDisbursed,
                PaidViaBankThisMonth = bankDisbursed,
                PaidViaCashThisMonth = cashDisbursed,
                TotalPendingBalanceThisMonth = pendingBalance
            };
        }

        // ==========================================
        // 4. LEGACY ADAPTOR METHODS
        // ==========================================
        public async Task<PagedResult<SalaryPaymentDto>> GetSalaryPaymentsAsync(int pageNumber, int pageSize, PayrollFilterDto filter)
        {
            var result = await GetMonthlySalariesAsync(pageNumber, pageSize, filter);
            var dtos = result.Items.Select(m => new SalaryPaymentDto
            {
                Id = m.Id,
                SalaryNo = m.SalaryNo,
                EmployeeId = m.EmployeeId,
                EmployeeName = m.EmployeeName,
                Department = m.Department,
                Designation = m.Designation,
                SalaryMonth = m.SalaryMonth,
                BaseSalary = m.BaseSalary,
                WorkingDays = m.WorkingDays,
                DaysWorked = m.DaysWorked,
                NetSalaryEntitlement = m.NetSalaryEntitlement,
                TotalPaid = m.TotalPaid,
                RemainingBalance = m.RemainingBalance,
                Status = m.Status,
                PaymentDate = m.LastPaymentDate ?? DateTime.UtcNow
            }).ToList();

            return new PagedResult<SalaryPaymentDto>(dtos, result.TotalCount, pageNumber, pageSize);
        }

        public async Task<SalaryPaymentDetailsDto?> GetSalaryPaymentByIdAsync(Guid id)
        {
            var details = await GetMonthlySalaryByIdAsync(id);
            if (details == null) return null;

            var lastPayment = details.Payments.OrderByDescending(p => p.PaymentDate).FirstOrDefault();
            return new SalaryPaymentDetailsDto
            {
                Id = details.Id,
                SalaryNo = details.SalaryNo,
                EmployeeId = details.EmployeeId,
                EmployeeName = details.EmployeeName,
                Department = details.Department,
                Designation = details.Designation,
                SalaryMonth = details.SalaryMonth,
                BaseSalary = details.BaseSalary,
                WorkingDays = details.WorkingDays,
                DaysWorked = details.DaysWorked,
                DailySalary = details.DailySalary,
                GrossSalary = details.GrossSalary,
                Bonus = details.Bonus,
                AdvanceDeduction = details.AdvanceDeduction,
                OtherDeduction = details.OtherDeduction,
                NetSalaryEntitlement = details.NetSalaryEntitlement,
                TotalPaid = details.TotalPaid,
                RemainingBalance = details.RemainingBalance,
                Status = details.Status,
                Remarks = details.Remarks,
                Payments = details.Payments,
                BankAccountId = lastPayment?.BankAccountId,
                CashBookId = lastPayment?.CashBookId,
                PaymentMethod = lastPayment?.PaymentMethod ?? "BankAccount",
                PaidFrom = lastPayment?.PaidFrom ?? string.Empty,
                PaymentDate = lastPayment?.PaymentDate ?? DateTime.UtcNow
            };
        }

        public async Task<SalaryPaymentDto> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request)
        {
            // 1. Ensure/Create Monthly Salary Entitlement (Does NOT mark as paid)
            var entitlement = await GetOrCreateMonthlySalaryAsync(new CreateOrGetMonthlySalaryRequest
            {
                EmployeeId = request.EmployeeId,
                SalaryMonth = request.SalaryMonth,
                WorkingDays = request.WorkingDays,
                DaysWorked = request.DaysWorked,
                Bonus = request.Bonus,
                AdvanceDeduction = request.AdvanceDeduction,
                OtherDeduction = request.OtherDeduction,
                Remarks = request.Remarks
            });

            // 2. ONLY process a payment if payment amount is explicitly specified and > 0
            if (request.PaymentAmount.HasValue && request.PaymentAmount.Value > 0 && entitlement.RemainingBalance > 0)
            {
                var payAmount = Math.Min(request.PaymentAmount.Value, entitlement.RemainingBalance);
                await ProcessSalaryPaymentAsync(new ProcessSalaryPaymentRequest
                {
                    MonthlySalaryId = entitlement.Id,
                    PaymentType = request.PaymentType ?? "Salary Settlement",
                    Amount = payAmount,
                    PaymentMethod = request.PaymentMethod,
                    BankAccountId = request.BankAccountId,
                    CashBookId = request.CashBookId,
                    Remarks = request.Remarks
                });
            }

            var updated = await GetMonthlySalaryByIdAsync(entitlement.Id);
            return new SalaryPaymentDto
            {
                Id = updated!.Id,
                SalaryNo = updated.SalaryNo,
                EmployeeId = updated.EmployeeId,
                EmployeeName = updated.EmployeeName,
                Department = updated.Department,
                Designation = updated.Designation,
                SalaryMonth = updated.SalaryMonth,
                BaseSalary = updated.BaseSalary,
                WorkingDays = updated.WorkingDays,
                DaysWorked = updated.DaysWorked,
                EarnedSalary = updated.GrossSalary,
                CalculatedEntitlement = updated.CalculatedEntitlement,
                NetSalaryEntitlement = updated.NetSalaryEntitlement,
                TotalPaid = updated.TotalPaid,
                RemainingBalance = updated.RemainingBalance,
                Status = updated.Status,
                PaymentDate = DateTime.UtcNow
            };
        }

        public async Task<SalaryPaymentDto> UpdateSalaryPaymentAsync(Guid id, UpdateSalaryPaymentRequest request)
        {
            var updated = await UpdateMonthlySalaryEntitlementAsync(id, request);
            return new SalaryPaymentDto
            {
                Id = updated.Id,
                SalaryNo = updated.SalaryNo,
                EmployeeId = updated.EmployeeId,
                EmployeeName = updated.EmployeeName,
                Department = updated.Department,
                Designation = updated.Designation,
                SalaryMonth = updated.SalaryMonth,
                BaseSalary = updated.BaseSalary,
                WorkingDays = updated.WorkingDays,
                DaysWorked = updated.DaysWorked,
                NetSalaryEntitlement = updated.NetSalaryEntitlement,
                TotalPaid = updated.TotalPaid,
                RemainingBalance = updated.RemainingBalance,
                Status = updated.Status,
                PaymentDate = DateTime.UtcNow
            };
        }

        public async Task<bool> DeleteSalaryPaymentAsync(Guid id)
        {
            return await ReverseSalaryPaymentTransactionAsync(id);
        }

        // ==========================================
        // PRIVATE HELPER MAPPER METHODS
        // ==========================================
        private static string RecalculateStatus(decimal netEntitlement, decimal totalPaid)
        {
            if (totalPaid <= 0) return "Unpaid";
            if (totalPaid > netEntitlement) return "Overpaid";
            if (totalPaid >= netEntitlement) return "Paid";
            return "Partially Paid";
        }

        private static MonthlySalaryDirectoryDto MapToDirectoryDto(MonthlySalary m)
        {
            var validPayments = m.Payments.Where(p => !p.IsDeleted && (p.Status == null || p.Status == "Paid")).ToList();
            var totalAdvances = validPayments
                .Where(p => p.PaymentType != null && p.PaymentType.Contains("Advance", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount > 0 ? p.Amount : p.NetSalary);
            var totalSettlements = validPayments
                .Where(p => p.PaymentType == null || !p.PaymentType.Contains("Advance", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount > 0 ? p.Amount : p.NetSalary);
            var totalPaid = totalAdvances + totalSettlements;

            var baseSalary = (m.Employee != null && m.Employee.CurrentSalary.HasValue && m.Employee.CurrentSalary.Value > 0)
                ? m.Employee.CurrentSalary.Value
                : (m.BaseSalary > 0 ? m.BaseSalary : m.NetSalaryEntitlement);

            var workingDays = m.WorkingDays > 0 ? m.WorkingDays : 30;
            var daysWorked = m.DaysWorked >= 0 ? m.DaysWorked : workingDays;
            var dailySalary = workingDays > 0 ? Math.Round(baseSalary / workingDays, 2) : 0m;
            var grossSalary = daysWorked == workingDays ? baseSalary : Math.Round((baseSalary * (decimal)daysWorked) / (decimal)workingDays, 2);
            var calculatedEntitlement = Math.Round(grossSalary + m.Bonus - m.AdvanceDeduction - m.OtherDeduction, 2);

            var netEntitlement = m.NetSalaryEntitlement > 0 ? m.NetSalaryEntitlement : calculatedEntitlement;

            var isFinalized = m.IsFinalized;
            var remaining = isFinalized ? 0m : Math.Max(0m, netEntitlement - totalPaid);
            var excessAdvance = totalPaid > netEntitlement ? (totalPaid - netEntitlement) : 0m;
            var lastPayment = validPayments.OrderByDescending(p => p.PaymentDate).FirstOrDefault();

            return new MonthlySalaryDirectoryDto
            {
                Id = m.Id,
                SalaryNo = m.SalaryNo,
                EmployeeId = m.EmployeeId,
                EmployeeName = $"{m.Employee?.FirstName} {m.Employee?.LastName}".Trim(),
                Department = m.Employee?.Department ?? "Operations",
                Designation = m.Employee?.Designation ?? string.Empty,
                SalaryMonth = m.SalaryMonth,
                BaseSalary = baseSalary,
                WorkingDays = workingDays,
                DaysWorked = daysWorked,
                EarnedSalary = grossSalary,
                CalculatedEntitlement = calculatedEntitlement,
                NetSalaryEntitlement = netEntitlement,
                TotalAdvances = totalAdvances,
                TotalSettlements = totalSettlements,
                TotalPaid = totalPaid,
                RemainingBalance = remaining,
                ExcessAdvance = excessAdvance,
                Status = isFinalized ? "Fully Paid" : RecalculateStatus(netEntitlement, totalPaid, isFinalized),
                IsFinalized = isFinalized,
                FinalizedAt = m.FinalizedAt,
                FinalizedBy = m.FinalizedBy,
                LastPaymentDate = lastPayment?.PaymentDate,
                PaymentsCount = validPayments.Count
            };
        }

        private async Task<MonthlySalaryDetailsDto> MapToDetailsDtoAsync(MonthlySalary m)
        {
            var directoryDto = MapToDirectoryDto(m);
            var validPayments = m.Payments.Where(p => !p.IsDeleted).OrderByDescending(p => p.PaymentDate).ToList();

            var paymentDtos = new List<SalaryPaymentTransactionDto>();
            foreach (var p in validPayments)
            {
                string paidFrom = string.Empty;
                if (p.PaymentMethod == "BankAccount" && p.BankAccountId.HasValue)
                {
                    var b = await _context.BankAccounts.FindAsync(p.BankAccountId.Value);
                    paidFrom = b != null ? $"{b.BankName} ({b.AccountName})" : "Bank Account";
                }
                else if (p.PaymentMethod == "CashBook" && p.CashBookId.HasValue)
                {
                    var c = await _context.CashBooks.FindAsync(p.CashBookId.Value);
                    paidFrom = c != null ? c.Name : "Cash Book";
                }

                paymentDtos.Add(new SalaryPaymentTransactionDto
                {
                    Id = p.Id,
                    MonthlySalaryId = m.Id,
                    SalaryNo = p.SalaryNo,
                    PaymentType = p.PaymentType,
                    Amount = p.Amount,
                    PaymentMethod = p.PaymentMethod,
                    PaidFrom = paidFrom,
                    BankAccountId = p.BankAccountId,
                    CashBookId = p.CashBookId,
                    PaymentDate = p.PaymentDate,
                    Remarks = p.Remarks,
                    Status = p.Status
                });
            }

            return new MonthlySalaryDetailsDto
            {
                Id = directoryDto.Id,
                SalaryNo = directoryDto.SalaryNo,
                EmployeeId = directoryDto.EmployeeId,
                EmployeeName = directoryDto.EmployeeName,
                Department = directoryDto.Department,
                Designation = directoryDto.Designation,
                SalaryMonth = directoryDto.SalaryMonth,
                BaseSalary = directoryDto.BaseSalary,
                WorkingDays = directoryDto.WorkingDays,
                DaysWorked = directoryDto.DaysWorked,
                EarnedSalary = directoryDto.EarnedSalary,
                CalculatedEntitlement = directoryDto.CalculatedEntitlement,
                NetSalaryEntitlement = directoryDto.NetSalaryEntitlement,
                TotalAdvances = directoryDto.TotalAdvances,
                TotalSettlements = directoryDto.TotalSettlements,
                TotalPaid = directoryDto.TotalPaid,
                RemainingBalance = directoryDto.RemainingBalance,
                ExcessAdvance = directoryDto.ExcessAdvance,
                Status = directoryDto.Status,
                IsFinalized = directoryDto.IsFinalized,
                FinalizedAt = directoryDto.FinalizedAt,
                FinalizedBy = directoryDto.FinalizedBy,
                LastPaymentDate = directoryDto.LastPaymentDate,
                PaymentsCount = directoryDto.PaymentsCount,
                DailySalary = m.DailySalary,
                GrossSalary = m.GrossSalary,
                Bonus = m.Bonus,
                AdvanceDeduction = m.AdvanceDeduction,
                OtherDeduction = m.OtherDeduction,
                Remarks = m.Remarks,
                Payments = paymentDtos
            };
        }

        public async Task<MonthlySalaryDetailsDto> FinalizeMonthlySalaryAsync(FinalizeMonthlySalaryRequest request)
        {
            var tenantId = GetTenantId();
            var userId = _currentUserContext.UserId ?? "System";

            var entitlement = await _context.MonthlySalaries
                .Include(m => m.Employee)
                .Include(m => m.Payments.Where(p => !p.IsDeleted))
                .FirstOrDefaultAsync(m => m.Id == request.MonthlySalaryId && m.TenantId == tenantId && !m.IsDeleted);

            if (entitlement == null)
            {
                throw new KeyNotFoundException("Monthly Salary entitlement record not found.");
            }

            if (entitlement.IsFinalized)
            {
                throw new InvalidOperationException("This payroll month is already finalized.");
            }

            var validPayments = entitlement.Payments.Where(p => !p.IsDeleted && (p.Status == null || p.Status == "Paid")).ToList();
            var totalPaid = validPayments.Sum(p => p.Amount > 0 ? p.Amount : p.NetSalary);

            var wDays = entitlement.WorkingDays > 0 ? entitlement.WorkingDays : 30;
            var dWorked = entitlement.DaysWorked >= 0 ? entitlement.DaysWorked : wDays;
            var grossSalary = dWorked == wDays ? entitlement.BaseSalary : Math.Round((entitlement.BaseSalary * (decimal)dWorked) / (decimal)wDays, 2);
            var calcEntitlement = Math.Round(grossSalary + entitlement.Bonus - entitlement.AdvanceDeduction - entitlement.OtherDeduction, 2);
            var netEntitlement = entitlement.NetSalaryEntitlement > 0 ? entitlement.NetSalaryEntitlement : calcEntitlement;

            var remainingPayable = Math.Max(0m, Math.Round(netEntitlement - totalPaid, 2, MidpointRounding.AwayFromZero));

            if (remainingPayable > 0.01m && !request.ForceFinalizeWithUnpaid)
            {
                throw new InvalidOperationException($"₹{remainingPayable:N2} is still unpaid. Confirming final settlement will close this payroll month without paying the remaining amount.");
            }

            entitlement.IsFinalized = true;
            entitlement.FinalizedAt = DateTime.UtcNow;
            entitlement.FinalizedBy = userId;
            entitlement.RemainingBalance = 0m;
            entitlement.Status = "Fully Paid";
            if (!string.IsNullOrWhiteSpace(request.Remarks))
            {
                entitlement.Remarks = string.IsNullOrWhiteSpace(entitlement.Remarks)
                    ? $"Finalized: {request.Remarks.Trim()}"
                    : $"{entitlement.Remarks} | Finalized: {request.Remarks.Trim()}";
            }
            entitlement.UpdatedAt = DateTime.UtcNow;
            entitlement.UpdatedBy = userId;

            await _context.SaveChangesAsync();
            return await MapToDetailsDtoAsync(entitlement);
        }

        private static string RecalculateStatus(decimal netEntitlement, decimal totalPaid, bool isFinalized = false)
        {
            if (isFinalized) return "Fully Paid";
            if (totalPaid <= 0m) return "Unpaid";
            if (totalPaid > netEntitlement) return "Overpaid";
            if (totalPaid >= netEntitlement) return "Paid";
            return "Partially Paid";
        }

        private async Task ReconcileLegacyPaymentsAsync(Guid tenantId)
        {
            try
            {
                var unlinkedPayments = await _context.SalaryPayments
                    .Include(p => p.Employee)
                    .Where(p => p.TenantId == tenantId && !p.IsDeleted && p.MonthlySalaryId == null)
                    .ToListAsync();

                if (unlinkedPayments.Any())
                {
                    var companyId = await GetCompanyIdAsync();

                    foreach (var group in unlinkedPayments.GroupBy(p => new { p.EmployeeId, p.SalaryMonth }))
                    {
                        var first = group.First();
                        // Real disbursements are payments made via bank account or cash book
                        var realDisbursements = group.Where(p => p.BankAccountId.HasValue || p.CashBookId.HasValue).ToList();
                        var totalPaid = realDisbursements.Sum(p => p.Amount > 0 ? p.Amount : p.NetSalary);
                        
                        var baseSalary = first.MonthlySalary > 0 ? first.MonthlySalary : (first.Employee?.CurrentSalary ?? 0m);
                        var workingDays = first.WorkingDays > 0 ? first.WorkingDays : 30;
                        var daysWorked = first.DaysWorked > 0 ? first.DaysWorked : 30;
                        var dailySalary = workingDays > 0 ? Math.Round(baseSalary / workingDays, 2) : 0m;
                        var grossSalary = daysWorked == workingDays ? baseSalary : Math.Round(dailySalary * daysWorked, 2);
                        var calculatedEntitlement = Math.Round(grossSalary + first.Bonus - first.AdvanceDeduction - first.OtherDeduction, 2);
                        var netEntitlement = baseSalary > 0 ? baseSalary : Math.Max(baseSalary, calculatedEntitlement);

                        var entitlement = await _context.MonthlySalaries
                            .FirstOrDefaultAsync(m => m.TenantId == tenantId && m.CompanyId == companyId && m.EmployeeId == group.Key.EmployeeId && m.SalaryMonth == group.Key.SalaryMonth && !m.IsDeleted);

                        if (entitlement == null)
                        {
                            entitlement = new MonthlySalary
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                CompanyId = companyId,
                                SalaryNo = first.SalaryNo,
                                EmployeeId = group.Key.EmployeeId,
                                SalaryMonth = group.Key.SalaryMonth,
                                BaseSalary = baseSalary,
                                WorkingDays = workingDays,
                                DaysWorked = daysWorked,
                                DailySalary = dailySalary,
                                GrossSalary = grossSalary,
                                Bonus = first.Bonus,
                                AdvanceDeduction = first.AdvanceDeduction,
                                OtherDeduction = first.OtherDeduction,
                                CalculatedEntitlement = calculatedEntitlement,
                                NetSalaryEntitlement = netEntitlement,
                                TotalPaid = totalPaid,
                                RemainingBalance = Math.Max(0m, netEntitlement - totalPaid),
                                Status = totalPaid >= netEntitlement ? "Paid" : (totalPaid > 0 ? "Partially Paid" : "Unpaid"),
                                CreatedAt = first.CreatedAt,
                                CreatedBy = first.CreatedBy
                            };
                            _context.MonthlySalaries.Add(entitlement);
                        }

                        foreach (var p in group)
                        {
                            if (p.BankAccountId.HasValue || p.CashBookId.HasValue)
                            {
                                p.MonthlySalaryId = entitlement.Id;
                                if (p.Amount <= 0) p.Amount = p.NetSalary;
                            }
                            else
                            {
                                // Soft-delete legacy dummy generator records that were not actual payments
                                p.IsDeleted = true;
                                p.DeletedAt = DateTime.UtcNow;
                                p.DeletedBy = "SystemReconciliation";
                            }
                        }
                    }
                }

                // 2. Repair existing MonthlySalaries where NetSalaryEntitlement was calculated from daysWorked instead of BaseSalary
                var existingSalaries = await _context.MonthlySalaries
                    .Include(m => m.Employee)
                    .Include(m => m.Payments.Where(p => !p.IsDeleted))
                    .Where(m => m.TenantId == tenantId && !m.IsDeleted)
                    .ToListAsync();

                foreach (var m in existingSalaries)
                {
                    // Soft delete only legacy zero-amount generator records that were not actual payments
                    var dummyPayments = m.Payments.Where(p => !p.IsDeleted && p.Amount <= 0 && p.NetSalary <= 0 && !p.BankAccountId.HasValue && !p.CashBookId.HasValue).ToList();
                    foreach (var dummy in dummyPayments)
                    {
                        dummy.IsDeleted = true;
                        dummy.DeletedAt = DateTime.UtcNow;
                        dummy.DeletedBy = "SystemReconciliation";
                    }

                    var validPayments = m.Payments.Where(p => !p.IsDeleted && (p.Status == null || p.Status == "Paid") && (p.Amount > 0 || p.NetSalary > 0)).ToList();
                    var realTotalPaid = validPayments.Sum(p => p.Amount > 0 ? p.Amount : p.NetSalary);

                    var baseSalary = (m.Employee != null && m.Employee.CurrentSalary.HasValue && m.Employee.CurrentSalary.Value > 0)
                        ? m.Employee.CurrentSalary.Value
                        : (m.BaseSalary > 0 ? m.BaseSalary : m.NetSalaryEntitlement);

                    if (m.BaseSalary != baseSalary)
                    {
                        m.BaseSalary = baseSalary;
                    }

                    if (!m.IsFinalized)
                    {
                        m.TotalPaid = realTotalPaid;
                        m.RemainingBalance = Math.Max(0m, m.NetSalaryEntitlement - realTotalPaid);
                        m.Status = RecalculateStatus(m.NetSalaryEntitlement, realTotalPaid, m.IsFinalized);
                    }
                }

                await _context.SaveChangesAsync();
            }
            catch
            {
                // Fallback for isolated contexts
            }
        }
    }
}
