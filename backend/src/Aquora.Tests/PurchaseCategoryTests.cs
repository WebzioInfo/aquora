using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Aquora.Application.DTOs.Purchase;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class PurchaseCategoryTests
    {
        private (TenantDbContext Context, PurchaseService Service, Guid TenantId, Guid CompanyId) CreateTestService(Guid? specificTenantId = null)
        {
            var tenantId = specificTenantId ?? Guid.NewGuid();
            var companyId = Guid.NewGuid();

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns("public");

            var mockCurrentUserContext = new Mock<ICurrentUserContext>();
            mockCurrentUserContext.Setup(x => x.UserId).Returns("test-user-id");
            mockCurrentUserContext.Setup(x => x.Email).Returns("admin@aquora.com");

            var mockDateTimeProvider = new Mock<IDateTimeProvider>();
            mockDateTimeProvider.Setup(x => x.UtcNow).Returns(DateTime.UtcNow);

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            // Add default company
            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Test Beverages Ltd",
                Code = "TBL"
            };
            context.Companies.Add(company);
            context.SaveChanges();

            var mockPlatformContext = new Mock<IPlatformDbContext>();
            var mockLedgerService = new Mock<ILedgerService>();
            var mockLogger = new Mock<ILogger<PurchaseService>>();

            var service = new PurchaseService(
                context,
                mockPlatformContext.Object,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object,
                mockLedgerService.Object,
                mockLogger.Object
            );

            return (context, service, tenantId, companyId);
        }

        [Fact]
        public async Task Test_GetPurchaseCategories_AutoSeedsAll10SystemCategories()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            var categories = await service.GetPurchaseCategoriesAsync();

            Assert.NotNull(categories);
            Assert.True(categories.Count >= 10);

            // Verify all 10 system category codes exist
            var codes = categories.Select(c => c.Code).ToList();
            Assert.Contains("RawMaterial", codes);
            Assert.Contains("Machine", codes);
            Assert.Contains("OfficeAsset", codes);
            Assert.Contains("OfficeExpense", codes);
            Assert.Contains("Service", codes);
            Assert.Contains("Maintenance", codes);
            Assert.Contains("Utility", codes);
            Assert.Contains("Vehicle", codes);
            Assert.Contains("Software", codes);
            Assert.Contains("Other", codes);

            // Verify treatments
            var rawMat = categories.First(c => c.Code == "RawMaterial");
            Assert.Equal("Inventory", rawMat.Treatment);
            Assert.True(rawMat.IsSystem);

            var machine = categories.First(c => c.Code == "Machine");
            Assert.Equal("Asset", machine.Treatment);
            Assert.True(machine.IsSystem);

            var officeAsset = categories.First(c => c.Code == "OfficeAsset");
            Assert.Equal("Asset", officeAsset.Treatment);
            Assert.True(officeAsset.IsSystem);

            var officeExpense = categories.First(c => c.Code == "OfficeExpense");
            Assert.Equal("Expense", officeExpense.Treatment);
            Assert.True(officeExpense.IsSystem);
        }

        [Fact]
        public async Task Test_CreateCustomPurchaseCategory_SucceedsWithTreatment()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            var req = new CreatePurchaseCategoryRequest
            {
                Name = "Factory Cleaning Supplies",
                Treatment = "Expense",
                Description = "Cleaning chemicals, mops, detergents"
            };

            var created = await service.CreatePurchaseCategoryAsync(req);

            Assert.NotNull(created);
            Assert.Equal("Factory Cleaning Supplies", created.Name);
            Assert.Equal("Expense", created.Treatment);
            Assert.False(created.IsSystem);
            Assert.True(created.IsActive);
            Assert.False(string.IsNullOrWhiteSpace(created.Code));

            // Verify persistent in DbContext
            var inDb = await context.PurchaseCategories.FirstOrDefaultAsync(c => c.Id == created.Id);
            Assert.NotNull(inDb);
            Assert.Equal("Factory Cleaning Supplies", inDb.Name);
            Assert.Equal("Expense", inDb.Treatment);
        }

        [Fact]
        public async Task Test_CreateCustomCategory_DuplicateNameRejection()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            await service.CreatePurchaseCategoryAsync(new CreatePurchaseCategoryRequest
            {
                Name = "Laboratory Chemicals",
                Treatment = "Expense"
            });

            await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            {
                await service.CreatePurchaseCategoryAsync(new CreatePurchaseCategoryRequest
                {
                    Name = "Laboratory Chemicals",
                    Treatment = "Expense"
                });
            });
        }

        [Fact]
        public async Task Test_CreateCustomCategory_InvalidTreatmentRejection()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            await Assert.ThrowsAsync<ArgumentException>(async () =>
            {
                await service.CreatePurchaseCategoryAsync(new CreatePurchaseCategoryRequest
                {
                    Name = "Invalid Cat",
                    Treatment = "UnknownTreatment"
                });
            });
        }

        [Fact]
        public async Task Test_DeleteSystemCategory_IsPrevented()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            var categories = await service.GetPurchaseCategoriesAsync();
            var rawMaterial = categories.First(c => c.Code == "RawMaterial");

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            {
                await service.DeletePurchaseCategoryAsync(rawMaterial.Id);
            });

            Assert.Contains("System default categories cannot be deleted", ex.Message);
        }

        [Fact]
        public async Task Test_DeleteReferencedCategory_DeactivatesInsteadOfDeleting()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            var custom = await service.CreatePurchaseCategoryAsync(new CreatePurchaseCategoryRequest
            {
                Name = "Specialty Lubricants",
                Treatment = "Expense"
            });

            // Create a purchase referencing this category
            var purchase = new Purchase
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                PurchaseNo = "PUR-2026-0001",
                PurchaseCategory = custom.Code,
                VendorName = "Lubricants Supplier",
                GrandTotal = 5000,
                PaymentMethod = "Credit",
                PaymentStatus = "Unpaid",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "admin@aquora.com"
            };
            context.Purchases.Add(purchase);
            await context.SaveChangesAsync();

            // Attempt deletion
            var result = await service.DeletePurchaseCategoryAsync(custom.Id);
            Assert.True(result);

            // Verify entity is not deleted, but deactivated
            var inDb = await context.PurchaseCategories.FirstOrDefaultAsync(c => c.Id == custom.Id);
            Assert.NotNull(inDb);
            Assert.False(inDb.IsDeleted);
            Assert.False(inDb.IsActive);
        }

        [Fact]
        public async Task Test_TreatmentExecution_CustomInventoryCategory_PerformsStockIn()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Create custom category with Inventory treatment
            var customInventoryCat = await service.CreatePurchaseCategoryAsync(new CreatePurchaseCategoryRequest
            {
                Name = "Packaging Consumables",
                Treatment = "Inventory"
            });

            // Create Raw Material
            var rm = new RawMaterial
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Code = "RM-BOX-001",
                Name = "Corrugated Boxes",
                Category = "Packaging",
                Unit = "Boxes",
                BaseUnit = "Boxes",
                CurrentStock = 100,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "System"
            };
            context.RawMaterials.Add(rm);
            await context.SaveChangesAsync();

            // Create Purchase using custom category
            var purchaseReq = new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorName = "Box Factory",
                PurchaseCategory = customInventoryCat.Code,
                PaymentMethod = "Credit",
                GrandTotal = 2500,
                Items = new List<CreatePurchaseItemRequest>
                {
                    new CreatePurchaseItemRequest
                    {
                        RawMaterialId = rm.Id,
                        ItemName = "Corrugated Boxes",
                        Quantity = 50,
                        Unit = "Boxes",
                        UnitPrice = 50,
                        TotalAmount = 2500
                    }
                }
            };

            var purchaseDto = await service.CreatePurchaseAsync(purchaseReq);
            Assert.NotNull(purchaseDto);

            // Verify stock increased
            var updatedRm = await context.RawMaterials.FindAsync(rm.Id);
            Assert.NotNull(updatedRm);
            Assert.Equal(150, updatedRm.CurrentStock);

            // Verify inventory movement logged
            var movement = await context.InventoryMovements.FirstOrDefaultAsync(m => m.ReferenceId == purchaseDto.Id);
            Assert.NotNull(movement);
            Assert.Equal("PURCHASE", movement.ReferenceType);
            Assert.Equal(50, movement.Quantity);
            Assert.Equal(150, movement.BalanceAfter);
        }

        [Fact]
        public async Task Test_TreatmentExecution_CustomAssetCategory_AutoCreatesAsset()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Create custom category with Asset treatment
            var customAssetCat = await service.CreatePurchaseCategoryAsync(new CreatePurchaseCategoryRequest
            {
                Name = "Water Filtration Hardware",
                Treatment = "Asset"
            });

            // Create Purchase using custom category
            var purchaseReq = new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorName = "Filtration Dynamics",
                PurchaseCategory = customAssetCat.Code,
                PaymentMethod = "Credit",
                GrandTotal = 75000,
                CategoryMetadataJson = "{\"assetName\":\"Multi-Stage RO Skid\",\"location\":\"Filtration Bay\"}"
            };

            var purchaseDto = await service.CreatePurchaseAsync(purchaseReq);
            Assert.NotNull(purchaseDto);
            Assert.NotNull(purchaseDto.AssetId);

            // Verify asset record created
            var asset = await context.Assets.FindAsync(purchaseDto.AssetId.Value);
            Assert.NotNull(asset);
            Assert.Equal("Multi-Stage RO Skid", asset.AssetName);
            Assert.Equal(75000, asset.PurchasePrice);
            Assert.Equal("Filtration Bay", asset.Location);

            // Verify asset history created
            var history = await context.AssetHistories.FirstOrDefaultAsync(h => h.AssetId == asset.Id);
            Assert.NotNull(history);
            Assert.Equal("Purchased", history.Action);
        }

        [Fact]
        public async Task Test_MultiTenantIsolation_CustomCategoriesDoNotLeakAcrossTenants()
        {
            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();

            var (_, serviceA, _, _) = CreateTestService(tenantA);
            var (_, serviceB, _, _) = CreateTestService(tenantB);

            // Tenant A creates custom category
            await serviceA.CreatePurchaseCategoryAsync(new CreatePurchaseCategoryRequest
            {
                Name = "Tenant A Secret Procurement",
                Treatment = "Expense"
            });

            // Tenant B lists categories
            var catsB = await serviceB.GetPurchaseCategoriesAsync();
            var namesB = catsB.Select(c => c.Name).ToList();

            Assert.DoesNotContain("Tenant A Secret Procurement", namesB);
        }
    }
}
