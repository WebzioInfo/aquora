using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class Add20LOperations : Migration
    {
        private string _schema => TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OperationsFillingQueues",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DistributorId = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandId = table.Column<Guid>(type: "uuid", nullable: false),
                    Priority = table.Column<string>(type: "text", nullable: false),
                    RequestedQuantity = table.Column<int>(type: "integer", nullable: false),
                    RemainingQuantity = table.Column<int>(type: "integer", nullable: false),
                    CompletedQuantity = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
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
                    table.PrimaryKey("PK_OperationsFillingQueues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsFillingQueues_Brands_BrandId",
                        column: x => x.BrandId,
                        principalSchema: _schema,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OperationsFillingQueues_Customers_DistributorId",
                        column: x => x.DistributorId,
                        principalSchema: _schema,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsVisits",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ArrivalTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VehicleNumber = table.Column<string>(type: "text", nullable: false),
                    DriverName = table.Column<string>(type: "text", nullable: false),
                    DistributorId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpectedCollectionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Priority = table.Column<string>(type: "text", nullable: false),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
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
                    table.PrimaryKey("PK_OperationsVisits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsVisits_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OperationsVisits_Customers_DistributorId",
                        column: x => x.DistributorId,
                        principalSchema: _schema,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsJarConditions",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VisitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConditionType = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    DamageLocation = table.Column<string>(type: "text", nullable: true),
                    Responsibility = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_OperationsJarConditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsJarConditions_OperationsVisits_VisitId",
                        column: x => x.VisitId,
                        principalSchema: _schema,
                        principalTable: "OperationsVisits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsLoadings",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VisitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandId = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchNumber = table.Column<string>(type: "text", nullable: false),
                    CapMaterialId = table.Column<Guid>(type: "uuid", nullable: true),
                    SealMaterialId = table.Column<Guid>(type: "uuid", nullable: true),
                    SealRequired = table.Column<bool>(type: "boolean", nullable: false),
                    QuantityLoaded = table.Column<int>(type: "integer", nullable: false),
                    LoadedBy = table.Column<string>(type: "text", nullable: false),
                    LoadingTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VehicleNumber = table.Column<string>(type: "text", nullable: false),
                    Remarks = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_OperationsLoadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsLoadings_Brands_BrandId",
                        column: x => x.BrandId,
                        principalSchema: _schema,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OperationsLoadings_OperationsVisits_VisitId",
                        column: x => x.VisitId,
                        principalSchema: _schema,
                        principalTable: "OperationsVisits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OperationsLoadings_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: _schema,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OperationsLoadings_RawMaterials_CapMaterialId",
                        column: x => x.CapMaterialId,
                        principalSchema: _schema,
                        principalTable: "RawMaterials",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OperationsLoadings_RawMaterials_SealMaterialId",
                        column: x => x.SealMaterialId,
                        principalSchema: _schema,
                        principalTable: "RawMaterials",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "OperationsQuarantines",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VisitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    HoldDurationHours = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
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
                    table.PrimaryKey("PK_OperationsQuarantines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsQuarantines_OperationsVisits_VisitId",
                        column: x => x.VisitId,
                        principalSchema: _schema,
                        principalTable: "OperationsVisits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsUnloadings",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VisitId = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReturnedEmptyCount = table.Column<int>(type: "integer", nullable: false),
                    ImmediateRequirement = table.Column<int>(type: "integer", nullable: false),
                    LaterRequirement = table.Column<int>(type: "integer", nullable: false),
                    ScheduledRequirement = table.Column<int>(type: "integer", nullable: false),
                    ScheduledDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("PK_OperationsUnloadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsUnloadings_Brands_BrandId",
                        column: x => x.BrandId,
                        principalSchema: _schema,
                        principalTable: "Brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OperationsUnloadings_OperationsVisits_VisitId",
                        column: x => x.VisitId,
                        principalSchema: _schema,
                        principalTable: "OperationsVisits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OperationsFillingQueues_BrandId",
                schema: _schema,
                table: "OperationsFillingQueues",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsFillingQueues_DistributorId",
                schema: _schema,
                table: "OperationsFillingQueues",
                column: "DistributorId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsFillingQueues_Priority",
                schema: _schema,
                table: "OperationsFillingQueues",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsFillingQueues_Status",
                schema: _schema,
                table: "OperationsFillingQueues",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsJarConditions_ConditionType",
                schema: _schema,
                table: "OperationsJarConditions",
                column: "ConditionType");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsJarConditions_VisitId",
                schema: _schema,
                table: "OperationsJarConditions",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsLoadings_BatchNumber",
                schema: _schema,
                table: "OperationsLoadings",
                column: "BatchNumber");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsLoadings_BrandId",
                schema: _schema,
                table: "OperationsLoadings",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsLoadings_CapMaterialId",
                schema: _schema,
                table: "OperationsLoadings",
                column: "CapMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsLoadings_ProductId",
                schema: _schema,
                table: "OperationsLoadings",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsLoadings_SealMaterialId",
                schema: _schema,
                table: "OperationsLoadings",
                column: "SealMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsLoadings_VisitId",
                schema: _schema,
                table: "OperationsLoadings",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsQuarantines_Status",
                schema: _schema,
                table: "OperationsQuarantines",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsQuarantines_VisitId",
                schema: _schema,
                table: "OperationsQuarantines",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsUnloadings_BrandId",
                schema: _schema,
                table: "OperationsUnloadings",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsUnloadings_VisitId",
                schema: _schema,
                table: "OperationsUnloadings",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsVisits_ArrivalTime",
                schema: _schema,
                table: "OperationsVisits",
                column: "ArrivalTime");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsVisits_CompanyId",
                schema: _schema,
                table: "OperationsVisits",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsVisits_DistributorId",
                schema: _schema,
                table: "OperationsVisits",
                column: "DistributorId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsVisits_Status",
                schema: _schema,
                table: "OperationsVisits",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperationsFillingQueues",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsJarConditions",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsLoadings",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsQuarantines",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsUnloadings",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsVisits",
                schema: _schema);
        }
    }
}
