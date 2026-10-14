using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Xunit.Abstractions;
using Aquora.API.Controllers;
using Aquora.Application.DTOs.CaseConfiguration;
using Aquora.Application.DTOs.Products;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Persistence.Context;
using Aquora.Shared.Models;

namespace Aquora.Tests
{
    public class ProductsAndCaseConfigurationsRetrievalTests
    {
        private readonly ITestOutputHelper _output;
        private const string ConnectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        public ProductsAndCaseConfigurationsRetrievalTests(ITestOutputHelper output)
        {
            _output = output;
        }

        private (TenantDbContext context, ProductsController controller) CreateProductsController(Guid tenantId, string schema)
        {
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns(schema);

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(x => x.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(x => x.UserId).Returns("test-user");
            mockCurrentUser.Setup(x => x.Roles).Returns(new List<string> { "Owner" });

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseNpgsql(ConnectionString)
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, TenantModelCacheKeyFactory>()
                .Options;

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUser.Object);

            var platformContextMock = new Mock<IPlatformDbContext>();
            var inventoryMovementServiceMock = new Mock<IInventoryMovementService>();
            var loggerMock = new Mock<ILogger<ProductsController>>();

            var controller = new ProductsController(
                context,
                mockCurrentUser.Object,
                platformContextMock.Object,
                inventoryMovementServiceMock.Object,
                loggerMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext()
                }
            };

            return (context, controller);
        }

        private (TenantDbContext context, CaseConfigurationsController controller) CreateCaseConfigurationsController(Guid tenantId, string schema)
        {
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns(schema);

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(x => x.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(x => x.UserId).Returns("test-user");
            mockCurrentUser.Setup(x => x.Roles).Returns(new List<string> { "Owner" });

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseNpgsql(ConnectionString)
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory, TenantModelCacheKeyFactory>()
                .Options;

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUser.Object);
            var loggerMock = new Mock<ILogger<CaseConfigurationsController>>();

            var controller = new CaseConfigurationsController(
                context,
                mockCurrentUser.Object,
                mockTenantProvider.Object,
                loggerMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext()
                }
            };

            return (context, controller);
        }

        [Fact]
        public async Task Products_RetrievesProductsCorrectly_EvenWhenBrandIsSoftDeleted()
        {
            // Tenant: Faiha Water Solutions (Schema: aquora_tenant_accountant_company)
            // Contains product 'Faiha 500ML' whose Brand 'Aquora' is soft-deleted (IsDeleted = true)
            var tenantId = Guid.Parse("8714038a-36b0-4521-8b5e-9389ad045a65");
            var schema = "aquora_tenant_accountant_company";

            var (context, controller) = CreateProductsController(tenantId, schema);
            await using (context)
            {
                // Act: GetProducts
                var result = await controller.GetProducts(pageNumber: 1, pageSize: 10);
                var okResult = Assert.IsType<OkObjectResult>(result.Result);
                var apiResponse = Assert.IsType<ApiResponse<PagedResult<ProductDto>>>(okResult.Value);

                Assert.True(apiResponse.Success);
                Assert.NotNull(apiResponse.Data);

                _output.WriteLine($"Products TotalCount: {apiResponse.Data.TotalCount}, Items: {apiResponse.Data.Items.Count}");
                foreach (var item in apiResponse.Data.Items)
                {
                    _output.WriteLine($" - Product: Id={item.Id}, Name={item.Name}, Brand={item.BrandName}, SKU={item.SKU}");
                }

                // Assert totalCount and items count match
                Assert.Equal(1, apiResponse.Data.TotalCount);
                Assert.Single(apiResponse.Data.Items);

                var product = apiResponse.Data.Items[0];
                Assert.Equal("Faiha 500ML", product.Name);
                Assert.Equal("Aquora", product.BrandName);

                // Act 2: Search by term
                var searchHit = await controller.GetProducts(pageNumber: 1, pageSize: 10, searchTerm: "faiha");
                var searchHitOk = Assert.IsType<OkObjectResult>(searchHit.Result);
                var searchHitResponse = Assert.IsType<ApiResponse<PagedResult<ProductDto>>>(searchHitOk.Value);
                Assert.Equal(1, searchHitResponse.Data.TotalCount);
                Assert.Single(searchHitResponse.Data.Items);

                var searchMiss = await controller.GetProducts(pageNumber: 1, pageSize: 10, searchTerm: "NonExistentProductXYZ");
                var searchMissOk = Assert.IsType<OkObjectResult>(searchMiss.Result);
                var searchMissResponse = Assert.IsType<ApiResponse<PagedResult<ProductDto>>>(searchMissOk.Value);
                Assert.Equal(0, searchMissResponse.Data.TotalCount);
                Assert.Empty(searchMissResponse.Data.Items);

                // Act 3: GetProductById
                var singleResult = await controller.GetProductById(product.Id);
                var singleOk = Assert.IsType<OkObjectResult>(singleResult.Result);
                var singleResponse = Assert.IsType<ApiResponse<ProductDto>>(singleOk.Value);
                Assert.True(singleResponse.Success);
                Assert.Equal("Faiha 500ML", singleResponse.Data.Name);
                Assert.Equal("Aquora", singleResponse.Data.BrandName);
            }
        }

        [Fact]
        public async Task CaseConfigurations_RetrievesConfigurationsCorrectly_EvenWhenProductIsSoftDeleted()
        {
            // Tenant: Sinan Company (Schema: aquora_tenant_sinan_company)
            // Contains CaseConfig 'Aquora 1 - 12 Units/Case' linked to Product 'Aquora 1' which is soft-deleted
            var tenantId = Guid.Parse("7d77da44-5307-489c-b474-bf9cdc6137ee");
            var schema = "aquora_tenant_sinan_company";

            var (context, controller) = CreateCaseConfigurationsController(tenantId, schema);
            await using (context)
            {
                // Act: GetCaseConfigurations
                var result = await controller.GetCaseConfigurations(includeInactive: true);
                var okResult = Assert.IsType<OkObjectResult>(result.Result);
                var apiResponse = Assert.IsType<ApiResponse<List<CaseConfigurationDto>>>(okResult.Value);

                Assert.True(apiResponse.Success);
                Assert.NotNull(apiResponse.Data);

                _output.WriteLine($"CaseConfigurations Count: {apiResponse.Data.Count}");
                foreach (var item in apiResponse.Data)
                {
                    _output.WriteLine($" - CaseConfig: Id={item.Id}, Name={item.Name}, Product={item.ProductName}, Units={item.UnitsPerCase}");
                }

                Assert.NotEmpty(apiResponse.Data);
                var config = apiResponse.Data.FirstOrDefault(c => c.Name.Contains("Aquora 1"));
                Assert.NotNull(config);
                Assert.Equal("Aquora 1 - 12 Units/Case", config.Name);
                Assert.Equal("Aquora 1", config.ProductName);
                Assert.Equal(12, config.UnitsPerCase);

                // Act 2: GetCaseConfigurationById
                var singleResult = await controller.GetCaseConfigurationById(config.Id);
                var singleOk = Assert.IsType<OkObjectResult>(singleResult.Result);
                var singleResponse = Assert.IsType<ApiResponse<CaseConfigurationDto>>(singleOk.Value);
                Assert.True(singleResponse.Success);
                Assert.Equal("Aquora 1", singleResponse.Data.ProductName);
                Assert.Equal(12, singleResponse.Data.UnitsPerCase);
            }
        }

        [Fact]
        public async Task Products_ExcludesDeletedProducts_InSinanCompany()
        {
            // Tenant: Sinan Company (Schema: aquora_tenant_sinan_company)
            // Has 1 non-deleted product ('20 L Jar') and 1 soft-deleted product ('Aquora 1')
            var tenantId = Guid.Parse("7d77da44-5307-489c-b474-bf9cdc6137ee");
            var schema = "aquora_tenant_sinan_company";

            var (context, controller) = CreateProductsController(tenantId, schema);
            await using (context)
            {
                var result = await controller.GetProducts(pageNumber: 1, pageSize: 10);
                var okResult = Assert.IsType<OkObjectResult>(result.Result);
                var apiResponse = Assert.IsType<ApiResponse<PagedResult<ProductDto>>>(okResult.Value);

                Assert.True(apiResponse.Success);
                Assert.NotNull(apiResponse.Data);

                _output.WriteLine($"Sinan Company Products TotalCount: {apiResponse.Data.TotalCount}, Items: {apiResponse.Data.Items.Count}");
                foreach (var item in apiResponse.Data.Items)
                {
                    _output.WriteLine($" - Product: Id={item.Id}, Name={item.Name}, Brand={item.BrandName}");
                }

                // Verify count is 1 and contains only '20 L Jar'
                Assert.Equal(1, apiResponse.Data.TotalCount);
                Assert.Single(apiResponse.Data.Items);
                Assert.Equal("20 L Jar", apiResponse.Data.Items[0].Name);

                // Verify deleted product 'Aquora 1' is excluded
                Assert.DoesNotContain(apiResponse.Data.Items, p => p.Name == "Aquora 1");
            }
        }
    }
}
