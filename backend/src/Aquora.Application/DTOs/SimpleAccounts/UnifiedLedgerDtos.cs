using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    public class UnifiedLedgerEntryDto
    {
        public Guid Id { get; set; }
        public string AccountType { get; set; } = "BANK"; // "BANK" or "CASH"
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string? BankName { get; set; }
        public string? AccountNumber { get; set; }
        public DateTime TransactionDate { get; set; }
        public string ReferenceNumber { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public string? EventType { get; set; } = "CREATED";
        public string? EventLabel { get; set; }
        public string? AuditNotes { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal Amount => Credit > 0 ? Credit : Debit;
        public decimal RunningBalance { get; set; }
        public Guid? RelatedEntityId { get; set; }
        public string? RelatedEntityType { get; set; }
        public int LedgerSequence { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
    }

    public class UnifiedLedgerFilterDto
    {
        public string? AccountType { get; set; } = "ALL"; // "ALL", "BANK", "CASH"
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public string? Search { get; set; }
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public string? TransactionType { get; set; }
        public string? CreatedBy { get; set; }
        public decimal? MinAmount { get; set; }
        public decimal? MaxAmount { get; set; }
        public string? SortBy { get; set; } = "transactiondate";
        public string? SortOrder { get; set; } = "desc";
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 25;
    }

    public class UnifiedLedgerSummaryDto
    {
        public string AccountType { get; set; } = "ALL";
        public Guid? SelectedAccountId { get; set; }
        public decimal TotalBalance { get; set; }
        public decimal TotalBankBalance { get; set; }
        public decimal TotalCashBalance { get; set; }
        public int ActiveBankAccountsCount { get; set; }
        public int ActiveCashBooksCount { get; set; }
        public int TotalTransactions { get; set; }
        public decimal TotalMoneyReceived { get; set; }
        public decimal TotalMoneyPaid { get; set; }
        public decimal NetCashFlow => TotalMoneyReceived - TotalMoneyPaid;
        public int TodaysTransactions { get; set; }
        public int ThisMonthTransactions { get; set; }
    }

    public class AccountsMetadataDto
    {
        public List<BankAccountDropdownDto> BankAccounts { get; set; } = new();
        public List<CashBookDropdownDto> CashBooks { get; set; } = new();
        public decimal TotalBankBalance { get; set; }
        public decimal TotalCashBalance { get; set; }
        public decimal TotalBalance { get; set; }
        public int ActiveBankAccountsCount { get; set; }
        public int ActiveCashBooksCount { get; set; }
    }
}
