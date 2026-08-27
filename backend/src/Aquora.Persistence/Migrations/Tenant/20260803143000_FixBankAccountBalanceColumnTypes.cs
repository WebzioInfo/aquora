using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    public partial class FixBankAccountBalanceColumnTypes : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var targetSchema = TenantSchemaResolver.ResolveRequiredSchema();
            var tableRef = !string.IsNullOrWhiteSpace(targetSchema) 
                ? $"{QuoteIdentifier(targetSchema)}.\"BankAccounts\"" 
                : "\"BankAccounts\"";

            migrationBuilder.Sql($@"
                ALTER TABLE {tableRef}
                    ALTER COLUMN ""OpeningBalance"" DROP DEFAULT,
                    ALTER COLUMN ""OpeningBalance"" TYPE numeric USING COALESCE(NULLIF(trim(""OpeningBalance""::text), ''), '0')::numeric,
                    ALTER COLUMN ""OpeningBalance"" SET DEFAULT 0.0,
                    ALTER COLUMN ""OpeningBalance"" SET NOT NULL;

                ALTER TABLE {tableRef}
                    ALTER COLUMN ""CurrentBalance"" DROP DEFAULT,
                    ALTER COLUMN ""CurrentBalance"" TYPE numeric USING COALESCE(NULLIF(trim(""CurrentBalance""::text), ''), '0')::numeric,
                    ALTER COLUMN ""CurrentBalance"" SET DEFAULT 0.0,
                    ALTER COLUMN ""CurrentBalance"" SET NOT NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var targetSchema = TenantSchemaResolver.ResolveRequiredSchema();
            var tableRef = !string.IsNullOrWhiteSpace(targetSchema) 
                ? $"{QuoteIdentifier(targetSchema)}.\"BankAccounts\"" 
                : "\"BankAccounts\"";

            migrationBuilder.Sql($@"
                ALTER TABLE {tableRef}
                    ALTER COLUMN ""OpeningBalance"" DROP DEFAULT,
                    ALTER COLUMN ""OpeningBalance"" TYPE text USING ""OpeningBalance""::text,
                    ALTER COLUMN ""OpeningBalance"" DROP NOT NULL;

                ALTER TABLE {tableRef}
                    ALTER COLUMN ""CurrentBalance"" DROP DEFAULT,
                    ALTER COLUMN ""CurrentBalance"" TYPE text USING ""CurrentBalance""::text,
                    ALTER COLUMN ""CurrentBalance"" DROP NOT NULL;
            ");
        }

        private static string QuoteIdentifier(string value)
        {
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
    }
}
