using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.API.Controllers;
using Aquora.Application.DTOs.Public;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;
using Aquora.Shared.Models;

namespace Aquora.Tests
{
    public class BiodropsProductionFeatureTests
    {
        private PlatformDbContext CreateInMemoryPlatformContext()
        {
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            return new PlatformDbContext(options);
        }

        #region 1. Database & Entity Default Tests

        [Fact]
        public void TenantEntity_DefaultIsBiodropsProduction_ShouldBeFalse()
        {
            var tenant = new Tenant();
            Assert.False(tenant.IsBiodropsProduction, "Tenant.IsBiodropsProduction must default to false.");
        }

        [Fact]
        public void CompanyEntity_DefaultIsBiodropsProduction_ShouldBeFalse()
        {
            var company = new Company();
            Assert.False(company.IsBiodropsProduction, "Company.IsBiodropsProduction must default to false.");
        }

        [Fact]
        public async Task Database_ExistingTenants_DefaultToFalse()
        {
            using var db = CreateInMemoryPlatformContext();

            var tenant1 = new Tenant { Id = Guid.NewGuid(), Name = "Existing Factory 1", Code = "FAC1", SchemaName = "tenant_fac1", Subdomain = "fac1", IsActive = true, CreatedBy = "System" };
            var tenant2 = new Tenant { Id = Guid.NewGuid(), Name = "Existing Factory 2", Code = "FAC2", SchemaName = "tenant_fac2", Subdomain = "fac2", IsActive = true, CreatedBy = "System" };

            db.Tenants.AddRange(tenant1, tenant2);
            await db.SaveChangesAsync();

            var retrieved = await db.Tenants.ToListAsync();
            Assert.All(retrieved, t => Assert.False(t.IsBiodropsProduction));
        }

        #endregion

        #region 2. Update API & Partial Update Tests

        [Fact]
        public async Task UpdateTenantAsync_ToggleOnAndOff_WorksCorrectly()
        {
            using var db = CreateInMemoryPlatformContext();
            var tenantId = Guid.NewGuid();
            var tenant = new Tenant { Id = tenantId, Name = "Test Bottler", Code = "BOTTLER", SchemaName = "tenant_bottler", Subdomain = "bottler", IsActive = true, IsBiodropsProduction = false, CreatedBy = "System" };
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();

            var mockPasswordHasher = new Mock<IPasswordHasher>();
            var mockTenantDbService = new Mock<ITenantDatabaseService>();
            var mockSchemaGenerator = new Mock<ISchemaNameGenerator>();
            var mockRoleResolver = new Mock<IUserRoleResolver>();

            var service = new PlatformManagementService(
                db,
                mockPasswordHasher.Object,
                mockTenantDbService.Object,
                mockSchemaGenerator.Object,
                mockRoleResolver.Object);

            // Turn ON
            var updateOnReq = new UpdateTenantRequest
            {
                CompanyName = "Test Bottler",
                Subdomain = "bottler",
                IsBiodropsProduction = true
            };
            var resultOn = await service.UpdateTenantAsync(tenantId, updateOnReq, "admin-1", "127.0.0.1");
            Assert.True(resultOn);

            var updatedTenantOn = await db.Tenants.FindAsync(tenantId);
            Assert.NotNull(updatedTenantOn);
            Assert.True(updatedTenantOn.IsBiodropsProduction);

            // Turn OFF
            var updateOffReq = new UpdateTenantRequest
            {
                CompanyName = "Test Bottler",
                Subdomain = "bottler",
                IsBiodropsProduction = false
            };
            var resultOff = await service.UpdateTenantAsync(tenantId, updateOffReq, "admin-1", "127.0.0.1");
            Assert.True(resultOff);

            var updatedTenantOff = await db.Tenants.FindAsync(tenantId);
            Assert.NotNull(updatedTenantOff);
            Assert.False(updatedTenantOff.IsBiodropsProduction);
        }

        [Fact]
        public async Task UpdateTenantAsync_OmittedField_PreservesExistingValue()
        {
            using var db = CreateInMemoryPlatformContext();
            var tenantId = Guid.NewGuid();
            var tenant = new Tenant
            {
                Id = tenantId,
                Name = "BioDrops Manufacturer",
                Code = "BDMAN",
                SchemaName = "tenant_bdman",
                Subdomain = "bdman",
                IsActive = true,
                IsBiodropsProduction = true, // Enabled
                CreatedBy = "System"
            };
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();

            var mockPasswordHasher = new Mock<IPasswordHasher>();
            var mockTenantDbService = new Mock<ITenantDatabaseService>();
            var mockSchemaGenerator = new Mock<ISchemaNameGenerator>();
            var mockRoleResolver = new Mock<IUserRoleResolver>();

            var service = new PlatformManagementService(
                db,
                mockPasswordHasher.Object,
                mockTenantDbService.Object,
                mockSchemaGenerator.Object,
                mockRoleResolver.Object);

            // Perform unrelated update where IsBiodropsProduction is null (omitted)
            var updateUnrelatedReq = new UpdateTenantRequest
            {
                CompanyName = "Updated BioDrops Manufacturer Name",
                Subdomain = "bdman",
                OwnerEmail = "newemail@bdman.com",
                IsBiodropsProduction = null // Omitted
            };

            await service.UpdateTenantAsync(tenantId, updateUnrelatedReq, "admin-1", "127.0.0.1");

            var updatedTenant = await db.Tenants.FindAsync(tenantId);
            Assert.NotNull(updatedTenant);
            Assert.Equal("Updated BioDrops Manufacturer Name", updatedTenant.Name);
            Assert.True(updatedTenant.IsBiodropsProduction); // Must remain true!
        }

        [Fact]
        public async Task UpdateTenantAsync_SequentialTogglesAcrossMultipleTenants_SucceedWithoutConflict()
        {
            using var db = CreateInMemoryPlatformContext();

            var tenantA = new Tenant { Id = Guid.NewGuid(), Name = "Bottler Alpha", Code = "ALPHA", SchemaName = "tenant_alpha", Subdomain = "alpha", IsActive = true, IsBiodropsProduction = false, CreatedBy = "System" };
            var tenantB = new Tenant { Id = Guid.NewGuid(), Name = "Bottler Beta", Code = "BETA", SchemaName = "tenant_beta", Subdomain = "beta", IsActive = true, IsBiodropsProduction = false, CreatedBy = "System" };
            var tenantC = new Tenant { Id = Guid.NewGuid(), Name = "Bottler Gamma", Code = "GAMMA", SchemaName = "tenant_gamma", Subdomain = "gamma", IsActive = true, IsBiodropsProduction = false, CreatedBy = "System" };

            db.Tenants.AddRange(tenantA, tenantB, tenantC);
            await db.SaveChangesAsync();

            var mockPasswordHasher = new Mock<IPasswordHasher>();
            var mockTenantDbService = new Mock<ITenantDatabaseService>();
            var mockSchemaGenerator = new Mock<ISchemaNameGenerator>();
            var mockRoleResolver = new Mock<IUserRoleResolver>();

            var service = new PlatformManagementService(
                db,
                mockPasswordHasher.Object,
                mockTenantDbService.Object,
                mockSchemaGenerator.Object,
                mockRoleResolver.Object);

            // Toggle Tenant A: OFF -> ON
            var resA = await service.UpdateTenantAsync(tenantA.Id, new UpdateTenantRequest { IsBiodropsProduction = true }, "admin-1", "127.0.0.1");
            Assert.True(resA);

            // Verify Tenant A name and subdomain were NOT wiped or set to empty string!
            var checkA = await db.Tenants.FindAsync(tenantA.Id);
            Assert.NotNull(checkA);
            Assert.Equal("Bottler Alpha", checkA.Name);
            Assert.Equal("alpha", checkA.Subdomain);
            Assert.True(checkA.IsBiodropsProduction);

            // Immediately toggle Tenant B: OFF -> ON (Must NOT throw 409 Conflict!)
            var resB = await service.UpdateTenantAsync(tenantB.Id, new UpdateTenantRequest { IsBiodropsProduction = true }, "admin-1", "127.0.0.1");
            Assert.True(resB);

            var checkB = await db.Tenants.FindAsync(tenantB.Id);
            Assert.NotNull(checkB);
            Assert.Equal("Bottler Beta", checkB.Name);
            Assert.Equal("beta", checkB.Subdomain);
            Assert.True(checkB.IsBiodropsProduction);

            // Immediately toggle Tenant C: OFF -> ON (Must NOT throw 409 Conflict!)
            var resC = await service.UpdateTenantAsync(tenantC.Id, new UpdateTenantRequest { IsBiodropsProduction = true }, "admin-1", "127.0.0.1");
            Assert.True(resC);

            var checkC = await db.Tenants.FindAsync(tenantC.Id);
            Assert.NotNull(checkC);
            Assert.Equal("Bottler Gamma", checkC.Name);
            Assert.Equal("gamma", checkC.Subdomain);
            Assert.True(checkC.IsBiodropsProduction);
        }

        #endregion

        #region 3. Public API Endpoint Tests

        [Fact]
        public async Task GetPublicManufacturers_ReturnsOnlyEnabledCompanies()
        {
            using var db = CreateInMemoryPlatformContext();

            var enabledCompany1 = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = "Pure Drop Water Co",
                Code = "PURE",
                Subdomain = "puredrop",
                SchemaName = "tenant_puredrop",
                IsActive = true,
                IsBiodropsProduction = true,
                OwnerEmail = "contact@puredrop.com",
                OwnerPhone = "+1234567890",
                Address = "123 Spring St",
                CreatedBy = "System"
            };

            var enabledCompany2 = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = "Aqua Life Bottlers",
                Code = "AQUA",
                Subdomain = "aqualife",
                SchemaName = "tenant_aqualife",
                IsActive = true,
                IsBiodropsProduction = true,
                CreatedBy = "System"
            };

            var disabledCompany = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = "Private Industrial Water",
                Code = "PRIV",
                Subdomain = "private",
                SchemaName = "tenant_private",
                IsActive = true,
                IsBiodropsProduction = false,
                CreatedBy = "System"
            };

            db.Tenants.AddRange(enabledCompany1, enabledCompany2, disabledCompany);
            await db.SaveChangesAsync();

            var controller = new PublicManufacturerController(db);
            var result = await controller.GetPublicManufacturers();

            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var apiResponse = Assert.IsType<ApiResponse<PagedResult<PublicManufacturerDto>>>(okResult.Value);

            Assert.True(apiResponse.Success);
            Assert.NotNull(apiResponse.Data);
            Assert.Equal(2, apiResponse.Data.TotalCount);
            Assert.All(apiResponse.Data.Items, m => Assert.True(m.IsBiodropsProduction));
            Assert.DoesNotContain(apiResponse.Data.Items, m => m.Id == disabledCompany.Id);
        }

        [Fact]
        public async Task GetPublicManufacturerById_EnabledCompany_ReturnsDetails()
        {
            using var db = CreateInMemoryPlatformContext();

            var tenantId = Guid.NewGuid();
            var company = new Tenant
            {
                Id = tenantId,
                Name = "Himalayan Mineral Water",
                Code = "HIMALAYA",
                Subdomain = "himalaya",
                SchemaName = "tenant_himalaya",
                IsActive = true,
                IsBiodropsProduction = true,
                OwnerEmail = "info@himalaya.com",
                OwnerPhone = "+91 9876543210",
                LicenseNumber = "BIS-123456",
                GstNumber = "27AAAAA0000A1Z5",
                Address = "Himalayan Foothills Plant",
                CreatedBy = "System"
            };

            db.Tenants.Add(company);
            await db.SaveChangesAsync();

            var controller = new PublicManufacturerController(db);
            var result = await controller.GetPublicManufacturerById(tenantId);

            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var apiResponse = Assert.IsType<ApiResponse<PublicManufacturerDto>>(okResult.Value);

            Assert.True(apiResponse.Success);
            Assert.NotNull(apiResponse.Data);
            Assert.Equal(tenantId, apiResponse.Data.Id);
            Assert.Equal("Himalayan Mineral Water", apiResponse.Data.Name);
            Assert.Equal("info@himalaya.com", apiResponse.Data.Email);
            Assert.Equal("BIS-123456", apiResponse.Data.LicenseNumber);
        }

        [Fact]
        public async Task GetPublicManufacturerById_DisabledCompany_ReturnsNotFound()
        {
            using var db = CreateInMemoryPlatformContext();

            var tenantId = Guid.NewGuid();
            var disabledCompany = new Tenant
            {
                Id = tenantId,
                Name = "Disabled Factory",
                Code = "DIS",
                Subdomain = "disabled",
                SchemaName = "tenant_disabled",
                IsActive = true,
                IsBiodropsProduction = false, // Disabled
                CreatedBy = "System"
            };

            db.Tenants.Add(disabledCompany);
            await db.SaveChangesAsync();

            var controller = new PublicManufacturerController(db);
            var result = await controller.GetPublicManufacturerById(tenantId);

            var objectResult = Assert.IsType<ObjectResult>(result.Result);
            Assert.Equal(404, objectResult.StatusCode);
            var apiResponse = Assert.IsType<ApiResponse<PublicManufacturerDto>>(objectResult.Value);

            Assert.False(apiResponse.Success);
            Assert.Equal("Not Found", apiResponse.Message);
        }

        [Fact]
        public async Task GetPublicManufacturers_EmptyList_ReturnsSuccessWithZeroItems()
        {
            using var db = CreateInMemoryPlatformContext();

            var controller = new PublicManufacturerController(db);
            var result = await controller.GetPublicManufacturers();

            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var apiResponse = Assert.IsType<ApiResponse<PagedResult<PublicManufacturerDto>>>(okResult.Value);

            Assert.True(apiResponse.Success);
            Assert.NotNull(apiResponse.Data);
            Assert.Equal(0, apiResponse.Data.TotalCount);
            Assert.Empty(apiResponse.Data.Items);
        }

        #endregion

        #region 4. Authorization & Security Tests

        [Fact]
        public async Task NonPlatformAdmin_AttemptToUpdate_Forbidden()
        {
            // Verify PlatformController authorization logic for IsSuperAdmin()
            var httpContext = new DefaultHttpContext();
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, "TenantUser") // Normal tenant user
            };
            var identity = new ClaimsIdentity(claims, "TestAuthType");
            httpContext.User = new ClaimsPrincipal(identity);

            var mockPlatformService = new Mock<IPlatformManagementService>();
            var controller = new PlatformController(mockPlatformService.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = httpContext }
            };

            // Call UpdateTenant as a non-superadmin
            var actionResult = await controller.UpdateTenant(Guid.NewGuid(), new UpdateTenantRequest { CompanyName = "Unauthorized Change", Subdomain = "test" });

            var objectResult = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(403, objectResult.StatusCode);
        }

        #endregion
    }
}
