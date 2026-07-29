using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Finance;

namespace Aquora.Application.Interfaces.Services
{
    public interface IFinanceService
    {
        Task<List<AccountGroupDto>> GetAccountGroupsAsync();
        Task<List<AccountDto>> GetAccountsAsync();
        Task<AccountDto> CreateAccountAsync(string name, string code, Guid groupId, decimal openingBalance, string balanceType);
        
        Task<JournalEntryDto> GetJournalEntryAsync(Guid id);
        Task<List<JournalEntryDto>> GetJournalEntriesAsync(DateTime? startDate, DateTime? endDate);
        
        Task<JournalEntryDto> CreateJournalEntryAsync(CreateJournalEntryRequest request);
        Task PostJournalEntryAsync(Guid id);
        
        Task SeedDefaultChartOfAccountsAsync();
        
        Task<List<AssetDto>> GetAssetsAsync();
        Task<AssetDto> CreateAssetAsync(string name, string type, decimal price, DateTime date);
        
        Task<List<ExpenseRecordDto>> GetExpensesAsync();
        Task<ExpenseRecordDto> CreateExpenseAsync(string desc, string category, decimal amount, DateTime date);

    }
}
