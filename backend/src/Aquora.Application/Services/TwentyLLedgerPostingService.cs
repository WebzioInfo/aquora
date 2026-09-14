using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Aquora.Application.Services;

/// <summary>Only supported write path for the new 20L container ledger.</summary>
public sealed class TwentyLLedgerPostingService : ITwentyLLedgerPostingService
{
    private readonly ITenantDbContext _db;
    private readonly ICurrentUserContext _user;
    public TwentyLLedgerPostingService(ITenantDbContext db, ICurrentUserContext user) { _db = db; _user = user; }

    public async Task<TwentyLJarMovement> PostAsync(TwentyLPostingRequest request, CancellationToken ct = default)
    {
        if (request.Quantity <= 0) throw new InvalidOperationException("20L movement quantity must be positive.");
        var exception = request.IsOpeningBalance || request.IsPurchase || request.IsAdjustment;
        if (exception && !_user.HasPermission("20L.ManageJarInventory")) throw new UnauthorizedAccessException("This controlled 20L ledger operation requires inventory permission.");
        if (request.IsAdjustment && string.IsNullOrWhiteSpace(request.Reason)) throw new InvalidOperationException("A reason is required for a 20L jar adjustment.");

        var ownsTransaction = _db.Database.CurrentTransaction is null;
        await using var transaction = ownsTransaction ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, ct) : null;
        try
        {
            var companyId = await _db.Companies.Where(c => c.TenantId == _user.TenantId).Select(c => c.Id).FirstOrDefaultAsync(ct);
            var sourceKey = Key(companyId, request.Source);
            var destinationKey = Key(companyId, request.Destination);
            foreach (var key in new[] { sourceKey, destinationKey }.Distinct().OrderBy(x => x))
                await _db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);

            var source = await Position(companyId, request.Source, sourceKey, ct);
            var destination = sourceKey == destinationKey ? source : await Position(companyId, request.Destination, destinationKey, ct);
            if (!exception && source.Quantity < request.Quantity)
                throw new InvalidOperationException($"Insufficient 20L jar availability for the selected owner, holder, location and state. Available: {source.Quantity}; requested: {request.Quantity}.");

            if (!exception) source.Quantity -= request.Quantity;
            destination.Quantity += request.Quantity;
            var movement = new TwentyLJarMovement
            {
                TenantId = _user.TenantId, CompanyId = companyId, ProductId = request.Destination.ProductId,
                OwnerType = request.Destination.OwnerType, OwnerCustomerId = request.Destination.OwnerCustomerId,
                HolderType = request.Destination.HolderType, HolderCustomerId = request.Destination.HolderCustomerId,
                FromLocationType = request.Source.LocationType, FromCustomerId = request.Source.HolderCustomerId, FromLocationReference = request.Source.LocationReference,
                ToLocationType = request.Destination.LocationType, ToCustomerId = request.Destination.HolderCustomerId, ToLocationReference = request.Destination.LocationReference,
                ContainerStatus = request.Destination.ContainerStatus, MovementType = request.MovementType, Quantity = request.Quantity,
                ReferenceId = request.ReferenceId, ReferenceType = request.ReferenceType, OccurredAt = request.OccurredAt, Reason = request.Reason, Notes = request.Notes,
                CreatedAt = DateTime.UtcNow, CreatedBy = _user.UserId ?? string.Empty
            };
            _db.TwentyLJarMovements.Add(movement);
            await _db.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return movement;
        }
        catch { if (transaction is not null) await transaction.RollbackAsync(ct); throw; }
    }

    private async Task<TwentyLJarPosition> Position(Guid companyId, TwentyLPosition p, string key, CancellationToken ct)
    {
        var existing = await _db.TwentyLJarPositions.SingleOrDefaultAsync(x => x.TenantId == _user.TenantId && x.CompanyId == companyId && x.PositionKey == key, ct);
        if (existing is not null) return existing;
        var position = new TwentyLJarPosition { TenantId = _user.TenantId, CompanyId = companyId, PositionKey = key, ProductId = p.ProductId, OwnerType = p.OwnerType, OwnerCustomerId = p.OwnerCustomerId, HolderType = p.HolderType, HolderCustomerId = p.HolderCustomerId, LocationType = p.LocationType, LocationReference = p.LocationReference, ContainerStatus = p.ContainerStatus, CreatedAt = DateTime.UtcNow, CreatedBy = _user.UserId ?? string.Empty };
        _db.TwentyLJarPositions.Add(position); return position;
    }
    private static string Key(Guid companyId, TwentyLPosition p) => string.Join('|', companyId, p.ProductId?.ToString() ?? "-", p.OwnerType, p.OwnerCustomerId?.ToString() ?? "-", p.HolderType, p.HolderCustomerId?.ToString() ?? "-", p.LocationType, p.LocationReference ?? "-", p.ContainerStatus);
}
