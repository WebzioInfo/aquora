using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class LinkSessionToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var schema = Aquora.Persistence.Context.TenantSchemaResolver.CurrentSchemaName ?? "public";

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_SkuProducts_SkuProductId",
                schema: schema,
                table: "ProductionEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionSessions_SkuProducts_SkuProductId",
                schema: schema,
                table: "ProductionSessions");

            migrationBuilder.RenameColumn(
                name: "SkuProductId",
                schema: schema,
                table: "ProductionSessions",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_ProductionSessions_SkuProductId",
                schema: schema,
                table: "ProductionSessions",
                newName: "IX_ProductionSessions_ProductId");

            migrationBuilder.RenameColumn(
                name: "SkuProductId",
                schema: schema,
                table: "ProductionEntries",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_ProductionEntries_SkuProductId",
                schema: schema,
                table: "ProductionEntries",
                newName: "IX_ProductionEntries_ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_Products_ProductId",
                schema: schema,
                table: "ProductionEntries",
                column: "ProductId",
                principalSchema: schema,
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionSessions_Products_ProductId",
                schema: schema,
                table: "ProductionSessions",
                column: "ProductId",
                principalSchema: schema,
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var schema = Aquora.Persistence.Context.TenantSchemaResolver.CurrentSchemaName ?? "public";

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionEntries_Products_ProductId",
                schema: schema,
                table: "ProductionEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionSessions_Products_ProductId",
                schema: schema,
                table: "ProductionSessions");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                schema: schema,
                table: "ProductionSessions",
                newName: "SkuProductId");

            migrationBuilder.RenameIndex(
                name: "IX_ProductionSessions_ProductId",
                schema: schema,
                table: "ProductionSessions",
                newName: "IX_ProductionSessions_SkuProductId");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                schema: schema,
                table: "ProductionEntries",
                newName: "SkuProductId");

            migrationBuilder.RenameIndex(
                name: "IX_ProductionEntries_ProductId",
                schema: schema,
                table: "ProductionEntries",
                newName: "IX_ProductionEntries_SkuProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionEntries_SkuProducts_SkuProductId",
                schema: schema,
                table: "ProductionEntries",
                column: "SkuProductId",
                principalSchema: schema,
                principalTable: "SkuProducts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionSessions_SkuProducts_SkuProductId",
                schema: schema,
                table: "ProductionSessions",
                column: "SkuProductId",
                principalSchema: schema,
                principalTable: "SkuProducts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
