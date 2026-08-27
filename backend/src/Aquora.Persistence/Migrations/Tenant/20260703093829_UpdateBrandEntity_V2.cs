using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class UpdateBrandEntity_V2 : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            string _schema = TenantSchemaResolver.ResolveRequiredSchema();

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                schema: _schema,
                table: "Brands",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "Code",
                schema: _schema,
                table: "Brands",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: _schema,
                table: "Brands",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                schema: _schema,
                table: "Brands",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_Brands_Code",
                schema: _schema,
                table: "Brands",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            string _schema = TenantSchemaResolver.ResolveRequiredSchema();

            migrationBuilder.DropIndex(
                name: "IX_Brands_Code",
                schema: _schema,
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "Code",
                schema: _schema,
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: _schema,
                table: "Brands");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: _schema,
                table: "Brands");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                schema: _schema,
                table: "Brands",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150);
        }
    }
}
