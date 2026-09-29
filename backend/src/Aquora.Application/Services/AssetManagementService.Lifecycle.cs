using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Aquora.Application.DTOs;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Aquora.Application.Services
{
    public partial class AssetManagementService
    {
        // PostgreSQL timestamps have microsecond precision. No new persisted version column is needed.
        private static string VersionOf(Asset asset) => ((asset.UpdatedAt ?? asset.CreatedAt).Ticks / 10).ToString(System.Globalization.CultureInfo.InvariantCulture);

        private static void CheckVersion(Asset asset, AssetMutationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ExpectedVersion) || request.ExpectedVersion != VersionOf(asset))
                throw new DbUpdateConcurrencyException("This asset was modified by another user. Refresh and try again.");
        }

        private static void RequireOperational(Asset asset)
        {
            if (asset.CurrentStatus.Equals("Disposed", StringComparison.OrdinalIgnoreCase) ||
                asset.CurrentStatus.Equals("Retired", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Disposed assets are historical records and cannot perform this operation.");
        }

        private async Task<IDbContextTransaction?> BeginAssetTransactionAsync() =>
            _context.Database.IsRelational()
                ? await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable)
                : null;

        private async Task<User> RequireEmployeeAsync(Guid? employeeId)
        {
            if (!employeeId.HasValue || employeeId == Guid.Empty)
                throw new ArgumentException("Select an employee from the employee search results.");
            if (_platformContext == null) throw new InvalidOperationException("Employee directory is unavailable.");
            return await _platformContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == employeeId &&
                u.TenantId == GetTenantId() && u.IsActive && !u.IsDeleted && !u.IsPlatformAdmin)
                ?? throw new ArgumentException("The selected employee is unavailable or does not belong to this company.");
        }

        public async Task<List<AssetEmployeeDto>> SearchEmployeesAsync(string? search)
        {
            if (_platformContext == null) throw new InvalidOperationException("Employee directory is unavailable.");
            var query = _platformContext.Users.AsNoTracking().Where(u => u.TenantId == GetTenantId() &&
                u.IsActive && !u.IsDeleted && !u.IsPlatformAdmin);
            var term = (search ?? "").Trim().ToLowerInvariant();
            if (term.Length > 100) term = term[..100];
            if (term.Length > 0)
                query = query.Where(u => (u.FirstName + " " + u.LastName).ToLower().Contains(term) ||
                    (u.Username != null && u.Username.ToLower().Contains(term)) ||
                    u.Email.ToLower().Contains(term) || (u.Department != null && u.Department.ToLower().Contains(term)));
            return await query.OrderBy(u => u.FirstName).ThenBy(u => u.LastName).ThenBy(u => u.Id).Take(25)
                .Select(u => new AssetEmployeeDto { Id = u.Id, FullName = (u.FirstName + " " + u.LastName).Trim(),
                    Username = u.Username, Department = u.Department }).ToListAsync();
        }

        public async Task<AssetHistoryExistsDto> CheckAssetHistoryExistsAsync(Guid id)
        {
            await EnsureAssetSchemaAsync();
            var tenantId = GetTenantId();
            var asset = await _context.Assets.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);

            if (asset == null)
            {
                return new AssetHistoryExistsDto
                {
                    HasHistory = false,
                    Reason = null,
                    IsDisposed = false
                };
            }

            if (asset.CurrentStatus.Equals("Disposed", StringComparison.OrdinalIgnoreCase) ||
                asset.CurrentStatus.Equals("Retired", StringComparison.OrdinalIgnoreCase) ||
                asset.DisposalDate != null)
            {
                return new AssetHistoryExistsDto
                {
                    HasHistory = true,
                    IsDisposed = true,
                    Reason = "This asset is marked as disposed and must be preserved in historical records."
                };
            }

            if (asset.AccumulatedDepreciation > 0 ||
                await _context.AssetHistories.AnyAsync(h => h.AssetId == id &&
                    (h.Action == "Depreciation Applied" || h.Action == "Depreciation Calculated")))
            {
                return new AssetHistoryExistsDto
                {
                    HasHistory = true,
                    IsDisposed = false,
                    Reason = "This asset has depreciation history and cannot be permanently deleted. Mark it as Disposed instead."
                };
            }

            if (asset.AssignedEmployeeId != null || asset.AssignedDate != null ||
                await _context.AssetHistories.AnyAsync(h => h.AssetId == id && h.Action == "Asset Assigned"))
            {
                return new AssetHistoryExistsDto
                {
                    HasHistory = true,
                    IsDisposed = false,
                    Reason = "This asset has employee assignment history and cannot be permanently deleted. Mark it as Disposed instead."
                };
            }

            if (asset.TotalMaintenanceCost > 0 || asset.LastMaintenanceDate != null ||
                await _context.AssetMaintenanceRecords.IgnoreQueryFilters().AnyAsync(m => m.AssetId == id) ||
                await _context.AssetHistories.AnyAsync(h => h.AssetId == id && h.Action == "Maintenance Recorded"))
            {
                return new AssetHistoryExistsDto
                {
                    HasHistory = true,
                    IsDisposed = false,
                    Reason = "This asset has maintenance records and cannot be permanently deleted. Mark it as Disposed instead."
                };
            }

            if (await _context.AssetHistories.AnyAsync(h => h.AssetId == id && h.Action == "Location Transferred"))
            {
                return new AssetHistoryExistsDto
                {
                    HasHistory = true,
                    IsDisposed = false,
                    Reason = "This asset has location transfer history and cannot be permanently deleted. Mark it as Disposed instead."
                };
            }

            if (await _context.Purchases.IgnoreQueryFilters().AnyAsync(p => p.AssetId == id) ||
                await _context.AssetHistories.AnyAsync(h => h.AssetId == id &&
                    (h.Action == "Purchased" || h.Action == "Asset Created from Purchase")))
            {
                return new AssetHistoryExistsDto
                {
                    HasHistory = true,
                    IsDisposed = false,
                    Reason = "This asset is linked to accounting purchase records and cannot be permanently deleted. Mark it as Disposed instead."
                };
            }

            return new AssetHistoryExistsDto
            {
                HasHistory = false,
                Reason = null,
                IsDisposed = false
            };
        }

        public async Task<bool> DeleteAssetAsync(Guid id, AssetMutationRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var asset = await _context.Assets.FirstOrDefaultAsync(a => a.Id == id && a.TenantId == GetTenantId() && !a.IsDeleted);
            if (asset == null) return false;
            CheckVersion(asset, request);

            // Re-evaluate history inside transaction to prevent race conditions
            var historyCheck = await CheckAssetHistoryExistsAsync(id);
            if (historyCheck.HasHistory)
            {
                throw new ArgumentException(historyCheck.Reason ?? "This asset has historical records and cannot be permanently deleted. Mark it as Disposed instead.");
            }

            var key = id.ToString();
            var history = await _context.AssetHistories.Where(h => h.AssetId == id).AsNoTracking().ToListAsync();
            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = GetTenantId(),
                UserId = GetCurrentUserId(),
                Action = "Asset Permanently Deleted",
                TableName = "Assets",
                PrimaryKey = key,
                Module = "Assets",
                OldValues = System.Text.Json.JsonSerializer.Serialize(new { Asset = MapToDetailedDto(asset), History = history.Select(h => new { h.Action, h.Date, h.PerformedBy, h.NewValue, h.Remarks }) }),
                Timestamp = DateTime.UtcNow,
                Reason = "Incorrect or duplicate record removed after dependency checks."
            });
            await ((DbContext)_context).SaveChangesAsync();

            // ExecuteDelete intentionally bypasses the global soft-delete interceptor, inside this transaction only.
            if (_context.Database.IsRelational())
            {
                await _context.AssetHistories.Where(h => h.AssetId == id).ExecuteDeleteAsync();
                var deleted = await _context.Assets.Where(a => a.Id == id && a.TenantId == GetTenantId()).ExecuteDeleteAsync();
                if (deleted != 1) throw new DbUpdateConcurrencyException("This asset was modified by another user. Refresh and try again.");
            }
            else
            {
                var historiesToDelete = await _context.AssetHistories.Where(h => h.AssetId == id).ToListAsync();
                _context.AssetHistories.RemoveRange(historiesToDelete);
                _context.Assets.Remove(asset);
                await ((DbContext)_context).SaveChangesAsync();
            }

            if (transaction != null) await transaction.CommitAsync();
            ((DbContext)_context).Entry(asset).State = EntityState.Detached;
            return true;
        }
    }
}

