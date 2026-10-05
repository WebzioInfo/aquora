using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    [DbContext(typeof(TenantDbContext))]
    [Migration("20261005171500_ReconcileQuickCreationSchema")]
    public partial class ReconcileQuickCreationSchema : Migration
    {
        private string _schema => TenantSchemaResolver.ResolveRequiredSchema();

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                -- 1. Brands Table & Indexes
                CREATE TABLE IF NOT EXISTS ""{_schema}"".""Brands"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""Name"" character varying(150) NOT NULL,
                    ""Code"" character varying(50) NULL,
                    ""Description"" character varying(500) NULL,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_Brands_Name_{_schema}"" ON ""{_schema}"".""Brands"" (""Name"");
                CREATE INDEX IF NOT EXISTS ""IX_Brands_Code_{_schema}"" ON ""{_schema}"".""Brands"" (""Code"");

                -- 2. RawMaterials Table & Indexes
                CREATE TABLE IF NOT EXISTS ""{_schema}"".""RawMaterials"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""Name"" text NOT NULL,
                    ""Code"" text NOT NULL,
                    ""Category"" text NOT NULL,
                    ""Unit"" text NOT NULL,
                    ""BaseUnit"" text NULL,
                    ""ConversionFactor"" numeric NOT NULL DEFAULT 1.0,
                    ""CurrentStock"" numeric NOT NULL DEFAULT 0.0,
                    ""CostPerUnit"" numeric NOT NULL DEFAULT 5.0,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_TenantId_{_schema}"" ON ""{_schema}"".""RawMaterials"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_CompanyId_{_schema}"" ON ""{_schema}"".""RawMaterials"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_Category_{_schema}"" ON ""{_schema}"".""RawMaterials"" (""Category"");
                CREATE INDEX IF NOT EXISTS ""IX_RawMaterials_Name_{_schema}"" ON ""{_schema}"".""RawMaterials"" (""Name"");

                -- 3. ExpenseCategories Table & Indexes
                CREATE TABLE IF NOT EXISTS ""{_schema}"".""ExpenseCategories"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""Name"" text NOT NULL,
                    ""Description"" text NULL,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_ExpenseCategories_TenantId_{_schema}"" ON ""{_schema}"".""ExpenseCategories"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_ExpenseCategories_CompanyId_{_schema}"" ON ""{_schema}"".""ExpenseCategories"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_ExpenseCategories_Name_{_schema}"" ON ""{_schema}"".""ExpenseCategories"" (""Name"");

                -- 4. AssetCategories Table & Indexes
                CREATE TABLE IF NOT EXISTS ""{_schema}"".""AssetCategories"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""Code"" text NOT NULL,
                    ""Name"" text NOT NULL,
                    ""Description"" text NULL,
                    ""IsSystem"" boolean NOT NULL DEFAULT false,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_TenantId_{_schema}"" ON ""{_schema}"".""AssetCategories"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_CompanyId_{_schema}"" ON ""{_schema}"".""AssetCategories"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_Code_{_schema}"" ON ""{_schema}"".""AssetCategories"" (""Code"");
                CREATE INDEX IF NOT EXISTS ""IX_AssetCategories_Name_{_schema}"" ON ""{_schema}"".""AssetCategories"" (""Name"");

                -- 5. PurchaseCategories Table & Indexes
                CREATE TABLE IF NOT EXISTS ""{_schema}"".""PurchaseCategories"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY,
                    ""TenantId"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""Code"" text NOT NULL,
                    ""Name"" text NOT NULL,
                    ""Description"" text NULL,
                    ""Treatment"" text NOT NULL DEFAULT 'Expense',
                    ""IsSystem"" boolean NOT NULL DEFAULT false,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreatedBy"" text NOT NULL DEFAULT 'System',
                    ""UpdatedAt"" timestamp with time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""CreatedByIP"" text NULL,
                    ""UpdatedByIP"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone NULL,
                    ""DeletedBy"" text NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_PurchaseCategories_TenantId_{_schema}"" ON ""{_schema}"".""PurchaseCategories"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_PurchaseCategories_CompanyId_{_schema}"" ON ""{_schema}"".""PurchaseCategories"" (""CompanyId"");
                CREATE INDEX IF NOT EXISTS ""IX_PurchaseCategories_Code_{_schema}"" ON ""{_schema}"".""PurchaseCategories"" (""Code"");
                CREATE INDEX IF NOT EXISTS ""IX_PurchaseCategories_Name_{_schema}"" ON ""{_schema}"".""PurchaseCategories"" (""Name"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DROP TABLE IF EXISTS ""{_schema}"".""PurchaseCategories"";
                DROP TABLE IF EXISTS ""{_schema}"".""AssetCategories"";
                DROP TABLE IF EXISTS ""{_schema}"".""ExpenseCategories"";
            ");
        }
    }
}
