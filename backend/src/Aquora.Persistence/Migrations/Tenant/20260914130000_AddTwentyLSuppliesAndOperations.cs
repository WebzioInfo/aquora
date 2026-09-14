using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant;

[DbContext(typeof(TenantDbContext))]
[Migration("20260914130000_AddTwentyLSuppliesAndOperations")]
public partial class AddTwentyLSuppliesAndOperations : Migration
{
    private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            -- 1. TwentyLDistributorSupplies
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDistributorSupplies"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""SupplyNumber"" text NOT NULL,
                ""DistributorId"" uuid NOT NULL,
                ""DistributorName"" text NOT NULL DEFAULT '',
                ""ProductId"" uuid NOT NULL,
                ""ProductName"" text NOT NULL DEFAULT '20L Water Jar',
                ""Stage"" text NOT NULL DEFAULT 'COMPLETED',
                ""QuantityRequested"" integer NOT NULL DEFAULT 0,
                ""QuantitySupplied"" integer NOT NULL DEFAULT 0,
                ""QuantityEmptyReturned"" integer NOT NULL DEFAULT 0,
                ""QuantityDamaged"" integer NOT NULL DEFAULT 0,
                ""AppliedRate"" numeric NOT NULL DEFAULT 0.0,
                ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                ""AmountPaid"" numeric NOT NULL DEFAULT 0.0,
                ""PaymentStatus"" text NOT NULL DEFAULT 'PENDING',
                ""PaymentMode"" text NULL,
                ""VehicleNumber"" text NULL,
                ""DriverName"" text NULL,
                ""DispatcherNotes"" text NULL,
                ""ReceiverNotes"" text NULL,
                ""DispatchedAt"" timestamp with time zone NULL,
                ""ReceivedAt"" timestamp with time zone NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDistributorSupplies_TenantId_Number"" ON ""{_schema}"".""TwentyLDistributorSupplies"" (""TenantId"", ""SupplyNumber"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorSupplies_TenantId_DistributorId"" ON ""{_schema}"".""TwentyLDistributorSupplies"" (""TenantId"", ""DistributorId"");

            -- 2. TwentyLDistributorRoutes
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDistributorRoutes"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""DistributorId"" uuid NOT NULL,
                ""RouteCode"" text NOT NULL DEFAULT '',
                ""RouteName"" text NOT NULL DEFAULT '',
                ""AreaDescription"" text NULL,
                ""DefaultDriverName"" text NULL,
                ""DefaultVehicleNumber"" text NULL,
                ""ScheduleDays"" text NOT NULL DEFAULT 'DAILY',
                ""IsActive"" boolean NOT NULL DEFAULT true,
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
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorRoutes_TenantId_DistributorId"" ON ""{_schema}"".""TwentyLDistributorRoutes"" (""TenantId"", ""DistributorId"");

            -- 3. TwentyLDistributorVehicles
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDistributorVehicles"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""DistributorId"" uuid NOT NULL,
                ""RegistrationNumber"" text NOT NULL,
                ""VehicleType"" text NOT NULL DEFAULT 'MINI_TRUCK',
                ""CapacityJars"" integer NOT NULL DEFAULT 50,
                ""AssignedDriverName"" text NULL,
                ""IsActive"" boolean NOT NULL DEFAULT true,
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
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorVehicles_TenantId_DistributorId"" ON ""{_schema}"".""TwentyLDistributorVehicles"" (""TenantId"", ""DistributorId"");

            -- 4. TwentyLDistributorDrivers
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDistributorDrivers"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""DistributorId"" uuid NOT NULL,
                ""DriverName"" text NOT NULL DEFAULT '',
                ""Phone"" text NOT NULL DEFAULT '',
                ""LicenseNumber"" text NULL,
                ""AssignedVehicleNumber"" text NULL,
                ""CurrentRouteId"" uuid NULL,
                ""IsActive"" boolean NOT NULL DEFAULT true,
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
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorDrivers_TenantId_DistributorId"" ON ""{_schema}"".""TwentyLDistributorDrivers"" (""TenantId"", ""DistributorId"");

            -- 5. TwentyLDistributorCustomers
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDistributorCustomers"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""DistributorId"" uuid NOT NULL,
                ""CustomerName"" text NOT NULL DEFAULT '',
                ""Phone"" text NOT NULL DEFAULT '',
                ""Address"" text NULL,
                ""Area"" text NULL,
                ""RouteId"" uuid NULL,
                ""RouteName"" text NULL,
                ""DeliveryFrequency"" text NOT NULL DEFAULT 'DAILY',
                ""DefaultRate"" numeric NOT NULL DEFAULT 40.0,
                ""AssignedDriverName"" text NULL,
                ""AssignedVehicleNumber"" text NULL,
                ""FilledJarsHeld"" integer NOT NULL DEFAULT 0,
                ""EmptyJarsHeld"" integer NOT NULL DEFAULT 0,
                ""SecurityDeposit"" numeric NOT NULL DEFAULT 0.0,
                ""OutstandingBalance"" numeric NOT NULL DEFAULT 0.0,
                ""IsActive"" boolean NOT NULL DEFAULT true,
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
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorCustomers_TenantId_DistributorId"" ON ""{_schema}"".""TwentyLDistributorCustomers"" (""TenantId"", ""DistributorId"");

            -- 6. TwentyLDistributorDeliveries
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDistributorDeliveries"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""DeliveryNumber"" text NOT NULL,
                ""DistributorId"" uuid NOT NULL,
                ""DistributorCustomerId"" uuid NOT NULL,
                ""CustomerName"" text NOT NULL DEFAULT '',
                ""RouteId"" uuid NULL,
                ""RouteName"" text NULL,
                ""DriverName"" text NULL,
                ""VehicleNumber"" text NULL,
                ""ProductId"" uuid NULL,
                ""QuantityFilledDelivered"" integer NOT NULL DEFAULT 0,
                ""QuantityEmptyCollected"" integer NOT NULL DEFAULT 0,
                ""QuantityDamaged"" integer NOT NULL DEFAULT 0,
                ""SellingRate"" numeric NOT NULL DEFAULT 0.0,
                ""CompanyRefillRate"" numeric NOT NULL DEFAULT 0.0,
                ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                ""PaymentMode"" text NOT NULL DEFAULT 'CASH',
                ""PaymentStatus"" text NOT NULL DEFAULT 'PAID',
                ""GrossMargin"" numeric NOT NULL DEFAULT 0.0,
                ""DeliveryDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""Notes"" text NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDistributorDeliveries_TenantId_Number"" ON ""{_schema}"".""TwentyLDistributorDeliveries"" (""TenantId"", ""DeliveryNumber"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorDeliveries_DistributorId"" ON ""{_schema}"".""TwentyLDistributorDeliveries"" (""TenantId"", ""DistributorId"");

            -- 7. TwentyLTrips
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLTrips"" (
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
                ""CondemnedJarsCount"" integer NOT NULL DEFAULT 0,
                ""TotalTripRevenue"" numeric NOT NULL DEFAULT 0.0,
                ""TotalCashCollected"" numeric NOT NULL DEFAULT 0.0,
                ""ReconciliationStatus"" text NOT NULL DEFAULT 'PENDING',
                ""DiscrepancyNotes"" text NULL,
                ""DispatchedAt"" timestamp with time zone NULL,
                ""ReturnedAt"" timestamp with time zone NULL,
                ""ReconciledAt"" timestamp with time zone NULL,
                ""ReconciledBy"" text NULL,
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
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLTrips_TenantId_TripNumber"" ON ""{_schema}"".""TwentyLTrips"" (""TenantId"", ""TripNumber"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLTrips_TenantId_PlannedDate"" ON ""{_schema}"".""TwentyLTrips"" (""TenantId"", ""PlannedDate"");

            -- 8. TwentyLTripStops
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLTripStops"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""TripId"" uuid NOT NULL,
                ""StopSequence"" integer NOT NULL DEFAULT 1,
                ""CustomerId"" uuid NOT NULL,
                ""ProductId"" uuid NULL,
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
                ""Notes"" text NULL,
                ""DeliveredAt"" timestamp with time zone NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLTripStops_TenantId_TripId_Sequence"" ON ""{_schema}"".""TwentyLTripStops"" (""TenantId"", ""TripId"", ""StopSequence"");

            -- 9. TwentyLOperations
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLOperations"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""OperationNumber"" text NOT NULL,
                ""OperationType"" text NOT NULL,
                ""Stage"" text NOT NULL DEFAULT 'COMPLETED',
                ""TripId"" uuid NULL,
                ""CustomerId"" uuid NULL,
                ""DistributorId"" uuid NULL,
                ""DriverName"" text NULL,
                ""VehicleNumber"" text NULL,
                ""ProductId"" uuid NULL,
                ""QuantityFilled"" integer NOT NULL DEFAULT 0,
                ""QuantityEmpty"" integer NOT NULL DEFAULT 0,
                ""QuantityDamaged"" integer NOT NULL DEFAULT 0,
                ""QuantityLost"" integer NOT NULL DEFAULT 0,
                ""QuantityCondemned"" integer NOT NULL DEFAULT 0,
                ""AppliedRate"" numeric NOT NULL DEFAULT 0.0,
                ""TotalAmount"" numeric NOT NULL DEFAULT 0.0,
                ""AmountCollected"" numeric NOT NULL DEFAULT 0.0,
                ""PaymentStatus"" text NOT NULL DEFAULT 'PENDING',
                ""Status"" text NOT NULL DEFAULT 'COMPLETED',
                ""ReferenceNumber"" text NULL,
                ""Reason"" text NULL,
                ""Notes"" text NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLOperations_TenantId_Number"" ON ""{_schema}"".""TwentyLOperations"" (""TenantId"", ""OperationNumber"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLOperations_TenantId_Type_Stage"" ON ""{_schema}"".""TwentyLOperations"" (""TenantId"", ""OperationType"", ""Stage"");

            -- 10. TwentyLJarInspections
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLJarInspections"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""InspectionNumber"" text NOT NULL,
                ""ReferenceType"" text NOT NULL DEFAULT '',
                ""ReferenceId"" uuid NULL,
                ""SourceHolderType"" text NOT NULL DEFAULT 'DRIVER',
                ""SourceHolderId"" uuid NULL,
                ""SourceHolderName"" text NULL,
                ""InspectedCount"" integer NOT NULL DEFAULT 0,
                ""ReusableCount"" integer NOT NULL DEFAULT 0,
                ""DamagedCount"" integer NOT NULL DEFAULT 0,
                ""CondemnedCount"" integer NOT NULL DEFAULT 0,
                ""InspectionOutcome"" text NOT NULL DEFAULT 'PASSED',
                ""ResponsibleParty"" text NULL,
                ""DamageReason"" text NULL,
                ""CondemnationReason"" text NULL,
                ""AuthorizedBy"" text NULL,
                ""DisposalReference"" text NULL,
                ""Notes"" text NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLJarInspections_TenantId_Number"" ON ""{_schema}"".""TwentyLJarInspections"" (""TenantId"", ""InspectionNumber"");
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLJarInspections"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLOperations"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLTripStops"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLTrips"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDistributorDeliveries"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDistributorCustomers"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDistributorDrivers"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDistributorVehicles"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDistributorRoutes"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDistributorSupplies"";
        ");
    }
}
