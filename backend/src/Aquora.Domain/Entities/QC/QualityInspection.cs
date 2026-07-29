using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.QC
{
    public class QualityInspection : BaseEntity, IAuditable
    {
        public Guid Id { get; set; }
        public Guid ProductionBatchId { get; set; }
        public DateTime InspectionDate { get; set; }
        public string InspectorName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // "Pass", "Fail", "Pending"
        public string Remarks { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
