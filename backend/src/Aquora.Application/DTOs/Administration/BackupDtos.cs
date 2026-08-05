using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Administration
{
    public class BackupDashboardDto
    {
        public BackupHistoryDto? LastBackup { get; set; }
        public int TotalBackups { get; set; }
        public long StorageUsedBytes { get; set; }
        public string FormattedStorageUsed { get; set; } = "0 B";
        public bool AutomaticBackupEnabled { get; set; } = true;
        public string BackupVersion { get; set; } = "v2.5.0";
        public string DatabaseVersion { get; set; } = string.Empty;
        public DateTime? LastVerificationDate { get; set; }
        public RestoreHistoryDto? LastRestore { get; set; }
        public List<BackupHistoryDto> RecentBackups { get; set; } = new List<BackupHistoryDto>();
        public List<RestoreHistoryDto> RecentRestores { get; set; } = new List<RestoreHistoryDto>();
    }

    public class BackupHistoryDto
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public string SchemaName { get; set; } = string.Empty;
        public string BackupName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Format { get; set; } = "AQB";
        
        public long BackupSize { get; set; }
        public string FormattedSize { get; set; } = "0 B";
        public int RecordCount { get; set; }
        public int TableCount { get; set; }
        public string Checksum { get; set; } = string.Empty;
        public string Hash { get; set; } = string.Empty;
        
        public string TenantName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string EngineVersion { get; set; } = string.Empty;
        public int RestoreCount { get; set; }
        public string Encryption { get; set; } = "None";
        
        public string Status { get; set; } = "COMPLETED";
        public int DownloadCount { get; set; }
        public DateTime? LastDownloaded { get; set; }
        public bool CanRestore { get; set; } = true;
        public bool IsEmergencyBackup { get; set; } = false;
        
        public bool IncludeAttachments { get; set; } = true;
        public bool IncludeAuditLogs { get; set; } = true;
        public bool IncludeUsers { get; set; } = true;

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
    }

    public class RestoreHistoryDto
    {
        public Guid RestoreId { get; set; }
        public Guid BackupId { get; set; }
        public string BackupName { get; set; } = string.Empty;
        public Guid TenantId { get; set; }
        
        public string StartedBy { get; set; } = string.Empty;
        public string StartedByName { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public long DurationMs { get; set; }
        
        public string Status { get; set; } = "SUCCESS";
        public string IPAddress { get; set; } = string.Empty;
        public string? Details { get; set; }
    }

    public class CreateBackupRequest
    {
        public string BackupName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Format { get; set; } = "AQB";
        public bool IncludeAttachments { get; set; } = true;
        public bool IncludeAuditLogs { get; set; } = true;
        public bool IncludeUsers { get; set; } = true;
    }

    public class RestoreBackupRequest
    {
        public string ConfirmationText { get; set; } = string.Empty; // Must be "RESTORE"
    }

    public class BackupStorageStatsDto
    {
        public int TotalBackupsCount { get; set; }
        public long TotalSizeBytes { get; set; }
        public string FormattedTotalSize { get; set; } = "0 B";
        public long FreeDiskSpaceBytes { get; set; }
        public string FormattedFreeDiskSpace { get; set; } = "0 B";
    }

    public class BackupInspectionDto
    {
        public Guid BackupId { get; set; }
        public string BackupName { get; set; } = string.Empty;
        public string TenantName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string Version { get; set; } = string.Empty;
        public string EngineVersion { get; set; } = string.Empty;
        public string Checksum { get; set; } = string.Empty;
        public int TotalTables { get; set; }
        public int TotalRecords { get; set; }
        public long TotalSizeBytes { get; set; }
        public string FormattedTotalSize { get; set; } = "0 B";
        public List<TableInspectionDto> Tables { get; set; } = new List<TableInspectionDto>();
    }

    public class TableInspectionDto
    {
        public string TableName { get; set; } = string.Empty;
        public int Rows { get; set; }
        public int Columns { get; set; }
        public long SizeBytes { get; set; }
        public string FormattedSize { get; set; } = "0 B";
        public DateTime? LastModified { get; set; }
    }

    public class TableDataPreviewDto
    {
        public string TableName { get; set; } = string.Empty;
        public List<string> Columns { get; set; } = new List<string>();
        public List<Dictionary<string, object?>> Rows { get; set; } = new List<Dictionary<string, object?>>();
    }

    public class BackupVerificationDto
    {
        public Guid BackupId { get; set; }
        public bool IsVerified { get; set; }
        public bool ChecksumValid { get; set; }
        public bool EncryptionValid { get; set; }
        public bool ManifestValid { get; set; }
        public bool VersionCompatible { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<string> MissingTables { get; set; } = new List<string>();
    }

    public class RestorePreviewDto
    {
        public Guid BackupId { get; set; }
        public DateTime BackupDate { get; set; }
        public string Version { get; set; } = string.Empty;
        public int BackupTables { get; set; }
        public int BackupRecords { get; set; }
        public long BackupStorage { get; set; }
        
        public int CurrentTables { get; set; }
        public int CurrentRecords { get; set; }
        public long CurrentStorage { get; set; }
        
        public bool IsCompatible { get; set; }
        public List<string> Warnings { get; set; } = new List<string>();
    }
}
