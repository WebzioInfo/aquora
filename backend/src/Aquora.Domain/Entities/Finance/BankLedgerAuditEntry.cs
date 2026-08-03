using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class BankLedgerAuditEntry : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public Guid BankLedgerEntryId { get; set; }
        public virtual BankLedgerEntry BankLedgerEntry { get; set; } = null!;

        public string Action { get; set; } = string.Empty; // "Created", "Edited"
        public decimal OldAmount { get; set; }
        public decimal NewAmount { get; set; }
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
