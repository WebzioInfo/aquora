using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    /// <inheritdoc />
    public partial class AddTenantProvisioningDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                schema: "public",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentStep",
                schema: "public",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Duration",
                schema: "public",
                table: "Tenants",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "FailureReason",
                schema: "public",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Progress",
                schema: "public",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RetryCount",
                schema: "public",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartedAt",
                schema: "public",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedAt",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CurrentStep",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Duration",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FailureReason",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Progress",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "RetryCount",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                schema: "public",
                table: "Tenants");
        }
    }
}
