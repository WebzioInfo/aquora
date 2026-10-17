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
            var batch = await _tenantContext.ProductionBatches
                .FirstOrDefaultAsync(b => b.Id == sessionId && !b.IsDeleted);

            var sessionIds = new List<Guid> { sessionId };
            if (batch != null)
            {
                var linkedSessionIds = await _tenantContext.ProductionSessions
                    .Where(s => (s.Id == sessionId || (s.BatchNumber == batch.BatchNumber && s.ProductionLineId == batch.ProductionLineId)) && !s.IsDeleted)
                    .Select(s => s.Id)
                    .ToListAsync();
                sessionIds.AddRange(linkedSessionIds);
            }

            var query = _tenantContext.ProductionEntries
                .Include(e => e.Product)
                .Include(e => e.PreformMaterial)
                .Include(e => e.CapMaterial)
                .Include(e => e.LabelMaterial)
                .Include(e => e.ShrinkMaterial)
                .Include(e => e.GlueMaterial)
                .Where(e => !e.IsDeleted && (
                    (e.ProductionSessionId.HasValue && sessionIds.Contains(e.ProductionSessionId.Value)) ||
                    (batch != null && e.ProductionSession != null && e.ProductionSession.BatchNumber == batch.BatchNumber)
                ));

            var entries = await query
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            var productNames = await _tenantContext.Products
                .IgnoreQueryFilters()
                .ToDictionaryAsync(p => p.Id, p => p.Name);

            var rawMaterialMap = await _tenantContext.RawMaterials
                .IgnoreQueryFilters()
                .ToDictionaryAsync(m => m.Id, m => (Name: m.Name, Unit: m.Unit));

            var result = entries.Select(e =>
            {
                string skuName = e.Product?.Name
                    ?? (productNames.TryGetValue(e.ProductId, out var pn) ? pn : null)
                    ?? batch?.Product
                    ?? "Product";

                var preformInfo = e.PreformMaterialId.HasValue && rawMaterialMap.TryGetValue(e.PreformMaterialId.Value, out var pInfo) ? pInfo : default;
                var capInfo = e.CapMaterialId.HasValue && rawMaterialMap.TryGetValue(e.CapMaterialId.Value, out var cInfo) ? cInfo : default;
                var labelInfo = e.LabelMaterialId.HasValue && rawMaterialMap.TryGetValue(e.LabelMaterialId.Value, out var lInfo) ? lInfo : default;
                var shrinkInfo = e.ShrinkMaterialId.HasValue && rawMaterialMap.TryGetValue(e.ShrinkMaterialId.Value, out var sInfo) ? sInfo : default;
                var glueInfo = e.GlueMaterialId.HasValue && rawMaterialMap.TryGetValue(e.GlueMaterialId.Value, out var gInfo) ? gInfo : default;

                var materials = new List<object>();
                if (!string.IsNullOrEmpty(e.MaterialConsumptionsJson))
                {
                    try
                    {
                        materials = System.Text.Json.JsonSerializer.Deserialize<List<object>>(e.MaterialConsumptionsJson) ?? new List<object>();
                    }
                    catch { }
                }

                if (materials.Count == 0)
                {
                    if (e.PreformMaterialId.HasValue || e.PreformUsage > 0 || e.PreformWastage > 0)
                    {
                        materials.Add(new
                        {
                            rawMaterialId = e.PreformMaterialId,
                            rawMaterialName = e.PreformMaterial?.Name ?? preformInfo.Name ?? "Preform",
                            category = "PREFORM",
                            unit = e.PreformMaterial?.Unit ?? preformInfo.Unit ?? "Bags",
                            usageQuantity = e.PreformUsage,
                            wastageQuantity = e.PreformWastage,
                            totalQuantity = e.PreformUsage + e.PreformWastage
                        });
                    }
                    if (e.CapMaterialId.HasValue || e.CapUsage > 0 || e.CapWastage > 0)
                    {
                        materials.Add(new
                        {
                            rawMaterialId = e.CapMaterialId,
                            rawMaterialName = e.CapMaterial?.Name ?? capInfo.Name ?? "Cap",
                            category = "CAP",
                            unit = e.CapMaterial?.Unit ?? capInfo.Unit ?? "Boxes",
                            usageQuantity = e.CapUsage,
                            wastageQuantity = e.CapWastage,
                            totalQuantity = e.CapUsage + e.CapWastage
                        });
                    }
                    if (e.LabelMaterialId.HasValue || e.LabelUsage > 0 || e.LabelWastage > 0)
                    {
                        materials.Add(new
                        {
                            rawMaterialId = e.LabelMaterialId,
                            rawMaterialName = e.LabelMaterial?.Name ?? labelInfo.Name ?? "Label",
                            category = "LABEL",
                            unit = e.LabelMaterial?.Unit ?? labelInfo.Unit ?? "KG",
                            usageQuantity = e.LabelUsage,
                            wastageQuantity = e.LabelWastage,
                            totalQuantity = e.LabelUsage + e.LabelWastage
                        });
                    }
                    if (e.ShrinkMaterialId.HasValue || e.ShrinkUsage > 0 || e.ShrinkWastage > 0)
                    {
                        materials.Add(new
                        {
                            rawMaterialId = e.ShrinkMaterialId,
                            rawMaterialName = e.ShrinkMaterial?.Name ?? shrinkInfo.Name ?? "Shrink Film",
                            category = "SHRINK",
                            unit = e.ShrinkMaterial?.Unit ?? shrinkInfo.Unit ?? "KG",
                            usageQuantity = e.ShrinkUsage,
                            wastageQuantity = e.ShrinkWastage,
                            totalQuantity = e.ShrinkUsage + e.ShrinkWastage
                        });
                    }
                    if (e.GlueMaterialId.HasValue || (e.GlueUsage.HasValue && e.GlueUsage > 0))
                    {
                        materials.Add(new
                        {
                            rawMaterialId = e.GlueMaterialId,
                            rawMaterialName = e.GlueMaterial?.Name ?? glueInfo.Name ?? "Glue",
                            category = "GLUE",
                            unit = e.GlueMaterial?.Unit ?? glueInfo.Unit ?? "KG",
                            usageQuantity = e.GlueUsage.GetValueOrDefault(),
                            wastageQuantity = 0m,
                            totalQuantity = e.GlueUsage.GetValueOrDefault()
                        });
                    }
                }

                return new
                {
                    e.Id,
                    e.OperatorName,
                    e.Shift,
                    SkuName = skuName,
                    CaseConfigurationName = "N/A",
                    e.CasesProduced,
                    Materials = materials,
                    PreformName = e.PreformMaterial?.Name ?? preformInfo.Name ?? "Preform",
                    e.PreformUsage,
                    e.PreformWastage,
                    PreformUnit = e.PreformMaterial?.Unit ?? preformInfo.Unit ?? "PCS",
                    CapName = e.CapMaterial?.Name ?? capInfo.Name ?? "Cap",
                    e.CapUsage,
                    e.CapWastage,
                    CapUnit = e.CapMaterial?.Unit ?? capInfo.Unit ?? "BOX",
                    LabelName = e.LabelMaterial?.Name ?? labelInfo.Name ?? "Label",
                    e.LabelUsage,
                    e.LabelWastage,
                    LabelUnit = e.LabelMaterial?.Unit ?? labelInfo.Unit ?? "PCS",
                    ShrinkName = e.ShrinkMaterial?.Name ?? shrinkInfo.Name ?? "Shrink Film",
                    e.ShrinkUsage,
                    e.ShrinkWastage,
                    ShrinkUnit = e.ShrinkMaterial?.Unit ?? shrinkInfo.Unit ?? "KG",
                    GlueName = e.GlueMaterial?.Name ?? glueInfo.Name ?? "Glue",
                    e.GlueUsage,
                    GlueUnit = e.GlueMaterial?.Unit ?? glueInfo.Unit ?? "KG",
                    e.InkUsed,
                    e.MakeupUsed,
                    WaterWastageLitres = e.WaterWastageLitres,
                    e.CreatedAt
                };
            }).Cast<object>().ToList();

            return result;
        }
    }
}
