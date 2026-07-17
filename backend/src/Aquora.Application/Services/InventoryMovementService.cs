using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

namespace Aquora.Application.Services
{
    public class InventoryMovementService : IInventoryMovementService
    {
        public async Task<InventoryMovement> RecordProductMovementAsync(
            ITenantDbContext context,
            Guid productId,
            decimal quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy)
        {
            var product = await context.Products.FirstOrDefaultAsync(p => p.Id == productId && !p.IsDeleted);
            if (product == null)
            {
                throw new InvalidOperationException("Product not found.");
            }

            decimal previousBalance = product.CurrentStock;
            decimal newStock = previousBalance + quantity;
            if (newStock < 0)
            {
                throw new InvalidOperationException($"Insufficient stock for finished product '{product.Name}'. Current stock: {previousBalance}, requested change: {quantity}.");
            }

            product.CurrentStock = newStock;

            var movement = new InventoryMovement
            {
                Id = Guid.NewGuid(),
                ProductId = productId,
                RawMaterialId = null,
                Quantity = quantity,
                BalanceAfter = newStock,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                InventoryType = "FinishedProduct",
                Notes = notes,
                TenantId = tenantId,
                CompanyId = companyId,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = createdBy
            };

            context.InventoryMovements.Add(movement);
            return movement;
        }

        public async Task<InventoryMovement> RecordRawMaterialMovementAsync(
            ITenantDbContext context,
            Guid rawMaterialId,
            decimal quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy)
        {
            var material = await context.RawMaterials.FirstOrDefaultAsync(rm => rm.Id == rawMaterialId && !rm.IsDeleted);
            if (material == null)
            {
                throw new InvalidOperationException("Raw material not found.");
            }

            decimal previousBalance = material.CurrentStock;
            decimal newStock = previousBalance + quantity;
            if (newStock < 0)
            {
                throw new InvalidOperationException($"Insufficient stock for raw material '{material.Name}'. Current stock: {previousBalance}, requested change: {quantity}.");
            }

            material.CurrentStock = newStock;

            var movement = new InventoryMovement
            {
                Id = Guid.NewGuid(),
                ProductId = null,
                RawMaterialId = rawMaterialId,
                Quantity = quantity,
                BalanceAfter = newStock,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                InventoryType = "RawMaterial",
                Notes = notes,
                TenantId = tenantId,
                CompanyId = companyId,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = createdBy
            };

            context.InventoryMovements.Add(movement);
            return movement;
        }
    }
}
