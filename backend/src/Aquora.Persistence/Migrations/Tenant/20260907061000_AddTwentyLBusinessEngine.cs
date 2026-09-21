using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant;

/// <summary>
/// Isolated schema foundation for the 20L ledger. This is deliberately independent of
/// the existing Customer counters and shared InventoryMovements table.
/// </summary>
[DbContext(typeof(TenantDbContext))]
[Migration("20260907061000_AddTwentyLBusinessEngine")]
public partial class AddTwentyLBusinessEngine : Migration
{
    private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDeliveries"" (
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
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );

            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLDistributorProfiles"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""CustomerId"" uuid NOT NULL,
                ""DistributorType"" text NOT NULL DEFAULT 'EXTERNAL',
                ""JarOwnershipModel"" text NOT NULL DEFAULT 'MIXED',
                ""VehicleOwnership"" text NOT NULL DEFAULT 'DISTRIBUTOR',
                ""RouteOwnership"" text NOT NULL DEFAULT 'DISTRIBUTOR',
                ""PricingModel"" text NOT NULL DEFAULT 'RATE_CARD',
                ""CommissionModel"" text NOT NULL DEFAULT 'NONE',
                ""CreditLimit"" numeric NOT NULL DEFAULT 0.0,
                ""SecurityDeposit"" numeric NOT NULL DEFAULT 0.0,
                ""PaymentTerms"" text NULL,
                ""EffectiveFrom"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""EffectiveTo"" timestamp with time zone NULL,
                ""IsActive"" boolean NOT NULL DEFAULT true,
                ""AgreementReference"" text NULL,
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

            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLJarMovements"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""ProductId"" uuid NULL,
                ""OwnerCustomerId"" uuid NULL,
                ""FromCustomerId"" uuid NULL,
                ""ToCustomerId"" uuid NULL,
                ""OwnerType"" text NOT NULL DEFAULT 'COMPANY',
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

            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLRateRules"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""ProductId"" uuid NOT NULL,
                ""CustomerId"" uuid NULL,
                ""PartyType"" text NOT NULL DEFAULT 'ANY',
                ""RefillType"" text NOT NULL DEFAULT 'COMPANY_TO_DISTRIBUTOR',
                ""JarOwnerType"" text NOT NULL DEFAULT 'ANY',
                ""MinimumQuantity"" numeric NOT NULL DEFAULT 1,
                ""UnitRate"" numeric NOT NULL DEFAULT 0.0,
                ""DiscountRate"" numeric NULL,
                ""TaxRate"" numeric NULL,
                ""EffectiveFrom"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""EffectiveTo"" timestamp with time zone NULL,
                ""RequiresAuthorization"" boolean NOT NULL DEFAULT false,
                ""IsActive"" boolean NOT NULL DEFAULT true,
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

            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDeliveries_TenantId_CustomerId_DeliveredAt"" ON ""{_schema}"".""TwentyLDeliveries"" (""TenantId"", ""CustomerId"", ""DeliveredAt"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLDistributorProfiles_CustomerId"" ON ""{_schema}"".""TwentyLDistributorProfiles"" (""CustomerId"");
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDistributorProfiles_TenantId_CustomerId"" ON ""{_schema}"".""TwentyLDistributorProfiles"" (""TenantId"", ""CustomerId"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLJarMovements_Ledger"" ON ""{_schema}"".""TwentyLJarMovements"" (""TenantId"", ""OwnerType"", ""OwnerCustomerId"", ""ToLocationType"", ""ToCustomerId"", ""OccurredAt"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLRateRules_Effective"" ON ""{_schema}"".""TwentyLRateRules"" (""TenantId"", ""ProductId"", ""CustomerId"", ""EffectiveFrom"", ""EffectiveTo"");
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDeliveries"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLDistributorProfiles"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLJarMovements"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLRateRules"";
        ");
    }
}
