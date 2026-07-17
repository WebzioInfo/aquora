using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class ProductionSession : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public string BatchNumber { get; set; } = string.Empty;
        
        public Guid ProductionLineId { get; set; }
        public virtual ProductionLine ProductionLine { get; set; } = null!;

        public Guid OperatorId { get; set; }
        public string OperatorName { get; set; } = string.Empty;

        public string Shift { get; set; } = string.Empty;
        
        public Guid ProductId { get; set; }
        public virtual Product Product { get; set; } = null!;

        public DateTime StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        
        public string Status { get; set; } = "Running"; // Running, Completed, Cancelled, Paused
        
        public string? Remarks { get; set; }
        public int TotalCasesProduced { get; set; }

        public virtual ICollection<ProductionEntry> ProductionEntries { get; set; } = new List<ProductionEntry>();

        // Multi-tenant mappings
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

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

