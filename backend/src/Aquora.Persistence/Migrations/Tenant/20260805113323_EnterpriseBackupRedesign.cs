using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class EnterpriseBackupRedesign : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Encryption",
                schema: _schema,
                table: "BackupHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EngineVersion",
                schema: _schema,
                table: "BackupHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "RestoreCount",
                schema: _schema,
                table: "BackupHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TableCount",
                schema: _schema,
                table: "BackupHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TenantName",
                schema: _schema,
                table: "BackupHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Version",
                schema: _schema,
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
                schema: _schema,
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "EngineVersion",
                schema: _schema,
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "RestoreCount",
                schema: _schema,
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "TableCount",
                schema: _schema,
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "TenantName",
                schema: _schema,
                table: "BackupHistories");

            migrationBuilder.DropColumn(
                name: "Version",
                schema: _schema,
                table: "BackupHistories");
        }
    }
}
