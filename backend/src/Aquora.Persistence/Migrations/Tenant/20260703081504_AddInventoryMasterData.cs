using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;

#nullable disable

namespace Aquora.Persistence.Migrations.Tenant
{
    /// <inheritdoc />
    public partial class AddInventoryMasterData : Migration
    {
        private string _schema => TenantSchemaResolver.CurrentSchemaName ?? "public";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Idempotently add IsActive column to RawMaterials
            migrationBuilder.Sql($"ALTER TABLE {_schema}.\"RawMaterials\" ADD COLUMN IF NOT EXISTS \"IsActive\" boolean NOT NULL DEFAULT TRUE;");

            // 2. Idempotently create Brands table
            migrationBuilder.Sql($@"
                CREATE TABLE IF NOT EXISTS {_schema}.""Brands"" (
                    ""Id"" uuid NOT NULL,
                    ""Name"" text NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_Brands"" PRIMARY KEY (""Id"")
                );
            ");

            // 3. Idempotently create Products table
            migrationBuilder.Sql($@"
                CREATE TABLE IF NOT EXISTS {_schema}.""Products"" (
                    ""Id"" uuid NOT NULL,
                    ""Name"" text NOT NULL,
                    ""BrandId"" uuid NOT NULL,
                    ""SKU"" text,
                    ""IsActive"" boolean NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_Products"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_Products_Brands_BrandId"" FOREIGN KEY (""BrandId"") REFERENCES {_schema}.""Brands"" (""Id"") ON DELETE CASCADE
                );
            ");

            // 4. Idempotently create indexes
            migrationBuilder.Sql($"CREATE INDEX IF NOT EXISTS \"IX_RawMaterials_Category\" ON {_schema}.\"RawMaterials\" (\"Category\");");
            migrationBuilder.Sql($"CREATE UNIQUE INDEX IF NOT EXISTS \"IX_RawMaterials_Name\" ON {_schema}.\"RawMaterials\" (\"Name\");");
            migrationBuilder.Sql($"CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Brands_Name\" ON {_schema}.\"Brands\" (\"Name\");");
            migrationBuilder.Sql($"CREATE INDEX IF NOT EXISTS \"IX_Products_BrandId\" ON {_schema}.\"Products\" (\"BrandId\");");
            migrationBuilder.Sql($"CREATE INDEX IF NOT EXISTS \"IX_Products_Name\" ON {_schema}.\"Products\" (\"Name\");");
            migrationBuilder.Sql($"CREATE INDEX IF NOT EXISTS \"IX_Products_Name_BrandId\" ON {_schema}.\"Products\" (\"Name\", \"BrandId\");");
            migrationBuilder.Sql($"CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Products_SKU\" ON {_schema}.\"Products\" (\"SKU\") WHERE \"SKU\" IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"DROP TABLE IF EXISTS {_schema}.\"Products\" CASCADE;");
            migrationBuilder.Sql($"DROP TABLE IF EXISTS {_schema}.\"Brands\" CASCADE;");
            migrationBuilder.Sql($"DROP INDEX IF EXISTS {_schema}.\"IX_RawMaterials_Category\";");
            migrationBuilder.Sql($"DROP INDEX IF EXISTS {_schema}.\"IX_RawMaterials_Name\";");
            migrationBuilder.Sql($"ALTER TABLE {_schema}.\"RawMaterials\" DROP COLUMN IF EXISTS \"IsActive\";");
        }
    }
}
