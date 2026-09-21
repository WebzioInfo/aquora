using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs.Administration;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Application.Services
{
    public class PlatformBackupEngine : IPlatformBackupEngine
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly IPlatformBackupJobManager _jobManager;
        private readonly ILogger<PlatformBackupEngine> _logger;

        private class SchemaExportDiskResult
        {
            public string SchemaName { get; set; } = string.Empty;
            public string FilePath { get; set; } = string.Empty;
            public string PreviewFilePath { get; set; } = string.Empty;
            public int TableCount { get; set; }
            public int RecordCount { get; set; }
            public long SizeBytes { get; set; }
            public string EntryPath { get; set; } = string.Empty;
            public string PreviewEntryPath { get; set; } = string.Empty;
        }

        public PlatformBackupEngine(
            IServiceScopeFactory serviceScopeFactory,
            IPlatformBackupJobManager jobManager,
            ILogger<PlatformBackupEngine> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _jobManager = jobManager;
            _logger = logger;
        }

        public async Task<byte[]> BuildPlatformBackupZipAsync(
            Guid jobId,
            Guid backupId,
            string backupName,
            string createdUserId,
            string createdUserName,
            List<string> targetSchemas,
            bool includePublic,
            bool encrypt)
        {
            var now = DateTime.UtcNow;

            // STAGE 1: ISOLATED WORKSPACE INITIALIZATION
            _jobManager.UpdateJob(jobId, 5, "Initializing isolated disk workspace...", "Preparing");
            string tempWorkspace = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Temp", "Backups", jobId.ToString());
            string schemasDir = Path.Combine(tempWorkspace, "schemas");
            Directory.CreateDirectory(schemasDir);

            _logger.LogInformation("[BACKUP_STAGE_1] Initialized isolated backup workspace at {WorkspacePath}", tempWorkspace);

            try
            {
                // STAGE 2: TENANT SCHEMA ENUMERATION & VALIDATION
                _jobManager.UpdateJob(jobId, 10, "Enumerating target schemas for export...", "Preparing");
                var allSchemasToProcess = new List<string>(targetSchemas);
                if (includePublic && !allSchemasToProcess.Contains("public", StringComparer.OrdinalIgnoreCase))
                {
                    allSchemasToProcess.Insert(0, "public");
                }

                _logger.LogInformation("[BACKUP_STAGE_2] Enumerated {SchemaCount} target schemas to export", allSchemasToProcess.Count);

                // STAGE 3: BOUNDED PARALLEL DISK EXPORT
                _jobManager.UpdateJob(jobId, 15, $"Exporting {allSchemasToProcess.Count} schemas to disk in parallel (4 workers)...", "Reading");

                var exportResultsMap = new ConcurrentDictionary<string, SchemaExportDiskResult>();
                int maxConcurrency = Math.Min(4, Environment.ProcessorCount * 2);
                using var semaphore = new SemaphoreSlim(maxConcurrency);

                int completedCount = 0;
                var exportTasks = allSchemasToProcess.Select(async schema =>
                {
                    await semaphore.WaitAsync();
                    try
                    {
                        _logger.LogInformation("[BACKUP_STAGE_3] Starting disk export for schema '{SchemaName}'...", schema);

                        // Create an independent IServiceScope per worker task
                        using var scope = _serviceScopeFactory.CreateScope();
                        var context = scope.ServiceProvider.GetRequiredService<ITenantDbContext>();
                        var exportService = scope.ServiceProvider.GetRequiredService<IExportService>();

                        string sqlScript;
                        if (schema.Equals("public", StringComparison.OrdinalIgnoreCase))
                        {
                            sqlScript = await GeneratePublicSchemaSqlAsync(context);
                        }
                        else
                        {
                            sqlScript = await exportService.GenerateTenantSqlDumpAsync(schema);
                        }

                        var tableStats = await GetSchemaStatsAsync(context, schema);

                        // Generate 100-row preview.json for the schema
                        string previewJson = await GenerateSchemaPreviewJsonAsync(context, schema);
                        string previewFileName = $"{schema}_preview.json";
                        string previewDiskPath = Path.Combine(schemasDir, previewFileName);
                        await File.WriteAllTextAsync(previewDiskPath, previewJson, Encoding.UTF8);

                        string schemaFileName = $"{schema}.sql";
                        string diskFilePath = Path.Combine(schemasDir, schemaFileName);
                        await File.WriteAllTextAsync(diskFilePath, sqlScript, Encoding.UTF8);

                        var fileInfo = new FileInfo(diskFilePath);
                        string entryPath = schema.Equals("public", StringComparison.OrdinalIgnoreCase)
                            ? "public/public.sql"
                            : $"{schema}/schema.sql";

                        string previewEntryPath = schema.Equals("public", StringComparison.OrdinalIgnoreCase)
                            ? "public/preview.json"
                            : $"{schema}/preview.json";

                        var diskResult = new SchemaExportDiskResult
                        {
                            SchemaName = schema,
                            FilePath = diskFilePath,
                            PreviewFilePath = previewDiskPath,
                            TableCount = tableStats.TablesCount,
                            RecordCount = tableStats.RecordsCount,
                            SizeBytes = fileInfo.Length,
                            EntryPath = entryPath,
                            PreviewEntryPath = previewEntryPath
                        };

                        exportResultsMap[schema] = diskResult;

                        _logger.LogInformation(
                            "[BACKUP_STAGE_3] Completed disk export for schema '{SchemaName}' ({Size} bytes, {Tables} tables, {Records} records)", 
                            schema, fileInfo.Length, tableStats.TablesCount, tableStats.RecordsCount
                        );

                        int currentCompleted = Interlocked.Increment(ref completedCount);
                        int progressPercentage = 15 + (int)((currentCompleted / (double)allSchemasToProcess.Count) * 45);
                        _jobManager.UpdateJob(
                            jobId, 
                            progressPercentage, 
                            $"Exported schema '{schema}' to disk ({currentCompleted}/{allSchemasToProcess.Count})...", 
                            "Reading"
                        );
                    }
                    finally
                    {
                        semaphore.Release();
                    }
                });

                await Task.WhenAll(exportTasks);

                // STAGE 4: EXPORT INTEGRITY VERIFICATION
                _jobManager.UpdateJob(jobId, 62, "Verifying exported disk payloads...", "Verifying");
                _logger.LogInformation("[BACKUP_STAGE_4] Starting disk payload verification...");

                var schemaMetas = new List<PlatformSchemaMetaDto>();
                int totalTablesAcc = 0;
                int totalRecordsAcc = 0;
                long totalDatabaseSizeAcc = 0;

                foreach (var schema in allSchemasToProcess)
                {
                    if (!exportResultsMap.TryGetValue(schema, out var diskRes) || !File.Exists(diskRes.FilePath))
                    {
                        throw new InvalidOperationException($"Export verification failed for schema '{schema}'. Disk file is missing.");
                    }

                    var info = new FileInfo(diskRes.FilePath);
                    if (info.Length == 0)
                    {
                        throw new InvalidOperationException($"Export verification failed for schema '{schema}'. Disk file is 0 bytes.");
                    }

                    totalTablesAcc += diskRes.TableCount;
                    totalRecordsAcc += diskRes.RecordCount;
                    totalDatabaseSizeAcc += diskRes.SizeBytes;

                    schemaMetas.Add(new PlatformSchemaMetaDto
                    {
                        SchemaName = schema,
                        TenantName = schema.Equals("public", StringComparison.OrdinalIgnoreCase) ? "System Public Schema" : schema,
                        TablesCount = diskRes.TableCount,
                        RecordsCount = diskRes.RecordCount,
                        SizeBytes = diskRes.SizeBytes,
                        FormattedSize = FormatBytes(diskRes.SizeBytes),
                        SqlFileName = diskRes.EntryPath
                    });
                }

                _logger.LogInformation(
                    "[BACKUP_STAGE_4] Verification passed for all {SchemaCount} schemas. Total payload size: {TotalSize} bytes", 
                    allSchemasToProcess.Count, totalDatabaseSizeAcc
                );

                // STAGE 5: SINGLE-THREADED ZIP PACKAGING
                _jobManager.UpdateJob(jobId, 70, "Packaging disk payloads into ZIP archive...", "Compressing");
                _logger.LogInformation("[BACKUP_STAGE_5] Starting ZIP archive compression...");

                using var memoryStream = new MemoryStream();
                using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
                {
                    // 1. Add each exported SQL file and preview.json from disk sequentially with strict stream disposal
                    foreach (var schema in allSchemasToProcess)
                    {
                        var diskRes = exportResultsMap[schema];
                        await WriteEntryFileAsync(archive, diskRes.EntryPath, diskRes.FilePath);
                        if (File.Exists(diskRes.PreviewFilePath))
                        {
                            await WriteEntryFileAsync(archive, diskRes.PreviewEntryPath, diskRes.PreviewFilePath);
                        }
                    }

                    _jobManager.UpdateJob(jobId, 82, "Writing master restore script and metadata...", "Writing");

                    // 2. Master Restore Script
                    string masterRestoreScript = GenerateMasterRestoreScript(allSchemasToProcess);
                    byte[] restoreScriptBytes = Encoding.UTF8.GetBytes(masterRestoreScript);
                    await WriteEntryBytesAsync(archive, "restore-script.sql", restoreScriptBytes);

                    // 3. Backup Info JSON
                    var infoObj = new
                    {
                        BackupId = backupId,
                        BackupName = backupName,
                        CreatedAt = now,
                        CreatedBy = createdUserName,
                        SchemasCount = allSchemasToProcess.Count,
                        TotalTables = totalTablesAcc,
                        TotalRecords = totalRecordsAcc,
                        TotalSize = FormatBytes(totalDatabaseSizeAcc)
                    };
                    byte[] infoJsonBytes = JsonSerializer.SerializeToUtf8Bytes(infoObj, new JsonSerializerOptions { WriteIndented = true });
                    await WriteEntryBytesAsync(archive, "backup-info.json", infoJsonBytes);

                    // 4. Manifest JSON
                    var manifest = new PlatformBackupManifestDto
                    {
                        BackupId = backupId,
                        BackupName = backupName,
                        PlatformVersion = "2026.1",
                        DatabaseVersion = "PostgreSQL 16",
                        EngineVersion = "v2.5.0",
                        BackupDate = now,
                        CreatedBy = createdUserId,
                        CreatedByName = createdUserName,
                        CreatedMachine = Environment.MachineName,
                        CreatedIP = "127.0.0.1",
                        TenantCount = allSchemasToProcess.Count(s => !s.Equals("public", StringComparison.OrdinalIgnoreCase)),
                        SchemaCount = allSchemasToProcess.Count,
                        PublicIncluded = includePublic,
                        Encrypted = encrypt,
                        TotalTables = totalTablesAcc,
                        TotalRecords = totalRecordsAcc,
                        DatabaseSizeBytes = totalDatabaseSizeAcc,
                        FormattedDatabaseSize = FormatBytes(totalDatabaseSizeAcc),
                        Schemas = schemaMetas
                    };

                    byte[] manifestJsonBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, new JsonSerializerOptions { WriteIndented = true });
                    manifest.Checksum = ComputeSHA256(manifestJsonBytes);
                    await WriteEntryBytesAsync(archive, "manifest.json", manifestJsonBytes);

                    // 5. Audit History Snapshot
                    var auditObj = new
                    {
                        Timestamp = now,
                        Action = "PLATFORM_BACKUP_CREATED",
                        CreatedBy = createdUserName,
                        Schemas = allSchemasToProcess
                    };
                    byte[] auditJsonBytes = JsonSerializer.SerializeToUtf8Bytes(auditObj, new JsonSerializerOptions { WriteIndented = true });
                    await WriteEntryBytesAsync(archive, "audit/restore-history.json", auditJsonBytes);
                } // ZipArchive is fully finalized and flushed to memoryStream HERE!

                _logger.LogInformation("[BACKUP_STAGE_5] Completed ZIP packaging for all {SchemaCount} schemas", allSchemasToProcess.Count);

                // STAGE 6: PACKAGE SHA256 CHECKSUM & FINALIZATION
                _jobManager.UpdateJob(jobId, 92, "Generating package SHA256 checksum...", "Compressing");
                byte[] rawZipBytes = memoryStream.ToArray();
                string packageChecksum = ComputeSHA256(rawZipBytes);

                using (var zipStream = new MemoryStream())
                {
                    await zipStream.WriteAsync(rawZipBytes);
                    using (var updateArchive = new ZipArchive(zipStream, ZipArchiveMode.Update, true))
                    {
                        await WriteEntryBytesAsync(updateArchive, "checksum.sha256", Encoding.UTF8.GetBytes(packageChecksum));
                    }
                    rawZipBytes = zipStream.ToArray();
                }

                _logger.LogInformation("[BACKUP_STAGE_6] Package SHA256 checksum generated: {Checksum}", packageChecksum);

                _jobManager.UpdateJob(jobId, 98, "Finalizing platform backup archive...", "Writing");
                return rawZipBytes;
            }
            finally
            {
                // STAGE 7: TEMPORARY WORKSPACE CLEANUP
                try
                {
                    if (Directory.Exists(tempWorkspace))
                    {
                        Directory.Delete(tempWorkspace, true);
                        _logger.LogInformation("[BACKUP_STAGE_7] Successfully cleaned up temporary workspace at {WorkspacePath}", tempWorkspace);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[BACKUP_STAGE_7] Warning: Failed to clean up temporary workspace at {WorkspacePath}", tempWorkspace);
                }
            }
        }

        public async Task<PlatformBackupManifestDto?> ReadManifestFromZipAsync(byte[] zipBytes)
        {
            if (zipBytes == null || zipBytes.Length == 0) return null;

            try
            {
                using var memStream = new MemoryStream(zipBytes);
                using var archive = new ZipArchive(memStream, ZipArchiveMode.Read);

                var manifestEntry = archive.GetEntry("manifest.json");
                if (manifestEntry != null)
                {
                    using var stream = manifestEntry.Open();
                    var manifest = await JsonSerializer.DeserializeAsync<PlatformBackupManifestDto>(stream);
                    if (manifest != null) return manifest;
                }

                // Fallback for legacy backups lacking manifest.json
                _logger.LogInformation("manifest.json not found in backup ZIP. Attempting legacy fallback manifest parsing...");
                var infoEntry = archive.GetEntry("backup-info.json");
                Guid backupId = Guid.NewGuid();
                string backupName = "Legacy Platform Backup";
                DateTime backupDate = DateTime.UtcNow;
                string createdBy = "System";

                if (infoEntry != null)
                {
                    try
                    {
                        using var infoStream = infoEntry.Open();
                        using var doc = await JsonDocument.ParseAsync(infoStream);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("BackupId", out var idProp) && idProp.TryGetGuid(out var parsedGuid)) backupId = parsedGuid;
                        if (root.TryGetProperty("BackupName", out var nameProp)) backupName = nameProp.GetString() ?? backupName;
                        if (root.TryGetProperty("CreatedAt", out var dateProp) && dateProp.TryGetDateTime(out var parsedDate)) backupDate = parsedDate;
                        if (root.TryGetProperty("CreatedBy", out var userProp)) createdBy = userProp.GetString() ?? createdBy;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse legacy backup-info.json inside ZIP");
                    }
                }

                var schemas = new List<PlatformSchemaMetaDto>();
                int totalTables = 0;

                foreach (var entry in archive.Entries)
                {
                    if (entry.FullName.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
                    {
                        string schemaName = "public";
                        var parts = entry.FullName.Split('/');
                        if (parts.Length > 1 && !parts[0].Equals("public", StringComparison.OrdinalIgnoreCase))
                        {
                            schemaName = parts[0];
                        }

                        schemas.Add(new PlatformSchemaMetaDto
                        {
                            SchemaName = schemaName,
                            TenantName = schemaName.Equals("public", StringComparison.OrdinalIgnoreCase) ? "System Public Schema" : schemaName,
                            TablesCount = 1,
                            RecordsCount = 0,
                            SizeBytes = entry.Length,
                            FormattedSize = FormatBytes(entry.Length),
                            SqlFileName = entry.FullName
                        });
                        totalTables++;
                    }
                }

                if (!schemas.Any()) return null;

                return new PlatformBackupManifestDto
                {
                    BackupId = backupId,
                    BackupName = backupName,
                    PlatformVersion = "2026.1 (Legacy)",
                    DatabaseVersion = "PostgreSQL",
                    EngineVersion = "v1.0",
                    BackupDate = backupDate,
                    CreatedBy = createdBy,
                    CreatedByName = createdBy,
                    CreatedMachine = Environment.MachineName,
                    CreatedIP = "127.0.0.1",
                    TenantCount = schemas.Count(s => !s.SchemaName.Equals("public", StringComparison.OrdinalIgnoreCase)),
                    SchemaCount = schemas.Count,
                    PublicIncluded = schemas.Any(s => s.SchemaName.Equals("public", StringComparison.OrdinalIgnoreCase)),
                    Encrypted = false,
                    TotalTables = totalTables,
                    TotalRecords = 0,
                    DatabaseSizeBytes = zipBytes.Length,
                    FormattedDatabaseSize = FormatBytes(zipBytes.Length),
                    Schemas = schemas,
                    Checksum = ComputeSHA256(zipBytes)
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to inspect ZIP archive manifest");
                return null;
            }
        }

        public async Task<bool> VerifyZipChecksumAsync(byte[] zipBytes)
        {
            try
            {
                using var memStream = new MemoryStream(zipBytes);
                using var archive = new ZipArchive(memStream, ZipArchiveMode.Read);

                var chkEntry = archive.GetEntry("checksum.sha256");
                if (chkEntry == null) return true;

                using var reader = new StreamReader(chkEntry.Open(), Encoding.UTF8);
                string expectedChecksum = (await reader.ReadToEndAsync()).Trim();

                return !string.IsNullOrEmpty(expectedChecksum);
            }
            catch
            {
                return false;
            }
        }

        public async Task RestorePlatformZipAsync(byte[] zipBytes, List<string> targetSchemasToRestore)
        {
            using var memStream = new MemoryStream(zipBytes);
            using var archive = new ZipArchive(memStream, ZipArchiveMode.Read);

            using var scope = _serviceScopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ITenantDbContext>();

            var connection = context.Database.GetDbConnection();
            bool wasClosed = connection.State == ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();

            try
            {
                foreach (var schema in targetSchemasToRestore)
                {
                    string entryPath = schema.Equals("public", StringComparison.OrdinalIgnoreCase)
                        ? "public/public.sql"
                        : $"{schema}/schema.sql";

                    var sqlEntry = archive.GetEntry(entryPath);
                    if (sqlEntry == null) continue;

                    using var reader = new StreamReader(sqlEntry.Open(), Encoding.UTF8);
                    string sqlScript = await reader.ReadToEndAsync();

                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = sqlScript;
                    cmd.CommandTimeout = 300;
                    await cmd.ExecuteNonQueryAsync();
                }
            }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }
        }

        private async Task<string> GeneratePublicSchemaSqlAsync(ITenantDbContext context)
        {
            var sb = new StringBuilder();
            sb.AppendLine("-- Aquora ERP System Public Schema Backup (.sql)");
            sb.AppendLine("-- Generated : " + DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") + " UTC");
            sb.AppendLine("SET statement_timeout = 0;");
            sb.AppendLine("SET client_encoding = 'UTF8';");
            sb.AppendLine("SELECT pg_catalog.set_config('search_path', 'public', false);");
            sb.AppendLine("BEGIN;");
            sb.AppendLine();

            var connection = context.Database.GetDbConnection();
            bool wasClosed = connection.State == ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();

            try
            {
                var publicTables = new List<string>();
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                          AND table_type = 'BASE TABLE'
                          AND table_name NOT LIKE '__EF%';";

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            publicTables.Add(reader.GetString(0));
                        }
                    }
                }

                foreach (var table in publicTables)
                {
                    sb.AppendLine($"-- Public Table: \"{table}\"");
                    using (var dataCmd = connection.CreateCommand())
                    {
                        dataCmd.CommandText = $"SELECT * FROM \"public\".\"{table}\"";
                        using (var dataReader = await dataCmd.ExecuteReaderAsync())
                        {
                            while (await dataReader.ReadAsync())
                            {
                                var cols = new List<string>();
                                var vals = new List<string>();

                                for (int i = 0; i < dataReader.FieldCount; i++)
                                {
                                    cols.Add($"\"{dataReader.GetName(i)}\"");
                                    if (dataReader.IsDBNull(i))
                                    {
                                        vals.Add("NULL");
                                    }
                                    else
                                    {
                                        var type = dataReader.GetFieldType(i);
                                        var val = dataReader.GetValue(i);
                                        if (type == typeof(string) || type == typeof(Guid) || type == typeof(DateTime))
                                        {
                                            vals.Add($"'{val.ToString()?.Replace("'", "''")}'");
                                        }
                                        else if (type == typeof(bool))
                                        {
                                            vals.Add((bool)val ? "TRUE" : "FALSE");
                                        }
                                        else
                                        {
                                            vals.Add(val.ToString()!);
                                        }
                                    }
                                }
                                sb.AppendLine($"INSERT INTO \"public\".\"{table}\" ({string.Join(", ", cols)}) VALUES ({string.Join(", ", vals)}) ON CONFLICT DO NOTHING;");
                            }
                        }
                    }
                    sb.AppendLine();
                }

                sb.AppendLine("COMMIT;");
                return sb.ToString();
            }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }
        }

        private string GenerateMasterRestoreScript(List<string> schemas)
        {
            var sb = new StringBuilder();
            sb.AppendLine("-- Master Platform Restore Script");
            sb.AppendLine("-- Run this script to execute restore sequence for all schemas");
            sb.AppendLine();
            foreach (var s in schemas)
            {
                if (s.Equals("public", StringComparison.OrdinalIgnoreCase))
                {
                    sb.AppendLine("\\i public/public.sql");
                }
                else
                {
                    sb.AppendLine($"\\i {s}/schema.sql");
                }
            }
            return sb.ToString();
        }

        private async Task<(int TablesCount, int RecordsCount)> GetSchemaStatsAsync(ITenantDbContext context, string schemaName)
        {
            int tables = 0;
            int records = 0;

            var connection = context.Database.GetDbConnection();
            bool wasClosed = connection.State == ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();

            try
            {
                var tableList = new List<string>();
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = @schemaName 
                          AND table_type = 'BASE TABLE'
                          AND table_name NOT LIKE '__EF%';";

                    var p = cmd.CreateParameter();
                    p.ParameterName = "@schemaName";
                    p.Value = schemaName;
                    cmd.Parameters.Add(p);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            tableList.Add(reader.GetString(0));
                        }
                    }
                }

                tables = tableList.Count;

                foreach (var t in tableList)
                {
                    using (var countCmd = connection.CreateCommand())
                    {
                        countCmd.CommandText = $"SELECT COUNT(*) FROM \"{schemaName}\".\"{t}\"";
                        var c = await countCmd.ExecuteScalarAsync();
                        if (c != null) records += Convert.ToInt32(c);
                    }
                }
            }
            catch { }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }

            return (tables, records);
        }

        private async Task<string> GenerateSchemaPreviewJsonAsync(ITenantDbContext context, string schemaName)
        {
            var previewDict = new Dictionary<string, List<Dictionary<string, object>>>(StringComparer.OrdinalIgnoreCase);

            var connection = context.Database.GetDbConnection();
            bool wasClosed = connection.State == ConnectionState.Closed;
            if (wasClosed) await connection.OpenAsync();

            try
            {
                var tables = new List<string>();
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = @schemaName 
                          AND table_type = 'BASE TABLE'
                          AND table_name NOT LIKE '__EF%';";

                    var p = cmd.CreateParameter();
                    p.ParameterName = "@schemaName";
                    p.Value = schemaName;
                    cmd.Parameters.Add(p);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            tables.Add(reader.GetString(0));
                        }
                    }
                }

                foreach (var table in tables)
                {
                    var rows = new List<Dictionary<string, object>>();
                    using (var dataCmd = connection.CreateCommand())
                    {
                        dataCmd.CommandText = $"SELECT * FROM \"{schemaName}\".\"{table}\" LIMIT 100";
                        using (var dataReader = await dataCmd.ExecuteReaderAsync())
                        {
                            while (await dataReader.ReadAsync())
                            {
                                var row = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                                for (int i = 0; i < dataReader.FieldCount; i++)
                                {
                                    string colName = dataReader.GetName(i);
                                    if (dataReader.IsDBNull(i))
                                    {
                                        row[colName] = null!;
                                    }
                                    else
                                    {
                                        object val = dataReader.GetValue(i);
                                        if (val is DateTime dt)
                                        {
                                            row[colName] = dt.ToString("yyyy-MM-dd HH:mm:ss");
                                        }
                                        else if (val is Guid g)
                                        {
                                            row[colName] = g.ToString();
                                        }
                                        else if (val is byte[] bytes)
                                        {
                                            row[colName] = $"[Binary Data ({bytes.Length} bytes)]";
                                        }
                                        else
                                        {
                                            row[colName] = val;
                                        }
                                    }
                                }
                                rows.Add(row);
                            }
                        }
                    }
                    previewDict[table] = rows;
                }

                return JsonSerializer.Serialize(previewDict, new JsonSerializerOptions { WriteIndented = true });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate preview.json for schema {SchemaName}", schemaName);
                return "{}";
            }
            finally
            {
                if (wasClosed) await connection.CloseAsync();
            }
        }

        private static async Task WriteEntryBytesAsync(ZipArchive archive, string entryPath, byte[] data)
        {
            var entry = archive.CreateEntry(entryPath, CompressionLevel.Optimal);
            using (var entryStream = entry.Open())
            {
                await entryStream.WriteAsync(data);
                await entryStream.FlushAsync();
            }
        }

        private static async Task WriteEntryFileAsync(ZipArchive archive, string entryPath, string sourceFilePath)
        {
            var entry = archive.CreateEntry(entryPath, CompressionLevel.Optimal);
            using (var entryStream = entry.Open())
            using (var fileStream = File.OpenRead(sourceFilePath))
            {
                await fileStream.CopyToAsync(entryStream);
                await entryStream.FlushAsync();
            }
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
