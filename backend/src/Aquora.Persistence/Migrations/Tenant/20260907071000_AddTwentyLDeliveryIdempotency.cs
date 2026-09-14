using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Aquora.Persistence.Migrations.Tenant;

[DbContext(typeof(TenantDbContext))]
[Migration("20260907071000_AddTwentyLDeliveryIdempotency")]
public partial class AddTwentyLDeliveryIdempotency : Migration
{
    private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            ALTER TABLE ""{_schema}"".""TwentyLDeliveries"" ADD COLUMN IF NOT EXISTS ""IdempotencyKey"" text NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLDeliveries_TenantId_IdempotencyKey"" ON ""{_schema}"".""TwentyLDeliveries"" (""TenantId"", ""IdempotencyKey"");
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            DROP INDEX IF EXISTS ""{_schema}"".""IX_TwentyLDeliveries_TenantId_IdempotencyKey"";
            ALTER TABLE ""{_schema}"".""TwentyLDeliveries"" DROP COLUMN IF EXISTS ""IdempotencyKey"";
        ");
    }
}
