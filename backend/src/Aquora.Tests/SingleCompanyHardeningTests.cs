using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.Application.DTOs.Hierarchy;
using Aquora.Application.Extensions;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class SingleCompanyHardeningTests
    {
        private DbContextOptions<TenantDbContext> CreateInMemoryTenantDbOptions()
        {
            return new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
        }

        [Fact]
        public async Task SingletonCompanyResolver_ReturnsSingleCompany_WhenExactlyOneExists()
        {
            // Arrange
            var options = CreateInMemoryTenantDbOptions();
            var tenantId = Guid.NewGuid();
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(t => t.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(t => t.TenantSchemaName).Returns("aquora_tenant_test");

            var mockUserContext = new Mock<ICurrentUserContext>();

            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockUserContext.Object);
            var company = new Company
            {
                Id = Guid.NewGuid(),
                Name = "Apex Water Corp",
                Code = "APEX",
                TenantId = tenantId,
                IsActive = true
            };
            context.Companies.Add(company);
            await context.SaveChangesAsync();

            // Act
            var resolvedCompany = await context.GetSingletonCompanyAsync();

            // Assert
            Assert.NotNull(resolvedCompany);
            Assert.Equal(company.Id, resolvedCompany.Id);
            Assert.Equal("Apex Water Corp", resolvedCompany.Name);
        }

        [Fact]
        public async Task SingletonCompanyResolver_ThrowsInvalidOperation_WhenZeroCompaniesExist()
        {
            // Arrange
            var options = CreateInMemoryTenantDbOptions();
            var tenantId = Guid.NewGuid();
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(t => t.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(t => t.TenantSchemaName).Returns("aquora_tenant_test");

            var mockUserContext = new Mock<ICurrentUserContext>();

            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockUserContext.Object);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => context.GetSingletonCompanyAsync());
            Assert.Contains("No company root found", ex.Message);
        }

        [Fact]
        public async Task SingletonCompanyResolver_ThrowsInvalidOperation_WhenMultipleCompaniesExist()
        {
            // Arrange
            var options = CreateInMemoryTenantDbOptions();
            var tenantId = Guid.NewGuid();
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(t => t.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(t => t.TenantSchemaName).Returns("aquora_tenant_test");

            var mockUserContext = new Mock<ICurrentUserContext>();

            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockUserContext.Object);
            context.Companies.Add(new Company { Id = Guid.NewGuid(), Name = "Company 1", Code = "C1", TenantId = tenantId });
            context.Companies.Add(new Company { Id = Guid.NewGuid(), Name = "Company 2", Code = "C2", TenantId = tenantId });
            await context.SaveChangesAsync();

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => context.GetSingletonCompanyAsync());
            Assert.Contains("Multiple active company roots found", ex.Message);
        }

        [Fact]
        public async Task HierarchyService_CreateNode_RejectsCreatingSecondCompanyRoot()
        {
            // Arrange
            var options = CreateInMemoryTenantDbOptions();
            var tenantId = Guid.NewGuid();
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(t => t.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(t => t.TenantSchemaName).Returns("aquora_tenant_test");

            var mockUserContext = new Mock<ICurrentUserContext>();
            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockUserContext.Object);

            var hierarchyService = new HierarchyService(context, mockTenantProvider.Object);
            var nodeDto = new HierarchyNodeDto
            {
                Name = "Second Company Ltd",
                Code = "SEC",
                Type = "Company"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => hierarchyService.CreateNodeAsync("company", nodeDto));
            Assert.Contains("exactly one company root", ex.Message);
        }

        [Fact]
        public async Task HierarchyService_DeleteNode_RejectsDeletingCompanyRoot()
        {
            // Arrange
            var options = CreateInMemoryTenantDbOptions();
            var tenantId = Guid.NewGuid();
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(t => t.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(t => t.TenantSchemaName).Returns("aquora_tenant_test");

            var mockUserContext = new Mock<ICurrentUserContext>();
            using var context = new TenantDbContext(options, mockTenantProvider.Object, mockUserContext.Object);

            var hierarchyService = new HierarchyService(context, mockTenantProvider.Object);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => hierarchyService.DeleteNodeAsync(Guid.NewGuid(), "company"));
            Assert.Contains("company root cannot be deleted", ex.Message);
        }

        [Fact]
        public void TenantSchemaResolver_ThrowsWhenContextMissingAtRuntime()
        {
            // Arrange
            TenantSchemaResolver.CurrentSchemaName = null;
            TenantSchemaResolver.IsDesignTime = false;

            // Act & Assert
            var ex = Assert.Throws<InvalidOperationException>(() => TenantSchemaResolver.ResolveRequiredSchema());
            Assert.Contains("Tenant schema context is missing", ex.Message);
        }

        [Fact]
        public void TenantSchemaResolver_ReturnsSchema_WhenContextConfigured()
        {
            // Arrange
            TenantSchemaResolver.CurrentSchemaName = "aquora_tenant_waterworks";

            // Act
            var resolvedSchema = TenantSchemaResolver.ResolveRequiredSchema();

            // Assert
            Assert.Equal("aquora_tenant_waterworks", resolvedSchema);
        }
    }
}
