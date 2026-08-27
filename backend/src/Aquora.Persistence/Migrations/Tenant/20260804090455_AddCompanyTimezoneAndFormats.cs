using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddCompanyTimezoneAndFormats : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CashBookId",
                schema: _schema,
                table: "SimpleExpenses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TimeFormat",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TimeZone",
                schema: _schema,
                table: "Companies",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "BankAccountId",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CashBookId",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LedgerAccountType",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LedgerSequence",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "integer",
                nullable: false,
                defaultValue: 0)
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.CreateTable(
                name: "AssetHistories",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    PerformedBy = table.Column<string>(type: "text", nullable: false),
                    PreviousValue = table.Column<string>(type: "text", nullable: true),
                    NewValue = table.Column<string>(type: "text", nullable: true),
                    Remarks = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetHistories_Assets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "public",
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CashBooks",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    OpeningBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_CashBooks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashBooks_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryPayments",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SalaryNo = table.Column<string>(type: "text", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SalaryMonth = table.Column<string>(type: "text", nullable: false),
                    MonthlySalary = table.Column<decimal>(type: "numeric", nullable: false),
                    WorkingDays = table.Column<int>(type: "integer", nullable: false),
                    DaysWorked = table.Column<int>(type: "integer", nullable: false),
                    DailySalary = table.Column<decimal>(type: "numeric", nullable: false),
                    GrossSalary = table.Column<decimal>(type: "numeric", nullable: false),
                    Bonus = table.Column<decimal>(type: "numeric", nullable: false),
                    AdvanceDeduction = table.Column<decimal>(type: "numeric", nullable: false),
                    OtherDeduction = table.Column<decimal>(type: "numeric", nullable: false),
                    NetSalary = table.Column<decimal>(type: "numeric", nullable: false),
                    PaymentMethod = table.Column<string>(type: "text", nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    CashBookId = table.Column<Guid>(type: "uuid", nullable: true),
                    PaymentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
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
                    table.PrimaryKey("PK_SalaryPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalaryPayments_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SalaryPayments_Users_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "public",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Vendors",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorCode = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    GST = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    OpeningBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    CreditLimit = table.Column<decimal>(type: "numeric", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_Vendors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Vendors_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Purchases",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseNo = table.Column<string>(type: "text", nullable: false),
                    PurchaseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: true),
                    VendorName = table.Column<string>(type: "text", nullable: false),
                    PurchaseCategory = table.Column<string>(type: "text", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "text", nullable: true),
                    ReferenceNumber = table.Column<string>(type: "text", nullable: true),
                    PaymentMethod = table.Column<string>(type: "text", nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    CashBookId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubTotal = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    OtherCharges = table.Column<decimal>(type: "numeric", nullable: false),
                    GrandTotal = table.Column<decimal>(type: "numeric", nullable: false),
                    AmountPaid = table.Column<decimal>(type: "numeric", nullable: false),
                    BalanceAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    PaymentStatus = table.Column<string>(type: "text", nullable: false),
                    IsCancelled = table.Column<bool>(type: "boolean", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledBy = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    AttachmentUrl = table.Column<string>(type: "text", nullable: true),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoryMetadataJson = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_Purchases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Purchases_Assets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "public",
                        principalTable: "Assets",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Purchases_BankAccounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalSchema: "public",
                        principalTable: "BankAccounts",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Purchases_CashBooks_CashBookId",
                        column: x => x.CashBookId,
                        principalSchema: "public",
                        principalTable: "CashBooks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Purchases_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Purchases_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalSchema: "public",
                        principalTable: "Vendors",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PurchaseItems",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    RawMaterialId = table.Column<Guid>(type: "uuid", nullable: true),
                    ItemName = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    GSTPercent = table.Column<decimal>(type: "numeric", nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseItems_Purchases_PurchaseId",
                        column: x => x.PurchaseId,
                        principalSchema: "public",
                        principalTable: "Purchases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PurchaseItems_RawMaterials_RawMaterialId",
                        column: x => x.RawMaterialId,
                        principalSchema: "public",
                        principalTable: "RawMaterials",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PurchasePayments",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaymentMethod = table.Column<string>(type: "text", nullable: false),
                    BankAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    CashBookId = table.Column<Guid>(type: "uuid", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    ReferenceNo = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchasePayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchasePayments_BankAccounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalSchema: "public",
                        principalTable: "BankAccounts",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PurchasePayments_CashBooks_CashBookId",
                        column: x => x.CashBookId,
                        principalSchema: "public",
                        principalTable: "CashBooks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PurchasePayments_Purchases_PurchaseId",
                        column: x => x.PurchaseId,
                        principalSchema: "public",
                        principalTable: "Purchases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PurchaseTimelineEvents",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    PerformedBy = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseTimelineEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseTimelineEvents_Purchases_PurchaseId",
                        column: x => x.PurchaseId,
                        principalSchema: "public",
                        principalTable: "Purchases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SimpleExpenses_CashBookId",
                schema: _schema,
                table: "SimpleExpenses",
                column: "CashBookId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_CashBookId",
                schema: _schema,
                table: "BankLedgerEntries",
                column: "CashBookId");

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_LedgerAccountType",
                schema: _schema,
                table: "BankLedgerEntries",
                column: "LedgerAccountType");

            migrationBuilder.CreateIndex(
                name: "IX_AssetHistories_AssetId",
                schema: _schema,
                table: "AssetHistories",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_CashBooks_CompanyId",
                schema: _schema,
                table: "CashBooks",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_CashBooks_TenantId",
                schema: _schema,
                table: "CashBooks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseItems_PurchaseId",
                schema: _schema,
                table: "PurchaseItems",
                column: "PurchaseId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseItems_RawMaterialId",
                schema: _schema,
                table: "PurchaseItems",
                column: "RawMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchasePayments_BankAccountId",
                schema: _schema,
                table: "PurchasePayments",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchasePayments_CashBookId",
                schema: _schema,
                table: "PurchasePayments",
                column: "CashBookId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchasePayments_PurchaseId",
                schema: _schema,
                table: "PurchasePayments",
                column: "PurchaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Purchases_AssetId",
                schema: _schema,
                table: "Purchases",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_Purchases_BankAccountId",
                schema: _schema,
                table: "Purchases",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Purchases_CashBookId",
                schema: _schema,
                table: "Purchases",
                column: "CashBookId");

            migrationBuilder.CreateIndex(
                name: "IX_Purchases_CompanyId",
                schema: _schema,
                table: "Purchases",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Purchases_VendorId",
                schema: _schema,
                table: "Purchases",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseTimelineEvents_PurchaseId",
                schema: _schema,
                table: "PurchaseTimelineEvents",
                column: "PurchaseId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_CompanyId",
                schema: _schema,
                table: "SalaryPayments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_EmployeeId",
                schema: _schema,
                table: "SalaryPayments",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_SalaryMonth",
                schema: _schema,
                table: "SalaryPayments",
                column: "SalaryMonth");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_TenantId",
                schema: _schema,
                table: "SalaryPayments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Vendors_CompanyId",
                schema: _schema,
                table: "Vendors",
                column: "CompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_BankLedgerEntries_CashBooks_CashBookId",
                schema: _schema,
                table: "BankLedgerEntries",
                column: "CashBookId",
                principalSchema: "public",
                principalTable: "CashBooks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SimpleExpenses_CashBooks_CashBookId",
                schema: _schema,
                table: "SimpleExpenses",
                column: "CashBookId",
                principalSchema: "public",
                principalTable: "CashBooks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankLedgerEntries_CashBooks_CashBookId",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_SimpleExpenses_CashBooks_CashBookId",
                schema: _schema,
                table: "SimpleExpenses");

            migrationBuilder.DropTable(
                name: "AssetHistories",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "PurchaseItems",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "PurchasePayments",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "PurchaseTimelineEvents",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "SalaryPayments",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "Purchases",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "CashBooks",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "Vendors",
                schema: _schema);

            migrationBuilder.DropIndex(
                name: "IX_SimpleExpenses_CashBookId",
                schema: _schema,
                table: "SimpleExpenses");

            migrationBuilder.DropIndex(
                name: "IX_BankLedgerEntries_CashBookId",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropIndex(
                name: "IX_BankLedgerEntries_LedgerAccountType",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "CashBookId",
                schema: _schema,
                table: "SimpleExpenses");

            migrationBuilder.DropColumn(
                name: "DateFormat",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "TimeFormat",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "TimeZone",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "CashBookId",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "LedgerAccountType",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "LedgerSequence",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.AlterColumn<Guid>(
                name: "BankAccountId",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
