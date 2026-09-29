using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.Application.DTOs;
using Aquora.Application.DTOs.Purchase;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public partial class AssetManagementServiceTests
    {
        private (TenantDbContext context, Mock<ITenantProvider> tenantProvider, Mock<ICurrentUserContext> userProvider, Guid tenantId, Guid companyId) CreateTestContext()
        {
            var tenantId = Guid.NewGuid();
            var companyId = Guid.NewGuid();

            var tenantProviderMock = new Mock<ITenantProvider>();
            tenantProviderMock.Setup(t => t.TenantId).Returns(tenantId);
            tenantProviderMock.Setup(t => t.TenantSchemaName).Returns("public");

            var userProviderMock = new Mock<ICurrentUserContext>();
            userProviderMock.Setup(u => u.TenantId).Returns(tenantId);
            userProviderMock.Setup(u => u.UserId).Returns("test-user-id");

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: $"AssetTestDb_{Guid.NewGuid()}")
                .Options;

            var context = new TenantDbContext(options, tenantProviderMock.Object, userProviderMock.Object);

            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Sinan Water Co",
                Code = "CMP-001",
                IsDeleted = false
            };
            context.Companies.Add(company);
            context.SaveChanges();

            return (context, tenantProviderMock, userProviderMock, tenantId, companyId);
        }

        [Fact]
        public async Task GetAssetsAsync_ShouldReturnPagedAssets_AndApplyFiltersCorrectly()
        {
            // Arrange
            var (context, tenantProvider, userProvider, tenantId, companyId) = CreateTestContext();
            var service = new AssetManagementService(context, tenantProvider.Object, userProvider.Object);

            context.Assets.AddRange(
                new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AssetCode = "AST-2026-00001",
                    AssetTag = "TAG-MCH-01",
                    AssetName = "RO Filtration Plant 1000 LPH",
                    AssetCategory = "Machinery",
                    SerialNumber = "SN-RO-9876",
                    PurchasePrice = 500000m,
                    TotalCapitalizedCost = 550000m,
                    CurrentValue = 500000m,
                    AccumulatedDepreciation = 50000m,
                    CurrentStatus = "Active",
                    Condition = "Good",
                    Location = "Main Plant",
                    Department = "Production",
                    CreatedAt = DateTime.UtcNow.AddDays(-10),
                    IsDeleted = false
                },
                new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AssetCode = "AST-2026-00002",
                    AssetTag = "TAG-VEH-01",
                    AssetName = "Tata Ace Delivery Van",
                    AssetCategory = "Vehicles",
                    SerialNumber = "KL-07-CD-1234",
                    PurchasePrice = 600000m,
                    TotalCapitalizedCost = 650000m,
                    CurrentValue = 580000m,
                    AccumulatedDepreciation = 70000m,
                    CurrentStatus = "InUse",
                    Condition = "Excellent",
                    Location = "Main Plant",
                    Department = "Logistics",
                    CreatedAt = DateTime.UtcNow.AddDays(-5),
                    IsDeleted = false
                }
            );
            await context.SaveChangesAsync();

            // Act - Base Query with "ALL" filter strings
            var result = await service.GetAssetsAsync(1, 10, null, "ALL", "ALL", "ALL", "ALL", "ALL");

            // Assert
            Assert.NotNull(result);
            Assert.Equal(2, result.TotalCount);
            Assert.Equal(2, result.Items.Count);
            Assert.Contains(result.Items, a => a.AssetTag == "TAG-MCH-01");
            Assert.Contains(result.Items, a => a.AssetTag == "TAG-VEH-01");

            // Act - Search by serial number
            var searchResult = await service.GetAssetsAsync(1, 10, "9876", "ALL", "ALL", "ALL", "ALL", "ALL");
            Assert.Equal(1, searchResult.TotalCount);
            Assert.Equal("TAG-MCH-01", searchResult.Items[0].AssetTag);

            // Act - Filter by category
            var categoryResult = await service.GetAssetsAsync(1, 10, null, "Vehicles", "ALL", "ALL", "ALL", "ALL");
            Assert.Equal(1, categoryResult.TotalCount);
            Assert.Equal("TAG-VEH-01", categoryResult.Items[0].AssetTag);
        }

        [Fact]
        public async Task GetAssetKpisAsync_ShouldComputeAccurateTotalsAndStatusCounts()
        {
            // Arrange
            var (context, tenantProvider, userProvider, tenantId, companyId) = CreateTestContext();
            var service = new AssetManagementService(context, tenantProvider.Object, userProvider.Object);

            var now = DateTime.UtcNow;

            context.Assets.AddRange(
                new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AssetCode = "AST-2026-00001",
                    AssetTag = "TAG-001",
                    AssetName = "Ozone Generator",
                    AssetCategory = "Machinery",
                    PurchasePrice = 200000m,
                    TotalCapitalizedCost = 220000m,
                    CurrentValue = 180000m,
                    AccumulatedDepreciation = 40000m,
                    CurrentStatus = "Active",
                    WarrantyEndDate = now.AddDays(15), // Expiring soon (within 30 days)
                    CreatedAt = now,
                    IsDeleted = false
                },
                new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AssetCode = "AST-2026-00002",
                    AssetTag = "TAG-002",
                    AssetName = "Forklift 2T",
                    AssetCategory = "Machinery",
                    PurchasePrice = 400000m,
                    TotalCapitalizedCost = 450000m,
                    CurrentValue = 350000m,
                    AccumulatedDepreciation = 100000m,
                    CurrentStatus = "UnderMaintenance",
                    WarrantyEndDate = now.AddDays(100),
                    CreatedAt = now,
                    IsDeleted = false
                },
                new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AssetCode = "AST-2026-00003",
                    AssetTag = "TAG-003",
                    AssetName = "Old Compressor",
                    AssetCategory = "Machinery",
                    PurchasePrice = 50000m,
                    TotalCapitalizedCost = 50000m,
                    CurrentValue = 0m,
                    AccumulatedDepreciation = 50000m,
                    CurrentStatus = "Disposed",
                    CreatedAt = now,
                    IsDeleted = false
                }
            );
            await context.SaveChangesAsync();

            // Act
            var kpis = await service.GetAssetKpisAsync();

            // Assert
            Assert.NotNull(kpis);
            Assert.Equal(3, kpis.TotalAssetsCount);
            Assert.Equal(1, kpis.ActiveAssetsCount);
            Assert.Equal(720000m, kpis.TotalAssetValue); // 220,000 + 450,000 + 50,000
            Assert.Equal(530000m, kpis.CurrentBookValue); // 180,000 + 350,000 (excluding Disposed)
            Assert.Equal(190000m, kpis.AccumulatedDepreciation); // 40,000 + 100,000 + 50,000
            Assert.Equal(1, kpis.UnderMaintenanceCount);
            Assert.Equal(1, kpis.DisposedCount);
            Assert.Equal(1, kpis.WarrantyExpiringCount);
        }

        [Fact]
        public async Task MultiTenantIsolation_ShouldNeverExposeOtherTenantAssets()
        {
            // Arrange
            var (context, tenantProvider, userProvider, tenantId, companyId) = CreateTestContext();
            var otherTenantId = Guid.NewGuid();
            var service = new AssetManagementService(context, tenantProvider.Object, userProvider.Object);

            context.Assets.AddRange(
                new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AssetCode = "AST-2026-00001",
                    AssetTag = "TAG-TENANT-A",
                    AssetName = "Company A Machine",
                    AssetCategory = "Machinery",
                    PurchasePrice = 100000m,
                    TotalCapitalizedCost = 100000m,
                    CurrentValue = 100000m,
                    CurrentStatus = "Active",
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                },
                new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = otherTenantId,
                    CompanyId = Guid.NewGuid(),
                    AssetCode = "AST-2026-00099",
                    AssetTag = "TAG-TENANT-B",
                    AssetName = "Company B Confidential Machine",
                    AssetCategory = "Machinery",
                    PurchasePrice = 900000m,
                    TotalCapitalizedCost = 900000m,
                    CurrentValue = 900000m,
                    CurrentStatus = "Active",
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                }
            );
            await context.SaveChangesAsync();

            // Act
            var result = await service.GetAssetsAsync(1, 10);
            var kpis = await service.GetAssetKpisAsync();

            // Assert
            Assert.Equal(1, result.TotalCount);
            Assert.Equal("TAG-TENANT-A", result.Items[0].AssetTag);
            Assert.DoesNotContain(result.Items, a => a.AssetTag == "TAG-TENANT-B");

            Assert.Equal(1, kpis.TotalAssetsCount);
            Assert.Equal(100000m, kpis.TotalAssetValue);
        }

        [Fact]
        public async Task CreateAssetAsync_ShouldCalculateCapitalizedCost_AndCreateAuditHistory()
        {
            // Arrange
            var (context, tenantProvider, userProvider, tenantId, companyId) = CreateTestContext();
            var service = new AssetManagementService(context, tenantProvider.Object, userProvider.Object);

            var request = new CreateAssetRequest
            {
                AssetName = "Automated Capping Machine",
                AssetCategory = "Machinery",
                AssetTag = "CAP-001",
                PurchasePrice = 150000m,
                TaxAmount = 27000m,
                FreightCost = 5000m,
                InstallationCost = 8000m,
                OtherCapitalizedCost = 2000m,
                PurchaseDate = DateTime.UtcNow,
                DepreciationMethod = "StraightLine",
                UsefulLifeYears = 5,
                ResidualValue = 10000m,
                Location = "Packaging Line",
                Department = "Production",
                Condition = "Excellent"
            };

            // Act
            var created = await service.CreateAssetAsync(request);

            // Assert
            Assert.NotNull(created);
            Assert.Equal("CAP-001", created.AssetTag);
            Assert.Equal(192000m, created.TotalCapitalizedCost); // 150k + 27k + 5k + 8k + 2k
            Assert.Equal(192000m, created.CurrentValue);
            Assert.Equal(0m, created.AccumulatedDepreciation);
            Assert.Equal("Active", created.CurrentStatus);

            // Verify Audit History was recorded
            var history = await service.GetAssetHistoryAsync(created.Id);
            Assert.NotEmpty(history);
            Assert.Contains(history, h => h.Action == "Asset Created");
        }

        [Fact]
        public async Task GetAssetsAsync_ShouldMaterializeAllFields_AndNeverThrowInvalidCastException()
        {
            // Arrange
            var (context, tenantProvider, userProvider, tenantId, companyId) = CreateTestContext();
            var service = new AssetManagementService(context, tenantProvider.Object, userProvider.Object);

            var assetId = Guid.NewGuid();
            context.Assets.Add(new Asset
            {
                Id = assetId,
                TenantId = tenantId,
                CompanyId = companyId,
                AssetCode = "AST-2026-00007",
                AssetTag = "TAG-007",
                AssetName = "High Pressure Pump",
                AssetCategory = "Machinery",
                PurchasePrice = 75000m,
                TotalCapitalizedCost = 75000m,
                CurrentValue = 75000m,
                DepreciationMethod = "StraightLine",
                UsefulLifeYears = 5,
                ResidualValue = 0,
                DepreciationFrequency = "Yearly",
                DepreciationRate = 20,
                AccumulatedDepreciation = 0,
                CurrentStatus = "Active",
                Condition = "Good",
                TotalMaintenanceCost = 0,
                SaleValue = 0,
                DisposalCost = 0,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                IsDeleted = false
            });
            await context.SaveChangesAsync();

            // Act
            var result = await service.GetAssetsAsync(1, 50);
            var detailed = await service.GetAssetByIdAsync(assetId);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result.Items);
            Assert.Equal("AST-2026-00007", result.Items[0].AssetCode);
            Assert.NotNull(detailed);
            Assert.Equal("AST-2026-00007", detailed.AssetCode);
        }

        [Fact]
        public async Task GetAssetsAsync_And_GetAssetKpisAsync_ShouldFilterByPurchaseDate_AndRecalculateKpis()
        {
            // Arrange
            var (context, tenantProvider, userProvider, tenantId, companyId) = CreateTestContext();
            var service = new AssetManagementService(context, tenantProvider.Object, userProvider.Object);

            // Asset 1: Jan 15, 2026, Active, Cost 10000, Value 9000, Dep 1000
            context.Assets.Add(new Asset
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                AssetCode = "AST-JAN-01",
                AssetTag = "TAG-JAN-01",
                AssetName = "January Machine",
                AssetCategory = "Machinery",
                PurchaseDate = new DateTime(2026, 1, 15, 10, 0, 0, DateTimeKind.Utc),
                PurchasePrice = 10000m,
                TotalCapitalizedCost = 10000m,
                CurrentValue = 9000m,
                AccumulatedDepreciation = 1000m,
                CurrentStatus = "Active",
                Condition = "Good",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                IsDeleted = false
            });

            // Asset 2: March 01, 2026, Active, Cost 25000, Value 24500, Dep 500
            context.Assets.Add(new Asset
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                AssetCode = "AST-MAR-01",
                AssetTag = "TAG-MAR-01",
                AssetName = "March Pump",
                AssetCategory = "Machinery",
                PurchaseDate = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                PurchasePrice = 25000m,
                TotalCapitalizedCost = 25000m,
                CurrentValue = 24500m,
                AccumulatedDepreciation = 500m,
                CurrentStatus = "Active",
                Condition = "Good",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                IsDeleted = false
            });

            // Asset 3: March 31, 2026, UnderMaintenance, Cost 15000, Value 15000, Dep 0
            context.Assets.Add(new Asset
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                AssetCode = "AST-MAR-02",
                AssetTag = "TAG-MAR-02",
                AssetName = "March Vehicle",
                AssetCategory = "Vehicles",
                PurchaseDate = new DateTime(2026, 3, 31, 23, 30, 0, DateTimeKind.Utc),
                PurchasePrice = 15000m,
                TotalCapitalizedCost = 15000m,
                CurrentValue = 15000m,
                AccumulatedDepreciation = 0m,
                CurrentStatus = "UnderMaintenance",
                Condition = "Fair",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                IsDeleted = false
            });

            // Asset 4: April 01, 2026, Disposed, Cost 5000, Value 0, Dep 5000
            context.Assets.Add(new Asset
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                AssetCode = "AST-APR-01",
                AssetTag = "TAG-APR-01",
                AssetName = "April Asset",
                AssetCategory = "Office Equipment",
                PurchaseDate = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc),
                PurchasePrice = 5000m,
                TotalCapitalizedCost = 5000m,
                CurrentValue = 0m,
                AccumulatedDepreciation = 5000m,
                CurrentStatus = "Disposed",
                Condition = "Critical",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                IsDeleted = false
            });

            await context.SaveChangesAsync();

            // Test 1: All Dates
            var allResult = await service.GetAssetsAsync();
            Assert.Equal(4, allResult.TotalCount);
            Assert.NotNull(allResult.Summary);
            Assert.Equal(4, allResult.Summary.TotalAssetsCount);
            Assert.Equal(2, allResult.Summary.ActiveAssetsCount);
            Assert.Equal(1, allResult.Summary.UnderMaintenanceCount);
            Assert.Equal(1, allResult.Summary.DisposedCount);
            Assert.Equal(55000m, allResult.Summary.TotalAssetValue);
            Assert.Equal(48500m, allResult.Summary.CurrentBookValue); // 9000 + 24500 + 15000 (disposed excluded)
            Assert.Equal(6500m, allResult.Summary.AccumulatedDepreciation);

            // Test 2: Month Filter - March 2026 (01/03/2026 to 31/03/2026 inclusive)
            var marchFrom = new DateTime(2026, 3, 1);
            var marchTo = new DateTime(2026, 3, 31);
            var marchResult = await service.GetAssetsAsync(fromDate: marchFrom, toDate: marchTo);

            Assert.Equal(2, marchResult.TotalCount);
            Assert.Contains(marchResult.Items, a => a.AssetCode == "AST-MAR-01");
            Assert.Contains(marchResult.Items, a => a.AssetCode == "AST-MAR-02");
            Assert.DoesNotContain(marchResult.Items, a => a.AssetCode == "AST-JAN-01");
            Assert.DoesNotContain(marchResult.Items, a => a.AssetCode == "AST-APR-01");

            // Recalculated March KPIs
            Assert.NotNull(marchResult.Summary);
            Assert.Equal(2, marchResult.Summary.TotalAssetsCount);
            Assert.Equal(1, marchResult.Summary.ActiveAssetsCount);
            Assert.Equal(1, marchResult.Summary.UnderMaintenanceCount);
            Assert.Equal(0, marchResult.Summary.DisposedCount);
            Assert.Equal(40000m, marchResult.Summary.TotalAssetValue); // 25000 + 15000
            Assert.Equal(39500m, marchResult.Summary.CurrentBookValue); // 24500 + 15000
            Assert.Equal(500m, marchResult.Summary.AccumulatedDepreciation);

            // Standalone GetAssetKpisAsync with same date filter
            var marchKpis = await service.GetAssetKpisAsync(fromDate: marchFrom, toDate: marchTo);
            Assert.Equal(2, marchKpis.TotalAssetsCount);
            Assert.Equal(40000m, marchKpis.TotalAssetValue);
            Assert.Equal(39500m, marchKpis.CurrentBookValue);

            // Test 3: Empty Month - February 2028 (no assets)
            var emptyResult = await service.GetAssetsAsync(fromDate: new DateTime(2028, 2, 1), toDate: new DateTime(2028, 2, 29));
            Assert.Equal(0, emptyResult.TotalCount);
            Assert.Empty(emptyResult.Items);
            Assert.NotNull(emptyResult.Summary);
            Assert.Equal(0, emptyResult.Summary.TotalAssetsCount);
            Assert.Equal(0, emptyResult.Summary.ActiveAssetsCount);
            Assert.Equal(0m, emptyResult.Summary.TotalAssetValue);
            Assert.Equal(0m, emptyResult.Summary.CurrentBookValue);
            Assert.Equal(0m, emptyResult.Summary.AccumulatedDepreciation);

            // Test 4: Combined Filter - March 2026 + Category "Vehicles"
            var combinedResult = await service.GetAssetsAsync(category: "Vehicles", fromDate: marchFrom, toDate: marchTo);
            Assert.Single(combinedResult.Items);
            Assert.Equal("AST-MAR-02", combinedResult.Items[0].AssetCode);
            Assert.NotNull(combinedResult.Summary);
            Assert.Equal(1, combinedResult.Summary.TotalAssetsCount);
            Assert.Equal(15000m, combinedResult.Summary.TotalAssetValue);
        }
    }
}
