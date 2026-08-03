using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddBankLedgerAuditEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "PaymentTerms",
                schema: "public",
                table: "Customers",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateTable(
                name: "BankLedgerAuditEntries",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankLedgerEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    OldAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    NewAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankLedgerAuditEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankLedgerAuditEntries_BankLedgerEntries_BankLedgerEntryId",
                        column: x => x.BankLedgerEntryId,
                        principalSchema: "public",
                        principalTable: "BankLedgerEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BankLedgerAuditEntries_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerAuditEntries_BankLedgerEntryId",
                schema: "public",
                table: "BankLedgerAuditEntries",
                column: "BankLedgerEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerAuditEntries_CompanyId",
                schema: "public",
                table: "BankLedgerAuditEntries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerAuditEntries_TenantId",
                schema: "public",
                table: "BankLedgerAuditEntries",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BankLedgerAuditEntries",
                schema: "public");

            migrationBuilder.AlterColumn<string>(
                name: "PaymentTerms",
                schema: "public",
                table: "Customers",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
