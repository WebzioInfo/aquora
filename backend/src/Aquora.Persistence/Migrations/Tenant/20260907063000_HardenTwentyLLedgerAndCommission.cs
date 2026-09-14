using System;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant;

[DbContext(typeof(TenantDbContext))]
[Migration("20260907063000_HardenTwentyLLedgerAndCommission")]
public partial class HardenTwentyLLedgerAndCommission : Migration
{
    private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "HolderType", schema: _schema, table: "TwentyLJarMovements", type: "text", nullable: false, defaultValue: "COMPANY");
        migrationBuilder.AddColumn<Guid>(name: "HolderCustomerId", schema: _schema, table: "TwentyLJarMovements", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<int>(name: "Priority", schema: _schema, table: "TwentyLRateRules", type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.CreateTable(name: "TwentyLCommissionRules", schema: _schema, columns: table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), CompanyId = table.Column<Guid>(type: "uuid", nullable: false), BeneficiaryCustomerId = table.Column<Guid>(type: "uuid", nullable: true), ProductId = table.Column<Guid>(type: "uuid", nullable: true), BeneficiaryType = table.Column<string>(type: "text", nullable: false), CalculationType = table.Column<string>(type: "text", nullable: false), Value = table.Column<decimal>(type: "numeric", nullable: false), MinimumQuantity = table.Column<decimal>(type: "numeric", nullable: false), EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), Priority = table.Column<int>(type: "integer", nullable: false), IsActive = table.Column<bool>(type: "boolean", nullable: false), CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), CreatedBy = table.Column<string>(type: "text", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true), CreatedByIP = table.Column<string>(type: "text", nullable: true), UpdatedByIP = table.Column<string>(type: "text", nullable: true), IsDeleted = table.Column<bool>(type: "boolean", nullable: false), DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), DeletedBy = table.Column<string>(type: "text", nullable: true)
        }, constraints: table => table.PrimaryKey("PK_TwentyLCommissionRules", x => x.Id));
        migrationBuilder.CreateTable(name: "TwentyLCommissionTransactions", schema: _schema, columns: table => new
        {
            Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), CompanyId = table.Column<Guid>(type: "uuid", nullable: false), DeliveryId = table.Column<Guid>(type: "uuid", nullable: false), RuleId = table.Column<Guid>(type: "uuid", nullable: true), BeneficiaryCustomerId = table.Column<Guid>(type: "uuid", nullable: true), BeneficiaryType = table.Column<string>(type: "text", nullable: false), TransactionType = table.Column<string>(type: "text", nullable: false), Amount = table.Column<decimal>(type: "numeric", nullable: false), OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), ReversalOfId = table.Column<Guid>(type: "uuid", nullable: true), Reason = table.Column<string>(type: "text", nullable: true), CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), CreatedBy = table.Column<string>(type: "text", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true), CreatedByIP = table.Column<string>(type: "text", nullable: true), UpdatedByIP = table.Column<string>(type: "text", nullable: true)
        }, constraints: table => table.PrimaryKey("PK_TwentyLCommissionTransactions", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_TwentyLCommissionRules_Effective", schema: _schema, table: "TwentyLCommissionRules", columns: new[] { "TenantId", "BeneficiaryCustomerId", "ProductId", "EffectiveFrom", "EffectiveTo" });
        migrationBuilder.CreateIndex(name: "IX_TwentyLCommissionTransactions_Delivery", schema: _schema, table: "TwentyLCommissionTransactions", columns: new[] { "TenantId", "DeliveryId", "BeneficiaryCustomerId" });
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "TwentyLCommissionTransactions", schema: _schema);
        migrationBuilder.DropTable(name: "TwentyLCommissionRules", schema: _schema);
        migrationBuilder.DropColumn(name: "HolderType", schema: _schema, table: "TwentyLJarMovements");
        migrationBuilder.DropColumn(name: "HolderCustomerId", schema: _schema, table: "TwentyLJarMovements");
        migrationBuilder.DropColumn(name: "Priority", schema: _schema, table: "TwentyLRateRules");
    }
}
