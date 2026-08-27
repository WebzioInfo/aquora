using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddParentTransactionIdToSalesTransactions : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentTransactionId",
                schema: _schema,
                table: "SalesTransactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FinalizedAt",
                schema: _schema,
                table: "MonthlySalaries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalizedBy",
                schema: _schema,
                table: "MonthlySalaries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsFinalized",
                schema: _schema,
                table: "MonthlySalaries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                schema: _schema,
                table: "CaseConfigurations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "UnitsPerCase",
                schema: _schema,
                table: "CaseConfigurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactions_ParentTransactionId",
                schema: _schema,
                table: "SalesTransactions",
                column: "ParentTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseConfigurations_ProductId",
                schema: _schema,
                table: "CaseConfigurations",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseConfigurations_TenantId_ProductId_IsDeleted_IsActive",
                schema: _schema,
                table: "CaseConfigurations",
                columns: new[] { "TenantId", "ProductId", "IsDeleted", "IsActive" });

            migrationBuilder.AddForeignKey(
                name: "FK_CaseConfigurations_Products_ProductId",
                schema: _schema,
                table: "CaseConfigurations",
                column: "ProductId",
                principalSchema: "public",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SalesTransactions_SalesTransactions_ParentTransactionId",
                schema: _schema,
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
                schema: _schema,
                table: "CaseConfigurations");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesTransactions_SalesTransactions_ParentTransactionId",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropIndex(
                name: "IX_SalesTransactions_ParentTransactionId",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropIndex(
                name: "IX_CaseConfigurations_ProductId",
                schema: _schema,
                table: "CaseConfigurations");

            migrationBuilder.DropIndex(
                name: "IX_CaseConfigurations_TenantId_ProductId_IsDeleted_IsActive",
                schema: _schema,
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "ParentTransactionId",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "FinalizedAt",
                schema: _schema,
                table: "MonthlySalaries");

            migrationBuilder.DropColumn(
                name: "FinalizedBy",
                schema: _schema,
                table: "MonthlySalaries");

            migrationBuilder.DropColumn(
                name: "IsFinalized",
                schema: _schema,
                table: "MonthlySalaries");

            migrationBuilder.DropColumn(
                name: "ProductId",
                schema: _schema,
                table: "CaseConfigurations");

            migrationBuilder.DropColumn(
                name: "UnitsPerCase",
                schema: _schema,
                table: "CaseConfigurations");
        }
    }
}
