using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    /// <inheritdoc />
    public partial class AddIPAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: "public",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: "public",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: "public",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: "public",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: "public",
                table: "TenantProductionConfigurations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: "public",
                table: "TenantProductionConfigurations",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByIP",
                schema: "public",
                table: "OTPVerifications",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                schema: "public",
                table: "OTPVerifications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                schema: "public",
                table: "OTPVerifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                schema: "public",
                table: "OTPVerifications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: "public",
                table: "OTPVerifications",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: "public",
                table: "TenantProductionConfigurations");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: "public",
                table: "TenantProductionConfigurations");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                schema: "public",
                table: "OTPVerifications");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                schema: "public",
                table: "OTPVerifications");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                schema: "public",
                table: "OTPVerifications");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: "public",
                table: "OTPVerifications");

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByIP",
                schema: "public",
                table: "OTPVerifications",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
