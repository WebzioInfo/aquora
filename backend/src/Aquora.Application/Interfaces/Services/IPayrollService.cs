using System;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Payroll;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IPayrollService
    {
        Task<PagedResult<SalaryPaymentDto>> GetSalaryPaymentsAsync(int pageNumber, int pageSize, PayrollFilterDto filter);
        Task<SalaryPaymentDetailsDto?> GetSalaryPaymentByIdAsync(Guid id);
        Task<SalaryPaymentDto> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request);
        Task<SalaryPaymentDto> UpdateSalaryPaymentAsync(Guid id, UpdateSalaryPaymentRequest request);
        Task<bool> DeleteSalaryPaymentAsync(Guid id);
        Task<System.Collections.Generic.List<Aquora.Application.DTOs.SimpleAccounts.BankLedgerAuditEntryDto>> GetSalaryPaymentHistoryAsync(Guid id);
    }
}
