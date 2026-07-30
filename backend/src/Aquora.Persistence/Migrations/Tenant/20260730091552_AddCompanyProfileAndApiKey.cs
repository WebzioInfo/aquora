using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddCompanyProfileAndApiKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApiKey",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AutoBatchNumber",
                schema: "public",
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoProductionNumber",
                schema: "public",
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoSKU",
                schema: "public",
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DefaultDispatchMethod",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultProductionLineId",
                schema: "public",
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultShiftId",
                schema: "public",
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultWarehouseId",
                schema: "public",
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GstNumber",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecretKeyHash",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Address",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "ApiKey",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoBatchNumber",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoProductionNumber",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoSKU",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Currency",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DateFormat",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultDispatchMethod",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultProductionLineId",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultShiftId",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultWarehouseId",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Email",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "GstNumber",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Language",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "SecretKeyHash",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Timezone",
                schema: "public",
                table: "Companies");
        }
    }
}
