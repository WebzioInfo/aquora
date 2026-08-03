using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class SalesTransaction : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string TransactionNumber { get; set; } = string.Empty;
        
        public Guid CustomerId { get; set; }
        public virtual Customer Customer { get; set; } = null!;

        public Guid ProductId { get; set; }
        public virtual Product Product { get; set; } = null!;

        public decimal Cases { get; set; }
        public string TransactionType { get; set; } = string.Empty; // Sales Dispatch, Customer Return, Damage

        public DateTime TransactionDate { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
        public string Status { get; set; } = "Completed";

        // Sales Account Tracking
        public decimal TotalAmount { get; set; }
        public decimal AmountReceived { get; set; }
        public decimal OutstandingAmount { get; set; }
        public string PaymentStatus { get; set; } = "Pending"; // Pending, Partial, Paid

        // Sales Return Account Tracking
        public decimal ReturnedAmount { get; set; }
        public decimal RefundAmount { get; set; }
        public decimal AdjustmentAmount { get; set; }
        public string? ReturnType { get; set; }
        public bool IsReplacementRequired { get; set; } = false;

        // Damage Account Tracking
        public decimal ProductValue { get; set; }
        public decimal DamageCost { get; set; }
        public string? DamageReason { get; set; }

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        // Soft Delete fields
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}

