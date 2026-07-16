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

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }

        // Soft Delete fields
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
