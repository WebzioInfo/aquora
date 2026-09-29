using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    public partial class AddCloudinaryPublicIds : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"PhotoPublicId\" text;");
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" ADD COLUMN IF NOT EXISTS \"SignaturePublicId\" text;");
            migrationBuilder.Sql("ALTER TABLE public.\"Tenants\" ADD COLUMN IF NOT EXISTS \"LogoPublicId\" text;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" DROP COLUMN IF EXISTS \"PhotoPublicId\";");
            migrationBuilder.Sql("ALTER TABLE public.\"Users\" DROP COLUMN IF EXISTS \"SignaturePublicId\";");
            migrationBuilder.Sql("ALTER TABLE public.\"Tenants\" DROP COLUMN IF EXISTS \"LogoPublicId\";");
        }
    }
}
