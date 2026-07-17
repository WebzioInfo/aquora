using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class RawMaterial : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public string Name { get; set; }
        public string Code { get; set; }
        public string Category { get; set; } // PREFORM, LABEL, SHRINK_FILM, GLUE, INK, MAKEUP
        public string Unit { get; set; } // E.g., Bag, PCS, KG, Unit
        public string BaseUnit { get; set; } // E.g., PCS, KG
        public decimal ConversionFactor { get; set; } = 1.0m;
        public decimal CurrentStock { get; set; } = 0.0m;
        public bool IsActive { get; set; } = true;

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

