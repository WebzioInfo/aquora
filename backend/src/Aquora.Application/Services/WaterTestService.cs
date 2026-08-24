using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.QC;
using Aquora.Domain.Entities.QC;
using Aquora.Shared.Models;

namespace Aquora.Application.Services
{
    public class WaterTestService : IWaterTestService
    {
        private readonly ITenantDbContext _context;
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly IQualityEvaluationService _evaluationService;
        private readonly IQCPdfCertificateService _pdfService;
        private readonly ILogger<WaterTestService> _logger;

        private static readonly List<(string Name, string Category, string Unit, double? MinAccept, double? MaxAccept)> SeedParameters = new()
        {
            ("pH", "PHYSICAL", "—", 6.0, 8.5),
            ("TDS", "PHYSICAL", "mg/L", 0, 500),
            ("Turbidity", "PHYSICAL", "NTU", 0, 1.0),
            ("Sulphate", "CHEMICAL", "mg/L", 0, 200),
            ("Colour", "PHYSICAL", "Descriptor", 0, 0),
            ("Odour", "PHYSICAL", "Descriptor", 0, 0),
            ("Taste", "PHYSICAL", "Descriptor", null, null),
            ("Residual Free Chlorine", "CHEMICAL", "mg/L", null, 0.2),
            ("Alkalinity", "CHEMICAL", "mg/L", 0, 200),
            ("Chloride", "CHEMICAL", "mg/L", 0, 250),
            ("E.coli", "MICROBIOLOGY", "CFU/100ml", 0, 0),
            ("Coliform", "MICROBIOLOGY", "CFU/100ml", 0, 0),
            ("Pseudomonas", "MICROBIOLOGY", "CFU/250ml", 0, 0),
            ("Clostridia", "MICROBIOLOGY", "CFU/100ml", 0, 0),
            ("Aerobic Microbial Count 22°C", "MICROBIOLOGY", "CFU/ml", 0, 100),
            ("Aerobic Microbial Count 37°C", "MICROBIOLOGY", "CFU/ml", 0, 20),
            ("Yeast & Mold", "MICROBIOLOGY", "CFU/100ml", 0, 0)
        };

        public WaterTestService(
            ITenantDbContext context,
            IPlatformDbContext platformContext,
            ITenantProvider tenantProvider,
            ICurrentUserContext currentUserContext,
            IQualityEvaluationService evaluationService,
            IQCPdfCertificateService pdfService,
            ILogger<WaterTestService> logger)
        {
            _context = context;
            _platformContext = platformContext;
            _tenantProvider = tenantProvider;
            _currentUserContext = currentUserContext;
            _evaluationService = evaluationService;
            _pdfService = pdfService;
            _logger = logger;
        }

        private Guid GetTenantId() => _tenantProvider.TenantId;

        private async Task<Guid> GetCompanyIdAsync()
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            return company?.Id ?? Guid.Empty;
        }

        private async Task<Dictionary<string, string>> ResolveUserNamesAsync(IEnumerable<string> userIds)
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var distinctIds = userIds.Where(id => !string.IsNullOrWhiteSpace(id) && Guid.TryParse(id, out _))
                                     .Select(Guid.Parse)
                                     .Distinct()
                                     .ToList();
            if (!distinctIds.Any()) return map;

            var users = await _platformContext.Users
                .Where(u => distinctIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToListAsync();

            foreach (var u in users)
            {
                map[u.Id.ToString()] = $"{u.FirstName} {u.LastName}".Trim();
            }

            return map;
        }

        public async Task<List<WaterTestParameterDto>> GetWaterTestParametersAsync()
        {
            var activeParams = await _context.WaterTestParameters.Where(p => p.IsActive).ToListAsync();

            return activeParams
                .GroupBy(p => p.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .Select(p => new WaterTestParameterDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Category = p.Category,
                    Unit = p.Unit,
                    MinAcceptable = p.MinAcceptable,
                    MaxAcceptable = p.MaxAcceptable
                })
                .OrderBy(p => p.Category)
                .ThenBy(p => p.Name)
                .ToList();
        }

        public async Task<PagedResult<WaterTestReportDto>> GetWaterTestReportsAsync(
            int pageNumber,
            int pageSize,
            string? search,
            string? type,
            string? status,
            DateTime? startDate,
            DateTime? endDate)
        {
            var tenantId = GetTenantId();
            var query = _context.WaterTestReports
                .Include(r => r.Results)
                    .ThenInclude(res => res.Parameter)
                .Where(r => r.TenantId == tenantId && !r.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(r => r.BatchNumber.ToLower().Contains(s) || (r.SampleNumber != null && r.SampleNumber.ToLower().Contains(s)));
            }

            if (!string.IsNullOrWhiteSpace(type))
            {
                query = query.Where(r => r.ReportType == type);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(r => r.Status == status);
            }

            if (startDate.HasValue)
            {
                query = query.Where(r => r.SampleTime >= startDate.Value.ToUniversalTime());
            }

            if (endDate.HasValue)
            {
                query = query.Where(r => r.SampleTime <= endDate.Value.ToUniversalTime());
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.SampleTime)
                .ThenByDescending(r => r.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userIds = items.Select(r => r.CreatedBy).Distinct().ToList();
            var userNames = await ResolveUserNamesAsync(userIds);

            var dtos = items.Select(r => MapToDto(r, userNames)).ToList();

            return new PagedResult<WaterTestReportDto>(dtos, totalCount, pageNumber, pageSize);
        }

        public async Task<WaterTestReportDto?> GetWaterTestReportByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var report = await _context.WaterTestReports
                .Include(r => r.Results)
                    .ThenInclude(res => res.Parameter)
                .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId && !r.IsDeleted);

            if (report == null) return null;

            var userNames = await ResolveUserNamesAsync(new[] { report.CreatedBy });
            return MapToDto(report, userNames);
        }

        private string NormalizeParameterKey(string rawKey)
        {
            if (string.IsNullOrWhiteSpace(rawKey)) return string.Empty;
            var trimmed = rawKey.Trim();

            if (trimmed.StartsWith("seed-micro-", StringComparison.OrdinalIgnoreCase))
            {
                var sub = trimmed.Substring("seed-micro-".Length).Trim();
                if (sub.Contains("22")) return "Aerobic Microbial Count 22°C";
                if (sub.Contains("37")) return "Aerobic Microbial Count 37°C";
                if (sub.Equals("e.coli", StringComparison.OrdinalIgnoreCase)) return "E.coli";
                if (sub.Equals("coliform", StringComparison.OrdinalIgnoreCase)) return "Coliform";
                if (sub.Equals("pseudomonas", StringComparison.OrdinalIgnoreCase)) return "Pseudomonas";
                if (sub.Equals("clostridia", StringComparison.OrdinalIgnoreCase)) return "Clostridia";
                if (sub.Contains("yeast")) return "Yeast & Mold";
                return sub;
            }
            if (trimmed.Equals("taste-parameter-id", StringComparison.OrdinalIgnoreCase))
            {
                return "Taste";
            }

            return trimmed;
        }

        public async Task<WaterTestReportDto> CreateWaterTestReportAsync(CreateWaterTestReportRequest request)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var currentUserId = _currentUserContext.UserId ?? "System";

            var report = new WaterTestReport
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                BatchNumber = request.BatchNumber,
                SampleNumber = request.SampleNumber,
                ProductionDate = request.ProductionDate?.ToUniversalTime(),
                ReportType = request.ReportType,
                Status = request.Status,
                SampleTime = request.SampleTime?.ToUniversalTime() ?? DateTime.UtcNow,
                TestedBy = request.TestedBy,
                CollectedBy = request.CollectedBy,
                VerifiedBy = request.VerifiedBy,
                Remarks = request.Remarks,
                Attachments = request.Attachments,
                ConcurrencyToken = Guid.NewGuid().ToString(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId
            };

            var parameters = await _context.WaterTestParameters.ToListAsync();
            var parameterMap = new Dictionary<string, WaterTestParameter>(StringComparer.OrdinalIgnoreCase);

            foreach (var p in parameters)
            {
                parameterMap[p.Id.ToString()] = p;
                if (!string.IsNullOrWhiteSpace(p.Name))
                {
                    parameterMap[p.Name.Trim()] = p;
                }
            }

            foreach (var rReq in request.Results)
            {
                if (string.IsNullOrWhiteSpace(rReq.ParameterId)) continue;

                var normalizedKey = NormalizeParameterKey(rReq.ParameterId);
                if (!parameterMap.TryGetValue(normalizedKey, out var param))
                {
                    param = parameters.FirstOrDefault(p => p.Id.ToString().Equals(normalizedKey, StringComparison.OrdinalIgnoreCase) || p.Name.Equals(normalizedKey, StringComparison.OrdinalIgnoreCase));
                }

                if (param == null)
                {
                    param = new WaterTestParameter
                    {
                        Id = Guid.NewGuid(),
                        Name = normalizedKey,
                        Category = normalizedKey.Equals("e.coli", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("coliform", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("pseudomonas", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("clostridia", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("yeast & mold", StringComparison.OrdinalIgnoreCase) ||
                                   normalizedKey.Contains("aerobic") || normalizedKey.Contains("amc") ? "MICROBIOLOGY" : "PHYSICAL",
                        Unit = "—",
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUserId
                    };
                    _context.WaterTestParameters.Add(param);
                    parameters.Add(param);
                    parameterMap[param.Name.Trim()] = param;
                    parameterMap[param.Id.ToString()] = param;
                }

                var qualityStatus = _evaluationService.EvaluateParameter(param, rReq.Value, rReq.StringValue);

                report.Results.Add(new WaterTestResult
                {
                    Id = Guid.NewGuid(),
                    ReportId = report.Id,
                    ParameterId = param.Id,
                    Value = rReq.Value,
                    StringValue = rReq.StringValue,
                    IsPass = qualityStatus == "PASS",
                    QualityStatus = qualityStatus,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUserId
                });
            }

            _context.WaterTestReports.Add(report);
            await CheckAndGenerateCAPAsAsync(report);
            await LogQCActionAsync(report.Id, report.Id.ToString().Substring(0, 8).ToUpper(), "REPORT_CREATE", $"Created Water Test Report #{report.Id.ToString().Substring(0, 8).ToUpper()} for Batch '{report.BatchNumber}'. Status: {report.Status}");
            await _context.SaveChangesAsync();

            var userNames = await ResolveUserNamesAsync(new[] { currentUserId });
            return MapToDto(report, userNames);
        }

        public async Task<WaterTestReportDto?> UpdateWaterTestReportAsync(Guid id, CreateWaterTestReportRequest request)
        {
            var tenantId = GetTenantId();
            var currentUserId = _currentUserContext.UserId ?? "System";

            var report = await _context.WaterTestReports
                .Include(r => r.Results)
                    .ThenInclude(res => res.Parameter)
                .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId && !r.IsDeleted);

            if (report == null) return null;

            // Ensure DB report concurrency token is non-empty
            if (string.IsNullOrWhiteSpace(report.ConcurrencyToken))
            {
                report.ConcurrencyToken = Guid.NewGuid().ToString();
            }

            // Optimistic Concurrency Protection Verification:
            // Check if the frontend provided a concurrency token that differs from the DB's token
            if (!string.IsNullOrWhiteSpace(request.ConcurrencyToken) && 
                !string.Equals(request.ConcurrencyToken, report.ConcurrencyToken, StringComparison.Ordinal))
            {
                _logger.LogWarning("[CONCURRENCY CONFLICT DETECTED] WaterTestReport {ReportId} update rejected. Incoming Token: '{RequestToken}', DB Token: '{DbToken}', User: '{UserId}'",
                    id, request.ConcurrencyToken, report.ConcurrencyToken, currentUserId);

                throw new Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException("This report was updated by another session or user. Please reload the latest version before saving.");
            }

            var originalToken = report.ConcurrencyToken;
            report.ConcurrencyToken = Guid.NewGuid().ToString();

            // Audit Delta Snapshot
            var oldBatchNumber = report.BatchNumber;
            var oldStatus = report.Status;
            var oldRemarks = report.Remarks;
            var oldResultsSnapshot = report.Results.ToDictionary(
                r => r.Id,
                r => new { Name = r.Parameter?.Name ?? "Unknown", Val = r.Value?.ToString() ?? r.StringValue ?? "N/A" }
            );

            report.BatchNumber = request.BatchNumber;
            report.SampleNumber = request.SampleNumber;
            report.ProductionDate = request.ProductionDate?.ToUniversalTime();
            report.ReportType = request.ReportType;
            report.Status = request.Status;
            report.SampleTime = request.SampleTime?.ToUniversalTime() ?? report.SampleTime;
            report.TestedBy = request.TestedBy;
            report.CollectedBy = request.CollectedBy;
            report.VerifiedBy = request.VerifiedBy;
            report.Remarks = request.Remarks;
            report.Attachments = request.Attachments;
            report.UpdatedAt = DateTime.UtcNow;
            report.UpdatedBy = currentUserId;

            var parameters = await _context.WaterTestParameters.ToListAsync();
            var parameterMap = new Dictionary<string, WaterTestParameter>(StringComparer.OrdinalIgnoreCase);

            foreach (var p in parameters)
            {
                parameterMap[p.Id.ToString()] = p;
                if (!string.IsNullOrWhiteSpace(p.Name))
                {
                    parameterMap[p.Name.Trim()] = p;
                }
            }

            // Deduplicate incoming request results by resolved WaterTestParameter.Id
            var deduplicatedResults = new Dictionary<Guid, (WaterTestParameter Parameter, double? Value, string? StringValue)>();

            foreach (var rReq in request.Results)
            {
                if (string.IsNullOrWhiteSpace(rReq.ParameterId)) continue;

                var normalizedKey = NormalizeParameterKey(rReq.ParameterId);
                if (!parameterMap.TryGetValue(normalizedKey, out var param))
                {
                    param = parameters.FirstOrDefault(p => p.Id.ToString().Equals(normalizedKey, StringComparison.OrdinalIgnoreCase) || p.Name.Equals(normalizedKey, StringComparison.OrdinalIgnoreCase));
                }

                if (param == null)
                {
                    param = new WaterTestParameter
                    {
                        Id = Guid.NewGuid(),
                        Name = normalizedKey,
                        Category = normalizedKey.Equals("e.coli", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("coliform", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("pseudomonas", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("clostridia", StringComparison.OrdinalIgnoreCase) || 
                                   normalizedKey.Equals("yeast & mold", StringComparison.OrdinalIgnoreCase) ||
                                   normalizedKey.Contains("aerobic") || normalizedKey.Contains("amc") ? "MICROBIOLOGY" : "PHYSICAL",
                        Unit = "—",
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUserId
                    };
                    _context.WaterTestParameters.Add(param);
                    parameters.Add(param);
                    parameterMap[param.Id.ToString()] = param;
                    parameterMap[param.Name.Trim()] = param;
                }

                deduplicatedResults[param.Id] = (param, rReq.Value, rReq.StringValue);
            }

            var existingResultsByParamId = report.Results
                .GroupBy(r => r.ParameterId)
                .ToDictionary(g => g.Key, g => g.First());
            var existingResultsByParamName = report.Results
                .Where(r => r.Parameter != null && !string.IsNullOrWhiteSpace(r.Parameter.Name))
                .GroupBy(r => r.Parameter.Name.Trim().ToLower())
                .ToDictionary(g => g.Key, g => g.First());

            var updatedResultIds = new HashSet<Guid>();

            foreach (var (param, val, strVal) in deduplicatedResults.Values)
            {
                var qualityStatus = _evaluationService.EvaluateParameter(param, val, strVal);
                WaterTestResult? existingResult = null;

                if (existingResultsByParamId.TryGetValue(param.Id, out var resById))
                {
                    existingResult = resById;
                }
                else if (!string.IsNullOrWhiteSpace(param.Name) && existingResultsByParamName.TryGetValue(param.Name.Trim().ToLower(), out var resByName))
                {
                    existingResult = resByName;
                }

                if (existingResult != null)
                {
                    existingResult.ParameterId = param.Id;
                    existingResult.Value = val;
                    existingResult.StringValue = strVal;
                    existingResult.IsPass = qualityStatus == "PASS";
                    existingResult.QualityStatus = qualityStatus;
                    existingResult.UpdatedAt = DateTime.UtcNow;
                    existingResult.UpdatedBy = currentUserId;
                    updatedResultIds.Add(existingResult.Id);
                }
                else
                {
                    var newResult = new WaterTestResult
                    {
                        Id = Guid.NewGuid(),
                        ReportId = report.Id,
                        ParameterId = param.Id,
                        Value = val,
                        StringValue = strVal,
                        IsPass = qualityStatus == "PASS",
                        QualityStatus = qualityStatus,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUserId
                    };
                    report.Results.Add(newResult);
                    updatedResultIds.Add(newResult.Id);
                }
            }

            // Remove obsolete / orphaned results safely through EF Core ChangeTracker
            var toRemove = report.Results
                .Where(r => !updatedResultIds.Contains(r.Id))
                .ToList();

            foreach (var item in toRemove)
            {
                _context.WaterTestResults.Remove(item);
            }

            // Build Audit Trail Delta Log
            var changes = new List<string>();
            if (oldBatchNumber != request.BatchNumber) changes.Add($"BatchNumber: '{oldBatchNumber}' -> '{request.BatchNumber}'");
            if (oldStatus != request.Status) changes.Add($"Status: '{oldStatus}' -> '{request.Status}'");
            if ((oldRemarks ?? "") != (request.Remarks ?? "")) changes.Add($"Remarks: '{oldRemarks ?? ""}' -> '{request.Remarks ?? ""}'");

            foreach (var (param, val, strVal) in deduplicatedResults.Values)
            {
                var newValStr = val?.ToString() ?? strVal ?? "N/A";
                var oldItem = oldResultsSnapshot.Values.FirstOrDefault(x => x.Name.Equals(param.Name, StringComparison.OrdinalIgnoreCase));
                var oldValStr = oldItem != null ? oldItem.Val : "None";
                if (oldValStr != newValStr)
                {
                    changes.Add($"{param.Name}: {oldValStr} -> {newValStr}");
                }
            }

            string changeDetails = changes.Any() ? string.Join("; ", changes) : "No field changes detected.";
            await LogQCActionAsync(report.Id, report.Id.ToString().Substring(0, 8).ToUpper(), "REPORT_UPDATE", $"Water Test Report #{report.Id.ToString().Substring(0, 8).ToUpper()} updated. Changes: {changeDetails}");

            await CheckAndGenerateCAPAsAsync(report);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "[CONCURRENCY CONFLICT SAVE FAILURE] Report ID: {ReportId}, User ID: {UserId}, Original Token: '{OriginalToken}', DB Token: '{CurrentToken}'",
                    id, currentUserId, originalToken, report.ConcurrencyToken);
                throw;
            }

            var userNames = await ResolveUserNamesAsync(new[] { report.CreatedBy });
            return MapToDto(report, userNames);
        }

        public async Task<bool> DeleteWaterTestReportAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var report = await _context.WaterTestReports.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId && !r.IsDeleted);
            if (report == null) return false;

            report.IsDeleted = true;
            report.DeletedAt = DateTime.UtcNow;
            report.DeletedBy = _currentUserContext.UserId ?? "System";

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<WaterTestDashboardDto> GetWaterTestDashboardAsync()
        {
            var tenantId = GetTenantId();
            var reports = await _context.WaterTestReports
                .Include(r => r.Results)
                    .ThenInclude(res => res.Parameter)
                .Where(r => r.TenantId == tenantId && !r.IsDeleted)
                .ToListAsync();

            var today = DateTime.UtcNow.Date;

            var stats = reports.Select(r => new {
                Report = r,
                Status = ResolveReportStatus(r)
            }).ToList();

            var monthlyStats = stats
                .GroupBy(s => s.Report.SampleTime?.ToString("MMM") ?? "Unknown")
                .Select(g => new MonthlyReportStatDto
                {
                    Month = g.Key,
                    Passed = g.Count(x => x.Status == "PASS" || x.Status == "WARNING"),
                    Failed = g.Count(x => x.Status == "FAIL")
                }).ToList();

            var creatorIds = stats.Select(s => s.Report.CreatedBy).Distinct().ToList();
            var userNames = await ResolveUserNamesAsync(creatorIds);

            var recent = stats
                .OrderByDescending(s => s.Report.SampleTime)
                .Take(10)
                .Select(s => MapToDto(s.Report, userNames))
                .ToList();

            return new WaterTestDashboardDto
            {
                TotalReports = reports.Count,
                TodayReports = reports.Count(r => r.SampleTime?.Date == today),
                PassedReports = stats.Count(s => s.Status == "PASS"),
                FailedReports = stats.Count(s => s.Status == "FAIL"),
                PendingReports = stats.Count(s => s.Status == "PENDING" || s.Report.Status == "DRAFT"),
                MonthlyStats = monthlyStats,
                RecentReports = recent
            };
        }

        private string ResolveReportStatus(WaterTestReport r)
        {
            if (r.Status == "DRAFT") return "PENDING";
            if (!r.Results.Any()) return "PASS";
            
            bool hasFail = r.Results.Any(res => res.QualityStatus == "FAIL");
            if (hasFail) return "FAIL";

            bool hasWarning = r.Results.Any(res => res.QualityStatus == "WARNING");
            if (hasWarning) return "WARNING";

            return "PASS";
        }

        private WaterTestReportDto MapToDto(WaterTestReport r, Dictionary<string, string> userNames)
        {
            return new WaterTestReportDto
            {
                Id = r.Id,
                ReportNumber = r.Id.ToString().Substring(0, 8).ToUpper(),
                BatchNumber = r.BatchNumber,
                SampleNumber = r.SampleNumber,
                ProductionDate = r.ProductionDate,
                ReportType = r.ReportType,
                Status = r.Status,
                SampleTime = r.SampleTime,
                TestedBy = r.TestedBy,
                CollectedBy = r.CollectedBy,
                VerifiedBy = r.VerifiedBy,
                Remarks = r.Remarks,
                Attachments = r.Attachments,
                ConcurrencyToken = r.ConcurrencyToken ?? string.Empty,
                CreatedAt = r.CreatedAt,
                CreatedBy = r.CreatedBy,
                CreatedByName = userNames.TryGetValue(r.CreatedBy, out var name) ? name : "System",
                Results = r.Results.Select(res => new WaterTestResultDto
                {
                    Id = res.Id,
                    ParameterId = res.ParameterId,
                    ParameterName = res.Parameter?.Name ?? "Unknown",
                    ParameterCategory = res.Parameter?.Category ?? "Unknown",
                    ParameterUnit = res.Parameter?.Unit ?? "—",
                    Value = res.Value,
                    StringValue = res.StringValue,
                    IsPass = res.IsPass,
                    QualityStatus = res.QualityStatus
                }).ToList()
            };
        }

        private string EvaluateResult(string parameterName, double? value, string? stringValue)
        {
            var pName = parameterName.Trim();
            var param = _context.WaterTestParameters.Local.FirstOrDefault(p => p.Name.Equals(pName, StringComparison.OrdinalIgnoreCase))
                        ?? _context.WaterTestParameters.FirstOrDefault(p => p.Name.Equals(pName, StringComparison.OrdinalIgnoreCase));
            
            if (param == null)
            {
                param = new WaterTestParameter
                {
                    Name = pName,
                    Category = pName.Equals("e.coli", StringComparison.OrdinalIgnoreCase) || 
                               pName.Equals("coliform", StringComparison.OrdinalIgnoreCase) || 
                               pName.Equals("pseudomonas", StringComparison.OrdinalIgnoreCase) || 
                               pName.Equals("clostridia", StringComparison.OrdinalIgnoreCase) || 
                               pName.Equals("yeast & mold", StringComparison.OrdinalIgnoreCase) ||
                               pName.Contains("aerobic") || pName.Contains("amc") ? "MICROBIOLOGY" : "PHYSICAL",
                    Unit = "—"
                };
            }

            return _evaluationService.EvaluateParameter(param, value, stringValue);
        }

        public async Task<WaterTestParameterDto> CreateOrUpdateParameterAsync(WaterTestParameterDto request)
        {
            var currentUserId = _currentUserContext.UserId ?? "System";
            WaterTestParameter param;

            if (request.Id != Guid.Empty)
            {
                param = await _context.WaterTestParameters.FirstOrDefaultAsync(p => p.Id == request.Id);
                if (param == null)
                {
                    param = new WaterTestParameter { Id = request.Id };
                    _context.WaterTestParameters.Add(param);
                }
            }
            else
            {
                param = new WaterTestParameter { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow, CreatedBy = currentUserId };
                _context.WaterTestParameters.Add(param);
            }

            param.Name = request.Name;
            param.Category = request.Category;
            param.Unit = request.Unit;
            param.MinAcceptable = request.MinAcceptable;
            param.MaxAcceptable = request.MaxAcceptable;
            param.IsActive = true;
            param.UpdatedAt = DateTime.UtcNow;
            param.UpdatedBy = currentUserId;

            await _context.SaveChangesAsync();

            return new WaterTestParameterDto
            {
                Id = param.Id,
                Name = param.Name,
                Category = param.Category,
                Unit = param.Unit,
                MinAcceptable = param.MinAcceptable,
                MaxAcceptable = param.MaxAcceptable
            };
        }

        public async Task<List<ComplianceRecordDto>> GetComplianceRecordsAsync()
        {
            var tenantId = GetTenantId();
            var records = await _context.ComplianceRecords
                .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            return records.Select(c => new ComplianceRecordDto
            {
                Id = c.Id,
                ReportId = c.ReportId,
                ReferenceNumber = c.ReferenceNumber,
                Type = c.Type,
                Severity = c.Severity,
                Status = c.Status,
                ParameterName = c.ParameterName,
                BatchNumber = c.BatchNumber,
                DefectDescription = c.DefectDescription,
                MeasuredValue = c.MeasuredValue,
                ExpectedRange = c.ExpectedRange,
                RootCauseAnalysis = c.RootCauseAnalysis,
                CorrectiveAction = c.CorrectiveAction,
                PreventiveAction = c.PreventiveAction,
                AssignedTo = c.AssignedTo,
                TargetResolutionDate = c.TargetResolutionDate,
                ResolvedAt = c.ResolvedAt,
                ResolvedBy = c.ResolvedBy,
                ResolutionNotes = c.ResolutionNotes,
                CreatedAt = c.CreatedAt,
                CreatedBy = c.CreatedBy
            }).ToList();
        }

        public async Task<bool> ResolveComplianceRecordAsync(Guid recordId, ResolveComplianceRequest request)
        {
            var tenantId = GetTenantId();
            var record = await _context.ComplianceRecords.FirstOrDefaultAsync(c => c.Id == recordId && c.TenantId == tenantId && !c.IsDeleted);
            if (record == null) return false;

            record.Status = "RESOLVED";
            record.RootCauseAnalysis = request.RootCauseAnalysis;
            record.CorrectiveAction = request.CorrectiveAction;
            record.PreventiveAction = request.PreventiveAction;
            record.ResolutionNotes = request.ResolutionNotes;
            record.ResolvedAt = DateTime.UtcNow;
            record.ResolvedBy = _currentUserContext.Email ?? _currentUserContext.UserId ?? "QC Manager";
            record.UpdatedAt = DateTime.UtcNow;

            await LogQCActionAsync(record.ReportId, record.ReferenceNumber, "COMPLIANCE_RESOLVE", $"Compliance record {record.ReferenceNumber} resolved by {record.ResolvedBy}.");
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<QCSettingsDto> GetQCSettingsAsync()
        {
            var tenantId = GetTenantId();
            var settings = await _context.QCSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId);
            if (settings == null)
            {
                return new QCSettingsDto();
            }

            return new QCSettingsDto
            {
                AutoGenerateCAPAOnFailure = settings.AutoGenerateCAPAOnFailure,
                RequireVerificationBeforeSubmit = settings.RequireVerificationBeforeSubmit,
                StandardComplianceType = settings.StandardComplianceType,
                DigitalSignatureTitle = settings.DigitalSignatureTitle,
                LabAddress = settings.LabAddress,
                ContactEmail = settings.ContactEmail,
                NotificationRecipients = settings.NotificationRecipients
            };
        }

        public async Task<QCSettingsDto> UpdateQCSettingsAsync(QCSettingsDto dto)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var currentUserId = _currentUserContext.UserId ?? "System";

            var settings = await _context.QCSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId);
            if (settings == null)
            {
                settings = new QCSettings
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUserId
                };
                _context.QCSettings.Add(settings);
            }

            settings.AutoGenerateCAPAOnFailure = dto.AutoGenerateCAPAOnFailure;
            settings.RequireVerificationBeforeSubmit = dto.RequireVerificationBeforeSubmit;
            settings.StandardComplianceType = dto.StandardComplianceType;
            settings.DigitalSignatureTitle = dto.DigitalSignatureTitle;
            settings.LabAddress = dto.LabAddress;
            settings.ContactEmail = dto.ContactEmail;
            settings.NotificationRecipients = dto.NotificationRecipients;
            settings.UpdatedAt = DateTime.UtcNow;
            settings.UpdatedBy = currentUserId;

            await _context.SaveChangesAsync();
            return dto;
        }

        public async Task<List<QCAuditLogDto>> GetQCAuditLogsAsync(Guid? reportId = null)
        {
            var tenantId = GetTenantId();
            var query = _context.QCAuditLogs.Where(l => l.TenantId == tenantId);
            if (reportId.HasValue)
            {
                query = query.Where(l => l.ReportId == reportId.Value);
            }

            var logs = await query.OrderByDescending(l => l.Timestamp).Take(100).ToListAsync();
            return logs.Select(l => new QCAuditLogDto
            {
                Id = l.Id,
                ReportId = l.ReportId,
                ReportNumber = l.ReportNumber,
                Action = l.Action,
                PerformedBy = l.PerformedBy,
                UserRole = l.UserRole,
                Timestamp = l.Timestamp,
                Details = l.Details,
                IPAddress = l.IPAddress
            }).ToList();
        }

        public async Task<byte[]> GenerateReportPdfAsync(Guid reportId)
        {
            var tenantId = GetTenantId();
            var report = await _context.WaterTestReports
                .Include(r => r.Results)
                    .ThenInclude(res => res.Parameter)
                .FirstOrDefaultAsync(r => r.Id == reportId && r.TenantId == tenantId && !r.IsDeleted);

            if (report == null) throw new InvalidOperationException("Report not found.");

            var company = await _context.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            string companyName = company?.Name ?? "Aquora Enterprise";

            await LogQCActionAsync(report.Id, report.Id.ToString().Substring(0, 8).ToUpper(), "PDF_EXPORT", $"Generated PDF Certificate of Analysis for Report #{report.Id.ToString().Substring(0, 8).ToUpper()}");
            await _context.SaveChangesAsync();

            return await _pdfService.GenerateCertificatePdfAsync(report, companyName);
        }

        private async Task CheckAndGenerateCAPAsAsync(WaterTestReport report)
        {
            try
            {
                var tenantId = GetTenantId();
                var companyId = await GetCompanyIdAsync();
                var settings = await _context.QCSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId);
                
                if (settings != null && settings.AutoGenerateCAPAOnFailure)
                {
                    var failedResults = report.Results.Where(r => r.QualityStatus == "FAIL").ToList();
                    foreach (var fail in failedResults)
                    {
                        var paramName = fail.Parameter?.Name ?? "Unknown Parameter";
                        bool exists = await _context.ComplianceRecords.AnyAsync(c => c.ReportId == report.Id && c.ParameterName == paramName && !c.IsDeleted);
                        if (!exists)
                        {
                            var record = new ComplianceRecord
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                CompanyId = companyId,
                                ReportId = report.Id,
                                ReferenceNumber = $"NCR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}",
                                Type = "NON_CONFORMANCE",
                                Severity = "HIGH",
                                Status = "OPEN",
                                ParameterName = paramName,
                                BatchNumber = report.BatchNumber,
                                DefectDescription = $"Parameter '{paramName}' failed quality evaluation. Measured: {fail.Value?.ToString() ?? fail.StringValue ?? "Out of Range"}.",
                                MeasuredValue = fail.Value?.ToString() ?? fail.StringValue ?? "N/A",
                                ExpectedRange = fail.Parameter != null ? $"{fail.Parameter.MinAcceptable?.ToString() ?? "N/A"} - {fail.Parameter.MaxAcceptable?.ToString() ?? "N/A"} {fail.Parameter.Unit}" : "Standard Range",
                                AssignedTo = "QC Manager",
                                TargetResolutionDate = DateTime.UtcNow.AddDays(3),
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = _currentUserContext.Email ?? _currentUserContext.UserId ?? "System"
                            };
                            _context.ComplianceRecords.Add(record);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CAPA AUTO GENERATION ERROR]: {ex.Message}");
            }
        }

        private async Task LogQCActionAsync(Guid? reportId, string? reportNumber, string action, string details, string? oldValues = null, string? newValues = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var companyId = await GetCompanyIdAsync();
                var log = new QCAuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    ReportId = reportId,
                    ReportNumber = reportNumber,
                    Action = action,
                    PerformedBy = _currentUserContext.Email ?? _currentUserContext.UserId ?? "System User",
                    UserRole = "QC User",
                    Timestamp = DateTime.UtcNow,
                    Details = details,
                    OldValues = oldValues,
                    NewValues = newValues
                };
                _context.QCAuditLogs.Add(log);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[QC AUDIT LOG ERROR]: {ex.Message}");
            }
        }
    }
}
