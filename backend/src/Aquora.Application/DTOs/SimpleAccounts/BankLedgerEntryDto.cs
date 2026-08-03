using System;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    public class BankLedgerEntryDto
    {
        public Guid Id { get; set; }
        public Guid BankAccountId { get; set; }
        public DateTime TransactionDate { get; set; }
        public string ReferenceNumber { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal RunningBalance { get; set; }
        
        public Guid? RelatedEntityId { get; set; }
        public string? RelatedEntityType { get; set; }
        
        public int LedgerSequence { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
    }
}
