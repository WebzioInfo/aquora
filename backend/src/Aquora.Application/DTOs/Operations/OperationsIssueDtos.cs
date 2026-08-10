using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Operations
{
    public class AffectedMachineItemDto
    {
        public Guid MachineId { get; set; }
        public string MachineName { get; set; } = string.Empty;
        public string? MachineCode { get; set; }
    }

    public class OperationsIssueDto
    {
        public Guid Id { get; set; }
        public string IssueNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Department { get; set; } = "Production";
        public string Category { get; set; } = "Machine Breakdown";
        public string Priority { get; set; } = "Medium";
        public string Status { get; set; } = "Open";

        public string ReportedByUserId { get; set; } = string.Empty;
        public string ReportedByName { get; set; } = string.Empty;
        public string? AssignedToUserId { get; set; }
        public string? AssignedToName { get; set; }

        public Guid? MachineId { get; set; }
        public string? MachineName { get; set; }
        public List<Guid> AffectedMachineIds { get; set; } = new List<Guid>();
        public List<AffectedMachineItemDto> AffectedMachines { get; set; } = new List<AffectedMachineItemDto>();
        public Guid? ProductionLineId { get; set; }
        public string? ProductionLineName { get; set; }
        public Guid? BatchId { get; set; }
        public string? BatchNumber { get; set; }
        public Guid? ProductId { get; set; }
        public string? ProductName { get; set; }
        public Guid? StationId { get; set; }
        public string? StationName { get; set; }
        public Guid? ProductionSessionId { get; set; }
        public Guid? ShiftId { get; set; }
        public bool RequiresImmediateStop { get; set; }

        public DateTime ReportedAt { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime? VerifiedAt { get; set; }

        public decimal? EstimatedCost { get; set; }
        public decimal? ActualCost { get; set; }
        public int? DowntimeMinutes { get; set; }
        public bool RequiresMaintenance { get; set; }
        public Guid? MaintenanceWorkOrderId { get; set; }

        public string? RootCause { get; set; }
        public string? CorrectiveAction { get; set; }
        public string? PreventiveAction { get; set; }
        public string? Attachments { get; set; }

        public bool IsRead { get; set; }
        public DateTime? ReadAt { get; set; }
        public string? ReadBy { get; set; }

        public int CommentsCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class OperationsIssueNotificationDto
    {
        public Guid Id { get; set; }
        public string IssueNumber { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string? ProductionLineName { get; set; }
        public string? MachineName { get; set; }
        public string ReportedByName { get; set; } = string.Empty;
        public DateTime ReportedAt { get; set; }
        public bool IsRead { get; set; }
    }

    public class OperationsIssueDetailDto : OperationsIssueDto
    {
        public List<OperationsIssueCommentDto> Comments { get; set; } = new List<OperationsIssueCommentDto>();
        public List<OperationsIssueHistoryDto> HistoryLogs { get; set; } = new List<OperationsIssueHistoryDto>();
    }

    public class OperationsIssueCommentDto
    {
        public Guid Id { get; set; }
        public Guid IssueId { get; set; }
        public string AuthorId { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string AuthorRole { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class OperationsIssueHistoryDto
    {
        public Guid Id { get; set; }
        public Guid IssueId { get; set; }
        public string PerformedBy { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? Details { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class CreateOperationsIssueRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Department { get; set; } = "Production";
        public string Category { get; set; } = "Machine Breakdown";
        public string Priority { get; set; } = "Medium";

        public Guid? MachineId { get; set; }
        public string? MachineName { get; set; }
        public List<Guid>? AffectedMachineIds { get; set; }
        public List<string>? AffectedMachineNames { get; set; }
        public Guid? ProductionLineId { get; set; }
        public string? ProductionLineName { get; set; }
        public Guid? BatchId { get; set; }
        public string? BatchNumber { get; set; }
        public Guid? ProductId { get; set; }
        public string? ProductName { get; set; }
        public Guid? StationId { get; set; }
        public string? StationName { get; set; }
        public Guid? ProductionSessionId { get; set; }
        public Guid? ShiftId { get; set; }
        public bool RequiresImmediateStop { get; set; }

        public DateTime? DueDate { get; set; }
        public decimal? EstimatedCost { get; set; }
        public int? DowntimeMinutes { get; set; }
        public bool RequiresMaintenance { get; set; }
        public string? Attachments { get; set; }
    }

    public class OperatorBatchReportIssueRequest
    {
        public string Category { get; set; } = "Machine Breakdown";
        public string Priority { get; set; } = "High";
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool RequiresImmediateStop { get; set; }
        public string? Attachments { get; set; }

        // Context (Auto-Filled)
        public Guid? BatchId { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        public Guid? ProductId { get; set; }
        public string? ProductName { get; set; }
        public Guid? ProductionLineId { get; set; }
        public string? ProductionLineName { get; set; }
        public Guid? MachineId { get; set; }
        public string? MachineName { get; set; }
        public Guid? ShiftId { get; set; }
        public string? ShiftName { get; set; }
        public Guid? StationId { get; set; }
        public string? StationName { get; set; }
        public Guid? ProductionSessionId { get; set; }
    }

    public class QuickOperatorReportRequest
    {
        public string Department { get; set; } = "Production";
        public string Category { get; set; } = "Machine Breakdown";
        public string Priority { get; set; } = "High";
        public string Description { get; set; } = string.Empty;
        public Guid? MachineId { get; set; }
        public string? MachineName { get; set; }
        public List<Guid>? AffectedMachineIds { get; set; }
        public List<string>? AffectedMachineNames { get; set; }
        public int? DowntimeMinutes { get; set; }
        public string? Attachments { get; set; }
    }

    public class UpdateOperationsIssueRequest : CreateOperationsIssueRequest
    {
        public string? AssignedToUserId { get; set; }
        public string? AssignedToName { get; set; }
        public string Status { get; set; } = "Open";
    }

    public class ChangeIssueStatusRequest
    {
        public string Status { get; set; } = "InProgress";
        public string? Note { get; set; }
    }

    public class AssignIssueRequest
    {
        public string AssignedToUserId { get; set; } = string.Empty;
        public string AssignedToName { get; set; } = string.Empty;
        public string? Note { get; set; }
    }

    public class AddIssueCommentRequest
    {
        public string Message { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
    }

    public class ResolveIssueRequest
    {
        public string RootCause { get; set; } = string.Empty;
        public string CorrectiveAction { get; set; } = string.Empty;
        public string? PreventiveAction { get; set; }
        public decimal? ActualCost { get; set; }
        public int? DowntimeMinutes { get; set; }
        public string? ResolutionNote { get; set; }
    }

    public class OperationsIssueDashboardDto
    {
        public int TotalIssues { get; set; }
        public int OpenIssues { get; set; }
        public int UnreadIssues { get; set; }
        public int CriticalIssues { get; set; }
        public int OverdueIssues { get; set; }
        public int ResolvedToday { get; set; }
        public int MachineBreakdowns { get; set; }
        public int ProductionStoppages { get; set; }
        public double AvgResolutionTimeHours { get; set; }
        public int TotalDowntimeMinutes { get; set; }

        public List<DepartmentStatDto> DepartmentStats { get; set; } = new List<DepartmentStatDto>();
        public List<PriorityStatDto> PriorityStats { get; set; } = new List<PriorityStatDto>();
        public List<StatusStatDto> StatusStats { get; set; } = new List<StatusStatDto>();
        public List<TopProblemMachineDto> TopProblemMachines { get; set; } = new List<TopProblemMachineDto>();
        public List<OperationsIssueDto> RecentIssues { get; set; } = new List<OperationsIssueDto>();
    }

    public class DepartmentStatDto
    {
        public string Department { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class PriorityStatDto
    {
        public string Priority { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class StatusStatDto
    {
        public string Status { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class TopProblemMachineDto
    {
        public string MachineName { get; set; } = string.Empty;
        public int IssueCount { get; set; }
        public int TotalDowntimeMinutes { get; set; }
    }
}
