using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Platform
{
    /// <inheritdoc />
    public partial class AddEmployeeColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Department",
                schema: "public",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastLoginAt",
                schema: "public",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PinHash",
                schema: "public",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Username",
                schema: "public",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username_TenantId",
                schema: "public",
                table: "Users",
                columns: new[] { "Username", "TenantId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Username_TenantId",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Department",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginAt",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PinHash",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Username",
                schema: "public",
                table: "Users");
        }
    }
}
