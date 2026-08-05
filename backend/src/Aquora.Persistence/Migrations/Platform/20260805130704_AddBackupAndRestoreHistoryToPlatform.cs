using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    /// <inheritdoc />
    public partial class AddBackupAndRestoreHistoryToPlatform : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BackupHistories",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SchemaName = table.Column<string>(type: "text", nullable: false),
                    BackupName = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    BackupSize = table.Column<long>(type: "bigint", nullable: false),
                    RecordCount = table.Column<int>(type: "integer", nullable: false),
                    Checksum = table.Column<string>(type: "text", nullable: false),
                    Hash = table.Column<string>(type: "text", nullable: false),
                    FilePath = table.Column<string>(type: "text", nullable: false),
                    Format = table.Column<string>(type: "text", nullable: true),
                    TenantName = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<string>(type: "text", nullable: true),
                    TableCount = table.Column<int>(type: "integer", nullable: false),
                    EngineVersion = table.Column<string>(type: "text", nullable: true),
                    RestoreCount = table.Column<int>(type: "integer", nullable: false),
                    Encryption = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    DownloadCount = table.Column<int>(type: "integer", nullable: false),
                    LastDownloaded = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CanRestore = table.Column<bool>(type: "boolean", nullable: false),
                    IsEmergencyBackup = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeAttachments = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeAuditLogs = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeUsers = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BackupHistories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RestoreHistories",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BackupId = table.Column<Guid>(type: "uuid", nullable: false),
                    SchemaName = table.Column<string>(type: "text", nullable: false),
                    StartedBy = table.Column<string>(type: "text", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    IPAddress = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RestoreHistories", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BackupHistories",
                schema: "public");

            migrationBuilder.DropTable(
                name: "RestoreHistories",
                schema: "public");
        }
    }
}
