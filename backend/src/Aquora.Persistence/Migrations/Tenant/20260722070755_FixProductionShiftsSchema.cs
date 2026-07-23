using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class FixProductionShiftsSchema : Migration
    {
        private string _schema => Aquora.Persistence.Context.TenantSchemaResolver.CurrentSchemaName ?? "public";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
            CREATE TABLE IF NOT EXISTS {_schema}.""ProductionShifts"" (
                ""Id"" uuid NOT NULL,
                ""Name"" text NOT NULL,
                ""StartTime"" text NOT NULL,
                ""EndTime"" text NOT NULL,
                ""IsActive"" boolean NOT NULL,
                ""TenantId"" uuid NOT NULL,
                ""CompanyId"" uuid NOT NULL,
                ""CreatedBy"" text NULL,
                ""UpdatedBy"" text NULL,
                ""DeletedBy"" text NULL,
                ""CreatedByIP"" text NULL,
                ""UpdatedByIP"" text NULL,
                ""DeletedByIP"" text NULL,
                ""CreatedAt"" timestamp with time zone NOT NULL,
                ""UpdatedAt"" timestamp with time zone NULL,
                ""DeletedAt"" timestamp with time zone NULL,
                ""IsDeleted"" boolean NOT NULL,
                CONSTRAINT ""PK_ProductionShifts"" PRIMARY KEY (""Id"")
            );");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
