using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20261017150000_AddWaterWastageLitresToProductionEntry")]
    public partial class AddWaterWastageLitresToProductionEntry : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                -- Ensure ProductionEntries table has WaterWastageLitres column
                ALTER TABLE ""{_schema}"".""ProductionEntries"" 
                ADD COLUMN IF NOT EXISTS ""WaterWastageLitres"" numeric(18,2) NOT NULL DEFAULT 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""ProductionEntries"" 
                DROP COLUMN IF EXISTS ""WaterWastageLitres"";
            ");
        }
    }
}
