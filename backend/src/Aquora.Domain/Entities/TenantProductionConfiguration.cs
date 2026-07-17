using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class TenantProductionConfiguration : BaseEntity, IAuditable
    {
        public Guid TenantId { get; set; }
        public virtual Tenant Tenant { get; set; }

        public string StationName { get; set; } // "Blowing", "Filling", "Labeling", "Packing"
        public bool IsEnabled { get; set; }

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = "System";
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}

