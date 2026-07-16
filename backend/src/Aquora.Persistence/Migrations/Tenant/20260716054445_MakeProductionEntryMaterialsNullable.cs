using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class MakeProductionEntryMaterialsNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_RawMaterials_LabelMaterialId",
                schema: "public",
                table: "ProductionEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_RawMaterials_PreformMaterialId",
                schema: "public",
                table: "ProductionEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_RawMaterials_ShrinkMaterialId",
                schema: "public",
                table: "ProductionEntries");

            migrationBuilder.AlterColumn<Guid>(
                name: "ShrinkMaterialId",
                schema: "public",
                table: "ProductionEntries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<Guid>(
                name: "PreformMaterialId",
                schema: "public",
                table: "ProductionEntries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<Guid>(
                name: "LabelMaterialId",
                schema: "public",
                table: "ProductionEntries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_RawMaterials_LabelMaterialId",
                schema: "public",
                table: "ProductionEntries",
                column: "LabelMaterialId",
                principalSchema: "public",
                principalTable: "RawMaterials",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_RawMaterials_PreformMaterialId",
                schema: "public",
                table: "ProductionEntries",
                column: "PreformMaterialId",
                principalSchema: "public",
                principalTable: "RawMaterials",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_RawMaterials_ShrinkMaterialId",
                schema: "public",
                table: "ProductionEntries",
                column: "ShrinkMaterialId",
                principalSchema: "public",
                principalTable: "RawMaterials",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_RawMaterials_LabelMaterialId",
                schema: "public",
                table: "ProductionEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_RawMaterials_PreformMaterialId",
                schema: "public",
                table: "ProductionEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_RawMaterials_ShrinkMaterialId",
                schema: "public",
                table: "ProductionEntries");

            migrationBuilder.AlterColumn<Guid>(
                name: "ShrinkMaterialId",
                schema: "public",
                table: "ProductionEntries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "PreformMaterialId",
                schema: "public",
                table: "ProductionEntries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "LabelMaterialId",
                schema: "public",
                table: "ProductionEntries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_RawMaterials_LabelMaterialId",
                schema: "public",
                table: "ProductionEntries",
                column: "LabelMaterialId",
                principalSchema: "public",
                principalTable: "RawMaterials",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_RawMaterials_PreformMaterialId",
                schema: "public",
                table: "ProductionEntries",
                column: "PreformMaterialId",
                principalSchema: "public",
                principalTable: "RawMaterials",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_RawMaterials_ShrinkMaterialId",
                schema: "public",
                table: "ProductionEntries",
                column: "ShrinkMaterialId",
                principalSchema: "public",
                principalTable: "RawMaterials",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
