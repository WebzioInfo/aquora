using System;
using System.Data;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace Aquora.Tests
{
    public class LiveDatabaseAssetRepairTests
    {
        private readonly ITestOutputHelper _output;
        private const string ConnectionString = "Host=aws-1-ap-northeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.lxwherkjkjuhmfqzrziw;Password=aquoradb@2026;SSL Mode=Require;Trust Server Certificate=true;CommandTimeout=120;";

        public LiveDatabaseAssetRepairTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public async Task InspectAndRepairLiveTenantAssetsDatabase()
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();
            _output.WriteLine("Connected to Live Database successfully.");

            // 1. Get all tenant schemas
            var tenantSchemas = new System.Collections.Generic.List<string>();
            await using (var cmd = new NpgsqlCommand("SELECT \"SchemaName\" FROM \"public\".\"Tenants\" WHERE \"IsActive\" = true;", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    tenantSchemas.Add(reader.GetString(0));
                }
            }

            if (!tenantSchemas.Contains("aquora_tenant_sinan_company"))
            {
                tenantSchemas.Add("aquora_tenant_sinan_company");
            }

            _output.WriteLine($"Found {tenantSchemas.Count} tenant schemas to inspect and repair.");

            foreach (var schema in tenantSchemas)
            {
                _output.WriteLine($"\n==================================================");
                _output.WriteLine($"INSPECTING & REPAIRING TENANT SCHEMA: {schema}");
                _output.WriteLine($"==================================================");

                // Check if Assets table exists
                bool tableExists = false;
                await using (var checkCmd = new NpgsqlCommand($@"
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = '{schema}' AND table_name = 'Assets'
                    );", conn))
                {
                    tableExists = (bool)(await checkCmd.ExecuteScalarAsync() ?? false);
                }

                if (!tableExists)
                {
                    _output.WriteLine($"Table {schema}.Assets does NOT exist yet. Skipping repair.");
                    continue;
                }

                // Check if AssetCode column exists
                bool columnExists = false;
                await using (var checkColCmd = new NpgsqlCommand($@"
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = '{schema}' AND table_name = 'Assets' AND column_name = 'AssetCode'
                    );", conn))
                {
                    columnExists = (bool)(await checkColCmd.ExecuteScalarAsync() ?? false);
                }

                if (!columnExists)
                {
                    _output.WriteLine($"Column AssetCode does NOT exist. Adding it now...");
                    await using var addColCmd = new NpgsqlCommand($@"ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssetCode"" text NULL;", conn);
                    await addColCmd.ExecuteNonQueryAsync();
                }

                // STEP 2 DIAGNOSTIC: Inspect counts before repair
                long totalAssets = 0, nullCodes = 0, emptyCodes = 0;
                await using (var diagCmd = new NpgsqlCommand($@"
                    SELECT
                        COUNT(*) AS total_assets,
                        COUNT(*) FILTER (WHERE ""AssetCode"" IS NULL) AS null_asset_codes,
                        COUNT(*) FILTER (WHERE ""AssetCode"" = '') AS empty_asset_codes
                    FROM ""{schema}"".""Assets"";", conn))
                await using (var reader = await diagCmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        totalAssets = reader.GetInt64(0);
                        nullCodes = reader.GetInt64(1);
                        emptyCodes = reader.GetInt64(2);
                    }
                }

                _output.WriteLine($"[BEFORE REPAIR] {schema}.Assets -> Total: {totalAssets}, NULL AssetCode: {nullCodes}, Empty AssetCode: {emptyCodes}");

                // List individual bad rows
                if (nullCodes > 0 || emptyCodes > 0)
                {
                    _output.WriteLine("Listing bad rows:");
                    await using var listCmd = new NpgsqlCommand($@"
                        SELECT ""Id"", ""AssetCode"", ""AssetTag"", ""AssetName""
                        FROM ""{schema}"".""Assets""
                        WHERE ""AssetCode"" IS NULL OR ""AssetCode"" = '';", conn);
                    await using var listReader = await listCmd.ExecuteReaderAsync();
                    while (await listReader.ReadAsync())
                    {
                        var id = listReader.GetGuid(0);
                        var code = listReader.IsDBNull(1) ? "NULL" : listReader.GetString(1);
                        var tag = listReader.IsDBNull(2) ? "NULL" : listReader.GetString(2);
                        var name = listReader.IsDBNull(3) ? "NULL" : listReader.GetString(3);
                        _output.WriteLine($"  - Asset ID: {id}, Code: {code}, Tag: {tag}, Name: {name}");
                    }
                }

                // STEP 3: Ensure all necessary columns exist on Assets table
                var alterSql = $@"
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssetCode"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssetTag"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssetType"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""ModelNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Manufacturer"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""SupplierName"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""PurchaseInvoiceNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""PurchaseOrderNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""TaxAmount"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""FreightCost"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""InstallationCost"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""OtherCapitalizedCost"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""TotalCapitalizedCost"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationMethod"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UsefulLifeYears"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""ResidualValue"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationStartDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationFrequency"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DepreciationRate"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AccumulatedDepreciation"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Department"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssignedEmployeeName"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""AssignedDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Condition"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyStartDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyEndDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyProvider"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyNumber"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""WarrantyNotes"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""LastMaintenanceDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""NextMaintenanceDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""TotalMaintenanceCost"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalDate"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalMethod"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalReason"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""SaleValue"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalCost"" numeric NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""BuyerParty"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposalRefNo"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DisposedBy"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""Notes"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""PhotoUrl"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DocumentUrl"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""CreatedAt"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""CreatedBy"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UpdatedAt"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UpdatedBy"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""CreatedByIP"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""UpdatedByIP"" text NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""IsDeleted"" boolean NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DeletedAt"" timestamp with time zone NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ADD COLUMN IF NOT EXISTS ""DeletedBy"" text NULL;
                ";
                await using (var cmd = new NpgsqlCommand(alterSql, conn))
                {
                    await cmd.ExecuteNonQueryAsync();
                }

                // STEP 4: REPAIR NULL / EMPTY ASSET CODES DETERMINISTICALLY
                var repairDataSql = $@"
                    WITH numbered_null_assets AS (
                        SELECT ""Id"", ROW_NUMBER() OVER (ORDER BY COALESCE(""CreatedAt"", CURRENT_TIMESTAMP) ASC, ""Id"" ASC) as rn
                        FROM ""{schema}"".""Assets""
                        WHERE ""AssetCode"" IS NULL OR ""AssetCode"" = ''
                    )
                    UPDATE ""{schema}"".""Assets"" a
                    SET ""AssetCode"" = 'AST-' || TO_CHAR(COALESCE(a.""CreatedAt"", CURRENT_TIMESTAMP), 'YYYY') || '-' || LPAD(numbered_null_assets.rn::text, 5, '0')
                    FROM numbered_null_assets
                    WHERE a.""Id"" = numbered_null_assets.""Id"";

                    UPDATE ""{schema}"".""Assets""
                    SET ""AssetCode"" = 'AST-' || SUBSTRING(""Id""::text, 1, 8)
                    WHERE ""AssetCode"" IS NULL OR ""AssetCode"" = '';

                    UPDATE ""{schema}"".""Assets"" SET ""AssetTag"" = 'TAG-' || ""AssetCode"" WHERE ""AssetTag"" IS NULL OR ""AssetTag"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""AssetName"" = 'Asset ' || ""AssetCode"" WHERE ""AssetName"" IS NULL OR ""AssetName"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""AssetCategory"" = 'Other' WHERE ""AssetCategory"" IS NULL OR ""AssetCategory"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""PurchaseDate"" = CURRENT_TIMESTAMP WHERE ""PurchaseDate"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""PurchasePrice"" = 0.0 WHERE ""PurchasePrice"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""TaxAmount"" = 0.0 WHERE ""TaxAmount"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""FreightCost"" = 0.0 WHERE ""FreightCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""InstallationCost"" = 0.0 WHERE ""InstallationCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""OtherCapitalizedCost"" = 0.0 WHERE ""OtherCapitalizedCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""TotalCapitalizedCost"" = COALESCE(""PurchasePrice"", 0.0) WHERE ""TotalCapitalizedCost"" IS NULL OR ""TotalCapitalizedCost"" = 0.0;
                    UPDATE ""{schema}"".""Assets"" SET ""DepreciationMethod"" = 'StraightLine' WHERE ""DepreciationMethod"" IS NULL OR ""DepreciationMethod"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""UsefulLifeYears"" = 5 WHERE ""UsefulLifeYears"" IS NULL OR ""UsefulLifeYears"" <= 0;
                    UPDATE ""{schema}"".""Assets"" SET ""ResidualValue"" = 0.0 WHERE ""ResidualValue"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""DepreciationFrequency"" = 'Yearly' WHERE ""DepreciationFrequency"" IS NULL OR ""DepreciationFrequency"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""DepreciationRate"" = 0.0 WHERE ""DepreciationRate"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""AccumulatedDepreciation"" = 0.0 WHERE ""AccumulatedDepreciation"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CurrentValue"" = COALESCE(""TotalCapitalizedCost"", ""PurchasePrice"", 0.0) WHERE ""CurrentValue"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CurrentStatus"" = 'Active' WHERE ""CurrentStatus"" IS NULL OR ""CurrentStatus"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""Condition"" = 'Good' WHERE ""Condition"" IS NULL OR ""Condition"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""TotalMaintenanceCost"" = 0.0 WHERE ""TotalMaintenanceCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""SaleValue"" = 0.0 WHERE ""SaleValue"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""DisposalCost"" = 0.0 WHERE ""DisposalCost"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CreatedAt"" = CURRENT_TIMESTAMP WHERE ""CreatedAt"" IS NULL;
                    UPDATE ""{schema}"".""Assets"" SET ""CreatedBy"" = 'System' WHERE ""CreatedBy"" IS NULL OR ""CreatedBy"" = '';
                    UPDATE ""{schema}"".""Assets"" SET ""IsDeleted"" = false WHERE ""IsDeleted"" IS NULL;
                ";
                await using (var cmd = new NpgsqlCommand(repairDataSql, conn))
                {
                    await cmd.ExecuteNonQueryAsync();
                }

                // STEP 5: ENFORCE NOT NULL CONSTRAINTS
                var constraintSql = $@"
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCode"" SET DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCode"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetTag"" SET DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetTag"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetName"" SET DEFAULT '';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetName"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCategory"" SET DEFAULT 'Other';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AssetCategory"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchaseDate"" SET DEFAULT CURRENT_TIMESTAMP;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchaseDate"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchasePrice"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""PurchasePrice"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TaxAmount"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TaxAmount"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""FreightCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""FreightCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""InstallationCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""InstallationCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""OtherCapitalizedCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""OtherCapitalizedCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalCapitalizedCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalCapitalizedCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationMethod"" SET DEFAULT 'StraightLine';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationMethod"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""UsefulLifeYears"" SET DEFAULT 5;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""UsefulLifeYears"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""ResidualValue"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""ResidualValue"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationFrequency"" SET DEFAULT 'Yearly';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationFrequency"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationRate"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DepreciationRate"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AccumulatedDepreciation"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""AccumulatedDepreciation"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentValue"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentValue"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentStatus"" SET DEFAULT 'Active';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CurrentStatus"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""Condition"" SET DEFAULT 'Good';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""Condition"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalMaintenanceCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""TotalMaintenanceCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""SaleValue"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""SaleValue"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DisposalCost"" SET DEFAULT 0.0;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""DisposalCost"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedAt"" SET DEFAULT CURRENT_TIMESTAMP;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedAt"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedBy"" SET DEFAULT 'System';
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""CreatedBy"" SET NOT NULL;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""IsDeleted"" SET DEFAULT false;
                    ALTER TABLE ""{schema}"".""Assets"" ALTER COLUMN ""IsDeleted"" SET NOT NULL;
                ";
                await using (var cmd = new NpgsqlCommand(constraintSql, conn))
                {
                    await cmd.ExecuteNonQueryAsync();
                }

                // Ensure maintenance records and history tables exist
                var additionalTablesSql = $@"
                    CREATE TABLE IF NOT EXISTS ""{schema}"".""AssetMaintenanceRecords"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""TenantId"" uuid NOT NULL,
                        ""CompanyId"" uuid NOT NULL,
                        ""AssetId"" uuid NOT NULL,
                        ""MaintenanceType"" text NOT NULL DEFAULT 'Preventive',
                        ""MaintenanceDate"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""ServiceProvider"" text NOT NULL DEFAULT '',
                        ""Description"" text NOT NULL DEFAULT '',
                        ""PartsCost"" numeric NOT NULL DEFAULT 0.0,
                        ""LabourCost"" numeric NOT NULL DEFAULT 0.0,
                        ""OtherCost"" numeric NOT NULL DEFAULT 0.0,
                        ""TotalCost"" numeric NOT NULL DEFAULT 0.0,
                        ""NextMaintenanceDate"" timestamp with time zone NULL,
                        ""IsWarrantyClaim"" boolean NOT NULL DEFAULT false,
                        ""TechnicianName"" text NULL,
                        ""Notes"" text NULL,
                        ""AttachmentUrl"" text NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""CreatedBy"" text NOT NULL DEFAULT 'System'
                    );

                    CREATE TABLE IF NOT EXISTS ""{schema}"".""AssetHistories"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""AssetId"" uuid NOT NULL,
                        ""Date"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""Action"" text NOT NULL DEFAULT '',
                        ""PerformedBy"" text NOT NULL DEFAULT '',
                        ""PreviousValue"" text NULL,
                        ""NewValue"" text NULL,
                        ""Remarks"" text NULL
                    );
                ";
                await using (var cmd = new NpgsqlCommand(additionalTablesSql, conn))
                {
                    await cmd.ExecuteNonQueryAsync();
                }

                // STEP 6: VERIFICATION AFTER REPAIR
                long afterTotal = 0, afterNull = 0, afterEmpty = 0;
                await using (var verifyCmd = new NpgsqlCommand($@"
                    SELECT
                        COUNT(*) AS total_assets,
                        COUNT(*) FILTER (WHERE ""AssetCode"" IS NULL) AS null_asset_codes,
                        COUNT(*) FILTER (WHERE ""AssetCode"" = '') AS empty_asset_codes
                    FROM ""{schema}"".""Assets"";", conn))
                await using (var reader = await verifyCmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        afterTotal = reader.GetInt64(0);
                        afterNull = reader.GetInt64(1);
                        afterEmpty = reader.GetInt64(2);
                    }
                }

                _output.WriteLine($"[AFTER REPAIR] {schema}.Assets -> Total: {afterTotal}, NULL AssetCode: {afterNull}, Empty AssetCode: {afterEmpty}");
                Assert.Equal(0, afterNull);
                Assert.Equal(0, afterEmpty);

                // Print all rows after repair
                await using var showCmd = new NpgsqlCommand($@"
                    SELECT ""Id"", ""AssetCode"", ""AssetTag"", ""AssetName"", ""AssetCategory""
                    FROM ""{schema}"".""Assets""
                    ORDER BY ""CreatedAt"";", conn);
                await using var showReader = await showCmd.ExecuteReaderAsync();
                while (await showReader.ReadAsync())
                {
                    var id = showReader.GetGuid(0);
                    var code = showReader.GetString(1);
                    var tag = showReader.GetString(2);
                    var name = showReader.GetString(3);
                    var cat = showReader.GetString(4);
                    _output.WriteLine($"  [VALID] Asset: {code} | Tag: {tag} | Name: {name} | Category: {cat} (ID: {id})");
                }
            }
        }

        [Fact]
        public async Task VerifyLiveEFCoreMaterializationForSinanCompany()
        {
            var tenantId = Guid.Parse("7d77da44-5307-489c-b474-bf9cdc6137ee");
            var schemaName = "aquora_tenant_sinan_company";

            var tenantProviderMock = new Moq.Mock<Application.Interfaces.ITenantProvider>();
            tenantProviderMock.Setup(t => t.TenantId).Returns(tenantId);
            tenantProviderMock.Setup(t => t.TenantSchemaName).Returns(schemaName);

            var userProviderMock = new Moq.Mock<Application.Interfaces.ICurrentUserContext>();
            userProviderMock.Setup(u => u.TenantId).Returns(tenantId);
            userProviderMock.Setup(u => u.UserId).Returns("live-tester");

            var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<Persistence.Context.TenantDbContext>()
                .UseNpgsql(ConnectionString)
                .Options;

            await using var context = new Persistence.Context.TenantDbContext(options, tenantProviderMock.Object, userProviderMock.Object);

            var service = new Application.Services.AssetManagementService(context, tenantProviderMock.Object, userProviderMock.Object);

            // Act 1: GetAssetsAsync
            var result = await service.GetAssetsAsync(1, 50);
            _output.WriteLine($"GetAssetsAsync Result Total: {result.TotalCount}, Items returned: {result.Items.Count}");
            foreach (var item in result.Items)
            {
                _output.WriteLine($" - Returned Asset: Code={item.AssetCode}, Tag={item.AssetTag}, Name={item.AssetName}, Category={item.AssetCategory}, Status={item.CurrentStatus}, Cost={item.TotalCapitalizedCost}, Value={item.CurrentValue}");
            }

            Assert.NotNull(result);
            Assert.Equal(3, result.TotalCount);
            Assert.Equal(3, result.Items.Count);
            Assert.All(result.Items, item => Assert.False(string.IsNullOrWhiteSpace(item.AssetCode)));

            // Act 2: GetAssetKpisAsync
            var kpis = await service.GetAssetKpisAsync();
            _output.WriteLine($"GetAssetKpisAsync Result: TotalAssets={kpis.TotalAssetsCount}, Active={kpis.ActiveAssetsCount}, TotalValue={kpis.TotalAssetValue}, BookValue={kpis.CurrentBookValue}");
            Assert.NotNull(kpis);
            Assert.Equal(3, kpis.TotalAssetsCount);
        }
    }
}
