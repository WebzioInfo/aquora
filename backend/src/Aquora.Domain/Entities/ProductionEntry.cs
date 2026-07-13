using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class ProductionEntry : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid OperatorId { get; set; }
        public string OperatorName { get; set; }

        public Guid ProductionLineId { get; set; }
        public virtual ProductionLine ProductionLine { get; set; }

        public string Shift { get; set; }
        public DateTime Date { get; set; }
        public string Time { get; set; }

        public Guid ProductId { get; set; }
        public virtual Product Product { get; set; }

        public int CasesProduced { get; set; }

        // Material Consumption Details
        public Guid PreformMaterialId { get; set; }
        public virtual RawMaterial PreformMaterial { get; set; }
        public decimal PreformUsage { get; set; }
        public decimal PreformWastage { get; set; }

        public Guid? CapMaterialId { get; set; }
        public virtual RawMaterial? CapMaterial { get; set; }
        public decimal CapUsage { get; set; }
        public decimal CapWastage { get; set; }

        public Guid LabelMaterialId { get; set; }
        public virtual RawMaterial LabelMaterial { get; set; }
        public decimal LabelUsage { get; set; }
        public decimal LabelWastage { get; set; }

        public Guid ShrinkMaterialId { get; set; }
        public virtual RawMaterial ShrinkMaterial { get; set; }
        public decimal ShrinkUsage { get; set; }
        public decimal ShrinkWastage { get; set; }

        public Guid? GlueMaterialId { get; set; }
        public virtual RawMaterial? GlueMaterial { get; set; }
        public decimal? GlueUsage { get; set; }

        public bool InkUsed { get; set; }
        public bool MakeupUsed { get; set; }

        // Reference link to inventory movements
        public string InventoryMovementIds { get; set; } = string.Empty;

        public Guid? ProductionSessionId { get; set; }
        public virtual ProductionSession? ProductionSession { get; set; }

        // Multi-tenant mappings
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; }

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
