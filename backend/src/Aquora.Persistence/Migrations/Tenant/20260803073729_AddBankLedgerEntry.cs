using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddBankLedgerEntry : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: _schema,
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: _schema,
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: _schema,
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: _schema,
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: _schema,
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: _schema,
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "Address",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "ApiKey",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoBatchNumber",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoProductionNumber",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoSKU",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Currency",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DateFormat",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultDispatchMethod",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultProductionLineId",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultShiftId",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultWarehouseId",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Email",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "GstNumber",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Language",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "SecretKeyHash",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Timezone",
                schema: _schema,
                table: "Companies");

            migrationBuilder.AddColumn<decimal>(
                name: "AdjustmentAmount",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "AmountReceived",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DamageCost",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "DamageReason",
                schema: _schema,
                table: "SalesTransactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsReplacementRequired",
                schema: _schema,
                table: "SalesTransactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "OutstandingAmount",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PaymentStatus",
                schema: _schema,
                table: "SalesTransactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "ProductValue",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "RefundAmount",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ReturnType",
                schema: _schema,
                table: "SalesTransactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ReturnedAmount",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalAmount",
                schema: _schema,
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPerUnit",
                schema: _schema,
                table: "RawMaterials",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                schema: _schema,
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SellingPrice",
                schema: _schema,
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: _schema,
                table: "ProductionShifts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "LinkedLedgerAccountId",
                schema: _schema,
                table: "BankAccounts",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentBalance",
                schema: _schema,
                table: "BankAccounts",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: _schema,
                table: "BankAccounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: _schema,
                table: "BankAccounts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IfscCode",
                schema: _schema,
                table: "BankAccounts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: _schema,
                table: "BankAccounts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: _schema,
                table: "BankAccounts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OpeningBalance",
                schema: _schema,
                table: "BankAccounts",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: _schema,
                table: "BankAccounts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "BankLedgerEntries",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReferenceNumber = table.Column<string>(type: "text", nullable: false),
                    TransactionType = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Debit = table.Column<decimal>(type: "numeric", nullable: false),
                    Credit = table.Column<decimal>(type: "numeric", nullable: false),
                    RunningBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    RelatedEntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    RelatedEntityType = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankLedgerEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankLedgerEntries_BankAccounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalSchema: "public",
                        principalTable: "BankAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BankLedgerEntries_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Owners",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: true),
                    OwnershipPercentage = table.Column<decimal>(type: "numeric", nullable: false),
                    InitialInvestment = table.Column<decimal>(type: "numeric", nullable: false),
                    CurrentInvestment = table.Column<decimal>(type: "numeric", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Owners", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Owners_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SimpleExpenses",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpenseNumber = table.Column<string>(type: "text", nullable: false),
                    ExpenseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Vendor = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    PaymentMethod = table.Column<string>(type: "text", nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SimpleExpenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SimpleExpenses_BankAccounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalSchema: "public",
                        principalTable: "BankAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SimpleExpenses_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OwnerInvestmentTransactions",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    TransactionType = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OwnerInvestmentTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OwnerInvestmentTransactions_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OwnerInvestmentTransactions_Owners_OwnerId",
                        column: x => x.OwnerId,
                        principalSchema: "public",
                        principalTable: "Owners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_TenantId",
                schema: _schema,
                table: "BankAccounts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_BankAccountId",
                schema: _schema,
                table: "BankLedgerEntries",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_CompanyId",
                schema: _schema,
                table: "BankLedgerEntries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_TenantId",
                schema: _schema,
                table: "BankLedgerEntries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_TransactionDate",
                schema: _schema,
                table: "BankLedgerEntries",
                column: "TransactionDate");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvestmentTransactions_CompanyId",
                schema: _schema,
                table: "OwnerInvestmentTransactions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvestmentTransactions_OwnerId",
                schema: _schema,
                table: "OwnerInvestmentTransactions",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Owners_CompanyId",
                schema: _schema,
                table: "Owners",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Owners_TenantId",
                schema: _schema,
                table: "Owners",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_BankAccountId",
                schema: _schema,
                table: "SimpleExpenses",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_Category",
                schema: _schema,
                table: "SimpleExpenses",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_CompanyId",
                schema: _schema,
                table: "SimpleExpenses",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_ExpenseDate",
                schema: _schema,
                table: "SimpleExpenses",
                column: "ExpenseDate");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_TenantId",
                schema: _schema,
                table: "SimpleExpenses",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                schema: _schema,
                table: "BankAccounts",
                column: "LinkedLedgerAccountId",
                principalSchema: "public",
                principalTable: "Accounts",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropTable(
                name: "BankLedgerEntries",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OwnerInvestmentTransactions",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "SimpleExpenses",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "Owners",
                schema: _schema);

            migrationBuilder.DropIndex(
                name: "IX_BankAccounts_TenantId",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "AdjustmentAmount",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "AmountReceived",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "DamageCost",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "DamageReason",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "IsReplacementRequired",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "OutstandingAmount",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "ProductValue",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "RefundAmount",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "ReturnType",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "ReturnedAmount",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "TotalAmount",
                schema: _schema,
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "CostPerUnit",
                schema: _schema,
                table: "RawMaterials");

            migrationBuilder.DropColumn(
                name: "CostPrice",
                schema: _schema,
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SellingPrice",
                schema: _schema,
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: _schema,
                table: "ProductionShifts");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "CurrentBalance",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "IfscCode",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "OpeningBalance",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: _schema,
                table: "BankAccounts");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: _schema,
                table: "PriceLists",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: _schema,
                table: "PriceLists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: _schema,
                table: "PriceLists",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: _schema,
                table: "DiscountGroups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: _schema,
                table: "DiscountGroups",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: _schema,
                table: "DiscountGroups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Address",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApiKey",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AutoBatchNumber",
                schema: _schema,
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoProductionNumber",
                schema: _schema,
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoSKU",
                schema: _schema,
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DefaultDispatchMethod",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultProductionLineId",
                schema: _schema,
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultShiftId",
                schema: _schema,
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultWarehouseId",
                schema: _schema,
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GstNumber",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecretKeyHash",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "LinkedLedgerAccountId",
                schema: _schema,
                table: "BankAccounts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                schema: _schema,
                table: "BankAccounts",
                column: "LinkedLedgerAccountId",
                principalSchema: "public",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
