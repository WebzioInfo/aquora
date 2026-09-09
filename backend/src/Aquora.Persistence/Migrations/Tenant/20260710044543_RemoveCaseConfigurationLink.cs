using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class RemoveCaseConfigurationLink : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var schema = Aquora.Persistence.Context.TenantSchemaResolver.ResolveRequiredSchema();

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_CaseConfigurations_CaseConfigurationId",
                schema: schema,
                table: "ProductionEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionSessions_CaseConfigurations_CaseConfigurationId",
                schema: schema,
                table: "ProductionSessions");

            migrationBuilder.DropIndex(
                name: "IX_ProductionSessions_CaseConfigurationId",
                schema: schema,
                table: "ProductionSessions");

            migrationBuilder.DropIndex(
                name: "IX_ProductionEntries_CaseConfigurationId",
                schema: schema,
                table: "ProductionEntries");

            migrationBuilder.DropColumn(
                name: "CaseConfigurationId",
                schema: schema,
                table: "ProductionSessions");

            migrationBuilder.DropColumn(
                name: "CaseConfigurationId",
                schema: schema,
                table: "ProductionEntries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var schema = Aquora.Persistence.Context.TenantSchemaResolver.ResolveRequiredSchema();

            migrationBuilder.AddColumn<Guid>(
                name: "CaseConfigurationId",
                schema: schema,
                table: "ProductionSessions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "CaseConfigurationId",
                schema: schema,
                table: "ProductionEntries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_ProductionSessions_CaseConfigurationId",
                schema: schema,
                table: "ProductionSessions",
                column: "CaseConfigurationId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionEntries_CaseConfigurationId",
                schema: schema,
                table: "ProductionEntries",
                column: "CaseConfigurationId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_CaseConfigurations_CaseConfigurationId",
                schema: schema,
                table: "ProductionEntries",
                column: "CaseConfigurationId",
                principalSchema: schema,
                principalTable: "CaseConfigurations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionSessions_CaseConfigurations_CaseConfigurationId",
                schema: schema,
                table: "ProductionSessions",
                column: "CaseConfigurationId",
                principalSchema: schema,
                principalTable: "CaseConfigurations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
