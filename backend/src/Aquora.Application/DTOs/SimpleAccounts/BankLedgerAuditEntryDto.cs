using System;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    public class BankLedgerAuditEntryDto
    {
        public Guid Id { get; set; }
        public Guid BankLedgerEntryId { get; set; }
        public string Action { get; set; } = string.Empty;
        public decimal OldAmount { get; set; }
        public decimal NewAmount { get; set; }
        public string? Remarks { get; set; }
        public string ChangedBy { get; set; } = string.Empty;
        public DateTime ChangedAt { get; set; }
    }
}
