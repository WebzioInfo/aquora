using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20261005183000_AddDescriptionAndIndexesToCaseConfigurations")]
    public partial class AddDescriptionAndIndexesToCaseConfigurations : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                -- Ensure CaseConfigurations table columns and indexes exist
                CREATE TABLE IF NOT EXISTS ""{_schema}"".""CaseConfigurations"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""Name"" text NOT NULL DEFAULT '',
                    ""Description"" text NULL,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""ProductId"" uuid NULL,
                    ""UnitsPerCase"" integer NOT NULL DEFAULT 24,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
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

                ALTER TABLE ""{_schema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Name"" text NOT NULL DEFAULT '';
                ALTER TABLE ""{_schema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;
                ALTER TABLE ""{_schema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""ProductId"" uuid NULL;
                ALTER TABLE ""{_schema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""UnitsPerCase"" integer NOT NULL DEFAULT 24;

                CREATE INDEX IF NOT EXISTS ""IX_CaseConfigurations_TenantId_ProductId_{_schema}"" ON ""{_schema}"".""CaseConfigurations"" (""TenantId"", ""ProductId"");
                CREATE INDEX IF NOT EXISTS ""IX_CaseConfigurations_CompanyId_{_schema}"" ON ""{_schema}"".""CaseConfigurations"" (""CompanyId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DROP INDEX IF EXISTS ""{_schema}"".""IX_CaseConfigurations_TenantId_ProductId_{_schema}"";
                DROP INDEX IF EXISTS ""{_schema}"".""IX_CaseConfigurations_CompanyId_{_schema}"";
            ");
        }
    }
}
