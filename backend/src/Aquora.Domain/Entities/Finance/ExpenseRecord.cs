using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class ExpenseRecord : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string Category { get; set; } = string.Empty; // Fuel, Electricity, Rent
        public decimal Amount { get; set; }
        public decimal GSTAmount { get; set; }
        public decimal TotalAmount { get; set; }
        
        public DateTime ExpenseDate { get; set; }
        public string PaymentMethod { get; set; } = "Cash"; // Cash, UPI, Bank
        
        public string? VendorName { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Remarks { get; set; }
        
        public string? BillAttachmentUrl { get; set; }
        
        public string Status { get; set; } = "PendingApproval"; // PendingApproval, Approved, Rejected
        public Guid? ApprovedById { get; set; }
        
        public Guid? LinkedJournalEntryId { get; set; }
        public virtual JournalEntry? LinkedJournalEntry { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
