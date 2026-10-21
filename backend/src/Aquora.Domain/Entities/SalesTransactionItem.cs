using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class SalesTransactionItem : BaseEntity, IMultiTenant, ICompanySpecific
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid SalesTransactionId { get; set; }
        public virtual SalesTransaction SalesTransaction { get; set; } = null!;

        public Guid ProductId { get; set; }
        public virtual Product Product { get; set; } = null!;

        public Guid? CaseConfigurationId { get; set; }
        public virtual CaseConfiguration? CaseConfiguration { get; set; }

        public int UnitsPerCase { get; set; } = 24;
        public decimal Cases { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal GstRate { get; set; }
        public bool IsGstApplicable { get; set; }
        public decimal CGST { get; set; }
        public decimal SGST { get; set; }
        public decimal IGST { get; set; }
        public decimal TotalAmount { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
