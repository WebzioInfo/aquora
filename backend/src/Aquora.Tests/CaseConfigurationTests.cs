using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Aquora.API.Controllers;
using Aquora.Application.DTOs.CaseConfiguration;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Shared.Models;

namespace Aquora.Tests
{
    public class CaseConfigurationTests
    {
        private (TenantDbContext Context, CaseConfigurationsController Controller, Guid TenantId, Guid CompanyId, Guid ProductId) CreateTestController(
            string role = "Owner",
            Guid? specificTenantId = null)
        {
            var tenantId = specificTenantId ?? Guid.NewGuid();
            var companyId = Guid.NewGuid();
            var productId = Guid.NewGuid();

            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(x => x.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(x => x.TenantSchemaName).Returns("test_schema");

            var mockCurrentUserContext = new Mock<ICurrentUserContext>();
            mockCurrentUserContext.Setup(x => x.UserId).Returns("test-user-guid");
            mockCurrentUserContext.Setup(x => x.Roles).Returns(new List<string> { role });

            var mockDateTimeProvider = new Mock<IDateTimeProvider>();
            mockDateTimeProvider.Setup(x => x.UtcNow).Returns(DateTime.UtcNow);

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Test Mineral Water Ltd",
                Code = "TMW"
            };
            context.Companies.Add(company);

            var product = new Product
            {
                Id = productId,
                Name = "500ml Bottled Water",
                SKU = "WAT-500",
                IsActive = true
            };
            context.Products.Add(product);
            context.SaveChanges();

            var mockLogger = new Mock<ILogger<CaseConfigurationsController>>();

            var controller = new CaseConfigurationsController(
                context,
                mockCurrentUserContext.Object,
                mockTenantProvider.Object,
                mockLogger.Object
            )
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext()
                }
            };

            return (context, controller, tenantId, companyId, productId);
        }

        [Fact]
        public async Task CreateCaseConfiguration_WithValidData_ReturnsCreatedConfiguration()
        {
            var (context, controller, tenantId, companyId, productId) = CreateTestController();

            var dto = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "Standard 24 Bottle Case",
                UnitsPerCase = 24,
                Description = "Standard corrugated box with 24 bottles",
                IsActive = true
            };

            var actionResult = await controller.CreateCaseConfiguration(dto);
            var createdAtActionResult = Assert.IsType<CreatedAtActionResult>(actionResult.Result);
            var response = Assert.IsType<ApiResponse<CaseConfigurationDto>>(createdAtActionResult.Value);

            Assert.True(response.Success);
            Assert.NotNull(response.Data);
            Assert.Equal("Standard 24 Bottle Case", response.Data.Name);
            Assert.Equal(24, response.Data.UnitsPerCase);
            Assert.Equal("Standard corrugated box with 24 bottles", response.Data.Description);
            Assert.True(response.Data.IsActive);
        }

        [Fact]
        public async Task CreateCaseConfiguration_DuplicateUnitsPerCase_ReturnsConflict()
        {
            var (context, controller, tenantId, companyId, productId) = CreateTestController();

            // 1. First creation
            var dto1 = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "24 Bottle Pack",
                UnitsPerCase = 24
            };
            var res1 = await controller.CreateCaseConfiguration(dto1);
            Assert.IsType<CreatedAtActionResult>(res1.Result);

            // 2. Second creation with duplicate units per case
            var dto2 = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "Another 24 Pack",
                UnitsPerCase = 24
            };
            var res2 = await controller.CreateCaseConfiguration(dto2);
            var conflictResult = Assert.IsType<ConflictObjectResult>(res2.Result);
            var response = Assert.IsType<ApiResponse<CaseConfigurationDto>>(conflictResult.Value);

            Assert.False(response.Success);
            Assert.Contains("already exists", response.Message);
        }

        [Fact]
        public async Task CreateCaseConfiguration_DuplicateName_ReturnsConflict()
        {
            var (context, controller, tenantId, companyId, productId) = CreateTestController();

            // 1. First creation
            var dto1 = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "Standard Pack",
                UnitsPerCase = 24
            };
            await controller.CreateCaseConfiguration(dto1);

            // 2. Second creation with duplicate name
            var dto2 = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "Standard Pack",
                UnitsPerCase = 12
            };
            var res2 = await controller.CreateCaseConfiguration(dto2);
            var conflictResult = Assert.IsType<ConflictObjectResult>(res2.Result);
            var response = Assert.IsType<ApiResponse<CaseConfigurationDto>>(conflictResult.Value);

            Assert.False(response.Success);
            Assert.Contains("already exists", response.Message);
        }

        [Fact]
        public async Task CreateCaseConfiguration_ReactivatesDeletedOrInactiveRecord()
        {
            var (context, controller, tenantId, companyId, productId) = CreateTestController();

            // Seed an inactive or soft-deleted configuration
            var existingConfig = new CaseConfiguration
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                ProductId = productId,
                Name = "Old 12 Pack",
                UnitsPerCase = 12,
                IsActive = false
            };
            context.CaseConfigurations.Add(existingConfig);
            await context.SaveChangesAsync();

            // Attempt to create a configuration for 12 units
            var dto = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "Reactivated 12 Pack",
                UnitsPerCase = 12,
                IsActive = true
            };

            var actionResult = await controller.CreateCaseConfiguration(dto);
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var response = Assert.IsType<ApiResponse<CaseConfigurationDto>>(okResult.Value);

            Assert.True(response.Success);
            Assert.True(response.Data.IsActive);
            Assert.Equal(12, response.Data.UnitsPerCase);
            Assert.Equal("Reactivated 12 Pack", response.Data.Name);
        }

        [Fact]
        public async Task CreateCaseConfiguration_InvalidUnits_ReturnsBadRequest()
        {
            var (context, controller, tenantId, companyId, productId) = CreateTestController();

            var dto = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "Zero Pack",
                UnitsPerCase = 0
            };

            var actionResult = await controller.CreateCaseConfiguration(dto);
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(actionResult.Result);
            var response = Assert.IsType<ApiResponse<CaseConfigurationDto>>(badRequestResult.Value);

            Assert.False(response.Success);
            Assert.Contains("greater than 0", response.Message);
        }

        [Fact]
        public async Task CreateCaseConfiguration_UnprivilegedRole_ReturnsForbidden()
        {
            var (context, controller, tenantId, companyId, productId) = CreateTestController(role: "Viewer");

            var dto = new CreateCaseConfigurationDto
            {
                ProductId = productId,
                Name = "Viewer Pack",
                UnitsPerCase = 12
            };

            var actionResult = await controller.CreateCaseConfiguration(dto);
            var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(403, statusResult.StatusCode);
        }

        [Fact]
        public async Task GetCaseConfigurations_TenantIsolation_DoesNotLeakAcrossTenants()
        {
            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();

            var (contextA, controllerA, _, _, prodA) = CreateTestController(specificTenantId: tenantA);

            // Add config for Tenant A
            await controllerA.CreateCaseConfiguration(new CreateCaseConfigurationDto
            {
                ProductId = prodA,
                Name = "Tenant A 24 Pack",
                UnitsPerCase = 24
            });

            // Set up Tenant B
            var (_, controllerB, _, _, prodB) = CreateTestController(specificTenantId: tenantB);

            // Query Tenant B
            var resultB = await controllerB.GetCaseConfigurations(includeInactive: true);
            var okResultB = Assert.IsType<OkObjectResult>(resultB.Result);
            var responseB = Assert.IsType<ApiResponse<List<CaseConfigurationDto>>>(okResultB.Value);

            Assert.DoesNotContain(responseB.Data, c => c.Name == "Tenant A 24 Pack");
        }
    }
}
