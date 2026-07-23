using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class ProductionShift : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public string Name { get; set; }
        
        public string StartTime { get; set; }
        public string EndTime { get; set; }
        
        public bool IsActive { get; set; } = true;

        // Multi-tenant mappings
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        // Auditable fields
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }
        public string? DeletedBy { get; set; }
        
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
        public string? DeletedByIP { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        // Soft delete
        public bool IsDeleted { get; set; }
    }
}
