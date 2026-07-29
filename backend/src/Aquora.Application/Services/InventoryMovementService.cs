using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Aquora.Application.DTOs.Finance;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;

namespace Aquora.Application.Services
{
    public class InventoryMovementService : IInventoryMovementService
    {
        private readonly IServiceProvider _serviceProvider;
        
        public InventoryMovementService(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }
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

            
            // Finance Hook: Finished Goods Inventory
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var financeService = scope.ServiceProvider.GetService<IFinanceService>();
                if (financeService != null)
                {
                    var accounts = await financeService.GetAccountsAsync();
                    var inventoryAcct = accounts.FirstOrDefault(a => a.AccountName == "Finished Goods Inventory");
                    var costAcct = accounts.FirstOrDefault(a => a.AccountName == "Cost of Goods Sold");
                    
                    if (inventoryAcct != null && costAcct != null)
                    {
                        var totalAmount = Math.Abs(quantity) * 5m; // Avg COGS $5
                        if (quantity < 0) // Dispatch / Sale
                        {
                            await financeService.CreateJournalEntryAsync(new CreateJournalEntryRequest
                            {
                                TransactionDate = DateTime.UtcNow, VoucherType = "Journal", ReferenceNumber = referenceId.ToString(), Remarks = $"Finished Goods Dispatch {quantity}",
                                Lines = new List<CreateJournalEntryLineRequest>
                                {
                                    new CreateJournalEntryLineRequest { AccountId = costAcct.Id, DebitAmount = totalAmount, CreditAmount = 0, Description = "COGS" },
                                    new CreateJournalEntryLineRequest { AccountId = inventoryAcct.Id, DebitAmount = 0, CreditAmount = totalAmount, Description = "Inventory reduction" }
                                }
                            });
                        }
                    }
                }
            }
            catch (Exception ex) { Console.WriteLine("Finance Hook failed: " + ex.Message); }

            
            // Finance Hook: Finished Goods Inventory
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var financeService = scope.ServiceProvider.GetService<IFinanceService>();
                if (financeService != null)
                {
                    var accounts = await financeService.GetAccountsAsync();
                    var inventoryAcct = accounts.FirstOrDefault(a => a.AccountName == "Finished Goods Inventory");
                    var costAcct = accounts.FirstOrDefault(a => a.AccountName == "Cost of Goods Sold");
                    
                    if (inventoryAcct != null && costAcct != null)
                    {
                        var totalAmount = Math.Abs(quantity) * 5m; // Avg COGS $5
                        if (quantity < 0) // Dispatch / Sale
                        {
                            await financeService.CreateJournalEntryAsync(new CreateJournalEntryRequest
                            {
                                TransactionDate = DateTime.UtcNow, VoucherType = "Journal", ReferenceNumber = referenceId.ToString(), Remarks = $"Finished Goods Dispatch {quantity}",
                                Lines = new List<CreateJournalEntryLineRequest>
                                {
                                    new CreateJournalEntryLineRequest { AccountId = costAcct.Id, DebitAmount = totalAmount, CreditAmount = 0, Description = "COGS" },
                                    new CreateJournalEntryLineRequest { AccountId = inventoryAcct.Id, DebitAmount = 0, CreditAmount = totalAmount, Description = "Inventory reduction" }
                                }
                            });
                        }
                    }
                }
            }
            catch (Exception ex) { Console.WriteLine("Finance Hook failed: " + ex.Message); }
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

        public async Task<InventoryMovement> RecordOutstandingJarMovementAsync(
            ITenantDbContext context,
            Guid customerId,
            int quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy)
        {
            var customer = await context.Customers.FirstOrDefaultAsync(c => c.Id == customerId && !c.IsDeleted);
            if (customer == null)
            {
                throw new InvalidOperationException("Customer not found.");
            }

            int previousBalance = customer.OutstandingJars;
            int newBalance = previousBalance + quantity;
            if (newBalance < 0)
            {
                throw new InvalidOperationException($"Insufficient outstanding jars for customer '{customer.CustomerName}'. Current balance: {previousBalance}, requested change: {quantity}.");
            }

            customer.OutstandingJars = newBalance;

            var movement = new InventoryMovement
            {
                Id = Guid.NewGuid(),
                ProductId = null,
                RawMaterialId = null,
                Quantity = quantity,
                BalanceAfter = newBalance,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                InventoryType = "20L_Jar_Outstanding",
                Notes = notes,
                TenantId = tenantId,
                CompanyId = companyId,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = createdBy
            };

            context.InventoryMovements.Add(movement);
            return movement;
        }

        public async Task<InventoryMovement> RecordReservedEmptyJarMovementAsync(
            ITenantDbContext context,
            Guid customerId,
            int quantity,
            string referenceType,
            Guid referenceId,
            string? notes,
            Guid tenantId,
            Guid companyId,
            string createdBy)
        {
            var customer = await context.Customers.FirstOrDefaultAsync(c => c.Id == customerId && !c.IsDeleted);
            if (customer == null)
            {
                throw new InvalidOperationException("Customer not found.");
            }

            int previousBalance = customer.ReservedEmptyJars;
            int newBalance = previousBalance + quantity;
            if (newBalance < 0)
            {
                throw new InvalidOperationException($"Insufficient reserved empty jars for customer '{customer.CustomerName}'. Current reserved: {previousBalance}, requested change: {quantity}.");
            }

            customer.ReservedEmptyJars = newBalance;

            var movement = new InventoryMovement
            {
                Id = Guid.NewGuid(),
                ProductId = null,
                RawMaterialId = null,
                Quantity = quantity,
                BalanceAfter = newBalance,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                InventoryType = "20L_Jar_Reserved_Empty",
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
