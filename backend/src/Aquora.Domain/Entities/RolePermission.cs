using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class RolePermission : BaseEntity, IMultiTenant, IAuditable
    {
        public Guid RoleId { get; set; }
        public virtual Role Role { get; set; }

        public Guid PermissionId { get; set; }
        public virtual Permission Permission { get; set; }

        public Guid TenantId { get; set; }

        // Auditable
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
    }
}
