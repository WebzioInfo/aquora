using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    /// <summary>
    /// Negotiated product-specific selling price for a specific customer.
    /// Allows different customers to receive different prices for different products.
    /// </summary>
    public class CustomerProductPrice : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public Guid CustomerId { get; set; }
        public virtual Customer Customer { get; set; } = null!;

        public Guid ProductId { get; set; }
        public virtual Product Product { get; set; } = null!;

        /// <summary>
        /// Negotiated unit price for this product for this customer.
        /// </summary>
        public decimal CustomPrice { get; set; }

        /// <summary>
        /// Optional special discount percentage.
        /// </summary>
        public decimal? DiscountPercentage { get; set; }

        public DateTime? EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }

        public bool IsActive { get; set; } = true;
        public string? Notes { get; set; }

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
