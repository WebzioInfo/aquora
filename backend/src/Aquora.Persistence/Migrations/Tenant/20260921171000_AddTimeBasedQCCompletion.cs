using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20260921171000_AddTimeBasedQCCompletion")]
    public partial class AddTimeBasedQCCompletion : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""WaterTestParameters"" ADD COLUMN IF NOT EXISTS ""RequiredDurationHours"" integer NOT NULL DEFAULT 0;

                ALTER TABLE ""{_schema}"".""WaterTestResults"" ADD COLUMN IF NOT EXISTS ""RequiredDurationHours"" integer NOT NULL DEFAULT 0;
                ALTER TABLE ""{_schema}"".""WaterTestResults"" ADD COLUMN IF NOT EXISTS ""StartedAt"" timestamp with time zone NULL;
                ALTER TABLE ""{_schema}"".""WaterTestResults"" ADD COLUMN IF NOT EXISTS ""ExpectedCompletionAt"" timestamp with time zone NULL;
                ALTER TABLE ""{_schema}"".""WaterTestResults"" ADD COLUMN IF NOT EXISTS ""ActualCompletedAt"" timestamp with time zone NULL;
                ALTER TABLE ""{_schema}"".""WaterTestResults"" ADD COLUMN IF NOT EXISTS ""ResultStatus"" text NOT NULL DEFAULT 'COMPLETED';

                UPDATE ""{_schema}"".""WaterTestResults"" 
                SET ""ResultStatus"" = 'COMPLETED' 
                WHERE ""ResultStatus"" IS NULL OR ""ResultStatus"" = '';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                ALTER TABLE ""{_schema}"".""WaterTestParameters"" DROP COLUMN IF EXISTS ""RequiredDurationHours"";

                ALTER TABLE ""{_schema}"".""WaterTestResults"" DROP COLUMN IF EXISTS ""RequiredDurationHours"";
                ALTER TABLE ""{_schema}"".""WaterTestResults"" DROP COLUMN IF EXISTS ""StartedAt"";
                ALTER TABLE ""{_schema}"".""WaterTestResults"" DROP COLUMN IF EXISTS ""ExpectedCompletionAt"";
                ALTER TABLE ""{_schema}"".""WaterTestResults"" DROP COLUMN IF EXISTS ""ActualCompletedAt"";
                ALTER TABLE ""{_schema}"".""WaterTestResults"" DROP COLUMN IF EXISTS ""ResultStatus"";
            ");
        }
    }
}
