using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;
using Aquora.Application.DTOs.Finance;

using Microsoft.AspNetCore.SignalR;
using Aquora.API.Hubs;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class SalesController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly IInventoryMovementService _inventoryMovementService;
        private readonly IPlatformDbContext _platformContext;
        private readonly IHubContext<DashboardHub> _dashboardHub;

        public SalesController(
            ITenantDbContext tenantContext,
            ICurrentUserContext currentUserContext,
            IInventoryMovementService inventoryMovementService,
            IPlatformDbContext platformContext,
            IHubContext<DashboardHub> dashboardHub)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _inventoryMovementService = inventoryMovementService;
            _platformContext = platformContext;
            _dashboardHub = dashboardHub;
        }

        private async Task NotifyDashboardAsync(string eventName, object? data = null)
        {
            try
            {
                var tenantId = _currentUserContext.TenantId.ToString();
                await _dashboardHub.Clients.Group($"tenant_{tenantId}").SendAsync("DashboardEvent", new
                {
                    event_type = eventName,
                    tenant_id = tenantId,
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    payload = data
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SIGNALR WARNING]: Failed to emit dashboard event '{eventName}': {ex.Message}");
            }
        }

        private bool IsAuthorizedToWrite()
        {
            var allowedRoles = new[] { "CompanyAdmin", "Admin", "Manager" };
            return _currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<SalesTransactionDto>>>> GetSales(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] Guid? product = null,
            [FromQuery] Guid? customer = null,
            [FromQuery] string? type = null,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? sort = "newest")
        {
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var query = _tenantContext.SalesTransactions
                    .Include(t => t.Customer)
                    .Include(t => t.Product)
                    .Where(t => t.TenantId == tenantId && !t.IsDeleted)
                    .AsQueryable();

                // Searching
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.Trim().ToLower();
                    query = query.Where(t =>
                        t.TransactionNumber.ToLower().Contains(term) ||
                        t.Customer.CustomerName.ToLower().Contains(term) ||
                        t.Product.Name.ToLower().Contains(term));
                }

                // Filtering
                if (product.HasValue && product.Value != Guid.Empty)
                {
                    query = query.Where(t => t.ProductId == product.Value);
                }

                if (customer.HasValue && customer.Value != Guid.Empty)
                {
                    query = query.Where(t => t.CustomerId == customer.Value);
                }

                if (!string.IsNullOrWhiteSpace(type))
                {
                    query = query.Where(t => t.TransactionType == type);
                }

                if (!string.IsNullOrWhiteSpace(status))
                {
                    query = query.Where(t => t.Status == status);
                }

                if (startDate.HasValue)
                {
                    query = query.Where(t => t.TransactionDate >= startDate.Value);
                }

                if (endDate.HasValue)
                {
                    query = query.Where(t => t.TransactionDate <= endDate.Value);
                }

                // Sorting
                query = sort?.ToLower() switch
                {
                    "oldest" => query.OrderBy(t => t.TransactionDate).ThenBy(t => t.CreatedAt),
                    "largest_qty" => query.OrderByDescending(t => t.Cases),
                    _ => query.OrderByDescending(t => t.TransactionDate).ThenByDescending(t => t.CreatedAt) // newest
                };

                var totalCount = await query.CountAsync();
                var items = await query
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // Look up user names to display who created it
                var creatorIds = items
                    .Select(t => t.CreatedBy)
                    .Where(cb => !string.IsNullOrEmpty(cb) && Guid.TryParse(cb, out _))
                    .Select(Guid.Parse)
                    .Distinct()
                    .ToList();

                var users = await _platformContext.Users
                    .Where(u => creatorIds.Contains(u.Id))
                    .ToDictionaryAsync(u => u.Id.ToString(), u => $"{u.FirstName} {u.LastName}");

                var dtos = items.Select(t => new SalesTransactionDto
                {
                    Id = t.Id,
                    TransactionNumber = t.TransactionNumber,
                    CustomerId = t.CustomerId,
                    CustomerName = t.Customer?.CustomerName ?? "Unknown Customer",
                    CustomerCode = t.Customer?.CustomerCode ?? string.Empty,
                    ProductId = t.ProductId,
                    ProductName = t.Product?.Name ?? "Unknown Product",
                    ProductSku = t.Product?.SKU ?? string.Empty,
                    Cases = t.Cases,
                    TransactionType = t.TransactionType,
                    TransactionDate = t.TransactionDate,
                    ReferenceNumber = t.ReferenceNumber,
                    Remarks = t.Remarks,
                    Status = t.Status,
                    CreatedBy = t.CreatedBy,
                    CreatedByName = users.TryGetValue(t.CreatedBy, out var name) ? name : "System",
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt
                }).ToList();

                var pagedResult = new PagedResult<SalesTransactionDto>(dtos, totalCount, pageNumber, pageSize);
                return Success(pagedResult, "Sales transactions retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<PagedResult<SalesTransactionDto>>(ex.Message, "Failed to retrieve sales transactions.");
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ApiResponse<SalesTransactionDto>>> GetSalesTransaction(Guid id)
        {
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var txn = await _tenantContext.SalesTransactions
                    .Include(t => t.Customer)
                    .Include(t => t.Product)
                    .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && !t.IsDeleted);

                if (txn == null)
                {
                    return NotFound(ApiResponse<SalesTransactionDto>.CreateFailure("Sales transaction not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                string createdByName = "System";
                if (Guid.TryParse(txn.CreatedBy, out var cbGuid))
                {
                    var user = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == cbGuid);
                    if (user != null)
                    {
                        createdByName = $"{user.FirstName} {user.LastName}";
                    }
                }

                var dto = new SalesTransactionDto
                {
                    Id = txn.Id,
                    TransactionNumber = txn.TransactionNumber,
                    CustomerId = txn.CustomerId,
                    CustomerName = txn.Customer?.CustomerName ?? "Unknown Customer",
                    CustomerCode = txn.Customer?.CustomerCode ?? string.Empty,
                    ProductId = txn.ProductId,
                    ProductName = txn.Product?.Name ?? "Unknown Product",
                    ProductSku = txn.Product?.SKU ?? string.Empty,
                    Cases = txn.Cases,
                    TransactionType = txn.TransactionType,
                    TransactionDate = txn.TransactionDate,
                    ReferenceNumber = txn.ReferenceNumber,
                    Remarks = txn.Remarks,
                    Status = txn.Status,
                    CreatedBy = txn.CreatedBy,
                    CreatedByName = createdByName,
                    CreatedAt = txn.CreatedAt,
                    UpdatedAt = txn.UpdatedAt
                };

                return Success(dto, "Sales transaction retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<SalesTransactionDto>(ex.Message, "Failed to retrieve sales transaction.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<SalesTransactionDto>>> CreateSalesTransaction([FromBody] CreateSalesTransactionRequest request)
        {
            if (!IsAuthorizedToWrite())
            {
                return Unauthorized(ApiResponse<SalesTransactionDto>.CreateFailure("Unauthorized to create transactions.", "Unauthorized", HttpContext.TraceIdentifier));
            }

            if (request.Cases <= 0)
            {
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Quantity of cases must be greater than zero.", "Validation Error", HttpContext.TraceIdentifier));
            }

            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
            }

            using var dbTransaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var currentUserId = _currentUserContext.UserId ?? "System";

                // Load customer
                var customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == tenantId && !c.IsDeleted);
                if (customer == null)
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Customer not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // Load product
                var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId && !p.IsDeleted);
                if (product == null)
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Product not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Company not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // Generate txn number
                var randomCode = new Random().Next(1000, 9999);
                var txnNumber = $"TXN-{DateTime.UtcNow:yyyyMMdd}-{randomCode}";

                var transaction = new SalesTransaction
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = company.Id,
                    TransactionNumber = txnNumber,
                    CustomerId = request.CustomerId,
                    ProductId = request.ProductId,
                    Cases = request.Cases,
                    TransactionType = request.TransactionType,
                    TransactionDate = request.TransactionDate.ToUniversalTime(),
                    ReferenceNumber = request.ReferenceNumber?.Trim(),
                    Remarks = request.Remarks?.Trim(),
                    Status = "Completed",
                    CreatedBy = currentUserId
                };

                // Centralized Stock Movement Adjustment
                decimal stockAdjustment = 0;
                if (request.TransactionType == "Sales Dispatch" || request.TransactionType == "Damage")
                {
                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Customer Return")
                {
                    stockAdjustment = request.Cases;
                }
                else
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure($"Invalid transaction type: {request.TransactionType}", "Validation Error", HttpContext.TraceIdentifier));
                }

                // Call service to apply stock modification and log movement
                await _inventoryMovementService.RecordProductMovementAsync(
                    _tenantContext,
                    request.ProductId,
                    stockAdjustment,
                    "SalesTransaction",
                    transaction.Id,
                    $"{request.TransactionType}: {txnNumber}",
                    tenantId,
                    company.Id,
                    currentUserId);

                _tenantContext.SalesTransactions.Add(transaction);
                await _tenantContext.SaveChangesAsync();


                await dbTransaction.CommitAsync();

                await NotifyDashboardAsync(request.TransactionType == "Customer Return" ? "dispatch-returned" : "dispatch-created");

                // Auto-post to Finance Ledger
                if (request.TransactionType == "Sales Dispatch")
                {
                    try
                    {
                        var financeService = HttpContext.RequestServices.GetService(typeof(IFinanceService)) as IFinanceService;
                        if (financeService != null)
                        {
                            var accounts = await financeService.GetAccountsAsync();
                            var accountsReceivable = accounts.FirstOrDefault(a => a.AccountName == "Accounts Receivable");
                            var salesRevenue = accounts.FirstOrDefault(a => a.AccountName == "Sales Revenue");
                            
                            if (accountsReceivable != null && salesRevenue != null)
                            {
                                var totalAmount = request.Cases * 0.0m; // Stubbed Revenue - proper pricing engine will handle this
                                await financeService.CreateJournalEntryAsync(new CreateJournalEntryRequest
                                {
                                    TransactionDate = transaction.TransactionDate,
                                    VoucherType = "Sales",
                                    ReferenceNumber = transaction.TransactionNumber,
                                    Remarks = $"Sales Dispatch for {request.Cases} cases of {product.Name}",
                                    Lines = new List<CreateJournalEntryLineRequest>
                                    {
                                        new CreateJournalEntryLineRequest { AccountId = accountsReceivable.Id, DebitAmount = totalAmount, CreditAmount = 0, Description = "Sale to Customer" },
                                        new CreateJournalEntryLineRequest { AccountId = salesRevenue.Id, DebitAmount = 0, CreditAmount = totalAmount, Description = "Sale Revenue" }
                                    }
                                });
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Failed to auto-post journal entry: {ex.Message}");
                    }
                }

                var dto = new SalesTransactionDto
                {
                    Id = transaction.Id,
                    TransactionNumber = transaction.TransactionNumber,
                    CustomerId = transaction.CustomerId,
                    CustomerName = customer.CustomerName,
                    CustomerCode = customer.CustomerCode,
                    ProductId = transaction.ProductId,
                    ProductName = product.Name,
                    ProductSku = product.SKU ?? string.Empty,
                    Cases = transaction.Cases,
                    TransactionType = transaction.TransactionType,
                    TransactionDate = transaction.TransactionDate,
                    ReferenceNumber = transaction.ReferenceNumber,
                    Remarks = transaction.Remarks,
                    Status = transaction.Status,
                    CreatedBy = transaction.CreatedBy,
                    CreatedByName = _currentUserContext.Email?.Split('@')[0] ?? "System",
                    CreatedAt = transaction.CreatedAt,
                    UpdatedAt = transaction.UpdatedAt
                };

                return Success(dto, "Sales transaction created successfully.");
            }
            catch (InvalidOperationException ex)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure(ex.Message, "Transaction Failed", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<ApiResponse<SalesTransactionDto>>> UpdateSalesTransaction(Guid id, [FromBody] CreateSalesTransactionRequest request)
        {
            if (!IsAuthorizedToWrite())
            {
                return Unauthorized(ApiResponse<SalesTransactionDto>.CreateFailure("Unauthorized to edit transactions.", "Unauthorized", HttpContext.TraceIdentifier));
            }

            if (request.Cases <= 0)
            {
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Quantity of cases must be greater than zero.", "Validation Error", HttpContext.TraceIdentifier));
            }

            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
            }

            using var dbTransaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var currentUserId = _currentUserContext.UserId ?? "System";

                // Load existing transaction
                var existingTxn = await _tenantContext.SalesTransactions
                    .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && !t.IsDeleted);

                if (existingTxn == null)
                {
                    return NotFound(ApiResponse<SalesTransactionDto>.CreateFailure("Sales transaction not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // Load customer
                var customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == tenantId && !c.IsDeleted);
                if (customer == null)
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Customer not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // Load new product
                var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId && !p.IsDeleted);
                if (product == null)
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Product not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("Company not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // 1. REVERSE STOCK MOVEMENT ALGORITHM
                // Find old movement associated with the sales transaction
                var oldMovement = await _tenantContext.InventoryMovements
                    .FirstOrDefaultAsync(m => m.ReferenceType == "SalesTransaction" && m.ReferenceId == existingTxn.Id && !m.IsDeleted);

                if (oldMovement != null)
                {
                    // Reverse the stock change: subtract the quantity recorded in oldMovement.
                    var oldProduct = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == oldMovement.ProductId && !p.IsDeleted);
                    if (oldProduct != null)
                    {
                        oldProduct.CurrentStock -= oldMovement.Quantity;
                        if (oldProduct.CurrentStock < 0)
                        {
                            return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure($"Reversal failed: restoring stock would result in negative inventory for '{oldProduct.Name}'.", "Validation Error", HttpContext.TraceIdentifier));
                        }
                    }

                    // Soft delete the old movement log
                    oldMovement.IsDeleted = true;
                    oldMovement.DeletedAt = DateTime.UtcNow;
                    oldMovement.DeletedBy = currentUserId;
                }

                // 2. APPLY NEW MOVEMENT
                decimal stockAdjustment = 0;
                if (request.TransactionType == "Sales Dispatch" || request.TransactionType == "Damage")
                {
                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Customer Return")
                {
                    stockAdjustment = request.Cases;
                }
                else
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure($"Invalid transaction type: {request.TransactionType}", "Validation Error", HttpContext.TraceIdentifier));
                }

                // Record the new movement through the central service (automatically validates and adjusts new product stock)
                await _inventoryMovementService.RecordProductMovementAsync(
                    _tenantContext,
                    request.ProductId,
                    stockAdjustment,
                    "SalesTransaction",
                    existingTxn.Id,
                    $"{request.TransactionType}: {existingTxn.TransactionNumber} (Edited)",
                    tenantId,
                    company.Id,
                    currentUserId);

                // 3. UPDATE TRANSACTION DATA
                existingTxn.CustomerId = request.CustomerId;
                existingTxn.ProductId = request.ProductId;
                existingTxn.Cases = request.Cases;
                existingTxn.TransactionType = request.TransactionType;
                existingTxn.TransactionDate = request.TransactionDate.ToUniversalTime();
                existingTxn.ReferenceNumber = request.ReferenceNumber?.Trim();
                existingTxn.Remarks = request.Remarks?.Trim();
                existingTxn.UpdatedAt = DateTime.UtcNow;
                existingTxn.UpdatedBy = currentUserId;

                await _tenantContext.SaveChangesAsync();

                await dbTransaction.CommitAsync();

                var dto = new SalesTransactionDto
                {
                    Id = existingTxn.Id,
                    TransactionNumber = existingTxn.TransactionNumber,
                    CustomerId = existingTxn.CustomerId,
                    CustomerName = customer.CustomerName,
                    CustomerCode = customer.CustomerCode,
                    ProductId = existingTxn.ProductId,
                    ProductName = product.Name,
                    ProductSku = product.SKU ?? string.Empty,
                    Cases = existingTxn.Cases,
                    TransactionType = existingTxn.TransactionType,
                    TransactionDate = existingTxn.TransactionDate,
                    ReferenceNumber = existingTxn.ReferenceNumber,
                    Remarks = existingTxn.Remarks,
                    Status = existingTxn.Status,
                    CreatedBy = existingTxn.CreatedBy,
                    CreatedByName = _currentUserContext.Email?.Split('@')[0] ?? "System",
                    CreatedAt = existingTxn.CreatedAt,
                    UpdatedAt = existingTxn.UpdatedAt
                };

                return Success(dto, "Sales transaction updated successfully.");
            }
            catch (InvalidOperationException ex)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure(ex.Message, "Transaction Failed", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteSalesTransaction(Guid id)
        {
            if (!IsAuthorizedToWrite())
            {
                return Unauthorized(ApiResponse<object>.CreateFailure("Unauthorized to delete transactions.", "Unauthorized", HttpContext.TraceIdentifier));
            }

            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
            }

            using var dbTransaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var currentUserId = _currentUserContext.UserId ?? "System";

                // Load transaction
                var transaction = await _tenantContext.SalesTransactions
                    .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && !t.IsDeleted);

                if (transaction == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Sales transaction not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // 1. REVERSE STOCK MOVEMENT ALGORITHM
                var oldMovement = await _tenantContext.InventoryMovements
                    .FirstOrDefaultAsync(m => m.ReferenceType == "SalesTransaction" && m.ReferenceId == transaction.Id && !m.IsDeleted);

                if (oldMovement != null)
                {
                    var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == oldMovement.ProductId && !p.IsDeleted);
                    if (product != null)
                    {
                        product.CurrentStock -= oldMovement.Quantity;
                        if (product.CurrentStock < 0)
                        {
                            return BadRequest(ApiResponse<object>.CreateFailure($"Reversal failed: restoring stock would result in negative inventory for '{product.Name}'.", "Validation Error", HttpContext.TraceIdentifier));
                        }
                    }

                    // Soft delete the inventory movement log
                    oldMovement.IsDeleted = true;
                    oldMovement.DeletedAt = DateTime.UtcNow;
                    oldMovement.DeletedBy = currentUserId;
                }

                // 2. SOFT DELETE TRANSACTION
                transaction.IsDeleted = true;
                transaction.DeletedAt = DateTime.UtcNow;
                transaction.DeletedBy = currentUserId;

                await _tenantContext.SaveChangesAsync();

                await dbTransaction.CommitAsync();

                return Success<object?>(null, "Sales transaction deleted and stock restored successfully.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Transaction Failed", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("dashboard")]
        public async Task<ActionResult<ApiResponse<SalesDashboardDto>>> GetSalesDashboard()
        {
            try
            {
                var tenantId = _currentUserContext.TenantId;
                var todayUtc = DateTime.UtcNow.Date;
                var todayLocalStart = todayUtc.AddDays(-1); // Resilient timezone window
                var startOfMonth = new DateTime(todayUtc.Year, todayUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

                var query = _tenantContext.SalesTransactions
                    .Where(t => t.TenantId == tenantId && !t.IsDeleted);

                var txns = await query.ToListAsync();

                var todaySalesCases = txns
                    .Where(t => (t.TransactionDate.Date >= todayUtc || t.CreatedAt.Date >= todayUtc || t.TransactionDate >= todayLocalStart) && t.TransactionType == "Sales Dispatch")
                    .Sum(t => t.Cases);

                var todayReturns = txns
                    .Where(t => (t.TransactionDate.Date >= todayUtc || t.CreatedAt.Date >= todayUtc || t.TransactionDate >= todayLocalStart) && t.TransactionType == "Customer Return")
                    .Sum(t => t.Cases);

                var todayDamage = txns
                    .Where(t => (t.TransactionDate.Date >= todayUtc || t.CreatedAt.Date >= todayUtc || t.TransactionDate >= todayLocalStart) && t.TransactionType == "Damage")
                    .Sum(t => t.Cases);

                var totalDispatch = txns
                    .Where(t => t.TransactionType == "Sales Dispatch")
                    .Sum(t => t.Cases);

                var monthlyDispatch = txns
                    .Where(t => (t.TransactionDate >= startOfMonth || t.CreatedAt >= startOfMonth) && t.TransactionType == "Sales Dispatch")
                    .Sum(t => t.Cases);

                var dashboard = new SalesDashboardDto
                {
                    TodaySalesCases = todaySalesCases,
                    TodayReturns = todayReturns,
                    TodayDamage = todayDamage,
                    TotalDispatch = totalDispatch,
                    MonthlyDispatch = monthlyDispatch
                };

                return Success(dashboard, "Sales dashboard loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<SalesDashboardDto>(ex.Message, "Failed to load sales dashboard.");
            }
        }
    }

    public class SalesTransactionDto
    {
        public Guid Id { get; set; }
        public string TransactionNumber { get; set; } = string.Empty;
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerCode { get; set; } = string.Empty;
        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ProductSku { get; set; } = string.Empty;
        public decimal Cases { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
        public string Status { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateSalesTransactionRequest
    {
        public Guid CustomerId { get; set; }
        public Guid ProductId { get; set; }
        public decimal Cases { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public DateTime TransactionDate { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
    }

    public class SalesDashboardDto
    {
        public decimal TodaySalesCases { get; set; }
        public decimal TodayReturns { get; set; }
        public decimal TodayDamage { get; set; }
        public decimal TotalDispatch { get; set; }
        public decimal MonthlyDispatch { get; set; }
    }
}
