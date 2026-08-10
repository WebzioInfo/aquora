using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddOperationsIssueAffectedMachines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OperationsIssueAffectedMachines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IssueId = table.Column<Guid>(type: "uuid", nullable: false),
                    MachineId = table.Column<Guid>(type: "uuid", nullable: false),
                    MachineName = table.Column<string>(type: "text", nullable: false),
                    MachineCode = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationsIssueAffectedMachines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsIssueAffectedMachines_OperationsIssues_IssueId",
                        column: x => x.IssueId,
                        principalTable: "OperationsIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OperationsIssueAffectedMachines_IssueId_MachineId",
                table: "OperationsIssueAffectedMachines",
                columns: new[] { "IssueId", "MachineId" },
                unique: true);

            migrationBuilder.Sql(@"
                INSERT INTO ""OperationsIssueAffectedMachines"" (""Id"", ""IssueId"", ""MachineId"", ""MachineName"")
                SELECT gen_random_uuid(), ""Id"", ""MachineId"", COALESCE(""MachineName"", 'Primary Machine')
                FROM ""OperationsIssues""
                WHERE ""MachineId"" IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM ""OperationsIssueAffectedMachines"" m WHERE m.""IssueId"" = ""OperationsIssues"".""Id"" AND m.""MachineId"" = ""OperationsIssues"".""MachineId""
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperationsIssueAffectedMachines");
        }
    }
}
