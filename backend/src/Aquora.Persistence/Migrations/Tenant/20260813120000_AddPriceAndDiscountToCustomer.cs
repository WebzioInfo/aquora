using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddPriceAndDiscountToCustomer : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CountSetting",
                schema: _schema,
                table: "Customers");

            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                schema: _schema,
                table: "Customers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Discount",
                schema: _schema,
                table: "Customers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Price",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Discount",
                schema: _schema,
                table: "Customers");

            migrationBuilder.AddColumn<int>(
                name: "CountSetting",
                schema: _schema,
                table: "Customers",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
