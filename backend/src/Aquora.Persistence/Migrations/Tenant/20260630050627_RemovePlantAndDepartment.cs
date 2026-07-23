using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class RemovePlantAndDepartment : Migration
    {
        private string _schema => TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Machines_Plants_PlantId",
                schema: _schema,
                table: "Machines");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionLines_Departments_DepartmentId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionLines_Plants_PlantId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropForeignKey(
                name: "FK_Stations_Plants_PlantId",
                schema: _schema,
                table: "Stations");

            migrationBuilder.DropTable(
                name: "Departments",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "Plants",
                schema: _schema);

            migrationBuilder.DropIndex(
                name: "IX_Stations_PlantId",
                schema: _schema,
                table: "Stations");

            migrationBuilder.DropIndex(
                name: "IX_ProductionLines_DepartmentId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropIndex(
                name: "IX_ProductionLines_PlantId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropIndex(
                name: "IX_Machines_PlantId",
                schema: _schema,
                table: "Machines");

            migrationBuilder.DropColumn(
                name: "PlantId",
                schema: _schema,
                table: "Stations");

            migrationBuilder.DropColumn(
                name: "PlantId",
                schema: _schema,
                table: "ProductionStationData");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "PlantId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropColumn(
                name: "PlantId",
                schema: _schema,
                table: "ProductionBatches");

            migrationBuilder.DropColumn(
                name: "PlantId",
                schema: _schema,
                table: "Machines");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: _schema,
                table: "ProductionLines",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.AddColumn<Guid>(
                name: "PlantId",
                schema: _schema,
                table: "Stations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "PlantId",
                schema: _schema,
                table: "ProductionStationData",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                schema: _schema,
                table: "ProductionLines",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "PlantId",
                schema: _schema,
                table: "ProductionLines",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "PlantId",
                schema: _schema,
                table: "ProductionBatches",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "PlantId",
                schema: _schema,
                table: "Machines",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "Plants",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Plants_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Departments",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Departments_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Departments_Plants_PlantId",
                        column: x => x.PlantId,
                        principalSchema: _schema,
                        principalTable: "Plants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Stations_PlantId",
                schema: _schema,
                table: "Stations",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLines_DepartmentId",
                schema: _schema,
                table: "ProductionLines",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLines_PlantId",
                schema: _schema,
                table: "ProductionLines",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_PlantId",
                schema: _schema,
                table: "Machines",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_CompanyId",
                schema: _schema,
                table: "Departments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_PlantId",
                schema: _schema,
                table: "Departments",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "IX_Plants_CompanyId",
                schema: _schema,
                table: "Plants",
                column: "CompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Machines_Plants_PlantId",
                schema: _schema,
                table: "Machines",
                column: "PlantId",
                principalSchema: _schema,
                principalTable: "Plants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionLines_Departments_DepartmentId",
                schema: _schema,
                table: "ProductionLines",
                column: "DepartmentId",
                principalSchema: _schema,
                principalTable: "Departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionLines_Plants_PlantId",
                schema: _schema,
                table: "ProductionLines",
                column: "PlantId",
                principalSchema: _schema,
                principalTable: "Plants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Stations_Plants_PlantId",
                schema: _schema,
                table: "Stations",
                column: "PlantId",
                principalSchema: _schema,
                principalTable: "Plants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
