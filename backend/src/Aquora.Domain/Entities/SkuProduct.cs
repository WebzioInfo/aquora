using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class SkuProduct : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public string Name { get; set; }
        public string Code { get; set; }
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

        // Soft Delete fields
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
