using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class Product : BaseEntity, IAuditable, ISoftDelete
    {
        public string Name { get; set; } = string.Empty;
        public Guid BrandId { get; set; }
        public virtual Brand Brand { get; set; } = null!;
        public string? SKU { get; set; }
        public bool IsActive { get; set; } = true;
        public decimal CurrentStock { get; set; } = 0;

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

