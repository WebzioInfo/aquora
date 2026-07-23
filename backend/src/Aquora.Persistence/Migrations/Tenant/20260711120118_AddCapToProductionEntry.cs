using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddCapToProductionEntry : Migration
    {
        private string _schema => TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CapMaterialId",
                schema: _schema,
                table: "ProductionEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CapUsage",
                schema: _schema,
                table: "ProductionEntries",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CapWastage",
                schema: _schema,
                table: "ProductionEntries",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "OperatorContextLogs",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OldLineId = table.Column<Guid>(type: "uuid", nullable: true),
                    NewLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Device = table.Column<string>(type: "text", nullable: false),
                    IPAddress = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperatorContextLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_CapMaterialId",
                schema: _schema,
                table: "ProductionEntries",
                column: "CapMaterialId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_RawMaterials_CapMaterialId",
                schema: _schema,
                table: "ProductionEntries",
                column: "CapMaterialId",
                principalSchema: _schema,
                principalTable: "RawMaterials",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_RawMaterials_CapMaterialId",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropTable(
                name: "OperatorContextLogs",
                schema: _schema);

            migrationBuilder.DropIndex(
                name: "IX_ProductionEntries_CapMaterialId",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropColumn(
                name: "CapMaterialId",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropColumn(
                name: "CapUsage",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropColumn(
                name: "CapWastage",
                schema: _schema,
                table: "ProductionEntries");
        }
    }
}
