using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    public partial class AddCashBooksLedger : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "BankAccountId",
                table: "BankLedgerEntries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CashBookId",
                table: "SimpleExpenses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CashBookId",
                table: "BankLedgerEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LedgerAccountType",
                table: "BankLedgerEntries",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "BankAccount");

            migrationBuilder.CreateTable(
                name: "CashBooks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    OpeningBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashBooks", x => x.Id);
                    table.ForeignKey("FK_CashBooks_Companies_CompanyId", x => x.CompanyId, "Companies", "Id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_SimpleExpenses_CashBookId", "SimpleExpenses", "CashBookId");
            migrationBuilder.CreateIndex("IX_BankLedgerEntries_CashBookId", "BankLedgerEntries", "CashBookId");
            migrationBuilder.CreateIndex("IX_BankLedgerEntries_LedgerAccountType", "BankLedgerEntries", "LedgerAccountType");
            migrationBuilder.CreateIndex("IX_CashBooks_CompanyId", "CashBooks", "CompanyId");
            migrationBuilder.CreateIndex("IX_CashBooks_TenantId", "CashBooks", "TenantId");

            migrationBuilder.AddForeignKey("FK_SimpleExpenses_CashBooks_CashBookId", "SimpleExpenses", "CashBookId", "CashBooks", principalColumn: "Id", onDelete: ReferentialAction.SetNull);
            migrationBuilder.AddForeignKey("FK_BankLedgerEntries_CashBooks_CashBookId", "BankLedgerEntries", "CashBookId", "CashBooks", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey("FK_BankLedgerEntries_CashBooks_CashBookId", "BankLedgerEntries");
            migrationBuilder.DropForeignKey("FK_SimpleExpenses_CashBooks_CashBookId", "SimpleExpenses");
            migrationBuilder.DropTable("CashBooks");
            migrationBuilder.DropIndex("IX_SimpleExpenses_CashBookId", "SimpleExpenses");
            migrationBuilder.DropIndex("IX_BankLedgerEntries_CashBookId", "BankLedgerEntries");
            migrationBuilder.DropIndex("IX_BankLedgerEntries_LedgerAccountType", "BankLedgerEntries");
            migrationBuilder.DropColumn("CashBookId", "SimpleExpenses");
            migrationBuilder.DropColumn("CashBookId", "BankLedgerEntries");
            migrationBuilder.DropColumn("LedgerAccountType", "BankLedgerEntries");
            migrationBuilder.AlterColumn<Guid>(name: "BankAccountId", table: "BankLedgerEntries", type: "uuid", nullable: false, defaultValue: Guid.Empty, oldClrType: typeof(Guid), oldType: "uuid", oldNullable: true);
        }
    }
}
