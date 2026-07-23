using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddBusinessPartnerFields : Migration
    {
        private string _schema => TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccountingPlaceholder",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AddressesJson",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedDriver",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedRoute",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedSalesExecutive",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedVehicle",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessCategory",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessRegistration",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CommissionPercentage",
                schema: _schema,
                table: "Customers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ContactsJson",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DefaultDeliveryPriority",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryFrequency",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiscountGroup",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DistributorType",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentsJson",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EmergencyDelivery",
                schema: _schema,
                table: "Customers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Industry",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "JarDeposit",
                schema: _schema,
                table: "Customers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "LedgerPlaceholder",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxJarLimit",
                schema: _schema,
                table: "Customers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlySalary",
                schema: _schema,
                table: "Customers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "OutstandingJars",
                schema: _schema,
                table: "Customers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "OutstandingPlaceholder",
                schema: _schema,
                table: "Customers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredCapMaterial",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredDeliveryTime",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredDeliveryWindow",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredJarBrand",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredProductsJson",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PriceList",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PriorityCustomer",
                schema: _schema,
                table: "Customers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SealRequired",
                schema: _schema,
                table: "Customers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "SecurityDeposit",
                schema: _schema,
                table: "Customers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "TaxCategory",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TaxExempt",
                schema: _schema,
                table: "Customers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TradeLicense",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Website",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatsApp",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkingArea",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkingDays",
                schema: _schema,
                table: "Customers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountingPlaceholder",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "AddressesJson",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "AssignedDriver",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "AssignedRoute",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "AssignedSalesExecutive",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "AssignedVehicle",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "BusinessCategory",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "BusinessRegistration",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "CommissionPercentage",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "ContactsJson",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "DefaultDeliveryPriority",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "DeliveryFrequency",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "DiscountGroup",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "DistributorType",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "DocumentsJson",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "EmergencyDelivery",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Industry",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "JarDeposit",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "LedgerPlaceholder",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "MaxJarLimit",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "MonthlySalary",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "OutstandingJars",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "OutstandingPlaceholder",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreferredCapMaterial",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreferredDeliveryTime",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreferredDeliveryWindow",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreferredJarBrand",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PreferredProductsJson",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PriceList",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PriorityCustomer",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "SealRequired",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "SecurityDeposit",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "TaxCategory",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "TaxExempt",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "TradeLicense",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "Website",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "WhatsApp",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "WorkingArea",
                schema: _schema,
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "WorkingDays",
                schema: _schema,
                table: "Customers");
        }
    }
}
