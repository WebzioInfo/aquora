using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class PurchaseItem : BaseEntity
    {
        public Guid PurchaseId { get; set; }
        public virtual Purchase Purchase { get; set; } = null!;

        public Guid? RawMaterialId { get; set; }
        public virtual RawMaterial? RawMaterial { get; set; }

        public string ItemName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Unit { get; set; } = "Pcs";
        public decimal UnitPrice { get; set; }
        public decimal GSTPercent { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
    }
}
