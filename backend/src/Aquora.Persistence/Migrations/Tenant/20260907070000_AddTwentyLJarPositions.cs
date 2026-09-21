using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Aquora.Persistence.Migrations.Tenant;

[DbContext(typeof(TenantDbContext))]
[Migration("20260907070000_AddTwentyLJarPositions")]
public partial class AddTwentyLJarPositions : Migration
{
    private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"
            CREATE TABLE IF NOT EXISTS ""{_schema}"".""TwentyLJarPositions"" (
                ""Id"" uuid NOT NULL PRIMARY KEY,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""PositionKey"" text NOT NULL,
                ""ProductId"" uuid NULL,
                ""OwnerType"" text NOT NULL DEFAULT 'COMPANY',
                ""OwnerCustomerId"" uuid NULL,
                ""HolderType"" text NOT NULL DEFAULT 'COMPANY',
                ""HolderCustomerId"" uuid NULL,
                ""LocationType"" text NOT NULL DEFAULT 'PLANT',
                ""LocationReference"" text NULL,
                ""ContainerStatus"" text NOT NULL DEFAULT 'EMPTY',
                ""Quantity"" integer NOT NULL DEFAULT 0,
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                ""UpdatedAt"" timestamp with time zone NULL,
                ""UpdatedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TwentyLJarPositions_Position"" ON ""{_schema}"".""TwentyLJarPositions"" (""TenantId"", ""CompanyId"", ""PositionKey"");
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($@"DROP TABLE IF EXISTS ""{_schema}"".""TwentyLJarPositions"";");
    }
}
