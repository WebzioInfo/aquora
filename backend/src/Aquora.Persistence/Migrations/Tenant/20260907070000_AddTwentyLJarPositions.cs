using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Aquora.Persistence.Migrations.Tenant;

[DbContext(typeof(TenantDbContext))]
[Migration("20260907070000_AddTwentyLJarPositions")]
public partial class AddTwentyLJarPositions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(name: "TwentyLJarPositions", schema: "public", columns: table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), CompanyId = table.Column<Guid>(type: "uuid", nullable: false), PositionKey = table.Column<string>(type: "text", nullable: false), ProductId = table.Column<Guid>(type: "uuid", nullable: true), OwnerType = table.Column<string>(type: "text", nullable: false), OwnerCustomerId = table.Column<Guid>(type: "uuid", nullable: true), HolderType = table.Column<string>(type: "text", nullable: false), HolderCustomerId = table.Column<Guid>(type: "uuid", nullable: true), LocationType = table.Column<string>(type: "text", nullable: false), LocationReference = table.Column<string>(type: "text", nullable: true), ContainerStatus = table.Column<string>(type: "text", nullable: false), Quantity = table.Column<int>(type: "integer", nullable: false), CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), CreatedBy = table.Column<string>(type: "text", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true), CreatedByIP = table.Column<string>(type: "text", nullable: true), UpdatedByIP = table.Column<string>(type: "text", nullable: true)
        }, constraints: table => table.PrimaryKey("PK_TwentyLJarPositions", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_TwentyLJarPositions_Position", schema: "public", table: "TwentyLJarPositions", columns: new[] { "TenantId", "CompanyId", "PositionKey" }, unique: true);
    }
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "TwentyLJarPositions", schema: "public");
}
