using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20261010140000_AddOwnerIdToCashBooks")]
    public partial class AddOwnerIdToCashBooks : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                -- 1. Ensure CashBooks table has OwnerId column
                ALTER TABLE ""{_schema}"".""CashBooks"" ADD COLUMN IF NOT EXISTS ""OwnerId"" uuid NULL;

                -- 2. Index on (TenantId, OwnerId)
                CREATE INDEX IF NOT EXISTS ""IX_CashBooks_TenantId_OwnerId_{_schema}"" 
                    ON ""{_schema}"".""CashBooks"" (""TenantId"", ""OwnerId"") 
                    WHERE ""OwnerId"" IS NOT NULL AND ""IsDeleted"" = false;

                -- 3. Backfill existing owner cashbooks unambiguously:
                -- Match A: BankLedgerEntries linked to an Owner
                UPDATE ""{_schema}"".""CashBooks"" cb
                SET ""OwnerId"" = ble.""RelatedEntityId""
                FROM ""{_schema}"".""BankLedgerEntries"" ble
                WHERE cb.""Id"" = ble.""CashBookId""
                  AND ble.""RelatedEntityType"" = 'Owner'
                  AND ble.""RelatedEntityId"" IS NOT NULL
                  AND cb.""OwnerId"" IS NULL
                  AND cb.""TenantId"" = ble.""TenantId""
                  AND cb.""IsDeleted"" = false;

                -- Match B: BankLedgerEntries linked to OwnerInvestmentTransaction
                UPDATE ""{_schema}"".""CashBooks"" cb
                SET ""OwnerId"" = oit.""OwnerId""
                FROM ""{_schema}"".""BankLedgerEntries"" ble
                JOIN ""{_schema}"".""OwnerInvestmentTransactions"" oit ON ble.""RelatedEntityId"" = oit.""Id""
                WHERE cb.""Id"" = ble.""CashBookId""
                  AND ble.""RelatedEntityType"" = 'OwnerInvestmentTransaction'
                  AND cb.""OwnerId"" IS NULL
                  AND cb.""TenantId"" = ble.""TenantId""
                  AND cb.""IsDeleted"" = false;

                -- Match C: Dedicated cashbook descriptions created for owner
                UPDATE ""{_schema}"".""CashBooks"" cb
                SET ""OwnerId"" = o.""Id""
                FROM ""{_schema}"".""Owners"" o
                WHERE cb.""OwnerId"" IS NULL
                  AND cb.""TenantId"" = o.""TenantId""
                  AND cb.""IsDeleted"" = false
                  AND o.""IsDeleted"" = false
                  AND (LOWER(TRIM(cb.""Description"")) = LOWER('Dedicated cashbook for owner ' || TRIM(o.""Name""))
                       OR LOWER(TRIM(cb.""Notes"")) = LOWER('Created automatically for owner ' || TRIM(o.""Name"")));
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DROP INDEX IF EXISTS ""{_schema}"".""IX_CashBooks_TenantId_OwnerId_{_schema}"";
                ALTER TABLE ""{_schema}"".""CashBooks"" DROP COLUMN IF EXISTS ""OwnerId"";
            ");
        }
    }
}
