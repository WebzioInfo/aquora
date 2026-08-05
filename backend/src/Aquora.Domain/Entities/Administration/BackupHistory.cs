using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Administration
{
    public class BackupHistory : BaseEntity, IMultiTenant, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public string SchemaName { get; set; } = string.Empty;
        public string BackupName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        
        public long BackupSize { get; set; }
        public int RecordCount { get; set; }
        public string Checksum { get; set; } = string.Empty;
        public string Hash { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        
        public string? Format { get; set; } = "AQB"; // AQB, SQL_FULL, SQL_SCHEMA, SQL_DATA, JSON, CSV
        
        public string? TenantName { get; set; } = string.Empty;
        public string? Version { get; set; } = "1.0.0";
        public int TableCount { get; set; } = 0;
        public string? EngineVersion { get; set; } = "2026.1";
        public int RestoreCount { get; set; } = 0;
        public string? Encryption { get; set; } = "AES-256"; // Or "None"

        public string Status { get; set; } = "COMPLETED"; // COMPLETED, FAILED, RESTORED
        public int DownloadCount { get; set; } = 0;
        public DateTime? LastDownloaded { get; set; }
        public bool CanRestore { get; set; } = true;
        public bool IsEmergencyBackup { get; set; } = false;
        
        public bool IncludeAttachments { get; set; } = true;
        public bool IncludeAuditLogs { get; set; } = true;
        public bool IncludeUsers { get; set; } = true;

        // Auditable fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        // Soft Delete fields
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
