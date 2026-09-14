using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20260810100000_AddOperationsIssueAffectedMachines")]
    public partial class AddOperationsIssueAffectedMachines : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Table OperationsIssueAffectedMachines is formally created along with OperationsIssues
            // in 20260817110405_AddMonthlySalaryEntitlements.
            // On a fresh tenant, OperationsIssues does not exist yet at timestamp 20260810100000.
            // Conditionally create only if OperationsIssues exists and OperationsIssueAffectedMachines does not yet exist.
            migrationBuilder.Sql($@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{_schema}' AND table_name = 'OperationsIssues')
                       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{_schema}' AND table_name = 'OperationsIssueAffectedMachines') THEN
                        CREATE TABLE ""{_schema}"".""OperationsIssueAffectedMachines"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""IssueId"" uuid NOT NULL,
                            ""MachineId"" uuid NOT NULL,
                            ""MachineName"" text NOT NULL,
                            ""MachineCode"" text NULL,
                            CONSTRAINT ""FK_OperationsIssueAffectedMachines_OperationsIssues_IssueId"" FOREIGN KEY (""IssueId"") REFERENCES ""{_schema}"".""OperationsIssues"" (""Id"") ON DELETE CASCADE
                        );
                        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_OperationsIssueAffectedMachines_IssueId_MachineId"" ON ""{_schema}"".""OperationsIssueAffectedMachines"" (""IssueId"", ""MachineId"");
                        INSERT INTO ""{_schema}"".""OperationsIssueAffectedMachines"" (""Id"", ""IssueId"", ""MachineId"", ""MachineName"")
                        SELECT gen_random_uuid(), ""Id"", ""MachineId"", COALESCE(""MachineName"", 'Primary Machine')
                        FROM ""{_schema}"".""OperationsIssues""
                        WHERE ""MachineId"" IS NOT NULL
                        AND NOT EXISTS (
                            SELECT 1 FROM ""{_schema}"".""OperationsIssueAffectedMachines"" m WHERE m.""IssueId"" = ""{_schema}"".""OperationsIssues"".""Id"" AND m.""MachineId"" = ""{_schema}"".""OperationsIssues"".""MachineId""
                        );
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperationsIssueAffectedMachines",
                schema: _schema);
        }
    }
}
