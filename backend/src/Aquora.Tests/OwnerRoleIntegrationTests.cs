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
using Aquora.Application.DTOs.Employees;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;
using Aquora.Shared.Models;

namespace Aquora.Tests
{
    public class OwnerRoleIntegrationTests
    {
        [Fact]
        public async Task TestA_CreateNormalEmployee_ShouldNotCreateOwnerProfile()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            tenantContext.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Operator", Code = "OPERATOR", TenantId = tenantId });
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId);

            var request = new CreateEmployeeRequest
            {
                FullName = "Bob Operator",
                Username = "bob_operator",
                Email = "bob@example.com",
                RoleCode = "OPERATOR",
                PasswordOrPin = "1234",
                Department = "Operations",
                CurrentSalary = 20000m
            };

            // Act
            var actionResult = await controller.CreateEmployee(request);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(okResult.Value);
            Assert.True(apiResponse.Success);
            Assert.Null(apiResponse.Data!.OwnerId);

            // Ensure NO owner profile exists
            var owners = await tenantContext.Owners.ToListAsync();
            Assert.Empty(owners);
        }

        [Fact]
        public async Task TestB_CreateEmployeeWithOwnerRole_ShouldAtomicallyCreateAndLinkOwnerProfile()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            tenantContext.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Owner", Code = "OWNER", TenantId = tenantId });
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId);

            var request = new CreateEmployeeRequest
            {
                FullName = "Alice Owner",
                Username = "alice_owner",
                Email = "alice@example.com",
                RoleCode = "OWNER",
                PasswordOrPin = "9999",
                Department = "Management",
                CurrentSalary = 75000m,
                Phone = "+91 98765 43210",
                OwnershipPercentage = 45m,
                InitialInvestment = 500000m
            };

            // Act
            var actionResult = await controller.CreateEmployee(request);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(okResult.Value);
            Assert.True(apiResponse.Success);
            Assert.NotNull(apiResponse.Data!.OwnerId);
            Assert.Contains("Owner employee created successfully", apiResponse.Message);

            // Verify database state in TenantDbContext
            var owner = await tenantContext.Owners.FirstOrDefaultAsync(o => o.TenantId == tenantId && o.Email == "alice@example.com");
            Assert.NotNull(owner);
            Assert.Equal("Alice Owner", owner.Name);
            Assert.Equal("+91 98765 43210", owner.Phone);
            Assert.Equal(45m, owner.OwnershipPercentage);
            Assert.Equal(500000m, owner.InitialInvestment);
            Assert.Equal(500000m, owner.CurrentInvestment);
            Assert.Equal(apiResponse.Data.Id, owner.UserId);
        }

        [Fact]
        public async Task TestC_DuplicateOrPreexistingOwner_ShouldReuseAndLinkWithoutDuplicates()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            tenantContext.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Owner", Code = "OWNER", TenantId = tenantId });

            // Pre-seed an existing owner in the finance module with the same email
            var existingOwner = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Pre-existing Owner",
                Email = "existing@example.com",
                Phone = "1112223333",
                OwnershipPercentage = 30m,
                InitialInvestment = 200000m,
                CurrentInvestment = 200000m
            };
            tenantContext.Owners.Add(existingOwner);
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId);

            var request = new CreateEmployeeRequest
            {
                FullName = "Existing Owner User",
                Username = "existing_owner",
                Email = "existing@example.com",
                RoleCode = "OWNER",
                PasswordOrPin = "1234",
                Department = "Finance",
                CurrentSalary = 60000m
            };

            // Act
            var actionResult = await controller.CreateEmployee(request);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(okResult.Value);
            Assert.True(apiResponse.Success);
            Assert.Equal(existingOwner.Id, apiResponse.Data!.OwnerId);

            // Assert no duplicate owner record was created
            var allOwners = await tenantContext.Owners.Where(o => o.TenantId == tenantId).ToListAsync();
            Assert.Single(allOwners);
            Assert.Equal(apiResponse.Data.Id, allOwners[0].UserId);
        }

        [Fact]
        public async Task TestD_ChangeRoleFromOperatorToOwner_ShouldCreateAndLinkOwnerProfile()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var operatorRole = new Role { Id = Guid.NewGuid(), Name = "Operator", Code = "OPERATOR", TenantId = tenantId };
            var ownerRole = new Role { Id = Guid.NewGuid(), Name = "Owner", Code = "OWNER", TenantId = tenantId };
            tenantContext.Roles.AddRange(operatorRole, ownerRole);
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId);

            // 1. Create as Operator
            var createRequest = new CreateEmployeeRequest
            {
                FullName = "Charlie Worker",
                Username = "charlie_worker",
                Email = "charlie@example.com",
                RoleCode = "OPERATOR",
                PasswordOrPin = "1234",
                Department = "Bottling",
                CurrentSalary = 25000m
            };
            var createResult = await controller.CreateEmployee(createRequest);
            var createdEmployee = ((ApiResponse<EmployeeDto>)((OkObjectResult)createResult.Result!).Value!).Data!;

            Assert.Null(createdEmployee.OwnerId);
            Assert.Empty(await tenantContext.Owners.ToListAsync());

            // 2. Update role to OWNER
            var updateRequest = new UpdateEmployeeRequest
            {
                FullName = "Charlie Worker",
                Username = "charlie_worker",
                Email = "charlie@example.com",
                RoleCode = "OWNER",
                Department = "Bottling",
                CurrentSalary = 30000m,
                IsActive = true,
                Phone = "+91 9988776655",
                OwnershipPercentage = 15m,
                InitialInvestment = 150000m
            };

            var updateResult = await controller.UpdateEmployee(createdEmployee.Id, updateRequest);
            var updatedEmployee = ((ApiResponse<EmployeeDto>)((OkObjectResult)updateResult.Result!).Value!).Data!;

            // Assert
            Assert.NotNull(updatedEmployee.OwnerId);
            var owner = await tenantContext.Owners.FirstOrDefaultAsync(o => o.TenantId == tenantId && o.UserId == createdEmployee.Id);
            Assert.NotNull(owner);
            Assert.Equal(15m, owner.OwnershipPercentage);
            Assert.Equal(150000m, owner.InitialInvestment);
        }

        [Fact]
        public async Task TestE_ChangeRoleAwayFromOwner_ShouldPreserveOwnerProfileFinancialData()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var ownerRole = new Role { Id = Guid.NewGuid(), Name = "Owner", Code = "OWNER", TenantId = tenantId };
            var managerRole = new Role { Id = Guid.NewGuid(), Name = "Manager", Code = "MANAGER", TenantId = tenantId };
            tenantContext.Roles.AddRange(ownerRole, managerRole);
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId);

            // 1. Create employee as OWNER with initial investment
            var createRequest = new CreateEmployeeRequest
            {
                FullName = "Diana Partner",
                Username = "diana_partner",
                Email = "diana@example.com",
                RoleCode = "OWNER",
                PasswordOrPin = "1234",
                Department = "Management",
                CurrentSalary = 50000m,
                InitialInvestment = 300000m,
                OwnershipPercentage = 25m
            };
            var createResult = await controller.CreateEmployee(createRequest);
            var createdEmployee = ((ApiResponse<EmployeeDto>)((OkObjectResult)createResult.Result!).Value!).Data!;
            Assert.NotNull(createdEmployee.OwnerId);

            // 2. Change role from OWNER to MANAGER
            var updateRequest = new UpdateEmployeeRequest
            {
                FullName = "Diana Partner",
                Username = "diana_partner",
                Email = "diana@example.com",
                RoleCode = "MANAGER",
                Department = "Management",
                CurrentSalary = 50000m,
                IsActive = true
            };
            var updateResult = await controller.UpdateEmployee(createdEmployee.Id, updateRequest);
            var updatedEmployee = ((ApiResponse<EmployeeDto>)((OkObjectResult)updateResult.Result!).Value!).Data!;

            // Assert: Owner profile was NOT destroyed or deleted; financial ledger stays intact
            var preservedOwner = await tenantContext.Owners.FirstOrDefaultAsync(o => o.Id == createdEmployee.OwnerId);
            Assert.NotNull(preservedOwner);
            Assert.False(preservedOwner.IsDeleted);
            Assert.Equal(300000m, preservedOwner.InitialInvestment);
            Assert.Equal(25m, preservedOwner.OwnershipPercentage);
        }

        [Fact]
        public async Task TestF_MultiTenantSafety_TenantACannotSeeOrLinkTenantBOwners()
        {
            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();

            var (platformContext, tenantContextA) = CreateMockContexts(tenantA);
            var (_, tenantContextB) = CreateMockContexts(tenantB);

            tenantContextA.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Owner", Code = "OWNER", TenantId = tenantA });
            tenantContextB.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Owner", Code = "OWNER", TenantId = tenantB });

            // Create Owner in Tenant B
            var ownerB = new Owner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantB,
                Name = "Tenant B Owner",
                Email = "shared_email@example.com",
                OwnershipPercentage = 50m
            };
            tenantContextB.Owners.Add(ownerB);
            await tenantContextB.SaveChangesAsync();

            // Attempt to create employee in Tenant A with same email
            var controllerA = CreateEmployeesController(platformContext, tenantContextA, tenantA);
            var requestA = new CreateEmployeeRequest
            {
                FullName = "Tenant A Owner",
                Username = "tenant_a_owner",
                Email = "shared_email@example.com",
                RoleCode = "OWNER",
                PasswordOrPin = "1234",
                Department = "Operations",
                CurrentSalary = 40000m
            };

            var actionResult = await controllerA.CreateEmployee(requestA);
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(okResult.Value);

            // Assert Tenant A created its OWN isolated Owner record, and did not adopt Tenant B's owner
            var ownerInTenantA = await tenantContextA.Owners.FirstOrDefaultAsync(o => o.TenantId == tenantA);
            Assert.NotNull(ownerInTenantA);
            Assert.NotEqual(ownerB.Id, ownerInTenantA.Id);
            Assert.Equal(tenantA, ownerInTenantA.TenantId);
        }

        private static (PlatformDbContext platformContext, TenantDbContext tenantContext) CreateMockContexts(Guid tenantId)
        {
            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            var platformContext = new PlatformDbContext(platformOptions);

            var tenantOptions = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            mockCurrentUser.Setup(c => c.Email).Returns("admin@test.com");
            mockCurrentUser.Setup(c => c.Roles).Returns(new List<string> { "CompanyAdmin" });

            var tenantContext = new TenantDbContext(tenantOptions, mockTenantProvider.Object, mockCurrentUser.Object);

            return (platformContext, tenantContext);
        }

        private static EmployeesController CreateEmployeesController(
            PlatformDbContext platformContext,
            TenantDbContext tenantContext,
            Guid tenantId,
            string callerRole = "CompanyAdmin")
        {
            var mockHasher = new Mock<IPasswordHasher>();
            mockHasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("mock_hashed");
            mockHasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>())).Returns(true);

            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var roleResolver = new UserRoleResolver(platformContext, tenantContext);

            var controller = new EmployeesController(
                platformContext,
                tenantContext,
                mockHasher.Object,
                mockTenantProvider.Object,
                roleResolver
            );

            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim("tenant_id", tenantId.ToString()),
                new Claim("email", "admin@testcompany.com"),
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, callerRole)
            }, "mock"));

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };

            return controller;
        }
    }
}
