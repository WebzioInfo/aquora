using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class OnboardingServiceTests
    {
        [Fact]
        public async Task OnboardCompanyAsync_ShouldAssignTenantIdAndGenerateTokens()
        {
            // Arrange
            var options = new DbContextOptionsBuilder<PlatformDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "owner@testcompany.com",
                FirstName = "Test",
                LastName = "Owner",
                PasswordHash = "hashed_pwd",
                EmailVerified = true,
                TokenVersion = 0
            };

            using var platformContext = new PlatformDbContext(options);
            platformContext.Users.Add(user);
            await platformContext.SaveChangesAsync();

            var tenantId = Guid.NewGuid();
            var mockTenantDbService = new Mock<ITenantDatabaseService>();
            mockTenantDbService.Setup(s => s.ProvisionTenantAsync(
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid>()
            )).ReturnsAsync(new TenantProvisioningResult
            {
                CompanyId = Guid.NewGuid(),
                OwnerRoleId = Guid.NewGuid(),
                OwnerRoleName = "CompanyAdmin"
            });

            var mockTokenService = new Mock<ITokenService>();
            mockTokenService.Setup(t => t.GenerateAccessToken(
                It.IsAny<User>(),
                It.IsAny<IEnumerable<string>>(),
                It.IsAny<IEnumerable<string>>()
            )).Returns("mock-access-token");

            mockTokenService.Setup(t => t.GenerateRefreshToken())
                .Returns("mock-refresh-token");

            // Mock scope factory
            var mockScopeFactory = new Mock<IServiceScopeFactory>();
            var mockScope = new Mock<IServiceScope>();
            var mockServiceProvider = new Mock<IServiceProvider>();

            var mockTenantProvider = new Mock<ITenantProvider>();
            var mockTenantDbContext = new Mock<ITenantDbContext>();

            // Setup mock lists to prevent EF Core query exceptions in GetUserRolesAndPermissionsAsync
            var mockUserRoles = new List<UserRole>
            {
                new UserRole
                {
                    UserId = user.Id,
                    RoleId = Guid.NewGuid(),
                    Role = new Role { Name = "CompanyAdmin", Code = "COMPANYADMIN" }
                }
            };

            // Using mock setups for dependency resolution inside scope
            mockServiceProvider.Setup(sp => sp.GetService(typeof(ITenantProvider))).Returns(mockTenantProvider.Object);
            mockServiceProvider.Setup(sp => sp.GetService(typeof(ITenantDbContext))).Returns(mockTenantDbContext.Object);

            var userRoleDbSetMock = CreateMockDbSet(mockUserRoles);
            mockTenantDbContext.Setup(db => db.UserRoles).Returns(userRoleDbSetMock.Object);
            mockTenantDbContext.Setup(db => db.RolePermissions).Returns(CreateMockDbSet(new List<RolePermission>()).Object);

            mockScope.Setup(s => s.ServiceProvider).Returns(mockServiceProvider.Object);
            mockScopeFactory.Setup(sf => sf.CreateScope()).Returns(mockScope.Object);

            var mockSchemaNameGenerator = new Mock<ISchemaNameGenerator>();
            mockSchemaNameGenerator
                .Setup(x => x.GenerateSchemaNameAsync(It.IsAny<string>()))
                .ReturnsAsync((string name) => "aquora_tenant_" + name.Replace(" ", "_").ToLower());

            var mockQueue = new Mock<ITenantProvisioningQueue>();

            var service = new CompanyOnboardingService(
                platformContext,
                mockTenantDbService.Object,
                mockTokenService.Object,
                mockScopeFactory.Object,
                mockSchemaNameGenerator.Object,
                mockQueue.Object
            );

            var request = new CompanyOnboardingRequest
            {
                CompanyName = "Test Company LLC",
                EmployeeCount = 10,
                HowDidYouHearAboutUs = "Google Search"
            };

            // Act
            var result = await service.OnboardCompanyAsync(user.Id, request);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Provisioning", result.ProvisioningStatus);
            Assert.Equal("mock-access-token", result.AccessToken);
            Assert.Equal("mock-refresh-token", result.RefreshToken);
            Assert.True(result.OwnerRole == "Owner" || result.OwnerRole == "CompanyAdmin");
            
            // Verify user was updated with the tenant ID
            var updatedUser = await platformContext.Users.FindAsync(user.Id);
            Assert.NotNull(updatedUser);
            Assert.NotNull(updatedUser.TenantId);
        }

        private static Mock<DbSet<T>> CreateMockDbSet<T>(List<T> elements) where T : class
        {
            var queryable = elements.AsQueryable();
            var dbSetMock = new Mock<DbSet<T>>();
            dbSetMock.As<IQueryable<T>>().Setup(m => m.Provider).Returns(queryable.Provider);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.Expression).Returns(queryable.Expression);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.ElementType).Returns(queryable.ElementType);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.GetEnumerator()).Returns(queryable.GetEnumerator());
            return dbSetMock;
        }
    }
}
