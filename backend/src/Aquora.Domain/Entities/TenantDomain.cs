using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class TenantDomain : BaseEntity
    {
        public Guid TenantId { get; set; }
        public virtual Tenant Tenant { get; set; }
        public string Domain { get; set; }
        public bool IsPrimary { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
