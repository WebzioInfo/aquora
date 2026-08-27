using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    [DbContext(typeof(TenantDbContext))]
    [Migration("20260803170000_SynchronizeAccountsSchema")]
    public partial class SynchronizeAccountsSchema : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var schema = QuoteIdentifier(string.IsNullOrWhiteSpace(TenantSchemaResolver.ResolveRequiredSchema())
                ? "public"
                : TenantSchemaResolver.ResolveRequiredSchema());

            migrationBuilder.Sql($@"
                CREATE TABLE IF NOT EXISTS {schema}.""SimpleExpenses"" (
                    ""Id"" uuid NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""ExpenseNumber"" text NOT NULL,
                    ""ExpenseDate"" timestamp with time zone NOT NULL,
                    ""Category"" text NOT NULL,
                    ""Vendor"" text NULL,
                    ""Description"" text NOT NULL,
                    ""Amount"" numeric NOT NULL DEFAULT 0.0,
                    ""PaymentMethod"" text NOT NULL DEFAULT 'Cash',
                    ""BankAccountId"" uuid NULL,
                    ""Notes"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL,
                    CONSTRAINT ""PK_SimpleExpenses"" PRIMARY KEY (""Id"")
                );

                CREATE TABLE IF NOT EXISTS {schema}.""BankAccounts"" (
                    ""Id"" uuid NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""BankName"" text NOT NULL,
                    ""AccountName"" text NOT NULL,
                    ""AccountNumber"" text NOT NULL,
                    ""AccountType"" text NOT NULL DEFAULT 'Current',
                    ""Branch"" text NULL,
                    ""IFSC"" text NULL,
                    ""IfscCode"" text NOT NULL DEFAULT '',
                    ""OpeningBalance"" numeric NOT NULL DEFAULT 0.0,
                    ""CurrentBalance"" numeric NOT NULL DEFAULT 0.0,
                    ""Notes"" text NULL,
                    ""Status"" text NOT NULL DEFAULT 'Active',
                    ""LinkedLedgerAccountId"" uuid NULL,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL,
                    CONSTRAINT ""PK_BankAccounts"" PRIMARY KEY (""Id"")
                );
                CREATE TABLE IF NOT EXISTS {schema}.""BankLedgerEntries"" (
                    ""Id"" uuid NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""BankAccountId"" uuid NOT NULL,
                    ""TransactionDate"" timestamp with time zone NOT NULL,
                    ""ReferenceNumber"" text NOT NULL,
                    ""TransactionType"" text NOT NULL,
                    ""Description"" text NOT NULL,
                    ""Debit"" numeric NOT NULL DEFAULT 0.0,
                    ""Credit"" numeric NOT NULL DEFAULT 0.0,
                    ""RunningBalance"" numeric NOT NULL DEFAULT 0.0,
                    ""RelatedEntityId"" uuid NULL,
                    ""RelatedEntityType"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    CONSTRAINT ""PK_BankLedgerEntries"" PRIMARY KEY (""Id"")
                );

                CREATE TABLE IF NOT EXISTS {schema}.""BankLedgerAuditEntries"" (
                    ""Id"" uuid NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""BankLedgerEntryId"" uuid NOT NULL,
                    ""Action"" text NOT NULL,
                    ""OldAmount"" numeric NOT NULL DEFAULT 0.0,
                    ""NewAmount"" numeric NOT NULL DEFAULT 0.0,
                    ""Remarks"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    CONSTRAINT ""PK_BankLedgerAuditEntries"" PRIMARY KEY (""Id"")
                );

                CREATE TABLE IF NOT EXISTS {schema}.""Owners"" (
                    ""Id"" uuid NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""Name"" text NOT NULL,
                    ""Phone"" text NOT NULL,
                    ""Email"" text NULL,
                    ""OwnershipPercentage"" numeric NOT NULL DEFAULT 0.0,
                    ""InitialInvestment"" numeric NOT NULL DEFAULT 0.0,
                    ""CurrentInvestment"" numeric NOT NULL DEFAULT 0.0,
                    ""Notes"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL,
                    CONSTRAINT ""PK_Owners"" PRIMARY KEY (""Id"")
                );

                CREATE TABLE IF NOT EXISTS {schema}.""OwnerInvestmentTransactions"" (
                    ""Id"" uuid NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""OwnerId"" uuid NOT NULL,
                    ""TransactionDate"" timestamp with time zone NOT NULL,
                    ""Amount"" numeric NOT NULL DEFAULT 0.0,
                    ""TransactionType"" text NOT NULL DEFAULT 'Investment',
                    ""Notes"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL,
                    CONSTRAINT ""PK_OwnerInvestmentTransactions"" PRIMARY KEY (""Id"")
                );

                ALTER TABLE {schema}.""SimpleExpenses"" ADD COLUMN IF NOT EXISTS ""BankAccountId"" uuid NULL;
                ALTER TABLE {schema}.""BankAccounts"" ADD COLUMN IF NOT EXISTS ""OpeningBalance"" numeric NOT NULL DEFAULT 0.0;
                ALTER TABLE {schema}.""BankAccounts"" ADD COLUMN IF NOT EXISTS ""CurrentBalance"" numeric NOT NULL DEFAULT 0.0;
                ALTER TABLE {schema}.""BankAccounts"" ADD COLUMN IF NOT EXISTS ""Notes"" text NULL;
                ALTER TABLE {schema}.""BankAccounts"" ADD COLUMN IF NOT EXISTS ""Status"" text NOT NULL DEFAULT 'Active';
                ALTER TABLE {schema}.""BankAccounts"" ADD COLUMN IF NOT EXISTS ""IsDeleted"" boolean NOT NULL DEFAULT false;
                ALTER TABLE {schema}.""BankAccounts"" ADD COLUMN IF NOT EXISTS ""DeletedAt"" timestamp with time zone NULL;
                ALTER TABLE {schema}.""BankAccounts"" ADD COLUMN IF NOT EXISTS ""DeletedBy"" text NULL;

                ALTER TABLE {schema}.""BankAccounts""
                    ALTER COLUMN ""OpeningBalance"" TYPE numeric USING COALESCE(NULLIF(trim(""OpeningBalance""::text), ''), '0')::numeric,
                    ALTER COLUMN ""CurrentBalance"" TYPE numeric USING COALESCE(NULLIF(trim(""CurrentBalance""::text), ''), '0')::numeric;

                CREATE INDEX IF NOT EXISTS ""IX_SimpleExpenses_BankAccountId"" ON {schema}.""SimpleExpenses"" (""BankAccountId"");
                CREATE INDEX IF NOT EXISTS ""IX_SimpleExpenses_Category"" ON {schema}.""SimpleExpenses"" (""Category"");
                CREATE INDEX IF NOT EXISTS ""IX_SimpleExpenses_CompanyId"" ON {schema}.""SimpleExpenses"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_SimpleExpenses_ExpenseDate"" ON {schema}.""SimpleExpenses"" (""ExpenseDate"");
                CREATE INDEX IF NOT EXISTS ""IX_SimpleExpenses_TenantId"" ON {schema}.""SimpleExpenses"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankAccounts_CompanyId"" ON {schema}.""BankAccounts"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankAccounts_LinkedLedgerAccountId"" ON {schema}.""BankAccounts"" (""LinkedLedgerAccountId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankAccounts_TenantId"" ON {schema}.""BankAccounts"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerEntries_BankAccountId"" ON {schema}.""BankLedgerEntries"" (""BankAccountId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerEntries_CompanyId"" ON {schema}.""BankLedgerEntries"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerEntries_TenantId"" ON {schema}.""BankLedgerEntries"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerEntries_TransactionDate"" ON {schema}.""BankLedgerEntries"" (""TransactionDate"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerAuditEntries_BankLedgerEntryId"" ON {schema}.""BankLedgerAuditEntries"" (""BankLedgerEntryId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerAuditEntries_CompanyId"" ON {schema}.""BankLedgerAuditEntries"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_BankLedgerAuditEntries_TenantId"" ON {schema}.""BankLedgerAuditEntries"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_OwnerInvestmentTransactions_CompanyId"" ON {schema}.""OwnerInvestmentTransactions"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_OwnerInvestmentTransactions_OwnerId"" ON {schema}.""OwnerInvestmentTransactions"" (""OwnerId"");
                CREATE INDEX IF NOT EXISTS ""IX_Owners_CompanyId"" ON {schema}.""Owners"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_Owners_TenantId"" ON {schema}.""Owners"" (""TenantId"");
            ");

            AddForeignKeyIfMissing(migrationBuilder, "FK_BankAccounts_Accounts_LinkedLedgerAccountId", "BankAccounts", "LinkedLedgerAccountId", "Accounts", "Id", "NO ACTION");
            AddForeignKeyIfMissing(migrationBuilder, "FK_BankAccounts_Companies_CompanyId", "BankAccounts", "CompanyId", "Companies", "Id", "CASCADE");
            AddForeignKeyIfMissing(migrationBuilder, "FK_BankLedgerAuditEntries_BankLedgerEntries_BankLedgerEntryId", "BankLedgerAuditEntries", "BankLedgerEntryId", "BankLedgerEntries", "Id", "CASCADE");
            AddForeignKeyIfMissing(migrationBuilder, "FK_BankLedgerAuditEntries_Companies_CompanyId", "BankLedgerAuditEntries", "CompanyId", "Companies", "Id", "CASCADE");
            AddForeignKeyIfMissing(migrationBuilder, "FK_BankLedgerEntries_BankAccounts_BankAccountId", "BankLedgerEntries", "BankAccountId", "BankAccounts", "Id", "RESTRICT");
            AddForeignKeyIfMissing(migrationBuilder, "FK_BankLedgerEntries_Companies_CompanyId", "BankLedgerEntries", "CompanyId", "Companies", "Id", "CASCADE");
            AddForeignKeyIfMissing(migrationBuilder, "FK_SimpleExpenses_BankAccounts_BankAccountId", "SimpleExpenses", "BankAccountId", "BankAccounts", "Id", "SET NULL");
            AddForeignKeyIfMissing(migrationBuilder, "FK_SimpleExpenses_Companies_CompanyId", "SimpleExpenses", "CompanyId", "Companies", "Id", "CASCADE");
            AddForeignKeyIfMissing(migrationBuilder, "FK_Owners_Companies_CompanyId", "Owners", "CompanyId", "Companies", "Id", "CASCADE");
            AddForeignKeyIfMissing(migrationBuilder, "FK_OwnerInvestmentTransactions_Companies_CompanyId", "OwnerInvestmentTransactions", "CompanyId", "Companies", "Id", "CASCADE");
            AddForeignKeyIfMissing(migrationBuilder, "FK_OwnerInvestmentTransactions_Owners_OwnerId", "OwnerInvestmentTransactions", "OwnerId", "Owners", "Id", "CASCADE");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }

        private static void AddForeignKeyIfMissing(
            MigrationBuilder migrationBuilder,
            string constraintName,
            string table,
            string column,
            string principalTable,
            string principalColumn,
            string onDelete)
        {
            var schema = QuoteLiteral(string.IsNullOrWhiteSpace(TenantSchemaResolver.ResolveRequiredSchema())
                ? "public"
                : TenantSchemaResolver.ResolveRequiredSchema());

            migrationBuilder.Sql($@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint c
                        JOIN pg_namespace n ON n.oid = c.connamespace
                        WHERE c.conname = {QuoteLiteral(constraintName)}
                          AND n.nspname = {schema}
                    ) THEN
                        ALTER TABLE {QuoteIdentifier(TenantSchemaResolver.ResolveRequiredSchema())}.""{table}""
                        ADD CONSTRAINT ""{constraintName}""
                        FOREIGN KEY (""{column}"")
                        REFERENCES {QuoteIdentifier(TenantSchemaResolver.ResolveRequiredSchema())}.""{principalTable}"" (""{principalColumn}"")
                        ON DELETE {onDelete};
                    END IF;
                END $$;
            ");
        }

        private static string QuoteIdentifier(string value)
        {
            var identifier = string.IsNullOrWhiteSpace(value) ? "public" : value;
            return "\"" + identifier.Replace("\"", "\"\"") + "\"";
        }

        private static string QuoteLiteral(string value)
        {
            return "'" + value.Replace("'", "''") + "'";
        }
    }
}
