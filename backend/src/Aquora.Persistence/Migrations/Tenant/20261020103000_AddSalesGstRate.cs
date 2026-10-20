using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    [DbContext(typeof(TenantDbContext))]
    [Migration("20261020103000_AddSalesGstRate")]
    public partial class AddSalesGstRate : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""GstRate"" numeric NOT NULL DEFAULT 0;
                ALTER TABLE ""{_schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""IsGstApplicable"" boolean NOT NULL DEFAULT false;
                ALTER TABLE ""{_schema}"".""SalesTransactions"" ADD COLUMN IF NOT EXISTS ""TaxTreatment"" text NULL;
                ALTER TABLE ""{_schema}"".""Products"" ADD COLUMN IF NOT EXISTS ""GstRate"" numeric NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""SalesTransactions"" DROP COLUMN IF EXISTS ""GstRate"";
                ALTER TABLE ""{_schema}"".""SalesTransactions"" DROP COLUMN IF EXISTS ""IsGstApplicable"";
                ALTER TABLE ""{_schema}"".""SalesTransactions"" DROP COLUMN IF EXISTS ""TaxTreatment"";
                ALTER TABLE ""{_schema}"".""Products"" DROP COLUMN IF EXISTS ""GstRate"";
            ");
        }
    }
}
