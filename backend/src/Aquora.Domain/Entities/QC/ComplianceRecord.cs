using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.QC
{
    public class ComplianceRecord : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public Guid? ReportId { get; set; }
        public virtual WaterTestReport? Report { get; set; }

        public string ReferenceNumber { get; set; } = string.Empty; // e.g. NCR-2026-0001 or CAPA-2026-0001
        public string Type { get; set; } = "NCR"; // NCR (Non-Conformance Report), CAPA (Corrective Action), WARNING, CRITICAL_FAILURE
        public string Severity { get; set; } = "HIGH"; // LOW, MEDIUM, HIGH, CRITICAL
        public string Status { get; set; } = "OPEN"; // OPEN, UNDER_INVESTIGATION, IN_PROGRESS, RESOLVED, CLOSED

        public string ParameterName { get; set; } = string.Empty;
        public string BatchNumber { get; set; } = string.Empty;
        public string DefectDescription { get; set; } = string.Empty;
        public string? MeasuredValue { get; set; }
        public string? ExpectedRange { get; set; }

        public string? RootCauseAnalysis { get; set; }
        public string? CorrectiveAction { get; set; }
        public string? PreventiveAction { get; set; }

        public string AssignedTo { get; set; } = string.Empty;
        public DateTime? TargetResolutionDate { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public string? ResolvedBy { get; set; }
        public string? ResolutionNotes { get; set; }

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
