using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Administration
{
    public class RestoreHistory : BaseEntity, IMultiTenant, IAuditable
    {
        public Guid TenantId { get; set; }
        public Guid BackupId { get; set; }
        public string SchemaName { get; set; } = string.Empty;
        
        public string StartedBy { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
        public long DurationMs { get; set; }
        
        public string Status { get; set; } = "SUCCESS"; // SUCCESS, FAILED, IN_PROGRESS
        public string IPAddress { get; set; } = string.Empty;
        public string? Details { get; set; }

        // Auditable fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
