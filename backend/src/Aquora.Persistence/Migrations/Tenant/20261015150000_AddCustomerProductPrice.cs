using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20261015150000_AddCustomerProductPrice")]
    public partial class AddCustomerProductPrice : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                CREATE TABLE IF NOT EXISTS ""{_schema}"".""CustomerProductPrices"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""CustomerId"" uuid NOT NULL,
                    ""ProductId"" uuid NOT NULL,
                    ""CustomPrice"" numeric NOT NULL DEFAULT 0.0,
                    ""DiscountPercentage"" numeric NULL,
                    ""EffectiveFrom"" timestamp with time zone NULL,
                    ""EffectiveTo"" timestamp with time zone NULL,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""Notes"" text NULL,
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

                CREATE INDEX IF NOT EXISTS ""IX_CustomerProductPrices_Lookup"" 
                    ON ""{_schema}"".""CustomerProductPrices"" (""TenantId"", ""CustomerId"", ""ProductId"", ""IsActive"", ""IsDeleted"");

                -- Also ensure SalesTransactions table has PaymentTerms column
                ALTER TABLE ""{_schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""PaymentTerms"" text NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DROP TABLE IF EXISTS ""{_schema}"".""CustomerProductPrices"";
                ALTER TABLE ""{_schema}"".""SalesTransactions"" DROP COLUMN IF EXISTS ""PaymentTerms"";
            ");
        }
    }
}
