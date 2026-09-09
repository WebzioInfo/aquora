using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Xunit;
using Xunit.Abstractions;

namespace Aquora.Tests
{
    public class MigrationSchemaAuditTests
    {
        private readonly ITestOutputHelper _output;

        public MigrationSchemaAuditTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void AuditTenantMigrations_CheckSchemaProperties()
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var dir = new DirectoryInfo(baseDir);
            while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "backend", "src", "Aquora.Persistence", "Migrations", "Tenant")))
            {
                dir = dir.Parent;
            }

            Assert.NotNull(dir);
            var migrationsDir = Path.Combine(dir.FullName, "backend", "src", "Aquora.Persistence", "Migrations", "Tenant");
            Assert.True(Directory.Exists(migrationsDir), $"Migrations directory {migrationsDir} does not exist");

            var migrationFiles = Directory.GetFiles(migrationsDir, "*.cs")
                .Where(f => !f.EndsWith(".Designer.cs") && !f.EndsWith("Snapshot.cs"))
                .ToList();

            _output.WriteLine($"Total migration files: {migrationFiles.Count}");

            var issues = 0;
            foreach (var file in migrationFiles)
            {
                var fileName = Path.GetFileName(file);
                var content = File.ReadAllText(file);

                var hasFailSafeResolver = content.Contains("TenantSchemaResolver.ResolveRequiredSchema()");
                var hasHardcodedPublic = Regex.IsMatch(content, @"schema:\s*""public""");
                var hasUnqualifiedAlterCompanies = Regex.IsMatch(content, @"ALTER\s+TABLE\s+""Companies""", RegexOptions.IgnoreCase);
                var hasUnqualifiedUpdateBankLedger = Regex.IsMatch(content, @"UPDATE\s+""BankLedgerEntries""", RegexOptions.IgnoreCase);
                var hasUnqualifiedInsertOperations = Regex.IsMatch(content, @"INSERT\s+INTO\s+""OperationsIssueAffectedMachines""", RegexOptions.IgnoreCase);

                if (!hasFailSafeResolver || hasHardcodedPublic || hasUnqualifiedAlterCompanies || hasUnqualifiedUpdateBankLedger || hasUnqualifiedInsertOperations)
                {
                    _output.WriteLine($"ISSUE in {fileName}: HasFailSafeResolver={hasFailSafeResolver}, HardcodedPublic={hasHardcodedPublic}, AlterCompanies={hasUnqualifiedAlterCompanies}, UpdateBankLedger={hasUnqualifiedUpdateBankLedger}, InsertOperations={hasUnqualifiedInsertOperations}");
                    issues++;
                }
            }

            _output.WriteLine($"Total files with issues: {issues}");
            Assert.Equal(0, issues);
        }
    }
}
