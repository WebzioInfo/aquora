using System;
using System.Threading.Tasks;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface IBankLedgerService
    {
        Task<PagedResult<BankLedgerEntryDto>> GetLedgerAsync(Guid bankAccountId, int pageNumber, int pageSize, string? search, BankLedgerFilterDto filter);
        Task<BankSummaryDto> GetBankSummaryAsync(Guid bankAccountId);
        Task<Guid> RecordTransactionAsync(
            Guid bankAccountId, 
            DateTime transactionDate, 
            string referenceNumber, 
            string transactionType, 
            string description, 
            decimal amount, // Positive for Credit (in), Negative for Debit (out)
            Guid? relatedEntityId = null, 
            string? relatedEntityType = null);

        Task<Guid> RecordTransactionAsync(
            Guid bankAccountId, 
            DateTime transactionDate, 
            string referenceNumber, 
            string transactionType, 
            string description, 
            decimal debit,
            decimal credit,
            Guid? relatedEntityId = null, 
            string? relatedEntityType = null);

        Task SyncExpenseLedgerAsync(
            Guid expenseId,
            Guid bankAccountId,
            DateTime expenseDate,
            string expenseNumber,
            string category,
            string description,
            decimal amount,
            string transactionType = "Expense");

        Task RemoveLedgerEntryForEntityAsync(Guid relatedEntityId, string relatedEntityType);

        Task RecalculateBankLedgerBalancesAsync(Guid bankAccountId);

        Task ReconcileMissingLedgerEntriesAsync(Guid? bankAccountId = null);

        Task<System.Collections.Generic.List<BankLedgerAuditEntryDto>> GetLedgerHistoryAsync(Guid ledgerEntryId);
    }
}
