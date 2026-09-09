using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddCompanyProfileAndApiKey : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApiKey",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AutoBatchNumber",
                schema: _schema,
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoProductionNumber",
                schema: _schema,
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoSKU",
                schema: _schema,
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DefaultDispatchMethod",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultProductionLineId",
                schema: _schema,
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultShiftId",
                schema: _schema,
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultWarehouseId",
                schema: _schema,
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GstNumber",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecretKeyHash",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                schema: _schema,
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
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "ApiKey",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoBatchNumber",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoProductionNumber",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoSKU",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Currency",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DateFormat",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultDispatchMethod",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultProductionLineId",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultShiftId",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultWarehouseId",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Email",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "GstNumber",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Language",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "SecretKeyHash",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Timezone",
                schema: _schema,
                table: "Companies");
        }
    }
}
