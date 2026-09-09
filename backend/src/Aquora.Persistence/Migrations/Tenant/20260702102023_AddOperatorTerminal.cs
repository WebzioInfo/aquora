using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddOperatorTerminal : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CaseConfigurations",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseConfigurations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CaseConfigurations_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RawMaterials",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    BaseUnit = table.Column<string>(type: "text", nullable: false),
                    ConversionFactor = table.Column<decimal>(type: "numeric", nullable: false),
                    CurrentStock = table.Column<decimal>(type: "numeric", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RawMaterials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RawMaterials_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SkuProducts",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkuProducts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SkuProducts_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryMovements",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RawMaterialId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric", nullable: false),
                    ReferenceType = table.Column<string>(type: "text", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryMovements_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InventoryMovements_RawMaterials_RawMaterialId",
                        column: x => x.RawMaterialId,
                        principalSchema: _schema,
                        principalTable: "RawMaterials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProductionEntries",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OperatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    OperatorName = table.Column<string>(type: "text", nullable: false),
                    ProductionLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    Shift = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Time = table.Column<string>(type: "text", nullable: false),
                    SkuProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    CaseConfigurationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CasesProduced = table.Column<int>(type: "integer", nullable: false),
                    PreformMaterialId = table.Column<Guid>(type: "uuid", nullable: false),
                    PreformUsage = table.Column<decimal>(type: "numeric", nullable: false),
                    PreformWastage = table.Column<decimal>(type: "numeric", nullable: false),
                    LabelMaterialId = table.Column<Guid>(type: "uuid", nullable: false),
                    LabelUsage = table.Column<decimal>(type: "numeric", nullable: false),
                    LabelWastage = table.Column<decimal>(type: "numeric", nullable: false),
                    ShrinkMaterialId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShrinkUsage = table.Column<decimal>(type: "numeric", nullable: false),
                    ShrinkWastage = table.Column<decimal>(type: "numeric", nullable: false),
                    GlueMaterialId = table.Column<Guid>(type: "uuid", nullable: true),
                    GlueUsage = table.Column<decimal>(type: "numeric", nullable: true),
                    InkUsed = table.Column<bool>(type: "boolean", nullable: false),
                    MakeupUsed = table.Column<bool>(type: "boolean", nullable: false),
                    InventoryMovementIds = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionEntries_CaseConfigurations_CaseConfigurationId",
                        column: x => x.CaseConfigurationId,
                        principalSchema: _schema,
                        principalTable: "CaseConfigurations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionEntries_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionEntries_ProductionLines_ProductionLineId",
                        column: x => x.ProductionLineId,
                        principalSchema: _schema,
                        principalTable: "ProductionLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionEntries_RawMaterials_GlueMaterialId",
                        column: x => x.GlueMaterialId,
                        principalSchema: _schema,
                        principalTable: "RawMaterials",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ProductionEntries_RawMaterials_LabelMaterialId",
                        column: x => x.LabelMaterialId,
                        principalSchema: _schema,
                        principalTable: "RawMaterials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionEntries_RawMaterials_PreformMaterialId",
                        column: x => x.PreformMaterialId,
                        principalSchema: _schema,
                        principalTable: "RawMaterials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionEntries_RawMaterials_ShrinkMaterialId",
                        column: x => x.ShrinkMaterialId,
                        principalSchema: _schema,
                        principalTable: "RawMaterials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionEntries_SkuProducts_SkuProductId",
                        column: x => x.SkuProductId,
                        principalSchema: _schema,
                        principalTable: "SkuProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CaseConfigurations_CompanyId",
                schema: _schema,
                table: "CaseConfigurations",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryMovements_CompanyId",
                schema: _schema,
                table: "InventoryMovements",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryMovements_RawMaterialId",
                schema: _schema,
                table: "InventoryMovements",
                column: "RawMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_CaseConfigurationId",
                schema: _schema,
                table: "ProductionEntries",
                column: "CaseConfigurationId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_CompanyId",
                schema: _schema,
                table: "ProductionEntries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_GlueMaterialId",
                schema: _schema,
                table: "ProductionEntries",
                column: "GlueMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_LabelMaterialId",
                schema: _schema,
                table: "ProductionEntries",
                column: "LabelMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_PreformMaterialId",
                schema: _schema,
                table: "ProductionEntries",
                column: "PreformMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_ProductionLineId",
                schema: _schema,
                table: "ProductionEntries",
                column: "ProductionLineId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_ShrinkMaterialId",
                schema: _schema,
                table: "ProductionEntries",
                column: "ShrinkMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_SkuProductId",
                schema: _schema,
                table: "ProductionEntries",
                column: "SkuProductId");

            migrationBuilder.CreateIndex(
                name: "IX_RawMaterials_CompanyId",
                schema: _schema,
                table: "RawMaterials",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SkuProducts_CompanyId",
                schema: _schema,
                table: "SkuProducts",
                column: "CompanyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InventoryMovements",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "ProductionEntries",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "CaseConfigurations",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "RawMaterials",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "SkuProducts",
                schema: _schema);
        }
    }
}
