using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddCalculatedEntitlementToMonthlySalary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CalculatedEntitlement",
                schema: "public",
                table: "MonthlySalaries",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CalculatedEntitlement",
                schema: "public",
                table: "MonthlySalaries");
        }
    }
}
