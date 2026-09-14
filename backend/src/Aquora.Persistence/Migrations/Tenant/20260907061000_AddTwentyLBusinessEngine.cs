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
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(name: "TwentyLDeliveries", schema: "public", columns: table => new
        {
            Id = table.Column<Guid>(nullable: false), TenantId = table.Column<Guid>(nullable: false), CompanyId = table.Column<Guid>(nullable: false),
            CustomerId = table.Column<Guid>(nullable: false), DistributorId = table.Column<Guid>(nullable: true), ProductId = table.Column<Guid>(nullable: false), RateRuleId = table.Column<Guid>(nullable: true), SalesTransactionId = table.Column<Guid>(nullable: true),
            RefillType = table.Column<string>(nullable: false), JarOwnerType = table.Column<string>(nullable: false), OrderedQuantity = table.Column<int>(nullable: false), FilledDeliveredQuantity = table.Column<int>(nullable: false), EmptyCollectedQuantity = table.Column<int>(nullable: false), FailedQuantity = table.Column<int>(nullable: false),
            AppliedUnitRate = table.Column<decimal>(nullable: false), DiscountAmount = table.Column<decimal>(nullable: false), TaxAmount = table.Column<decimal>(nullable: false), TotalAmount = table.Column<decimal>(nullable: false), AmountCollected = table.Column<decimal>(nullable: false), PaymentMode = table.Column<string>(nullable: false), Status = table.Column<string>(nullable: false),
            RouteReference = table.Column<string>(nullable: true), VehicleReference = table.Column<string>(nullable: true), DriverReference = table.Column<string>(nullable: true), DeliveredAt = table.Column<DateTime>(nullable: false), FailureReason = table.Column<string>(nullable: true), Notes = table.Column<string>(nullable: true),
            CreatedAt = table.Column<DateTime>(nullable: false), CreatedBy = table.Column<string>(nullable: false), UpdatedAt = table.Column<DateTime>(nullable: true), UpdatedBy = table.Column<string>(nullable: true), CreatedByIP = table.Column<string>(nullable: true), UpdatedByIP = table.Column<string>(nullable: true)
        }, constraints: table => table.PrimaryKey("PK_TwentyLDeliveries", x => x.Id));

        migrationBuilder.CreateTable(name: "TwentyLDistributorProfiles", schema: "public", columns: table => new
        {
            Id = table.Column<Guid>(nullable: false), TenantId = table.Column<Guid>(nullable: false), CompanyId = table.Column<Guid>(nullable: false), CustomerId = table.Column<Guid>(nullable: false),
            DistributorType = table.Column<string>(nullable: false), JarOwnershipModel = table.Column<string>(nullable: false), VehicleOwnership = table.Column<string>(nullable: false), RouteOwnership = table.Column<string>(nullable: false), PricingModel = table.Column<string>(nullable: false), CommissionModel = table.Column<string>(nullable: false), CreditLimit = table.Column<decimal>(nullable: false), SecurityDeposit = table.Column<decimal>(nullable: false), PaymentTerms = table.Column<string>(nullable: true), EffectiveFrom = table.Column<DateTime>(nullable: false), EffectiveTo = table.Column<DateTime>(nullable: true), IsActive = table.Column<bool>(nullable: false), AgreementReference = table.Column<string>(nullable: true),
            CreatedAt = table.Column<DateTime>(nullable: false), CreatedBy = table.Column<string>(nullable: false), UpdatedAt = table.Column<DateTime>(nullable: true), UpdatedBy = table.Column<string>(nullable: true), CreatedByIP = table.Column<string>(nullable: true), UpdatedByIP = table.Column<string>(nullable: true), IsDeleted = table.Column<bool>(nullable: false), DeletedAt = table.Column<DateTime>(nullable: true), DeletedBy = table.Column<string>(nullable: true)
        }, constraints: table => { table.PrimaryKey("PK_TwentyLDistributorProfiles", x => x.Id); table.ForeignKey("FK_TwentyLDistributorProfiles_Customers_CustomerId", x => x.CustomerId, "public", "Customers", "Id", onDelete: ReferentialAction.Cascade); });

        migrationBuilder.CreateTable(name: "TwentyLJarMovements", schema: "public", columns: table => new
        {
            Id = table.Column<Guid>(nullable: false), TenantId = table.Column<Guid>(nullable: false), CompanyId = table.Column<Guid>(nullable: false), ProductId = table.Column<Guid>(nullable: true), OwnerCustomerId = table.Column<Guid>(nullable: true), FromCustomerId = table.Column<Guid>(nullable: true), ToCustomerId = table.Column<Guid>(nullable: true), OwnerType = table.Column<string>(nullable: false), FromLocationType = table.Column<string>(nullable: false), ToLocationType = table.Column<string>(nullable: false), FromLocationReference = table.Column<string>(nullable: true), ToLocationReference = table.Column<string>(nullable: true), MovementType = table.Column<string>(nullable: false), ContainerStatus = table.Column<string>(nullable: false), Quantity = table.Column<int>(nullable: false), ReferenceId = table.Column<Guid>(nullable: true), ReferenceType = table.Column<string>(nullable: true), OccurredAt = table.Column<DateTime>(nullable: false), Reason = table.Column<string>(nullable: true), Notes = table.Column<string>(nullable: true), CreatedAt = table.Column<DateTime>(nullable: false), CreatedBy = table.Column<string>(nullable: false), UpdatedAt = table.Column<DateTime>(nullable: true), UpdatedBy = table.Column<string>(nullable: true), CreatedByIP = table.Column<string>(nullable: true), UpdatedByIP = table.Column<string>(nullable: true)
        }, constraints: table => table.PrimaryKey("PK_TwentyLJarMovements", x => x.Id));

        migrationBuilder.CreateTable(name: "TwentyLRateRules", schema: "public", columns: table => new
        {
            Id = table.Column<Guid>(nullable: false), TenantId = table.Column<Guid>(nullable: false), CompanyId = table.Column<Guid>(nullable: false), ProductId = table.Column<Guid>(nullable: false), CustomerId = table.Column<Guid>(nullable: true), PartyType = table.Column<string>(nullable: false), RefillType = table.Column<string>(nullable: false), JarOwnerType = table.Column<string>(nullable: false), MinimumQuantity = table.Column<decimal>(nullable: false), UnitRate = table.Column<decimal>(nullable: false), DiscountRate = table.Column<decimal>(nullable: true), TaxRate = table.Column<decimal>(nullable: true), EffectiveFrom = table.Column<DateTime>(nullable: false), EffectiveTo = table.Column<DateTime>(nullable: true), RequiresAuthorization = table.Column<bool>(nullable: false), IsActive = table.Column<bool>(nullable: false), Notes = table.Column<string>(nullable: true), CreatedAt = table.Column<DateTime>(nullable: false), CreatedBy = table.Column<string>(nullable: false), UpdatedAt = table.Column<DateTime>(nullable: true), UpdatedBy = table.Column<string>(nullable: true), CreatedByIP = table.Column<string>(nullable: true), UpdatedByIP = table.Column<string>(nullable: true), IsDeleted = table.Column<bool>(nullable: false), DeletedAt = table.Column<DateTime>(nullable: true), DeletedBy = table.Column<string>(nullable: true)
        }, constraints: table => table.PrimaryKey("PK_TwentyLRateRules", x => x.Id));

        migrationBuilder.CreateIndex(name: "IX_TwentyLDeliveries_TenantId_CustomerId_DeliveredAt", schema: "public", table: "TwentyLDeliveries", columns: new[] { "TenantId", "CustomerId", "DeliveredAt" });
        migrationBuilder.CreateIndex(name: "IX_TwentyLDistributorProfiles_CustomerId", schema: "public", table: "TwentyLDistributorProfiles", column: "CustomerId");
        migrationBuilder.CreateIndex(name: "IX_TwentyLDistributorProfiles_TenantId_CustomerId", schema: "public", table: "TwentyLDistributorProfiles", columns: new[] { "TenantId", "CustomerId" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_TwentyLJarMovements_Ledger", schema: "public", table: "TwentyLJarMovements", columns: new[] { "TenantId", "OwnerType", "OwnerCustomerId", "ToLocationType", "ToCustomerId", "OccurredAt" });
        migrationBuilder.CreateIndex(name: "IX_TwentyLRateRules_Effective", schema: "public", table: "TwentyLRateRules", columns: new[] { "TenantId", "ProductId", "CustomerId", "EffectiveFrom", "EffectiveTo" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("TwentyLDeliveries", "public");
        migrationBuilder.DropTable("TwentyLDistributorProfiles", "public");
        migrationBuilder.DropTable("TwentyLJarMovements", "public");
        migrationBuilder.DropTable("TwentyLRateRules", "public");
    }
}
