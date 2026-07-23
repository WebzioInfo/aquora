using System;
using System.Threading.Tasks;
using Aquora.Domain.Entities;
using Aquora.Application.Interfaces;

namespace Aquora.Application.Interfaces.Services
{
    public interface IInventoryMovementService
    {
        Task<InventoryMovement> RecordProductMovementAsync(
            ITenantDbContext context,
            Guid productId,
            decimal quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy);

        Task<InventoryMovement> RecordRawMaterialMovementAsync(
            ITenantDbContext context,
            Guid rawMaterialId,
            decimal quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy);

        Task<InventoryMovement> RecordOutstandingJarMovementAsync(
            ITenantDbContext context,
            Guid customerId,
            int quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy);

        Task<InventoryMovement> RecordReservedEmptyJarMovementAsync(
            ITenantDbContext context,
            Guid customerId,
            int quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy);
    }
}
