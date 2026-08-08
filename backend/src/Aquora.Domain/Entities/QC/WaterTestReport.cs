using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.QC
{
    public class WaterTestReport : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string BatchNumber { get; set; } = string.Empty;
        public string? SampleNumber { get; set; }
        public DateTime? ProductionDate { get; set; }
        public string ReportType { get; set; } = "DAILY"; // DAILY, WEEKLY, etc.
        public string Status { get; set; } = "DRAFT"; // DRAFT, SUBMITTED, REVIEWED, APPROVED, PUBLISHED, REJECTED, RETEST_REQUIRED
        public DateTime? SampleTime { get; set; }
        public string? TestedBy { get; set; }
        public string? CollectedBy { get; set; }
        public string? VerifiedBy { get; set; }
        public string? Remarks { get; set; }
        public string? Attachments { get; set; } // JSON list of urls/names

        public string ConcurrencyToken { get; set; } = Guid.NewGuid().ToString();

        public bool IsActive { get; set; } = true;

        public virtual ICollection<WaterTestResult> Results { get; set; } = new List<WaterTestResult>();

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
