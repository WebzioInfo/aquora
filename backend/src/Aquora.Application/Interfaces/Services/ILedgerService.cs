using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Shared.Models;

namespace Aquora.Application.Interfaces.Services
{
    public interface ILedgerService : IBankLedgerService
    {
        Task<PagedResult<BankLedgerEntryDto>> GetCashBookLedgerAsync(Guid cashBookId, int pageNumber, int pageSize, string? search, BankLedgerFilterDto filter);
        Task<BankSummaryDto> GetCashBookSummaryAsync(Guid cashBookId);
        Task<Guid> RecordCashTransactionAsync(Guid cashBookId, DateTime transactionDate, string referenceNumber, string transactionType, string description, decimal debit, decimal credit, Guid? relatedEntityId = null, string? relatedEntityType = null);
        Task SyncCashExpenseLedgerAsync(Guid expenseId, Guid cashBookId, DateTime expenseDate, string expenseNumber, string category, string description, decimal amount, string transactionType = "Expense");
        Task RecalculateCashBookLedgerBalancesAsync(Guid cashBookId);
        Task ReconcileMissingCashBookLedgerEntriesAsync(Guid? cashBookId = null);
        Task<Guid> AddMoneyAsync(Guid? bankAccountId, Guid? cashBookId, AddMoneyRequest request);
        Task UpdateDepositAsync(Guid ledgerEntryId, AddMoneyRequest request);
        Task DeleteDepositAsync(Guid ledgerEntryId);
        Task SyncSalaryPaymentLedgerAsync(
            Guid salaryPaymentId,
            Guid? bankAccountId,
            Guid? cashBookId,
            string paymentMethod,
            DateTime paymentDate,
            string salaryNo,
            string description,
            decimal oldNetSalary,
            decimal newNetSalary,
            string auditRemarks);
    }
}
