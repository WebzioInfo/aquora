using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Operations
{
    public class OperationsIssueHistory : BaseEntity
    {
        public Guid IssueId { get; set; }
        public virtual OperationsIssue Issue { get; set; } = null!;

        public string PerformedBy { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty; // CREATED, ACKNOWLEDGED, ASSIGNED, PRIORITY_CHANGED, STATUS_CHANGED, WORK_ORDER_CREATED, RESOLVED, VERIFIED, CLOSED, REOPENED
        public string? Details { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
