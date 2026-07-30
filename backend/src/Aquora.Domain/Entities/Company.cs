using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class Company : BaseEntity, IMultiTenant, IAuditable, ISoftDelete
    {
        public string Name { get; set; }
        public string Code { get; set; }
        public bool IsActive { get; set; } = true;

        // Profile Details
        // (Removed due to schema mismatch)

        // System Preferences
        // (Removed due to schema mismatch)

        // Tenant mapping
        public Guid TenantId { get; set; }

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
