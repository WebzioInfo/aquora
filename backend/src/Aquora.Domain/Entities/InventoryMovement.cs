using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class InventoryMovement : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid RawMaterialId { get; set; }
        public virtual RawMaterial RawMaterial { get; set; }

        public decimal Quantity { get; set; } // Negative for deductions, positive for increases
        public string ReferenceType { get; set; } // E.g., "ProductionEntry"
        public Guid ReferenceId { get; set; } // The ID of the related transaction

        // Multi-tenant mappings
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; }

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }

        // Soft Delete fields
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
