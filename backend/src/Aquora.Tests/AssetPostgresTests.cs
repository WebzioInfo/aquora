using System.Data;
using Aquora.Application.DTOs;
using Aquora.Application.Interfaces;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Moq;
using Npgsql;

namespace Aquora.Tests;

// Opt-in PostgreSQL integration test. All objects and rows live in one random scratch schema.
public sealed class AssetPostgresFactAttribute : FactAttribute
{
    public AssetPostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AQUORA_ASSET_TEST_CONNECTION")))
            Skip = "Set AQUORA_ASSET_TEST_CONNECTION to run isolated PostgreSQL verification.";
    }
}

public class AssetPostgresTests
{
    private static bool IsSerializationConflict(Exception ex) => ex is PostgresException pg && pg.SqlState == "40001" || ex.InnerException != null && IsSerializationConflict(ex.InnerException);

    [AssetPostgresFact]
    public async Task Lifecycle_DeletesSafely_RollsBack_AndSerializesConcurrentDepreciation()
    {
        var connectionString = Environment.GetEnvironmentVariable("AQUORA_ASSET_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString)) return;
        var schema = "asset_test_" + Guid.NewGuid().ToString("N");
        var tenantId = Guid.NewGuid();
        var tenant = new Mock<ITenantProvider>();
        tenant.SetupGet(t => t.TenantId).Returns(tenantId);
        tenant.SetupGet(t => t.TenantSchemaName).Returns(schema);
        var user = new Mock<ICurrentUserContext>();
        user.SetupGet(u => u.UserId).Returns("asset-integration-test");
        user.SetupGet(u => u.TenantId).Returns(tenantId);
        var options = new DbContextOptionsBuilder<TenantDbContext>().UseNpgsql(connectionString)
            .ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>().Options;
        TenantDbContext Open() => new(options, tenant.Object, user.Object);
        await using var admin = new NpgsqlConnection(connectionString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"CREATE SCHEMA \"{schema}\"", admin)) await create.ExecuteNonQueryAsync();
        try
        {
            await using var db = Open();
            var model = db.GetService<IDesignTimeModel>().Model;
            var allowed = new HashSet<string> { "Assets", "AssetHistories", "AssetMaintenanceRecords", "AuditLogs", "Companies", "Purchases" };
            var operations = db.GetService<IMigrationsModelDiffer>().GetDifferences(null, model.GetRelationalModel())
                .OfType<CreateTableOperation>().Where(o => o.Schema == schema && allowed.Contains(o.Name)).ToList();
            Assert.Equal(allowed.Count, operations.Count);
            foreach (var table in operations)
                table.ForeignKeys.RemoveAll(f => f.PrincipalSchema != schema || !allowed.Contains(f.PrincipalTable));
            foreach (var command in db.GetService<IMigrationsSqlGenerator>().Generate(operations, model))
                await db.Database.ExecuteSqlRawAsync(command.CommandText);
            db.Companies.Add(new Company { TenantId = tenantId, Name = "Isolated asset test", Code = "ASSET-TEST" });
            await db.SaveChangesAsync();
            var service = new AssetManagementService(db, tenant.Object, user.Object);
            CreateAssetRequest New() => new() { AssetName = "Isolated test asset", AssetCategory = "Other", PurchasePrice = 100000, PurchaseDate = DateTime.UtcNow.AddDays(-1) };
            var accidental = await service.CreateAssetAsync(New());
            Assert.True(await service.DeleteAssetAsync(accidental.Id, new() { ExpectedVersion = accidental.Version }));
            Assert.False(await db.Assets.IgnoreQueryFilters().AnyAsync(a => a.Id == accidental.Id));
            Assert.True(await db.AuditLogs.AnyAsync(a => a.PrimaryKey == accidental.Id.ToString() && a.Action == "Asset Permanently Deleted"));
            // A real PostgreSQL employee directory in the scratch schema, with no access to public.Users.
            await using var directory = new AssetDirectoryTestContext(new DbContextOptionsBuilder<AssetDirectoryTestContext>().UseNpgsql(connectionString).Options, schema);
            var directorySql = directory.Database.GenerateCreateScript();
            await directory.Database.ExecuteSqlRawAsync(directorySql);
            var employeeA = new User { TenantId = tenantId, FirstName = "Test", LastName = "A", Email = "a@example.test", Department = "Production", PasswordHash = "test", CreatedBy = "test" };
            var employeeB = new User { TenantId = tenantId, FirstName = "Test", LastName = "B", Email = "b@example.test", Department = "Accounts", PasswordHash = "test", CreatedBy = "test" };
            directory.Users.AddRange(employeeA, employeeB); await directory.SaveChangesAsync();
            var platform = new Mock<IPlatformDbContext>(); platform.SetupGet(p => p.Users).Returns(directory.Users);
            var assignmentService = new AssetManagementService(db, tenant.Object, user.Object, platform.Object);
            Assert.Single(await assignmentService.SearchEmployeesAsync("Accounts"));
            var assignedAsset = await assignmentService.CreateAssetAsync(New());
            var edited = await assignmentService.UpdateAssetAsync(assignedAsset.Id, new() { ExpectedVersion = assignedAsset.Version, AssetName = "Edited in database", AssetCategory = "Other" });
            var assignedA = await assignmentService.AssignAssetAsync(assignedAsset.Id, new() { ExpectedVersion = edited!.Version, EmployeeId = employeeA.Id });
            var assignedB = await assignmentService.AssignAssetAsync(assignedAsset.Id, new() { ExpectedVersion = assignedA!.Version, EmployeeId = employeeB.Id });
            await Assert.ThrowsAsync<ArgumentException>(() => assignmentService.DeleteAssetAsync(assignedAsset.Id, new() { ExpectedVersion = assignedB!.Version }));
            var disposed = await assignmentService.DisposeAssetAsync(assignedAsset.Id, new() { ExpectedVersion = assignedB!.Version, Reason = "Integration test disposal" });
            await using (var reload = Open())
            {
                var row = await reload.Assets.SingleAsync(a => a.Id == assignedAsset.Id);
                Assert.Equal("Edited in database", row.AssetName);
                Assert.Equal(employeeB.Id, row.AssignedEmployeeId);
                Assert.Equal("Accounts", row.Department);
                Assert.Equal("Disposed", row.CurrentStatus);
                Assert.Equal(100000, row.CurrentValue);
                Assert.Equal(2, await reload.AssetHistories.CountAsync(h => h.AssetId == row.Id && h.Action == "Asset Assigned"));
                var summary = await new AssetManagementService(reload, tenant.Object, user.Object).GetAssetKpisAsync();
                Assert.Equal(1, summary.DisposedCount); Assert.Equal(0, summary.ActiveAssetsCount); Assert.Equal(0, summary.CurrentBookValue);
            }
            var asset = await service.CreateAssetAsync(New());
            var first = await service.CalculateDepreciationAsync(asset.Id, new() { Percentage = 10, ExpectedVersion = asset.Version, EffectiveDate = DateTime.UtcNow.Date });
            Assert.Equal(90000, first!.CurrentValue);
            await using (var fresh = Open())
            {
                var freshService = new AssetManagementService(fresh, tenant.Object, user.Object);
                var second = await freshService.CalculateDepreciationAsync(asset.Id, new() { Percentage = 10, ExpectedVersion = first.Version, EffectiveDate = DateTime.UtcNow.Date });
                Assert.Equal(81000, second!.CurrentValue);
                await Assert.ThrowsAsync<ArgumentException>(() => freshService.DeleteAssetAsync(asset.Id, new() { ExpectedVersion = second.Version }));
            }
            // A database failure during history insertion must leave both value and history unchanged.
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{schema}\".\"AssetHistories\" ADD CONSTRAINT test_failure CHECK (\"Action\" <> 'Depreciation Applied') NOT VALID");
            await using (var failing = Open())
            {
                var failingService = new AssetManagementService(failing, tenant.Object, user.Object);
                var before = (await failingService.GetAssetByIdAsync(asset.Id))!;
                await Assert.ThrowsAsync<DbUpdateException>(() => failingService.CalculateDepreciationAsync(asset.Id, new() { Percentage = 10, ExpectedVersion = before.Version, EffectiveDate = DateTime.UtcNow.Date }));
            }
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{schema}\".\"AssetHistories\" DROP CONSTRAINT test_failure");
            await using (var check = Open())
            {
                Assert.Equal(81000, (await check.Assets.SingleAsync(a => a.Id == asset.Id)).CurrentValue);
                Assert.Equal(2, await check.AssetHistories.CountAsync(h => h.AssetId == asset.Id && h.Action == "Depreciation Applied"));
            }
            // Independent DbContexts submit the same version concurrently: exactly one may succeed.
            await using var left = Open(); await using var right = Open();
            var leftService = new AssetManagementService(left, tenant.Object, user.Object);
            var rightService = new AssetManagementService(right, tenant.Object, user.Object);
            var current = (await leftService.GetAssetByIdAsync(asset.Id))!;
            async Task<bool> TryDepreciate(AssetManagementService target)
            {
                try { await target.CalculateDepreciationAsync(asset.Id, new() { Percentage = 10, ExpectedVersion = current.Version, EffectiveDate = DateTime.UtcNow.Date }); return true; }
                catch (DbUpdateConcurrencyException) { return false; }
                catch (PostgresException ex) when (ex.SqlState == "40001") { return false; }
                catch (Exception ex) when (IsSerializationConflict(ex)) { return false; }
            }
            var outcomes = await Task.WhenAll(TryDepreciate(leftService), TryDepreciate(rightService));
            Assert.Single(outcomes, success => success);
            await using var final = Open();
            Assert.Equal(72900, (await final.Assets.SingleAsync(a => a.Id == asset.Id)).CurrentValue);
        }
        finally
        {
            // This identifier is generated here, never supplied by a caller or derived from tenant data.
            if (!System.Text.RegularExpressions.Regex.IsMatch(schema, "^asset_test_[a-f0-9]{32}$")) throw new InvalidOperationException("Invalid scratch schema.");
            await using var cleanup = new NpgsqlCommand($"DROP SCHEMA \"{schema}\" CASCADE", admin);
            await cleanup.ExecuteNonQueryAsync();
        }
    }
}

// Maps only the employee source table to the generated schema for this test.
public sealed class AssetDirectoryTestContext : DbContext
{
    private readonly string _schema;
    public AssetDirectoryTestContext(DbContextOptions<AssetDirectoryTestContext> options, string schema) : base(options) => _schema = schema;
    public DbSet<User> Users => Set<User>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>().ToTable("Users", _schema).Ignore(u => u.Tenant);
    }
}
