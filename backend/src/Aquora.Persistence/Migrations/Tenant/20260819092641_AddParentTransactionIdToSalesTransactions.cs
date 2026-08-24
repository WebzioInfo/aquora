using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddParentTransactionIdToSalesTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentTransactionId",
                schema: "public",
                table: "SalesTransactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FinalizedAt",
                schema: "public",
                table: "MonthlySalaries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalizedBy",
                schema: "public",
                table: "MonthlySalaries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsFinalized",
                schema: "public",
                table: "MonthlySalaries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                schema: "public",
                table: "CaseConfigurations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "UnitsPerCase",
                schema: "public",
                table: "CaseConfigurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_ParentTransactionId",
                schema: "public",
                table: "SalesTransactions",
                column: "ParentTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseConfigurations_ProductId",
                schema: "public",
                table: "CaseConfigurations",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseConfigurations_TenantId_ProductId_IsDeleted_IsActive",
                schema: "public",
                table: "CaseConfigurations",
                columns: new[] { "TenantId", "ProductId", "IsDeleted", "IsActive" });

            migrationBuilder.AddForeignKey(
                name: "FK_CaseConfigurations_Products_ProductId",
                schema: "public",
                table: "CaseConfigurations",
                column: "ProductId",
                principalSchema: "public",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SalesTransactions_SalesTransactions_ParentTransactionId",
                schema: "public",
                table: "SalesTransactions",
                column: "ParentTransactionId",
                principalSchema: "public",
                principalTable: "SalesTransactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CaseConfigurations_Products_ProductId",
                schema: "public",
                table: "CaseConfigurations");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesTransactions_SalesTransactions_ParentTransactionId",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropIndex(
                name: "IX_SalesTransactions_ParentTransactionId",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropIndex(
                name: "IX_CaseConfigurations_ProductId",
                schema: "public",
                table: "CaseConfigurations");

            migrationBuilder.DropIndex(
                name: "IX_CaseConfigurations_TenantId_ProductId_IsDeleted_IsActive",
                schema: "public",
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "ParentTransactionId",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "FinalizedAt",
                schema: "public",
                table: "MonthlySalaries");

            migrationBuilder.DropColumn(
                name: "FinalizedBy",
                schema: "public",
                table: "MonthlySalaries");

            migrationBuilder.DropColumn(
                name: "IsFinalized",
                schema: "public",
                table: "MonthlySalaries");

            migrationBuilder.DropColumn(
                name: "ProductId",
                schema: "public",
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "UnitsPerCase",
                schema: "public",
                table: "CaseConfigurations");
        }
    }
}
