using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs.Administration;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities.Administration;

namespace Aquora.Application.Services
{
    public class PlatformBackupService : IPlatformBackupService
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly IPlatformBackupJobManager _jobManager;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<PlatformBackupService> _logger;

        public PlatformBackupService(
            IPlatformDbContext platformContext,
            IPlatformBackupJobManager jobManager,
            ICurrentUserContext currentUserContext,
            IServiceScopeFactory serviceScopeFactory,
            ILogger<PlatformBackupService> logger)
        {
            _platformContext = platformContext;
            _jobManager = jobManager;
            _currentUserContext = currentUserContext;
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        public async Task<PlatformBackupJobStatusDto> QueuePlatformBackupAsync(CreatePlatformBackupRequest request)
        {
            var job = _jobManager.CreateJob(request.Mode ?? "FULL_PLATFORM");
            var currentUserId = _currentUserContext.UserId ?? "SuperAdmin";
            var currentUserName = _currentUserContext.Email ?? _currentUserContext.UserId ?? "Platform Super Admin";

            // Resolve target schemas within the active request context
            var targetSchemas = new List<string>();
            bool includePublic = request.Mode == "FULL_PLATFORM" || request.Mode == "PUBLIC_ONLY";

            if (request.Mode == "FULL_PLATFORM")
            {
                var tenants = await _platformContext.Tenants.Where(t => !t.IsDeleted).ToListAsync();
                targetSchemas.AddRange(tenants.Select(t => t.SchemaName));
            }
            else if (request.Mode == "SINGLE_TENANT" && request.TargetTenantId.HasValue)
            {
                var tenant = await _platformContext.Tenants.FirstOrDefaultAsync(t => t.Id == request.TargetTenantId.Value);
                if (tenant != null) targetSchemas.Add(tenant.SchemaName);
            }
            else if (request.Mode == "MULTIPLE_TENANT" && request.SelectedTenantIds != null && request.SelectedTenantIds.Any())
            {
                var tenants = await _platformContext.Tenants.Where(t => request.SelectedTenantIds.Contains(t.Id)).ToListAsync();
                targetSchemas.AddRange(tenants.Select(t => t.SchemaName));
            }

            // Run backup job in a completely independent background scope
            _ = Task.Run(async () =>
            {
                var backupId = Guid.NewGuid();
                var now = DateTime.UtcNow;
                var backupName = string.IsNullOrWhiteSpace(request.BackupName)
                    ? $"Platform_{request.Mode}_{now:yyyyMMdd_HHmmss}"
                    : request.BackupName.Trim();

                try
                {
                    _logger.LogInformation("[BACKUP_SERVICE] Starting platform backup job {JobId} for backup '{BackupName}' (Mode: {Mode})", job.JobId, backupName, request.Mode);

                    using var scope = _serviceScopeFactory.CreateScope();
                    var engine = scope.ServiceProvider.GetRequiredService<IPlatformBackupEngine>();
                    var platformContext = scope.ServiceProvider.GetRequiredService<IPlatformDbContext>();

                    var zipBytes = await engine.BuildPlatformBackupZipAsync(
                        job.JobId,
                        backupId,
                        backupName,
                        currentUserId,
                        currentUserName,
                        targetSchemas,
                        includePublic,
                        request.Encrypted
                    );

                    var folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Backups", "Platform", now.ToString("yyyy"), now.ToString("MM"));
                    Directory.CreateDirectory(folderPath);
                    var filePath = Path.Combine(folderPath, $"{backupId}.zip");

                    _logger.LogInformation("[BACKUP_SERVICE] Writing backup ZIP payload ({Bytes} bytes) to '{FilePath}'", zipBytes.Length, filePath);
                    await File.WriteAllBytesAsync(filePath, zipBytes);

                    // ATOMIC LIFECYCLE VERIFICATION
                    if (!File.Exists(filePath) || new FileInfo(filePath).Length == 0)
                    {
                        throw new InvalidOperationException($"Backup artifact file could not be verified on disk at '{filePath}'.");
                    }

                    _logger.LogInformation("[BACKUP_SERVICE] Verifying manifest and integrity of generated ZIP package...");
                    var verifiedManifest = await engine.ReadManifestFromZipAsync(zipBytes);
                    if (verifiedManifest == null)
                    {
                        throw new InvalidOperationException("Generated platform backup manifest is unreadable or corrupted.");
                    }

                    string checksum = ComputeSHA256(zipBytes);

                    var backupEntity = new BackupHistory
                    {
                        Id = backupId,
                        TenantId = Guid.Empty,
                        SchemaName = "platform",
                        BackupName = backupName,
                        Description = request.Notes ?? $"Platform Disaster Recovery Backup ({request.Mode})",
                        Format = "ZIP",
                        BackupSize = zipBytes.Length,
                        RecordCount = verifiedManifest.TotalRecords,
                        TableCount = verifiedManifest.TotalTables,
                        Checksum = checksum,
                        Hash = checksum,
                        FilePath = filePath,
                        Status = "COMPLETED",
                        CanRestore = true,
                        IsEmergencyBackup = false,
                        CreatedAt = now,
                        CreatedBy = currentUserId
                    };

                    platformContext.BackupHistories.Add(backupEntity);
                    await platformContext.SaveChangesAsync();

                    _logger.LogInformation("[BACKUP_SERVICE] Backup history record persisted successfully for {BackupId}. Job COMPLETED.", backupId);
                    _jobManager.CompleteJob(job.JobId, backupId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[BACKUP_SERVICE] Failed platform backup job {JobId}: {ErrorMessage}", job.JobId, ex.Message);
                    _jobManager.FailJob(job.JobId, ex.Message);
                }
            });

            return job;
        }

        public Task<PlatformBackupJobStatusDto?> GetJobStatusAsync(Guid jobId)
        {
            return Task.FromResult(_jobManager.GetJobStatus(jobId));
        }

        public async Task<List<PlatformBackupHistoryDto>> GetPlatformBackupHistoryAsync()
        {
            var list = await _platformContext.BackupHistories
                .Where(h => h.SchemaName == "platform" && !h.IsDeleted)
                .OrderByDescending(h => h.CreatedAt)
                .ToListAsync();

            return list.Select(h => new PlatformBackupHistoryDto
            {
                Id = h.Id,
                BackupName = h.BackupName,
                Mode = h.Description.Contains("FULL_PLATFORM") ? "FULL_PLATFORM" : "PLATFORM",
                Description = h.Description,
                BackupSize = h.BackupSize,
                FormattedSize = FormatBytes(h.BackupSize),
                RecordCount = h.RecordCount,
                TableCount = h.TableCount,
                SchemaCount = h.TableCount,
                TenantCount = h.TableCount,
                Checksum = h.Checksum,
                Status = h.Status,
                Format = h.Format ?? "ZIP",
                CreatedAt = h.CreatedAt,
                CreatedBy = h.CreatedBy,
                CreatedByName = h.CreatedBy
            }).ToList();
        }

        public async Task<PlatformBackupManifestDto?> InspectPlatformBackupAsync(Guid id)
        {
            var entity = await _platformContext.BackupHistories.FirstOrDefaultAsync(h => h.Id == id && !h.IsDeleted);
            if (entity == null)
            {
                throw new KeyNotFoundException("Platform backup record not found.");
            }

            string? filePath = ResolveBackupFilePath(entity);
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                _logger.LogWarning("Inspect failed for backup {BackupId}: ZIP file missing from disk", id);
                throw new KeyNotFoundException("Backup file is no longer available on server.");
            }

            using var scope = _serviceScopeFactory.CreateScope();
            var engine = scope.ServiceProvider.GetRequiredService<IPlatformBackupEngine>();

            byte[] zipBytes = await File.ReadAllBytesAsync(filePath);
            var manifest = await engine.ReadManifestFromZipAsync(zipBytes);
            if (manifest == null)
            {
                throw new InvalidOperationException("Platform backup manifest is invalid or corrupted.");
            }

            return manifest;
        }

        public async Task<PlatformSchemaPreviewDto?> GetPlatformSchemaPreviewAsync(Guid id, string schemaName)
        {
            var entity = await _platformContext.BackupHistories.FirstOrDefaultAsync(h => h.Id == id && !h.IsDeleted);
            if (entity == null)
            {
                return new PlatformSchemaPreviewDto
                {
                    BackupId = id,
                    SchemaName = schemaName,
                    IsPreviewAvailable = false,
                    Message = "Platform backup record not found."
                };
            }

            string? filePath = ResolveBackupFilePath(entity);
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                return new PlatformSchemaPreviewDto
                {
                    BackupId = id,
                    SchemaName = schemaName,
                    IsPreviewAvailable = false,
                    Message = "Backup file is no longer available on server."
                };
            }

            try
            {
                using var fileStream = File.OpenRead(filePath);
                using var archive = new System.IO.Compression.ZipArchive(fileStream, System.IO.Compression.ZipArchiveMode.Read);

                string previewEntryPath = schemaName.Equals("public", StringComparison.OrdinalIgnoreCase)
                    ? "public/preview.json"
                    : $"{schemaName}/preview.json";

                var previewEntry = archive.GetEntry(previewEntryPath);
                if (previewEntry == null)
                {
                    return new PlatformSchemaPreviewDto
                    {
                        BackupId = id,
                        SchemaName = schemaName,
                        IsPreviewAvailable = false,
                        Message = "This backup package does not include preview data for this schema."
                    };
                }

                using var reader = new StreamReader(previewEntry.Open(), System.Text.Encoding.UTF8);
                string json = await reader.ReadToEndAsync();
                var tablesData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, List<Dictionary<string, object>>>>(json)
                    ?? new Dictionary<string, List<Dictionary<string, object>>>();

                var tableNames = tablesData.Keys.OrderBy(k => k).ToList();
                var recordCounts = tablesData.ToDictionary(k => k.Key, k => k.Value.Count);

                return new PlatformSchemaPreviewDto
                {
                    BackupId = id,
                    SchemaName = schemaName,
                    IsPreviewAvailable = true,
                    TableNames = tableNames,
                    TablesData = tablesData,
                    TableTotalRecordCounts = recordCounts
                };
            }
            catch (Exception ex)
            {
                return new PlatformSchemaPreviewDto
                {
                    BackupId = id,
                    SchemaName = schemaName,
                    IsPreviewAvailable = false,
                    Message = $"Failed to parse schema preview data: {ex.Message}"
                };
            }
        }

        public async Task<(byte[] FileBytes, string ContentType, string FileName)> DownloadPlatformBackupAsync(Guid id)
        {
            var entity = await _platformContext.BackupHistories.FirstOrDefaultAsync(h => h.Id == id && !h.IsDeleted);
            if (entity == null)
            {
                throw new KeyNotFoundException("Platform backup record not found.");
            }

            string? filePath = ResolveBackupFilePath(entity);
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                throw new KeyNotFoundException("Backup file is no longer available on server.");
            }

            entity.DownloadCount++;
            entity.LastDownloaded = DateTime.UtcNow;
            await _platformContext.SaveChangesAsync();

            byte[] bytes = await File.ReadAllBytesAsync(filePath);
            string fileName = $"{entity.BackupName.Replace(" ", "_")}.zip";
            return (bytes, "application/zip", fileName);
        }

        public async Task<PlatformRestorePreviewDto> PreviewPlatformRestoreAsync(Guid id)
        {
            var manifest = await InspectPlatformBackupAsync(id);
            if (manifest == null)
            {
                throw new KeyNotFoundException("Cannot read backup manifest.");
            }

            var currentTenants = await _platformContext.Tenants.Where(t => !t.IsDeleted).ToListAsync();
            var targetSchemas = manifest.Schemas.Select(s => s.SchemaName).ToList();

            var warnings = new List<string>();
            if (manifest.PublicIncluded)
            {
                warnings.Add("CRITICAL: Public schema contains platform identity & global settings. Restoring public schema will impact active user sessions.");
            }
            if (targetSchemas.Count > 1)
            {
                warnings.Add($"Restoring in REPLACE MODE will drop and recreate {targetSchemas.Count} tenant schemas.");
            }

            return new PlatformRestorePreviewDto
            {
                BackupId = id,
                BackupDate = manifest.BackupDate,
                Mode = manifest.TenantCount > 1 ? "FULL_PLATFORM" : "SELECTED_SCHEMAS",
                BackupSchemas = manifest.SchemaCount,
                BackupTables = manifest.TotalTables,
                BackupRecords = manifest.TotalRecords,
                BackupSize = manifest.DatabaseSizeBytes,
                CurrentActiveSchemas = currentTenants.Count + 1,
                CurrentActiveTables = manifest.TotalTables,
                CurrentActiveRecords = manifest.TotalRecords,
                IsVerified = true,
                Warnings = warnings,
                TargetSchemas = targetSchemas
            };
        }

        public async Task RestorePlatformBackupAsync(Guid id, PlatformRestoreRequest request)
        {
            if (!string.Equals(request.ConfirmationText, "RESTORE", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Confirmation text must equal 'RESTORE' to proceed.");
            }

            var entity = await _platformContext.BackupHistories.FirstOrDefaultAsync(h => h.Id == id && !h.IsDeleted);
            if (entity == null)
            {
                throw new KeyNotFoundException("Platform backup record not found.");
            }

            string? filePath = ResolveBackupFilePath(entity);
            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                throw new KeyNotFoundException("Backup file is no longer available on server.");
            }

            using var scope = _serviceScopeFactory.CreateScope();
            var engine = scope.ServiceProvider.GetRequiredService<IPlatformBackupEngine>();

            byte[] zipBytes = await File.ReadAllBytesAsync(filePath);
            var manifest = await engine.ReadManifestFromZipAsync(zipBytes);
            if (manifest == null)
            {
                throw new InvalidOperationException("Invalid platform backup archive: missing or corrupted manifest.json.");
            }

            var schemasToRestore = request.TargetSchemas != null && request.TargetSchemas.Any()
                ? request.TargetSchemas
                : manifest.Schemas.Select(s => s.SchemaName).ToList();

            await engine.RestorePlatformZipAsync(zipBytes, schemasToRestore);
        }

        public async Task<bool> DeletePlatformBackupAsync(Guid id)
        {
            var entity = await _platformContext.BackupHistories.FirstOrDefaultAsync(h => h.Id == id && !h.IsDeleted);
            if (entity == null) return false;

            entity.IsDeleted = true;
            entity.DeletedAt = DateTime.UtcNow;

            string? filePath = ResolveBackupFilePath(entity);
            if (!string.IsNullOrEmpty(filePath) && File.Exists(filePath))
            {
                try { File.Delete(filePath); } catch { }
            }

            await _platformContext.SaveChangesAsync();
            return true;
        }

        public async Task<List<PlatformTenantListDto>> GetPlatformTenantsAsync()
        {
            var list = await _platformContext.Tenants
                .Where(t => !t.IsDeleted)
                .OrderBy(t => t.Name)
                .ToListAsync();

            return list.Select(t => new PlatformTenantListDto
            {
                TenantId = t.Id,
                CompanyCode = t.Code,
                CompanyName = t.Name,
                SchemaName = t.SchemaName,
                IsInitialized = t.IsInitialized,
                Status = t.Status
            }).ToList();
        }

        private static string? ResolveBackupFilePath(BackupHistory entity)
        {
            if (entity == null) return null;

            var candidatePaths = new List<string>();

            if (!string.IsNullOrWhiteSpace(entity.FilePath))
            {
                candidatePaths.Add(entity.FilePath);
                if (!Path.IsPathRooted(entity.FilePath))
                {
                    candidatePaths.Add(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, entity.FilePath));
                    candidatePaths.Add(Path.Combine(Directory.GetCurrentDirectory(), entity.FilePath));
                }
            }

            var dateFolder = entity.CreatedAt == default ? DateTime.UtcNow : entity.CreatedAt;
            candidatePaths.Add(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Backups", "Platform", dateFolder.ToString("yyyy"), dateFolder.ToString("MM"), $"{entity.Id}.zip"));
            candidatePaths.Add(Path.Combine(Directory.GetCurrentDirectory(), "Backups", "Platform", dateFolder.ToString("yyyy"), dateFolder.ToString("MM"), $"{entity.Id}.zip"));
            candidatePaths.Add(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Backups", "Platform", $"{entity.Id}.zip"));
            candidatePaths.Add(Path.Combine(Directory.GetCurrentDirectory(), "Backups", "Platform", $"{entity.Id}.zip"));

            foreach (var path in candidatePaths)
            {
                if (File.Exists(path))
                {
                    return path;
                }
            }

            var rootBackupDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Backups");
            if (Directory.Exists(rootBackupDir))
            {
                var files = Directory.GetFiles(rootBackupDir, $"{entity.Id}.zip", SearchOption.AllDirectories);
                if (files.Length > 0) return files[0];
            }

            var cwdBackupDir = Path.Combine(Directory.GetCurrentDirectory(), "Backups");
            if (Directory.Exists(cwdBackupDir))
            {
                var files = Directory.GetFiles(cwdBackupDir, $"{entity.Id}.zip", SearchOption.AllDirectories);
                if (files.Length > 0) return files[0];
            }

            return null;
        }

        private static string ComputeSHA256(byte[] bytes)
        {
            using var sha = SHA256.Create();
            byte[] hash = sha.ComputeHash(bytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static string FormatBytes(long bytes, int decimals = 2)
        {
            if (bytes <= 0) return "0 B";
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int i = (int)Math.Floor(Math.Log(bytes, 1024));
            return $"{Math.Round(bytes / Math.Pow(1024, i), decimals)} {suffixes[i]}";
        }
    }
}

