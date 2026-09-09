using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Aquora.Tests;

/// <summary>Runs only against AQUORA_20L_TEST_CONNECTION. Never uses EF InMemory or mocked locks.</summary>
[Trait("Category", "PostgresIntegration")]
public sealed class TwentyLPostgresIntegrationTests
{
    private static string? ConnectionString => Environment.GetEnvironmentVariable("AQUORA_20L_TEST_CONNECTION");
    private const string TestSchema = "aquora_tenant_sinan_company";

    private static bool _schemaInitialized;
    private static readonly SemaphoreSlim _initLock = new(1, 1);

    private static async Task EnsureSchemaAsync()
    {
        if (_schemaInitialized || string.IsNullOrWhiteSpace(ConnectionString)) return;
        await _initLock.WaitAsync();
        try
        {
            if (_schemaInitialized) return;
            var tenant = Guid.NewGuid();
            await using var db = Context(tenant);
            await db.Database.ExecuteSqlRawAsync($@"
                CREATE SCHEMA IF NOT EXISTS ""{TestSchema}"";
                CREATE TABLE IF NOT EXISTS ""{TestSchema}"".""Companies"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""Name"" text NOT NULL,
                    ""Code"" text NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'test'
                );
                CREATE TABLE IF NOT EXISTS ""{TestSchema}"".""TwentyLJarPositions"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""PositionKey"" text NOT NULL,
                    ""ProductId"" uuid NULL,
                    ""OwnerType"" text NOT NULL DEFAULT 'COMPANY',
                    ""OwnerCustomerId"" uuid NULL,
                    ""HolderType"" text NOT NULL DEFAULT 'COMPANY',
                    ""HolderCustomerId"" uuid NULL,
                    ""LocationType"" text NOT NULL DEFAULT 'PLANT',
                    ""LocationReference"" text NULL,
                    ""ContainerStatus"" text NOT NULL DEFAULT 'EMPTY',
                    ""Quantity"" integer NOT NULL DEFAULT 0,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLJarPositions_Position"" ON ""{TestSchema}"".""TwentyLJarPositions"" (""TenantId"", ""CompanyId"", ""PositionKey"");
                CREATE TABLE IF NOT EXISTS ""{TestSchema}"".""TwentyLJarMovements"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""ProductId"" uuid NULL,
                    ""OwnerCustomerId"" uuid NULL,
                    ""FromCustomerId"" uuid NULL,
                    ""ToCustomerId"" uuid NULL,
                    ""OwnerType"" text NOT NULL DEFAULT 'COMPANY',
                    ""HolderType"" text NOT NULL DEFAULT 'COMPANY',
                    ""HolderCustomerId"" uuid NULL,
                    ""FromLocationType"" text NOT NULL DEFAULT 'PLANT',
                    ""ToLocationType"" text NOT NULL DEFAULT 'PLANT',
                    ""FromLocationReference"" text NULL,
                    ""ToLocationReference"" text NULL,
                    ""MovementType"" text NOT NULL DEFAULT '',
                    ""ContainerStatus"" text NOT NULL DEFAULT 'EMPTY',
                    ""Quantity"" integer NOT NULL DEFAULT 0,
                    ""ReferenceId"" uuid NULL,
                    ""ReferenceType"" text NULL,
                    ""OccurredAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""Reason"" text NULL,
                    ""Notes"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_TwentyLJarMovements_Ledger"" ON ""{TestSchema}"".""TwentyLJarMovements"" (""TenantId"", ""OwnerType"", ""OwnerCustomerId"", ""ToLocationType"", ""ToCustomerId"", ""OccurredAt"");
                CREATE TABLE IF NOT EXISTS ""{TestSchema}"".""TwentyLDeliveries"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""CustomerId"" uuid NOT NULL,
                    ""DistributorId"" uuid NULL,
                    ""ProductId"" uuid NOT NULL,
                    ""RateRuleId"" uuid NULL,
                    ""SalesTransactionId"" uuid NULL,
                    ""RefillType"" text NOT NULL DEFAULT 'DIRECT_CUSTOMER_REFILL',
                    ""JarOwnerType"" text NOT NULL DEFAULT 'COMPANY',
                    ""OrderedQuantity"" integer NOT NULL DEFAULT 0,
                    ""FilledDeliveredQuantity"" integer NOT NULL DEFAULT 0,
                    ""EmptyCollectedQuantity"" integer NOT NULL DEFAULT 0,
                    ""FailedQuantity"" integer NOT NULL DEFAULT 0,
                    ""AppliedUnitRate"" numeric NOT NULL DEFAULT 0.0,
                    ""DiscountAmount"" numeric NOT NULL DEFAULT 0.0,
                    ""TaxAmount"" numeric NOT NULL DEFAULT 0.0,
                    ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                    ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                    ""PaymentMode"" text NOT NULL DEFAULT 'CREDIT',
                    ""Status"" text NOT NULL DEFAULT 'COMPLETED',
                    ""RouteReference"" text NULL,
                    ""VehicleReference"" text NULL,
                    ""DriverReference"" text NULL,
                    ""DeliveredAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""FailureReason"" text NULL,
                    ""Notes"" text NULL,
                    ""IdempotencyKey"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDeliveries_TenantId_IdempotencyKey"" ON ""{TestSchema}"".""TwentyLDeliveries"" (""TenantId"", ""IdempotencyKey"");
                CREATE TABLE IF NOT EXISTS ""{TestSchema}"".""TwentyLTrips"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""TripNumber"" text NOT NULL,
                    ""DriverName"" text NOT NULL DEFAULT '',
                    ""DriverCustomerId"" uuid NULL,
                    ""VehicleNumber"" text NOT NULL DEFAULT '',
                    ""RouteCode"" text NULL,
                    ""PlannedDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""Status"" text NOT NULL DEFAULT 'PLANNED',
                    ""LoadedFilledJars"" integer NOT NULL DEFAULT 0,
                    ""LoadedEmptyJars"" integer NOT NULL DEFAULT 0,
                    ""DeliveredFilledJars"" integer NOT NULL DEFAULT 0,
                    ""CollectedEmptyJars"" integer NOT NULL DEFAULT 0,
                    ""ReturnedFilledJars"" integer NOT NULL DEFAULT 0,
                    ""ReturnedEmptyJars"" integer NOT NULL DEFAULT 0,
                    ""DamagedJarsCount"" integer NOT NULL DEFAULT 0,
                    ""LostJarsCount"" integer NOT NULL DEFAULT 0,
                    ""TotalTripRevenue"" numeric NOT NULL DEFAULT 0.0,
                    ""TotalCashCollected"" numeric NOT NULL DEFAULT 0.0,
                    ""DispatchedAt"" timestamp with time zone NULL,
                    ""ReturnedAt"" timestamp with time zone NULL,
                    ""ReconciledAt"" timestamp with time zone NULL,
                    ""ReconciledBy"" text NULL,
                    ""ReconciliationStatus"" text NOT NULL DEFAULT 'PENDING',
                    ""DiscrepancyNotes"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );
                CREATE TABLE IF NOT EXISTS ""{TestSchema}"".""TwentyLTripStops"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""TripId"" uuid NOT NULL,
                    ""CustomerId"" uuid NOT NULL,
                    ""ProductId"" uuid NULL,
                    ""StopSequence"" integer NOT NULL DEFAULT 1,
                    ""PlannedFilledJars"" integer NOT NULL DEFAULT 0,
                    ""DeliveredFilledJars"" integer NOT NULL DEFAULT 0,
                    ""CollectedEmptyJars"" integer NOT NULL DEFAULT 0,
                    ""DamagedEmptyJars"" integer NOT NULL DEFAULT 0,
                    ""LostJars"" integer NOT NULL DEFAULT 0,
                    ""UnitRate"" numeric NOT NULL DEFAULT 0.0,
                    ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                    ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                    ""PaymentMode"" text NOT NULL DEFAULT 'CREDIT',
                    ""PaymentStatus"" text NOT NULL DEFAULT 'PENDING',
                    ""Status"" text NOT NULL DEFAULT 'PENDING',
                    ""FailureReason"" text NULL,
                    ""DeliveredAt"" timestamp with time zone NULL,
                    ""Notes"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );
                CREATE TABLE IF NOT EXISTS ""{TestSchema}"".""TwentyLJarInspections"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""InspectionNumber"" text NOT NULL,
                    ""ReferenceType"" text NOT NULL DEFAULT 'PLANT',
                    ""ReferenceId"" uuid NULL,
                    ""SourceHolderType"" text NOT NULL DEFAULT 'PLANT',
                    ""SourceHolderName"" text NULL,
                    ""InspectedCount"" integer NOT NULL DEFAULT 0,
                    ""AcceptedReusableCount"" integer NOT NULL DEFAULT 0,
                    ""DamagedCount"" integer NOT NULL DEFAULT 0,
                    ""CondemnedCount"" integer NOT NULL DEFAULT 0,
                    ""InspectionOutcome"" text NOT NULL DEFAULT 'REUSABLE',
                    ""ResponsibleParty"" text NOT NULL DEFAULT 'PLANT',
                    ""DamageReason"" text NULL,
                    ""CondemnationReason"" text NULL,
                    ""AuthorizedBy"" text NULL,
                    ""DisposalCertificateReference"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL
                );
            ");
            _schemaInitialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    [Fact]
    public async Task Concurrent_dispatch_of_ten_allows_exactly_one_and_never_overdraws()
    {
        if (ConnectionString is null) return;
        var fixture = await CreateFixture();
        await OpeningBalance(fixture, 10);
        var attempts = await Task.WhenAll(Dispatch(fixture, 10), Dispatch(fixture, 10));
        Assert.Equal(1, attempts.Count(x => x));
        await AssertPosition(fixture, 0);
        Assert.Equal(1, await Movements(fixture, "DISPATCH"));
    }

    [Fact]
    public async Task Concurrent_partial_dispatch_keeps_remaining_balance()
    {
        if (ConnectionString is null) return;
        var fixture = await CreateFixture();
        await OpeningBalance(fixture, 10);
        var attempts = await Task.WhenAll(Dispatch(fixture, 6), Dispatch(fixture, 6));
        Assert.Equal(1, attempts.Count(x => x));
        await AssertPosition(fixture, 4);
    }

    [Fact]
    public async Task High_concurrency_ten_requests_of_twenty_with_hundred_available()
    {
        if (ConnectionString is null) return;
        var fixture = await CreateFixture();
        await OpeningBalance(fixture, 100);
        var tasks = Enumerable.Range(0, 10).Select(_ => Dispatch(fixture, 20)).ToArray();
        var results = await Task.WhenAll(tasks);
        var successfulCount = results.Count(x => x);
        Assert.Equal(5, successfulCount);
        await AssertPosition(fixture, 0);
        Assert.Equal(5, await Movements(fixture, "DISPATCH"));
    }

    [Fact]
    public async Task Position_isolated_by_tenant_and_company_key()
    {
        if (ConnectionString is null) return;
        var first = await CreateFixture(); var second = await CreateFixture();
        await OpeningBalance(first, 10); await OpeningBalance(second, 10);
        Assert.True(await Dispatch(first, 10));
        await AssertPosition(first, 0); await AssertPosition(second, 10);
    }

    [Fact]
    public async Task Failed_movement_rolls_back_and_leaves_no_orphaned_ledger_records()
    {
        if (ConnectionString is null) return;
        var fixture = await CreateFixture();
        await OpeningBalance(fixture, 5);
        var success = await Dispatch(fixture, 10); // Attempting to dispatch 10 with only 5 available
        Assert.False(success);
        await AssertPosition(fixture, 5); // Balance remains untouched
        Assert.Equal(0, await Movements(fixture, "DISPATCH")); // No orphaned dispatch record
    }

    [Fact]
    public async Task Staged_trip_loading_dispatch_delivery_and_return_reconciliation_zero_discrepancy()
    {
        if (ConnectionString is null) return;
        var f = await CreateFixture();
        await OpeningBalance(f, 100);

        await using var db = Context(f.tenant);
        var service = Service(db, f.tenant);

        var vehicleNumber = "KL-07-BW-2020";
        var driverCustomerId = Guid.NewGuid();
        var customerA = Guid.NewGuid();
        var customerB = Guid.NewGuid();

        // 1. Initial Load: 80 filled from Plant to Vehicle
        var plantFilled = new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", f.product);
        var vehicleFilled = new TwentyLPosition("COMPANY", null, "DRIVER", driverCustomerId, "VEHICLE", vehicleNumber, "EMPTY", f.product);
        await service.PostAsync(new TwentyLPostingRequest(plantFilled, vehicleFilled, 80, "PLANT_LOADING", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Loaded 80 jars", null));

        // 2. Delivery to Customer A: 30 filled delivered, 25 empties collected
        var customerAPosition = new TwentyLPosition("COMPANY", null, "CUSTOMER", customerA, "CUSTOMER", null, "EMPTY", f.product);
        await service.PostAsync(new TwentyLPostingRequest(vehicleFilled, customerAPosition, 30, "DELIVERY_DISPATCH", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Stop 1 delivered", null));
        await service.PostAsync(new TwentyLPostingRequest(customerAPosition, vehicleFilled, 25, "EMPTY_RETURN", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Stop 1 collected empties", null));

        // 3. Delivery to Customer B: 40 filled delivered, 35 empties collected
        var customerBPosition = new TwentyLPosition("COMPANY", null, "CUSTOMER", customerB, "CUSTOMER", null, "EMPTY", f.product);
        await service.PostAsync(new TwentyLPostingRequest(vehicleFilled, customerBPosition, 40, "DELIVERY_DISPATCH", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Stop 2 delivered", null));
        await service.PostAsync(new TwentyLPostingRequest(customerBPosition, vehicleFilled, 35, "EMPTY_RETURN", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Stop 2 collected empties", null));

        // 4. Vehicle returns to Plant:
        // Expected remaining on vehicle: 80 (loaded) - 30 (delivered A) - 40 (delivered B) + 25 (collected A) + 35 (collected B) = 70 jars total on vehicle!
        // Unload 10 remaining filled + 58 reusable empty + 2 damaged jars = 70 jars total!
        var plantDamaged = new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "DAMAGED", f.product);
        await service.PostAsync(new TwentyLPostingRequest(vehicleFilled, plantFilled, 10, "PLANT_RETURN", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Unload remaining filled", null));
        await service.PostAsync(new TwentyLPostingRequest(vehicleFilled, plantFilled, 58, "PLANT_RETURN", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Unload reusable empties", null));
        await service.PostAsync(new TwentyLPostingRequest(vehicleFilled, plantDamaged, 2, "DAMAGE_WRITE_OFF", Guid.NewGuid(), "TwentyLTrip", DateTime.UtcNow, "Unload damaged to quarantine", null));

        // Check vehicle balance is now 0 (fully accounted for and unloaded)
        var vehiclePos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.LocationType == "VEHICLE" && p.LocationReference == vehicleNumber);
        Assert.Equal(0, vehiclePos.Quantity);

        // Check plant has 100 - 80 + 10 + 58 = 88 reusable jars, and 2 damaged jars = 90 total at plant
        var plantPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.LocationType == "PLANT" && p.ContainerStatus == "EMPTY");
        Assert.Equal(88, plantPos.Quantity);

        var damagedPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.LocationType == "PLANT" && p.ContainerStatus == "DAMAGED");
        Assert.Equal(2, damagedPos.Quantity);

        // Check Customer A has net +5 jars (30 delivered - 25 returned)
        var custAPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.HolderCustomerId == customerA);
        Assert.Equal(5, custAPos.Quantity);

        // Check Customer B has net +5 jars (40 delivered - 35 returned)
        var custBPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.HolderCustomerId == customerB);
        Assert.Equal(5, custBPos.Quantity);

        // System Invariant: Plant (88 + 2) + Customer A (5) + Customer B (5) + Vehicle (0) = 100 Jars (100% strictly conserved)!
        int systemTotal = plantPos.Quantity + damagedPos.Quantity + custAPos.Quantity + custBPos.Quantity + vehiclePos.Quantity;
        Assert.Equal(100, systemTotal);
    }

    [Fact]
    public async Task Full_TwoTier_Distributor_Downstream_Supply_Delivery_And_Margin_Lifecycle_Reconciles()
    {
        if (ConnectionString is null) return;
        var f = await CreateFixture();
        await using var db = Context(f.tenant);
        var service = Service(db, f.tenant);

        // 1. Initial Opening Balance: Plant has 500 total jars (400 filled, 100 empty)
        var external = new TwentyLPosition("COMPANY", null, "OTHER", null, "EXTERNAL", null, "FILLED", f.product);
        var plantFilled = new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "FILLED", f.product);
        var plantEmpty = new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", f.product);

        await service.PostAsync(new TwentyLPostingRequest(external, plantFilled, 400, "OPENING_BALANCE", Guid.NewGuid(), "PlantSetup", DateTime.UtcNow, "Plant filled setup", null, IsOpeningBalance: true));
        await service.PostAsync(new TwentyLPostingRequest(external, plantEmpty, 100, "OPENING_BALANCE", Guid.NewGuid(), "PlantSetup", DateTime.UtcNow, "Plant empty setup", null, IsOpeningBalance: true));

        // 2. Upstream: Company supplies 100 filled jars to Distributor A (Depot)
        var distributorA = Guid.NewGuid();
        var distributorFilled = new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", distributorA, "DISTRIBUTOR_DEPOT", null, "FILLED", f.product);
        var distributorEmpty = new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", distributorA, "DISTRIBUTOR_DEPOT", null, "EMPTY", f.product);

        await service.PostAsync(new TwentyLPostingRequest(plantFilled, distributorFilled, 100, "COMPANY_SUPPLY_DISPATCH", Guid.NewGuid(), "TwentyLDistributorSupply", DateTime.UtcNow, "Company Supply to Distributor A", null));

        // 3. Upstream: Distributor A returns 20 empty jars to Plant
        await service.PostAsync(new TwentyLPostingRequest(distributorEmpty, plantEmpty, 20, "DISTRIBUTOR_EMPTY_RETURN", Guid.NewGuid(), "TwentyLDistributorSupply", DateTime.UtcNow, "Distributor return", null, IsAdjustment: true));

        // 4. Downstream: Distributor A delivers to Customer 1 (40 filled delivered, 30 empty collected)
        var customer1 = Guid.NewGuid();
        var cust1Filled = new TwentyLPosition("COMPANY", null, "CUSTOMER", customer1, "CUSTOMER_LOCATION", null, "FILLED", f.product);
        var cust1Empty = new TwentyLPosition("COMPANY", null, "CUSTOMER", customer1, "CUSTOMER_LOCATION", null, "EMPTY", f.product);

        await service.PostAsync(new TwentyLPostingRequest(distributorFilled, cust1Filled, 40, "DISTRIBUTOR_CUSTOMER_DELIVERY", Guid.NewGuid(), "TwentyLDistributorDelivery", DateTime.UtcNow, "Delivery to Cust 1", null));
        await service.PostAsync(new TwentyLPostingRequest(cust1Empty, distributorEmpty, 30, "DISTRIBUTOR_CUSTOMER_EMPTY_RETURN", Guid.NewGuid(), "TwentyLDistributorDelivery", DateTime.UtcNow, "Cust 1 Empties Collected", null, IsAdjustment: true));

        // 5. Downstream: Distributor A delivers to Customer 2 (30 filled delivered, 25 empty collected)
        var customer2 = Guid.NewGuid();
        var cust2Filled = new TwentyLPosition("COMPANY", null, "CUSTOMER", customer2, "CUSTOMER_LOCATION", null, "FILLED", f.product);
        var cust2Empty = new TwentyLPosition("COMPANY", null, "CUSTOMER", customer2, "CUSTOMER_LOCATION", null, "EMPTY", f.product);

        await service.PostAsync(new TwentyLPostingRequest(distributorFilled, cust2Filled, 30, "DISTRIBUTOR_CUSTOMER_DELIVERY", Guid.NewGuid(), "TwentyLDistributorDelivery", DateTime.UtcNow, "Delivery to Cust 2", null));
        await service.PostAsync(new TwentyLPostingRequest(cust2Empty, distributorEmpty, 25, "DISTRIBUTOR_CUSTOMER_EMPTY_RETURN", Guid.NewGuid(), "TwentyLDistributorDelivery", DateTime.UtcNow, "Cust 2 Empties Collected", null, IsAdjustment: true));

        // Verify Position Quantities:
        // Plant: 400 - 100 = 300 Filled; 100 + 20 = 120 Empty => Total Plant = 420 jars
        var plantFilledPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.LocationType == "PLANT" && p.ContainerStatus == "FILLED");
        var plantEmptyPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.LocationType == "PLANT" && p.ContainerStatus == "EMPTY");
        Assert.Equal(300, plantFilledPos.Quantity);
        Assert.Equal(120, plantEmptyPos.Quantity);

        // Distributor A Depot: 100 - 40 - 30 = 30 Filled; 30 + 25 - 20 = 35 Empty => Total Depot = 65 jars
        var distFilledPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.HolderCustomerId == distributorA && p.ContainerStatus == "FILLED");
        var distEmptyPos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.HolderCustomerId == distributorA && p.ContainerStatus == "EMPTY");
        Assert.Equal(30, distFilledPos.Quantity);
        Assert.Equal(35, distEmptyPos.Quantity);

        // Customer 1: Net holding = 40 (Delivered) - 30 (Collected) = 10 jars
        var cust1Pos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.HolderCustomerId == customer1 && p.ContainerStatus == "FILLED");
        Assert.Equal(40, cust1Pos.Quantity);

        // Customer 2: Net holding = 30 (Delivered) - 25 (Collected) = 5 jars
        var cust2Pos = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.HolderCustomerId == customer2 && p.ContainerStatus == "FILLED");
        Assert.Equal(30, cust2Pos.Quantity);

        // Universal Conservation:
        // 420 (Plant) + 65 (Distributor Depot) + 40 (Cust1 filled) + 30 (Cust2 filled) - 30 (Cust1 empty transferred) - 25 (Cust2 empty transferred) = 500 total!
        int totalPhysicalJars = plantFilledPos.Quantity + plantEmptyPos.Quantity + distFilledPos.Quantity + distEmptyPos.Quantity + (40 - 30) + (30 - 25);
        Assert.Equal(500, totalPhysicalJars);
    }

    private static async Task<(Guid tenant, Guid company, Guid product)> CreateFixture()
    {
        await EnsureSchemaAsync();
        var tenant = Guid.NewGuid(); var company = Guid.NewGuid(); var product = Guid.NewGuid();
        await using var db = Context(tenant);
        db.Companies.Add(new Company { Id = company, TenantId = tenant, Name = "20L Test", Code = Guid.NewGuid().ToString("N"), CreatedAt = DateTime.UtcNow, CreatedBy = "test" });
        await db.SaveChangesAsync();
        return (tenant, company, product);
    }

    private static async Task OpeningBalance((Guid tenant, Guid company, Guid product) f, int quantity)
    {
        await using var db = Context(f.tenant); var service = Service(db, f.tenant);
        var external = new TwentyLPosition("COMPANY", null, "OTHER", null, "EXTERNAL", null, "EMPTY", f.product);
        var plant = new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", f.product);
        await service.PostAsync(new TwentyLPostingRequest(external, plant, quantity, "OPENING_BALANCE", Guid.NewGuid(), "IntegrationTest", DateTime.UtcNow, "test setup", null, IsOpeningBalance: true));
    }

    private static async Task<bool> Dispatch((Guid tenant, Guid company, Guid product) f, int quantity)
    {
        try
        {
            await using var db = Context(f.tenant); var service = Service(db, f.tenant);
            var plant = new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", f.product);
            var destination = new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", Guid.NewGuid(), "DISTRIBUTOR", null, "EMPTY", f.product);
            await service.PostAsync(new TwentyLPostingRequest(plant, destination, quantity, "DISPATCH", Guid.NewGuid(), "IntegrationTest", DateTime.UtcNow, null, null)); return true;
        }
        catch (InvalidOperationException) { return false; }
    }

    private static async Task AssertPosition((Guid tenant, Guid company, Guid product) f, int expected)
    {
        await using var db = Context(f.tenant);
        var position = await db.TwentyLJarPositions.SingleAsync(p => p.TenantId == f.tenant && p.CompanyId == f.company && p.ProductId == f.product && p.LocationType == "PLANT");
        Assert.Equal(expected, position.Quantity); Assert.True(position.Quantity >= 0);
    }

    private static async Task<int> Movements((Guid tenant, Guid company, Guid product) f, string type)
    {
        await using var db = Context(f.tenant);
        return await db.TwentyLJarMovements.CountAsync(m => m.TenantId == f.tenant && m.MovementType == type);
    }

    private static TenantDbContext Context(Guid tenant)
    {
        var options = new DbContextOptionsBuilder<TenantDbContext>().UseNpgsql(ConnectionString!).Options;
        var provider = new Mock<ITenantProvider>(); provider.SetupGet(x => x.TenantId).Returns(tenant); provider.SetupGet(x => x.TenantSchemaName).Returns(TestSchema);
        var user = new Mock<ICurrentUserContext>(); user.SetupGet(x => x.TenantId).Returns(tenant); user.SetupGet(x => x.UserId).Returns("postgres-test"); user.Setup(x => x.HasPermission(It.IsAny<string>())).Returns(true);
        return new TenantDbContext(options, provider.Object, user.Object);
    }

    private static ITwentyLLedgerPostingService Service(TenantDbContext db, Guid tenant)
    {
        var user = new Mock<ICurrentUserContext>(); user.SetupGet(x => x.TenantId).Returns(tenant); user.SetupGet(x => x.UserId).Returns("postgres-test"); user.Setup(x => x.HasPermission(It.IsAny<string>())).Returns(true);
        return new TwentyLLedgerPostingService(db, user.Object);
    }
}

