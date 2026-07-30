using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddFinanceModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccountGroups",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    ParentGroupId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccountGroups_AccountGroups_ParentGroupId",
                        column: x => x.ParentGroupId,

                        principalTable: "AccountGroups",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AccountGroups_Companies_CompanyId",
                        column: x => x.CompanyId,

                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Assets",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetName = table.Column<string>(type: "text", nullable: false),
                    AssetCategory = table.Column<string>(type: "text", nullable: false),
                    SerialNumber = table.Column<string>(type: "text", nullable: true),
                    PurchaseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PurchasePrice = table.Column<decimal>(type: "numeric", nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    WarrantyDetails = table.Column<string>(type: "text", nullable: true),
                    CurrentStatus = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: true),
                    AssignedEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    DepreciationRate = table.Column<decimal>(type: "numeric", nullable: false),
                    CurrentValue = table.Column<decimal>(type: "numeric", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    PhotoUrl = table.Column<string>(type: "text", nullable: true),
                    DocumentUrl = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_Assets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Assets_Companies_CompanyId",
                        column: x => x.CompanyId,

                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "JournalEntries",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VoucherNumber = table.Column<string>(type: "text", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VoucherType = table.Column<string>(type: "text", nullable: false),
                    ReferenceNumber = table.Column<string>(type: "text", nullable: true),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SourceSalesTransactionId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourcePurchaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceExpenseId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JournalEntries_Companies_CompanyId",
                        column: x => x.CompanyId,

                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_JournalEntries_Users_ApprovedById",
                        column: x => x.ApprovedById,

                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PettyCashSessions",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    CashReceived = table.Column<decimal>(type: "numeric", nullable: false),
                    CashSpent = table.Column<decimal>(type: "numeric", nullable: false),
                    ClosingBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    VerifiedById = table.Column<Guid>(type: "uuid", nullable: true),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PettyCashSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PettyCashSessions_Companies_CompanyId",
                        column: x => x.CompanyId,

                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Accounts",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountName = table.Column<string>(type: "text", nullable: false),
                    AccountCode = table.Column<string>(type: "text", nullable: false),
                    AccountGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    BalanceType = table.Column<string>(type: "text", nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LinkedCustomerId = table.Column<Guid>(type: "uuid", nullable: true),
                    LinkedSupplierId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_Accounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Accounts_AccountGroups_AccountGroupId",
                        column: x => x.AccountGroupId,

                        principalTable: "AccountGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Accounts_Companies_CompanyId",
                        column: x => x.CompanyId,

                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Accounts_Customers_LinkedCustomerId",
                        column: x => x.LinkedCustomerId,

                        principalTable: "Customers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ExpenseRecords",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    GSTAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    ExpenseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaymentMethod = table.Column<string>(type: "text", nullable: false),
                    VendorName = table.Column<string>(type: "text", nullable: true),
                    InvoiceNumber = table.Column<string>(type: "text", nullable: true),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    BillAttachmentUrl = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    LinkedJournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExpenseRecords_Companies_CompanyId",
                        column: x => x.CompanyId,

                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExpenseRecords_JournalEntries_LinkedJournalEntryId",
                        column: x => x.LinkedJournalEntryId,

                        principalTable: "JournalEntries",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "BankAccounts",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankName = table.Column<string>(type: "text", nullable: false),
                    AccountName = table.Column<string>(type: "text", nullable: false),
                    AccountNumber = table.Column<string>(type: "text", nullable: false),
                    AccountType = table.Column<string>(type: "text", nullable: false),
                    Branch = table.Column<string>(type: "text", nullable: true),
                    IFSC = table.Column<string>(type: "text", nullable: true),
                    LinkedLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByIP = table.Column<string>(type: "text", nullable: true),
                    UpdatedByIP = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankAccounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankAccounts_Accounts_LinkedLedgerAccountId",
                        column: x => x.LinkedLedgerAccountId,

                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BankAccounts_Companies_CompanyId",
                        column: x => x.CompanyId,

                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "JournalEntryLines",
                
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    DebitAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    CreditAmount = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalEntryLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JournalEntryLines_Accounts_AccountId",
                        column: x => x.AccountId,

                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_JournalEntryLines_JournalEntries_JournalEntryId",
                        column: x => x.JournalEntryId,

                        principalTable: "JournalEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountGroups_CompanyId",
                
                table: "AccountGroups",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_AccountGroups_ParentGroupId",
                
                table: "AccountGroups",
                column: "ParentGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_AccountGroupId",
                
                table: "Accounts",
                column: "AccountGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_CompanyId",
                
                table: "Accounts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_LinkedCustomerId",
                
                table: "Accounts",
                column: "LinkedCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_CompanyId",
                
                table: "Assets",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_CompanyId",
                
                table: "BankAccounts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_LinkedLedgerAccountId",
                
                table: "BankAccounts",
                column: "LinkedLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseRecords_CompanyId",
                
                table: "ExpenseRecords",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseRecords_LinkedJournalEntryId",
                
                table: "ExpenseRecords",
                column: "LinkedJournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_ApprovedById",
                
                table: "JournalEntries",
                column: "ApprovedById");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_CompanyId",
                
                table: "JournalEntries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntryLines_AccountId",
                
                table: "JournalEntryLines",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntryLines_JournalEntryId",
                
                table: "JournalEntryLines",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_PettyCashSessions_CompanyId",
                
                table: "PettyCashSessions",
                column: "CompanyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Assets",
                schema: "public");

            migrationBuilder.DropTable(
                name: "BankAccounts",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ExpenseRecords",
                schema: "public");

            migrationBuilder.DropTable(
                name: "JournalEntryLines",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PettyCashSessions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Accounts",
                schema: "public");

            migrationBuilder.DropTable(
                name: "JournalEntries",
                schema: "public");

            migrationBuilder.DropTable(
                name: "AccountGroups",
                schema: "public");
        }
    }
}
