using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.Administration
{
    public class CreatePlatformBackupRequest
    {
        public string BackupName { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public string Mode { get; set; } = "FULL_PLATFORM"; // FULL_PLATFORM, SINGLE_TENANT, MULTIPLE_TENANT, PUBLIC_ONLY
        public Guid? TargetTenantId { get; set; }
        public List<Guid> SelectedTenantIds { get; set; } = new List<Guid>();
        public bool Encrypted { get; set; } = true;
    }

    public class PlatformBackupJobStatusDto
    {
        public Guid JobId { get; set; }
        public string Mode { get; set; } = string.Empty;
        public string Status { get; set; } = "Queued"; // Queued, Preparing, Reading, Compressing, Encrypting, Writing, Completed, Failed
        public int ProgressPercentage { get; set; } = 0;
        public string CurrentStepMessage { get; set; } = string.Empty;
        public Guid? BackupId { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
    }

    public class PlatformBackupManifestDto
    {
        public Guid BackupId { get; set; }
        public string BackupName { get; set; } = string.Empty;
        public string PlatformVersion { get; set; } = "2026.1";
        public string DatabaseVersion { get; set; } = "PostgreSQL 16";
        public string EngineVersion { get; set; } = "v2.5.0";
        public DateTime BackupDate { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
        public string CreatedMachine { get; set; } = string.Empty;
        public string CreatedIP { get; set; } = string.Empty;
        public int TenantCount { get; set; }
        public int SchemaCount { get; set; }
        public bool PublicIncluded { get; set; } = true;
        public bool Encrypted { get; set; } = true;
        public string Checksum { get; set; } = string.Empty;
        public int TotalTables { get; set; }
        public int TotalRecords { get; set; }
        public long DatabaseSizeBytes { get; set; }
        public string FormattedDatabaseSize { get; set; } = "0 B";
        public long FileSizeBytes { get; set; }
        public string FormattedFileSize { get; set; } = "0 B";
        public List<PlatformSchemaMetaDto> Schemas { get; set; } = new List<PlatformSchemaMetaDto>();
    }

    public class PlatformSchemaMetaDto
    {
        public string SchemaName { get; set; } = string.Empty;
        public string TenantName { get; set; } = string.Empty;
        public int TablesCount { get; set; }
        public int RecordsCount { get; set; }
        public long SizeBytes { get; set; }
        public string FormattedSize { get; set; } = "0 B";
        public string SqlFileName { get; set; } = string.Empty;
    }

    public class PlatformBackupHistoryDto
    {
        public Guid Id { get; set; }
        public string BackupName { get; set; } = string.Empty;
        public string Mode { get; set; } = "FULL_PLATFORM";
        public string Description { get; set; } = string.Empty;
        public long BackupSize { get; set; }
        public string FormattedSize { get; set; } = "0 B";
        public int RecordCount { get; set; }
        public int TableCount { get; set; }
        public int SchemaCount { get; set; }
        public int TenantCount { get; set; }
        public string Checksum { get; set; } = string.Empty;
        public string Status { get; set; } = "COMPLETED";
        public string Format { get; set; } = "ZIP";
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
    }

    public class PlatformTenantListDto
    {
        public Guid TenantId { get; set; }
        public string CompanyCode { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string SchemaName { get; set; } = string.Empty;
        public bool IsInitialized { get; set; }
        public string Status { get; set; } = "ACTIVE";
    }

    public class PlatformRestorePreviewDto
    {
        public Guid BackupId { get; set; }
        public DateTime BackupDate { get; set; }
        public string Mode { get; set; } = "FULL_PLATFORM";
        public int BackupSchemas { get; set; }
        public int BackupTables { get; set; }
        public int BackupRecords { get; set; }
        public long BackupSize { get; set; }
        public int CurrentActiveSchemas { get; set; }
        public int CurrentActiveTables { get; set; }
        public int CurrentActiveRecords { get; set; }
        public bool IsVerified { get; set; } = true;
        public List<string> Warnings { get; set; } = new List<string>();
        public List<string> TargetSchemas { get; set; } = new List<string>();
    }

    public class PlatformRestoreRequest
    {
        public string ConfirmationText { get; set; } = string.Empty; // Must be "RESTORE"
        public string RestoreMode { get; set; } = "FULL_PLATFORM"; // FULL_PLATFORM, SINGLE_TENANT, SELECTED_SCHEMAS
        public List<string> TargetSchemas { get; set; } = new List<string>();
    }

    public class PlatformSchemaPreviewDto
    {
        public Guid BackupId { get; set; }
        public string SchemaName { get; set; } = string.Empty;
        public bool IsPreviewAvailable { get; set; }
        public string? Message { get; set; }
        public List<string> TableNames { get; set; } = new List<string>();
        public Dictionary<string, List<Dictionary<string, object>>> TablesData { get; set; } = new Dictionary<string, List<Dictionary<string, object>>>();
        public Dictionary<string, int> TableTotalRecordCounts { get; set; } = new Dictionary<string, int>();
    }
}
