using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class PriceList : BaseEntity, IMultiTenant, IAuditable, ISoftDelete
    {
        public string Code { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
        
        // Tenant reference
        public Guid TenantId { get; set; }
        public virtual Tenant? Tenant { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedByIP { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? UpdatedByIP { get; set; }
        
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
