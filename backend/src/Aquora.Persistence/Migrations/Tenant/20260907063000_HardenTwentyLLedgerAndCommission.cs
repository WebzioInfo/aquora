using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant;

[DbContext(typeof(TenantDbContext))]
[Migration("20260907063000_HardenTwentyLLedgerAndCommission")]
public partial class HardenTwentyLLedgerAndCommission : Migration
{
    private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            ALTER TABLE ""{_schema}"".""TwentyLJarMovements"" ADD COLUMN IF NOT EXISTS ""HolderType"" text NOT NULL DEFAULT 'COMPANY';
            ALTER TABLE ""{_schema}"".""TwentyLJarMovements"" ADD COLUMN IF NOT EXISTS ""HolderCustomerId"" uuid NULL;
            ALTER TABLE ""{_schema}"".""TwentyLRateRules"" ADD COLUMN IF NOT EXISTS ""Priority"" integer NOT NULL DEFAULT 0;

            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLCommissionRules"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""BeneficiaryCustomerId"" uuid NULL,
                ""ProductId"" uuid NULL,
                ""BeneficiaryType"" text NOT NULL DEFAULT 'EMPLOYEE',
                ""CalculationType"" text NOT NULL DEFAULT 'PERCENTAGE',
                ""Value"" numeric NOT NULL DEFAULT 0.0,
                ""MinimumQuantity"" numeric NOT NULL DEFAULT 0.0,
                ""EffectiveFrom"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""EffectiveTo"" timestamp with time zone NULL,
                ""Priority"" integer NOT NULL DEFAULT 0,
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

            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLCommissionTransactions"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""DeliveryId"" uuid NOT NULL,
                ""RuleId"" uuid NULL,
                ""BeneficiaryCustomerId"" uuid NULL,
                ""BeneficiaryType"" text NOT NULL DEFAULT 'EMPLOYEE',
                ""TransactionType"" text NOT NULL DEFAULT 'EARNED',
                ""Amount"" numeric NOT NULL DEFAULT 0.0,
                ""OccurredAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""ReversalOfId"" uuid NULL,
                ""Reason"" text NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );

            CREATE INDEX IF NOT EXISTS ""IX_TwentyLCommissionRules_Effective"" ON ""{_schema}"".""TwentyLCommissionRules"" (""TenantId"", ""BeneficiaryCustomerId"", ""ProductId"", ""EffectiveFrom"", ""EffectiveTo"");
            CREATE INDEX IF NOT EXISTS ""IX_TwentyLCommissionTransactions_Delivery"" ON ""{_schema}"".""TwentyLCommissionTransactions"" (""TenantId"", ""DeliveryId"", ""BeneficiaryCustomerId"");
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLCommissionTransactions"";
            DROP TABLE IF EXISTS ""{_schema}"".""TwentyLCommissionRules"";
        ");
    }
}
