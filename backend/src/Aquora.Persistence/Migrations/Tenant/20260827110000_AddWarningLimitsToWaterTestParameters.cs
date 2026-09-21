using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20260827110000_AddWarningLimitsToWaterTestParameters")]
    public partial class AddWarningLimitsToWaterTestParameters : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""WaterTestParameters"" ADD COLUMN IF NOT EXISTS ""MinWarning"" double precision NULL;
                ALTER TABLE ""{_schema}"".""WaterTestParameters"" ADD COLUMN IF NOT EXISTS ""MaxWarning"" double precision NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""WaterTestParameters"" DROP COLUMN IF EXISTS ""MinWarning"";
                ALTER TABLE ""{_schema}"".""WaterTestParameters"" DROP COLUMN IF EXISTS ""MaxWarning"";
            ");
        }
    }
}
