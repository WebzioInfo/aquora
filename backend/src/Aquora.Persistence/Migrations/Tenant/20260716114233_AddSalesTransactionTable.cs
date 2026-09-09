using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddSalesTransactionTable : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Machines",
                schema: _schema);

            migrationBuilder.CreateTable(
                name: "SalesTransactions",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cases = table.Column<decimal>(type: "numeric", nullable: false),
                    TransactionType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReferenceNumber = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_SalesTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesTransactions_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SalesTransactions_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalSchema: _schema,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SalesTransactions_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: _schema,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_CompanyId",
                schema: _schema,
                table: "SalesTransactions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_CreatedAt",
                schema: _schema,
                table: "SalesTransactions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_CustomerId",
                schema: _schema,
                table: "SalesTransactions",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_ProductId",
                schema: _schema,
                table: "SalesTransactions",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_TransactionDate",
                schema: _schema,
                table: "SalesTransactions",
                column: "TransactionDate");

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_TransactionType",
                schema: _schema,
                table: "SalesTransactions",
                column: "TransactionType");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SalesTransactions",
                schema: _schema);

            migrationBuilder.CreateTable(
                name: "Machines",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    StationId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_Machines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Machines_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: _schema,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Machines_Stations_StationId",
                        column: x => x.StationId,
                        principalSchema: _schema,
                        principalTable: "Stations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Machines_CompanyId",
                schema: _schema,
                table: "Machines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_StationId",
                schema: _schema,
                table: "Machines",
                column: "StationId");
        }
    }
}
