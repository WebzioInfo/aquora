using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class ProductionStationData : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid ProductionBatchId { get; set; }
        public virtual ProductionBatch ProductionBatch { get; set; }

        public string StationCode { get; set; } // "BLOW_MOULDING", "FILLING", etc.
        public string OperatorName { get; set; }
        public DateTime Timestamp { get; set; }

        public int InputQty { get; set; }
        public int OutputQty { get; set; }
        public int WastageQty { get; set; }
        public double Efficiency { get; set; }

        public string? AdditionalData { get; set; } // JSON metadata for custom fields

        // Multi-tenant mappings
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

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
