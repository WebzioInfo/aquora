using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class Station : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public string Name { get; set; }
        public string Code { get; set; }
        public bool IsActive { get; set; } = true;

        // Parent mappings
        public Guid TenantId { get; set; }

        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; }

        public Guid ProductionLineId { get; set; }
        public virtual ProductionLine ProductionLine { get; set; }

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
