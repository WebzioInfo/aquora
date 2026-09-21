using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    /// <inheritdoc />
    public partial class AddUserProfileAndQcFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"AssignedLabStation\" text;");
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"CertificationDetails\" text;");
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"ExperienceYears\" integer;");
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"QcResponsibilities\" text;");
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"Qualification\" text;");
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"SignatureUrl\" text;");
            migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Tenants_SchemaName\" ON public.\"Tenants\" (\"SchemaName\");");
            migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Tenants_Subdomain\" ON public.\"Tenants\" (\"Subdomain\");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tenants_SchemaName",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_Subdomain",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "AssignedLabStation",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CertificationDetails",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ExperienceYears",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "QcResponsibilities",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Qualification",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SignatureUrl",
                schema: "public",
                table: "Users");
        }
    }
}
