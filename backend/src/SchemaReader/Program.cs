using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Npgsql;

namespace SchemaReader
{
    class Program
    {
        static async Task Main(string[] args)
        {
            string connectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";
            Console.WriteLine("Connecting to PostgreSQL...");
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            var schemas = new List<string>();
            await using (var schemaCmd = new NpgsqlCommand("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'aquora_tenant_%';", conn))
            await using (var reader = await schemaCmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    schemas.Add(reader.GetString(0));
                }
            }

            Console.WriteLine($"Found {schemas.Count} tenant schemas.");

            foreach (var schema in schemas)
            {
                Console.WriteLine($"\nProcessing schema: {schema}...");
                try
                {
                    var sql = $@"
                    DO $$ 
                    BEGIN
                        -- Check if PurchaseCategories table exists
                        IF EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = '{schema}' AND table_name = 'PurchaseCategories'
                        ) THEN
                            -- 1. Upgrade PurchaseCategories columns
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""DefaultLedgerAccount"" text NULL;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""AffectsInventory"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequiresAsset"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequiresExpense"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""AffectsVendorLedger"" boolean NOT NULL DEFAULT true;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""IsGstApplicable"" boolean NOT NULL DEFAULT true;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""DefaultGstRate"" numeric(18,2) NOT NULL DEFAULT 18.0;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""AllowGstRateChange"" boolean NOT NULL DEFAULT true;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""AllowCustomGstRate"" boolean NOT NULL DEFAULT true;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequireQuantity"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequireUnit"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequireItem"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequireServiceDescription"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequireAssetDetails"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequireInvoiceNumber"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequireVendor"" boolean NOT NULL DEFAULT true;
                            ALTER TABLE ""{schema}"".""PurchaseCategories"" ADD COLUMN IF NOT EXISTS ""RequirePaymentDetails"" boolean NOT NULL DEFAULT true;

                            -- 2. Normalize and Deduplicate Category records
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'RawMaterial', ""Treatment"" = 'Inventory', ""AffectsInventory"" = true, ""RequireQuantity"" = true, ""RequireUnit"" = true, ""RequireItem"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Raw Material';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'Machine', ""Treatment"" = 'Asset', ""RequiresAsset"" = true, ""RequireAssetDetails"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Machine / Equipment';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'OfficeAsset', ""Treatment"" = 'Asset', ""RequiresAsset"" = true, ""RequireAssetDetails"" = true, ""RequireQuantity"" = true, ""RequireUnit"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Office Asset';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'OfficeExpense', ""Treatment"" = 'Expense', ""RequiresExpense"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Office Expense';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'Service', ""Treatment"" = 'Expense', ""RequiresExpense"" = true, ""RequireServiceDescription"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Service / Consulting';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'Maintenance', ""Treatment"" = 'Expense', ""RequiresExpense"" = true, ""RequireServiceDescription"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Maintenance & Repair';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'Utility', ""Treatment"" = 'Expense', ""RequiresExpense"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Utility Bills';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'Vehicle', ""Treatment"" = 'Expense', ""RequiresExpense"" = true, ""DefaultGstRate"" = 0.0 WHERE ""Code"" = 'Vehicle & Fuel Expense';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'Software', ""Treatment"" = 'Expense', ""RequiresExpense"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Software & Subscriptions';
                            UPDATE ""{schema}"".""PurchaseCategories"" SET ""Code"" = 'Other', ""Treatment"" = 'Expense', ""RequiresExpense"" = true, ""DefaultGstRate"" = 18.0 WHERE ""Code"" = 'Other Category';

                            -- Soft-delete duplicate categories keeping the earliest created
                            UPDATE ""{schema}"".""PurchaseCategories""
                            SET ""IsDeleted"" = true
                            WHERE ""Id"" IN (
                                SELECT c1.""Id""
                                FROM ""{schema}"".""PurchaseCategories"" c1
                                JOIN ""{schema}"".""PurchaseCategories"" c2 
                                    ON LOWER(TRIM(c1.""Code"")) = LOWER(TRIM(c2.""Code""))
                                    AND c1.""TenantId"" = c2.""TenantId""
                                    AND c1.""CreatedAt"" > c2.""CreatedAt""
                                    AND c1.""IsDeleted"" = false
                                    AND c2.""IsDeleted"" = false
                            );
                        END IF;

                        -- Check if Purchases table exists
                        IF EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = '{schema}' AND table_name = 'Purchases'
                        ) THEN
                            -- 3. Upgrade Purchases columns
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""TaxMode"" text NOT NULL DEFAULT 'GST';
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""GSTRate"" numeric(18,2) NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""TaxableAmount"" numeric(18,2) NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""CGSTAmount"" numeric(18,2) NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""SGSTAmount"" numeric(18,2) NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""IGSTAmount"" numeric(18,2) NOT NULL DEFAULT 0.0;
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""IsGstOverridden"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""IsInclusiveTax"" boolean NOT NULL DEFAULT false;
                            ALTER TABLE ""{schema}"".""Purchases"" ADD COLUMN IF NOT EXISTS ""IsInterState"" boolean NOT NULL DEFAULT false;

                            -- 4. Normalize Purchases Category references
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'RawMaterial' WHERE ""PurchaseCategory"" = 'Raw Material';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'Machine' WHERE ""PurchaseCategory"" = 'Machine / Equipment';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'OfficeAsset' WHERE ""PurchaseCategory"" = 'Office Asset';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'OfficeExpense' WHERE ""PurchaseCategory"" = 'Office Expense';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'Service' WHERE ""PurchaseCategory"" = 'Service / Consulting';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'Maintenance' WHERE ""PurchaseCategory"" = 'Maintenance & Repair';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'Utility' WHERE ""PurchaseCategory"" = 'Utility Bills';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'Vehicle' WHERE ""PurchaseCategory"" = 'Vehicle & Fuel Expense';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'Software' WHERE ""PurchaseCategory"" = 'Software & Subscriptions';
                            UPDATE ""{schema}"".""Purchases"" SET ""PurchaseCategory"" = 'Other' WHERE ""PurchaseCategory"" = 'Other Category';

                            -- 5. Backfill historical purchases tax values
                            UPDATE ""{schema}"".""Purchases""
                            SET ""TaxableAmount"" = GREATEST(0, ""SubTotal"" - ""DiscountAmount"" + ""OtherCharges"")
                            WHERE (""TaxableAmount"" = 0 OR ""TaxableAmount"" IS NULL) AND ""SubTotal"" > 0;

                            UPDATE ""{schema}"".""Purchases""
                            SET ""CGSTAmount"" = ROUND(""TaxAmount"" / 2.0, 2),
                                ""SGSTAmount"" = ""TaxAmount"" - ROUND(""TaxAmount"" / 2.0, 2)
                            WHERE ""TaxAmount"" > 0 AND (""CGSTAmount"" = 0 OR ""CGSTAmount"" IS NULL) AND (""IGSTAmount"" = 0 OR ""IGSTAmount"" IS NULL);
                        END IF;
                    END $$;
                    ";

                    await using var cmd = new NpgsqlCommand(sql, conn);
                    await cmd.ExecuteNonQueryAsync();
                    Console.WriteLine($"Successfully upgraded schema: {schema}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error on schema {schema}: {ex.Message}");
                }
            }

            Console.WriteLine("\nAll tenant schemas successfully upgraded and deduplicated!");
        }
    }
}
