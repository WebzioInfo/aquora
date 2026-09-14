using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Aquora.Persistence.Migrations.Tenant;

[DbContext(typeof(TenantDbContext))]
[Migration("20260907071000_AddTwentyLDeliveryIdempotency")]
public partial class AddTwentyLDeliveryIdempotency : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "IdempotencyKey", schema: "public", table: "TwentyLDeliveries", type: "text", nullable: true);
        migrationBuilder.CreateIndex(name: "IX_TwentyLDeliveries_TenantId_IdempotencyKey", schema: "public", table: "TwentyLDeliveries", columns: new[] { "TenantId", "IdempotencyKey" }, unique: true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_TwentyLDeliveries_TenantId_IdempotencyKey", schema: "public", table: "TwentyLDeliveries");
        migrationBuilder.DropColumn(name: "IdempotencyKey", schema: "public", table: "TwentyLDeliveries");
    }
}
