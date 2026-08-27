using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddWarningLimitsToWaterTestParameters : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "MinWarning",
                schema: _schema,
                table: "WaterTestParameters",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MaxWarning",
                schema: _schema,
                table: "WaterTestParameters",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MinWarning",
                schema: _schema,
                table: "WaterTestParameters");

            migrationBuilder.DropColumn(
                name: "MaxWarning",
                schema: _schema,
                table: "WaterTestParameters");
        }
    }
}
