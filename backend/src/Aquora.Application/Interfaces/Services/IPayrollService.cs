using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Payroll;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IPayrollService
    {
        // Monthly Salary Entitlements
        Task<PagedResult<MonthlySalaryDirectoryDto>> GetMonthlySalariesAsync(int pageNumber, int pageSize, PayrollFilterDto filter);
        Task<MonthlySalaryDetailsDto?> GetMonthlySalaryByIdAsync(Guid id);
        Task<MonthlySalaryDetailsDto> GetOrCreateMonthlySalaryAsync(CreateOrGetMonthlySalaryRequest request);
        Task<MonthlySalaryDetailsDto> UpdateMonthlySalaryEntitlementAsync(Guid id, CreateOrGetMonthlySalaryRequest request);

        // Salary Payment Transactions
        Task<SalaryPaymentTransactionDto> ProcessSalaryPaymentAsync(ProcessSalaryPaymentRequest request);
        Task<MonthlySalaryDetailsDto> FinalizeMonthlySalaryAsync(FinalizeMonthlySalaryRequest request);
        Task<SalaryPaymentTransactionDto> UpdateSalaryPaymentTransactionAsync(Guid transactionId, UpdateSalaryPaymentTransactionRequest request);
        Task<bool> ReverseSalaryPaymentTransactionAsync(Guid transactionId);

        // Audit, Reports & Metrics
        Task<EmployeeSalaryStatementReportDto> GetEmployeeSalaryStatementReportAsync(Guid employeeId, string? month);
        Task<List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>> GetSalaryPaymentHistoryAsync(Guid transactionId);
        Task<PayrollDashboardMetricsDto> GetPayrollDashboardMetricsAsync(string? month);

        // Legacy Adaptors
        Task<PagedResult<SalaryPaymentDto>> GetSalaryPaymentsAsync(int pageNumber, int pageSize, PayrollFilterDto filter);
        Task<SalaryPaymentDetailsDto?> GetSalaryPaymentByIdAsync(Guid id);
        Task<SalaryPaymentDto> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request);
        Task<SalaryPaymentDto> UpdateSalaryPaymentAsync(Guid id, UpdateSalaryPaymentRequest request);
        Task<bool> DeleteSalaryPaymentAsync(Guid id);
    }
}
