using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface ISimpleAccountsService
    {
        // 1. Expense Management
        Task<PagedResult<SimpleExpenseDto>> GetExpensesAsync(
            int pageNumber,
            int pageSize,
            string? search,
            DateTime? startDate,
            DateTime? endDate,
            string? category,
            int? month,
            string? paymentMethod);

        Task<SimpleExpenseDto?> GetExpenseByIdAsync(Guid id);
        Task<SimpleExpenseDto> CreateExpenseAsync(CreateSimpleExpenseRequest request);
        Task<SimpleExpenseDto?> UpdateExpenseAsync(Guid id, UpdateSimpleExpenseRequest request);
        Task<bool> DeleteExpenseAsync(Guid id);

        // 2. Bank Account Management
        Task<PagedResult<BankAccountDto>> GetBankAccountsAsync(
            int pageNumber,
            int pageSize,
            string? search,
            string? status);
        Task<List<BankAccountDropdownDto>> GetBankAccountDropdownAsync();
        Task<BankAccountDto?> GetBankAccountByIdAsync(Guid id);
        Task<BankAccountDto> CreateBankAccountAsync(CreateBankAccountRequest request);
        Task<BankAccountDto?> UpdateBankAccountAsync(Guid id, UpdateBankAccountRequest request);
        Task<bool> DeleteBankAccountAsync(Guid id);

        // 3. Owner Investment Management
        Task<List<OwnerDto>> GetOwnersAsync();
        Task<OwnerDto?> GetOwnerByIdAsync(Guid id);
        Task<OwnerDto> CreateOwnerAsync(CreateOwnerRequest request);
        Task<OwnerDto?> UpdateOwnerAsync(Guid id, UpdateOwnerRequest request);
        Task<bool> DeleteOwnerAsync(Guid id);
        Task<OwnerInvestmentTransactionDto> AddOwnerTransactionAsync(Guid ownerId, CreateOwnerInvestmentTransactionRequest request);
        Task<List<OwnerSummaryDto>> GetOwnerSummariesAsync();
        Task<CompanyTotalInvestmentDto> GetCompanyTotalInvestmentAsync();

        // 4. Asset Summary
        Task<AssetSummaryDto> GetAssetSummaryAsync();

        // 5. Dashboard Summary
        Task<SimpleAccountsDashboardSummaryDto> GetDashboardSummaryAsync();
    }
}
