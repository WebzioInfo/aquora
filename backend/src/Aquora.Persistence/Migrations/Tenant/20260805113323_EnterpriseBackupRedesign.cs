using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class EnterpriseBackupRedesign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Encryption",
                schema: "public",
                table: "BackupHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EngineVersion",
                schema: "public",
                table: "BackupHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "RestoreCount",
                schema: "public",
                table: "BackupHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TableCount",
                schema: "public",
                table: "BackupHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TenantName",
                schema: "public",
                table: "BackupHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Version",
                schema: "public",
                table: "BackupHistories",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Encryption",
                schema: "public",
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "EngineVersion",
                schema: "public",
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "RestoreCount",
                schema: "public",
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "TableCount",
                schema: "public",
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "TenantName",
                schema: "public",
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "Version",
                schema: "public",
                table: "BackupHistories");
        }
    }
}
