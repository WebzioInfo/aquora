using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class Asset : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string AssetName { get; set; } = string.Empty;
        public string AssetCategory { get; set; } = string.Empty; // Machine, Vehicle, Building
        public string? SerialNumber { get; set; }
        
        public DateTime PurchaseDate { get; set; }
        public decimal PurchasePrice { get; set; }
        
        public Guid? SupplierId { get; set; }
        public string? WarrantyDetails { get; set; }
        
        public string CurrentStatus { get; set; } = "Active"; // Active, Under Maintenance, Scrapped
        public string? Location { get; set; }
        public Guid? AssignedEmployeeId { get; set; }
        
        public decimal DepreciationRate { get; set; }
        public decimal CurrentValue { get; set; }
        
        public string? Notes { get; set; }
        public string? PhotoUrl { get; set; }
        public string? DocumentUrl { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
        
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
