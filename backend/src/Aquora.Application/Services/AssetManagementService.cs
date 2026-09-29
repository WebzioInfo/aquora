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
    public partial class AssetManagementService : IAssetManagementService
    {
        private readonly ITenantDbContext _context;
        private readonly IPlatformDbContext? _platformContext;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _userProvider;

        public AssetManagementService(
            ITenantDbContext context,
            ITenantProvider tenantProvider,
            ICurrentUserContext userProvider, IPlatformDbContext? platformContext = null)
        {
            _context = context;
            _platformContext = platformContext;
            _tenantProvider = tenantProvider;
            _userProvider = userProvider;
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _schemaCheckedTenants = new(StringComparer.OrdinalIgnoreCase);

        private Guid GetTenantId()
        {
            if (_tenantProvider.TenantId != Guid.Empty) return _tenantProvider.TenantId;
            if (_userProvider.TenantId != Guid.Empty) return _userProvider.TenantId;
            return Guid.Empty;
        }

        private async Task EnsureAssetSchemaAsync()
        {
            var schema = _tenantProvider.TenantSchemaName;
            if (string.IsNullOrWhiteSpace(schema)) schema = "public";
            if (!_context.Database.IsRelational()) return;
            if (!System.Text.RegularExpressions.Regex.IsMatch(schema, "^[a-zA-Z_][a-zA-Z0-9_]*$")) throw new InvalidOperationException("Invalid tenant schema.");

            if (_schemaCheckedTenants.TryGetValue(schema, out var checkedOk) && checkedOk)
            {
                return;
            }

            try
            {
                var sql = $@"
                    CREATE TABLE IF NOT EXISTS ""{schema}"".""Assets"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""TenantId"" uuid NOT NULL,
                        ""CompanyId"" uuid NOT NULL,
                        ""AssetCode"" text NOT NULL DEFAULT '',
                        ""AssetTag"" text NOT NULL DEFAULT '',
                        ""AssetName"" text NOT NULL DEFAULT '',
                        ""AssetCategory"" text NOT NULL DEFAULT 'Other',
                        ""AssetType"" text NULL,
                        ""SerialNumber"" text NULL,
                        ""ModelNumber"" text NULL,
                        ""Manufacturer"" text NULL,
                        ""Description"" text NULL,
                        ""PurchaseDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""PurchasePrice"" numeric NOT NULL DEFAULT 0.0,
                        ""SupplierId"" uuid NULL,
                        ""SupplierName"" text NULL,
                        ""PurchaseInvoiceNumber"" text NULL,
                        ""PurchaseOrderNumber"" text NULL,
                        ""TaxAmount"" numeric NOT NULL DEFAULT 0.0,
                        ""FreightCost"" numeric NOT NULL DEFAULT 0.0,
                        ""InstallationCost"" numeric NOT NULL DEFAULT 0.0,
                        ""OtherCapitalizedCost"" numeric NOT NULL DEFAULT 0.0,
                        ""TotalCapitalizedCost"" numeric NOT NULL DEFAULT 0.0,
                        ""DepreciationMethod"" text NOT NULL DEFAULT 'StraightLine',
                        ""UsefulLifeYears"" numeric NOT NULL DEFAULT 5,
                        ""ResidualValue"" numeric NOT NULL DEFAULT 0,
                        ""DepreciationStartDate"" timestamp with time zone NULL,
                        ""DepreciationFrequency"" text NOT NULL DEFAULT 'Yearly',
                        ""DepreciationRate"" numeric NOT NULL DEFAULT 0.0,
                        ""AccumulatedDepreciation"" numeric NOT NULL DEFAULT 0.0,
                        ""CurrentValue"" numeric NOT NULL DEFAULT 0.0,
                        ""Location"" text NULL,
                        ""Department"" text NULL,
                        ""AssignedEmployeeId"" uuid NULL,
                        ""AssignedEmployeeName"" text NULL,
                        ""AssignedDate"" timestamp with time zone NULL,
                        ""CurrentStatus"" text NOT NULL DEFAULT 'Active',
                        ""Condition"" text NOT NULL DEFAULT 'Good',
                        ""WarrantyDetails"" text NULL,
                        ""WarrantyStartDate"" timestamp with time zone NULL,
                        ""WarrantyEndDate"" timestamp with time zone NULL,
                        ""WarrantyProvider"" text NULL,
                        ""WarrantyNumber"" text NULL,
                        ""WarrantyNotes"" text NULL,
                        ""LastMaintenanceDate"" timestamp with time zone NULL,
                        ""NextMaintenanceDate"" timestamp with time zone NULL,
                        ""TotalMaintenanceCost"" numeric NOT NULL DEFAULT 0.0,
                        ""DisposalDate"" timestamp with time zone NULL,
                        ""DisposalMethod"" text NULL,
                        ""DisposalReason"" text NULL,
                        ""SaleValue"" numeric NOT NULL DEFAULT 0.0,
                        ""DisposalCost"" numeric NOT NULL DEFAULT 0.0,
                        ""BuyerParty"" text NULL,
                        ""DisposalRefNo"" text NULL,
                        ""DisposedBy"" text NULL,
                        ""Notes"" text NULL,
                        ""PhotoUrl"" text NULL,
                        ""DocumentUrl"" text NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""CreatedBy"" text NOT NULL DEFAULT 'System',
                        ""UpdatedAt"" timestamp with time zone NULL,
                        ""UpdatedBy"" text NULL,
                        ""CreatedByIP"" text NULL,
                        ""UpdatedByIP"" text NULL,
                        ""IsDeleted"" boolean NOT NULL DEFAULT false,
                        ""DeletedAt"" timestamp with time zone NULL,
                        ""DeletedBy"" text NULL
                    );

                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssetCode"" text NOT NULL DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssetTag"" text NOT NULL DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssetType"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""ModelNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Manufacturer"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""SupplierName"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""PurchaseInvoiceNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""PurchaseOrderNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""TaxAmount"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""FreightCost"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""InstallationCost"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""OtherCapitalizedCost"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""TotalCapitalizedCost"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationMethod"" text NOT NULL DEFAULT 'StraightLine';
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UsefulLifeYears"" numeric NOT NULL DEFAULT 5;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""ResidualValue"" numeric NOT NULL DEFAULT 0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationStartDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationFrequency"" text NOT NULL DEFAULT 'Yearly';
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationRate"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AccumulatedDepreciation"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Department"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssignedEmployeeName"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssignedDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Condition"" text NOT NULL DEFAULT 'Good';
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyStartDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyEndDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyProvider"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyNotes"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""LastMaintenanceDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""NextMaintenanceDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""TotalMaintenanceCost"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalMethod"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalReason"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""SaleValue"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalCost"" numeric NOT NULL DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""BuyerParty"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalRefNo"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposedBy"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Notes"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""PhotoUrl"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DocumentUrl"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""CreatedBy"" text NOT NULL DEFAULT 'System';
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UpdatedAt"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UpdatedBy"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""CreatedByIP"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UpdatedByIP"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""IsDeleted"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DeletedAt"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DeletedBy"" text NULL;

                    -- DATA REPAIR: Backfill NULL or empty AssetCode deterministically
                    WITH numbered_null_assets AS (
                        SELECT ""Id"", ROW_NUMBER() OVER (ORDER BY ""CreatedAt"" ASC, ""Id"" ASC) as rn
                        FROM ""{schema}"".""Assets""
                        WHERE ""AssetCode"" IS NULL OR ""AssetCode"" = ''
                    )
                    UPDATE ""{schema}"".""Assets"" a
                    SET ""AssetCode"" = 'AST-' || TO_CHAR(COALESCE(a.""CreatedAt"", CURRENT_TIMESTAMP), 'YYYY') || '-' || LPAD(numbered_null_assets.rn::text, 5, '0')
                    FROM numbered_null_assets
                    WHERE a.""Id"" = numbered_null_assets.""Id"";

                    UPDATE ""{schema}"".""Assets""
                    SET ""AssetCode"" = 'AST-' || SUBSTRING(""Id""::text, 1, 8)
                    WHERE ""AssetCode"" IS NULL OR ""AssetCode"" = '';

                    UPDATE ""{schema}"".""Assets"" SET ""AssetTag"" = 'TAG-' || ""AssetCode"" WHERE ""AssetTag"" IS NULL OR ""AssetTag"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""AssetName"" = 'Asset ' || ""AssetCode"" WHERE ""AssetName"" IS NULL OR ""AssetName"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""AssetCategory"" = 'Other' WHERE ""AssetCategory"" IS NULL OR ""AssetCategory"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""PurchaseDate"" = CURRENT_TIMESTAMP WHERE ""PurchaseDate"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""PurchasePrice"" = 0.0 WHERE ""PurchasePrice"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""TaxAmount"" = 0.0 WHERE ""TaxAmount"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""FreightCost"" = 0.0 WHERE ""FreightCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""InstallationCost"" = 0.0 WHERE ""InstallationCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""OtherCapitalizedCost"" = 0.0 WHERE ""OtherCapitalizedCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""TotalCapitalizedCost"" = COALESCE(""PurchasePrice"", 0.0) WHERE ""TotalCapitalizedCost"" IS NULL OR ""TotalCapitalizedCost"" = 0.0;
                    UPDATE ""{schema}"".""Assets"" SET ""DepreciationMethod"" = 'StraightLine' WHERE ""DepreciationMethod"" IS NULL OR ""DepreciationMethod"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""UsefulLifeYears"" = 5 WHERE ""UsefulLifeYears"" IS NULL OR ""UsefulLifeYears"" <= 0;
                    UPDATE ""{schema}"".""Assets"" SET ""ResidualValue"" = 0.0 WHERE ""ResidualValue"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""DepreciationFrequency"" = 'Yearly' WHERE ""DepreciationFrequency"" IS NULL OR ""DepreciationFrequency"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""DepreciationRate"" = 0.0 WHERE ""DepreciationRate"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""AccumulatedDepreciation"" = 0.0 WHERE ""AccumulatedDepreciation"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CurrentValue"" = COALESCE(""TotalCapitalizedCost"", ""PurchasePrice"", 0.0) WHERE ""CurrentValue"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CurrentStatus"" = 'Active' WHERE ""CurrentStatus"" IS NULL OR ""CurrentStatus"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""Condition"" = 'Good' WHERE ""Condition"" IS NULL OR ""Condition"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""TotalMaintenanceCost"" = 0.0 WHERE ""TotalMaintenanceCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""SaleValue"" = 0.0 WHERE ""SaleValue"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""DisposalCost"" = 0.0 WHERE ""DisposalCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CreatedAt"" = CURRENT_TIMESTAMP WHERE ""CreatedAt"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CreatedBy"" = 'System' WHERE ""CreatedBy"" IS NULL OR ""CreatedBy"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""IsDeleted"" = false WHERE ""IsDeleted"" IS NULL;

                    -- Enforce NOT NULL and Defaults
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCode"" SET DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCode"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetTag"" SET DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetTag"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetName"" SET DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetName"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCategory"" SET DEFAULT 'Other';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCategory"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchaseDate"" SET DEFAULT CURRENT_TIMESTAMP;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchaseDate"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchasePrice"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchasePrice"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TaxAmount"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TaxAmount"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""FreightCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""FreightCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""InstallationCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""InstallationCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""OtherCapitalizedCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""OtherCapitalizedCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalCapitalizedCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalCapitalizedCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationMethod"" SET DEFAULT 'StraightLine';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationMethod"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""UsefulLifeYears"" SET DEFAULT 5;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""UsefulLifeYears"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""ResidualValue"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""ResidualValue"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationFrequency"" SET DEFAULT 'Yearly';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationFrequency"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationRate"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationRate"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AccumulatedDepreciation"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AccumulatedDepreciation"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentValue"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentValue"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentStatus"" SET DEFAULT 'Active';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentStatus"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""Condition"" SET DEFAULT 'Good';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""Condition"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalMaintenanceCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalMaintenanceCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""SaleValue"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""SaleValue"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DisposalCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DisposalCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedAt"" SET DEFAULT CURRENT_TIMESTAMP;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedAt"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedBy"" SET DEFAULT 'System';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedBy"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""IsDeleted"" SET DEFAULT false;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""IsDeleted"" SET NOT NULL;

                    CREATE TABLE IF NOT EXISTS ""{schema}"".""AssetMaintenanceRecords"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""TenantId"" uuid NOT NULL,
                        ""CompanyId"" uuid NOT NULL,
                        ""AssetId"" uuid NOT NULL,
                        ""MaintenanceType"" text NOT NULL DEFAULT 'Preventive',
                        ""MaintenanceDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""ServiceProvider"" text NOT NULL DEFAULT '',
                        ""Description"" text NOT NULL DEFAULT '',
                        ""PartsCost"" numeric NOT NULL DEFAULT 0.0,
                        ""LabourCost"" numeric NOT NULL DEFAULT 0.0,
                        ""OtherCost"" numeric NOT NULL DEFAULT 0.0,
                        ""TotalCost"" numeric NOT NULL DEFAULT 0.0,
                        ""NextMaintenanceDate"" timestamp with time zone NULL,
                        ""IsWarrantyClaim"" boolean NOT NULL DEFAULT false,
                        ""TechnicianName"" text NULL,
                        ""Notes"" text NULL,
                        ""AttachmentUrl"" text NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""CreatedBy"" text NOT NULL DEFAULT 'System'
                    );

                    CREATE TABLE IF NOT EXISTS ""{schema}"".""AssetHistories"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""AssetId"" uuid NOT NULL,
                        ""Date"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""Action"" text NOT NULL DEFAULT '',
                        ""PerformedBy"" text NOT NULL DEFAULT '',
                        ""PreviousValue"" text NULL,
                        ""NewValue"" text NULL,
                        ""Remarks"" text NULL
                    );
                ";

                await _context.Database.ExecuteSqlRawAsync(sql);
                _schemaCheckedTenants[schema] = true;
            }
            catch
            {
                // Ignore schema creation errors if permissions/tables are locked
            }
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

        private Task<string> GenerateAssetCodeAsync()
        {
            var currentYear = DateTime.UtcNow.Year;
            var prefix = $"AST-{currentYear}-";

            return Task.FromResult($"{prefix}{Guid.NewGuid():N}");
        }

        private IQueryable<Asset> BuildFilteredAssetQuery(
            Guid tenantId,
            string? search,
            string? category,
            string? status,
            string? condition,
            string? location,
            string? department,
            DateTime? fromDate,
            DateTime? toDate)
        {
            var query = _context.Assets
                .Where(a => a.TenantId == tenantId && !a.IsDeleted)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(a =>
                    a.AssetName.ToLower().Contains(term) ||
                    a.AssetTag.ToLower().Contains(term) ||
                    a.AssetCode.ToLower().Contains(term) ||
                    (a.SerialNumber != null && a.SerialNumber.ToLower().Contains(term)) ||
                    (a.ModelNumber != null && a.ModelNumber.ToLower().Contains(term)) ||
                    (a.Manufacturer != null && a.Manufacturer.ToLower().Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(category) && !category.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                var cat = category.Trim().ToLower();
                query = query.Where(a => a.AssetCategory.ToLower() == cat);
            }

            if (!string.IsNullOrWhiteSpace(status) && !status.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                var st = status.Trim().ToLower();
                query = query.Where(a => a.CurrentStatus.ToLower() == st);
            }

            if (!string.IsNullOrWhiteSpace(condition) && !condition.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                var cond = condition.Trim().ToLower();
                query = query.Where(a => a.Condition.ToLower() == cond);
            }

            if (!string.IsNullOrWhiteSpace(location) && !location.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                var loc = location.Trim().ToLower();
                query = query.Where(a => a.Location != null && a.Location.ToLower() == loc);
            }

            if (!string.IsNullOrWhiteSpace(department) && !department.Trim().Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                var dept = department.Trim().ToLower();
                query = query.Where(a => a.Department != null && a.Department.ToLower() == dept);
            }

            if (fromDate.HasValue)
            {
                var fromUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
                query = query.Where(a => a.PurchaseDate >= fromUtc);
            }

            if (toDate.HasValue)
            {
                var toUtcExclusive = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1), DateTimeKind.Utc);
                query = query.Where(a => a.PurchaseDate < toUtcExclusive);
            }

            return query;
        }

        private async Task<AssetKpiSummaryDto> CalculateKpiSummaryAsync(IQueryable<Asset> query)
        {
            var now = DateTime.UtcNow;
            var thirtyDaysFromNow = now.AddDays(30);

            var rows = await query.Select(a => new
            {
                a.CurrentStatus,
                a.TotalCapitalizedCost,
                a.PurchasePrice,
                a.CurrentValue,
                a.AccumulatedDepreciation,
                a.WarrantyEndDate
            }).ToListAsync();

            return new AssetKpiSummaryDto
            {
                TotalAssetsCount = rows.Count,
                ActiveAssetsCount = rows.Count(a => string.Equals(a.CurrentStatus, "Active", StringComparison.OrdinalIgnoreCase) || string.Equals(a.CurrentStatus, "InUse", StringComparison.OrdinalIgnoreCase)),
                TotalAssetValue = rows.Sum(a => a.TotalCapitalizedCost > 0 ? a.TotalCapitalizedCost : a.PurchasePrice),
                CurrentBookValue = rows.Where(a => !string.Equals(a.CurrentStatus, "Disposed", StringComparison.OrdinalIgnoreCase) && !string.Equals(a.CurrentStatus, "Retired", StringComparison.OrdinalIgnoreCase)).Sum(a => a.CurrentValue),
                AccumulatedDepreciation = rows.Sum(a => a.AccumulatedDepreciation),
                UnderMaintenanceCount = rows.Count(a => string.Equals(a.CurrentStatus, "UnderMaintenance", StringComparison.OrdinalIgnoreCase)),
                DisposedCount = rows.Count(a => string.Equals(a.CurrentStatus, "Disposed", StringComparison.OrdinalIgnoreCase) || string.Equals(a.CurrentStatus, "Retired", StringComparison.OrdinalIgnoreCase)),
                WarrantyExpiringCount = rows.Count(a => !string.Equals(a.CurrentStatus, "Disposed", StringComparison.OrdinalIgnoreCase) && !string.Equals(a.CurrentStatus, "Retired", StringComparison.OrdinalIgnoreCase) && a.WarrantyEndDate.HasValue && a.WarrantyEndDate.Value >= now && a.WarrantyEndDate.Value <= thirtyDaysFromNow)
            };
        }

        public async Task<AssetPagedResultDto> GetAssetsAsync(
            int pageNumber = 1,
            int pageSize = 50,
            string? search = null,
            string? category = null,
            string? status = null,
            string? condition = null,
            string? location = null,
            string? department = null,
            DateTime? fromDate = null,
            DateTime? toDate = null)
        {
            await EnsureAssetSchemaAsync();
            var tenantId = GetTenantId();

            var query = BuildFilteredAssetQuery(tenantId, search, category, status, condition, location, department, fromDate, toDate);

            var safePageNumber = pageNumber >= 1 ? pageNumber : 1;
            var safePageSize = pageSize > 0 ? (pageSize > 200 ? 200 : pageSize) : 50;

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((safePageNumber - 1) * safePageSize)
                .Take(safePageSize)
                .ToListAsync();

            var summary = await CalculateKpiSummaryAsync(query);

            return new AssetPagedResultDto
            {
                Items = items.Select(MapToDetailedDto).ToList(),
                TotalCount = totalCount,
                PageNumber = safePageNumber,
                PageSize = safePageSize,
                Summary = summary
            };
        }

        public async Task<AssetKpiSummaryDto> GetAssetKpisAsync(
            string? search = null,
            string? category = null,
            string? status = null,
            string? condition = null,
            string? location = null,
            string? department = null,
            DateTime? fromDate = null,
            DateTime? toDate = null)
        {
            await EnsureAssetSchemaAsync();
            var tenantId = GetTenantId();

            var query = BuildFilteredAssetQuery(tenantId, search, category, status, condition, location, department, fromDate, toDate);
            return await CalculateKpiSummaryAsync(query);
        }

        public async Task<DetailedAssetDto?> GetAssetByIdAsync(Guid id)
        {
            await EnsureAssetSchemaAsync();
            var tenantId = GetTenantId();
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);

            return asset == null ? null : MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto> CreateAssetAsync(CreateAssetRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
            if (string.IsNullOrWhiteSpace(request.AssetName))
                throw new ArgumentException("Asset name is required.");

            if (string.IsNullOrWhiteSpace(request.AssetCategory))
                throw new ArgumentException("Asset category is required.");

            if (request.PurchasePrice < 0)
                throw new ArgumentException("Purchase cost cannot be negative.");

            if (request.AssignedEmployeeId.HasValue || !string.IsNullOrWhiteSpace(request.AssignedEmployeeName))
                throw new ArgumentException("Create the asset first, then use Assign to select an employee.");
            if (request.TaxAmount < 0 || request.FreightCost < 0 || request.InstallationCost < 0 || request.OtherCapitalizedCost < 0 || request.ResidualValue < 0)
                throw new ArgumentException("Capitalized costs and residual value cannot be negative.");
            if (request.UsefulLifeYears <= 0) throw new ArgumentException("Useful life must be greater than zero.");
            if (request.WarrantyStartDate > request.WarrantyEndDate) throw new ArgumentException("Warranty end must follow its start date.");
            var companyId = await GetCompanyIdAsync();
            var assetCode = await GenerateAssetCodeAsync();

            var tag = !string.IsNullOrWhiteSpace(request.AssetTag)
                ? request.AssetTag.Trim().ToUpper()
                : $"TAG-{assetCode}";

            // Validate unique tag per tenant
            var tagExists = await _context.Assets.AnyAsync(a =>
                a.TenantId == tenantId &&
                !a.IsDeleted &&
                a.AssetTag.ToLower() == tag.ToLower());

            if (tagExists)
            {
                throw new ArgumentException($"Asset tag '{tag}' is already assigned to another asset.");
            }

            var capitalizedCost = request.PurchasePrice + request.TaxAmount + request.FreightCost + request.InstallationCost + request.OtherCapitalizedCost;
            if (request.ResidualValue > capitalizedCost) throw new ArgumentException("Residual value cannot exceed capitalized cost.");

            var asset = new Asset
            {
                TenantId = tenantId,
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
            if (transaction != null) await transaction.CommitAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> UpdateAssetAsync(Guid id, UpdateAssetRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);

            if (asset == null) return null;
            CheckVersion(asset, request);
            RequireOperational(asset);

            if (string.IsNullOrWhiteSpace(request.AssetName) || string.IsNullOrWhiteSpace(request.AssetCategory))
                throw new ArgumentException("Asset name and category are required.");
            if (request.CurrentStatus != null && request.CurrentStatus != asset.CurrentStatus)
                throw new ArgumentException("Use the lifecycle workflow to change asset status.");
            var before = System.Text.Json.JsonSerializer.Serialize(MapToDetailedDto(asset));
            if (!string.IsNullOrWhiteSpace(request.AssetTag))
            {
                var tag = request.AssetTag.Trim().ToUpperInvariant();
                if (await _context.Assets.AnyAsync(a => a.TenantId == tenantId && a.Id != id && a.AssetTag == tag))
                    throw new ArgumentException("Asset tag is already assigned to another asset.");
                asset.AssetTag = tag;
            }
            if (request.WarrantyStartDate > request.WarrantyEndDate) throw new ArgumentException("Warranty end must follow its start date.");
            asset.WarrantyStartDate = EnsureUtc(request.WarrantyStartDate);
            asset.WarrantyEndDate = EnsureUtc(request.WarrantyEndDate);
            asset.WarrantyProvider = request.WarrantyProvider?.Trim();
            asset.WarrantyNumber = request.WarrantyNumber?.Trim();
            asset.WarrantyNotes = request.WarrantyNotes?.Trim();
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
            var changes = new List<string>();
            asset.Location = request.Location?.Trim() ?? asset.Location;
            if (!asset.AssignedEmployeeId.HasValue) asset.Department = request.Department?.Trim() ?? asset.Department;
            if (request.PurchaseDate.HasValue)
            {
                var newDate = EnsureUtc(request.PurchaseDate.Value).Date;
                if (newDate < new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc))
                    throw new ArgumentException("Purchase date cannot be earlier than 1970.");
                if (newDate > DateTime.UtcNow.AddYears(1).Date)
                    throw new ArgumentException("Purchase date cannot be in the distant future.");

                if (newDate != asset.PurchaseDate.Date)
                {
                    if (asset.AccumulatedDepreciation > 0)
                        throw new ArgumentException("Purchase date cannot be modified after depreciation has been posted.");
                    if (await _context.Purchases.IgnoreQueryFilters().AnyAsync(p => p.AssetId == asset.Id))
                        throw new ArgumentException("Purchase date cannot be modified for assets originating from Accounts Payable purchase orders.");
                    if (asset.CurrentStatus.Equals("Disposed", StringComparison.OrdinalIgnoreCase) ||
                        asset.CurrentStatus.Equals("Retired", StringComparison.OrdinalIgnoreCase))
                        throw new ArgumentException("Disposed assets are historical records and cannot perform this operation.");

                    var oldDateStr = asset.PurchaseDate.ToString("yyyy-MM-dd");
                    asset.PurchaseDate = DateTime.SpecifyKind(newDate, DateTimeKind.Utc);
                    changes.Add($"Purchase Date: {oldDateStr} → {asset.PurchaseDate:yyyy-MM-dd}");
                }
            }
            asset.Condition = request.Condition ?? asset.Condition;
            asset.CurrentStatus = request.CurrentStatus ?? asset.CurrentStatus;
            asset.Notes = request.Notes?.Trim() ?? asset.Notes;
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            if (oldStatus != asset.CurrentStatus) changes.Add($"Status: {oldStatus} → {asset.CurrentStatus}");
            if (oldCondition != asset.Condition) changes.Add($"Condition: {oldCondition} → {asset.Condition}");
            if (oldLocation != asset.Location) changes.Add($"Location: {oldLocation} → {asset.Location}");

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = DateTime.UtcNow,
                Action = "Asset Updated",
                PerformedBy = GetCurrentUserId(),
                PreviousValue = before,
                NewValue = System.Text.Json.JsonSerializer.Serialize(MapToDetailedDto(asset)),
                Remarks = changes.Count > 0 ? string.Join("; ", changes) : "Updated asset specifications."
            });

            await ((DbContext)_context).SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> AssignAssetAsync(Guid id, AssignAssetRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);

            if (asset == null) return null;
            CheckVersion(asset, request);
            RequireOperational(asset);

            if (request.AssignmentDate.Date < asset.PurchaseDate.Date || request.AssignmentDate.Date > DateTime.UtcNow.Date) throw new ArgumentException("Assignment date must be between purchase date and today.");
            var oldEmployee = $"{asset.AssignedEmployeeId}: {asset.AssignedEmployeeName ?? "Unassigned"}";
            var employee = await RequireEmployeeAsync(request.EmployeeId);
            var newEmployee = $"{employee.FirstName} {employee.LastName}".Trim();

            asset.AssignedEmployeeId = request.EmployeeId;
            asset.AssignedEmployeeName = newEmployee;
            asset.Department = employee.Department;
            asset.AssignedDate = EnsureUtc(request.AssignmentDate);
            asset.CurrentStatus = "InUse";
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = EnsureUtc(request.AssignmentDate),
                Action = "Asset Assigned",
                PerformedBy = GetCurrentUserId(),
                PreviousValue = oldEmployee,
                NewValue = $"{employee.Id}: {newEmployee}",
                Remarks = $"Assigned to {newEmployee} ({asset.Department ?? "General"}). {request.Notes}".Trim()
            });

            await ((DbContext)_context).SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> TransferAssetAsync(Guid id, TransferAssetRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);

            if (asset == null) return null;
            CheckVersion(asset, request);
            RequireOperational(asset);

            if (string.IsNullOrWhiteSpace(request.ToLocation) || string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Destination and transfer reason are required.");
            var oldLocation = asset.Location ?? "Main Site";
            var newLocation = request.ToLocation.Trim();

            asset.Location = newLocation;
            if (!string.IsNullOrWhiteSpace(request.ToEmployee))
            {
                throw new ArgumentException("Use Assign to select a database employee when changing the assignee.");
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
            if (transaction != null) await transaction.CommitAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<AssetMaintenanceRecordDto?> RecordMaintenanceAsync(Guid id, RecordMaintenanceRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);

            if (asset == null) return null;
            CheckVersion(asset, request);
            RequireOperational(asset);

            var companyId = await GetCompanyIdAsync();
            if (request.PartsCost < 0 || request.LabourCost < 0 || request.OtherCost < 0 || string.IsNullOrWhiteSpace(request.ServiceProvider) || string.IsNullOrWhiteSpace(request.Description)) throw new ArgumentException("Provide a service provider, description and non-negative maintenance costs.");
            var totalCost = request.PartsCost + request.LabourCost + request.OtherCost;

            var record = new AssetMaintenanceRecord
            {
                TenantId = tenantId,
                CompanyId = companyId,
                AssetId = asset.Id,
                MaintenanceType = request.MaintenanceType,
                MaintenanceDate = EnsureUtc(request.MaintenanceDate),
                ServiceProvider = request.ServiceProvider.Trim(),
                Description = request.Description.Trim(),
                PartsCost = request.PartsCost,
                LabourCost = request.LabourCost,
                OtherCost = request.OtherCost,
                TotalCost = totalCost,
                NextMaintenanceDate = EnsureUtc(request.NextMaintenanceDate),
                IsWarrantyClaim = request.IsWarrantyClaim,
                TechnicianName = request.TechnicianName?.Trim(),
                Notes = request.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = GetCurrentUserId()
            };

            _context.AssetMaintenanceRecords.Add(record);

            // Update asset maintenance metrics
            asset.LastMaintenanceDate = EnsureUtc(request.MaintenanceDate);
            asset.NextMaintenanceDate = EnsureUtc(request.NextMaintenanceDate);
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
            if (transaction != null) await transaction.CommitAsync();

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
            await EnsureAssetSchemaAsync();
            var tenantId = GetTenantId();
            var records = await _context.AssetMaintenanceRecords
                .Where(m => m.AssetId == id && m.TenantId == tenantId)
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

        public async Task<DetailedAssetDto?> CalculateDepreciationAsync(Guid id, DepreciateAssetRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var asset = await _context.Assets.FirstOrDefaultAsync(a => a.Id == id && a.TenantId == GetTenantId() && !a.IsDeleted);
            if (asset == null) return null;
            CheckVersion(asset, request);
            RequireOperational(asset);
            if (request.Percentage <= 0 || request.Percentage > 100 || decimal.Round(request.Percentage, 4) != request.Percentage)
                throw new ArgumentException("Depreciation percentage must be greater than 0 and at most 100, with up to four decimal places.");
            var date = EnsureUtc(request.EffectiveDate);
            if (date == default || date.Date < asset.PurchaseDate.Date || date.Date > DateTime.UtcNow.Date)
                throw new ArgumentException("Effective date must be between purchase date and today.");
            if (await _context.AssetHistories.AnyAsync(h => h.AssetId == id && h.Action == "Depreciation Applied" && h.Date > date))
                throw new ArgumentException("Effective date cannot precede the last depreciation event.");
            var previous = asset.CurrentValue;
            var amount = decimal.Round(previous * request.Percentage / 100m, 2, MidpointRounding.AwayFromZero);
            if (amount <= 0 || previous - amount < asset.ResidualValue)
                throw new ArgumentException("Depreciation must be positive and cannot reduce book value below residual value.");
            asset.CurrentValue = previous - amount;
            asset.AccumulatedDepreciation += amount;
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();
            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = id, Date = date, Action = "Depreciation Applied", PerformedBy = GetCurrentUserId(),
                PreviousValue = previous.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                NewValue = asset.CurrentValue.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                Remarks = System.Text.Json.JsonSerializer.Serialize(new { PreviousBookValue = previous, request.Percentage,
                    DepreciationAmount = amount, NewBookValue = asset.CurrentValue, EffectiveDate = date, request.Notes,
                    CreatedBy = GetCurrentUserId(), CreatedAt = DateTime.UtcNow })
            });
            await ((DbContext)_context).SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<DetailedAssetDto?> DisposeAssetAsync(Guid id, DisposeAssetRequest request)
        {
            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
            var asset = await _context.Assets
                .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);

            if (asset == null) return null;
            CheckVersion(asset, request);
            RequireOperational(asset);

            if (asset.CurrentStatus == "Disposed")
                throw new InvalidOperationException("Asset has already been disposed.");

            if (string.IsNullOrWhiteSpace(request.Reason) || request.SaleValue < 0 || request.DisposalCost < 0 ||
                !new[] { "Sold", "Scrapped", "WrittenOff", "Donated", "Lost", "Other" }.Contains(request.DisposalMethod))
                throw new ArgumentException("Provide a disposal reason, valid method and non-negative amounts.");
            if (request.DisposalDate.Date < asset.PurchaseDate.Date || request.DisposalDate.Date > DateTime.UtcNow.Date)
                throw new ArgumentException("Disposal date must be between purchase date and today.");
            asset.CurrentStatus = "Disposed";
            asset.DisposalDate = EnsureUtc(request.DisposalDate);
            asset.DisposalMethod = request.DisposalMethod;
            asset.DisposalReason = request.Reason.Trim();
            asset.SaleValue = request.SaleValue;
            asset.DisposalCost = request.DisposalCost;
            asset.BuyerParty = request.BuyerParty?.Trim();
            asset.DisposalRefNo = request.ReferenceNumber?.Trim();
            asset.DisposedBy = GetCurrentUserId();
            asset.UpdatedAt = DateTime.UtcNow;
            asset.UpdatedBy = GetCurrentUserId();

            _context.AssetHistories.Add(new AssetHistory
            {
                AssetId = asset.Id,
                Date = EnsureUtc(request.DisposalDate),
                Action = "Asset Disposed",
                PerformedBy = GetCurrentUserId(),
                NewValue = $"Disposed via {request.DisposalMethod}",
                PreviousValue = $"Book value: {asset.CurrentValue:F2}; accumulated depreciation: {asset.AccumulatedDepreciation:F2}",
                Remarks = $"Sale Value: ₹{request.SaleValue:N2}, Disposal Cost: ₹{request.DisposalCost:N2}. Reason: {request.Reason}. Notes: {request.Notes}"
            });

            await ((DbContext)_context).SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();
            return MapToDetailedDto(asset);
        }

        public async Task<List<AssetHistoryDto>> GetAssetHistoryAsync(Guid id)
        {
            await EnsureAssetSchemaAsync();
            if (!await _context.Assets.AnyAsync(a => a.Id == id && a.TenantId == GetTenantId() && !a.IsDeleted)) return new();
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

            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
            var assets = await _context.Assets
                .Where(a => request.AssetIds.Contains(a.Id) && a.TenantId == tenantId && !a.IsDeleted)
                .ToListAsync();

            if (!new[] { "Active", "Available", "UnderMaintenance", "Damaged", "Lost", "UnderTransfer", "Idle" }.Contains(request.Status)) throw new ArgumentException("Use the disposal workflow for disposal or retirement.");
            foreach (var asset in assets)
            {
                RequireOperational(asset);
                CheckVersion(asset, new AssetMutationRequest { ExpectedVersion = request.ExpectedVersions.GetValueOrDefault(asset.Id) ?? string.Empty });
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
            if (transaction != null) await transaction.CommitAsync();
            return true;
        }

        public async Task<AssetImportResult> ImportAssetsAsync(List<AssetImportRow> rows)
        {
            var result = new AssetImportResult
            {
                TotalRows = rows.Count
            };

            if (rows.Count == 0) return result;

            await EnsureAssetSchemaAsync();
            await using var transaction = await BeginAssetTransactionAsync();
            var tenantId = GetTenantId();
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

                var importStatus = string.IsNullOrWhiteSpace(row.Status) ? "Active" : row.Status.Trim();
                if (!new[] { "Active", "Available", "UnderMaintenance", "Damaged", "Lost", "UnderTransfer", "Idle" }.Contains(importStatus))
                {
                    result.RowErrors.Add($"Row {rowNum}: Use the assignment or disposal workflow to create lifecycle history for this status.");
                    continue;
                }
                var assetCode = await GenerateAssetCodeAsync();
                var tag = !string.IsNullOrWhiteSpace(row.AssetTag) ? row.AssetTag.Trim().ToUpper() : $"TAG-{assetCode}";

                var tagExists = await _context.Assets.AnyAsync(a =>
                    a.TenantId == tenantId &&
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
                    TenantId = tenantId,
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
                    CurrentStatus = importStatus,
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
            if (transaction != null) await transaction.CommitAsync();
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
                Version = VersionOf(a),
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
