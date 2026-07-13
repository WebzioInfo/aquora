using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class ProductionBatch : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public string BatchNumber { get; set; }
        public string Product { get; set; }
        public string Shift { get; set; }
        
        public Guid ProductionLineId { get; set; }
        public virtual ProductionLine ProductionLine { get; set; }
        
        public Guid OperatorId { get; set; }
        public string OperatorName { get; set; }
        
        public DateTime StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        
        public string Status { get; set; } // "Active", "Completed"
        
        public int TargetQuantity { get; set; }
        public int ProducedQuantity { get; set; }

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
