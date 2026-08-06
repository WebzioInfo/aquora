using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    public partial class AddTransactionEventTypeToBankLedger : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EventType",
                table: "BankLedgerEntries",
                type: "text",
                nullable: true,
                defaultValue: "CREATED");

            migrationBuilder.AddColumn<string>(
                name: "EventLabel",
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditNotes",
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("UPDATE \"BankLedgerEntries\" SET \"EventType\" = 'CREATED' WHERE \"EventType\" IS NULL OR \"EventType\" = '';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EventType",
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "EventLabel",
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "AuditNotes",
                table: "BankLedgerEntries");
        }
    }
}
