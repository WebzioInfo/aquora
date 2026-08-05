using System;
using System.Collections.Generic;
using Aquora.Domain.Common;
using Aquora.Domain.Entities.QC;

namespace Aquora.Domain.Entities.Operations
{
    public class OperationsIssue : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string IssueNumber { get; set; } = string.Empty; // e.g. ISS-20260805-001
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public string Department { get; set; } = "Production"; // Production, Warehouse, Dispatch, QC, HR, Maintenance, General
        public string Category { get; set; } = "Machine Breakdown";
        public string Priority { get; set; } = "Medium"; // Low, Medium, High, Critical, Emergency
        public string Status { get; set; } = "Open"; // Open, Acknowledged, Assigned, InProgress, WaitingForParts, WaitingVendor, OnHold, Resolved, Verified, Closed, Rejected

        public string ReportedByUserId { get; set; } = string.Empty;
        public string ReportedByName { get; set; } = string.Empty;

        public string? AssignedToUserId { get; set; }
        public string? AssignedToName { get; set; }

        // Linked Enterprise Resources
        public Guid? MachineId { get; set; }
        public string? MachineName { get; set; }

        public Guid? ProductionLineId { get; set; }
        public string? ProductionLineName { get; set; }

        public string? BatchNumber { get; set; }
        public Guid? ShiftId { get; set; }

        // Operational Timestamps
        public DateTime ReportedAt { get; set; } = DateTime.UtcNow;
        public DateTime? DueDate { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime? VerifiedAt { get; set; }

        // Metrics & Maintenance Link
        public decimal? EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public int? DowntimeMinutes { get; set; }
        public bool RequiresMaintenance { get; set; }
        public Guid? MaintenanceWorkOrderId { get; set; }

        // Root Cause & Resolution
        public string? RootCause { get; set; }
        public string? CorrectiveAction { get; set; }
        public string? PreventiveAction { get; set; }

        // Attachments (JSON array string)
        public string? Attachments { get; set; }

        // Collections
        public virtual ICollection<OperationsIssueComment> Comments { get; set; } = new List<OperationsIssueComment>();
        public virtual ICollection<OperationsIssueHistory> HistoryLogs { get; set; } = new List<OperationsIssueHistory>();

        // Auditable
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        // Soft Delete
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
