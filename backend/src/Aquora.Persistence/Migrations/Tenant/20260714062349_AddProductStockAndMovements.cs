using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddProductStockAndMovements : Migration
    {
        private readonly string _schema = TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryMovements_RawMaterials_RawMaterialId",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentStock",
                schema: _schema,
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<Guid>(
                name: "RawMaterialId",
                schema: _schema,
                table: "InventoryMovements",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "InventoryType",
                schema: _schema,
                table: "InventoryMovements",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                schema: _schema,
                table: "InventoryMovements",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryMovements_InventoryType",
                schema: _schema,
                table: "InventoryMovements",
                column: "InventoryType");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryMovements_ProductId",
                schema: _schema,
                table: "InventoryMovements",
                column: "ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryMovements_Products_ProductId",
                schema: _schema,
                table: "InventoryMovements",
                column: "ProductId",
                principalSchema: _schema,
                principalTable: "Products",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryMovements_RawMaterials_RawMaterialId",
                schema: _schema,
                table: "InventoryMovements",
                column: "RawMaterialId",
                principalSchema: _schema,
                principalTable: "RawMaterials",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryMovements_Products_ProductId",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.DropForeignKey(
                name: "FK_InventoryMovements_RawMaterials_RawMaterialId",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.DropIndex(
                name: "IX_InventoryMovements_InventoryType",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.DropIndex(
                name: "IX_InventoryMovements_ProductId",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.DropColumn(
                name: "CurrentStock",
                schema: _schema,
                table: "Products");

            migrationBuilder.DropColumn(
                name: "InventoryType",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.DropColumn(
                name: "ProductId",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.AlterColumn<Guid>(
                name: "RawMaterialId",
                schema: _schema,
                table: "InventoryMovements",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryMovements_RawMaterials_RawMaterialId",
                schema: _schema,
                table: "InventoryMovements",
                column: "RawMaterialId",
                principalSchema: _schema,
                principalTable: "RawMaterials",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
