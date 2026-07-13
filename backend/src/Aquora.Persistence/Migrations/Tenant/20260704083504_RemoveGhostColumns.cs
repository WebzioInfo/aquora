using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class RemoveGhostColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var schema = Aquora.Persistence.Context.TenantSchemaResolver.CurrentSchemaName ?? "public";

            migrationBuilder.Sql($@"
                ALTER TABLE {schema}.""Brands"" DROP COLUMN IF EXISTS ""TenantId"" CASCADE;
                ALTER TABLE {schema}.""Brands"" DROP COLUMN IF EXISTS ""CompanyId"" CASCADE;
                ALTER TABLE {schema}.""Products"" DROP COLUMN IF EXISTS ""TenantId"" CASCADE;
                ALTER TABLE {schema}.""Products"" DROP COLUMN IF EXISTS ""CompanyId"" CASCADE;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Empty down migration because we don't want to bring back ghost columns
        }
    }
}
