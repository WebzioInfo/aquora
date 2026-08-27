using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using Aquora.API.Controllers;
using Aquora.Application.DTOs.Employees;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Persistence.Services;
using Aquora.Shared.Constants;
using Aquora.Shared.Models;

namespace Aquora.Tests
{
    public class EmployeeRoleAndAccountantTests
    {
        [Fact]
        public async Task GetRoles_ShouldExcludeAdminAndIncludeAccountant()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            // Seed roles including Admin, CompanyAdmin, Accountant, Manager, Owner
            tenantContext.Roles.AddRange(
                new Role { Id = Guid.NewGuid(), Name = "Admin", Code = "ADMIN", TenantId = tenantId },
                new Role { Id = Guid.NewGuid(), Name = "CompanyAdmin", Code = "COMPANYADMIN", TenantId = tenantId },
                new Role { Id = Guid.NewGuid(), Name = "Manager", Code = "MANAGER", TenantId = tenantId },
                new Role { Id = Guid.NewGuid(), Name = "Owner", Code = "OWNER", TenantId = tenantId }
            );
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            // Act
            var actionResult = await controller.GetRoles();

            // Assert
            var okResult = Assert.IsType<ActionResult<ApiResponse<List<Role>>>>(actionResult);
            var apiResponse = Assert.IsType<ApiResponse<List<Role>>>(((ObjectResult)okResult.Result!).Value);
            Assert.True(apiResponse.Success);
            
            var roles = apiResponse.Data;
            Assert.NotNull(roles);

            // 1. Admin must be excluded
            Assert.DoesNotContain(roles, r => r.Code.Equals("ADMIN", StringComparison.OrdinalIgnoreCase) || r.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase));

            // 2. CompanyAdmin must be present
            Assert.Contains(roles, r => r.Code.Equals("COMPANYADMIN", StringComparison.OrdinalIgnoreCase));

            // 3. Accountant must be present
            Assert.Contains(roles, r => r.Code.Equals("ACCOUNTANT", StringComparison.OrdinalIgnoreCase) || r.Name.Equals("Accountant", StringComparison.OrdinalIgnoreCase));

            // 4. Owner and Manager must remain intact
            Assert.Contains(roles, r => r.Code.Equals("OWNER", StringComparison.OrdinalIgnoreCase));
            Assert.Contains(roles, r => r.Code.Equals("MANAGER", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public async Task CreateEmployee_WithAdminRole_ShouldBeRejected()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            tenantContext.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Admin", Code = "ADMIN", TenantId = tenantId });
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new CreateEmployeeRequest
            {
                FullName = "Admin Impersonator",
                Username = "admin_impersonator",
                Email = "impersonator@test.com",
                RoleCode = "Admin",
                PasswordOrPin = "1234",
                Department = "Operations",
                CurrentSalary = 50000m
            };

            // Act
            var actionResult = await controller.CreateEmployee(request);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(badRequestResult.Value);
            Assert.False(apiResponse.Success);
            Assert.Contains("not permitted to create or assign the system Admin role", apiResponse.Message);
        }

        [Fact]
        public async Task CreateEmployee_WithAdminRoleCode_ShouldBeRejected()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            tenantContext.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Admin", Code = "ADMIN", TenantId = tenantId });
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new CreateEmployeeRequest
            {
                FullName = "Admin Impersonator 2",
                Username = "admin_impersonator_2",
                Email = "impersonator2@test.com",
                RoleCode = "ADMIN",
                PasswordOrPin = "1234",
                Department = "Operations",
                CurrentSalary = 50000m
            };

            // Act
            var actionResult = await controller.CreateEmployee(request);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(badRequestResult.Value);
            Assert.False(apiResponse.Success);
            Assert.Contains("not permitted to create or assign the system Admin role", apiResponse.Message);
        }

        [Fact]
        public async Task UpdateEmployee_WithAdminRole_ShouldBeRejected()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var existingUser = new User
            {
                Id = Guid.NewGuid(),
                Username = "existing_user",
                Email = "existing@test.com",
                FirstName = "Existing",
                LastName = "User",
                PasswordHash = "hash123",
                TenantId = tenantId,
                RoleName = "Operator",
                IsActive = true
            };
            platformContext.Users.Add(existingUser);
            await platformContext.SaveChangesAsync();

            tenantContext.Roles.Add(new Role { Id = Guid.NewGuid(), Name = "Admin", Code = "ADMIN", TenantId = tenantId });
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new UpdateEmployeeRequest
            {
                FullName = "Existing User",
                Username = "existing_user",
                Email = "existing@test.com",
                RoleCode = "ADMIN",
                Department = "Operations",
                CurrentSalary = 45000m,
                IsActive = true
            };

            // Act
            var actionResult = await controller.UpdateEmployee(existingUser.Id, request);

            // Assert
            var badRequestResult = Assert.IsType<BadRequestObjectResult>(actionResult.Result);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(badRequestResult.Value);
            Assert.False(apiResponse.Success);
            Assert.Contains("not permitted to assign the system Admin role", apiResponse.Message);
        }

        [Fact]
        public async Task UpdateEmployee_WithAllFieldsAndNewPin_ShouldUpdateAllFieldsAndPinHash()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var existingUser = new User
            {
                Id = Guid.NewGuid(),
                Username = "old_username",
                Email = "old_email@test.com",
                FirstName = "Old",
                LastName = "Name",
                PasswordHash = "old_pin_hash",
                PinHash = "old_pin_hash",
                TenantId = tenantId,
                RoleName = "Operator",
                Department = "Operations",
                CurrentSalary = 20000m,
                IsActive = true
            };
            platformContext.Users.Add(existingUser);
            await platformContext.SaveChangesAsync();

            var supervisorRole = new Role { Id = Guid.NewGuid(), Name = "Supervisor", Code = "SUPERVISOR", TenantId = tenantId };
            tenantContext.Roles.Add(supervisorRole);
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new UpdateEmployeeRequest
            {
                FullName = "Johnathan NewDoe",
                Username = "john_new",
                Email = "john.new@company.com",
                Pin = "9876",
                RoleCode = "SUPERVISOR",
                Department = "Logistics",
                CurrentSalary = 35000m,
                IsActive = true
            };

            // Act
            var actionResult = await controller.UpdateEmployee(existingUser.Id, request);

            // Assert
            var okResult = Assert.IsType<ActionResult<ApiResponse<EmployeeDto>>>(actionResult);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(((ObjectResult)okResult.Result!).Value);
            Assert.True(apiResponse.Success);
            Assert.Equal("Johnathan NewDoe", apiResponse.Data.FullName);
            Assert.Equal("john_new", apiResponse.Data.Username);
            Assert.Equal("john.new@company.com", apiResponse.Data.Email);
            Assert.Equal("Supervisor", apiResponse.Data.RoleName);
            Assert.Equal("SUPERVISOR", apiResponse.Data.RoleCode);
            Assert.Equal("Logistics", apiResponse.Data.Department);
            Assert.Equal(35000m, apiResponse.Data.CurrentSalary);
            Assert.True(apiResponse.Data.IsActive);

            // Verify persistence in PlatformContext
            var dbUser = await platformContext.Users.FirstAsync(u => u.Id == existingUser.Id);
            Assert.Equal("Johnathan", dbUser.FirstName);
            Assert.Equal("NewDoe", dbUser.LastName);
            Assert.Equal("john_new", dbUser.Username);
            Assert.Equal("john.new@company.com", dbUser.Email);
            Assert.Equal("mock_hashed", dbUser.PinHash);
            Assert.Equal("mock_hashed", dbUser.PasswordHash);
            Assert.Equal("Logistics", dbUser.Department);
            Assert.Equal(35000m, dbUser.CurrentSalary);
        }

        [Fact]
        public async Task UpdateEmployee_WithoutNewPin_ShouldPreserveExistingPinHash()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var existingUser = new User
            {
                Id = Guid.NewGuid(),
                Username = "alice_dev",
                Email = "alice@company.com",
                FirstName = "Alice",
                LastName = "Dev",
                PasswordHash = "original_pin_hash_123",
                PinHash = "original_pin_hash_123",
                TenantId = tenantId,
                RoleName = "Operator",
                Department = "Engineering",
                CurrentSalary = 50000m,
                IsActive = true
            };
            platformContext.Users.Add(existingUser);
            await platformContext.SaveChangesAsync();

            var operatorRole = new Role { Id = Guid.NewGuid(), Name = "Operator", Code = "OPERATOR", TenantId = tenantId };
            tenantContext.Roles.Add(operatorRole);
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new UpdateEmployeeRequest
            {
                FullName = "Alice Dev Updated",
                Username = "alice_dev",
                Email = "alice@company.com",
                Pin = null, // No new PIN provided
                RoleCode = "OPERATOR",
                Department = "Engineering",
                CurrentSalary = 55000m,
                IsActive = false
            };

            // Act
            var actionResult = await controller.UpdateEmployee(existingUser.Id, request);

            // Assert
            var okResult = Assert.IsType<ActionResult<ApiResponse<EmployeeDto>>>(actionResult);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(((ObjectResult)okResult.Result!).Value);
            Assert.True(apiResponse.Success);

            // Verify original PIN hash is preserved unchanged
            var dbUser = await platformContext.Users.FirstAsync(u => u.Id == existingUser.Id);
            Assert.Equal("original_pin_hash_123", dbUser.PinHash);
            Assert.Equal("original_pin_hash_123", dbUser.PasswordHash);
            Assert.False(dbUser.IsActive);
            Assert.Equal(55000m, dbUser.CurrentSalary);
        }

        [Fact]
        public async Task UpdateEmployee_WithDuplicateUsername_ShouldReturnValidationError()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var user1 = new User
            {
                Id = Guid.NewGuid(),
                Username = "taken_username",
                Email = "user1@company.com",
                FirstName = "User",
                LastName = "One",
                PasswordHash = "hash123",
                TenantId = tenantId,
                RoleName = "Operator",
                IsActive = true
            };
            var user2 = new User
            {
                Id = Guid.NewGuid(),
                Username = "user2_username",
                Email = "user2@company.com",
                FirstName = "User",
                LastName = "Two",
                PasswordHash = "hash123",
                TenantId = tenantId,
                RoleName = "Operator",
                IsActive = true
            };
            platformContext.Users.AddRange(user1, user2);
            await platformContext.SaveChangesAsync();

            var operatorRole = new Role { Id = Guid.NewGuid(), Name = "Operator", Code = "OPERATOR", TenantId = tenantId };
            tenantContext.Roles.Add(operatorRole);
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new UpdateEmployeeRequest
            {
                FullName = "User Two Renamed",
                Username = "taken_username", // Duplicate of user1
                Email = "user2_new@company.com",
                RoleCode = "OPERATOR",
                CurrentSalary = 30000m,
                IsActive = true
            };

            // Act
            var actionResult = await controller.UpdateEmployee(user2.Id, request);

            // Assert
            var okResult = Assert.IsType<ActionResult<ApiResponse<EmployeeDto>>>(actionResult);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(((ObjectResult)okResult.Result!).Value);
            Assert.False(apiResponse.Success);
            Assert.Contains("Username is already taken", apiResponse.Message);
        }

        [Fact]
        public async Task UpdateEmployee_WithDuplicateEmail_ShouldReturnValidationError()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var user1 = new User
            {
                Id = Guid.NewGuid(),
                Username = "user1_username",
                Email = "taken_email@company.com",
                FirstName = "User",
                LastName = "One",
                PasswordHash = "hash123",
                TenantId = tenantId,
                RoleName = "Operator",
                IsActive = true
            };
            var user2 = new User
            {
                Id = Guid.NewGuid(),
                Username = "user2_username",
                Email = "user2@company.com",
                FirstName = "User",
                LastName = "Two",
                PasswordHash = "hash123",
                TenantId = tenantId,
                RoleName = "Operator",
                IsActive = true
            };
            platformContext.Users.AddRange(user1, user2);
            await platformContext.SaveChangesAsync();

            var operatorRole = new Role { Id = Guid.NewGuid(), Name = "Operator", Code = "OPERATOR", TenantId = tenantId };
            tenantContext.Roles.Add(operatorRole);
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new UpdateEmployeeRequest
            {
                FullName = "User Two Renamed",
                Username = "user2_unique",
                Email = "taken_email@company.com", // Duplicate of user1
                RoleCode = "OPERATOR",
                CurrentSalary = 30000m,
                IsActive = true
            };

            // Act
            var actionResult = await controller.UpdateEmployee(user2.Id, request);

            // Assert
            var okResult = Assert.IsType<ActionResult<ApiResponse<EmployeeDto>>>(actionResult);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(((ObjectResult)okResult.Result!).Value);
            Assert.False(apiResponse.Success);
            Assert.Contains("Email is already registered", apiResponse.Message);
        }

        [Fact]
        public async Task CreateEmployee_WithAccountantRole_ShouldSucceedAndAssignAccountantRole()
        {
            var tenantId = Guid.NewGuid();
            var (platformContext, tenantContext) = CreateMockContexts(tenantId);

            var companyAdminRole = new Role { Id = Guid.NewGuid(), Name = "CompanyAdmin", Code = "COMPANYADMIN", TenantId = tenantId };
            tenantContext.Roles.Add(companyAdminRole);

            var perm1 = new Permission { Id = Guid.NewGuid(), Name = "Users Read", Code = "Permissions.Users.Read" };
            var perm2 = new Permission { Id = Guid.NewGuid(), Name = "Users Write", Code = "Permissions.Users.Write" };
            tenantContext.Permissions.AddRange(perm1, perm2);
            tenantContext.RolePermissions.AddRange(
                new RolePermission { RoleId = companyAdminRole.Id, PermissionId = perm1.Id, TenantId = tenantId },
                new RolePermission { RoleId = companyAdminRole.Id, PermissionId = perm2.Id, TenantId = tenantId }
            );
            await tenantContext.SaveChangesAsync();

            var controller = CreateEmployeesController(platformContext, tenantContext, tenantId, "CompanyAdmin");

            var request = new CreateEmployeeRequest
            {
                FullName = "Alice Accountant",
                Username = "alice_accountant",
                Email = "alice@testcompany.com",
                RoleCode = "ACCOUNTANT",
                PasswordOrPin = "1234",
                Department = "Finance",
                CurrentSalary = 65000m
            };

            // Act
            var actionResult = await controller.CreateEmployee(request);

            // Assert
            var okResult = Assert.IsType<ActionResult<ApiResponse<EmployeeDto>>>(actionResult);
            var apiResponse = Assert.IsType<ApiResponse<EmployeeDto>>(((ObjectResult)okResult.Result!).Value);
            Assert.True(apiResponse.Success);
            Assert.Equal("Accountant", apiResponse.Data.RoleName);
            Assert.Equal("ACCOUNTANT", apiResponse.Data.RoleCode);

            // Verify Accountant role inherited CompanyAdmin permissions
            var accountantRole = await tenantContext.Roles.FirstOrDefaultAsync(r => r.Code == "ACCOUNTANT");
            Assert.NotNull(accountantRole);

            var accountantPerms = await tenantContext.RolePermissions
                .Where(rp => rp.RoleId == accountantRole.Id)
                .Select(rp => rp.PermissionId)
                .ToListAsync();

            var adminPerms = await tenantContext.RolePermissions
                .Where(rp => rp.RoleId == companyAdminRole.Id)
                .Select(rp => rp.PermissionId)
                .ToListAsync();

            Assert.Equal(adminPerms.OrderBy(x => x), accountantPerms.OrderBy(x => x));
        }

        [Fact]
        public async Task TenantDatabaseService_Seeding_ShouldGrantAccountantExactSamePermissionsAsCompanyAdmin()
        {
            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var tenantId = Guid.NewGuid();
            var mockTenantProvider = new Mock<ITenantProvider>();
            mockTenantProvider.Setup(p => p.TenantId).Returns(tenantId);
            mockTenantProvider.Setup(p => p.TenantSchemaName).Returns("tenant_test");

            var mockCurrentUser = new Mock<ICurrentUserContext>();
            mockCurrentUser.Setup(c => c.TenantId).Returns(tenantId);
            mockCurrentUser.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            mockCurrentUser.Setup(c => c.Email).Returns("admin@test.com");
            mockCurrentUser.Setup(c => c.Roles).Returns(new List<string> { "CompanyAdmin" });

            using var tenantContext = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUser.Object);

            var platformOptions = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            using var platformContext = new PlatformDbContext(platformOptions);

            var mockScopeFactory = new Mock<IServiceScopeFactory>();
            var mockScope = new Mock<IServiceScope>();
            var mockServiceProvider = new Mock<IServiceProvider>();

            mockServiceProvider.Setup(sp => sp.GetService(typeof(TenantDbContext))).Returns(tenantContext);
            mockServiceProvider.Setup(sp => sp.GetService(typeof(ITenantDbContext))).Returns(tenantContext);
            mockServiceProvider.Setup(sp => sp.GetService(typeof(ITenantProvider))).Returns(mockTenantProvider.Object);
            mockScope.Setup(s => s.ServiceProvider).Returns(mockServiceProvider.Object);
            mockScopeFactory.Setup(sf => sf.CreateScope()).Returns(mockScope.Object);

            var service = new TenantDatabaseService(
                platformContext,
                mockScopeFactory.Object
            );

            // Act: Provision tenant
            var ownerUserId = Guid.NewGuid();
            var result = await service.ProvisionTenantAsync(tenantId, "tenant_test", "Test Company", "TEST", ownerUserId);

            // Assert
            Assert.NotNull(result);

            var companyAdminRole = await tenantContext.Roles.FirstOrDefaultAsync(r => r.Code == "COMPANYADMIN");
            var accountantRole = await tenantContext.Roles.FirstOrDefaultAsync(r => r.Code == "ACCOUNTANT");

            Assert.NotNull(companyAdminRole);
            Assert.NotNull(accountantRole);

            var compAdminPermIds = await tenantContext.RolePermissions
                .Where(rp => rp.RoleId == companyAdminRole.Id)
                .Select(rp => rp.PermissionId)
                .OrderBy(x => x)
                .ToListAsync();

            var accountantPermIds = await tenantContext.RolePermissions
                .Where(rp => rp.RoleId == accountantRole.Id)
                .Select(rp => rp.PermissionId)
                .OrderBy(x => x)
                .ToListAsync();

            Assert.NotEmpty(compAdminPermIds);
            Assert.Equal(compAdminPermIds, accountantPermIds);
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
