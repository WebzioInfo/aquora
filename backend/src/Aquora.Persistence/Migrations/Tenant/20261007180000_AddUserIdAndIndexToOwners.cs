using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20261007180000_AddUserIdAndIndexToOwners")]
    public partial class AddUserIdAndIndexToOwners : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                -- Ensure Owners table has UserId column
                ALTER TABLE ""{_schema}"".""Owners"" ADD COLUMN IF NOT EXISTS ""UserId"" uuid NULL;

                -- Ensure unique index per tenant on UserId when UserId is not null and not deleted
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Owners_TenantId_UserId_{_schema}"" 
                    ON ""{_schema}"".""Owners"" (""TenantId"", ""UserId"") 
                    WHERE ""UserId"" IS NOT NULL AND ""IsDeleted"" = false;

                -- Automatic safe reconciliation: Link any existing Owner without UserId by email match to Users
                UPDATE ""{_schema}"".""Owners"" o
                SET ""UserId"" = u.""Id""
                FROM public.""Users"" u
                WHERE o.""UserId"" IS NULL
                  AND o.""TenantId"" = u.""TenantId""
                  AND o.""Email"" IS NOT NULL
                  AND LOWER(TRIM(o.""Email"")) = LOWER(TRIM(u.""Email""))
                  AND u.""IsDeleted"" = false
                  AND o.""IsDeleted"" = false;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DROP INDEX IF EXISTS ""{_schema}"".""IX_Owners_TenantId_UserId_{_schema}"";
                ALTER TABLE ""{_schema}"".""Owners"" DROP COLUMN IF EXISTS ""UserId"";
            ");
        }
    }
}
