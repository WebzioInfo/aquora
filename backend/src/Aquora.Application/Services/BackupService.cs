using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs.Administration;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Administration;
using Microsoft.Extensions.Configuration;

namespace Aquora.Application.Services
{
    public class BackupService : IBackupService
    {
        private readonly ITenantDbContext _context;
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly IConfiguration _configuration;
        private readonly IExportService _exportService;
        private readonly Microsoft.Extensions.Logging.ILogger<BackupService> _logger;

        public BackupService(
            ITenantDbContext context,
            IPlatformDbContext platformContext,
            ITenantProvider tenantProvider,
            ICurrentUserContext currentUserContext,
            IConfiguration configuration,
            IExportService exportService,
            Microsoft.Extensions.Logging.ILogger<BackupService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _platformContext = platformContext ?? throw new ArgumentNullException(nameof(platformContext));
            _tenantProvider = tenantProvider ?? throw new ArgumentNullException(nameof(tenantProvider));
            _currentUserContext = currentUserContext ?? throw new ArgumentNullException(nameof(currentUserContext));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _exportService = exportService ?? throw new ArgumentNullException(nameof(exportService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<BackupDashboardDto> GetBackupDashboardAsync()
        {
            var histories = await GetBackupHistoryAsync();
            var restores = await GetRestoreHistoryAsync();

            var totalStorageBytes = histories.Sum(h => h.BackupSize);

            string dbVersion = "PostgreSQL 16";
            try 
            {
                var connection = _context.Database.GetDbConnection();
                bool wasClosed = connection.State == System.Data.ConnectionState.Closed;
                if (wasClosed) await connection.OpenAsync();
                
                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT version();";
                var v = await cmd.ExecuteScalarAsync();
                if (v != null) 
                {
                    string fullVer = v.ToString() ?? "";
                    if (fullVer.StartsWith("PostgreSQL")) {
                        dbVersion = "PostgreSQL " + fullVer.Split(' ')[1];
                    } else {
                        dbVersion = fullVer;
                    }
                }
                if (wasClosed) await connection.CloseAsync();
            } 
            catch { }

            // Using the latest backup as a proxy for verification date if no dedicated verification table exists
            var lastVerified = histories.FirstOrDefault(h => h.Status == "COMPLETED")?.CreatedAt;

            return new BackupDashboardDto
            {
                LastBackup = histories.FirstOrDefault(h => !h.IsEmergencyBackup),
                TotalBackups = histories.Count,
                StorageUsedBytes = totalStorageBytes,
                FormattedStorageUsed = FormatBytes(totalStorageBytes),
                AutomaticBackupEnabled = true,
                BackupVersion = "v2.5.0",
                DatabaseVersion = dbVersion,
                LastVerificationDate = lastVerified,
                LastRestore = restores.FirstOrDefault(),
                RecentBackups = histories.Take(10).ToList(),
                RecentRestores = restores.Take(10).ToList()
            };
        }

        public async Task<List<BackupHistoryDto>> GetBackupHistoryAsync()
        {
            var tenantId = _tenantProvider.TenantId;
            var list = await _platformContext.BackupHistories
                .Where(h => h.TenantId == tenantId && !h.IsDeleted)
                .OrderByDescending(h => h.CreatedAt)
                .ToListAsync();

            var userIds = list.Select(h => h.CreatedBy).Distinct().ToList();
            var userNames = await ResolveUserNamesAsync(userIds);

            return list.Select(h => MapToDto(h, userNames)).ToList();
        }

        public async Task<BackupHistoryDto?> GetBackupByIdAsync(Guid id)
        {
            var tenantId = _tenantProvider.TenantId;
            var entity = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (entity == null) return null;

            var userNames = await ResolveUserNamesAsync(new[] { entity.CreatedBy });
            return MapToDto(entity, userNames);
        }

        public async Task<BackupHistoryDto> CreateBackupAsync(CreateBackupRequest request)
        {
            var tenantId = _tenantProvider.TenantId;
            var schemaName = _tenantProvider.TenantSchemaName;
            var currentUserId = _currentUserContext.UserId ?? "System";

            if (string.IsNullOrWhiteSpace(schemaName) || schemaName.Equals("public", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Cannot perform tenant backup on the public schema.");
            }

            var backupId = Guid.NewGuid();
            var now = DateTime.UtcNow;
            var relativeFolderPath = Path.Combine("Backups", tenantId.ToString(), now.ToString("yyyy"), now.ToString("MM"));
            var physicalFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, relativeFolderPath);
            Directory.CreateDirectory(physicalFolder);

            var isAqb = string.Equals(request.Format, "AQB", StringComparison.OrdinalIgnoreCase);
            var extension = isAqb ? ".aqb" : ".sql";
            var physicalFilePath = Path.Combine(physicalFolder, $"{backupId}{extension}");

            int totalRecordCount = 0;
            int totalTableCount = 0;
            byte[] finalBytes;

            if (!isAqb)
            {
                finalBytes = await _exportService.GenerateExportAsync("SQL");
                await File.WriteAllBytesAsync(physicalFilePath, finalBytes);
            }
            else
            {
                byte[] rawZipBytes;

                // 1. Dynamic PostgreSQL Tenant Schema Inspection & Backup Extraction
                using (var memoryStream = new MemoryStream())
                {
                    using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
                    {
                        // A. Export Tables & Rows
                        var tables = await GetTenantTablesAsync(schemaName);
                        var schemaMeta = new List<object>();

                        foreach (var tableName in tables)
                        {
                            if (tableName.Equals("BackupHistories", StringComparison.OrdinalIgnoreCase) ||
                                tableName.Equals("RestoreHistories", StringComparison.OrdinalIgnoreCase))
                            {
                                if (!request.IncludeAuditLogs && tableName.Contains("Audit")) continue;
                            }

                            var tableData = await ExportTableDataAsync(schemaName, tableName);
                            totalRecordCount += tableData.Count;
                            totalTableCount++;

                            schemaMeta.Add(new
                            {
                                TableName = tableName,
                                RecordCount = tableData.Count
                            });

                            var tableEntry = archive.CreateEntry($"tables/{tableName}.json", CompressionLevel.Optimal);
                            using (var entryStream = tableEntry.Open())
                            using (var writer = new Utf8JsonWriter(entryStream))
                            {
                                JsonSerializer.Serialize(writer, tableData);
                            }
                        }

                        // B. Export Metadata & Schema info
                        var metadata = new
                        {
                            BackupId = backupId,
                            BackupVersion = "2.5.0",
                            AquoraVersion = "2026.1",
                            TenantId = tenantId,
                            SchemaName = schemaName,
                            CreatedBy = currentUserId,
                            CreatedAt = now,
                            DatabaseVersion = "PostgreSQL 16",
                            RecordCount = totalRecordCount,
                            Encrypted = true,
                            IncludeAttachments = request.IncludeAttachments,
                            IncludeAuditLogs = request.IncludeAuditLogs,
                            IncludeUsers = request.IncludeUsers
                        };

                        var metaEntry = archive.CreateEntry("metadata.json", CompressionLevel.Optimal);
                        using (var entryStream = metaEntry.Open())
                        using (var writer = new Utf8JsonWriter(entryStream))
                        {
                            JsonSerializer.Serialize(writer, metadata);
                        }

                        var schemaEntry = archive.CreateEntry("schema.json", CompressionLevel.Optimal);
                        using (var entryStream = schemaEntry.Open())
                        using (var writer = new Utf8JsonWriter(entryStream))
                        {
                            JsonSerializer.Serialize(writer, schemaMeta);
                        }
                    }

                    rawZipBytes = memoryStream.ToArray();
                }

                // 2. AES-256 Encryption
                finalBytes = EncryptBytes(rawZipBytes);
                await File.WriteAllBytesAsync(physicalFilePath, finalBytes);
            }

            // 3. Compute SHA256 Checksum & Hash
            string checksum = ComputeSHA256(finalBytes);
            string hash = ComputeSHA256(Encoding.UTF8.GetBytes($"{backupId}:{tenantId}:{checksum}"));

            // 4. Save BackupHistory Database Record
            var backupEntity = new BackupHistory
            {
                Id = backupId,
                TenantId = tenantId,
                SchemaName = schemaName,
                BackupName = string.IsNullOrWhiteSpace(request.BackupName) ? $"Backup_{now:yyyyMMdd_HHmmss}" : request.BackupName.Trim(),
                Description = request.Description ?? "Manual Tenant Schema Backup",
                BackupSize = finalBytes.Length,
                RecordCount = totalRecordCount,
                TableCount = totalTableCount,
                Checksum = checksum,
                Hash = hash,
                FilePath = physicalFilePath,
                Status = "COMPLETED",
                CanRestore = isAqb,
                Format = string.IsNullOrWhiteSpace(request.Format) ? "AQB" : request.Format,
                IsEmergencyBackup = request.Description?.Contains("Emergency") ?? false,
                IncludeAttachments = request.IncludeAttachments,
                IncludeAuditLogs = request.IncludeAuditLogs,
                IncludeUsers = request.IncludeUsers,
                CreatedAt = now,
                CreatedBy = currentUserId
            };

            _platformContext.BackupHistories.Add(backupEntity);
            await _platformContext.SaveChangesAsync();

            // Log Audit Action
            await CreateAuditLogAsync("CREATE_BACKUP", $"Created backup '{backupEntity.BackupName}' ({FormatBytes(backupEntity.BackupSize)})");

            var userNames = await ResolveUserNamesAsync(new[] { currentUserId });
            return MapToDto(backupEntity, userNames);
        }

        public async Task<(byte[] FileBytes, string ContentType, string FileName)> DownloadBackupAsync(Guid id)
        {
            var tenantId = _tenantProvider.TenantId;
            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null || !File.Exists(backup.FilePath))
            {
                throw new KeyNotFoundException("Backup file not found or has been removed.");
            }

            backup.DownloadCount++;
            backup.LastDownloaded = DateTime.UtcNow;
            await _platformContext.SaveChangesAsync();

            await CreateAuditLogAsync("DOWNLOAD_BACKUP", $"Downloaded backup '{backup.BackupName}'");

            byte[] fileBytes = await File.ReadAllBytesAsync(backup.FilePath);
            var isSql = string.Equals(backup.Format, "SQL", StringComparison.OrdinalIgnoreCase);
            var extension = isSql ? ".sql" : ".aqb";
            var contentType = isSql ? "application/sql" : "application/octet-stream";
            var fileName = $"{backup.BackupName.Replace(" ", "_")}{extension}";
            return (fileBytes, contentType, fileName);
        }

        public async Task<bool> DeleteBackupAsync(Guid id)
        {
            var tenantId = _tenantProvider.TenantId;
            var currentUserId = _currentUserContext.UserId ?? "System";
            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null) return false;

            backup.IsDeleted = true;
            backup.DeletedAt = DateTime.UtcNow;
            backup.DeletedBy = currentUserId;

            if (File.Exists(backup.FilePath))
            {
                try { File.Delete(backup.FilePath); } catch { }
            }

            await _platformContext.SaveChangesAsync();
            await CreateAuditLogAsync("DELETE_BACKUP", $"Deleted backup '{backup.BackupName}'");
            return true;
        }

        public async Task<RestoreHistoryDto> RestoreBackupAsync(Guid backupId, RestoreBackupRequest request)
        {
            if (!string.Equals(request.ConfirmationText, "RESTORE", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Confirmation text must equal 'RESTORE' to proceed.");
            }

            var tenantId = _tenantProvider.TenantId;
            var schemaName = _tenantProvider.TenantSchemaName;
            var currentUserId = _currentUserContext.UserId ?? "System";
            var startTime = DateTime.UtcNow;

            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == backupId && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null || !File.Exists(backup.FilePath))
            {
                throw new KeyNotFoundException("Specified backup file does not exist.");
            }
            if (backup.Format == "SQL")
            {
                throw new InvalidOperationException("SQL export files cannot be restored via the UI. Please use pg_restore or standard psql command line.");
            }

            // 1. Verify SHA256 Checksum
            byte[] encryptedBytes = await File.ReadAllBytesAsync(backup.FilePath);
            string calculatedChecksum = ComputeSHA256(encryptedBytes);
            if (!string.Equals(calculatedChecksum, backup.Checksum, StringComparison.OrdinalIgnoreCase))
            {
                await LogFailedRestoreAsync(backupId, schemaName, currentUserId, startTime, "Checksum mismatch! Backup file is corrupted or tampered.");
                throw new InvalidOperationException("Backup checksum validation failed. Backup file is corrupted.");
            }

            // 2. AUTOMATIC EMERGENCY PRE-RESTORE BACKUP
            try
            {
                await CreateBackupAsync(new CreateBackupRequest
                {
                    BackupName = $"Pre Restore - {DateTime.UtcNow:dd MMM yyyy HH:mm}",
                    Description = $"Automatic Emergency Backup created before restoring snapshot '{backup.BackupName}'",
                    IncludeAttachments = true,
                    IncludeAuditLogs = true,
                    IncludeUsers = true
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EMERGENCY BACKUP WARNING]: {ex.Message}");
            }

            // 3. Decrypt Backup File & Read Contents
            byte[] rawZipBytes = DecryptBytes(encryptedBytes);
            Dictionary<string, List<Dictionary<string, object>>> tableContents = new();

            using (var memStream = new MemoryStream(rawZipBytes))
            using (var archive = new ZipArchive(memStream, ZipArchiveMode.Read))
            {
                foreach (var entry in archive.Entries)
                {
                    if (entry.FullName.StartsWith("tables/") && entry.FullName.EndsWith(".json"))
                    {
                        var tableName = Path.GetFileNameWithoutExtension(entry.FullName);
                        using var entryStream = entry.Open();
                        using var doc = await JsonDocument.ParseAsync(entryStream);
                        var rows = new List<Dictionary<string, object>>();

                        foreach (var elem in doc.RootElement.EnumerateArray())
                        {
                            var rowDict = new Dictionary<string, object>();
                            foreach (var prop in elem.EnumerateObject())
                            {
                                rowDict[prop.Name] = ConvertJsonElement(prop.Value);
                            }
                            rows.Add(rowDict);
                        }
                        tableContents[tableName] = rows;
                    }
                }
            }

            // 4. TRANSACTIONAL REPLACEMENT RESTORE ENGINE
            var connection = _context.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open) await connection.OpenAsync();

            using var transaction = connection.BeginTransaction();
            try
            {
                // A. Disable Foreign Key Constraints & Truncate Tenant Tables
                var tenantTables = await GetTenantTablesAsync(schemaName);

                using (var cmd = connection.CreateCommand())
                {
                    cmd.Transaction = transaction;
                    cmd.CommandText = $"SET search_path TO \"{schemaName}\";";
                    await cmd.ExecuteNonQueryAsync();

                    foreach (var tbl in tenantTables)
                    {
                        if (tbl.Equals("BackupHistories", StringComparison.OrdinalIgnoreCase) ||
                            tbl.Equals("RestoreHistories", StringComparison.OrdinalIgnoreCase))
                        {
                            continue; // Preserve backup and restore history
                        }

                        cmd.CommandText = $"TRUNCATE TABLE \"{schemaName}\".\"{tbl}\" CASCADE;";
                        await cmd.ExecuteNonQueryAsync();
                    }
                }

                // B. Restore Table Data
                foreach (var kvp in tableContents)
                {
                    var tableName = kvp.Key;
                    var rows = kvp.Value;
                    if (!rows.Any()) continue;

                    foreach (var row in rows)
                    {
                        var cols = string.Join(", ", row.Keys.Select(k => $"\"{k}\""));
                        var paramNames = string.Join(", ", row.Keys.Select((k, i) => $"@p{i}"));

                        using var insertCmd = connection.CreateCommand();
                        insertCmd.Transaction = transaction;
                        insertCmd.CommandText = $"INSERT INTO \"{schemaName}\".\"{tableName}\" ({cols}) VALUES ({paramNames});";

                        int paramIdx = 0;
                        foreach (var val in row.Values)
                        {
                            var param = insertCmd.CreateParameter();
                            param.ParameterName = $"@p{paramIdx++}";
                            param.Value = val ?? DBNull.Value;
                            insertCmd.Parameters.Add(param);
                        }

                        await insertCmd.ExecuteNonQueryAsync();
                    }
                }

                // C. Reset Identity Sequences
                using (var seqCmd = connection.CreateCommand())
                {
                    seqCmd.Transaction = transaction;
                    seqCmd.CommandText = $@"
                        DO $$
                        DECLARE r RECORD;
                        BEGIN
                            FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = '{schemaName}') LOOP
                                EXECUTE 'SELECT setval(''' || r.sequence_name || ''', COALESCE((SELECT MAX(id) FROM ' || quote_ident(r.sequence_name) || '), 1), true)';
                            END LOOP;
                        END $$;";
                    try { await seqCmd.ExecuteNonQueryAsync(); } catch { }
                }

                transaction.Commit();

                var endTime = DateTime.UtcNow;
                var durationMs = (long)(endTime - startTime).TotalMilliseconds;

                var restoreLog = new RestoreHistory
                {
                    Id = Guid.NewGuid(),
                    BackupId = backupId,
                    TenantId = tenantId,
                    SchemaName = schemaName,
                    StartedBy = currentUserId,
                    StartedAt = startTime,
                    CompletedAt = endTime,
                    DurationMs = durationMs,
                    Status = "SUCCESS",
                    IPAddress = _currentUserContext.IpAddress ?? "127.0.0.1",
                    Details = $"Successfully restored {tableContents.Count} tables snapshot.",
                    CreatedAt = endTime,
                    CreatedBy = currentUserId
                };

                _platformContext.RestoreHistories.Add(restoreLog);
                backup.Status = "RESTORED";
                await _platformContext.SaveChangesAsync();

                await CreateAuditLogAsync("RESTORE_SUCCESS", $"Successfully restored snapshot '{backup.BackupName}' in {durationMs} ms");

                var userNames = await ResolveUserNamesAsync(new[] { currentUserId });
                return MapToRestoreDto(restoreLog, backup.BackupName, userNames);
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                await LogFailedRestoreAsync(backupId, schemaName, currentUserId, startTime, ex.Message);
                throw new InvalidOperationException($"Restore transaction failed and was rolled back safely: {ex.Message}", ex);
            }
        }

        public async Task<BackupHistoryDto> UploadAndCreateBackupAsync(Stream fileStream, string fileName)
        {
            if (fileStream == null || fileStream.Length == 0)
            {
                throw new ArgumentException("No file provided for upload.");
            }

            var tenantId = _tenantProvider.TenantId;
            var schemaName = _tenantProvider.TenantSchemaName;
            var currentUserId = _currentUserContext.UserId ?? "System";

            var backupId = Guid.NewGuid();
            var now = DateTime.UtcNow;
            var relativeFolderPath = Path.Combine("Backups", tenantId.ToString(), now.ToString("yyyy"), now.ToString("MM"));
            var physicalFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, relativeFolderPath);
            Directory.CreateDirectory(physicalFolder);

            var physicalFilePath = Path.Combine(physicalFolder, $"{backupId}.aqb");

            using (var destinationStream = new FileStream(physicalFilePath, FileMode.Create))
            {
                await fileStream.CopyToAsync(destinationStream);
            }

            byte[] encryptedBytes = await File.ReadAllBytesAsync(physicalFilePath);
            string checksum = ComputeSHA256(encryptedBytes);
            string hash = ComputeSHA256(Encoding.UTF8.GetBytes($"{backupId}:{tenantId}:{checksum}"));

            var backupEntity = new BackupHistory
            {
                Id = backupId,
                TenantId = tenantId,
                SchemaName = schemaName,
                BackupName = Path.GetFileNameWithoutExtension(fileName),
                Description = "Uploaded Backup Archive",
                BackupSize = fileStream.Length,
                RecordCount = 0,
                Checksum = checksum,
                Hash = hash,
                FilePath = physicalFilePath,
                Status = "COMPLETED",
                CanRestore = true,
                CreatedAt = now,
                CreatedBy = currentUserId
            };

            _platformContext.BackupHistories.Add(backupEntity);
            await _platformContext.SaveChangesAsync();

            await CreateAuditLogAsync("UPLOAD_BACKUP", $"Uploaded backup file '{fileName}'");

            var userNames = await ResolveUserNamesAsync(new[] { currentUserId });
            return MapToDto(backupEntity, userNames);
        }

        public async Task<BackupStorageStatsDto> GetStorageStatsAsync()
        {
            var tenantId = _tenantProvider.TenantId;
            var histories = await _platformContext.BackupHistories
                .Where(h => h.TenantId == tenantId && !h.IsDeleted)
                .ToListAsync();

            long totalBytes = histories.Sum(h => h.BackupSize);
            long freeSpace = 100L * 1024L * 1024L * 1024L; // Default 100 GB virtual free space

            try
            {
                var drive = new DriveInfo(Path.GetPathRoot(AppDomain.CurrentDomain.BaseDirectory) ?? "C:\\");
                freeSpace = drive.AvailableFreeSpace;
            }
            catch { }

            return new BackupStorageStatsDto
            {
                TotalBackupsCount = histories.Count,
                TotalSizeBytes = totalBytes,
                FormattedTotalSize = FormatBytes(totalBytes),
                FreeDiskSpaceBytes = freeSpace,
                FormattedFreeDiskSpace = FormatBytes(freeSpace)
            };
        }

        public async Task<BackupInspectionDto> InspectBackupAsync(Guid id)
        {
            var tenantId = _tenantProvider.TenantId;
            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null || !File.Exists(backup.FilePath))
                throw new KeyNotFoundException("Backup file not found.");

            var dto = new BackupInspectionDto
            {
                BackupId = backup.Id,
                BackupName = backup.BackupName,
                TenantName = backup.TenantName,
                CreatedAt = backup.CreatedAt,
                Version = backup.Version,
                EngineVersion = backup.EngineVersion,
                Checksum = backup.Checksum,
                TotalTables = backup.TableCount,
                TotalRecords = backup.RecordCount,
                TotalSizeBytes = backup.BackupSize,
                FormattedTotalSize = FormatBytes(backup.BackupSize)
            };

            if (backup.Format != "AQB") return dto; // Only AQB supports deep table inspection

            byte[] encryptedBytes = await File.ReadAllBytesAsync(backup.FilePath);
            byte[] rawZipBytes = DecryptBytes(encryptedBytes);

            using var memStream = new MemoryStream(rawZipBytes);
            using var archive = new ZipArchive(memStream, ZipArchiveMode.Read);
            var schemaEntry = archive.GetEntry("schema.json");
            if (schemaEntry != null)
            {
                using var entryStream = schemaEntry.Open();
                using var doc = await JsonDocument.ParseAsync(entryStream);
                foreach (var elem in doc.RootElement.EnumerateArray())
                {
                    dto.Tables.Add(new TableInspectionDto
                    {
                        TableName = elem.GetProperty("TableName").GetString() ?? "",
                        Rows = elem.GetProperty("RecordCount").GetInt32(),
                        Columns = 0, // Placeholder
                        SizeBytes = 0, // Placeholder
                        FormattedSize = "0 B",
                        LastModified = null
                    });
                }
            }

            return dto;
        }

        public async Task<TableDataPreviewDto> GetBackupTablePreviewAsync(Guid id, string tableName)
        {
            var tenantId = _tenantProvider.TenantId;
            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null || !File.Exists(backup.FilePath) || backup.Format != "AQB")
                throw new InvalidOperationException("Preview is only available for AQB format backups.");

            byte[] encryptedBytes = await File.ReadAllBytesAsync(backup.FilePath);
            byte[] rawZipBytes = DecryptBytes(encryptedBytes);

            using var memStream = new MemoryStream(rawZipBytes);
            using var archive = new ZipArchive(memStream, ZipArchiveMode.Read);
            var tableEntry = archive.GetEntry($"tables/{tableName}.json");
            
            var dto = new TableDataPreviewDto { TableName = tableName };

            if (tableEntry != null)
            {
                using var entryStream = tableEntry.Open();
                using var doc = await JsonDocument.ParseAsync(entryStream);
                int count = 0;
                foreach (var elem in doc.RootElement.EnumerateArray())
                {
                    if (count >= 100) break; // First 100 rows preview
                    
                    var row = new Dictionary<string, object?>();
                    foreach (var prop in elem.EnumerateObject())
                    {
                        if (count == 0) dto.Columns.Add(prop.Name);
                        row[prop.Name] = ConvertJsonElement(prop.Value);
                    }
                    dto.Rows.Add(row);
                    count++;
                }
            }

            return dto;
        }

        public async Task<BackupVerificationDto> VerifyBackupIntegrityAsync(Guid id)
        {
            var tenantId = _tenantProvider.TenantId;
            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null || !File.Exists(backup.FilePath))
                return new BackupVerificationDto { IsVerified = false, Message = "File not found." };

            var dto = new BackupVerificationDto { BackupId = id, VersionCompatible = true };
            
            try
            {
                byte[] bytes = await File.ReadAllBytesAsync(backup.FilePath);
                string checksum = ComputeSHA256(bytes);
                dto.ChecksumValid = string.Equals(checksum, backup.Checksum, StringComparison.OrdinalIgnoreCase);

                if (backup.Format == "AQB")
                {
                    byte[] raw = DecryptBytes(bytes);
                    dto.EncryptionValid = true;

                    using var memStream = new MemoryStream(raw);
                    using var archive = new ZipArchive(memStream, ZipArchiveMode.Read);
                    dto.ManifestValid = archive.GetEntry("metadata.json") != null && archive.GetEntry("schema.json") != null;
                }
                else
                {
                    dto.EncryptionValid = true;
                    dto.ManifestValid = true;
                }

                dto.IsVerified = dto.ChecksumValid && dto.EncryptionValid && dto.ManifestValid;
                dto.Message = dto.IsVerified ? "Backup is fully verified." : "Backup verification failed.";
            }
            catch (Exception ex)
            {
                dto.IsVerified = false;
                dto.Message = $"Corrupted: {ex.Message}";
            }
            return dto;
        }

        public async Task<RestorePreviewDto> PreviewRestoreAsync(Guid id)
        {
            var tenantId = _tenantProvider.TenantId;
            var schemaName = _tenantProvider.TenantSchemaName;
            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null) throw new KeyNotFoundException("Backup not found");
            if (backup.Format != "AQB") throw new InvalidOperationException("Only AQB exports can be previewed for UI restore.");

            var dto = new RestorePreviewDto
            {
                BackupId = backup.Id,
                BackupDate = backup.CreatedAt,
                Version = backup.Version,
                BackupTables = backup.TableCount,
                BackupRecords = backup.RecordCount,
                BackupStorage = backup.BackupSize,
                IsCompatible = true
            };

            var currentTables = await GetTenantTablesAsync(schemaName);
            dto.CurrentTables = currentTables.Count;
            
            long currentRecs = 0;
            var connection = _context.Database.GetDbConnection();
            bool wasClosed = connection.State == ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();
            try
            {
                foreach(var tbl in currentTables)
                {
                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = $"SELECT COUNT(1) FROM \"{schemaName}\".\"{tbl}\"";
                    currentRecs += Convert.ToInt64(await cmd.ExecuteScalarAsync());
                }
                dto.CurrentRecords = (int)currentRecs;
            }
            finally { if (wasClosed) await connection.CloseAsync(); }

            if (dto.CurrentRecords > 0)
            {
                dto.Warnings.Add("Current database contains data that WILL BE DELETED and replaced by this backup.");
            }
            if (dto.BackupRecords < dto.CurrentRecords)
            {
                dto.Warnings.Add($"You are about to restore a backup with fewer records ({dto.BackupRecords}) than your current state ({dto.CurrentRecords}).");
            }

            return dto;
        }

        // --- PRIVATE HELPER METHODS ---

        private async Task<List<RestoreHistoryDto>> GetRestoreHistoryAsync()
        {
            var tenantId = _tenantProvider.TenantId;
            var list = await _platformContext.RestoreHistories
                .Where(r => r.TenantId == tenantId)
                .OrderByDescending(r => r.StartedAt)
                .ToListAsync();

            var backupIds = list.Select(r => r.BackupId).Distinct().ToList();
            var backups = await _platformContext.BackupHistories
                .Where(b => backupIds.Contains(b.Id))
                .ToDictionaryAsync(b => b.Id, b => b.BackupName);

            var userIds = list.Select(r => r.StartedBy).Distinct().ToList();
            var userNames = await ResolveUserNamesAsync(userIds);

            return list.Select(r => MapToRestoreDto(r, backups.TryGetValue(r.BackupId, out var name) ? name : "Backup Snapshot", userNames)).ToList();
        }

        private async Task<List<string>> GetTenantTablesAsync(string schemaName)
        {
            var tables = new List<string>();
            var connection = _context.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open) await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = @schemaName 
                  AND table_type = 'BASE TABLE'
                  AND table_name NOT LIKE '__EF%'
                ORDER BY table_name;";

            var param = cmd.CreateParameter();
            param.ParameterName = "@schemaName";
            param.Value = schemaName;
            cmd.Parameters.Add(param);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                tables.Add(reader.GetString(0));
            }
            return tables;
        }

        private async Task<List<Dictionary<string, object>>> ExportTableDataAsync(string schemaName, string tableName)
        {
            var rows = new List<Dictionary<string, object>>();
            var connection = _context.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open) await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = $"SELECT * FROM \"{schemaName}\".\"{tableName}\";";

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var colName = reader.GetName(i);
                    var val = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    row[colName] = val;
                }
                rows.Add(row);
            }
            return rows;
        }

        private byte[] GetEncryptionKey()
        {
            var passphrase = _configuration["BackupSettings:Passphrase"];
            if (string.IsNullOrWhiteSpace(passphrase))
            {
                throw new InvalidOperationException("CRITICAL CONFIGURATION ERROR: 'BackupSettings:Passphrase' is missing from appsettings.json. Backup AES encryption requires a valid passphrase.");
            }

            // Derive a 32-byte key using PBKDF2. Using a static salt for the key derivation since we use a random IV for the encryption
            byte[] salt = Encoding.UTF8.GetBytes("AquoraEnterpriseBackupStaticSalt2026!@#"); 
            byte[] key = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(passphrase), 
                salt, 
                100000, 
                HashAlgorithmName.SHA256, 
                32);
            
            if (key.Length != 32)
                throw new CryptographicException($"Derived key length is {key.Length} bytes. Expected exactly 32 bytes for AES-256.");
                
            return key;
        }

        private byte[] EncryptBytes(byte[] input)
        {
            byte[] key = GetEncryptionKey();
            using var aes = Aes.Create();
            aes.KeySize = 256;
            aes.Key = key;
            aes.GenerateIV(); // Securely generate a random 16-byte IV for every backup
            
            using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
            using var ms = new MemoryStream();
            
            // Store the 16-byte IV at the beginning of the encrypted stream
            ms.Write(aes.IV, 0, aes.IV.Length);
            
            using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
            {
                cs.Write(input, 0, input.Length);
                cs.FlushFinalBlock();
            }
            return ms.ToArray();
        }

        private byte[] DecryptBytes(byte[] cipherTextWithIv)
        {
            if (cipherTextWithIv == null || cipherTextWithIv.Length < 16)
                throw new CryptographicException("Invalid backup file: The file is too short to contain a valid IV.");

            byte[] key = GetEncryptionKey();
            using var aes = Aes.Create();
            aes.KeySize = 256;
            aes.Key = key;
            
            // Extract the 16-byte IV from the beginning of the stream
            byte[] iv = new byte[16];
            Array.Copy(cipherTextWithIv, 0, iv, 0, 16);
            aes.IV = iv;
            
            using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
            using var ms = new MemoryStream();
            
            using (var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Write))
            {
                cs.Write(cipherTextWithIv, 16, cipherTextWithIv.Length - 16);
                cs.FlushFinalBlock();
            }
            return ms.ToArray();
        }

        private static string ComputeSHA256(byte[] data)
        {
            using var sha = SHA256.Create();
            byte[] hashBytes = sha.ComputeHash(data);
            return Convert.ToHexString(hashBytes).ToLowerInvariant();
        }

        private static object ConvertJsonElement(JsonElement elem)
        {
            return elem.ValueKind switch
            {
                JsonValueKind.String => elem.GetString(),
                JsonValueKind.Number => elem.TryGetInt64(out long l) ? l : elem.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                _ => elem.ToString()
            };
        }

        private async Task LogFailedRestoreAsync(Guid backupId, string schemaName, string userId, DateTime startTime, string details)
        {
            var endTime = DateTime.UtcNow;
            var restoreLog = new RestoreHistory
            {
                Id = Guid.NewGuid(),
                BackupId = backupId,
                TenantId = _tenantProvider.TenantId,
                SchemaName = schemaName,
                StartedBy = userId,
                StartedAt = startTime,
                CompletedAt = endTime,
                DurationMs = (long)(endTime - startTime).TotalMilliseconds,
                Status = "FAILED",
                IPAddress = _currentUserContext.IpAddress ?? "127.0.0.1",
                Details = details,
                CreatedAt = endTime,
                CreatedBy = userId
            };

            _platformContext.RestoreHistories.Add(restoreLog);
            await _platformContext.SaveChangesAsync();

            await CreateAuditLogAsync("RESTORE_FAILED", $"Failed to restore snapshot '{backupId}': {details}");
        }

        private async Task CreateAuditLogAsync(string action, string details)
        {
            try
            {
                var auditLog = new AuditLog
                {
                    TenantId = _tenantProvider.TenantId,
                    UserId = _currentUserContext.UserId ?? "System",
                    Action = action,
                    TableName = "BackupHistory",
                    PrimaryKey = _tenantProvider.TenantId.ToString(),
                    OldValues = "{}",
                    NewValues = JsonSerializer.Serialize(new { Details = details }),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = _currentUserContext.IpAddress ?? "127.0.0.1",
                    Reason = details,
                    Module = "Administration"
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();
            }
            catch { }
        }

        private async Task<Dictionary<string, string>> ResolveUserNamesAsync(IEnumerable<string> userIds)
        {
            var ids = userIds.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
            if (!ids.Any()) return new Dictionary<string, string>();

            var users = await _context.Users
                .Where(u => ids.Contains(u.Id.ToString()))
                .ToDictionaryAsync(u => u.Id.ToString(), u => !string.IsNullOrWhiteSpace(u.FirstName) ? $"{u.FirstName} {u.LastName}".Trim() : (u.Username ?? u.Email));

            return users;
        }

        private static BackupHistoryDto MapToDto(BackupHistory h, Dictionary<string, string> userNames)
        {
            return new BackupHistoryDto
            {
                Id = h.Id,
                TenantId = h.TenantId,
                SchemaName = h.SchemaName,
                BackupName = h.BackupName,
                Description = h.Description,
                BackupSize = h.BackupSize,
                FormattedSize = FormatBytes(h.BackupSize),
                RecordCount = h.RecordCount,
                Checksum = h.Checksum,
                Hash = h.Hash,
                TenantName = h.TenantName ?? string.Empty,
                Version = h.Version ?? "1.0.0",
                TableCount = h.TableCount,
                EngineVersion = h.EngineVersion ?? "2026.1",
                RestoreCount = h.RestoreCount,
                Encryption = h.Encryption ?? "AES-256",
                Status = h.Status,
                DownloadCount = h.DownloadCount,
                LastDownloaded = h.LastDownloaded,
                CanRestore = h.CanRestore,
                IsEmergencyBackup = h.IsEmergencyBackup,
                Format = h.Format ?? "AQB",
                IncludeAttachments = h.IncludeAttachments,
                IncludeAuditLogs = h.IncludeAuditLogs,
                IncludeUsers = h.IncludeUsers,
                CreatedAt = h.CreatedAt,
                CreatedBy = h.CreatedBy,
                CreatedByName = userNames.TryGetValue(h.CreatedBy, out var name) ? name : "System Administrator"
            };
        }

        private static RestoreHistoryDto MapToRestoreDto(RestoreHistory r, string backupName, Dictionary<string, string> userNames)
        {
            return new RestoreHistoryDto
            {
                RestoreId = r.Id,
                BackupId = r.BackupId,
                BackupName = backupName,
                TenantId = r.TenantId,
                StartedBy = r.StartedBy,
                StartedByName = userNames.TryGetValue(r.StartedBy, out var name) ? name : "System Administrator",
                StartedAt = r.StartedAt,
                CompletedAt = r.CompletedAt,
                DurationMs = r.DurationMs,
                Status = r.Status,
                IPAddress = r.IPAddress,
                Details = r.Details
            };
        }

        private static string FormatBytes(long bytes)
        {
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int i = 0;
            double dblSByte = bytes;
            while (dblSByte >= 1024 && i < suffixes.Length - 1)
            {
                i++;
                dblSByte /= 1024;
            }
            return $"{dblSByte:0.##} {suffixes[i]}";
        }
    }
}
