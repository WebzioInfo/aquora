using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs.Public;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Application.Services
{
    public class PublicWaterVerificationService : IPublicWaterVerificationService
    {
        private readonly ITenantProvider _tenantProvider;
        private readonly IPlatformDbContext _platformContext;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<PublicWaterVerificationService> _logger;

        public PublicWaterVerificationService(
            ITenantProvider tenantProvider,
            IPlatformDbContext platformContext,
            IServiceScopeFactory scopeFactory,
            ILogger<PublicWaterVerificationService> logger)
        {
            _tenantProvider = tenantProvider;
            _platformContext = platformContext;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task<PublicBatchVerificationResponseDto> VerifyBatchAsync(string batchNumber, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(batchNumber))
            {
                return new PublicBatchVerificationResponseDto
                {
                    Success = false,
                    Verified = false,
                    Code = "INVALID_BATCH_NUMBER",
                    Message = "The batch number must be provided."
                };
            }

            var normalizedBatch = batchNumber.Trim().ToLowerInvariant();

            try
            {
                // 1. Check if a specific tenant schema is already resolved (e.g. via host header, X-Tenant-Id, etc.)
                var currentSchema = _tenantProvider.TenantSchemaName;
                if (!string.IsNullOrWhiteSpace(currentSchema) && !currentSchema.Equals("public", StringComparison.OrdinalIgnoreCase))
                {
                    var result = await VerifyBatchInTenantScopeAsync(_tenantProvider.TenantId, currentSchema, normalizedBatch, batchNumber, cancellationToken);
                    if (result != null)
                    {
                        return result;
                    }
                }

                // 2. If no tenant was pre-resolved or not found in pre-resolved tenant, search across active tenant database schemas
                var activeTenants = await _platformContext.Tenants
                    .AsNoTracking()
                    .Where(t => t.IsActive && !t.IsDeleted && !string.IsNullOrWhiteSpace(t.SchemaName) && t.SchemaName != "public")
                    .ToListAsync(cancellationToken);

                bool anyProductionBatchFound = false;

                foreach (var tenant in activeTenants)
                {
                    try
                    {
                        var tenantResult = await VerifyBatchInTenantScopeAsync(tenant.Id, tenant.SchemaName, normalizedBatch, batchNumber, cancellationToken);
                        if (tenantResult != null)
                        {
                            if (tenantResult.Code == "REPORT_NOT_PUBLIC")
                            {
                                anyProductionBatchFound = true;
                            }
                            else
                            {
                                return tenantResult;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[PUBLIC BATCH VERIFICATION ERROR] Failed querying tenant schema '{Schema}' for batch '{BatchNumber}'. Error: {Message}",
                            tenant.SchemaName, batchNumber, ex.Message);
                    }
                }

                if (anyProductionBatchFound)
                {
                    return new PublicBatchVerificationResponseDto
                    {
                        Success = true,
                        Verified = false,
                        Code = "REPORT_NOT_PUBLIC",
                        Message = "No publicly verified water quality report is currently available for this batch."
                    };
                }

                _logger.LogInformation("[PUBLIC BATCH SEARCH] Batch '{BatchNumber}' not found across active tenant database schemas.", batchNumber);

                return new PublicBatchVerificationResponseDto
                {
                    Success = false,
                    Verified = false,
                    Code = "BATCH_NOT_FOUND",
                    Message = "The batch number could not be verified."
                };
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "[PUBLIC BATCH VERIFICATION EF ERROR] Database exception for batch {BatchNumber}: {Message}", batchNumber, dbEx.Message);

                return new PublicBatchVerificationResponseDto
                {
                    Success = false,
                    Verified = false,
                    Code = "SERVER_ERROR",
                    Message = "An internal database error occurred while processing your verification request."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PUBLIC BATCH VERIFICATION SYSTEM ERROR] Unexpected error for batch {BatchNumber}: {Message}", batchNumber, ex.Message);

                return new PublicBatchVerificationResponseDto
                {
                    Success = false,
                    Verified = false,
                    Code = "SERVER_ERROR",
                    Message = "An internal error occurred while processing your verification request."
                };
            }
        }

        private async Task<PublicBatchVerificationResponseDto?> VerifyBatchInTenantScopeAsync(
            Guid tenantId,
            string schemaName,
            string normalizedBatch,
            string originalBatchNumber,
            CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var tenantProvider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
            tenantProvider.SetTenantId(tenantId);
            tenantProvider.SetTenantSchemaName(schemaName);

            var dbContext = scope.ServiceProvider.GetRequiredService<ITenantDbContext>();

            // 1. Query all active (non-deleted) reports associated with this batch number
            var reports = await dbContext.WaterTestReports
                .AsNoTracking()
                .Include(r => r.Company)
                .Include(r => r.Results)
                    .ThenInclude(res => res.Parameter)
                .Where(r => !r.IsDeleted && r.IsActive && r.BatchNumber.Trim().ToLower() == normalizedBatch)
                .OrderByDescending(r => r.SampleTime ?? r.CreatedAt)
                .ThenByDescending(r => r.CreatedAt)
                .ToListAsync(cancellationToken);

            if (!reports.Any())
            {
                var productionBatchExists = await dbContext.ProductionBatches
                    .AsNoTracking()
                    .AnyAsync(b => !b.IsDeleted && b.BatchNumber.Trim().ToLower() == normalizedBatch, cancellationToken);

                if (productionBatchExists)
                {
                    return new PublicBatchVerificationResponseDto
                    {
                        Success = true,
                        Verified = false,
                        Code = "REPORT_NOT_PUBLIC",
                        Message = "No publicly verified water quality report is currently available for this batch."
                    };
                }

                return null;
            }

            // 2. Select the latest report with an eligible public status (SUBMITTED, APPROVED, REVIEWED, PUBLISHED)
            var eligibleReport = reports.FirstOrDefault(r => {
                var s = (r.Status ?? "DRAFT").Trim().ToUpperInvariant();
                return s == "SUBMITTED" || s == "APPROVED" || s == "REVIEWED" || s == "PUBLISHED";
            });

            if (eligibleReport == null)
            {
                _logger.LogInformation("[PUBLIC BATCH SEARCH] Tenant '{Schema}': Batch '{BatchNumber}' has {Count} report(s), but none are in an eligible public status.",
                    schemaName, originalBatchNumber, reports.Count);

                return new PublicBatchVerificationResponseDto
                {
                    Success = true,
                    Verified = false,
                    Code = "REPORT_NOT_PUBLIC",
                    Message = "No publicly verified water quality report is currently available for this batch."
                };
            }

            var report = eligibleReport;

            var qcSettings = await dbContext.QCSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == report.TenantId, cancellationToken);

            var prodBatch = await dbContext.ProductionBatches
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.TenantId == report.TenantId && b.BatchNumber.Trim().ToLower() == normalizedBatch, cancellationToken);

            DateTime mfgDateVal = report.ProductionDate 
                ?? report.SampleTime 
                ?? prodBatch?.StartedAt 
                ?? report.CreatedAt;

            DateTime expiryDateVal = mfgDateVal.AddMonths(6);

            string? phVal = null;
            string? tdsVal = null;
            string? turbidityVal = null;
            bool microPassed = true;
            bool sterilizationPassed = true;

            if (report.Results != null)
            {
                foreach (var res in report.Results)
                {
                    var pName = res.Parameter?.Name?.ToLowerInvariant().Trim() ?? string.Empty;
                    var valStr = res.Value?.ToString("0.#") ?? res.StringValue ?? null;

                    if (pName == "ph")
                    {
                        phVal = valStr;
                    }
                    else if (pName.Contains("tds") || pName.Contains("dissolved solids"))
                    {
                        tdsVal = valStr;
                    }
                    else if (pName.Contains("turbidity"))
                    {
                        turbidityVal = valStr;
                    }

                    if (res.Parameter?.Category?.ToUpperInvariant() == "MICROBIOLOGY")
                    {
                        if (res.QualityStatus == "FAIL" || !res.IsPass)
                        {
                            microPassed = false;
                        }
                    }

                    if (pName.Contains("chlorine") || pName.Contains("steril"))
                    {
                        if (res.QualityStatus == "FAIL" || !res.IsPass)
                        {
                            sterilizationPassed = false;
                        }
                    }
                }
            }

            var companyName = report.Company?.Name ?? "Aquora Water Bottling";
            var labAddress = qcSettings != null && !string.IsNullOrWhiteSpace(qcSettings.LabAddress)
                ? qcSettings.LabAddress
                : null;

            var complianceType = qcSettings != null && !string.IsNullOrWhiteSpace(qcSettings.StandardComplianceType)
                ? qcSettings.StandardComplianceType
                : "BIS IS 14543";

            return new PublicBatchVerificationResponseDto
            {
                Success = true,
                Verified = true,
                Data = new PublicBatchVerificationDataDto
                {
                    BatchNumber = report.BatchNumber,
                    Manufacturer = new PublicManufacturerDto
                    {
                        Name = companyName,
                        Address = labAddress,
                        Location = labAddress ?? report.Company?.TimeZone ?? "India"
                    },
                    Manufacturing = new PublicManufacturingDto
                    {
                        ManufacturedDate = mfgDateVal.ToString("yyyy-MM-dd")
                    },
                    Expiry = new PublicExpiryDto
                    {
                        BestBefore = expiryDateVal.ToString("yyyy-MM-dd"),
                        ShelfLifeMonths = 6
                    },
                    Licenses = new PublicLicensesDto
                    {
                        Fssai = null,
                        Bis = complianceType
                    },
                    WaterQuality = new PublicWaterQualityDto
                    {
                        Ph = phVal,
                        Tds = tdsVal,
                        Turbidity = turbidityVal,
                        Microbiology = microPassed ? "Passed" : "Failed",
                        Sterilization = sterilizationPassed ? "Passed" : "Failed"
                    },
                    Report = new PublicReportDto
                    {
                        Available = true,
                        PublicDownloadAvailable = false
                    }
                }
            };
        }
    }
}


