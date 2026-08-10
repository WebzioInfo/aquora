using System;
using System.Collections.Generic;
using System.Text.Json;
using Aquora.Application.Services;
using Xunit;

namespace Aquora.Tests
{
    public class DataFingerprintTests
    {
        [Fact]
        public void BackupFewerColumnsThanDb_ProducesSameFingerprintWhenFilteredBySnapshotColumns()
        {
            var oldBackupRow = new Dictionary<string, object>
            {
                { "Id", "00701403-cbce-4dab-b399-d6ab7b717ba2" },
                { "Name", "Sinan Company" },
                { "Code", "SINAN" }
            };

            var newDbRow = new Dictionary<string, object>
            {
                { "Id", Guid.Parse("00701403-cbce-4dab-b399-d6ab7b717ba2") },
                { "Name", "Sinan Company" },
                { "Code", "SINAN" },
                { "AdminPinHash", DBNull.Value },
                { "ApiKey", DBNull.Value }
            };

            var snapshotCols = oldBackupRow.Keys;

            var fpBackup = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { oldBackupRow }, snapshotCols);
            var fpDb = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { newDbRow }, snapshotCols);

            Assert.Equal(fpBackup, fpDb);
        }

        [Fact]
        public void SameLogicalRow_JsonAndDb_ProducesSameFingerprint()
        {
            var jsonRow = new Dictionary<string, object>
            {
                { "Id", JsonDocument.Parse("\"7d77da44-5307-489c-b474-bf9cdc6137ee\"").RootElement },
                { "Name", JsonDocument.Parse("\"Sinan Company\"").RootElement },
                { "IsActive", JsonDocument.Parse("true").RootElement },
                { "CreatedAt", JsonDocument.Parse("\"2026-08-10T08:53:52Z\"").RootElement }
            };

            var dbRow = new Dictionary<string, object>
            {
                { "Id", Guid.Parse("7D77DA44-5307-489C-B474-BF9CDC6137EE") },
                { "Name", "Sinan Company" },
                { "IsActive", true },
                { "CreatedAt", DateTime.SpecifyKind(DateTime.Parse("2026-08-10T08:53:52"), DateTimeKind.Utc) }
            };

            var fpJson = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { jsonRow });
            var fpDb = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { dbRow });

            Assert.Equal(fpJson, fpDb);
        }

        [Fact]
        public void DifferentValue_ProducesDifferentFingerprint()
        {
            var row1 = new Dictionary<string, object> { { "Code", "LINE-4" } };
            var row2 = new Dictionary<string, object> { { "Code", "RESTORE_TEST_MUTATED" } };

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { row1 });
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { row2 });

            Assert.NotEqual(fp1, fp2);
        }

        [Fact]
        public void ColumnOrdering_DoesNotAffectFingerprint()
        {
            var row1 = new Dictionary<string, object> { { "A", 1 }, { "B", 2 } };
            var row2 = new Dictionary<string, object> { { "B", 2 }, { "A", 1 } };

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { row1 });
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { row2 });

            Assert.Equal(fp1, fp2);
        }

        [Fact]
        public void RowOrdering_DoesNotAffectFingerprint()
        {
            var r1 = new Dictionary<string, object> { { "Id", "1" } };
            var r2 = new Dictionary<string, object> { { "Id", "2" } };

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { r1, r2 });
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { r2, r1 });

            Assert.Equal(fp1, fp2);
        }

        [Fact]
        public void NullVsEmptyString_ProducesDifferentFingerprint()
        {
            var rowNull = new Dictionary<string, object> { { "Val", DBNull.Value } };
            var rowEmpty = new Dictionary<string, object> { { "Val", "" } };

            var fpNull = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { rowNull });
            var fpEmpty = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { rowEmpty });

            Assert.NotEqual(fpNull, fpEmpty);
        }

        [Fact]
        public void GuidCaseDifference_ProducesSameFingerprint()
        {
            var rowUpper = new Dictionary<string, object> { { "Id", "7D77DA44-5307-489C-B474-BF9CDC6137EE" } };
            var rowLower = new Dictionary<string, object> { { "Id", "7d77da44-5307-489c-b474-bf9cdc6137ee" } };

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { rowUpper });
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { rowLower });

            Assert.Equal(fp1, fp2);
        }

        [Fact]
        public void UtcTimestampEquivalent_ProducesSameFingerprint()
        {
            var dtUtc = DateTime.SpecifyKind(DateTime.Parse("2026-08-10T08:53:52"), DateTimeKind.Utc);
            var strIso = "2026-08-10T08:53:52Z";

            var r1 = new Dictionary<string, object> { { "Time", dtUtc } };
            var r2 = new Dictionary<string, object> { { "Time", strIso } };

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { r1 });
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { r2 });

            Assert.Equal(fp1, fp2);
        }

        [Fact]
        public void DecimalFormattingDifferences_ProducesSameFingerprint()
        {
            var r1 = new Dictionary<string, object> { { "Amount", 100.50m } };
            var r2 = new Dictionary<string, object> { { "Amount", 100.5m } };

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { r1 });
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { r2 });

            Assert.Equal(fp1, fp2);
        }

        [Fact]
        public void OldCompaniesBackup_SchemaAwareFingerprintRegression()
        {
            var oldCompanyBackup = new Dictionary<string, object>
            {
                { "Id", "00701403-cbce-4dab-b399-d6ab7b717ba2" },
                { "Name", "Sinan Company" },
                { "Code", "SINAN" },
                { "IsActive", true },
                { "TimeZone", "Asia/Kolkata" },
                { "DateFormat", "dd MMM yyyy" },
                { "TimeFormat", "12h" },
                { "TenantId", "7d77da44-5307-489c-b474-bf9cdc6137ee" },
                { "CreatedAt", "2026-08-10T08:53:52.000000Z" },
                { "CreatedBy", "System" },
                { "IsDeleted", false }
            };

            var currentCompanyDb = new Dictionary<string, object>
            {
                { "Id", Guid.Parse("00701403-cbce-4dab-b399-d6ab7b717ba2") },
                { "Name", "Sinan Company" },
                { "Code", "SINAN" },
                { "IsActive", true },
                { "TimeZone", "Asia/Kolkata" },
                { "DateFormat", "dd MMM yyyy" },
                { "TimeFormat", "12h" },
                { "TenantId", Guid.Parse("7d77da44-5307-489c-b474-bf9cdc6137ee") },
                { "CreatedAt", DateTime.SpecifyKind(DateTime.Parse("2026-08-10T08:53:52"), DateTimeKind.Utc) },
                { "CreatedBy", "System" },
                { "IsDeleted", false },
                { "AdminPinHash", DBNull.Value },
                { "ApiKey", DBNull.Value }
            };

            var snapshotCols = oldCompanyBackup.Keys;

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { oldCompanyBackup }, snapshotCols);
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { currentCompanyDb }, snapshotCols);

            Assert.Equal(fp1, fp2);
        }

        [Fact]
        public void NewCompaniesBackupWithNewColumns_FingerprintMatches()
        {
            var newCompanyBackup = new Dictionary<string, object>
            {
                { "Id", "00701403-cbce-4dab-b399-d6ab7b717ba2" },
                { "Name", "Sinan Company" },
                { "Code", "SINAN" },
                { "AdminPinHash", null! },
                { "ApiKey", null! }
            };

            var currentCompanyDb = new Dictionary<string, object>
            {
                { "Id", Guid.Parse("00701403-cbce-4dab-b399-d6ab7b717ba2") },
                { "Name", "Sinan Company" },
                { "Code", "SINAN" },
                { "AdminPinHash", DBNull.Value },
                { "ApiKey", DBNull.Value }
            };

            var snapshotCols = newCompanyBackup.Keys;

            var fp1 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { newCompanyBackup }, snapshotCols);
            var fp2 = DataFingerprintService.ComputeTableFingerprint(new List<Dictionary<string, object>> { currentCompanyDb }, snapshotCols);

            Assert.Equal(fp1, fp2);
        }
    }
}
