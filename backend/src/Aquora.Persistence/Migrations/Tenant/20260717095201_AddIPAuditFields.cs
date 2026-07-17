using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddIPAuditFields : Migration
    {
        private readonly string _schema = TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "UserRoles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "UserRoles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "Stations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Stations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "SkuProducts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "SkuProducts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "SalesTransactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "SalesTransactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "Roles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Roles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "RolePermissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "RolePermissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "RawMaterials",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "RawMaterials",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "Products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionStationData",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionStationData",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionSessions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionSessions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionLines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionLines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionBatches",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionBatches",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "Permissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Permissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsVisits",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsVisits",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsUnloadings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsUnloadings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsQuarantines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsQuarantines",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsLoadings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsLoadings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsJarConditions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsJarConditions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsFillingQueues",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsFillingQueues",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "VisitId",
                schema: _schema,
                table: "OperationsFillingQueues",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "InventoryMovements",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "InventoryMovements",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "CaseConfigurations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "CaseConfigurations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByIP",
                schema: _schema,
                table: "Brands",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Brands",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OperationsFillingQueues_VisitId",
                schema: _schema,
                table: "OperationsFillingQueues",
                column: "VisitId");

            migrationBuilder.AddForeignKey(
                name: "FK_OperationsFillingQueues_OperationsVisits_VisitId",
                schema: _schema,
                table: "OperationsFillingQueues",
                column: "VisitId",
                principalSchema: _schema,
                principalTable: "OperationsVisits",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OperationsFillingQueues_OperationsVisits_VisitId",
                schema: _schema,
                table: "OperationsFillingQueues");

            migrationBuilder.DropIndex(
                name: "IX_OperationsFillingQueues_VisitId",
                schema: _schema,
                table: "OperationsFillingQueues");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "UserRoles");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "UserRoles");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "Stations");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Stations");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "SkuProducts");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "SkuProducts");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "RolePermissions");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "RolePermissions");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "RawMaterials");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "RawMaterials");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Products");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionStationData");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionStationData");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionSessions");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionSessions");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "ProductionBatches");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "ProductionBatches");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsVisits");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsVisits");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsUnloadings");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsUnloadings");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsQuarantines");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsQuarantines");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsLoadings");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsLoadings");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsJarConditions");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsJarConditions");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "OperationsFillingQueues");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "OperationsFillingQueues");

            migrationBuilder.DropColumn(
                name: "VisitId",
                schema: _schema,
                table: "OperationsFillingQueues");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "InventoryMovements");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "CreatedByIP",
                schema: _schema,
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "UpdatedByIP",
                schema: _schema,
                table: "Brands");
        }
    }
}
