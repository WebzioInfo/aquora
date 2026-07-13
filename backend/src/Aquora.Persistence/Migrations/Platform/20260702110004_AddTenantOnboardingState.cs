using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    /// <inheritdoc />
    public partial class AddTenantOnboardingState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DepartmentId",
                schema: "public",
                table: "TenantInvitations");

            migrationBuilder.DropColumn(
                name: "PlantId",
                schema: "public",
                table: "TenantInvitations");

            migrationBuilder.AddColumn<DateTime>(
                name: "InitializedAt",
                schema: "public",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InitializedBy",
                schema: "public",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsInitialized",
                schema: "public",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "public",
                table: "Tenants",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InitializedAt",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "InitializedBy",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "IsInitialized",
                schema: "public",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "public",
                table: "Tenants");

            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                schema: "public",
                table: "TenantInvitations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PlantId",
                schema: "public",
                table: "TenantInvitations",
                type: "uuid",
                nullable: true);
        }
    }
}
