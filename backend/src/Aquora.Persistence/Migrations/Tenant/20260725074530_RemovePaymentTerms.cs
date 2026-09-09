using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class RemovePaymentTerms : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                
                table: "Customers");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                
                table: "PriceLists",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                
                table: "PriceLists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                
                table: "PriceLists",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                
                table: "DiscountGroups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                
                table: "DiscountGroups",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                
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
                
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                
                table: "DiscountGroups");

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                
                table: "Customers",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
