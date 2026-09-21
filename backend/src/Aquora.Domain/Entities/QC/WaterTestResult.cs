using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.QC
{
    public class WaterTestResult : BaseEntity, IAuditable
    {
        public Guid ReportId { get; set; }
        public virtual WaterTestReport Report { get; set; } = null!;

        public Guid ParameterId { get; set; }
        public virtual WaterTestParameter Parameter { get; set; } = null!;

        public double? Value { get; set; }
        public string? StringValue { get; set; }
        public bool IsPass { get; set; }
        public string QualityStatus { get; set; } = "PASS"; // PASS, WARNING, FAIL, PENDING

        // Time-based incubation & result lifecycle
        public int RequiredDurationHours { get; set; } = 0; // 0 for immediate, 24/48/72 for incubation/delayed
        public DateTime? StartedAt { get; set; }
        public DateTime? ExpectedCompletionAt { get; set; }
        public DateTime? ActualCompletedAt { get; set; }
        public string ResultStatus { get; set; } = "COMPLETED"; // NOT_STARTED, IN_PROGRESS, PENDING_RESULT, OVERDUE, COMPLETED, NOT_APPLICABLE

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
