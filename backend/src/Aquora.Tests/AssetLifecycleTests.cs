using System;
using System.Linq;
using System.Threading.Tasks;
using Aquora.Application.DTOs;
using Aquora.Application.Services;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Persistence.Context;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Aquora.Tests;

public partial class AssetManagementServiceTests
{
    private static CreateAssetRequest NewAsset() => new() { AssetName = "Test Equipment", AssetCategory = "Machinery", PurchasePrice = 100000, PurchaseDate = DateTime.UtcNow.AddDays(-2) };

    [Fact]
    public async Task PercentageDepreciation_UsesCurrentValue_PersistsHistory_RejectsStaleVersion()
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var original = await service.CreateAssetAsync(NewAsset());
        var first = await service.CalculateDepreciationAsync(original.Id, new() { Percentage = 10, EffectiveDate = DateTime.UtcNow.Date, ExpectedVersion = original.Version });
        Assert.Equal(90000, first!.CurrentValue);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.CalculateDepreciationAsync(original.Id, new() { Percentage = 10, EffectiveDate = DateTime.UtcNow.Date, ExpectedVersion = original.Version }));
        var second = await service.CalculateDepreciationAsync(original.Id, new() { Percentage = 10, EffectiveDate = DateTime.UtcNow.Date, ExpectedVersion = first.Version });
        db.ChangeTracker.Clear();
        Assert.Equal(81000, (await service.GetAssetByIdAsync(original.Id))!.CurrentValue);
        Assert.Equal(19000, second!.AccumulatedDepreciation);
        var history = await service.GetAssetHistoryAsync(original.Id);
        Assert.Equal(2, history.Count(h => h.Action == "Depreciation Applied"));
        Assert.Contains(history, h => h.Remarks!.Contains("\"DepreciationAmount\":9000"));
    }

    [Theory]
    [InlineData(-10)] [InlineData(0)] [InlineData(101)] [InlineData(0.12345)]
    public async Task Depreciation_RejectsInvalidPercentage_WithoutChangingHistory(decimal percentage)
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var asset = await service.CreateAssetAsync(NewAsset());
        await Assert.ThrowsAsync<ArgumentException>(() => service.CalculateDepreciationAsync(asset.Id, new() { Percentage = percentage, ExpectedVersion = asset.Version, EffectiveDate = DateTime.UtcNow.Date }));
        Assert.Equal(100000, (await service.GetAssetByIdAsync(asset.Id))!.CurrentValue);
        Assert.Single(await service.GetAssetHistoryAsync(asset.Id));
    }

    [Fact]
    public async Task Depreciation_Allows100Percent_AndProtectsResidualValue()
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var asset = await service.CreateAssetAsync(NewAsset());
        var result = await service.CalculateDepreciationAsync(asset.Id, new() { Percentage = 100, ExpectedVersion = asset.Version, EffectiveDate = DateTime.UtcNow.Date });
        Assert.Equal(0, result!.CurrentValue);
        var request = NewAsset(); request.ResidualValue = 1000;
        var residual = await service.CreateAssetAsync(request);
        await Assert.ThrowsAsync<ArgumentException>(() => service.CalculateDepreciationAsync(residual.Id, new() { Percentage = 100, ExpectedVersion = residual.Version, EffectiveDate = DateTime.UtcNow.Date }));
    }

    [Fact]
    public async Task Edit_PersistsDescription_AndCannotChangeStatusOrAcquisitionValue()
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var original = await service.CreateAssetAsync(NewAsset());
        await service.UpdateAssetAsync(original.Id, new() { AssetName = "Renamed", AssetCategory = "Machinery", ExpectedVersion = original.Version });
        db.ChangeTracker.Clear();
        var edited = await service.GetAssetByIdAsync(original.Id);
        Assert.Equal("Renamed", edited!.AssetName);
        Assert.Equal(original.PurchasePrice, edited.PurchasePrice);
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateAssetAsync(original.Id, new() { AssetName = "Renamed", AssetCategory = "Machinery", CurrentStatus = "Disposed", ExpectedVersion = edited.Version }));
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.UpdateAssetAsync(original.Id, new() { AssetName = "Stale", AssetCategory = "Machinery", ExpectedVersion = original.Version }));
        Assert.Contains(await service.GetAssetHistoryAsync(original.Id), h => h.PreviousValue != null && h.PreviousValue.Contains("Test Equipment") && h.NewValue!.Contains("Renamed"));
    }

    [Fact]
    public async Task Disposal_PreservesValueHistory_AndBlocksAllActiveOperations()
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var asset = await service.CreateAssetAsync(NewAsset());
        var disposed = await service.DisposeAssetAsync(asset.Id, new() { ExpectedVersion = asset.Version, Reason = "Scrapped", DisposalDate = DateTime.UtcNow.Date });
        db.ChangeTracker.Clear();
        Assert.Equal("Disposed", (await service.GetAssetByIdAsync(asset.Id))!.CurrentStatus);
        Assert.Equal(100000, disposed!.CurrentValue);
        var kpis = await service.GetAssetKpisAsync();
        Assert.Equal(1, kpis.TotalAssetsCount); Assert.Equal(1, kpis.DisposedCount); Assert.Equal(0, kpis.ActiveAssetsCount); Assert.Equal(0, kpis.CurrentBookValue);
        Assert.Single((await service.GetAssetsAsync(status: "Disposed")).Items);
        Assert.Empty((await service.GetAssetsAsync(status: "Active")).Items);
        await Assert.ThrowsAsync<ArgumentException>(() => service.AssignAssetAsync(asset.Id, new() { ExpectedVersion = disposed.Version }));
        await Assert.ThrowsAsync<ArgumentException>(() => service.TransferAssetAsync(asset.Id, new() { ExpectedVersion = disposed.Version }));
        await Assert.ThrowsAsync<ArgumentException>(() => service.RecordMaintenanceAsync(asset.Id, new() { ExpectedVersion = disposed.Version }));
        await Assert.ThrowsAsync<ArgumentException>(() => service.CalculateDepreciationAsync(asset.Id, new() { Percentage = 10, ExpectedVersion = disposed.Version }));
        await Assert.ThrowsAsync<ArgumentException>(() => service.DeleteAssetAsync(asset.Id, new() { ExpectedVersion = disposed.Version }));
        await Assert.ThrowsAsync<ArgumentException>(() => service.BulkUpdateStatusAsync(new() { AssetIds = new() { asset.Id }, Status = "Active" }));
    }

    [Fact]
    public async Task Assignment_UsesTenantDirectory_PreservesReassignmentHistory_AndRejectsFreeText()
    {
        var (db, tenant, user, tenantId, _) = CreateTestContext();
        using var platform = new PlatformDbContext(new DbContextOptionsBuilder<PlatformDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var first = new User { Id = Guid.NewGuid(), TenantId = tenantId, FirstName = "Employee", LastName = "A", Email = "a@example.test", PasswordHash = "test", CreatedBy = "test", Department = "Production" };
        var second = new User { Id = Guid.NewGuid(), TenantId = tenantId, FirstName = "Employee", LastName = "B", Email = "b@example.test", PasswordHash = "test", CreatedBy = "test", Department = "Accounts" };
        var foreign = new User { Id = Guid.NewGuid(), TenantId = Guid.NewGuid(), Email = "foreign@example.test", PasswordHash = "test", CreatedBy = "test" };
        platform.Users.AddRange(first, second, foreign); await platform.SaveChangesAsync();
        var service = new AssetManagementService(db, tenant.Object, user.Object, platform);
        var asset = await service.CreateAssetAsync(NewAsset());
        await Assert.ThrowsAsync<ArgumentException>(() => service.AssignAssetAsync(asset.Id, new() { EmployeeName = "Arbitrary", ExpectedVersion = asset.Version }));
        await Assert.ThrowsAsync<ArgumentException>(() => service.AssignAssetAsync(asset.Id, new() { EmployeeId = foreign.Id, ExpectedVersion = asset.Version }));
        var assigned = await service.AssignAssetAsync(asset.Id, new() { EmployeeId = first.Id, EmployeeName = "Spoofed", Department = "Wrong", ExpectedVersion = asset.Version });
        Assert.Equal("Employee A", assigned!.AssignedEmployeeName); Assert.Equal("Production", assigned.Department);
        var reassigned = await service.AssignAssetAsync(asset.Id, new() { EmployeeId = second.Id, ExpectedVersion = assigned.Version });
        db.ChangeTracker.Clear();
        Assert.Equal(second.Id, (await service.GetAssetByIdAsync(asset.Id))!.AssignedEmployeeId);
        Assert.Equal("Accounts", reassigned!.Department);
        Assert.Equal(2, (await service.GetAssetHistoryAsync(asset.Id)).Count(h => h.Action == "Asset Assigned"));
        Assert.Single(await service.SearchEmployeesAsync("Accounts"));
        Assert.Equal(2, (await service.SearchEmployeesAsync("")).Count);
        await Assert.ThrowsAsync<ArgumentException>(() => service.DeleteAssetAsync(asset.Id, new() { ExpectedVersion = reassigned.Version }));
    }

    [Fact]
    public async Task History_IsTenantScoped_AndDeletionRejectsMaintenanceOrPurchaseReferences()
    {
        var (db, tenant, user, tenantId, companyId) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var asset = await service.CreateAssetAsync(NewAsset());
        db.Purchases.Add(new Purchase { TenantId = tenantId, CompanyId = companyId, AssetId = asset.Id, PurchaseNo = "TEST", VendorName = "Test", CreatedBy = "test" });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => service.DeleteAssetAsync(asset.Id, new() { ExpectedVersion = asset.Version }));
        var otherId = Guid.NewGuid();
        db.AssetHistories.Add(new AssetHistory { AssetId = otherId, Action = "Private" }); await db.SaveChangesAsync();
        Assert.Empty(await service.GetAssetHistoryAsync(otherId));
    }

    [Fact]
    public async Task CheckAssetHistoryExists_NewAsset_ReturnsFalse_AndAllowsSafeDeletion()
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var asset = await service.CreateAssetAsync(NewAsset());

        var check = await service.CheckAssetHistoryExistsAsync(asset.Id);
        Assert.False(check.HasHistory);
        Assert.False(check.IsDisposed);
        Assert.Null(check.Reason);

        // Edit description / notes should not block deletion of accidental asset
        var updated = await service.UpdateAssetAsync(asset.Id, new() { AssetName = "Corrected Name", AssetCategory = "Machinery", ExpectedVersion = asset.Version, Notes = "Accidental duplicate" });
        var checkAfterEdit = await service.CheckAssetHistoryExistsAsync(asset.Id);
        Assert.False(checkAfterEdit.HasHistory);

        var deleted = await service.DeleteAssetAsync(asset.Id, new() { ExpectedVersion = updated!.Version });
        Assert.True(deleted);

        var fresh = await service.GetAssetByIdAsync(asset.Id);
        Assert.Null(fresh);
    }

    [Fact]
    public async Task CheckAssetHistoryExists_DetectsDepreciation_Disposal_AndMaintenance()
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);
        var asset = await service.CreateAssetAsync(NewAsset());

        // 1. Depreciation applied
        var depreciated = await service.CalculateDepreciationAsync(asset.Id, new() { Percentage = 10, EffectiveDate = DateTime.UtcNow.Date, ExpectedVersion = asset.Version });
        var checkDep = await service.CheckAssetHistoryExistsAsync(asset.Id);
        Assert.True(checkDep.HasHistory);
        Assert.Contains("depreciation", checkDep.Reason!, StringComparison.OrdinalIgnoreCase);

        // 2. Disposal
        var disposed = await service.DisposeAssetAsync(asset.Id, new() { ExpectedVersion = depreciated!.Version, Reason = "End of life", DisposalDate = DateTime.UtcNow.Date });
        var checkDisp = await service.CheckAssetHistoryExistsAsync(asset.Id);
        Assert.True(checkDisp.HasHistory);
        Assert.True(checkDisp.IsDisposed);
        Assert.Contains("disposed", checkDisp.Reason!, StringComparison.OrdinalIgnoreCase);

        // Attempt permanent deletion must be rejected with informative reason
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.DeleteAssetAsync(asset.Id, new() { ExpectedVersion = disposed!.Version }));
        Assert.Contains("disposed", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task EditAsset_PurchaseDate_UpdatesSuccessfully_AndProtectsHistoricalDepreciation()
    {
        var (db, tenant, user, _, _) = CreateTestContext();
        var service = new AssetManagementService(db, tenant.Object, user.Object);

        // 1. Create asset with purchase date 2026-01-30
        var request = NewAsset();
        request.PurchaseDate = new DateTime(2026, 1, 30, 0, 0, 0, DateTimeKind.Utc);
        var asset = await service.CreateAssetAsync(request);
        Assert.Equal(new DateTime(2026, 1, 30, 0, 0, 0, DateTimeKind.Utc), asset.PurchaseDate);

        // 2. Edit purchase date to 2026-01-31 (date persistence test)
        var newDate = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc);
        var updated = await service.UpdateAssetAsync(asset.Id, new()
        {
            AssetName = asset.AssetName,
            AssetCategory = asset.AssetCategory,
            PurchaseDate = newDate,
            ExpectedVersion = asset.Version
        });
        Assert.NotNull(updated);
        Assert.Equal(newDate, updated.PurchaseDate);

        // Verify database reload
        db.ChangeTracker.Clear();
        var loaded = await service.GetAssetByIdAsync(asset.Id);
        Assert.NotNull(loaded);
        Assert.Equal(newDate, loaded.PurchaseDate);

        // Verify history logged the purchase date change
        var history = await service.GetAssetHistoryAsync(asset.Id);
        Assert.Contains(history, h => h.Action == "Asset Updated" && h.Remarks!.Contains("Purchase Date: 2026-01-30 → 2026-01-31"));

        // 3. Post depreciation
        var depreciated = await service.CalculateDepreciationAsync(asset.Id, new()
        {
            Percentage = 10,
            EffectiveDate = DateTime.UtcNow.Date,
            ExpectedVersion = updated.Version
        });
        Assert.NotNull(depreciated);

        // 4. Attempting to modify purchase date after depreciation MUST be rejected
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateAssetAsync(asset.Id, new()
        {
            AssetName = asset.AssetName,
            AssetCategory = asset.AssetCategory,
            PurchaseDate = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            ExpectedVersion = depreciated.Version
        }));
        Assert.Contains("depreciation", ex.Message, StringComparison.OrdinalIgnoreCase);

        // But updating other metadata (e.g. description) without changing date remains permitted
        var safeUpdate = await service.UpdateAssetAsync(asset.Id, new()
        {
            AssetName = asset.AssetName,
            AssetCategory = asset.AssetCategory,
            PurchaseDate = newDate, // unchanged
            Description = "Updated description after depreciation",
            ExpectedVersion = depreciated.Version
        });
        Assert.NotNull(safeUpdate);
        Assert.Equal("Updated description after depreciation", safeUpdate.Description);
        Assert.Equal(newDate, safeUpdate.PurchaseDate);
    }
}
