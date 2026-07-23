using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddProductionSession : Migration
    {
        private string _schema => TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProductionSessionId",
                schema: _schema,
                table: "ProductionEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProductionSessions",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchNumber = table.Column<string>(type: "text", nullable: false),
                    ProductionLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    OperatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    OperatorName = table.Column<string>(type: "text", nullable: false),
                    Shift = table.Column<string>(type: "text", nullable: false),
                    SkuProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    CaseConfigurationId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    TotalCasesProduced = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_ProductionSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionSessions_CaseConfigurations_CaseConfigurationId",
                        column: x => x.CaseConfigurationId,
                        principalSchema: _schema,
                        principalTable: "CaseConfigurations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionSessions_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionSessions_ProductionLines_ProductionLineId",
                        column: x => x.ProductionLineId,
                        principalSchema: _schema,
                        principalTable: "ProductionLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionSessions_SkuProducts_SkuProductId",
                        column: x => x.SkuProductId,
                        principalSchema: _schema,
                        principalTable: "SkuProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_ProductionSessionId",
                schema: _schema,
                table: "ProductionEntries",
                column: "ProductionSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionSessions_CaseConfigurationId",
                schema: _schema,
                table: "ProductionSessions",
                column: "CaseConfigurationId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionSessions_CompanyId",
                schema: _schema,
                table: "ProductionSessions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionSessions_ProductionLineId",
                schema: _schema,
                table: "ProductionSessions",
                column: "ProductionLineId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionSessions_SkuProductId",
                schema: _schema,
                table: "ProductionSessions",
                column: "SkuProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_ProductionSessions_ProductionSessionId",
                schema: _schema,
                table: "ProductionEntries",
                column: "ProductionSessionId",
                principalSchema: _schema,
                principalTable: "ProductionSessions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_ProductionSessions_ProductionSessionId",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropTable(
                name: "ProductionSessions",
                schema: _schema);

            migrationBuilder.DropIndex(
                name: "IX_ProductionEntries_ProductionSessionId",
                schema: _schema,
                table: "ProductionEntries");

            migrationBuilder.DropColumn(
                name: "ProductionSessionId",
                schema: _schema,
                table: "ProductionEntries");
        }
    }
}
