using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    public partial class RemoveObsoleteProductPricing : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SellingPrice",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UnitCost",
                table: "Products");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "SellingPrice",
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 15.0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitCost",
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 5.0m);
        }
    }
}
