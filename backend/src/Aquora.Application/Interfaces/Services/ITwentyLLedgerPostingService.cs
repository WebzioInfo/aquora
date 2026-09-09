using Aquora.Domain.Entities;

namespace Aquora.Application.Interfaces.Services;

public sealed record TwentyLPosition(string OwnerType, Guid? OwnerCustomerId, string HolderType, Guid? HolderCustomerId, string LocationType, string? LocationReference, string ContainerStatus, Guid? ProductId);
public sealed record TwentyLPostingRequest(TwentyLPosition Source, TwentyLPosition Destination, int Quantity, string MovementType, Guid? ReferenceId, string? ReferenceType, DateTime OccurredAt, string? Reason, string? Notes, bool IsOpeningBalance = false, bool IsPurchase = false, bool IsAdjustment = false);

public interface ITwentyLLedgerPostingService
{
    Task<TwentyLJarMovement> PostAsync(TwentyLPostingRequest request, CancellationToken cancellationToken = default);
}
