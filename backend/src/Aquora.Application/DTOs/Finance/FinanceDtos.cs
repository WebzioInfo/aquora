using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Finance
{
    public class AccountGroupDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public Guid? ParentGroupId { get; set; }
    }

    public class AccountDto
    {
        public Guid Id { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string AccountCode { get; set; } = string.Empty;
        public Guid AccountGroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public decimal OpeningBalance { get; set; }
        public string BalanceType { get; set; } = string.Empty;
        public decimal CurrentBalance { get; set; }
        public bool IsActive { get; set; }
    }

    public class JournalEntryDto
    {
        public Guid Id { get; set; }
        public string VoucherNumber { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public string VoucherType { get; set; } = string.Empty;
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public List<JournalEntryLineDto> Lines { get; set; } = new();
    }

    public class JournalEntryLineDto
    {
        public Guid Id { get; set; }
        public Guid AccountId { get; set; }
        public string AccountName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal DebitAmount { get; set; }
        public decimal CreditAmount { get; set; }
    }

    public class CreateJournalEntryRequest
    {
        public DateTime TransactionDate { get; set; }
        public string VoucherType { get; set; } = "Journal";
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
        public List<CreateJournalEntryLineRequest> Lines { get; set; } = new();
    }

    public class CreateJournalEntryLineRequest
    {
        public Guid AccountId { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal DebitAmount { get; set; }
        public decimal CreditAmount { get; set; }
    }
}

    public class AssetDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string AssetType { get; set; } = string.Empty;
        public decimal PurchasePrice { get; set; }
        public DateTime PurchaseDate { get; set; }
        public decimal CurrentValue { get; set; }
    }
    
    public class ExpenseRecordDto
    {
        public Guid Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public string Status { get; set; } = string.Empty;
    }
