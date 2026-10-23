using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;
using Aquora.Application.Services;
using Aquora.Domain.Entities;

namespace Aquora.Tests
{
    public class DynamicRawMaterialUnitsTests
    {
        [Fact]
        public void MapProductionEntryToDto_WithSnapshotUnits_PreservesHistoricalUnitWhenMaterialConfigChanges()
        {
            // Arrange
            var preformId = Guid.NewGuid();
            var capId = Guid.NewGuid();

            // Material config in inventory was later changed to "GM" and "PCS"
            var rawMaterialMap = new Dictionary<Guid, (string Name, string Unit, string Category)>
            {
                { preformId, ("Custom Preform 500ml", "GM", "PREFORM") },
                { capId, ("Sports Cap 28mm", "PCS", "CAP") }
            };

            // Historical entry recorded when units were "KG" and "BOX"
            var snapshotList = new List<object>
            {
                new { rawMaterialId = preformId, rawMaterialName = "Custom Preform 500ml", category = "PREFORM", unit = "KG", usageQuantity = 50.5m, wastageQuantity = 1.2m },
                new { rawMaterialId = capId, rawMaterialName = "Sports Cap 28mm", category = "CAP", unit = "BOX", usageQuantity = 10m, wastageQuantity = 0.5m }
            };

            var entry = new ProductionEntry
            {
                Id = Guid.NewGuid(),
                OperatorName = "Test Operator",
                Shift = "Morning",
                Date = DateTime.UtcNow.Date,
                Time = DateTime.UtcNow.ToString("O"),
                CasesProduced = 100,
                PreformMaterialId = preformId,
                PreformUsage = 50.5m,
                PreformWastage = 1.2m,
                CapMaterialId = capId,
                CapUsage = 10m,
                CapWastage = 0.5m,
                MaterialConsumptionsJson = JsonSerializer.Serialize(snapshotList),
                CreatedAt = DateTime.UtcNow.AddDays(-30)
            };

            // Act
            var dto = ProductionService.MapProductionEntryToDto(entry, "Test SKU", rawMaterialMap);
            var json = JsonSerializer.Serialize(dto);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Assert: Snapshot units ("KG" and "BOX") are preserved, not rewritten by subsequent material config changes
            Assert.Equal("KG", root.GetProperty("PreformUnit").GetString());
            Assert.Equal("BOX", root.GetProperty("CapUnit").GetString());
            Assert.Equal(50.5m, root.GetProperty("PreformUsage").GetDecimal());
            Assert.Equal(1.2m, root.GetProperty("PreformWastage").GetDecimal());
            Assert.Equal(10m, root.GetProperty("CapUsage").GetDecimal());
            Assert.Equal(0.5m, root.GetProperty("CapWastage").GetDecimal());
        }

        [Fact]
        public void MapProductionEntryToDto_LegacyEntryWithoutSnapshot_FallsBackToConfiguredMaterialUnit()
        {
            // Arrange
            var preformId = Guid.NewGuid();
            var capId = Guid.NewGuid();
            var shrinkId = Guid.NewGuid();

            var rawMaterialMap = new Dictionary<Guid, (string Name, string Unit, string Category)>
            {
                { preformId, ("Preform 200ml", "BAG", "PREFORM") },
                { capId, ("Flat Cap 30mm", "CARTON", "CAP") },
                { shrinkId, ("Shrink Roll 50 Micron", "ROLL", "SHRINK") }
            };

            // Legacy entry with null MaterialConsumptionsJson
            var entry = new ProductionEntry
            {
                Id = Guid.NewGuid(),
                OperatorName = "Legacy Operator",
                Shift = "Night",
                Date = DateTime.UtcNow.Date,
                Time = DateTime.UtcNow.ToString("O"),
                CasesProduced = 250,
                PreformMaterialId = preformId,
                PreformUsage = 20m,
                PreformWastage = 5m,
                CapMaterialId = capId,
                CapUsage = 40m,
                CapWastage = 2m,
                ShrinkMaterialId = shrinkId,
                ShrinkUsage = 15m,
                ShrinkWastage = 0.5m,
                MaterialConsumptionsJson = null,
                CreatedAt = DateTime.UtcNow.AddDays(-60)
            };

            // Act
            var dto = ProductionService.MapProductionEntryToDto(entry, "Legacy SKU", rawMaterialMap);
            var json = JsonSerializer.Serialize(dto);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Assert: Configured unit is used as fallback instead of hardcoded strings
            Assert.Equal("BAG", root.GetProperty("PreformUnit").GetString());
            Assert.Equal("CARTON", root.GetProperty("CapUnit").GetString());
            Assert.Equal("ROLL", root.GetProperty("ShrinkUnit").GetString());
        }

        [Fact]
        public void MapProductionEntryToDto_DynamicUnits_SupportsCustomMaterialUnitsAndBottle()
        {
            // Arrange
            var bottleId = Guid.NewGuid();
            var glueId = Guid.NewGuid();

            var rawMaterialMap = new Dictionary<Guid, (string Name, string Unit, string Category)>
            {
                { bottleId, ("Pre-blown Bottle 1L", "CRATE", "BOTTLE") },
                { glueId, ("Hot Melt Adhesive", "LITRE", "GLUE") }
            };

            var snapshotList = new List<object>
            {
                new { rawMaterialId = bottleId, rawMaterialName = "Pre-blown Bottle 1L", category = "BOTTLE", unit = "CRATE", usageQuantity = 200m, wastageQuantity = 10m },
                new { rawMaterialId = glueId, rawMaterialName = "Hot Melt Adhesive", category = "GLUE", unit = "LITRE", usageQuantity = 2.5m, wastageQuantity = 0m }
            };

            var entry = new ProductionEntry
            {
                Id = Guid.NewGuid(),
                OperatorName = "Operator A",
                Shift = "General",
                Date = DateTime.UtcNow.Date,
                Time = DateTime.UtcNow.ToString("O"),
                CasesProduced = 100,
                GlueMaterialId = glueId,
                GlueUsage = 2.5m,
                MaterialConsumptionsJson = JsonSerializer.Serialize(snapshotList),
                CreatedAt = DateTime.UtcNow
            };

            // Act
            var dto = ProductionService.MapProductionEntryToDto(entry, "Dynamic SKU", rawMaterialMap);
            var json = JsonSerializer.Serialize(dto);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Assert: Bottle and custom glue units are properly extracted from snapshot
            Assert.Equal("CRATE", root.GetProperty("BottleUnit").GetString());
            Assert.Equal(200m, root.GetProperty("BottleUsage").GetDecimal());
            Assert.Equal(10m, root.GetProperty("BottleWastage").GetDecimal());
            Assert.Equal("Pre-blown Bottle 1L", root.GetProperty("BottleName").GetString());

            Assert.Equal("LITRE", root.GetProperty("GlueUnit").GetString());
            Assert.Equal(2.5m, root.GetProperty("GlueUsage").GetDecimal());
        }
    }
}
