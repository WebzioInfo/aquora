using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddMonthlySalaryEntitlements : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConcurrencyToken",
                schema: _schema,
                table: "WaterTestReports",
                type: "text",
                nullable: false,
                defaultValueSql: "md5(random()::text || clock_timestamp()::text)");

            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                schema: _schema,
                table: "SalaryPayments",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "MonthlySalaryId",
                schema: _schema,
                table: "SalaryPayments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentType",
                schema: _schema,
                table: "SalaryPayments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AdminPinHash",
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

            migrationBuilder.AddColumn<string>(
                name: "AuditNotes",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EventLabel",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EventType",
                schema: _schema,
                table: "BankLedgerEntries",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AccumulatedDepreciation",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "AssetCode",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AssetTag",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AssetType",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AssignedDate",
                schema: _schema,
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedEmployeeName",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerParty",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Condition",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Department",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DepreciationFrequency",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DepreciationMethod",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "DepreciationStartDate",
                schema: _schema,
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DisposalCost",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "DisposalDate",
                schema: _schema,
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisposalMethod",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisposalReason",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisposalRefNo",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisposedBy",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FreightCost",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InstallationCost",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastMaintenanceDate",
                schema: _schema,
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Manufacturer",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModelNumber",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextMaintenanceDate",
                schema: _schema,
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OtherCapitalizedCost",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PurchaseInvoiceNumber",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PurchaseOrderNumber",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ResidualValue",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SaleValue",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "SupplierName",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCapitalizedCost",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalMaintenanceCost",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UsefulLifeYears",
                schema: _schema,
                table: "Assets",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "WarrantyEndDate",
                schema: _schema,
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WarrantyNotes",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WarrantyNumber",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WarrantyProvider",
                schema: _schema,
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WarrantyStartDate",
                schema: _schema,
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AssetMaintenanceRecords",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    MaintenanceType = table.Column<string>(type: "text", nullable: false),
                    MaintenanceDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ServiceProvider = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    PartsCost = table.Column<decimal>(type: "numeric", nullable: false),
                    LabourCost = table.Column<decimal>(type: "numeric", nullable: false),
                    OtherCost = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalCost = table.Column<decimal>(type: "numeric", nullable: false),
                    NextMaintenanceDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsWarrantyClaim = table.Column<bool>(type: "boolean", nullable: false),
                    TechnicianName = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    AttachmentUrl = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetMaintenanceRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetMaintenanceRecords_Assets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "public",
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MonthlySalaries",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SalaryNo = table.Column<string>(type: "text", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SalaryMonth = table.Column<string>(type: "text", nullable: false),
                    BaseSalary = table.Column<decimal>(type: "numeric", nullable: false),
                    WorkingDays = table.Column<int>(type: "integer", nullable: false),
                    DaysWorked = table.Column<int>(type: "integer", nullable: false),
                    DailySalary = table.Column<decimal>(type: "numeric", nullable: false),
                    GrossSalary = table.Column<decimal>(type: "numeric", nullable: false),
                    Bonus = table.Column<decimal>(type: "numeric", nullable: false),
                    AdvanceDeduction = table.Column<decimal>(type: "numeric", nullable: false),
                    OtherDeduction = table.Column<decimal>(type: "numeric", nullable: false),
                    NetSalaryEntitlement = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalPaid = table.Column<decimal>(type: "numeric", nullable: false),
                    RemainingBalance = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Remarks = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_MonthlySalaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MonthlySalaries_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MonthlySalaries_Users_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "public",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsIssues",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    IssueNumber = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Department = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Priority = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ReportedByUserId = table.Column<string>(type: "text", nullable: false),
                    ReportedByName = table.Column<string>(type: "text", nullable: false),
                    AssignedToUserId = table.Column<string>(type: "text", nullable: true),
                    AssignedToName = table.Column<string>(type: "text", nullable: true),
                    MachineId = table.Column<Guid>(type: "uuid", nullable: true),
                    MachineName = table.Column<string>(type: "text", nullable: true),
                    ProductionLineId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductionLineName = table.Column<string>(type: "text", nullable: true),
                    BatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    BatchNumber = table.Column<string>(type: "text", nullable: true),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductName = table.Column<string>(type: "text", nullable: true),
                    StationId = table.Column<Guid>(type: "uuid", nullable: true),
                    StationName = table.Column<string>(type: "text", nullable: true),
                    ProductionSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    ShiftId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequiresImmediateStop = table.Column<bool>(type: "boolean", nullable: false),
                    ReportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReadBy = table.Column<string>(type: "text", nullable: true),
                    EstimatedCost = table.Column<decimal>(type: "numeric", nullable: true),
                    ActualCost = table.Column<decimal>(type: "numeric", nullable: true),
                    DowntimeMinutes = table.Column<int>(type: "integer", nullable: true),
                    RequiresMaintenance = table.Column<bool>(type: "boolean", nullable: false),
                    MaintenanceWorkOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    RootCause = table.Column<string>(type: "text", nullable: true),
                    CorrectiveAction = table.Column<string>(type: "text", nullable: true),
                    PreventiveAction = table.Column<string>(type: "text", nullable: true),
                    Attachments = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_OperationsIssues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsIssues_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalSchema: "public",
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsIssueAffectedMachines",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IssueId = table.Column<Guid>(type: "uuid", nullable: false),
                    MachineId = table.Column<Guid>(type: "uuid", nullable: false),
                    MachineName = table.Column<string>(type: "text", nullable: false),
                    MachineCode = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationsIssueAffectedMachines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsIssueAffectedMachines_OperationsIssues_IssueId",
                        column: x => x.IssueId,
                        principalSchema: "public",
                        principalTable: "OperationsIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsIssueComments",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IssueId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorId = table.Column<string>(type: "text", nullable: false),
                    AuthorName = table.Column<string>(type: "text", nullable: false),
                    AuthorRole = table.Column<string>(type: "text", nullable: false),
                    Message = table.Column<string>(type: "text", nullable: false),
                    AttachmentUrl = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationsIssueComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsIssueComments_OperationsIssues_IssueId",
                        column: x => x.IssueId,
                        principalSchema: "public",
                        principalTable: "OperationsIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperationsIssueHistories",
                schema: _schema,
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IssueId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerformedBy = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationsIssueHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationsIssueHistories_OperationsIssues_IssueId",
                        column: x => x.IssueId,
                        principalSchema: "public",
                        principalTable: "OperationsIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalaryPayments_MonthlySalaryId",
                schema: _schema,
                table: "SalaryPayments",
                column: "MonthlySalaryId");

            migrationBuilder.CreateIndex(
                name: "IX_Purchases_TenantId_IsDeleted_PurchaseDate_CreatedAt",
                schema: _schema,
                table: "Purchases",
                columns: new[] { "TenantId", "IsDeleted", "PurchaseDate", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Purchases_TenantId_VendorId_IsDeleted",
                schema: _schema,
                table: "Purchases",
                columns: new[] { "TenantId", "VendorId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_TenantId_BankAccountId_TransactionDate_Cr~",
                schema: _schema,
                table: "BankLedgerEntries",
                columns: new[] { "TenantId", "BankAccountId", "TransactionDate", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_BankLedgerEntries_TenantId_CashBookId_LedgerAccountType_Tra~",
                schema: _schema,
                table: "BankLedgerEntries",
                columns: new[] { "TenantId", "CashBookId", "LedgerAccountType", "TransactionDate", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AssetMaintenanceRecords_AssetId",
                schema: _schema,
                table: "AssetMaintenanceRecords",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlySalaries_CompanyId",
                schema: _schema,
                table: "MonthlySalaries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlySalaries_EmployeeId",
                schema: _schema,
                table: "MonthlySalaries",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_MonthlySalaries_TenantId_CompanyId_EmployeeId_SalaryMonth_I~",
                schema: _schema,
                table: "MonthlySalaries",
                columns: new[] { "TenantId", "CompanyId", "EmployeeId", "SalaryMonth", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_OperationsIssueAffectedMachines_IssueId_MachineId",
                schema: _schema,
                table: "OperationsIssueAffectedMachines",
                columns: new[] { "IssueId", "MachineId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OperationsIssueComments_IssueId",
                schema: _schema,
                table: "OperationsIssueComments",
                column: "IssueId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsIssueHistories_IssueId",
                schema: _schema,
                table: "OperationsIssueHistories",
                column: "IssueId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsIssues_CompanyId",
                schema: _schema,
                table: "OperationsIssues",
                column: "CompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_SalaryPayments_MonthlySalaries_MonthlySalaryId",
                schema: _schema,
                table: "SalaryPayments",
                column: "MonthlySalaryId",
                principalSchema: "public",
                principalTable: "MonthlySalaries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SalaryPayments_MonthlySalaries_MonthlySalaryId",
                schema: _schema,
                table: "SalaryPayments");

            migrationBuilder.DropTable(
                name: "AssetMaintenanceRecords",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "MonthlySalaries",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsIssueAffectedMachines",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsIssueComments",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsIssueHistories",
                schema: _schema);

            migrationBuilder.DropTable(
                name: "OperationsIssues",
                schema: _schema);

            migrationBuilder.DropIndex(
                name: "IX_SalaryPayments_MonthlySalaryId",
                schema: _schema,
                table: "SalaryPayments");

            migrationBuilder.DropIndex(
                name: "IX_Purchases_TenantId_IsDeleted_PurchaseDate_CreatedAt",
                schema: _schema,
                table: "Purchases");

            migrationBuilder.DropIndex(
                name: "IX_Purchases_TenantId_VendorId_IsDeleted",
                schema: _schema,
                table: "Purchases");

            migrationBuilder.DropIndex(
                name: "IX_BankLedgerEntries_TenantId_BankAccountId_TransactionDate_Cr~",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropIndex(
                name: "IX_BankLedgerEntries_TenantId_CashBookId_LedgerAccountType_Tra~",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "ConcurrencyToken",
                schema: _schema,
                table: "WaterTestReports");

            migrationBuilder.DropColumn(
                name: "Amount",
                schema: _schema,
                table: "SalaryPayments");

            migrationBuilder.DropColumn(
                name: "MonthlySalaryId",
                schema: _schema,
                table: "SalaryPayments");

            migrationBuilder.DropColumn(
                name: "PaymentType",
                schema: _schema,
                table: "SalaryPayments");

            migrationBuilder.DropColumn(
                name: "AdminPinHash",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "ApiKey",
                schema: _schema,
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "AuditNotes",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "EventLabel",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "EventType",
                schema: _schema,
                table: "BankLedgerEntries");

            migrationBuilder.DropColumn(
                name: "AccumulatedDepreciation",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "AssetCode",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "AssetTag",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "AssetType",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "AssignedDate",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "AssignedEmployeeName",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "BuyerParty",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Condition",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Department",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DepreciationFrequency",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DepreciationMethod",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DepreciationStartDate",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DisposalCost",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DisposalDate",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DisposalMethod",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DisposalReason",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DisposalRefNo",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "DisposedBy",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "FreightCost",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "InstallationCost",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "LastMaintenanceDate",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Manufacturer",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "ModelNumber",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "NextMaintenanceDate",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "OtherCapitalizedCost",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "PurchaseInvoiceNumber",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderNumber",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "ResidualValue",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "SaleValue",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "SupplierName",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "TotalCapitalizedCost",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "TotalMaintenanceCost",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "UsefulLifeYears",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "WarrantyEndDate",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "WarrantyNotes",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "WarrantyNumber",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "WarrantyProvider",
                schema: _schema,
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "WarrantyStartDate",
                schema: _schema,
                table: "Assets");
        }
    }
}
