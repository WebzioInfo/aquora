using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class ExpenseCategoryTests
    {
        private (TenantDbContext Context, SimpleAccountsService Service, Guid TenantId, Guid CompanyId) CreateTestService(Guid? specificTenantId = null)
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

            var mockDateTimeProvider = new Mock<IDateTimeProvider>();
            mockDateTimeProvider.Setup(x => x.UtcNow).Returns(DateTime.UtcNow);

            var context = new TenantDbContext(options, mockTenantProvider.Object, mockCurrentUserContext.Object, mockDateTimeProvider.Object);

            // Add default company
            var company = new Company
            {
                Id = companyId,
                TenantId = tenantId,
                Name = "Test Company",
                Code = "CMP"
            };
            context.Companies.Add(company);
            context.SaveChanges();

            var mockPlatformContext = new Mock<IPlatformDbContext>();
            var mockLedgerService = new Mock<ILedgerService>();

            var service = new SimpleAccountsService(
                context,
                mockPlatformContext.Object,
                mockTenantProvider.Object,
                mockCurrentUserContext.Object,
                mockLedgerService.Object
            );

            return (context, service, tenantId, companyId);
        }

        [Fact]
        public async Task Test_GetExpenseCategories_AutoSeedsDefaultCategories()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Act: call GetExpenseCategoriesAsync when none exist
            var categories = await service.GetExpenseCategoriesAsync();

            // Assert: Default categories should be seeded and returned
            Assert.NotEmpty(categories);
            Assert.Contains(categories, c => c.Name == "Salary");
            Assert.Contains(categories, c => c.Name == "Electricity");
            Assert.Contains(categories, c => c.Name == "Fuel");
            Assert.Contains(categories, c => c.Name == "Maintenance");
            Assert.Contains(categories, c => c.Name == "Vehicle");
            Assert.Contains(categories, c => c.Name == "Rent");
            Assert.Contains(categories, c => c.Name == "Infrastructure");
            Assert.Contains(categories, c => c.Name == "Purchase Related");
            Assert.Contains(categories, c => c.Name == "Stationary");
            Assert.Contains(categories, c => c.Name == "Tax");
            Assert.Contains(categories, c => c.Name == "Miscellaneous");

            // Database should have persisted them
            var inDb = await context.ExpenseCategories.Where(c => c.TenantId == tenantId && !c.IsDeleted).ToListAsync();
            Assert.Equal(categories.Count, inDb.Count);
        }

        [Fact]
        public async Task Test_CreateExpenseCategory_PersistsRealDatabaseRecord()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Act: Create new category "Vehicle Maintenance"
            var req = new CreateExpenseCategoryRequest { Name = "Vehicle Maintenance" };
            var result = await service.CreateExpenseCategoryAsync(req);

            // Assert
            Assert.NotNull(result);
            Assert.NotEqual(Guid.Empty, result.Id);
            Assert.Equal("Vehicle Maintenance", result.Name);
            Assert.True(result.IsActive);

            // Verify in database
            var dbCategory = await context.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == result.Id);
            Assert.NotNull(dbCategory);
            Assert.Equal("Vehicle Maintenance", dbCategory.Name);
            Assert.Equal(tenantId, dbCategory.TenantId);
        }

        [Fact]
        public async Task Test_CreateExpenseCategory_RejectsDuplicates()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Create initial
            await service.CreateExpenseCategoryAsync(new CreateExpenseCategoryRequest { Name = "Vehicle Maintenance" });

            // Attempt duplicate with leading/trailing spaces and different casing
            var duplicateReq = new CreateExpenseCategoryRequest { Name = "  vehicle maintenance  " };

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.CreateExpenseCategoryAsync(duplicateReq));

            Assert.Contains("already exists", ex.Message);
        }

        [Fact]
        public async Task Test_CreateExpenseCategory_ReactivatesSoftDeleted()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Create category
            var created = await service.CreateExpenseCategoryAsync(new CreateExpenseCategoryRequest { Name = "Consulting" });
            
            // Delete it
            await service.DeleteExpenseCategoryAsync(created.Id);

            // Re-create with same name
            var recreated = await service.CreateExpenseCategoryAsync(new CreateExpenseCategoryRequest { Name = "consulting" });

            Assert.Equal(created.Id, recreated.Id);
            Assert.True(recreated.IsActive);
        }

        [Fact]
        public async Task Test_DeleteExpenseCategory_DeactivatesIfHistoricalExpensesExist()
        {
            var (context, service, tenantId, companyId) = CreateTestService();

            // Create category
            var cat = await service.CreateExpenseCategoryAsync(new CreateExpenseCategoryRequest { Name = "Travel" });

            // Create expense with this category
            var expense = new SimpleExpense
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                ExpenseNumber = "EXP-001",
                ExpenseDate = DateTime.UtcNow,
                Category = "Travel",
                Description = "Flight tickets",
                Amount = 12000m,
                PaymentMethod = "Cash",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "user"
            };
            context.SimpleExpenses.Add(expense);
            await context.SaveChangesAsync();

            // Delete category
            var deleted = await service.DeleteExpenseCategoryAsync(cat.Id);
            Assert.True(deleted);

            // Category should NOT be deleted from DB, but deactivated to protect historical records
            var dbCat = await context.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == cat.Id);
            Assert.NotNull(dbCat);
            Assert.False(dbCat.IsDeleted);
            Assert.False(dbCat.IsActive);

            // Historical expense still intact
            var dbExpense = await context.SimpleExpenses.FirstOrDefaultAsync(e => e.Id == expense.Id);
            Assert.NotNull(dbExpense);
            Assert.Equal("Travel", dbExpense.Category);
        }

        [Fact]
        public async Task Test_MultiTenant_Isolation()
        {
            var tenantAId = Guid.NewGuid();
            var tenantBId = Guid.NewGuid();

            var (contextA, serviceA, _, _) = CreateTestService(tenantAId);
            var (contextB, serviceB, _, _) = CreateTestService(tenantBId);

            // Tenant A creates custom category
            await serviceA.CreateExpenseCategoryAsync(new CreateExpenseCategoryRequest { Name = "Tenant A Special" });

            // Tenant B fetches categories
            var categoriesB = await serviceB.GetExpenseCategoriesAsync();

            // Tenant B must not see Tenant A's category
            Assert.DoesNotContain(categoriesB, c => c.Name == "Tenant A Special");
        }
    }
}
