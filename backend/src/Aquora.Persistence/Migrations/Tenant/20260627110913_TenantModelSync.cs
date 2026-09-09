using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class TenantModelSync : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Companies_Tenants_TenantId",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropForeignKey(
                name: "FK_Departments_Tenants_TenantId",
                schema: _schema,
                table: "Departments");

            migrationBuilder.DropForeignKey(
                name: "FK_Machines_Tenants_TenantId",
                schema: _schema,
                table: "Machines");

            migrationBuilder.DropForeignKey(
                name: "FK_Plants_Tenants_TenantId",
                schema: _schema,
                table: "Plants");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionLines_Tenants_TenantId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropForeignKey(
                name: "FK_RolePermissions_Tenants_TenantId",
                schema: _schema,
                table: "RolePermissions");

            migrationBuilder.DropForeignKey(
                name: "FK_Roles_Tenants_TenantId",
                schema: _schema,
                table: "Roles");

            migrationBuilder.DropForeignKey(
                name: "FK_Stations_Tenants_TenantId",
                schema: _schema,
                table: "Stations");

            migrationBuilder.DropForeignKey(
                name: "FK_TenantDomain_Tenants_TenantId",
                schema: _schema,
                table: "TenantDomain");

            migrationBuilder.DropForeignKey(
                name: "FK_UserRoles_Tenants_TenantId",
                schema: _schema,
                table: "UserRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserRoles_Users_UserId",
                schema: _schema,
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_UserRoles_TenantId",
                schema: _schema,
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_Stations_TenantId",
                schema: _schema,
                table: "Stations");

            migrationBuilder.DropIndex(
                name: "IX_Roles_TenantId",
                schema: _schema,
                table: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_RolePermissions_TenantId",
                schema: _schema,
                table: "RolePermissions");

            migrationBuilder.DropIndex(
                name: "IX_ProductionLines_TenantId",
                schema: _schema,
                table: "ProductionLines");

            migrationBuilder.DropIndex(
                name: "IX_Plants_TenantId",
                schema: _schema,
                table: "Plants");

            migrationBuilder.DropIndex(
                name: "IX_Machines_TenantId",
                schema: _schema,
                table: "Machines");

            migrationBuilder.DropIndex(
                name: "IX_Departments_TenantId",
                schema: _schema,
                table: "Departments");

            migrationBuilder.DropIndex(
                name: "IX_Companies_TenantId",
                schema: _schema,
                table: "Companies");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_TenantId",
                schema: _schema,
                table: "UserRoles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Stations_TenantId",
                schema: _schema,
                table: "Stations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_TenantId",
                schema: _schema,
                table: "Roles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_TenantId",
                schema: _schema,
                table: "RolePermissions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionLines_TenantId",
                schema: _schema,
                table: "ProductionLines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Plants_TenantId",
                schema: _schema,
                table: "Plants",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_TenantId",
                schema: _schema,
                table: "Machines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_TenantId",
                schema: _schema,
                table: "Departments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Companies_TenantId",
                schema: _schema,
                table: "Companies",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_Companies_Tenants_TenantId",
                schema: _schema,
                table: "Companies",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Departments_Tenants_TenantId",
                schema: _schema,
                table: "Departments",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Machines_Tenants_TenantId",
                schema: _schema,
                table: "Machines",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Plants_Tenants_TenantId",
                schema: _schema,
                table: "Plants",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionLines_Tenants_TenantId",
                schema: _schema,
                table: "ProductionLines",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RolePermissions_Tenants_TenantId",
                schema: _schema,
                table: "RolePermissions",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Roles_Tenants_TenantId",
                schema: _schema,
                table: "Roles",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Stations_Tenants_TenantId",
                schema: _schema,
                table: "Stations",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TenantDomain_Tenants_TenantId",
                schema: _schema,
                table: "TenantDomain",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserRoles_Tenants_TenantId",
                schema: _schema,
                table: "UserRoles",
                column: "TenantId",
                principalSchema: "public", principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserRoles_Users_UserId",
                schema: _schema,
                table: "UserRoles",
                column: "UserId",
                principalSchema: "public", principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
