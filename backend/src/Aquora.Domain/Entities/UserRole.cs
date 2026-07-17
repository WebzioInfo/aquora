using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class UserRole : BaseEntity, IMultiTenant, IAuditable
    {
        public Guid UserId { get; set; }

        public Guid RoleId { get; set; }
        public virtual Role Role { get; set; }

        public Guid TenantId { get; set; }

        // Auditable
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}

