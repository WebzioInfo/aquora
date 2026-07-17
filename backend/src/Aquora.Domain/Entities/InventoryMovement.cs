using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class InventoryMovement : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid? RawMaterialId { get; set; }
        public virtual RawMaterial? RawMaterial { get; set; }

        public Guid? ProductId { get; set; }
        public virtual Product? Product { get; set; }

        public string InventoryType { get; set; } = "RawMaterial";

        public decimal Quantity { get; set; } // Negative for deductions, positive for increases
        public decimal BalanceAfter { get; set; } = 0.0m;
        public string ReferenceType { get; set; } // E.g., "ProductionEntry"
        public Guid ReferenceId { get; set; } // The ID of the related transaction
        public string? Notes { get; set; }

        // Multi-tenant mappings
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; }

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; }
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

