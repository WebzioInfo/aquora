using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class JournalEntry : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string VoucherNumber { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public string VoucherType { get; set; } = "Journal"; // Receipt, Payment, Contra, Sales, Purchase, Journal
        
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
        
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = "Posted"; // Draft, PendingApproval, Posted, Cancelled

        public Guid? ApprovedById { get; set; }
        public virtual User? ApprovedBy { get; set; }
        public DateTime? ApprovedAt { get; set; }

        public virtual ICollection<JournalEntryLine> Lines { get; set; } = new List<JournalEntryLine>();
        
        // Source links (for integrations)
        public Guid? SourceSalesTransactionId { get; set; }
        public Guid? SourcePurchaseId { get; set; }
        public Guid? SourceExpenseId { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
