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
using System.Data;

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
            Console.WriteLine($"[RESTORE METHOD ENTERED]: GetBackupDashboardAsync | Source File: BackupService.cs | Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            var histories = await GetBackupHistoryAsync();
            var restores = await GetRestoreHistoryAsync();

            var totalStorageBytes = histories.Sum(h => h.BackupSize);

            string dbVersion = "PostgreSQL 16";
            try 
            {
                using var connection = CreateDedicatedConnection();
                await OpenDedicatedConnectionAsync(connection, "GetBackupDashboardAsync", "BackupService.cs", 62);
                
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
            Console.WriteLine($"[RESTORE METHOD ENTERED]: CreateBackupAsync | Source File: BackupService.cs | Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
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

        private enum RestorePolicy
        {
            ReplaceExisting,
            Skip,
            AppendNew
        }

        private RestorePolicy GetTableRestorePolicy(string tableName)
        {
            if (tableName.Equals("BackupHistories", StringComparison.OrdinalIgnoreCase) ||
                tableName.Equals("RestoreHistories", StringComparison.OrdinalIgnoreCase) ||
                tableName.Equals("AuditLogs", StringComparison.OrdinalIgnoreCase) ||
                tableName.Equals("__EFMigrationsHistory", StringComparison.OrdinalIgnoreCase))
            {
                return RestorePolicy.Skip;
            }

            return RestorePolicy.ReplaceExisting;
        }

        private List<string> GetTopologicallySortedTables(IEnumerable<string> availableTables)
        {
            var dbContext = _context as DbContext;
            var entityTypes = dbContext?.Model.GetEntityTypes() ?? Enumerable.Empty<Microsoft.EntityFrameworkCore.Metadata.IEntityType>();
            var tableDependencies = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);

            foreach (var tbl in availableTables)
            {
                tableDependencies[tbl] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            }

            foreach (var et in entityTypes)
            {
                var tableName = et.GetTableName();
                if (tableName == null || !availableTables.Contains(tableName, StringComparer.OrdinalIgnoreCase)) continue;

                foreach (var fk in et.GetForeignKeys())
                {
                    var principalTable = fk.PrincipalEntityType.GetTableName();
                    if (principalTable != null && 
                        principalTable != tableName && 
                        availableTables.Contains(principalTable, StringComparer.OrdinalIgnoreCase))
                    {
                        tableDependencies[tableName].Add(principalTable);
                    }
                }
            }

            var sorted = new List<string>();
            var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var visiting = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            void Visit(string node)
            {
                if (visited.Contains(node)) return;
                if (visiting.Contains(node)) return; 

                visiting.Add(node);

                if (tableDependencies.TryGetValue(node, out var dependencies))
                {
                    foreach (var dep in dependencies)
                    {
                        Visit(dep);
                    }
                }

                visiting.Remove(node);
                visited.Add(node);
                sorted.Add(node);
            }

            foreach (var tbl in availableTables)
            {
                Visit(tbl);
            }

            return sorted;
        }

        private List<string> ValidateBackupDataset(Dictionary<string, List<Dictionary<string, object>>> tableContents, List<string> sortedTables)
        {
            var errors = new List<string>();
            var dbContext = _context as DbContext;
            var entityTypes = dbContext?.Model.GetEntityTypes().ToList() ?? new List<Microsoft.EntityFrameworkCore.Metadata.IEntityType>();

            foreach (var tableName in sortedTables)
            {
                var policy = GetTableRestorePolicy(tableName);
                if (policy == RestorePolicy.Skip) continue;

                if (!tableContents.TryGetValue(tableName, out var rows) || !rows.Any()) continue;

                var entityType = entityTypes.FirstOrDefault(e => string.Equals(e.GetTableName(), tableName, StringComparison.OrdinalIgnoreCase));
                if (entityType == null) continue;

                var pks = entityType.FindPrimaryKey()?.Properties;
                var fks = entityType.GetForeignKeys();
                var pkSet = new HashSet<string>();

                int rowIdx = 0;
                foreach (var row in rows)
                {
                    rowIdx++;
                    
                    if (pks != null && pks.Any())
                    {
                        var pkVals = new List<string>();
                        foreach (var pk in pks)
                        {
                            var colName = pk.GetColumnName() ?? pk.Name;
                            if (row.TryGetValue(pk.Name, out var v) || row.TryGetValue(colName, out v))
                            {
                                pkVals.Add(v?.ToString() ?? "null");
                            }
                        }
                        var pkKey = string.Join("|", pkVals);
                        if (!pkSet.Add(pkKey))
                        {
                            errors.Add($"[{tableName}] Duplicate Primary Key '{pkKey}' found in backup payload.");
                        }
                    }

                    foreach (var fk in fks)
                    {
                        var principalTable = fk.PrincipalEntityType.GetTableName();
                        if (principalTable == null || principalTable == tableName) continue; 
                        
                        if (tableContents.TryGetValue(principalTable, out var principalRows))
                        {
                            var fkProps = fk.Properties;
                            var princProps = fk.PrincipalKey.Properties;

                            bool fkIsNull = true;
                            var fkVals = new List<string>();
                            foreach (var p in fkProps)
                            {
                                var colName = p.GetColumnName() ?? p.Name;
                                if (row.TryGetValue(p.Name, out var v) || row.TryGetValue(colName, out v))
                                {
                                    if (v != null && !string.IsNullOrWhiteSpace(v.ToString())) fkIsNull = false;
                                    fkVals.Add(v?.ToString() ?? "");
                                }
                                else fkVals.Add("");
                            }

                            if (fkIsNull) continue;

                            bool found = false;
                            foreach (var pRow in principalRows)
                            {
                                bool match = true;
                                for (int i = 0; i < princProps.Count; i++)
                                {
                                    var pp = princProps[i];
                                    var ppName = pp.GetColumnName() ?? pp.Name;
                                    
                                    pRow.TryGetValue(pp.Name, out var pVal);
                                    if (pVal == null) pRow.TryGetValue(ppName, out pVal);
                                    
                                    if (fkVals[i] != (pVal?.ToString() ?? ""))
                                    {
                                        match = false;
                                        break;
                                    }
                                }
                                if (match)
                                {
                                    found = true;
                                    break;
                                }
                            }

                            if (!found)
                            {
                                errors.Add($"[{tableName}] Missing referenced record in '{principalTable}'. FK: {string.Join(", ", fkVals)}");
                            }
                        }
                    }
                }
            }

            return errors;
        }

        public async Task<RestoreHistoryDto> RestoreBackupAsync(Guid backupId, RestoreBackupRequest request)
        {
            Console.WriteLine($"[RESTORE METHOD ENTERED]: RestoreBackupAsync | Source File: BackupService.cs | Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
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
                throw new KeyNotFoundException($"Specified backup file for BackupId '{backupId}' does not exist on disk.");
            }
            if (backup.Format == "SQL")
            {
                throw new InvalidOperationException("SQL export files cannot be restored via the UI. Please use pg_restore or standard psql command line.");
            }

            // 1. Audit Selection Flow & Compute SHA256 Checksum
            byte[] encryptedBytes = await File.ReadAllBytesAsync(backup.FilePath);
            string calculatedChecksum = ComputeSHA256(encryptedBytes);

            int waterReportsCount = 0;
            int purchasePaymentsCount = 0;
            try
            {
                byte[] tempRawZip = DecryptBytes(encryptedBytes);
                using var tempMs = new MemoryStream(tempRawZip);
                using var tempArchive = new ZipArchive(tempMs, ZipArchiveMode.Read);
                foreach (var entry in tempArchive.Entries)
                {
                    if (entry.FullName.Equals("tables/WaterTestReports.json", StringComparison.OrdinalIgnoreCase))
                    {
                        using var s = entry.Open();
                        using var doc = System.Text.Json.JsonDocument.Parse(s);
                        waterReportsCount = doc.RootElement.GetArrayLength();
                    }
                    if (entry.FullName.Equals("tables/PurchasePayments.json", StringComparison.OrdinalIgnoreCase))
                    {
                        using var s = entry.Open();
                        using var doc = System.Text.Json.JsonDocument.Parse(s);
                        purchasePaymentsCount = doc.RootElement.GetArrayLength();
                    }
                }
            }
            catch { }

            Console.WriteLine("=========================================================");
            Console.WriteLine("[RESTORE SELECTION SELECTION AUDIT]");
            Console.WriteLine($"Requested BackupId:                       {backupId}");
            Console.WriteLine($"BackupId received by API:                 {backupId}");
            Console.WriteLine($"BackupHistory.Id:                         {backup.Id}");
            Console.WriteLine($"BackupHistory.Name:                       {backup.BackupName}");
            Console.WriteLine($"BackupHistory.CreatedAt:                  {backup.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC");
            Console.WriteLine($"BackupHistory.FilePath:                   {backup.FilePath}");
            Console.WriteLine($"BackupHistory.Hash:                       {backup.Hash ?? backup.Checksum}");
            Console.WriteLine($"Actual file opened:                       {backup.FilePath}");
            Console.WriteLine($"SHA256 of opened file:                    {calculatedChecksum}");
            Console.WriteLine($"WaterTestReports count inside that file:   {waterReportsCount}");
            Console.WriteLine($"PurchasePayments count inside that file:  {purchasePaymentsCount}");
            Console.WriteLine("=========================================================");

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
            // 3.5. DEPENDENCY RESOLUTION & PRE-VALIDATION
            var availableTables = tableContents.Keys.ToList();
            var sortedTables = GetTopologicallySortedTables(availableTables);

            if (tableContents.TryGetValue("WaterTestReports", out var archiveWaterReports))
            {
                LogWaterTestReportsArchiveContent(archiveWaterReports);
            }
            
            var validationErrors = ValidateBackupDataset(tableContents, sortedTables);
            if (validationErrors.Any())
            {
                var errorSummary = string.Join("\n", validationErrors);
                await LogFailedRestoreAsync(backupId, schemaName, currentUserId, startTime, "Pre-validation failed:\n" + errorSummary);
                throw new InvalidOperationException($"Pre-validation failed with {validationErrors.Count} errors:\n{errorSummary}");
            }

            // 4. TRANSACTIONAL REPLACEMENT RESTORE ENGINE
            Console.WriteLine("[RESTORE START]");
            using var connection = CreateDedicatedConnection();
            await OpenDedicatedConnectionAsync(connection, "RestoreBackupAsync", "BackupService.cs", 599, schemaName);

            var dbContext = _context as DbContext;
            string rawConnectionString = dbContext?.Database.GetConnectionString() 
                ?? _configuration.GetConnectionString("DefaultConnection") 
                ?? _configuration["ConnectionStrings:DefaultConnection"] 
                ?? connection.ConnectionString;

            string maskedConnStrForLogging = System.Text.RegularExpressions.Regex.Replace(
                rawConnectionString, 
                @"(Password|Pwd)=[^;]*", 
                "$1=***", 
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            Console.WriteLine("==========================================================================");
            Console.WriteLine("[RESTORE ENGINE RUNTIME INSTRUMENTATION]");
            Console.WriteLine($"  Database Name:       {connection.Database}");
            Console.WriteLine($"  Host/DataSource:     {connection.DataSource}");
            Console.WriteLine($"  Schema Name:         {schemaName}");
            Console.WriteLine($"  TenantId:            {tenantId}");
            Console.WriteLine($"  Connection String:   {maskedConnStrForLogging}");
            Console.WriteLine($"  DbContext Hash:      {_context.GetHashCode()}");
            Console.WriteLine($"  Connection State:    {connection.State}");
            
            var processId = connection.GetType().GetProperty("ProcessID")?.GetValue(connection);
            if (processId != null)
            {
                Console.WriteLine($"  Npgsql Process ID:   {processId}");
            }
            Console.WriteLine("==========================================================================");

            using var transaction = connection.BeginTransaction();
            Console.WriteLine($"  Transaction Hash:    {transaction.GetHashCode()}");

            try
            {
                // 0. Fetch schema info
                var schemaCols = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
                using (var schemaCmd = connection.CreateCommand())
                {
                    schemaCmd.Transaction = transaction;
                    schemaCmd.CommandText = @"
                        SELECT table_name, column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_schema = @schema";
                    var schemaParam = schemaCmd.CreateParameter();
                    schemaParam.ParameterName = "@schema";
                    schemaParam.Value = schemaName;
                    schemaCmd.Parameters.Add(schemaParam);

                    using var reader = await schemaCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var tName = reader.GetString(0);
                        var cName = reader.GetString(1);
                        var dType = reader.GetString(2);

                        if (!schemaCols.ContainsKey(tName))
                            schemaCols[tName] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        schemaCols[tName][cName] = dType;
                    }
                }

                // A. Truncate Tenant Tables & Instrument Delete Phase
                var tenantTables = await GetTenantTablesAsync(schemaName, transaction);
                var truncatedTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                using (var cmd = connection.CreateCommand())
                {
                    cmd.Transaction = transaction;
                    cmd.CommandText = $"SET search_path TO \"{schemaName}\";";
                    await cmd.ExecuteNonQueryAsync();

                    Console.WriteLine("--------------------------------------------------------------------------");
                    Console.WriteLine("[RESTORE ENGINE: TRUNCATE PHASE]");
                    foreach (var tbl in tenantTables)
                    {
                        var policy = GetTableRestorePolicy(tbl);
                        if (policy == RestorePolicy.Skip)
                        {
                            Console.WriteLine($"  Table: {tbl,-25} | Policy: SKIP | Truncate Bypassed");
                            continue;
                        }

                        // Query Rows Before Delete
                        cmd.CommandText = $"SELECT COUNT(*) FROM \"{schemaName}\".\"{tbl}\";";
                        var rowsBeforeDelete = Convert.ToInt64(await cmd.ExecuteScalarAsync());

                        // Execute TRUNCATE
                        cmd.CommandText = $"TRUNCATE TABLE \"{schemaName}\".\"{tbl}\" CASCADE;";
                        await cmd.ExecuteNonQueryAsync();
                        truncatedTables.Add(tbl);

                        // Query Rows After Delete
                        cmd.CommandText = $"SELECT COUNT(*) FROM \"{schemaName}\".\"{tbl}\";";
                        var rowsAfterDelete = Convert.ToInt64(await cmd.ExecuteScalarAsync());

                        Console.WriteLine("=========================================================");
                        Console.WriteLine("[DELETE TABLE]");
                        Console.WriteLine($"Table Name: {tbl}");
                        Console.WriteLine($"Rows Before: {rowsBeforeDelete}");
                        Console.WriteLine($"Rows After: {rowsAfterDelete}");
                        Console.WriteLine("=========================================================");

                        if (rowsAfterDelete != 0)
                        {
                            Console.WriteLine($"[CRITICAL ERROR]: Table '{tbl}' count after TRUNCATE is {rowsAfterDelete} (Expected 0)!");
                            throw new InvalidOperationException($"CRITICAL INTEGRITY FAILURE: Table '{tbl}' has {rowsAfterDelete} rows after TRUNCATE! Must be 0. Restore stopped immediately.");
                        }

                        if (tbl.Equals("WaterTestReports", StringComparison.OrdinalIgnoreCase))
                        {
                            await LogWaterTestReportsSnapshotAsync(connection, transaction, "AFTER TRUNCATE", schemaName);
                        }
                    }
                }

                // B. Restore Table Data & Instrument Insert Phase
                Console.WriteLine("[RESTORE ENGINE: INSERT PHASE]");
                foreach (var tableName in sortedTables)
                {
                    var policy = GetTableRestorePolicy(tableName);
                    if (policy == RestorePolicy.Skip) continue;

                    if (!tableContents.TryGetValue(tableName, out var rows)) continue;
                    var expectedRows = rows.Count;
                    if (expectedRows == 0) continue;

                    if (!truncatedTables.Contains(tableName))
                    {
                        throw new InvalidOperationException($"CRITICAL INTEGRITY ERROR: Attempted to insert data into {tableName}, but the table was never successfully truncated. Restore aborted.");
                    }

                    int insertedCount = 0;
                    foreach (var row in rows)
                    {
                        var colNames = new List<string>();
                        var paramNames = new List<string>();
                        
                        using var insertCmd = connection.CreateCommand();
                        insertCmd.Transaction = transaction;

                        int paramIdx = 0;
                        foreach (var kvpCol in row)
                        {
                            var colName = kvpCol.Key;
                            var rawVal = kvpCol.Value;

                            string dbTypeStr = "text";
                            if (schemaCols.TryGetValue(tableName, out var tblCols) && tblCols.TryGetValue(colName, out var typeStr))
                            {
                                dbTypeStr = typeStr.ToLowerInvariant();
                            }

                            (object finalVal, DbType dbTypeEnum) = ConvertToPgType(rawVal, dbTypeStr);

                            colNames.Add($"\"{colName}\"");
                            var pName = $"@p{paramIdx}";
                            paramNames.Add(pName);

                            var param = insertCmd.CreateParameter();
                            param.ParameterName = pName;
                            param.Value = finalVal ?? DBNull.Value;
                            param.DbType = dbTypeEnum;
                            insertCmd.Parameters.Add(param);

                            paramIdx++;
                        }

                        var cols = string.Join(", ", colNames);
                        var pNames = string.Join(", ", paramNames);
                        insertCmd.CommandText = $"INSERT INTO \"{schemaName}\".\"{tableName}\" ({cols}) VALUES ({pNames});";

                        try
                        {
                            await insertCmd.ExecuteNonQueryAsync();
                            insertedCount++;
                        }
                        catch (Exception ex)
                        {
                            var failedRowParams = string.Join(", ", insertCmd.Parameters.Cast<IDataParameter>().Select(p => $"{p.ParameterName}={p.Value} ({p.DbType})"));
                            throw new InvalidOperationException($"Insert failed for table {tableName}. Params: {failedRowParams}. Error: {ex.Message}", ex);
                        }
                    }

                    // Query DB count immediately after inserting this table's rows
                    using var checkCmd = connection.CreateCommand();
                    checkCmd.Transaction = transaction;
                    checkCmd.CommandText = $"SELECT COUNT(*) FROM \"{schemaName}\".\"{tableName}\";";
                    var countAfterInsert = Convert.ToInt64(await checkCmd.ExecuteScalarAsync());

                    Console.WriteLine("=========================================================");
                    Console.WriteLine("[INSERT TABLE]");
                    Console.WriteLine($"Table: {tableName}");
                    Console.WriteLine($"Expected Rows: {expectedRows}");
                    Console.WriteLine($"Inserted Rows: {insertedCount}");
                    Console.WriteLine($"Database Rows: {countAfterInsert}");
                    Console.WriteLine("=========================================================");

                    if (countAfterInsert != expectedRows)
                    {
                        Console.WriteLine($"[CRITICAL ERROR]: Table '{tableName}' DB Count is {countAfterInsert}, expected {expectedRows}!");
                        throw new InvalidOperationException($"CRITICAL INTEGRITY FAILURE: Table '{tableName}' row count after insert ({countAfterInsert}) does not match expected snapshot count ({expectedRows}). Restore aborted.");
                    }

                    if (tableName.Equals("WaterTestReports", StringComparison.OrdinalIgnoreCase))
                    {
                        await LogWaterTestReportsSnapshotAsync(connection, transaction, "AFTER INSERT", schemaName);
                    }
                }

                // C. Log Final Rows Before Commit
                Console.WriteLine("[RESTORE ENGINE: FINAL CHECK BEFORE COMMIT]");
                foreach (var tableName in sortedTables)
                {
                    var policy = GetTableRestorePolicy(tableName);
                    if (policy == RestorePolicy.Skip) continue;
                    if (!tableContents.TryGetValue(tableName, out var rows)) continue;

                    using var countCmd = connection.CreateCommand();
                    countCmd.Transaction = transaction;
                    countCmd.CommandText = $"SELECT COUNT(*) FROM \"{schemaName}\".\"{tableName}\";";
                    var dbCount = Convert.ToInt64(await countCmd.ExecuteScalarAsync());
                    Console.WriteLine($"  Table: {tableName,-25} | Final Count Before Commit: {dbCount,5} | Expected: {rows.Count,5}");
                    
                    if (dbCount != rows.Count)
                    {
                        throw new InvalidOperationException($"CRITICAL INTEGRITY ERROR: Pre-commit verification failed for '{tableName}'. Backup payload contained {rows.Count} rows, but DB contains {dbCount} rows. Restore aborted.");
                    }
                }

                // D. Reset Identity Sequences
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

                await LogUserRolesSnapshotAsync(connection, transaction, "BEFORE COMMIT", schemaName);
                await LogWaterTestReportsSnapshotAsync(connection, transaction, "BEFORE COMMIT", schemaName);

                // COMMIT TRANSACTION
                transaction.Commit();
                Console.WriteLine("=========================================================");
                Console.WriteLine("[COMMIT]");
                Console.WriteLine("Transaction.Commit() executed successfully.");
                Console.WriteLine("=========================================================");

                using (var afterConn = CreateDedicatedConnection())
                {
                    await OpenDedicatedConnectionAsync(afterConn, "RestoreBackupAsync (After Commit Snapshot)", "BackupService.cs", 886, schemaName);
                    await LogUserRolesSnapshotAsync(afterConn, null, "IMMEDIATELY AFTER COMMIT", schemaName);
                    await LogWaterTestReportsSnapshotAsync(afterConn, null, "IMMEDIATELY AFTER COMMIT", schemaName);
                }

                await Task.Delay(2000);

                using (var delayConn = CreateDedicatedConnection())
                {
                    await OpenDedicatedConnectionAsync(delayConn, "RestoreBackupAsync (2s Delay Snapshot)", "BackupService.cs", 894, schemaName);
                    await LogUserRolesSnapshotAsync(delayConn, null, "2 SECONDS AFTER COMMIT", schemaName);
                    await LogWaterTestReportsSnapshotAsync(delayConn, null, "2 SECONDS AFTER COMMIT", schemaName);
                }

                // E. POST-COMMIT ISOLATED FRESH CONNECTION VERIFICATION
                using (var freshConn = CreateDedicatedConnection())
                {
                    await OpenDedicatedConnectionAsync(freshConn, "RestoreBackupAsync (Fresh Verification Connection)", "BackupService.cs", 840, schemaName);
                    var freshProcId = freshConn.GetType().GetProperty("ProcessID")?.GetValue(freshConn);

                    using var freshCmd = freshConn.CreateCommand();
                    freshCmd.CommandText = $"SET search_path TO \"{schemaName}\";";
                    await freshCmd.ExecuteNonQueryAsync();

                    foreach (var tableName in sortedTables)
                    {
                        var policy = GetTableRestorePolicy(tableName);
                        if (policy == RestorePolicy.Skip) continue;
                        if (!tableContents.TryGetValue(tableName, out var rows)) continue;

                        freshCmd.CommandText = $"SELECT COUNT(*) FROM \"{schemaName}\".\"{tableName}\";";
                        var freshCount = Convert.ToInt64(await freshCmd.ExecuteScalarAsync());
                        var expected = rows.Count;

                        bool pass = freshCount == expected;
                        Console.WriteLine("=========================================================");
                        Console.WriteLine("[FRESH VERIFICATION]");
                        Console.WriteLine($"Table: {tableName}");
                        Console.WriteLine($"Expected: {expected}");
                        Console.WriteLine($"Actual: {freshCount}");
                        Console.WriteLine($"Result: {(pass ? "PASS" : "FAIL")}");
                        Console.WriteLine("=========================================================");

                        if (!pass)
                        {
                            Console.WriteLine($"[CRITICAL FAILURE]: Post-commit fresh DB query for '{tableName}' returned {freshCount} rows, but Backup Preview expected {expected} rows!");
                            throw new InvalidOperationException($"CRITICAL POST-COMMIT RESTORE FAILURE: Table '{tableName}' contains {freshCount} rows in database after commit, but backup preview contains {expected} rows. Restore failed!");
                        }
                    }

                    await LogWaterTestReportsSnapshotAsync(freshConn, null, "FRESH VERIFICATION CONNECTION", schemaName);

                    if (tableContents.TryGetValue("WaterTestReports", out var backupWaterReports))
                    {
                        await PerformWaterTestReportsIdentityComparisonAsync(backupWaterReports, freshConn, null, "FRESH VERIFICATION", schemaName);
                    }
                }

                Console.WriteLine("Fresh verification executed successfully. No authentication failures.");

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
                try { transaction.Rollback(); } catch { }
                await LogFailedRestoreAsync(backupId, schemaName, currentUserId, startTime, ex.Message);
                Console.WriteLine($"[RESTORE ENGINE FAILURE]: {ex.Message}");
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
            Console.WriteLine($"[RESTORE METHOD ENTERED]: PreviewRestoreAsync | Source File: BackupService.cs | Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            var tenantId = _tenantProvider.TenantId;
            var schemaName = _tenantProvider.TenantSchemaName;
            var backup = await _platformContext.BackupHistories
                .FirstOrDefaultAsync(h => h.Id == id && h.TenantId == tenantId && !h.IsDeleted);

            if (backup == null || !File.Exists(backup.FilePath)) throw new KeyNotFoundException($"Backup with ID '{id}' not found or file missing on disk.");
            if (backup.Format != "AQB") throw new InvalidOperationException("Only AQB exports can be previewed for UI restore.");

            byte[] encryptedBytes = await File.ReadAllBytesAsync(backup.FilePath);
            string calculatedChecksum = ComputeSHA256(encryptedBytes);

            int waterReportsCount = 0;
            int purchasePaymentsCount = 0;
            try
            {
                byte[] tempRawZip = DecryptBytes(encryptedBytes);
                using var tempMs = new MemoryStream(tempRawZip);
                using var tempArchive = new ZipArchive(tempMs, ZipArchiveMode.Read);
                foreach (var entry in tempArchive.Entries)
                {
                    if (entry.FullName.Equals("tables/WaterTestReports.json", StringComparison.OrdinalIgnoreCase))
                    {
                        using var s = entry.Open();
                        using var doc = System.Text.Json.JsonDocument.Parse(s);
                        waterReportsCount = doc.RootElement.GetArrayLength();
                    }
                    if (entry.FullName.Equals("tables/PurchasePayments.json", StringComparison.OrdinalIgnoreCase))
                    {
                        using var s = entry.Open();
                        using var doc = System.Text.Json.JsonDocument.Parse(s);
                        purchasePaymentsCount = doc.RootElement.GetArrayLength();
                    }
                }
            }
            catch { }

            Console.WriteLine("=========================================================");
            Console.WriteLine("[PREVIEW SELECTION AUDIT]");
            Console.WriteLine($"Requested BackupId:                       {id}");
            Console.WriteLine($"BackupId received by API:                 {id}");
            Console.WriteLine($"BackupHistory.Id:                         {backup.Id}");
            Console.WriteLine($"BackupHistory.Name:                       {backup.BackupName}");
            Console.WriteLine($"BackupHistory.CreatedAt:                  {backup.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC");
            Console.WriteLine($"BackupHistory.FilePath:                   {backup.FilePath}");
            Console.WriteLine($"BackupHistory.Hash:                       {backup.Hash ?? backup.Checksum}");
            Console.WriteLine($"Actual file opened:                       {backup.FilePath}");
            Console.WriteLine($"SHA256 of opened file:                    {calculatedChecksum}");
            Console.WriteLine($"WaterTestReports count inside that file:   {waterReportsCount}");
            Console.WriteLine($"PurchasePayments count inside that file:  {purchasePaymentsCount}");
            Console.WriteLine("=========================================================");

            if (!string.Equals(calculatedChecksum, backup.Checksum, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Backup preview checksum validation failed. Physical file checksum does not match BackupHistory database record.");
            }

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
            using var connection = CreateDedicatedConnection();
            await OpenDedicatedConnectionAsync(connection, "GetRestorePreviewAsync", "BackupService.cs", 1154);
            
            foreach(var tbl in currentTables)
            {
                using var cmd = connection.CreateCommand();
                cmd.CommandText = $"SELECT COUNT(1) FROM \"{schemaName}\".\"{tbl}\"";
                currentRecs += Convert.ToInt64(await cmd.ExecuteScalarAsync());
            }
            dto.CurrentRecords = (int)currentRecs;

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

        private System.Data.Common.DbConnection CreateDedicatedConnection(
            [System.Runtime.CompilerServices.CallerMemberName] string callerMethod = "",
            [System.Runtime.CompilerServices.CallerFilePath] string file = "",
            [System.Runtime.CompilerServices.CallerLineNumber] int lineNumber = 0)
        {
            Console.WriteLine($"[RESTORE METHOD ENTERED]: CreateDedicatedConnection | Source File: BackupService.cs | Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            
            var dbContext = _context as Microsoft.EntityFrameworkCore.DbContext;
            string connectionSource = "□ Database.GetConnectionString()";
            string? connStr = dbContext?.Database.GetConnectionString();

            if (string.IsNullOrWhiteSpace(connStr))
            {
                connectionSource = "□ IConfiguration (DefaultConnection)";
                connStr = _configuration.GetConnectionString("DefaultConnection");
            }

            if (string.IsNullOrWhiteSpace(connStr))
            {
                connectionSource = "□ ConnectionStrings:DefaultConnection";
                connStr = _configuration["ConnectionStrings:DefaultConnection"];
            }

            if (string.IsNullOrWhiteSpace(connStr))
            {
                throw new InvalidOperationException("No database connection string configured.");
            }

            var connType = _context.Database.GetDbConnection().GetType();
            var conn = (System.Data.Common.DbConnection)Activator.CreateInstance(connType, connStr)!;

            bool hasPassword = connStr.Contains("Password=", StringComparison.OrdinalIgnoreCase) || 
                               connStr.Contains("Pwd=", StringComparison.OrdinalIgnoreCase);

            Console.WriteLine("=========================================================");
            Console.WriteLine("[CREATE DEDICATED CONNECTION]");
            Console.WriteLine($"Method: {callerMethod}");
            Console.WriteLine($"Source File: {System.IO.Path.GetFileName(file)}");
            Console.WriteLine($"Line Number: {lineNumber}");
            Console.WriteLine($"Connection Source:\n{connectionSource}");
            Console.WriteLine($"Connection Type: {conn.GetType().FullName}");
            Console.WriteLine($"Connection String Contains Password: {(hasPassword ? "YES" : "NO")}");
            Console.WriteLine($"Connection String Length: {connStr.Length}");
            Console.WriteLine($"Thread Id: {System.Environment.CurrentManagedThreadId}");
            Console.WriteLine($"Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            Console.WriteLine("=========================================================");

            return conn;
        }

        private async Task OpenDedicatedConnectionAsync(
            System.Data.Common.DbConnection connection,
            string callerMethod,
            string file,
            int lineNumber,
            string schemaName = "")
        {
            var connStr = connection.ConnectionString ?? "";
            bool hasPassword = connStr.Contains("Password=", StringComparison.OrdinalIgnoreCase) || connStr.Contains("Pwd=", StringComparison.OrdinalIgnoreCase);

            Console.WriteLine("=========================================================");
            Console.WriteLine("[DB OPEN TRACE]");
            Console.WriteLine($"Caller Method: {callerMethod}");
            Console.WriteLine($"Source File: {System.IO.Path.GetFileName(file)}");
            Console.WriteLine($"Line Number: {lineNumber}");
            Console.WriteLine($"Connection Type: {connection.GetType().FullName}");
            Console.WriteLine($"Database: {connection.Database}");
            Console.WriteLine($"Host: {connection.DataSource}");
            Console.WriteLine($"Connection State: {connection.State}");
            Console.WriteLine($"Has Password: {(hasPassword ? "YES" : "NO")}");
            Console.WriteLine($"Connection String Length: {connStr.Length}");
            Console.WriteLine($"Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            Console.WriteLine("Stack Trace:");
            Console.WriteLine(Environment.StackTrace);
            Console.WriteLine("=========================================================");

            Console.WriteLine("=========================================================");
            Console.WriteLine("[OPENING DEDICATED CONNECTION]");
            Console.WriteLine($"Method: {callerMethod}");
            Console.WriteLine($"Connection State: {connection.State}");
            Console.WriteLine($"Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            Console.WriteLine("=========================================================");

            try
            {
                await connection.OpenAsync();

                var processId = connection.GetType().GetProperty("ProcessID")?.GetValue(connection);

                Console.WriteLine("=========================================================");
                Console.WriteLine("[DEDICATED CONNECTION OPENED SUCCESSFULLY]");
                Console.WriteLine($"Connection State: {connection.State}");
                Console.WriteLine($"Process Id: {processId ?? "N/A"}");
                Console.WriteLine($"Database: {connection.Database}");
                Console.WriteLine($"Host: {connection.DataSource}");
                Console.WriteLine($"Schema: {(string.IsNullOrEmpty(schemaName) ? "N/A" : schemaName)}");
                Console.WriteLine($"Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
                Console.WriteLine("=========================================================");
            }
            catch (Exception ex)
            {
                Console.WriteLine("=========================================================");
                Console.WriteLine("[DEDICATED CONNECTION FAILED]");
                Console.WriteLine($"Exception Type: {ex.GetType().FullName}");
                Console.WriteLine($"Message: {ex.Message}");
                Console.WriteLine($"Caller Method: {callerMethod}");
                Console.WriteLine($"Source File: {System.IO.Path.GetFileName(file)}");
                Console.WriteLine($"Line Number: {lineNumber}");
                Console.WriteLine("Complete Stack Trace:");
                Console.WriteLine(ex.ToString());
                Console.WriteLine("=========================================================");
                throw;
            }
        }

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

        private async Task<List<string>> GetTenantTablesAsync(string schemaName, System.Data.Common.DbTransaction? transaction = null)
        {
            Console.WriteLine($"[RESTORE METHOD ENTERED]: GetTenantTablesAsync | Source File: BackupService.cs | Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            var tables = new List<string>();
            System.Data.Common.DbConnection connection;
            bool shouldDispose = false;

            if (transaction != null)
            {
                connection = transaction.Connection!;
            }
            else
            {
                connection = CreateDedicatedConnection();
                shouldDispose = true;
                await OpenDedicatedConnectionAsync(connection, "GetTenantTablesAsync", "BackupService.cs", 1244, schemaName);
            }

            try
            {
                using var cmd = connection.CreateCommand();
                if (transaction != null)
                {
                    cmd.Transaction = transaction;
                }
                
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
            finally
            {
                if (shouldDispose)
                {
                    await connection.DisposeAsync();
                }
            }
        }

        private async Task<List<Dictionary<string, object>>> ExportTableDataAsync(string schemaName, string tableName)
        {
            Console.WriteLine($"[RESTORE METHOD ENTERED]: ExportTableDataAsync | Source File: BackupService.cs | Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            var rows = new List<Dictionary<string, object>>();
            using var connection = CreateDedicatedConnection();
            await OpenDedicatedConnectionAsync(connection, "ExportTableDataAsync", "BackupService.cs", 1282, schemaName);

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

        private static (object, DbType) ConvertToPgType(object rawVal, string dbType)
        {
            if (rawVal == null) return (null, DbType.Object);

            string strVal = rawVal.ToString() ?? "";

            if (dbType.Contains("uuid"))
            {
                if (Guid.TryParse(strVal, out Guid g)) return (g, DbType.Guid);
                return (null, DbType.Guid);
            }
            if (dbType.Contains("int8") || dbType.Contains("bigint"))
            {
                if (long.TryParse(strVal, out long l)) return (l, DbType.Int64);
                return (null, DbType.Int64);
            }
            if (dbType.Contains("int4") || dbType.Contains("integer"))
            {
                if (int.TryParse(strVal, out int i)) return (i, DbType.Int32);
                return (null, DbType.Int32);
            }
            if (dbType.Contains("numeric") || dbType.Contains("decimal"))
            {
                if (decimal.TryParse(strVal, out decimal d)) return (d, DbType.Decimal);
                return (null, DbType.Decimal);
            }
            if (dbType.Contains("float") || dbType.Contains("double precision"))
            {
                if (double.TryParse(strVal, out double d)) return (d, DbType.Double);
                return (null, DbType.Double);
            }
            if (dbType.Contains("bool") || dbType.Contains("boolean"))
            {
                if (bool.TryParse(strVal, out bool b)) return (b, DbType.Boolean);
                if (strVal == "1" || strVal.Equals("true", StringComparison.OrdinalIgnoreCase)) return (true, DbType.Boolean);
                if (strVal == "0" || strVal.Equals("false", StringComparison.OrdinalIgnoreCase)) return (false, DbType.Boolean);
                return (null, DbType.Boolean);
            }
            if (dbType.Contains("timestamp"))
            {
                if (DateTime.TryParse(strVal, out DateTime dt))
                {
                    if (dt.Kind == DateTimeKind.Unspecified) dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
                    else if (dt.Kind == DateTimeKind.Local) dt = dt.ToUniversalTime();
                    return (dt, DbType.DateTimeOffset);
                }
                return (null, DbType.DateTime);
            }
            if (dbType.Contains("date"))
            {
                if (DateOnly.TryParse(strVal, out DateOnly d)) return (d, DbType.Date);
                return (null, DbType.Date);
            }
            if (dbType.Contains("time"))
            {
                if (TimeOnly.TryParse(strVal, out TimeOnly t)) return (t, DbType.Time);
                return (null, DbType.Time);
            }
            if (dbType.Contains("json"))
            {
                return (strVal, DbType.String);
            }
            if (dbType.Contains("bytea"))
            {
                try { return (Convert.FromBase64String(strVal), DbType.Binary); } catch { return (null, DbType.Binary); }
            }

            return (strVal, DbType.String);
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
                using var connection = CreateDedicatedConnection();
                await OpenDedicatedConnectionAsync(connection, "CreateAuditLogAsync", "BackupService.cs", 1681);

                using var cmd = connection.CreateCommand();
                cmd.CommandText = @"
                    INSERT INTO public.""PlatformAuditLogs"" (""Id"", ""Timestamp"", ""UserId"", ""UserEmail"", ""Action"", ""IpAddress"", ""Details"")
                    VALUES (@id, @now, @userId, @email, @action, @ip, @details);";

                var p1 = cmd.CreateParameter(); p1.ParameterName = "@id"; p1.Value = Guid.NewGuid(); cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@now"; p2.Value = DateTime.UtcNow; cmd.Parameters.Add(p2);
                var p3 = cmd.CreateParameter(); p3.ParameterName = "@userId"; p3.Value = _currentUserContext.UserId ?? "System"; cmd.Parameters.Add(p3);
                var p4 = cmd.CreateParameter(); p4.ParameterName = "@email"; p4.Value = _currentUserContext.Email ?? "system@aquora.internal"; cmd.Parameters.Add(p4);
                var p5 = cmd.CreateParameter(); p5.ParameterName = "@action"; p5.Value = action; cmd.Parameters.Add(p5);
                var p6 = cmd.CreateParameter(); p6.ParameterName = "@ip"; p6.Value = _currentUserContext.IpAddress ?? "127.0.0.1"; cmd.Parameters.Add(p6);
                var p7 = cmd.CreateParameter(); p7.ParameterName = "@details"; p7.Value = details; cmd.Parameters.Add(p7);

                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
        }

        private async Task<Dictionary<string, string>> ResolveUserNamesAsync(IEnumerable<string> userIds)
        {
            var ids = userIds.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
            if (!ids.Any()) return new Dictionary<string, string>();

            var result = new Dictionary<string, string>();
            try
            {
                using var connection = CreateDedicatedConnection();
                await OpenDedicatedConnectionAsync(connection, "ResolveUserNamesAsync", "BackupService.cs", 1706);

                using var cmd = connection.CreateCommand();
                cmd.CommandText = @"SELECT ""Id"", ""FirstName"", ""LastName"", ""Username"", ""Email"" FROM public.""Users"";";

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var idStr = reader.GetValue(0)?.ToString();
                    if (idStr == null || !ids.Contains(idStr)) continue;

                    var firstName = reader.IsDBNull(1) ? null : reader.GetString(1);
                    var lastName = reader.IsDBNull(2) ? null : reader.GetString(2);
                    var username = reader.IsDBNull(3) ? null : reader.GetString(3);
                    var email = reader.IsDBNull(4) ? null : reader.GetString(4);

                    string fullName = (!string.IsNullOrWhiteSpace(firstName) ? $"{firstName} {lastName}".Trim() : (username ?? email)) ?? "System User";
                    result[idStr] = fullName;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RESOLVE USER NAMES WARN]: {ex.Message}");
            }

            return result;
        }

        private async Task LogUserRolesSnapshotAsync(System.Data.Common.DbConnection connection, System.Data.Common.DbTransaction? transaction, string stage, string schemaName)
        {
            try
            {
                using var cmd = connection.CreateCommand();
                if (transaction != null) cmd.Transaction = transaction;

                cmd.CommandText = $@"SELECT ""Id"", ""UserId"", ""RoleId"", ""TenantId"", ""CreatedAt"", ""CreatedBy"" FROM ""{schemaName}"".""UserRoles"";";
                using var reader = await cmd.ExecuteReaderAsync();

                Console.WriteLine("=========================================================");
                Console.WriteLine($"[USERROLES SNAPSHOT - {stage}]");
                int count = 0;
                while (await reader.ReadAsync())
                {
                    count++;
                    var id = reader.GetValue(0)?.ToString();
                    var userId = reader.GetValue(1)?.ToString();
                    var roleId = reader.GetValue(2)?.ToString();
                    var tenantId = reader.GetValue(3)?.ToString();
                    var createdAt = reader.GetValue(4)?.ToString();
                    var createdBy = reader.GetValue(5)?.ToString();

                    Console.WriteLine($"  Row {count}: Id={id} | UserId={userId} | RoleId={roleId} | TenantId={tenantId} | CreatedAt={createdAt} | CreatedBy={createdBy}");
                }
                Console.WriteLine($"Total UserRoles Rows: {count}");
                Console.WriteLine("=========================================================");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[USERROLES SNAPSHOT WARN]: {ex.Message}");
            }
        }

        private void LogWaterTestReportsArchiveContent(List<Dictionary<string, object>> backupRows)
        {
            Console.WriteLine("=========================================================");
            Console.WriteLine("[WATERTESTREPORTS BACKUP JSON ARCHIVE CONTENT]");
            int count = 0;
            foreach (var row in backupRows)
            {
                count++;
                var id = row.GetValueOrDefault("Id")?.ToString();
                var batchNumber = row.GetValueOrDefault("BatchNumber")?.ToString();
                var sampleNumber = row.GetValueOrDefault("SampleNumber")?.ToString();
                var productionDate = row.GetValueOrDefault("ProductionDate")?.ToString();
                var createdAt = row.GetValueOrDefault("CreatedAt")?.ToString();

                Console.WriteLine($"  Archive Row {count}: Id={id} | BatchNumber={batchNumber} | SampleNumber={sampleNumber} | ProductionDate={productionDate} | CreatedAt={createdAt}");
            }
            Console.WriteLine($"Total WaterTestReports Rows in Archive: {count}");
            Console.WriteLine("=========================================================");
        }

        private async Task LogWaterTestReportsSnapshotAsync(System.Data.Common.DbConnection connection, System.Data.Common.DbTransaction? transaction, string stage, string schemaName)
        {
            try
            {
                using var cmd = connection.CreateCommand();
                if (transaction != null) cmd.Transaction = transaction;

                cmd.CommandText = $@"SELECT ""Id"", ""BatchNumber"", ""SampleNumber"", ""ProductionDate"", ""CreatedAt"" FROM ""{schemaName}"".""WaterTestReports"";";
                using var reader = await cmd.ExecuteReaderAsync();

                Console.WriteLine("=========================================================");
                Console.WriteLine($"[WATERTESTREPORTS SNAPSHOT - {stage}]");
                int count = 0;
                while (await reader.ReadAsync())
                {
                    count++;
                    var id = reader.GetValue(0)?.ToString();
                    var batchNumber = reader.GetValue(1)?.ToString();
                    var sampleNumber = reader.GetValue(2)?.ToString();
                    var productionDate = reader.GetValue(3)?.ToString();
                    var createdAt = reader.GetValue(4)?.ToString();

                    Console.WriteLine($"  Row {count}: Id={id} | BatchNumber={batchNumber} | SampleNumber={sampleNumber} | ProductionDate={productionDate} | CreatedAt={createdAt}");
                }
                Console.WriteLine($"Total WaterTestReports Rows in DB ({stage}): {count}");
                Console.WriteLine("=========================================================");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WATERTESTREPORTS SNAPSHOT WARN]: {ex.Message}");
            }
        }

        private async Task PerformWaterTestReportsIdentityComparisonAsync(
            List<Dictionary<string, object>> backupRows,
            System.Data.Common.DbConnection connection,
            System.Data.Common.DbTransaction? transaction,
            string stage,
            string schemaName)
        {
            var backupIds = backupRows
                .Select(r => r.GetValueOrDefault("Id")?.ToString()?.Trim())
                .Where(id => !string.IsNullOrEmpty(id))
                .ToList()!;

            var dbRows = new List<(string Id, string BatchNumber, string SampleNumber, string ProductionDate, string CreatedAt)>();

            using (var cmd = connection.CreateCommand())
            {
                if (transaction != null) cmd.Transaction = transaction;
                cmd.CommandText = $@"SELECT ""Id"", ""BatchNumber"", ""SampleNumber"", ""ProductionDate"", ""CreatedAt"" FROM ""{schemaName}"".""WaterTestReports"";";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    dbRows.Add((
                        reader.GetValue(0)?.ToString()?.Trim() ?? "",
                        reader.GetValue(1)?.ToString() ?? "",
                        reader.GetValue(2)?.ToString() ?? "",
                        reader.GetValue(3)?.ToString() ?? "",
                        reader.GetValue(4)?.ToString() ?? ""
                    ));
                }
            }

            var dbIds = dbRows.Select(r => r.Id).ToList();

            var backupIdSet = new HashSet<string>(backupIds, StringComparer.OrdinalIgnoreCase);
            var dbIdSet = new HashSet<string>(dbIds, StringComparer.OrdinalIgnoreCase);

            var rowsOnlyInBackup = backupIds.Where(id => !dbIdSet.Contains(id)).Distinct().ToList();
            var rowsOnlyInDb = dbRows.Where(r => !backupIdSet.Contains(r.Id)).ToList();

            var backupDuplicates = backupIds.GroupBy(x => x, StringComparer.OrdinalIgnoreCase).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
            var dbDuplicates = dbIds.GroupBy(x => x, StringComparer.OrdinalIgnoreCase).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
            var missingInDb = rowsOnlyInBackup;

            Console.WriteLine("=========================================================");
            Console.WriteLine($"[IDENTITY-LEVEL COMPARISON: WATERTESTREPORTS ({stage})]");
            Console.WriteLine($"Backup Record Count:   {backupIds.Count}");
            Console.WriteLine($"Database Record Count: {dbIds.Count}");
            Console.WriteLine("---------------------------------------------------------");
            Console.WriteLine($"Rows ONLY in Backup ({rowsOnlyInBackup.Count}):");
            foreach (var bId in rowsOnlyInBackup)
            {
                Console.WriteLine($"  - Id: {bId}");
            }
            Console.WriteLine("---------------------------------------------------------");
            Console.WriteLine($"Rows ONLY in Database ({rowsOnlyInDb.Count}):");
            foreach (var dRow in rowsOnlyInDb)
            {
                Console.WriteLine($"  - EXTRA ROW -> Id: {dRow.Id} | BatchNumber: {dRow.BatchNumber} | SampleNumber: {dRow.SampleNumber} | ProductionDate: {dRow.ProductionDate} | CreatedAt: {dRow.CreatedAt}");
            }
            Console.WriteLine("---------------------------------------------------------");
            Console.WriteLine($"Rows Duplicated in Backup:   {(backupDuplicates.Any() ? string.Join(", ", backupDuplicates) : "None")}");
            Console.WriteLine($"Rows Duplicated in Database: {(dbDuplicates.Any() ? string.Join(", ", dbDuplicates) : "None")}");
            Console.WriteLine($"Rows Missing from Database:  {(missingInDb.Any() ? string.Join(", ", missingInDb) : "None")}");
            Console.WriteLine("=========================================================");

            if (dbIds.Count != backupIds.Count || rowsOnlyInDb.Any() || rowsOnlyInBackup.Any())
            {
                var extraSummary = rowsOnlyInDb.Any() 
                    ? string.Join("; ", rowsOnlyInDb.Select(r => $"[Extra Row Id={r.Id}, Batch={r.BatchNumber}]"))
                    : "None";

                Console.WriteLine($"[CRITICAL IDENTITY MISMATCH]: Database has {dbIds.Count} WaterTestReports rows, Backup JSON has {backupIds.Count} rows!");
                Console.WriteLine($"[CRITICAL IDENTITY MISMATCH DETAILS]: {extraSummary}");
                throw new InvalidOperationException($"CRITICAL WATERTESTREPORTS IDENTITY MISMATCH: Backup payload has {backupIds.Count} rows, but database contains {dbIds.Count} rows! Extra rows in DB: {extraSummary}");
            }
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
