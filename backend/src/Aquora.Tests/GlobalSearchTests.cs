using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Aquora.Application.DTOs.Search;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Domain.Entities.QC;
using Aquora.Persistence.Context;

namespace Aquora.Tests
{
    public class GlobalSearchTests
    {
        private class TestTenantProvider : ITenantProvider
        {
            public Guid TenantId { get; set; } = Guid.NewGuid();
            public string TenantSchemaName { get; set; } = "public";
            public void SetTenantId(Guid tenantId) => TenantId = tenantId;
            public void SetTenantSchemaName(string schemaName) => TenantSchemaName = schemaName;
        }

        private class TestCurrentUserContext : ICurrentUserContext
        {
            public string? UserId { get; set; } = Guid.NewGuid().ToString();
            public string? Email { get; set; } = "admin@aquzio.test";
            public Guid TenantId { get; set; } = Guid.NewGuid();
            public IEnumerable<string> Roles { get; set; } = new List<string> { "CompanyAdmin", "Admin" };
            public IEnumerable<string> Permissions { get; set; } = new List<string> { "*" };
            public string IpAddress { get; set; } = "127.0.0.1";
            public string UserAgent { get; set; } = "TestRunner";
            public string? Reason { get; set; } = null;
            public string Module { get; set; } = "Search";
            public bool IsAuthenticated { get; set; } = true;
            public bool HasPermission(string permission) => true;
        }

        private (TenantDbContext context, TestCurrentUserContext userCtx, TestTenantProvider tenantProvider) CreateTestContext()
        {
            var options = new DbContextOptionsBuilder<TenantDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            var tenantProvider = new TestTenantProvider();
            var userCtx = new TestCurrentUserContext
            {
                TenantId = tenantProvider.TenantId
            };

            var context = new TenantDbContext(options, tenantProvider, userCtx);
            return (context, userCtx, tenantProvider);
        }

        [Fact]
        public async Task Search_EmptyQuery_Returns_Navigation_And_Actions()
        {
            var (context, userCtx, _) = CreateTestContext();
            var service = new GlobalSearchService(context, userCtx, NullLogger<GlobalSearchService>.Instance);

            var result = await service.SearchAsync(new GlobalSearchRequestDto { Query = "" });

            Assert.NotNull(result);
            Assert.True(result.Groups.Any(g => g.Type == "navigation"));
            Assert.True(result.Groups.Any(g => g.Type == "actions"));
        }

        [Fact]
        public async Task Search_ByCustomerName_And_Phone_Returns_CustomerGroup()
        {
            var (context, userCtx, tenantProvider) = CreateTestContext();
            var tenantId = tenantProvider.TenantId;
            var companyId = Guid.NewGuid();

            var customer = new Customer
            {
                TenantId = tenantId,
                CompanyId = companyId,
                CustomerCode = "CUST-1001",
                CustomerName = "Ramesh Hypermarket",
                Phone = "9876543210",
                City = "Kochi",
                AddressLine1 = "Marine Drive",
                CustomerType = "Commercial"
            };
            context.Customers.Add(customer);
            await context.SaveChangesAsync();

            var service = new GlobalSearchService(context, userCtx, NullLogger<GlobalSearchService>.Instance);

            // Search by Name
            var nameResult = await service.SearchAsync(new GlobalSearchRequestDto { Query = "Ramesh" });
            Assert.True(nameResult.TotalMatches > 0);
            var custGroup = nameResult.Groups.FirstOrDefault(g => g.Type == "customers");
            Assert.NotNull(custGroup);
            Assert.Contains(custGroup.Results, r => r.Title == "Ramesh Hypermarket");

            // Search by Phone
            var phoneResult = await service.SearchAsync(new GlobalSearchRequestDto { Query = "9876543210" });
            var phoneGroup = phoneResult.Groups.FirstOrDefault(g => g.Type == "customers");
            Assert.NotNull(phoneGroup);
            Assert.Contains(phoneGroup.Results, r => r.Title == "Ramesh Hypermarket");
        }

        [Fact]
        public async Task Search_20L_Distributor_Vehicle_And_Driver_Returns_Matches()
        {
            var (context, userCtx, tenantProvider) = CreateTestContext();
            var tenantId = tenantProvider.TenantId;
            var companyId = Guid.NewGuid();
            var distributorId = Guid.NewGuid();

            // Add Vehicle
            context.TwentyLDistributorVehicles.Add(new TwentyLDistributorVehicle
            {
                TenantId = tenantId,
                CompanyId = companyId,
                DistributorId = distributorId,
                RegistrationNumber = "KL-07-CD-9999",
                VehicleType = "Truck",
                CapacityJars = 150,
                AssignedDriverName = "Suresh Kumar"
            });

            // Add Driver
            context.TwentyLDistributorDrivers.Add(new TwentyLDistributorDriver
            {
                TenantId = tenantId,
                CompanyId = companyId,
                DistributorId = distributorId,
                DriverName = "Suresh Kumar",
                Phone = "9447012345",
                AssignedVehicleNumber = "KL-07-CD-9999"
            });

            // Add Route
            context.TwentyLDistributorRoutes.Add(new TwentyLDistributorRoute
            {
                TenantId = tenantId,
                CompanyId = companyId,
                DistributorId = distributorId,
                RouteCode = "RT-EAST",
                RouteName = "Eastern Industrial Route",
                AreaDescription = "Kakkanad InfoPark"
            });

            // Add Supply
            context.TwentyLDistributorSupplies.Add(new TwentyLDistributorSupply
            {
                TenantId = tenantId,
                CompanyId = companyId,
                DistributorId = distributorId,
                SupplyNumber = "SUP-2026-9099",
                QuantitySupplied = 100,
                Stage = "COMPLETED"
            });

            await context.SaveChangesAsync();

            var service = new GlobalSearchService(context, userCtx, NullLogger<GlobalSearchService>.Instance);

            // Vehicle Search (normalized registration)
            var vehicleRes = await service.SearchAsync(new GlobalSearchRequestDto { Query = "KL07CD9999" });
            var vehicleGroup = vehicleRes.Groups.FirstOrDefault(g => g.Type == "vehicles");
            Assert.NotNull(vehicleGroup);
            Assert.Contains(vehicleGroup.Results, r => r.Title == "KL-07-CD-9999");

            // Driver Search
            var driverRes = await service.SearchAsync(new GlobalSearchRequestDto { Query = "Suresh" });
            var peopleGroup = driverRes.Groups.FirstOrDefault(g => g.Type == "people");
            Assert.NotNull(peopleGroup);
            Assert.Contains(peopleGroup.Results, r => r.Title == "Suresh Kumar");

            // Route Search
            var routeRes = await service.SearchAsync(new GlobalSearchRequestDto { Query = "RT-EAST" });
            var routeGroup = routeRes.Groups.FirstOrDefault(g => g.Type == "routes");
            Assert.NotNull(routeGroup);
            Assert.Contains(routeGroup.Results, r => r.Title.Contains("RT-EAST"));

            // Supply Reference Search
            var supplyRes = await service.SearchAsync(new GlobalSearchRequestDto { Query = "SUP-2026-9099" });
            var opGroup = supplyRes.Groups.FirstOrDefault(g => g.Type == "20l_operations");
            Assert.NotNull(opGroup);
            Assert.Contains(opGroup.Results, r => r.Title.Contains("SUP-2026-9099"));
        }

        [Fact]
        public async Task Search_Distributor_Isolation_Enforces_Scoped_Results()
        {
            var (context, userCtx, tenantProvider) = CreateTestContext();
            var tenantId = tenantProvider.TenantId;
            var companyId = Guid.NewGuid();

            var distributorA = Guid.NewGuid();
            var distributorB = Guid.NewGuid();

            // Customer under Distributor A
            context.TwentyLDistributorCustomers.Add(new TwentyLDistributorCustomer
            {
                TenantId = tenantId,
                CompanyId = companyId,
                DistributorId = distributorA,
                CustomerName = "Distributor A Loyal Customer",
                Phone = "9000000001"
            });

            // Customer under Distributor B
            context.TwentyLDistributorCustomers.Add(new TwentyLDistributorCustomer
            {
                TenantId = tenantId,
                CompanyId = companyId,
                DistributorId = distributorB,
                CustomerName = "Distributor B Secret Customer",
                Phone = "9000000002"
            });

            await context.SaveChangesAsync();

            var service = new GlobalSearchService(context, userCtx, NullLogger<GlobalSearchService>.Instance);

            // Distributor A searches for "Customer"
            var distAResult = await service.SearchAsync(new GlobalSearchRequestDto
            {
                Query = "Customer",
                DistributorId = distributorA
            });

            var custGroup = distAResult.Groups.FirstOrDefault(g => g.Type == "customers");
            Assert.NotNull(custGroup);
            Assert.Contains(custGroup.Results, r => r.Title == "Distributor A Loyal Customer");
            Assert.DoesNotContain(custGroup.Results, r => r.Title == "Distributor B Secret Customer");
        }

        [Fact]
        public async Task Search_RolePermissions_Hides_Finance_From_Operators()
        {
            var (context, userCtx, tenantProvider) = CreateTestContext();
            var tenantId = tenantProvider.TenantId;
            var companyId = Guid.NewGuid();

            // Add Vendor & Purchase
            context.Vendors.Add(new Vendor
            {
                TenantId = tenantId,
                CompanyId = companyId,
                Name = "Apex Water Machinery",
                Phone = "9888877777"
            });

            context.Purchases.Add(new Purchase
            {
                TenantId = tenantId,
                CompanyId = companyId,
                PurchaseNo = "PUR-99001",
                VendorName = "Apex Water Machinery",
                GrandTotal = 500000
            });

            await context.SaveChangesAsync();

            // Set user to Operator role
            userCtx.Roles = new List<string> { "Operator" };

            var service = new GlobalSearchService(context, userCtx, NullLogger<GlobalSearchService>.Instance);

            var opResult = await service.SearchAsync(new GlobalSearchRequestDto { Query = "Apex" });

            // Operator must NOT receive finance groups
            Assert.False(opResult.Groups.Any(g => g.Type == "finance"));
        }
    }
}
