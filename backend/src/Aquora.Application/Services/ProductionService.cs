using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Application.Services
{
    public class ProductionService : IProductionService
    {
        private readonly ITenantDbContext _tenantContext;

        public ProductionService(ITenantDbContext tenantContext)
        {
            _tenantContext = tenantContext;
        }

        public async Task<List<object>> GetTodayEntriesAsync(Guid lineId, string? shift)
        {
            var todayUtc = DateTime.UtcNow.Date;
            var query = _tenantContext.ProductionEntries
                .Include(e => e.Product)
                .Include(e => e.PreformMaterial)
                .Include(e => e.CapMaterial)
                .Include(e => e.LabelMaterial)
                .Include(e => e.ShrinkMaterial)
                .Include(e => e.GlueMaterial)
                .Where(e => e.ProductionLineId == lineId && e.Date == todayUtc); // IsDeleted handled by global query filter

            if (!string.IsNullOrEmpty(shift))
            {
                query = query.Where(e => e.Shift == shift);
            }

            var entries = await query
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            var result = entries.Select(e => new
            {
                e.Id,
                e.OperatorName,
                e.Shift,
                SkuName = e.Product?.Name ?? "Unknown Product",
                CaseConfigurationName = "N/A",
                e.CasesProduced,
                PreformName = e.PreformMaterial?.Name ?? "Unknown Preform",
                e.PreformUsage,
                e.PreformWastage,
                PreformUnit = e.PreformMaterial?.Unit ?? "PCS",
                CapName = e.CapMaterial?.Name,
                e.CapUsage,
                e.CapWastage,
                CapUnit = e.CapMaterial?.Unit ?? "BOX",
                LabelName = e.LabelMaterial?.Name ?? "Unknown Label",
                e.LabelUsage,
                e.LabelWastage,
                LabelUnit = e.LabelMaterial?.Unit ?? "PCS",
                ShrinkName = e.ShrinkMaterial?.Name ?? "Unknown Shrink",
                e.ShrinkUsage,
                e.ShrinkWastage,
                ShrinkUnit = e.ShrinkMaterial?.Unit ?? "KG",
                GlueName = e.GlueMaterial?.Name,
                e.GlueUsage,
                GlueUnit = e.GlueMaterial?.Unit ?? "KG",
                e.InkUsed,
                e.MakeupUsed,
                e.CreatedAt
            }).Cast<object>().ToList();

            return result;
        }

        public async Task<List<object>> GetSessionEntriesAsync(Guid sessionId)
        {
            var query = _tenantContext.ProductionEntries
                .Include(e => e.Product)
                .Include(e => e.PreformMaterial)
                .Include(e => e.CapMaterial)
                .Include(e => e.LabelMaterial)
                .Include(e => e.ShrinkMaterial)
                .Include(e => e.GlueMaterial)
                .Where(e => e.ProductionSessionId == sessionId);

            var entries = await query
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            var result = entries.Select(e => new
            {
                e.Id,
                e.OperatorName,
                e.Shift,
                SkuName = e.Product?.Name ?? "Unknown Product",
                CaseConfigurationName = "N/A",
                e.CasesProduced,
                PreformName = e.PreformMaterial?.Name ?? "Unknown Preform",
                e.PreformUsage,
                e.PreformWastage,
                PreformUnit = e.PreformMaterial?.Unit ?? "PCS",
                CapName = e.CapMaterial?.Name,
                e.CapUsage,
                e.CapWastage,
                CapUnit = e.CapMaterial?.Unit ?? "BOX",
                LabelName = e.LabelMaterial?.Name ?? "Unknown Label",
                e.LabelUsage,
                e.LabelWastage,
                LabelUnit = e.LabelMaterial?.Unit ?? "PCS",
                ShrinkName = e.ShrinkMaterial?.Name ?? "Unknown Shrink",
                e.ShrinkUsage,
                e.ShrinkWastage,
                ShrinkUnit = e.ShrinkMaterial?.Unit ?? "KG",
                GlueName = e.GlueMaterial?.Name,
                e.GlueUsage,
                GlueUnit = e.GlueMaterial?.Unit ?? "KG",
                e.InkUsed,
                e.MakeupUsed,
                e.CreatedAt
            }).Cast<object>().ToList();

            return result;
        }
    }
}
