using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.Application.DTOs;
using Aquora.Application.DTOs.Finance;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class AssetCategoryTests
    {
        private (TenantDbContext Context, AssetManagementService Service, Guid TenantId, Guid CompanyId) CreateTestService(Guid? specificTenantId = null)
        {
            var tenantId = specificTenantId ?? Guid.NewGuid();
            var companyId = Guid.NewGuid();

            var tenantProviderMock = new Mock<ITenantProvider>();
            tenantProviderMock.Setup(t => t.TenantId).Returns(tenantId);
            tenantProviderMock.Setup(t => t.TenantSchemaName).Returns("public");

            var userProviderMock = new Mock<ICurrentUserContext>();
            userProviderMock.Setup(u => u.TenantId).Returns(tenantId);
            userProviderMock.Setup(u => u.UserId).Returns("test-user-id");

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: $"AssetCategoryTestDb_{Guid.NewGuid()}")
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

            var service = new AssetManagementService(context, tenantProviderMock.Object, userProviderMock.Object);
            return (context, service, tenantId, companyId);
        }

        [Fact]
        public async Task Test_GetAssetCategories_AutoSeedsDefaultCategories()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Act: call GetAssetCategoriesAsync when table is initially empty
            var categories = await service.GetAssetCategoriesAsync();

            // Assert: Exactly 8 standard system categories must be seeded
            Assert.NotEmpty(categories);
            Assert.Equal(8, categories.Count);

            var expectedCodes = new[] { "Machinery", "Vehicles", "Computers", "Printers", "Furniture", "Office Equipment", "Buildings", "Other" };
            foreach (var code in expectedCodes)
            {
                var match = categories.FirstOrDefault(c => c.Code == code);
                Assert.NotNull(match);
                Assert.True(match.IsSystem);
                Assert.True(match.IsActive);
                Assert.NotEqual(Guid.Empty, match.Id);
            }

            // Database records must match
            var inDb = await context.AssetCategories.Where(c => c.TenantId == tenantId && !c.IsDeleted).ToListAsync();
            Assert.Equal(8, inDb.Count);
        }

        [Fact]
        public async Task Test_GetAssetCategories_IsIdempotent()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Act: Call multiple times
            var firstCall = await service.GetAssetCategoriesAsync();
            var secondCall = await service.GetAssetCategoriesAsync();

            // Assert: No duplicates created
            Assert.Equal(8, firstCall.Count);
            Assert.Equal(8, secondCall.Count);

            var totalInDb = await context.AssetCategories.Where(c => c.TenantId == tenantId && !c.IsDeleted).CountAsync();
            Assert.Equal(8, totalInDb);
        }

        [Fact]
        public async Task Test_CreateAssetCategory_PersistsRealDatabaseRecord()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Act: Create new custom category
            var req = new CreateAssetCategoryRequest
            {
                Name = "Solar Power Plant",
                Description = "High capacity PV arrays and battery banks",
                IsActive = true
            };
            var created = await service.CreateAssetCategoryAsync(req);

            // Assert: Real DB record with generated ID
            Assert.NotNull(created);
            Assert.NotEqual(Guid.Empty, created.Id);
            Assert.Equal("Solar Power Plant", created.Name);
            Assert.Equal("Solar Power Plant", created.Code);
            Assert.False(created.IsSystem);
            Assert.True(created.IsActive);
            Assert.Equal(tenantId, created.TenantId);

            // Verify in database
            var dbRecord = await context.AssetCategories.FindAsync(created.Id);
            Assert.NotNull(dbRecord);
            Assert.Equal("Solar Power Plant", dbRecord.Name);
        }

        [Fact]
        public async Task Test_CreateAssetCategory_DuplicateCheck_IsCaseAndWhitespaceInsensitive()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Ensure categories are seeded first
            await service.GetAssetCategoriesAsync();

            // Attempt duplicate of system category with different casing/spaces
            var duplicateSystemReq = new CreateAssetCategoryRequest
            {
                Name = "  machinery & equipment  "
            };
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAssetCategoryAsync(duplicateSystemReq));

            // Create a custom category
            await service.CreateAssetCategoryAsync(new CreateAssetCategoryRequest { Name = "Packaging Robotics" });

            // Attempt duplicate of custom category with different casing/spaces
            var duplicateCustomReq = new CreateAssetCategoryRequest
            {
                Name = "  PACKAGING ROBOTICS "
            };
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAssetCategoryAsync(duplicateCustomReq));
        }

        [Fact]
        public async Task Test_TenantIsolation_CategoriesDoNotLeakBetweenTenants()
        {
            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();

            var (contextA, serviceA, _, _) = CreateTestService(tenantA);

            // Create custom category for Tenant A
            await serviceA.CreateAssetCategoryAsync(new CreateAssetCategoryRequest
            {
                Name = "Tenant A Specialized Rig"
            });

            // Service for Tenant B
            var tenantBMock = new Mock<ITenantProvider>();
            tenantBMock.Setup(t => t.TenantId).Returns(tenantB);
            var userBMock = new Mock<ICurrentUserContext>();
            userBMock.Setup(u => u.TenantId).Returns(tenantB);

            var serviceB = new AssetManagementService(contextA, tenantBMock.Object, userBMock.Object);

            var categoriesB = await serviceB.GetAssetCategoriesAsync();

            // Tenant B should have 8 seeded categories, and should NOT see Tenant A's custom category
            Assert.DoesNotContain(categoriesB, c => c.Name == "Tenant A Specialized Rig");
        }

        [Fact]
        public async Task Test_CreateAsset_WithCustomCategory_AndFilterSuccessfully()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // 1. Create custom category
            var cat = await service.CreateAssetCategoryAsync(new CreateAssetCategoryRequest
            {
                Name = "Heavy Water Tankers",
                Description = "Commercial stainless steel tankers"
            });

            // 2. Register asset with this category
            var assetReq = new CreateAssetRequest
            {
                AssetName = "BharatBenz 16-Wheel Water Tanker",
                AssetTag = "TNK-001",
                AssetCategory = cat.Code,
                PurchaseDate = DateTime.UtcNow,
                PurchasePrice = 3500000m,
                UsefulLifeYears = 12,
                ResidualValue = 350000m,
                DepreciationMethod = "StraightLine"
            };

            var createdAsset = await service.CreateAssetAsync(assetReq);
            Assert.NotNull(createdAsset);
            Assert.Equal("Heavy Water Tankers", createdAsset.AssetCategory);

            // 3. Filter assets by the new category
            var paged = await service.GetAssetsAsync(pageNumber: 1, pageSize: 10, category: "Heavy Water Tankers");
            Assert.Single(paged.Items);
            Assert.Equal("TNK-001", paged.Items[0].AssetTag);

            // 4. Filter assets using lowercase
            var pagedLower = await service.GetAssetsAsync(pageNumber: 1, pageSize: 10, category: "heavy water tankers");
            Assert.Single(pagedLower.Items);
        }

        [Fact]
        public async Task Test_DeleteAssetCategory_CannotDeleteSystemCategoryOrCategoryWithAssets()
        {
            var (context, service, tenantId, companyId) = CreateTestService();
            var categories = await service.GetAssetCategoriesAsync();
            var systemCat = categories.First(c => c.IsSystem);

            // Should fail when attempting to delete system category
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAssetCategoryAsync(systemCat.Id));

            // Create custom category and assign asset
            var customCat = await service.CreateAssetCategoryAsync(new CreateAssetCategoryRequest { Name = "Temporary Equipment" });
            await service.CreateAssetAsync(new CreateAssetRequest
            {
                AssetName = "Mobile Generator Unit",
                AssetCategory = customCat.Code,
                PurchaseDate = DateTime.UtcNow,
                PurchasePrice = 50000m,
                UsefulLifeYears = 5
            });

            // Should fail when attempting to delete category with linked assets
            await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAssetCategoryAsync(customCat.Id));
        }
    }
}
