using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddBankLedgerEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: "public",
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: "public",
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: "public",
                table: "PriceLists");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: "public",
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: "public",
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: "public",
                table: "DiscountGroups");

            migrationBuilder.DropColumn(
                name: "Address",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "ApiKey",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoBatchNumber",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoProductionNumber",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AutoSKU",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Currency",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DateFormat",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultDispatchMethod",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultProductionLineId",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultShiftId",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DefaultWarehouseId",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Email",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "GstNumber",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Language",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "SecretKeyHash",
                schema: "public",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "Timezone",
                schema: "public",
                table: "Companies");

            migrationBuilder.AddColumn<decimal>(
                name: "AdjustmentAmount",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "AmountReceived",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DamageCost",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "DamageReason",
                schema: "public",
                table: "SalesTransactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsReplacementRequired",
                schema: "public",
                table: "SalesTransactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "OutstandingAmount",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PaymentStatus",
                schema: "public",
                table: "SalesTransactions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "ProductValue",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "RefundAmount",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ReturnType",
                schema: "public",
                table: "SalesTransactions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ReturnedAmount",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalAmount",
                schema: "public",
                table: "SalesTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPerUnit",
                schema: "public",
                table: "RawMaterials",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                schema: "public",
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SellingPrice",
                schema: "public",
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "public",
                table: "ProductionShifts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                schema: "public",
                table: "Customers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "LinkedLedgerAccountId",
                schema: "public",
                table: "BankAccounts",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentBalance",
                schema: "public",
                table: "BankAccounts",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: "public",
                table: "BankAccounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: "public",
                table: "BankAccounts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IfscCode",
                schema: "public",
                table: "BankAccounts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: "public",
                table: "BankAccounts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "public",
                table: "BankAccounts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OpeningBalance",
                schema: "public",
                table: "BankAccounts",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "public",
                table: "BankAccounts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "BankLedgerEntries",
                schema: "public",
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
                schema: "public",
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
                schema: "public",
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
                schema: "public",
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
                schema: "public",
                table: "BankAccounts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_BankAccountId",
                schema: "public",
                table: "BankLedgerEntries",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_CompanyId",
                schema: "public",
                table: "BankLedgerEntries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_TenantId",
                schema: "public",
                table: "BankLedgerEntries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_TransactionDate",
                schema: "public",
                table: "BankLedgerEntries",
                column: "TransactionDate");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvestmentTransactions_CompanyId",
                schema: "public",
                table: "OwnerInvestmentTransactions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvestmentTransactions_OwnerId",
                schema: "public",
                table: "OwnerInvestmentTransactions",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Owners_CompanyId",
                schema: "public",
                table: "Owners",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Owners_TenantId",
                schema: "public",
                table: "Owners",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_BankAccountId",
                schema: "public",
                table: "SimpleExpenses",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_Category",
                schema: "public",
                table: "SimpleExpenses",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_CompanyId",
                schema: "public",
                table: "SimpleExpenses",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_ExpenseDate",
                schema: "public",
                table: "SimpleExpenses",
                column: "ExpenseDate");

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_TenantId",
                schema: "public",
                table: "SimpleExpenses",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                schema: "public",
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
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropTable(
                name: "BankLedgerEntries",
                schema: "public");

            migrationBuilder.DropTable(
                name: "OwnerInvestmentTransactions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "SimpleExpenses",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Owners",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_BankAccounts_TenantId",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "AdjustmentAmount",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "AmountReceived",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "DamageCost",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "DamageReason",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "IsReplacementRequired",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "OutstandingAmount",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "PaymentStatus",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "ProductValue",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "RefundAmount",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "ReturnType",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "ReturnedAmount",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "TotalAmount",
                schema: "public",
                table: "SalesTransactions");

            migrationBuilder.DropColumn(
                name: "CostPerUnit",
                schema: "public",
                table: "RawMaterials");

            migrationBuilder.DropColumn(
                name: "CostPrice",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SellingPrice",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "public",
                table: "ProductionShifts");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                schema: "public",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "CurrentBalance",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "IfscCode",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "OpeningBalance",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "public",
                table: "BankAccounts");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: "public",
                table: "PriceLists",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: "public",
                table: "PriceLists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: "public",
                table: "PriceLists",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                schema: "public",
                table: "DiscountGroups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeletedBy",
                schema: "public",
                table: "DiscountGroups",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                schema: "public",
                table: "DiscountGroups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Address",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApiKey",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AutoBatchNumber",
                schema: "public",
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoProductionNumber",
                schema: "public",
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoSKU",
                schema: "public",
                table: "Companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DefaultDispatchMethod",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultProductionLineId",
                schema: "public",
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultShiftId",
                schema: "public",
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultWarehouseId",
                schema: "public",
                table: "Companies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GstNumber",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecretKeyHash",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                schema: "public",
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "LinkedLedgerAccountId",
                schema: "public",
                table: "BankAccounts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                schema: "public",
                table: "BankAccounts",
                column: "LinkedLedgerAccountId",
                principalSchema: "public",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
