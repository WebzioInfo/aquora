using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class PurchaseCategory : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string Code { get; set; } = string.Empty; // e.g. "RawMaterial", "Machine", "OfficeAsset", or generated slug
        public string Name { get; set; } = string.Empty; // e.g. "Raw Material (Inventory Stock IN)" or custom "Factory Cleaning"
        public string? Description { get; set; }
        
        // Treatment / Behavior: Inventory, Asset, Expense
        public string Treatment { get; set; } = "Expense"; // "Inventory", "Asset", "Expense"

        // IsSystem: true for the 10 built-in system categories, preventing deletion
        public bool IsSystem { get; set; } = false;

        public bool IsActive { get; set; } = true;

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
