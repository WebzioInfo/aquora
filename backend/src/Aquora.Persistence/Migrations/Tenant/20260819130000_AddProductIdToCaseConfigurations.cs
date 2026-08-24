using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddProductIdToCaseConfigurations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                schema: "public",
                table: "CaseConfigurations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "UnitsPerCase",
                schema: "public",
                table: "CaseConfigurations",
                type: "integer",
                nullable: false,
                defaultValue: 24);

            migrationBuilder.CreateIndex(
                name: "IX_CaseConfigurations_ProductId",
                schema: "public",
                table: "CaseConfigurations",
                column: "ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_CaseConfigurations_Products_ProductId",
                schema: "public",
                table: "CaseConfigurations",
                column: "ProductId",
                principalSchema: "public",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CaseConfigurations_Products_ProductId",
                schema: "public",
                table: "CaseConfigurations");

            migrationBuilder.DropIndex(
                name: "IX_CaseConfigurations_ProductId",
                schema: "public",
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "ProductId",
                schema: "public",
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "UnitsPerCase",
                schema: "public",
                table: "CaseConfigurations");
        }
    }
}
