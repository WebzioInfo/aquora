using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.DTOs;
using Aquora.Application.DTOs.Purchase;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities.Finance;

namespace Aquora.Application.Services
{
    public class AssetManagementService : IAssetManagementService
    {
        private readonly ITenantDbContext _context;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _userProvider;

        public AssetManagementService(
            ITenantDbContext context,
            ITenantProvider tenantProvider,
            ICurrentUserContext userProvider)
        {
            _context = context;
            _tenantProvider = tenantProvider;
            _userProvider = userProvider;
        }

        private async Task<Guid> GetCompanyIdAsync()
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) throw new InvalidOperationException("Company not found for current tenant.");
            return company.Id;
        }

        private string GetCurrentUserId()
        {
            return !string.IsNullOrWhiteSpace(_userProvider.UserId) ? _userProvider.UserId : "System";
        }

        private static DateTime EnsureUtc(DateTime dt)
        {
            if (dt.Kind == DateTimeKind.Utc) return dt;
            return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        }

        private static DateTime? EnsureUtc(DateTime? dt)
        {
            if (!dt.HasValue) return null;
            if (dt.Value.Kind == DateTimeKind.Utc) return dt;
            return DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc);
        }

        private async Task<string> GenerateAssetCodeAsync()
        {
            var currentYear = DateTime.UtcNow.Year;
            var prefix = $"AST-{currentYear}-";

            var count = await _context.Assets
                .IgnoreQueryFilters()
                .Where(a => a.TenantId == _tenantProvider.TenantId && a.AssetCode.StartsWith(prefix))
                .CountAsync();

            return $"{prefix}{(count + 1):D5}";
        }

        public async Task<AssetPagedResultDto> GetAssetsAsync(
            int pageNumber = 1,
            int pageSize = 50,
            string? search = null,
            string? category = null,
            string? status = null,
            string? condition = null,
            string? location = null,
            string? department = null)
        {
            var query = _context.Assets
                .Where(a => a.TenantId == _tenantProvider.TenantId && !a.IsDeleted)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(a =>
                    a.AssetName.ToLower().Contains(term) ||
                    a.AssetTag.ToLower().Contains(term) ||
                    a.AssetCode.ToLower().Contains(term) ||
                    (a.SerialNumber != null && a.SerialNumber.ToLower().Contains(term)) ||
                    (a.Manufacturer != null && a.Manufacturer.ToLower().Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(category) && category != "ALL")
            {
                query = query.Where(a => a.AssetCategory.ToLower() == category.Trim().ToLower());
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
            {
                query = query.Where(a => a.CurrentStatus.ToLower() == status.Trim().ToLower());
            }

            if (!string.IsNullOrWhiteSpace(condition) && condition != "ALL")
            {
                query = query.Where(a => a.Condition.ToLower() == condition.Trim().ToLower());
            }

            if (!string.IsNullOrWhiteSpace(location) && location != "ALL")
            {
                query = query.Where(a => a.Location != null && a.Location.ToLower() == location.Trim().ToLower());
            }

            if (!string.IsNullOrWhiteSpace(department) && department != "ALL")
            {
                query = query.Where(a => a.Department != null && a.Department.ToLower() == department.Trim().ToLower());
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new AssetPagedResultDto
            {
                Items = items.Select(MapToDetailedDto).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }

        public async Task<AssetKpiSummaryDto> GetAssetKpisAsync()
        {
            var assets = await _context.Assets
                .Where(a => a.TenantId == _tenantProvider.TenantId && !a.IsDeleted)
                .AsNoTracking()
                .ToListAsync();

            var now = DateTime.UtcNow;
            var thirtyDaysFromNow = now.AddDays(30);

            return new AssetKpiSummaryDto
            {
                TotalAssetsCount = assets.Count,
                ActiveAssetsCount = assets.Count(a => a.CurrentStatus == "Active" || a.CurrentStatus == "InUse"),
                TotalAssetValue = assets.Sum(a => a.TotalCapitalizedCost > 0 ? a.TotalCapitalizedCost : a.PurchasePrice),
                CurrentBookValue = assets.Where(a => a.CurrentStatus != "Disposed" && a.CurrentStatus != "Retired").Sum(a => a.CurrentValue),
                AccumulatedDepreciation = assets.Sum(a => a.AccumulatedDepreciation),
                UnderMaintenanceCount = assets.Count(a => a.CurrentStatus == "UnderMaintenance"),
                DisposedCount = assets.Count(a => a.CurrentStatus == "Disposed" || a.CurrentStatus == "Retired"),
                WarrantyExpiringCount = assets.Count(a => a.WarrantyEndDate.HasValue && a.WarrantyEndDate.Value >= now && a.WarrantyEndDate.Value <= thirtyDaysFromNow)
            };
        }

        public async Task<DetailedAssetDto?> GetAssetByIdAsync(Guid id)
        {
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted);

            return asset == null ? null : MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto> CreateAssetAsync(CreateAssetRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.AssetName))
                throw new ArgumentException("Asset name is required.");

            if (string.IsNullOrWhiteSpace(request.AssetCategory))
                throw new ArgumentException("Asset category is required.");

            if (request.PurchasePrice < 0)
                throw new ArgumentException("Purchase cost cannot be negative.");

            var companyId = await GetCompanyIdAsync();
            var assetCode = await GenerateAssetCodeAsync();

            var tag = !string.IsNullOrWhiteSpace(request.AssetTag)
                ? request.AssetTag.Trim().ToUpper()
                : $"TAG-{assetCode}";

            // Validate unique tag per tenant
            var tagExists = await _context.Assets.AnyAsync(a =>
                a.TenantId == _tenantProvider.TenantId &&
                !a.IsDeleted &&
                a.AssetTag.ToLower() == tag.ToLower());

            if (tagExists)
            {
                throw new ArgumentException($"Asset tag '{tag}' is already assigned to another asset.");
            }

            var capitalizedCost = request.PurchasePrice + request.TaxAmount + request.FreightCost + request.InstallationCost + request.OtherCapitalizedCost;
            if (capitalizedCost <= 0) capitalizedCost = request.PurchasePrice;

            var asset = new Asset
            {
                TenantId = _tenantProvider.TenantId,
                CompanyId = companyId,
                AssetCode = assetCode,
                AssetTag = tag,
                AssetName = request.AssetName.Trim(),
                AssetCategory = request.AssetCategory.Trim(),
                AssetType = request.AssetType?.Trim(),
                SerialNumber = request.SerialNumber?.Trim(),
                ModelNumber = request.ModelNumber?.Trim(),
                Manufacturer = request.Manufacturer?.Trim(),
                Description = request.Description?.Trim(),

                PurchaseDate = EnsureUtc(request.PurchaseDate),
                PurchasePrice = request.PurchasePrice,
                SupplierId = request.SupplierId,
                SupplierName = request.SupplierName?.Trim(),
                PurchaseInvoiceNumber = request.PurchaseInvoiceNumber?.Trim(),
                PurchaseOrderNumber = request.PurchaseOrderNumber?.Trim(),
                TaxAmount = request.TaxAmount,
                FreightCost = request.FreightCost,
                InstallationCost = request.InstallationCost,
                OtherCapitalizedCost = request.OtherCapitalizedCost,
                TotalCapitalizedCost = capitalizedCost,

                DepreciationMethod = string.IsNullOrWhiteSpace(request.DepreciationMethod) ? "StraightLine" : request.DepreciationMethod,
                UsefulLifeYears = request.UsefulLifeYears > 0 ? request.UsefulLifeYears : 5,
                ResidualValue = request.ResidualValue >= 0 ? request.ResidualValue : 0,
                DepreciationStartDate = EnsureUtc(request.DepreciationStartDate ?? request.PurchaseDate),
                DepreciationFrequency = request.DepreciationFrequency ?? "Yearly",
                DepreciationRate = request.UsefulLifeYears > 0 ? Math.Round(100m / request.UsefulLifeYears, 2) : 20m,
                AccumulatedDepreciation = 0,
                CurrentValue = capitalizedCost,

                Location = request.Location?.Trim() ?? "Main Site",
                Department = request.Department?.Trim(),
                AssignedEmployeeId = request.AssignedEmployeeId,
                AssignedEmployeeName = request.AssignedEmployeeName?.Trim(),
                AssignedDate = request.AssignedEmployeeId.HasValue ? DateTime.UtcNow : null,

                CurrentStatus = "Active",
                Condition = string.IsNullOrWhiteSpace(request.Condition) ? "Good" : request.Condition,

                WarrantyStartDate = EnsureUtc(request.WarrantyStartDate),
                WarrantyEndDate = EnsureUtc(request.WarrantyEndDate),
                WarrantyProvider = request.WarrantyProvider?.Trim(),
                WarrantyNumber = request.WarrantyNumber?.Trim(),
                WarrantyNotes = request.WarrantyNotes?.Trim(),

                Notes = request.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = GetCurrentUserId()
            };

            _context.Assets.Add(asset);

            // Immutable Audit History
            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = DateTime.UtcNow,
                Action = "Asset Created",
                PerformedBy = GetCurrentUserId(),
                NewValue = $"{asset.AssetName} ({asset.AssetCode}) - Tag: {asset.AssetTag}",
                Remarks = $"Registered with capitalized cost of ₹{asset.TotalCapitalizedCost:N2} at {asset.Location}."
            });

            await ((DbContext)_context).SaveChangesAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> UpdateAssetAsync(Guid id, UpdateAssetRequest request)
        {
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted);

            if (asset == null) return null;

            var oldStatus = asset.CurrentStatus;
            var oldCondition = asset.Condition;
            var oldLocation = asset.Location;

            asset.AssetName = request.AssetName.Trim();
            asset.AssetCategory = request.AssetCategory.Trim();
            asset.AssetType = request.AssetType?.Trim();
            asset.SerialNumber = request.SerialNumber?.Trim();
            asset.ModelNumber = request.ModelNumber?.Trim();
            asset.Manufacturer = request.Manufacturer?.Trim();
            asset.Description = request.Description?.Trim();
            asset.Location = request.Location?.Trim() ?? asset.Location;
            asset.Department = request.Department?.Trim() ?? asset.Department;
            asset.Condition = request.Condition ?? asset.Condition;
            asset.CurrentStatus = request.CurrentStatus ?? asset.CurrentStatus;
            asset.Notes = request.Notes?.Trim() ?? asset.Notes;
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            var changes = new List<string>();
            if (oldStatus != asset.CurrentStatus) changes.Add($"Status: {oldStatus} → {asset.CurrentStatus}");
            if (oldCondition != asset.Condition) changes.Add($"Condition: {oldCondition} → {asset.Condition}");
            if (oldLocation != asset.Location) changes.Add($"Location: {oldLocation} → {asset.Location}");

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = DateTime.UtcNow,
                Action = "Asset Updated",
                PerformedBy = GetCurrentUserId(),
                PreviousValue = oldStatus,
                NewValue = asset.CurrentStatus,
                Remarks = changes.Count > 0 ? string.Join("; ", changes) : "Updated asset specifications."
            });

            await ((DbContext)_context).SaveChangesAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> AssignAssetAsync(Guid id, AssignAssetRequest request)
        {
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted);

            if (asset == null) return null;

            var oldEmployee = asset.AssignedEmployeeName ?? "Unassigned";
            var newEmployee = string.IsNullOrWhiteSpace(request.EmployeeName) ? "Unassigned" : request.EmployeeName.Trim();

            asset.AssignedEmployeeId = request.EmployeeId;
            asset.AssignedEmployeeName = newEmployee == "Unassigned" ? null : newEmployee;
            asset.Department = !string.IsNullOrWhiteSpace(request.Department) ? request.Department.Trim() : asset.Department;
            asset.AssignedDate = request.AssignmentDate;
            asset.CurrentStatus = newEmployee != "Unassigned" ? "InUse" : "Available";
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = DateTime.UtcNow,
                Action = "Asset Assigned",
                PerformedBy = GetCurrentUserId(),
                PreviousValue = oldEmployee,
                NewValue = newEmployee,
                Remarks = $"Assigned to {newEmployee} ({asset.Department ?? "General"}). {request.Notes}".Trim()
            });

            await ((DbContext)_context).SaveChangesAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> TransferAssetAsync(Guid id, TransferAssetRequest request)
        {
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted);

            if (asset == null) return null;

            var oldLocation = asset.Location ?? "Main Site";
            var newLocation = request.ToLocation.Trim();

            asset.Location = newLocation;
            if (!string.IsNullOrWhiteSpace(request.ToEmployee))
            {
                asset.AssignedEmployeeName = request.ToEmployee.Trim();
            }
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = DateTime.UtcNow,
                Action = "Location Transferred",
                PerformedBy = GetCurrentUserId(),
                PreviousValue = oldLocation,
                NewValue = newLocation,
                Remarks = $"Transferred from {oldLocation} to {newLocation}. Reason: {request.Reason}. {request.Notes}".Trim()
            });

            await ((DbContext)_context).SaveChangesAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<AssetMaintenanceRecordDto?> RecordMaintenanceAsync(Guid id, RecordMaintenanceRequest request)
        {
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted);

            if (asset == null) return null;

            var companyId = await GetCompanyIdAsync();
            var totalCost = request.PartsCost + request.LabourCost + request.OtherCost;

            var record = new AssetMaintenanceRecord
            {
                TenantId = _tenantProvider.TenantId,
                CompanyId = companyId,
                AssetId = asset.Id,
                MaintenanceType = request.MaintenanceType,
                MaintenanceDate = request.MaintenanceDate,
                ServiceProvider = request.ServiceProvider.Trim(),
                Description = request.Description.Trim(),
                PartsCost = request.PartsCost,
                LabourCost = request.LabourCost,
                OtherCost = request.OtherCost,
                TotalCost = totalCost,
                NextMaintenanceDate = request.NextMaintenanceDate,
                IsWarrantyClaim = request.IsWarrantyClaim,
                TechnicianName = request.TechnicianName?.Trim(),
                Notes = request.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = GetCurrentUserId()
            };

            _context.AssetMaintenanceRecords.Add(record);

            // Update asset maintenance metrics
            asset.LastMaintenanceDate = request.MaintenanceDate;
            asset.NextMaintenanceDate = request.NextMaintenanceDate;
            asset.TotalMaintenanceCost += totalCost;
            asset.CurrentStatus = request.NextMaintenanceDate.HasValue && request.NextMaintenanceDate.Value > DateTime.UtcNow ? "Active" : asset.CurrentStatus;
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = DateTime.UtcNow,
                Action = "Maintenance Recorded",
                PerformedBy = GetCurrentUserId(),
                NewValue = $"Cost: ₹{totalCost:N2}",
                Remarks = $"[{request.MaintenanceType}] {request.Description} by {request.ServiceProvider}. Next due: {request.NextMaintenanceDate?.ToString("dd MMM yyyy") ?? "N/A"}"
            });

            await ((DbContext)_context).SaveChangesAsync();

            return new AssetMaintenanceRecordDto
            {
                Id = record.Id,
                AssetId = record.AssetId,
                MaintenanceType = record.MaintenanceType,
                MaintenanceDate = record.MaintenanceDate,
                ServiceProvider = record.ServiceProvider,
                Description = record.Description,
                PartsCost = record.PartsCost,
                LabourCost = record.LabourCost,
                OtherCost = record.OtherCost,
                TotalCost = record.TotalCost,
                NextMaintenanceDate = record.NextMaintenanceDate,
                IsWarrantyClaim = record.IsWarrantyClaim,
                TechnicianName = record.TechnicianName,
                Notes = record.Notes,
                CreatedAt = record.CreatedAt,
                CreatedBy = record.CreatedBy
            };
        }

        public async Task<List<AssetMaintenanceRecordDto>> GetMaintenanceRecordsAsync(Guid id)
        {
            var records = await _context.AssetMaintenanceRecords
                .Where(m => m.AssetId == id && m.TenantId == _tenantProvider.TenantId)
                .OrderByDescending(m => m.MaintenanceDate)
                .AsNoTracking()
                .ToListAsync();

            return records.Select(r => new AssetMaintenanceRecordDto
            {
                Id = r.Id,
                AssetId = r.AssetId,
                MaintenanceType = r.MaintenanceType,
                MaintenanceDate = r.MaintenanceDate,
                ServiceProvider = r.ServiceProvider,
                Description = r.Description,
                PartsCost = r.PartsCost,
                LabourCost = r.LabourCost,
                OtherCost = r.OtherCost,
                TotalCost = r.TotalCost,
                NextMaintenanceDate = r.NextMaintenanceDate,
                IsWarrantyClaim = r.IsWarrantyClaim,
                TechnicianName = r.TechnicianName,
                Notes = r.Notes,
                CreatedAt = r.CreatedAt,
                CreatedBy = r.CreatedBy
            }).ToList();
        }

        public async Task<DetailedAssetDto?> CalculateDepreciationAsync(Guid id)
        {
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted);

            if (asset == null || asset.CurrentStatus == "Disposed") return null;

            var capitalized = asset.TotalCapitalizedCost > 0 ? asset.TotalCapitalizedCost : asset.PurchasePrice;
            var usefulLife = asset.UsefulLifeYears > 0 ? asset.UsefulLifeYears : 5;
            var residual = asset.ResidualValue >= 0 ? asset.ResidualValue : 0;
            var depreciableAmount = Math.Max(0, capitalized - residual);

            var startDate = asset.DepreciationStartDate ?? asset.PurchaseDate;
            var now = DateTime.UtcNow;
            var elapsedYears = (decimal)(now - startDate).TotalDays / 365.25m;

            if (elapsedYears <= 0) elapsedYears = 0;

            decimal newAccumulatedDepreciation = 0;

            if (asset.DepreciationMethod == "StraightLine")
            {
                var annualDepreciation = depreciableAmount / usefulLife;
                newAccumulatedDepreciation = Math.Min(depreciableAmount, annualDepreciation * elapsedYears);
            }
            else
            {
                // Written Down Value (WDV) rate
                var rate = (asset.DepreciationRate > 0 ? asset.DepreciationRate : (100m / usefulLife)) / 100m;
                var currentBook = capitalized;
                for (int i = 0; i < (int)Math.Floor(elapsedYears); i++)
                {
                    var annual = currentBook * rate;
                    currentBook -= annual;
                }
                newAccumulatedDepreciation = Math.Min(depreciableAmount, capitalized - currentBook);
            }

            var previousDep = asset.AccumulatedDepreciation;
            asset.AccumulatedDepreciation = Math.Round(newAccumulatedDepreciation, 2);
            asset.CurrentValue = Math.Max(residual, Math.Round(capitalized - asset.AccumulatedDepreciation, 2));
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = DateTime.UtcNow,
                Action = "Depreciation Calculated",
                PerformedBy = GetCurrentUserId(),
                PreviousValue = $"Book Value: ₹{capitalized - previousDep:N2}",
                NewValue = $"Book Value: ₹{asset.CurrentValue:N2}",
                Remarks = $"Accumulated Depreciation updated to ₹{asset.AccumulatedDepreciation:N2} via {asset.DepreciationMethod} method."
            });

            await ((DbContext)_context).SaveChangesAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> DisposeAssetAsync(Guid id, DisposeAssetRequest request)
        {
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted);

            if (asset == null) return null;

            if (asset.CurrentStatus == "Disposed")
                throw new InvalidOperationException("Asset has already been disposed.");

            asset.CurrentStatus = "Disposed";
            asset.DisposalDate = request.DisposalDate;
            asset.DisposalMethod = request.DisposalMethod;
            asset.DisposalReason = request.Reason.Trim();
            asset.SaleValue = request.SaleValue;
            asset.DisposalCost = request.DisposalCost;
            asset.BuyerParty = request.BuyerParty?.Trim();
            asset.DisposalRefNo = request.ReferenceNumber?.Trim();
            asset.DisposedBy = GetCurrentUserId();
            asset.CurrentValue = 0;
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = request.DisposalDate,
                Action = "Asset Disposed",
                PerformedBy = GetCurrentUserId(),
                NewValue = $"Disposed via {request.DisposalMethod}",
                Remarks = $"Sale Value: ₹{request.SaleValue:N2}, Disposal Cost: ₹{request.DisposalCost:N2}. Reason: {request.Reason}"
            });

            await ((DbContext)_context).SaveChangesAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<List<AssetHistoryDto>> GetAssetHistoryAsync(Guid id)
        {
            var histories = await _context.AssetHistories
                .Where(h => h.AssetId == id)
                .OrderByDescending(h => h.Date)
                .AsNoTracking()
                .ToListAsync();

            return histories.Select(h => new AssetHistoryDto
            {
                Id = h.Id,
                AssetId = h.AssetId,
                Date = h.Date,
                Action = h.Action,
                PerformedBy = h.PerformedBy,
                PreviousValue = h.PreviousValue,
                NewValue = h.NewValue,
                Remarks = h.Remarks
            }).ToList();
        }

        public async Task<bool> BulkUpdateStatusAsync(BulkAssetStatusRequest request)
        {
            if (request.AssetIds == null || request.AssetIds.Count == 0) return false;

            var assets = await _context.Assets
                .Where(a => request.AssetIds.Contains(a.Id) && a.TenantId == _tenantProvider.TenantId && !a.IsDeleted)
                .ToListAsync();

            foreach (var asset in assets)
            {
                var oldStatus = asset.CurrentStatus;
                asset.CurrentStatus = request.Status;
                if (!string.IsNullOrWhiteSpace(request.Location)) asset.Location = request.Location.Trim();
                asset.UpdatedAt = DateTime.UtcNow;
                asset.UpdatedBy = GetCurrentUserId();

                _context.AssetHistories.Add(new AssetHistory
                {
                    AssetId = asset.Id,
                    Date = DateTime.UtcNow,
                    Action = "Bulk Status Update",
                    PerformedBy = GetCurrentUserId(),
                    PreviousValue = oldStatus,
                    NewValue = request.Status,
                    Remarks = request.Reason ?? "Updated via Bulk Actions."
                });
            }

            await ((DbContext)_context).SaveChangesAsync();
            return true;
        }

        public async Task<AssetImportResult> ImportAssetsAsync(List<AssetImportRow> rows)
        {
            var result = new AssetImportResult
            {
                TotalRows = rows.Count
            };

            if (rows.Count == 0) return result;

            var companyId = await GetCompanyIdAsync();

            for (int i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var rowNum = i + 1;

                if (string.IsNullOrWhiteSpace(row.AssetName))
                {
                    result.RowErrors.Add($"Row {rowNum}: Missing required field 'AssetName'.");
                    continue;
                }

                if (string.IsNullOrWhiteSpace(row.AssetCategory))
                {
                    result.RowErrors.Add($"Row {rowNum}: Missing required field 'AssetCategory'.");
                    continue;
                }

                if (row.PurchaseCost < 0)
                {
                    result.RowErrors.Add($"Row {rowNum}: Purchase cost cannot be negative.");
                    continue;
                }

                var assetCode = await GenerateAssetCodeAsync();
                var tag = !string.IsNullOrWhiteSpace(row.AssetTag) ? row.AssetTag.Trim().ToUpper() : $"TAG-{assetCode}";

                var tagExists = await _context.Assets.AnyAsync(a =>
                    a.TenantId == _tenantProvider.TenantId &&
                    !a.IsDeleted &&
                    a.AssetTag.ToLower() == tag.ToLower());

                if (tagExists)
                {
                    result.RowErrors.Add($"Row {rowNum}: Asset tag '{tag}' already exists.");
                    continue;
                }

                DateTime pDate = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(row.PurchaseDate) && DateTime.TryParse(row.PurchaseDate, out var parsedDate))
                {
                    pDate = parsedDate;
                }

                var asset = new Asset
                {
                    TenantId = _tenantProvider.TenantId,
                    CompanyId = companyId,
                    AssetCode = assetCode,
                    AssetTag = tag,
                    AssetName = row.AssetName.Trim(),
                    AssetCategory = row.AssetCategory.Trim(),
                    SerialNumber = row.SerialNumber?.Trim(),
                    PurchaseDate = pDate,
                    PurchasePrice = row.PurchaseCost,
                    TotalCapitalizedCost = row.PurchaseCost,
                    CurrentValue = row.PurchaseCost,
                    Location = string.IsNullOrWhiteSpace(row.Location) ? "Main Site" : row.Location.Trim(),
                    Department = row.Department?.Trim(),
                    CurrentStatus = string.IsNullOrWhiteSpace(row.Status) ? "Active" : row.Status.Trim(),
                    Condition = string.IsNullOrWhiteSpace(row.Condition) ? "Good" : row.Condition.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = GetCurrentUserId()
                };

                _context.Assets.Add(asset);

                _context.AssetHistories.Add(new AssetHistory
                {
                    AssetId = asset.Id,
                    Date = DateTime.UtcNow,
                    Action = "Asset Imported",
                    PerformedBy = GetCurrentUserId(),
                    NewValue = $"{asset.AssetName} ({asset.AssetCode})",
                    Remarks = $"Imported via bulk CSV/Excel import."
                });

                result.ImportedCount++;
            }

            if (result.ImportedCount > 0)
            {
                await ((DbContext)_context).SaveChangesAsync();
            }

            return result;
        }

        private DetailedAssetDto MapToDetailedDto(Asset a)
        {
            var now = DateTime.UtcNow;
            var thirtyDaysFromNow = now.AddDays(30);

            var isWarrantyActive = a.WarrantyEndDate.HasValue && a.WarrantyEndDate.Value >= now;
            var isWarrantyExpiringSoon = a.WarrantyEndDate.HasValue && a.WarrantyEndDate.Value >= now && a.WarrantyEndDate.Value <= thirtyDaysFromNow;

            return new DetailedAssetDto
            {
                Id = a.Id,
                AssetCode = a.AssetCode,
                AssetTag = a.AssetTag,
                AssetName = a.AssetName,
                AssetCategory = a.AssetCategory,
                AssetType = a.AssetType,
                SerialNumber = a.SerialNumber,
                ModelNumber = a.ModelNumber,
                Manufacturer = a.Manufacturer,
                Description = a.Description,

                PurchaseDate = a.PurchaseDate,
                PurchasePrice = a.PurchasePrice,
                SupplierId = a.SupplierId,
                SupplierName = a.SupplierName,
                PurchaseInvoiceNumber = a.PurchaseInvoiceNumber,
                PurchaseOrderNumber = a.PurchaseOrderNumber,
                TaxAmount = a.TaxAmount,
                FreightCost = a.FreightCost,
                InstallationCost = a.InstallationCost,
                OtherCapitalizedCost = a.OtherCapitalizedCost,
                TotalCapitalizedCost = a.TotalCapitalizedCost > 0 ? a.TotalCapitalizedCost : a.PurchasePrice,

                DepreciationMethod = a.DepreciationMethod,
                UsefulLifeYears = a.UsefulLifeYears,
                ResidualValue = a.ResidualValue,
                DepreciationStartDate = a.DepreciationStartDate,
                DepreciationFrequency = a.DepreciationFrequency,
                DepreciationRate = a.DepreciationRate,
                AccumulatedDepreciation = a.AccumulatedDepreciation,
                CurrentValue = a.CurrentValue,

                Location = a.Location,
                Department = a.Department,
                AssignedEmployeeId = a.AssignedEmployeeId,
                AssignedEmployeeName = a.AssignedEmployeeName,
                AssignedDate = a.AssignedDate,

                CurrentStatus = a.CurrentStatus,
                Condition = a.Condition,

                WarrantyDetails = a.WarrantyDetails,
                WarrantyStartDate = a.WarrantyStartDate,
                WarrantyEndDate = a.WarrantyEndDate,
                WarrantyProvider = a.WarrantyProvider,
                WarrantyNumber = a.WarrantyNumber,
                WarrantyNotes = a.WarrantyNotes,
                IsWarrantyActive = isWarrantyActive,
                IsWarrantyExpiringSoon = isWarrantyExpiringSoon,

                LastMaintenanceDate = a.LastMaintenanceDate,
                NextMaintenanceDate = a.NextMaintenanceDate,
                TotalMaintenanceCost = a.TotalMaintenanceCost,

                DisposalDate = a.DisposalDate,
                DisposalMethod = a.DisposalMethod,
                DisposalReason = a.DisposalReason,
                SaleValue = a.SaleValue,
                DisposalCost = a.DisposalCost,
                BuyerParty = a.BuyerParty,
                DisposalRefNo = a.DisposalRefNo,
                DisposedBy = a.DisposedBy,

                Notes = a.Notes,
                PhotoUrl = a.PhotoUrl,
                DocumentUrl = a.DocumentUrl,

                CreatedAt = a.CreatedAt,
                CreatedBy = a.CreatedBy,
                UpdatedAt = a.UpdatedAt,
                UpdatedBy = a.UpdatedBy
            };
        }
    }
}
