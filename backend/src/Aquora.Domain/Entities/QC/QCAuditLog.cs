using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.QC
{
    public class QCAuditLog : BaseEntity, IMultiTenant, ICompanySpecific
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public Guid? ReportId { get; set; }
        public string? ReportNumber { get; set; }
        public string Action { get; set; } = string.Empty; // CREATE, EDIT, SUBMIT, INCUBATION_COMPLETE, ATTACHMENT_UPLOAD, PRINT, PDF_EXPORT
        public string PerformedBy { get; set; } = string.Empty;
        public string? UserRole { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public string Details { get; set; } = string.Empty;
        public string? OldValues { get; set; } // JSON
        public string? NewValues { get; set; } // JSON
        public string? IPAddress { get; set; }
        public string? UserAgent { get; set; }
    }
}
