using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Collections.Generic;
using System.Threading.Tasks;
using Npgsql;
using Aquora.Domain.Entities.QC;
using Aquora.Application.Services;

namespace Aquora.Persistence.Services
{
    public class HistoricalImportSummary
    {
        public string TargetSchema { get; set; } = string.Empty;
        public string SourceFile { get; set; } = string.Empty;
        public int TotalSourceReports { get; set; }
        public int SuccessfullyImported { get; set; }
        public int SkippedDuplicates { get; set; }
        public int Failed { get; set; }
        public int TotalResultRows { get; set; }
        public int NullOrEmptyResultsPreserved { get; set; }
        public int UnmatchedParametersCount { get; set; }
        public List<string> UnmatchedParameters { get; set; } = new();
        public List<string> ImportedReportNumbers { get; set; } = new();
        public List<string> FailureMessages { get; set; } = new();
    }

    public static class HistoricalWaterTestReportImporter
    {
        private const string REQUIRED_SCHEMA = "aquora_tenant_gangothri_2";

        public static async Task<HistoricalImportSummary> ImportFromSupabaseExportAsync(
            string connectionString, 
            string sourceFilePath, 
            string targetSchemaName = REQUIRED_SCHEMA)
        {
            var summary = new HistoricalImportSummary
            {
                TargetSchema = targetSchemaName,
                SourceFile = sourceFilePath
            };

            // SAFETY GUARD 1: Target schema must strictly be aquora_tenant_gangothri_2
            if (!string.Equals(targetSchemaName, REQUIRED_SCHEMA, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"SAFETY GUARD REJECTION: Historical Water Test Report import is strictly restricted to schema '{REQUIRED_SCHEMA}'. Attempted schema: '{targetSchemaName}'.");
            }

            if (!File.Exists(sourceFilePath))
            {
                throw new FileNotFoundException($"Source export file not found at path: {sourceFilePath}");
            }

            using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            // 1. Resolve TenantId and CompanyId for aquora_tenant_gangothri_2
            Guid tenantId = Guid.Empty;
            Guid companyId = Guid.Empty;

            using (var cmdTenant = new NpgsqlCommand(@"
                SELECT t.""Id"", c.""Id"" AS ""CompanyId""
                FROM public.""Tenants"" t
                LEFT JOIN aquora_tenant_gangothri_2.""Companies"" c ON c.""TenantId"" = t.""Id""
                WHERE t.""SchemaName"" = 'aquora_tenant_gangothri_2'
            ", conn))
            {
                using var reader = await cmdTenant.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    tenantId = reader.GetGuid(0);
                    companyId = reader.IsDBNull(1) ? Guid.Empty : reader.GetGuid(1);
                }
                else
                {
                    throw new InvalidOperationException("Could not find tenant record for schema 'aquora_tenant_gangothri_2' in public.Tenants.");
                }
            }

            // 2. Fetch parameters in aquora_tenant_gangothri_2.WaterTestParameters
            var dbParameters = new Dictionary<string, WaterTestParameter>(StringComparer.OrdinalIgnoreCase);
            using (var cmdParams = new NpgsqlCommand(@"
                SELECT ""Id"", ""Name"", ""Category"", ""Unit"", ""MinWarning"", ""MinAcceptable"", ""MaxAcceptable"", ""MaxWarning"", ""IsActive""
                FROM aquora_tenant_gangothri_2.""WaterTestParameters""
            ", conn))
            {
                using var reader = await cmdParams.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var p = new WaterTestParameter
                    {
                        Id = reader.GetGuid(0),
                        Name = reader.GetString(1),
                        Category = reader.GetString(2),
                        Unit = reader.IsDBNull(3) ? "" : reader.GetString(3),
                        MinWarning = reader.IsDBNull(4) ? (double?)null : reader.GetDouble(4),
                        MinAcceptable = reader.IsDBNull(5) ? (double?)null : reader.GetDouble(5),
                        MaxAcceptable = reader.IsDBNull(6) ? (double?)null : reader.GetDouble(6),
                        MaxWarning = reader.IsDBNull(7) ? (double?)null : reader.GetDouble(7),
                        IsActive = reader.GetBoolean(8)
                    };
                    string norm = NormalizeParameterName(p.Name);
                    dbParameters[norm] = p;
                }
            }

            var evaluationService = new QualityEvaluationService();

            // 3. Read and parse exported lines
            var lines = await File.ReadAllLinesAsync(sourceFilePath);
            summary.TotalSourceReports = Math.Max(0, lines.Length - 1);

            for (int i = 1; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (string.IsNullOrEmpty(line)) continue;

                if (line.StartsWith("\"") && line.EndsWith("\""))
                {
                    line = line.Substring(1, line.Length - 2).Replace("\"\"", "\"");
                }

                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;
                    var repElem = root.GetProperty("report");

                    string srcCuid = repElem.GetProperty("id").GetString() ?? "";
                    Guid deterministicReportId = GenerateDeterministicGuid(srcCuid);

                    string batchNum = repElem.TryGetProperty("batchNumber", out var bElem) ? (bElem.GetString() ?? "").Trim() : "";
                    string? sampleNum = repElem.TryGetProperty("sampleNumber", out var sNumElem) ? (sNumElem.ValueKind == JsonValueKind.Null ? null : sNumElem.GetString()?.Trim()) : null;
                    string repType = repElem.TryGetProperty("reportType", out var rtElem) ? rtElem.GetString()?.ToUpperInvariant() ?? "DAILY" : "DAILY";
                    string status = repElem.TryGetProperty("status", out var stElem) ? stElem.GetString()?.ToUpperInvariant() ?? "DRAFT" : "DRAFT";

                    DateTime? prodDate = null;
                    if (repElem.TryGetProperty("productionDate", out var pdElem) && pdElem.ValueKind == JsonValueKind.String && DateTime.TryParse(pdElem.GetString(), out var pdVal))
                    {
                        prodDate = DateTime.SpecifyKind(pdVal, DateTimeKind.Utc);
                    }

                    DateTime? sampleTime = null;
                    if (repElem.TryGetProperty("sampleTime", out var stmElem) && stmElem.ValueKind == JsonValueKind.String && DateTime.TryParse(stmElem.GetString(), out var stmVal))
                    {
                        sampleTime = DateTime.SpecifyKind(stmVal, DateTimeKind.Utc);
                    }

                    string? testedBy = repElem.TryGetProperty("testedBy", out var tbElem) && tbElem.ValueKind == JsonValueKind.String ? tbElem.GetString() : null;
                    string? collectedBy = repElem.TryGetProperty("collectedBy", out var cbElem) && cbElem.ValueKind == JsonValueKind.String ? cbElem.GetString() : null;
                    string? verifiedBy = repElem.TryGetProperty("verifiedBy", out var vbElem) && vbElem.ValueKind == JsonValueKind.String ? vbElem.GetString() : null;
                    string? remarks = repElem.TryGetProperty("remarks", out var remElem) && remElem.ValueKind == JsonValueKind.String ? remElem.GetString() : null;
                    string? attachments = repElem.TryGetProperty("attachments", out var attElem) ? (attElem.ValueKind == JsonValueKind.String ? attElem.GetString() : attElem.GetRawText()) : null;

                    DateTime createdAt = DateTime.UtcNow;
                    if (repElem.TryGetProperty("createdAt", out var caElem) && caElem.ValueKind == JsonValueKind.String && DateTime.TryParse(caElem.GetString(), out var caVal))
                    {
                        createdAt = DateTime.SpecifyKind(caVal, DateTimeKind.Utc);
                    }

                    string createdBy = repElem.TryGetProperty("createdBy", out var cbUserElem) && cbUserElem.ValueKind == JsonValueKind.String ? (cbUserElem.GetString() ?? "") : "System";

                    // Check Idempotency: does this report already exist in aquora_tenant_gangothri_2.WaterTestReports?
                    bool alreadyExists = false;
                    using (var cmdCheck = new NpgsqlCommand(@"
                        SELECT COUNT(*) FROM aquora_tenant_gangothri_2.""WaterTestReports""
                        WHERE ""Id"" = @id OR (""BatchNumber"" = @batch AND ""ProductionDate"" = @pDate AND ""CreatedAt"" = @cAt)
                    ", conn))
                    {
                        cmdCheck.Parameters.AddWithValue("id", deterministicReportId);
                        cmdCheck.Parameters.AddWithValue("batch", batchNum);
                        cmdCheck.Parameters.AddWithValue("pDate", (object?)prodDate ?? DBNull.Value);
                        cmdCheck.Parameters.AddWithValue("cAt", createdAt);

                        var existingCount = Convert.ToInt64(await cmdCheck.ExecuteScalarAsync());
                        alreadyExists = (existingCount > 0);
                    }

                    if (alreadyExists)
                    {
                        summary.SkippedDuplicates++;
                        continue;
                    }

                    // Insert Report Header
                    using (var cmdInsertRep = new NpgsqlCommand(@"
                        INSERT INTO aquora_tenant_gangothri_2.""WaterTestReports"" (
                            ""Id"", ""TenantId"", ""CompanyId"", ""BatchNumber"", ""SampleNumber"", 
                            ""ProductionDate"", ""ReportType"", ""Status"", ""SampleTime"", 
                            ""TestedBy"", ""CollectedBy"", ""VerifiedBy"", ""Remarks"", ""Attachments"", 
                            ""ConcurrencyToken"", ""IsActive"", ""CreatedAt"", ""CreatedBy"", ""IsDeleted""
                        ) VALUES (
                            @id, @tenantId, @companyId, @batch, @sample, 
                            @prodDate, @repType, @status, @sampleTime, 
                            @testedBy, @collectedBy, @verifiedBy, @remarks, @attachments, 
                            @concurrency, true, @createdAt, @createdBy, false
                        )
                        ON CONFLICT (""Id"") DO NOTHING
                    ", conn))
                    {
                        cmdInsertRep.Parameters.AddWithValue("id", deterministicReportId);
                        cmdInsertRep.Parameters.AddWithValue("tenantId", tenantId);
                        cmdInsertRep.Parameters.AddWithValue("companyId", companyId);
                        cmdInsertRep.Parameters.AddWithValue("batch", batchNum);
                        cmdInsertRep.Parameters.AddWithValue("sample", (object?)sampleNum ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("prodDate", (object?)prodDate ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("repType", repType);
                        cmdInsertRep.Parameters.AddWithValue("status", status);
                        cmdInsertRep.Parameters.AddWithValue("sampleTime", (object?)sampleTime ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("testedBy", (object?)testedBy ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("collectedBy", (object?)collectedBy ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("verifiedBy", (object?)verifiedBy ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("remarks", (object?)remarks ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("attachments", (object?)attachments ?? DBNull.Value);
                        cmdInsertRep.Parameters.AddWithValue("concurrency", Guid.NewGuid().ToString());
                        cmdInsertRep.Parameters.AddWithValue("createdAt", createdAt);
                        cmdInsertRep.Parameters.AddWithValue("createdBy", createdBy);

                        await cmdInsertRep.ExecuteNonQueryAsync();
                    }

                    // Insert Associated Results
                    if (root.TryGetProperty("results", out var resultsElem) && resultsElem.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in resultsElem.EnumerateArray())
                        {
                            var rElem = item.GetProperty("result");
                            var pElem = item.GetProperty("parameter");
                            string rawParamName = pElem.GetProperty("name").GetString() ?? "";
                            string normParamName = NormalizeParameterName(rawParamName);

                            if (!dbParameters.TryGetValue(normParamName, out var paramEntity))
                            {
                                summary.UnmatchedParametersCount++;
                                if (!summary.UnmatchedParameters.Contains(rawParamName))
                                {
                                    summary.UnmatchedParameters.Add(rawParamName);
                                }
                                continue;
                            }

                            string srcResCuid = rElem.TryGetProperty("id", out var resIdElem) ? (resIdElem.GetString() ?? "") : Guid.NewGuid().ToString();
                            Guid deterministicResultId = GenerateDeterministicGuid(srcResCuid);

                            double? numVal = null;
                            if (rElem.TryGetProperty("value", out var vElem) && vElem.ValueKind == JsonValueKind.Number)
                            {
                                numVal = vElem.GetDouble();
                            }

                            string? strVal = null;
                            if (rElem.TryGetProperty("stringValue", out var sElem) && sElem.ValueKind == JsonValueKind.String)
                            {
                                string candidate = sElem.GetString() ?? "";
                                if (!string.IsNullOrWhiteSpace(candidate) && candidate != "—")
                                {
                                    strVal = candidate.Trim();
                                }
                            }

                            if (!numVal.HasValue && string.IsNullOrWhiteSpace(strVal))
                            {
                                summary.NullOrEmptyResultsPreserved++;
                            }

                            // Strict Evaluation Rule (Steps 5 & 6)
                            string qualityStatus = evaluationService.EvaluateParameter(paramEntity, numVal, strVal);
                            bool isPass = (qualityStatus == "PASS");

                            using (var cmdInsertRes = new NpgsqlCommand(@"
                                INSERT INTO aquora_tenant_gangothri_2.""WaterTestResults"" (
                                    ""Id"", ""ReportId"", ""ParameterId"", ""Value"", ""StringValue"", 
                                    ""IsPass"", ""QualityStatus"", ""CreatedAt"", ""CreatedBy""
                                ) VALUES (
                                    @id, @reportId, @paramId, @value, @strValue, 
                                    @isPass, @qualityStatus, @createdAt, @createdBy
                                )
                                ON CONFLICT (""Id"") DO UPDATE 
                                SET ""Value"" = EXCLUDED.""Value"", 
                                    ""StringValue"" = EXCLUDED.""StringValue"",
                                    ""IsPass"" = EXCLUDED.""IsPass"",
                                    ""QualityStatus"" = EXCLUDED.""QualityStatus""
                            ", conn))
                            {
                                cmdInsertRes.Parameters.AddWithValue("id", deterministicResultId);
                                cmdInsertRes.Parameters.AddWithValue("reportId", deterministicReportId);
                                cmdInsertRes.Parameters.AddWithValue("paramId", paramEntity.Id);
                                cmdInsertRes.Parameters.AddWithValue("value", (object?)numVal ?? DBNull.Value);
                                cmdInsertRes.Parameters.AddWithValue("strValue", (object?)strVal ?? DBNull.Value);
                                cmdInsertRes.Parameters.AddWithValue("isPass", isPass);
                                cmdInsertRes.Parameters.AddWithValue("qualityStatus", qualityStatus);
                                cmdInsertRes.Parameters.AddWithValue("createdAt", createdAt);
                                cmdInsertRes.Parameters.AddWithValue("createdBy", createdBy);

                                await cmdInsertRes.ExecuteNonQueryAsync();
                                summary.TotalResultRows++;
                            }
                        }
                    }

                    summary.SuccessfullyImported++;
                    summary.ImportedReportNumbers.Add(deterministicReportId.ToString()[..8].ToUpper());
                }
                catch (Exception ex)
                {
                    summary.Failed++;
                    summary.FailureMessages.Add($"Row {i} Error: {ex.Message}");
                }
            }

            return summary;
        }

        public static string NormalizeParameterName(string rawName)
        {
            if (string.IsNullOrWhiteSpace(rawName)) return string.Empty;
            string clean = rawName.Trim();

            if (clean.Contains("22") && clean.Contains("Aerobic", StringComparison.OrdinalIgnoreCase)) return "Aerobic Microbial Count 22°C";
            if (clean.Contains("37") && clean.Contains("Aerobic", StringComparison.OrdinalIgnoreCase)) return "Aerobic Microbial Count 37°C";
            if (clean.Equals("E. coli", StringComparison.OrdinalIgnoreCase)) return "E.coli";
            return clean;
        }

        public static Guid GenerateDeterministicGuid(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return Guid.NewGuid();
            if (Guid.TryParse(input, out var parsedGuid)) return parsedGuid;

            using var md5 = MD5.Create();
            byte[] hash = md5.ComputeHash(Encoding.UTF8.GetBytes("aquora_seed_gangothri:" + input));
            return new Guid(hash);
        }
    }
}
