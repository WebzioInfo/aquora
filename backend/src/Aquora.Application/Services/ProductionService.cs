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

            var rawMaterialMap = await _tenantContext.RawMaterials
                .IgnoreQueryFilters()
                .ToDictionaryAsync(m => m.Id, m => (Name: m.Name, Unit: m.Unit, Category: m.Category));

            var result = entries.Select(e =>
            {
                var skuName = e.Product?.Name ?? "Product";
                return MapProductionEntryToDto(e, skuName, rawMaterialMap);
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
                .ToDictionaryAsync(m => m.Id, m => (Name: m.Name, Unit: m.Unit, Category: m.Category));

            var result = entries.Select(e =>
            {
                string skuName = e.Product?.Name
                    ?? (productNames.TryGetValue(e.ProductId, out var pn) ? pn : null)
                    ?? batch?.Product
                    ?? "Product";

                return MapProductionEntryToDto(e, skuName, rawMaterialMap);
            }).Cast<object>().ToList();

            return result;
        }

        public static object MapProductionEntryToDto(
            Domain.Entities.ProductionEntry e,
            string skuName,
            Dictionary<Guid, (string Name, string Unit, string Category)> rawMaterialMap)
        {
            var preformInfo = e.PreformMaterialId.HasValue && rawMaterialMap.TryGetValue(e.PreformMaterialId.Value, out var pInfo) ? pInfo : default;
            var capInfo = e.CapMaterialId.HasValue && rawMaterialMap.TryGetValue(e.CapMaterialId.Value, out var cInfo) ? cInfo : default;
            var labelInfo = e.LabelMaterialId.HasValue && rawMaterialMap.TryGetValue(e.LabelMaterialId.Value, out var lInfo) ? lInfo : default;
            var shrinkInfo = e.ShrinkMaterialId.HasValue && rawMaterialMap.TryGetValue(e.ShrinkMaterialId.Value, out var sInfo) ? sInfo : default;
            var glueInfo = e.GlueMaterialId.HasValue && rawMaterialMap.TryGetValue(e.GlueMaterialId.Value, out var gInfo) ? gInfo : default;

            var materials = new List<object>();
            var parsedSnapshots = new List<(Guid? rawMaterialId, string? name, string? category, string? unit, decimal usage, decimal waste)>();

            if (!string.IsNullOrEmpty(e.MaterialConsumptionsJson))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(e.MaterialConsumptionsJson);
                    if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                        {
                            Guid? matId = null;
                            if (el.TryGetProperty("rawMaterialId", out var idProp))
                            {
                                if (idProp.ValueKind == System.Text.Json.JsonValueKind.String && Guid.TryParse(idProp.GetString(), out var gid))
                                    matId = gid;
                            }

                            string name = el.TryGetProperty("materialName", out var mn) ? (mn.GetString() ?? "")
                                        : (el.TryGetProperty("rawMaterialName", out var rmn) ? (rmn.GetString() ?? "") : "");

                            string cat = el.TryGetProperty("category", out var cp) ? (cp.GetString() ?? "") : "";

                            string unit = el.TryGetProperty("unit", out var up) ? (up.GetString() ?? "") : "";

                            decimal usage = el.TryGetProperty("usageQuantity", out var uq) && uq.TryGetDecimal(out var uVal) ? uVal : 0m;
                            decimal waste = el.TryGetProperty("wastageQuantity", out var wq) && wq.TryGetDecimal(out var wVal) ? wVal : 0m;

                            // Fallback to configured material unit if snapshot unit is missing/empty
                            if (string.IsNullOrWhiteSpace(unit) && matId.HasValue && rawMaterialMap.TryGetValue(matId.Value, out var rmLookup))
                            {
                                unit = rmLookup.Unit ?? "";
                            }
                            if (string.IsNullOrWhiteSpace(name) && matId.HasValue && rawMaterialMap.TryGetValue(matId.Value, out var rmLookup2))
                            {
                                name = rmLookup2.Name ?? "";
                            }

                            parsedSnapshots.Add((matId, name, cat, unit, usage, waste));

                            materials.Add(new
                            {
                                rawMaterialId = matId,
                                rawMaterialName = name,
                                materialName = name,
                                category = cat,
                                unit = unit,
                                usageQuantity = usage,
                                wastageQuantity = waste,
                                totalQuantity = usage + waste
                            });
                        }
                    }
                }
                catch { }
            }

            if (materials.Count == 0)
            {
                if (e.PreformMaterialId.HasValue || e.PreformUsage > 0 || e.PreformWastage > 0)
                {
                    var unit = e.PreformMaterial?.Unit ?? preformInfo.Unit ?? "";
                    var name = e.PreformMaterial?.Name ?? preformInfo.Name ?? "Preform";
                    materials.Add(new
                    {
                        rawMaterialId = e.PreformMaterialId,
                        rawMaterialName = name,
                        materialName = name,
                        category = "PREFORM",
                        unit = unit,
                        usageQuantity = e.PreformUsage,
                        wastageQuantity = e.PreformWastage,
                        totalQuantity = e.PreformUsage + e.PreformWastage
                    });
                    parsedSnapshots.Add((e.PreformMaterialId, name, "PREFORM", unit, e.PreformUsage, e.PreformWastage));
                }
                if (e.CapMaterialId.HasValue || e.CapUsage > 0 || e.CapWastage > 0)
                {
                    var unit = e.CapMaterial?.Unit ?? capInfo.Unit ?? "";
                    var name = e.CapMaterial?.Name ?? capInfo.Name ?? "Cap";
                    materials.Add(new
                    {
                        rawMaterialId = e.CapMaterialId,
                        rawMaterialName = name,
                        materialName = name,
                        category = "CAP",
                        unit = unit,
                        usageQuantity = e.CapUsage,
                        wastageQuantity = e.CapWastage,
                        totalQuantity = e.CapUsage + e.CapWastage
                    });
                    parsedSnapshots.Add((e.CapMaterialId, name, "CAP", unit, e.CapUsage, e.CapWastage));
                }
                if (e.LabelMaterialId.HasValue || e.LabelUsage > 0 || e.LabelWastage > 0)
                {
                    var unit = e.LabelMaterial?.Unit ?? labelInfo.Unit ?? "";
                    var name = e.LabelMaterial?.Name ?? labelInfo.Name ?? "Label";
                    materials.Add(new
                    {
                        rawMaterialId = e.LabelMaterialId,
                        rawMaterialName = name,
                        materialName = name,
                        category = "LABEL",
                        unit = unit,
                        usageQuantity = e.LabelUsage,
                        wastageQuantity = e.LabelWastage,
                        totalQuantity = e.LabelUsage + e.LabelWastage
                    });
                    parsedSnapshots.Add((e.LabelMaterialId, name, "LABEL", unit, e.LabelUsage, e.LabelWastage));
                }
                if (e.ShrinkMaterialId.HasValue || e.ShrinkUsage > 0 || e.ShrinkWastage > 0)
                {
                    var unit = e.ShrinkMaterial?.Unit ?? shrinkInfo.Unit ?? "";
                    var name = e.ShrinkMaterial?.Name ?? shrinkInfo.Name ?? "Shrink Film";
                    materials.Add(new
                    {
                        rawMaterialId = e.ShrinkMaterialId,
                        rawMaterialName = name,
                        materialName = name,
                        category = "SHRINK",
                        unit = unit,
                        usageQuantity = e.ShrinkUsage,
                        wastageQuantity = e.ShrinkWastage,
                        totalQuantity = e.ShrinkUsage + e.ShrinkWastage
                    });
                    parsedSnapshots.Add((e.ShrinkMaterialId, name, "SHRINK", unit, e.ShrinkUsage, e.ShrinkWastage));
                }
                if (e.GlueMaterialId.HasValue || (e.GlueUsage.HasValue && e.GlueUsage > 0))
                {
                    var unit = e.GlueMaterial?.Unit ?? glueInfo.Unit ?? "";
                    var name = e.GlueMaterial?.Name ?? glueInfo.Name ?? "Glue";
                    var glueUsage = e.GlueUsage.GetValueOrDefault();
                    materials.Add(new
                    {
                        rawMaterialId = e.GlueMaterialId,
                        rawMaterialName = name,
                        materialName = name,
                        category = "GLUE",
                        unit = unit,
                        usageQuantity = glueUsage,
                        wastageQuantity = 0m,
                        totalQuantity = glueUsage
                    });
                    parsedSnapshots.Add((e.GlueMaterialId, name, "GLUE", unit, glueUsage, 0m));
                }
            }

            // Prefer snapshot unit if recorded with entry; fallback to configured unit from material
            var preformSnapshot = parsedSnapshots.FirstOrDefault(m => (e.PreformMaterialId.HasValue && m.rawMaterialId == e.PreformMaterialId.Value) || (m.category != null && m.category.Equals("PREFORM", StringComparison.OrdinalIgnoreCase)));
            var capSnapshot = parsedSnapshots.FirstOrDefault(m => (e.CapMaterialId.HasValue && m.rawMaterialId == e.CapMaterialId.Value) || (m.category != null && m.category.Equals("CAP", StringComparison.OrdinalIgnoreCase)));
            var labelSnapshot = parsedSnapshots.FirstOrDefault(m => (e.LabelMaterialId.HasValue && m.rawMaterialId == e.LabelMaterialId.Value) || (m.category != null && (m.category.Equals("LABEL", StringComparison.OrdinalIgnoreCase) || m.category.Equals("BOPP", StringComparison.OrdinalIgnoreCase))));
            var shrinkSnapshot = parsedSnapshots.FirstOrDefault(m => (e.ShrinkMaterialId.HasValue && m.rawMaterialId == e.ShrinkMaterialId.Value) || (m.category != null && (m.category.Equals("SHRINK", StringComparison.OrdinalIgnoreCase) || m.category.Equals("SHRINK FILM", StringComparison.OrdinalIgnoreCase))));
            var glueSnapshot = parsedSnapshots.FirstOrDefault(m => (e.GlueMaterialId.HasValue && m.rawMaterialId == e.GlueMaterialId.Value) || (m.category != null && (m.category.Equals("GLUE", StringComparison.OrdinalIgnoreCase) || m.category.Equals("ADHESIVE", StringComparison.OrdinalIgnoreCase))));
            var bottleSnapshot = parsedSnapshots.FirstOrDefault(m => (m.category != null && m.category.Equals("BOTTLE", StringComparison.OrdinalIgnoreCase)) || (m.name != null && m.name.IndexOf("BOTTLE", StringComparison.OrdinalIgnoreCase) >= 0));

            var preformUnit = (!string.IsNullOrWhiteSpace(preformSnapshot.unit) ? preformSnapshot.unit : (e.PreformMaterial?.Unit ?? preformInfo.Unit)) ?? "";
            var capUnit = (!string.IsNullOrWhiteSpace(capSnapshot.unit) ? capSnapshot.unit : (e.CapMaterial?.Unit ?? capInfo.Unit)) ?? "";
            var labelUnit = (!string.IsNullOrWhiteSpace(labelSnapshot.unit) ? labelSnapshot.unit : (e.LabelMaterial?.Unit ?? labelInfo.Unit)) ?? "";
            var shrinkUnit = (!string.IsNullOrWhiteSpace(shrinkSnapshot.unit) ? shrinkSnapshot.unit : (e.ShrinkMaterial?.Unit ?? shrinkInfo.Unit)) ?? "";
            var glueUnit = (!string.IsNullOrWhiteSpace(glueSnapshot.unit) ? glueSnapshot.unit : (e.GlueMaterial?.Unit ?? glueInfo.Unit)) ?? "";
            var bottleUnit = bottleSnapshot.unit ?? "";

            return new
            {
                e.Id,
                e.OperatorName,
                e.Shift,
                SkuName = skuName,
                CaseConfigurationName = "N/A",
                e.CasesProduced,
                Materials = materials,
                PreformName = e.PreformMaterial?.Name ?? preformInfo.Name ?? (!string.IsNullOrEmpty(preformSnapshot.name) ? preformSnapshot.name : "Preform"),
                e.PreformUsage,
                e.PreformWastage,
                PreformUnit = preformUnit,
                CapName = e.CapMaterial?.Name ?? capInfo.Name ?? capSnapshot.name,
                e.CapUsage,
                e.CapWastage,
                CapUnit = capUnit,
                LabelName = e.LabelMaterial?.Name ?? labelInfo.Name ?? (!string.IsNullOrEmpty(labelSnapshot.name) ? labelSnapshot.name : "Label"),
                e.LabelUsage,
                e.LabelWastage,
                LabelUnit = labelUnit,
                ShrinkName = e.ShrinkMaterial?.Name ?? shrinkInfo.Name ?? (!string.IsNullOrEmpty(shrinkSnapshot.name) ? shrinkSnapshot.name : "Shrink Film"),
                e.ShrinkUsage,
                e.ShrinkWastage,
                ShrinkUnit = shrinkUnit,
                GlueName = e.GlueMaterial?.Name ?? glueInfo.Name ?? glueSnapshot.name,
                e.GlueUsage,
                GlueUnit = glueUnit,
                BottleName = bottleSnapshot.name ?? "",
                BottleUsage = bottleSnapshot.usage,
                BottleWastage = bottleSnapshot.waste,
                BottleUnit = bottleUnit,
                e.InkUsed,
                e.MakeupUsed,
                WaterWastageLitres = e.WaterWastageLitres,
                e.CreatedAt
            };
        }
    }
}

