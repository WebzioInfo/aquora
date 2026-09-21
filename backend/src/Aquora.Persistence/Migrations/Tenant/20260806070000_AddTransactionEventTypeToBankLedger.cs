using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    [DbContext(typeof(TenantDbContext))]
    [Migration("20260806070000_AddTransactionEventTypeToBankLedger")]
    public partial class AddTransactionEventTypeToBankLedger : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EventType",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "text",
                nullable: true,
                defaultValue: "CREATED");

            migrationBuilder.AddColumn<string>(
                name: "EventLabel",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuditNotes",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.Sql($@"UPDATE ""{_schema}"".""BankLedgerEntries"" SET ""EventType"" = 'CREATED' WHERE ""EventType"" IS NULL OR ""EventType"" = '';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EventType",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "EventLabel",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "AuditNotes",
                schema: _schema,
                table: "BankLedgerEntries");
        }
    }
}
