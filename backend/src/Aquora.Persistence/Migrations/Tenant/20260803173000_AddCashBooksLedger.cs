using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    [DbContext(typeof(TenantDbContext))]
    [Migration("20260803173000_AddCashBooksLedger")]
    public partial class AddCashBooksLedger : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""BankLedgerEntries"" ALTER COLUMN ""BankAccountId"" DROP NOT NULL;
                ALTER TABLE ""{_schema}"".""SimpleExpenses"" ADD COLUMN IF NOT EXISTS ""CashBookId"" uuid NULL;
                ALTER TABLE ""{_schema}"".""BankLedgerEntries"" ADD COLUMN IF NOT EXISTS ""CashBookId"" uuid NULL;
                ALTER TABLE ""{_schema}"".""BankLedgerEntries"" ADD COLUMN IF NOT EXISTS ""LedgerAccountType"" text NOT NULL DEFAULT 'BankAccount';

                CREATE TABLE IF NOT EXISTS ""{_schema}"".""CashBooks"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""Name"" text NOT NULL,
                    ""Description"" text NULL,
                    ""OpeningBalance"" numeric NOT NULL DEFAULT 0.0,
                    ""CurrentBalance"" numeric NOT NULL DEFAULT 0.0,
                    ""Status"" text NOT NULL DEFAULT 'Active',
                    ""Notes"" text NULL,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );

                CREATE INDEX IF NOT EXISTS ""IX_SimpleExpenses_CashBookId"" ON ""{_schema}"".""SimpleExpenses"" (""CashBookId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerEntries_CashBookId"" ON ""{_schema}"".""BankLedgerEntries"" (""CashBookId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerEntries_LedgerAccountType"" ON ""{_schema}"".""BankLedgerEntries"" (""LedgerAccountType"");
                CREATE INDEX IF NOT EXISTS ""IX_CashBooks_CompanyId"" ON ""{_schema}"".""CashBooks"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_CashBooks_TenantId"" ON ""{_schema}"".""CashBooks"" (""TenantId"");
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DROP TABLE IF EXISTS ""{_schema}"".""CashBooks"";
            ");
        }
    }
}
