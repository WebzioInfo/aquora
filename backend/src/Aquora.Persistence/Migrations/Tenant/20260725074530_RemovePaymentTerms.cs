using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class RemovePaymentTerms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                schema: "public",
                table: "Customers");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: "public",
                table: "PriceLists",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: "public",
                table: "PriceLists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: "public",
                table: "PriceLists",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: "public",
                table: "DiscountGroups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: "public",
                table: "DiscountGroups",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: "public",
                table: "DiscountGroups",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: "public",
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: "public",
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: "public",
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: "public",
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: "public",
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: "public",
                table: "DiscountGroups");

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                schema: "public",
                table: "Customers",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
