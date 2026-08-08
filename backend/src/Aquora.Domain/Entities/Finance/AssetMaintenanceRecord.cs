using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class AssetMaintenanceRecord : BaseEntity, IMultiTenant, ICompanySpecific
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid AssetId { get; set; }
        public virtual Asset Asset { get; set; } = null!;

        public string MaintenanceType { get; set; } = "Preventive"; // Scheduled, Preventive, Corrective, Repair
        public DateTime MaintenanceDate { get; set; } = DateTime.UtcNow;
        public string ServiceProvider { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        
        public decimal PartsCost { get; set; }
        public decimal LabourCost { get; set; }
        public decimal OtherCost { get; set; }
        public decimal TotalCost { get; set; }

        public DateTime? NextMaintenanceDate { get; set; }
        public bool IsWarrantyClaim { get; set; }
        public string? TechnicianName { get; set; }
        public string? Notes { get; set; }
        public string? AttachmentUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
    }
}
