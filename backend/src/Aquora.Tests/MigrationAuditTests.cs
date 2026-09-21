using System;
using System.Linq;
using System.Reflection;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Aquora.Persistence.Context;
using Xunit;
using Xunit.Abstractions;

namespace Aquora.Tests
{
    public class MigrationAuditTests
    {
        private readonly ITestOutputHelper _output;

        public MigrationAuditTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void AuditTenantMigrations()
        {
            var assembly = typeof(TenantDbContext).Assembly;
            var migrationTypes = assembly.GetTypes()
                .Where(t => typeof(Migration).IsAssignableFrom(t) && !t.IsAbstract && t.Namespace != null && t.Namespace.Contains("Tenant"))
                .ToList();

            _output.WriteLine($"Total Migration classes found in Tenant namespace: {migrationTypes.Count}");

            int missingCount = 0;
            int validCount = 0;

            foreach (var t in migrationTypes)
            {
                var attr = t.GetCustomAttribute<MigrationAttribute>();
                var dbContextAttr = t.GetCustomAttribute<DbContextAttribute>();

                if (attr == null)
                {
                    missingCount++;
                    _output.WriteLine($"[CRITICAL DEFECT - NO [Migration] ATTRIBUTE]: {t.FullName}");
                }
                else
                {
                    validCount++;
                    _output.WriteLine($"[VALID MIGRATION]: {attr.Id} -> {t.Name} (DbContext: {dbContextAttr?.ContextType.Name ?? "NONE"})");
                }
            }

            _output.WriteLine($"Summary: Valid={validCount}, MissingAttribute={missingCount}");
            Assert.Equal(0, missingCount);
        }
    }
}
