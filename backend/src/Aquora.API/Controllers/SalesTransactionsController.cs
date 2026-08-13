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
using Aquora.Domain.Entities.Finance;
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
        private readonly ILedgerService _ledgerService;

        public SalesController(
            ITenantDbContext tenantContext,
            ICurrentUserContext currentUserContext,
            IInventoryMovementService inventoryMovementService,
            IPlatformDbContext platformContext,
            IHubContext<DashboardHub> dashboardHub,
            ILedgerService ledgerService)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _inventoryMovementService = inventoryMovementService;
            _platformContext = platformContext;
            _dashboardHub = dashboardHub;
            _ledgerService = ledgerService;
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

        private static bool IsBankPaymentMethod(string? paymentMethod)
        {
            var method = paymentMethod?.Trim();
            return method != null &&
                (method.Equals("Bank", StringComparison.OrdinalIgnoreCase) ||
                 method.Equals("BankAccount", StringComparison.OrdinalIgnoreCase) ||
                 method.Equals("UPI", StringComparison.OrdinalIgnoreCase) ||
                 method.Equals("Cheque", StringComparison.OrdinalIgnoreCase));
        }
        private bool IsAuthorizedToWrite()
        {
            var allowedRoles = new[] { "CompanyAdmin", "Admin", "Manager" };
            return _currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _healedSalesCustomerSchemas = new();

        private async Task EnsureCustomerColumnsAsync()
        {
            var schema = string.IsNullOrWhiteSpace(_tenantContext.SchemaName)
                ? "public"
                : _tenantContext.SchemaName;

            if (_healedSalesCustomerSchemas.ContainsKey(schema)) return;

            try
            {
                var sql = $@"
                    ALTER TABLE ""{schema}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Price"" numeric NOT NULL DEFAULT 0;
                    ALTER TABLE ""{schema}"".""Customers"" ADD COLUMN IF NOT EXISTS ""Discount"" numeric NOT NULL DEFAULT 0;
                ";
                await _tenantContext.Database.ExecuteSqlRawAsync(sql);
                _healedSalesCustomerSchemas.TryAdd(schema, true);
            }
            catch
            {
                // Self-heal attempt completed
            }
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
                await EnsureCustomerColumnsAsync();
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
                    query = query.Where(t => t.TransactionDate >= startDate.Value.ToUniversalTime());
                }

                if (endDate.HasValue)
                {
                    query = query.Where(t => t.TransactionDate <= endDate.Value.ToUniversalTime());
                }

                // Sorting
                if (sort == "oldest")
                {
                    query = query.OrderBy(t => t.TransactionDate).ThenBy(t => t.Id);
                }
                else
                {
                    query = query.OrderByDescending(t => t.TransactionDate).ThenByDescending(t => t.Id);
                }

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

                var bankAccountsDict = await _tenantContext.BankAccounts.ToDictionaryAsync(b => b.Id, b => b.BankName);
                var cashBooksDict = await _tenantContext.CashBooks.ToDictionaryAsync(c => c.Id, c => c.Name);

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
                    PaymentMethod = t.PaymentMethod,
                    BankAccountId = t.BankAccountId,
                    BankAccountName = t.BankAccountId.HasValue && bankAccountsDict.TryGetValue(t.BankAccountId.Value, out var bName) ? bName : null,
                    CashBookId = t.CashBookId,
                    CashBookName = t.CashBookId.HasValue && cashBooksDict.TryGetValue(t.CashBookId.Value, out var cName) ? cName : null,
                    UnitPrice = t.UnitPrice,
                    DiscountAmount = t.DiscountAmount,
                    TaxAmount = t.TaxAmount,
                    CGST = t.CGST,
                    SGST = t.SGST,
                    IGST = t.IGST,
                    MetadataJson = t.MetadataJson,
                    TotalAmount = t.TotalAmount,
                    AmountReceived = t.AmountReceived,
                    OutstandingAmount = t.OutstandingAmount,
                    PaymentStatus = t.PaymentStatus,
                    ReturnedAmount = t.ReturnedAmount,
                    RefundAmount = t.RefundAmount,
                    AdjustmentAmount = t.AdjustmentAmount,
                    ReturnType = t.ReturnType,
                    IsReplacementRequired = t.IsReplacementRequired,
                    ProductValue = t.ProductValue,
                    DamageCost = t.DamageCost,
                    DamageReason = t.DamageReason,
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

                var bankAccount = txn.BankAccountId.HasValue ? await _tenantContext.BankAccounts.FindAsync(txn.BankAccountId.Value) : null;
                var cashBook = txn.CashBookId.HasValue ? await _tenantContext.CashBooks.FindAsync(txn.CashBookId.Value) : null;

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
                    PaymentMethod = txn.PaymentMethod,
                    BankAccountId = txn.BankAccountId,
                    BankAccountName = bankAccount?.BankName,
                    CashBookId = txn.CashBookId,
                    CashBookName = cashBook?.Name,
                    UnitPrice = txn.UnitPrice,
                    DiscountAmount = txn.DiscountAmount,
                    TaxAmount = txn.TaxAmount,
                    CGST = txn.CGST,
                    SGST = txn.SGST,
                    IGST = txn.IGST,
                    MetadataJson = txn.MetadataJson,
                    TotalAmount = txn.TotalAmount,
                    AmountReceived = txn.AmountReceived,
                    OutstandingAmount = txn.OutstandingAmount,
                    PaymentStatus = txn.PaymentStatus,
                    ReturnedAmount = txn.ReturnedAmount,
                    RefundAmount = txn.RefundAmount,
                    AdjustmentAmount = txn.AdjustmentAmount,
                    ReturnType = txn.ReturnType,
                    IsReplacementRequired = txn.IsReplacementRequired,
                    ProductValue = txn.ProductValue,
                    DamageCost = txn.DamageCost,
                    DamageReason = txn.DamageReason,
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

            if (request.Cases <= 0 && request.TransactionType != "Stock Adjustment")
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

                // Load customer
                var customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == tenantId && !c.IsDeleted);
                if (customer == null && (request.TransactionType == "Sales Dispatch" || request.TransactionType == "Customer Return" || request.TransactionType == "Free Sample"))
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure($"Customer is required for {request.TransactionType}.", "Validation Error", HttpContext.TraceIdentifier));
                }

                // Auto-resolve customer if not required but constraint needs one
                if (customer == null)
                {
                    customer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.TenantId == tenantId && !c.IsDeleted);
                    if (customer == null)
                    {
                        customer = new Customer
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = company.Id,
                            CustomerName = "General / System Customer",
                            CustomerCode = "CUST-SYS",
                            Phone = "0000000000",
                            Email = "system@aquora.com",
                            OutstandingPlaceholder = 0,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _tenantContext.Customers.Add(customer);
                        await _tenantContext.SaveChangesAsync();
                    }
                }

                // Generate txn number
                var randomCode = new Random().Next(1000, 9999);
                var txnNumber = $"TXN-{DateTime.UtcNow:yyyyMMdd}-{randomCode}";
                var transactionId = Guid.NewGuid();

                decimal totalAmount = 0m;
                decimal amountReceived = 0m;
                decimal outstandingAmount = 0m;
                string paymentStatus = "Pending";

                decimal returnedAmount = 0m;
                decimal refundAmount = 0m;
                decimal adjustmentAmount = 0m;
                string? returnType = null;

                decimal productValue = 0m;
                decimal damageCost = 0m;
                string? damageReason = null;

                decimal stockAdjustment = 0;

                // Journal ledger lines accumulator
                var journalLines = new List<(Account account, decimal debit, decimal credit, string description)>();

                if (request.TransactionType == "Sales Dispatch")
                {
                    totalAmount = request.TotalAmount;
                    amountReceived = request.AmountReceived;
                    outstandingAmount = Math.Max(0m, totalAmount - amountReceived);

                    if (amountReceived == 0m) paymentStatus = "Pending";
                    else if (amountReceived < totalAmount) paymentStatus = "Partial";
                    else paymentStatus = "Paid";

                    // Account Movement: Increase Customer Outstanding Balance
                    customer.OutstandingPlaceholder += outstandingAmount;
                    AppendCustomerLedgerEntry(customer, "Sales Dispatch", txnNumber, totalAmount, amountReceived, customer.OutstandingPlaceholder);

                    // Resolve general ledger accounts
                    var salesRevenueAccount = await ResolveAccountAsync("Sales Revenue", "4001", "Revenue", "Cr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);
                    var cogsAccount = await ResolveAccountAsync("Cost of Goods Sold", "5002", "Expenses", "Dr", tenantId, company.Id);

                    Account debitAccount;
                    if (IsBankPaymentMethod(request.PaymentMethod))
                    {
                        debitAccount = await ResolveAccountAsync("Bank Account", "1002", "Assets", "Dr", tenantId, company.Id);
                    }
                    else if (request.PaymentMethod == "Cash")
                    {
                        debitAccount = await ResolveAccountAsync("Cash", "1001", "Assets", "Dr", tenantId, company.Id);
                    }
                    else
                    {
                        debitAccount = await ResolveAccountAsync("Accounts Receivable", "1200", "Assets", "Dr", tenantId, company.Id);
                    }

                    // Journal lines
                    journalLines.Add((debitAccount, totalAmount, 0m, $"Customer dispatch record: {txnNumber}"));
                    journalLines.Add((salesRevenueAccount, 0m, totalAmount, $"Dispatch sales revenue: {txnNumber}"));

                    decimal cost = request.Cases * product.CostPrice;
                    if (cost > 0)
                    {
                        journalLines.Add((cogsAccount, cost, 0m, $"Cost of goods sold: {txnNumber}"));
                        journalLines.Add((inventoryAccount, 0m, cost, $"Inventory deduction: {txnNumber}"));
                    }

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Customer Return")
                {
                    returnedAmount = request.ReturnedAmount;
                    refundAmount = request.RefundAmount;
                    adjustmentAmount = request.AdjustmentAmount > 0 ? request.AdjustmentAmount : Math.Max(0m, returnedAmount - refundAmount);
                    returnType = request.ReturnType ?? "Customer Return";

                    // Reduce customer balance if credit-note/receivable adjustments
                    if (adjustmentAmount > 0)
                    {
                        customer.OutstandingPlaceholder = Math.Max(0m, customer.OutstandingPlaceholder - adjustmentAmount);
                        AppendCustomerLedgerEntry(customer, "Customer Return Note", txnNumber, 0, adjustmentAmount, customer.OutstandingPlaceholder);
                    }

                    var salesReturnAccount = await ResolveAccountAsync("Sales Return", "4002", "Revenue", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);
                    var cogsAccount = await ResolveAccountAsync("Cost of Goods Sold", "5002", "Expenses", "Dr", tenantId, company.Id);

                    Account creditAccount;
                    if (IsBankPaymentMethod(request.PaymentMethod))
                    {
                        creditAccount = await ResolveAccountAsync("Bank Account", "1002", "Assets", "Dr", tenantId, company.Id);
                    }
                    else if (request.PaymentMethod == "Cash")
                    {
                        creditAccount = await ResolveAccountAsync("Cash", "1001", "Assets", "Dr", tenantId, company.Id);
                    }
                    else
                    {
                        creditAccount = await ResolveAccountAsync("Accounts Receivable", "1200", "Assets", "Dr", tenantId, company.Id);
                    }

                    journalLines.Add((salesReturnAccount, returnedAmount, 0m, $"Customer returns: {txnNumber}"));
                    journalLines.Add((creditAccount, 0m, returnedAmount, $"Returns refund settlement: {txnNumber}"));

                    decimal cost = request.Cases * product.CostPrice;
                    if (cost > 0)
                    {
                        journalLines.Add((inventoryAccount, cost, 0m, $"Restoring stock: {txnNumber}"));
                        journalLines.Add((cogsAccount, 0m, cost, $"COGS credit reversal: {txnNumber}"));
                    }

                    stockAdjustment = request.Cases;
                }
                else if (request.TransactionType == "Damage" || request.TransactionType == "Damaged Goods")
                {
                    productValue = product.CostPrice;
                    damageCost = request.Cases * productValue;
                    damageReason = request.DamageReason ?? request.Remarks;

                    var lossAccount = await ResolveAccountAsync("Inventory Loss Expense", "5003", "Expenses", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    journalLines.Add((lossAccount, damageCost, 0m, $"Unsellable inventory loss: {txnNumber}"));
                    journalLines.Add((inventoryAccount, 0m, damageCost, $"Writedown inventory: {txnNumber}"));

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Internal Consumption")
                {
                    productValue = product.CostPrice;
                    damageCost = request.Cases * productValue;

                    var officeExpenseAccount = await ResolveAccountAsync("Office Expense", "5004", "Expenses", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    journalLines.Add((officeExpenseAccount, damageCost, 0m, $"Internal department usage: {txnNumber}"));
                    journalLines.Add((inventoryAccount, 0m, damageCost, $"Finished goods consumption: {txnNumber}"));

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Free Sample")
                {
                    productValue = product.CostPrice;
                    damageCost = request.Cases * productValue;

                    var marketingExpenseAccount = await ResolveAccountAsync("Marketing Expense", "5005", "Expenses", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    journalLines.Add((marketingExpenseAccount, damageCost, 0m, $"Marketing sample distribution: {txnNumber}"));
                    journalLines.Add((inventoryAccount, 0m, damageCost, $"Finished goods sample: {txnNumber}"));

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Stock Adjustment")
                {
                    productValue = product.CostPrice;
                    damageCost = request.Cases * productValue; // Quantity * Cost

                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    if (request.Cases >= 0)
                    {
                        var adjustmentGainAccount = await ResolveAccountAsync("Inventory Adjustment Gain", "4003", "Revenue", "Cr", tenantId, company.Id);
                        journalLines.Add((inventoryAccount, Math.Abs(damageCost), 0m, $"Physical audit surplus: {txnNumber}"));
                        journalLines.Add((adjustmentGainAccount, 0m, Math.Abs(damageCost), $"Inventory adjustment gain: {txnNumber}"));
                    }
                    else
                    {
                        var adjustmentLossAccount = await ResolveAccountAsync("Inventory Adjustment Loss", "5006", "Expenses", "Dr", tenantId, company.Id);
                        journalLines.Add((adjustmentLossAccount, Math.Abs(damageCost), 0m, $"Physical audit shortage: {txnNumber}"));
                        journalLines.Add((inventoryAccount, 0m, Math.Abs(damageCost), $"Inventory adjustment loss: {txnNumber}"));
                    }

                    stockAdjustment = request.Cases;
                }

                // Add main transaction record
                var transaction = new SalesTransaction
                {
                    Id = transactionId,
                    TenantId = tenantId,
                    CompanyId = company.Id,
                    TransactionNumber = txnNumber,
                    CustomerId = customer.Id,
                    ProductId = request.ProductId,
                    Cases = request.Cases,
                    TransactionType = request.TransactionType,
                    TransactionDate = request.TransactionDate.ToUniversalTime(),
                    ReferenceNumber = request.ReferenceNumber?.Trim(),
                    Remarks = request.Remarks?.Trim(),
                    Status = "Completed",
                    PaymentMethod = request.PaymentMethod,
                    BankAccountId = request.BankAccountId,
                    CashBookId = request.CashBookId,
                    UnitPrice = request.UnitPrice,
                    DiscountAmount = request.DiscountAmount,
                    TaxAmount = request.TaxAmount,
                    CGST = request.CGST,
                    SGST = request.SGST,
                    IGST = request.IGST,
                    MetadataJson = request.MetadataJson,
                    TotalAmount = totalAmount,
                    AmountReceived = amountReceived,
                    OutstandingAmount = outstandingAmount,
                    PaymentStatus = paymentStatus,
                    ReturnedAmount = returnedAmount,
                    RefundAmount = refundAmount,
                    AdjustmentAmount = adjustmentAmount,
                    ReturnType = returnType,
                    IsReplacementRequired = request.IsReplacementRequired,
                    ProductValue = productValue,
                    DamageCost = damageCost,
                    DamageReason = damageReason,
                    CreatedBy = currentUserId
                };

                // Apply general ledger journal entries
                if (journalLines.Any())
                {
                    await CreateJournalEntryAsync(tenantId, company.Id, "Journal Voucher", $"Sales module auto-posting: {txnNumber}", txnNumber, journalLines, currentUserId);
                }

                // Apply stock movement
                if (stockAdjustment != 0)
                {
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
                }

                _tenantContext.SalesTransactions.Add(transaction);
                await _tenantContext.SaveChangesAsync();

                if (transaction.TransactionType == "Sales Dispatch" && transaction.AmountReceived > 0)
                {
                    if (IsBankPaymentMethod(transaction.PaymentMethod))
                    {
                        await _ledgerService.RecordTransactionAsync(
                            transaction.BankAccountId.GetValueOrDefault(),
                            transaction.TransactionDate,
                            transaction.ReferenceNumber ?? transaction.TransactionNumber,
                            "Sales Receipt",
                            $"Sales payment received from {customer.CustomerName}",
                            0m,
                            transaction.AmountReceived,
                            transaction.Id,
                            "SalesTransaction");
                    }
                    else if (transaction.PaymentMethod == "Cash")
                    {
                        await _ledgerService.RecordCashTransactionAsync(
                            transaction.CashBookId.GetValueOrDefault(),
                            transaction.TransactionDate,
                            transaction.ReferenceNumber ?? transaction.TransactionNumber,
                            "Sales Receipt",
                            $"Sales payment received from {customer.CustomerName}",
                            0m,
                            transaction.AmountReceived,
                            transaction.Id,
                            "SalesTransaction");
                    }
                }
                else if (transaction.TransactionType == "Customer Return" && transaction.RefundAmount > 0)
                {
                    if (IsBankPaymentMethod(transaction.PaymentMethod))
                    {
                        await _ledgerService.RecordTransactionAsync(
                            transaction.BankAccountId.GetValueOrDefault(),
                            transaction.TransactionDate,
                            transaction.ReferenceNumber ?? transaction.TransactionNumber,
                            "Sales Return Refund",
                            $"Sales return refund: {transaction.TransactionNumber} - {customer.CustomerName} - {product.Name}",
                            transaction.RefundAmount,
                            0m,
                            transaction.Id,
                            "SalesTransaction");
                    }
                    else if (transaction.PaymentMethod == "Cash")
                    {
                        await _ledgerService.RecordCashTransactionAsync(
                            transaction.CashBookId.GetValueOrDefault(),
                            transaction.TransactionDate,
                            transaction.ReferenceNumber ?? transaction.TransactionNumber,
                            "Sales Return Refund",
                            $"Sales return refund: {transaction.TransactionNumber} - {customer.CustomerName} - {product.Name}",
                            transaction.RefundAmount,
                            0m,
                            transaction.Id,
                            "SalesTransaction");
                    }
                }

                await dbTransaction.CommitAsync();

                await NotifyDashboardAsync(request.TransactionType == "Customer Return" ? "dispatch-returned" : "dispatch-created");

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
                    PaymentMethod = transaction.PaymentMethod,
                    BankAccountId = transaction.BankAccountId,
                    BankAccountName = transaction.BankAccountId.HasValue ? (await _tenantContext.BankAccounts.FindAsync(transaction.BankAccountId.Value))?.BankName : null,
                    CashBookId = transaction.CashBookId,
                    CashBookName = transaction.CashBookId.HasValue ? (await _tenantContext.CashBooks.FindAsync(transaction.CashBookId.Value))?.Name : null,
                    UnitPrice = transaction.UnitPrice,
                    DiscountAmount = transaction.DiscountAmount,
                    TaxAmount = transaction.TaxAmount,
                    CGST = transaction.CGST,
                    SGST = transaction.SGST,
                    IGST = transaction.IGST,
                    MetadataJson = transaction.MetadataJson,
                    TotalAmount = transaction.TotalAmount,
                    AmountReceived = transaction.AmountReceived,
                    OutstandingAmount = transaction.OutstandingAmount,
                    PaymentStatus = transaction.PaymentStatus,
                    ReturnedAmount = transaction.ReturnedAmount,
                    RefundAmount = transaction.RefundAmount,
                    AdjustmentAmount = transaction.AdjustmentAmount,
                    ReturnType = transaction.ReturnType,
                    IsReplacementRequired = transaction.IsReplacementRequired,
                    ProductValue = transaction.ProductValue,
                    DamageCost = transaction.DamageCost,
                    DamageReason = transaction.DamageReason,
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

                // 1. REVERSE PREVIOUS GL ENTRIES & BANK LEDGERS
                var journalEntry = await _tenantContext.JournalEntries
                    .Include(j => j.Lines)
                    .FirstOrDefaultAsync(j => j.ReferenceNumber == existingTxn.TransactionNumber && j.TenantId == tenantId);

                if (journalEntry != null)
                {
                    foreach (var line in journalEntry.Lines)
                    {
                        var account = await _tenantContext.Accounts.FindAsync(line.AccountId);
                        if (account != null)
                        {
                            // Reverse the current balances
                            if (line.DebitAmount > 0)
                            {
                                if (account.BalanceType == "Dr") account.CurrentBalance -= line.DebitAmount;
                                else account.CurrentBalance += line.DebitAmount;
                            }
                            if (line.CreditAmount > 0)
                            {
                                if (account.BalanceType == "Cr") account.CurrentBalance -= line.CreditAmount;
                                else account.CurrentBalance += line.CreditAmount;
                            }
                        }
                    }
                    _tenantContext.JournalEntries.Remove(journalEntry);
                }
                await _ledgerService.RemoveLedgerEntryForEntityAsync(existingTxn.Id, "SalesTransaction");

                // Restore customer outstanding
                var customer = await _tenantContext.Customers.FindAsync(existingTxn.CustomerId);
                if (customer != null)
                {
                    if (existingTxn.TransactionType == "Sales Dispatch")
                    {
                        customer.OutstandingPlaceholder = Math.Max(0m, customer.OutstandingPlaceholder - existingTxn.OutstandingAmount);
                    }
                    else if (existingTxn.TransactionType == "Customer Return")
                    {
                        customer.OutstandingPlaceholder += existingTxn.AdjustmentAmount;
                    }
                }

                // 2. REVERSE STOCK MOVEMENT ALGORITHM
                var oldMovement = await _tenantContext.InventoryMovements
                    .FirstOrDefaultAsync(m => m.ReferenceType == "SalesTransaction" && m.ReferenceId == existingTxn.Id && !m.IsDeleted);

                if (oldMovement != null)
                {
                    var oldProduct = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == oldMovement.ProductId && !p.IsDeleted);
                    if (oldProduct != null)
                    {
                        oldProduct.CurrentStock -= oldMovement.Quantity;
                    }
                    oldMovement.IsDeleted = true;
                    oldMovement.DeletedAt = DateTime.UtcNow;
                    oldMovement.DeletedBy = currentUserId;
                }

                await _tenantContext.SaveChangesAsync();

                // 3. APPLY NEW TRANSACTIONS (Re-runs the post workflow safely)
                var newProduct = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId && !p.IsDeleted);
                if (newProduct == null)
                {
                    return BadRequest(ApiResponse<SalesTransactionDto>.CreateFailure("New product not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var company = await _tenantContext.Companies.FirstAsync();

                // Recalculate
                decimal totalAmount = 0m;
                decimal amountReceived = 0m;
                decimal outstandingAmount = 0m;
                string paymentStatus = "Pending";

                decimal returnedAmount = 0m;
                decimal refundAmount = 0m;
                decimal adjustmentAmount = 0m;
                string? returnType = null;

                decimal productValue = 0m;
                decimal damageCost = 0m;
                string? damageReason = null;

                decimal stockAdjustment = 0;
                var journalLines = new List<(Account account, decimal debit, decimal credit, string description)>();

                // Auto-resolve customer
                var newCustomer = await _tenantContext.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == tenantId && !c.IsDeleted);
                if (newCustomer == null)
                {
                    newCustomer = customer ?? await _tenantContext.Customers.FirstAsync(c => c.TenantId == tenantId);
                }

                if (request.TransactionType == "Sales Dispatch")
                {
                    totalAmount = request.TotalAmount;
                    amountReceived = request.AmountReceived;
                    outstandingAmount = Math.Max(0m, totalAmount - amountReceived);

                    if (amountReceived == 0m) paymentStatus = "Pending";
                    else if (amountReceived < totalAmount) paymentStatus = "Partial";
                    else paymentStatus = "Paid";

                    newCustomer.OutstandingPlaceholder += outstandingAmount;
                    AppendCustomerLedgerEntry(newCustomer, "Sales Dispatch (Edited)", existingTxn.TransactionNumber, totalAmount, amountReceived, newCustomer.OutstandingPlaceholder);

                    var salesRevenueAccount = await ResolveAccountAsync("Sales Revenue", "4001", "Revenue", "Cr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);
                    var cogsAccount = await ResolveAccountAsync("Cost of Goods Sold", "5002", "Expenses", "Dr", tenantId, company.Id);

                    Account debitAccount;
                    if (IsBankPaymentMethod(request.PaymentMethod))
                    {
                        debitAccount = await ResolveAccountAsync("Bank Account", "1002", "Assets", "Dr", tenantId, company.Id);
                        if (request.BankAccountId.HasValue && request.BankAccountId.Value != Guid.Empty && amountReceived > 0)
                        {
                            await _ledgerService.RecordTransactionAsync(request.BankAccountId.Value, request.TransactionDate, request.ReferenceNumber?.Trim() ?? existingTxn.TransactionNumber, "Sales Receipt", $"Sales payment received from {newCustomer.CustomerName}", 0m, amountReceived, existingTxn.Id, "SalesTransaction");
                        }
                    }
                    else if (request.PaymentMethod == "Cash")
                    {
                        debitAccount = await ResolveAccountAsync("Cash", "1001", "Assets", "Dr", tenantId, company.Id);
                        if (request.CashBookId.HasValue && request.CashBookId.Value != Guid.Empty && amountReceived > 0)
                        {
                            await _ledgerService.RecordCashTransactionAsync(request.CashBookId.Value, request.TransactionDate, request.ReferenceNumber?.Trim() ?? existingTxn.TransactionNumber, "Sales Receipt", $"Sales payment received from {newCustomer.CustomerName}", 0m, amountReceived, existingTxn.Id, "SalesTransaction");
                        }
                    }
                    else
                    {
                        debitAccount = await ResolveAccountAsync("Accounts Receivable", "1200", "Assets", "Dr", tenantId, company.Id);
                    }

                    journalLines.Add((debitAccount, totalAmount, 0m, $"Customer dispatch record: {existingTxn.TransactionNumber}"));
                    journalLines.Add((salesRevenueAccount, 0m, totalAmount, $"Dispatch sales revenue: {existingTxn.TransactionNumber}"));

                    decimal cost = request.Cases * newProduct.CostPrice;
                    if (cost > 0)
                    {
                        journalLines.Add((cogsAccount, cost, 0m, $"Cost of goods sold: {existingTxn.TransactionNumber}"));
                        journalLines.Add((inventoryAccount, 0m, cost, $"Inventory deduction: {existingTxn.TransactionNumber}"));
                    }

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Customer Return")
                {
                    returnedAmount = request.ReturnedAmount;
                    refundAmount = request.RefundAmount;
                    adjustmentAmount = request.AdjustmentAmount > 0 ? request.AdjustmentAmount : Math.Max(0m, returnedAmount - refundAmount);
                    returnType = request.ReturnType ?? "Customer Return";

                    if (adjustmentAmount > 0)
                    {
                        newCustomer.OutstandingPlaceholder = Math.Max(0m, newCustomer.OutstandingPlaceholder - adjustmentAmount);
                        AppendCustomerLedgerEntry(newCustomer, "Customer Return Note (Edited)", existingTxn.TransactionNumber, 0, adjustmentAmount, newCustomer.OutstandingPlaceholder);
                    }

                    var salesReturnAccount = await ResolveAccountAsync("Sales Return", "4002", "Revenue", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);
                    var cogsAccount = await ResolveAccountAsync("Cost of Goods Sold", "5002", "Expenses", "Dr", tenantId, company.Id);

                    Account creditAccount;
                    if (IsBankPaymentMethod(request.PaymentMethod))
                    {
                        creditAccount = await ResolveAccountAsync("Bank Account", "1002", "Assets", "Dr", tenantId, company.Id);
                        if (request.BankAccountId.HasValue && request.BankAccountId.Value != Guid.Empty && refundAmount > 0)
                        {
                            await _ledgerService.RecordTransactionAsync(request.BankAccountId.Value, request.TransactionDate, request.ReferenceNumber?.Trim() ?? existingTxn.TransactionNumber, "Sales Return Refund", $"Sales return refund: {existingTxn.TransactionNumber} - {newCustomer.CustomerName} - {newProduct.Name}", refundAmount, 0m, existingTxn.Id, "SalesTransaction");
                        }
                    }
                    else if (request.PaymentMethod == "Cash")
                    {
                        creditAccount = await ResolveAccountAsync("Cash", "1001", "Assets", "Dr", tenantId, company.Id);
                        if (request.CashBookId.HasValue && request.CashBookId.Value != Guid.Empty && refundAmount > 0)
                        {
                            await _ledgerService.RecordCashTransactionAsync(request.CashBookId.Value, request.TransactionDate, request.ReferenceNumber?.Trim() ?? existingTxn.TransactionNumber, "Sales Return Refund", $"Sales return refund: {existingTxn.TransactionNumber} - {newCustomer.CustomerName} - {newProduct.Name}", refundAmount, 0m, existingTxn.Id, "SalesTransaction");
                        }
                    }
                    else
                    {
                        creditAccount = await ResolveAccountAsync("Accounts Receivable", "1200", "Assets", "Dr", tenantId, company.Id);
                    }

                    journalLines.Add((salesReturnAccount, returnedAmount, 0m, $"Customer returns: {existingTxn.TransactionNumber}"));
                    journalLines.Add((creditAccount, 0m, returnedAmount, $"Returns refund settlement: {existingTxn.TransactionNumber}"));

                    decimal cost = request.Cases * newProduct.CostPrice;
                    if (cost > 0)
                    {
                        journalLines.Add((inventoryAccount, cost, 0m, $"Restoring stock: {existingTxn.TransactionNumber}"));
                        journalLines.Add((cogsAccount, 0m, cost, $"COGS credit reversal: {existingTxn.TransactionNumber}"));
                    }

                    stockAdjustment = request.Cases;
                }
                else if (request.TransactionType == "Damage" || request.TransactionType == "Damaged Goods")
                {
                    productValue = newProduct.CostPrice;
                    damageCost = request.Cases * productValue;
                    damageReason = request.DamageReason ?? request.Remarks;

                    var lossAccount = await ResolveAccountAsync("Inventory Loss Expense", "5003", "Expenses", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    journalLines.Add((lossAccount, damageCost, 0m, $"Unsellable inventory loss: {existingTxn.TransactionNumber}"));
                    journalLines.Add((inventoryAccount, 0m, damageCost, $"Writedown inventory: {existingTxn.TransactionNumber}"));

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Internal Consumption")
                {
                    productValue = newProduct.CostPrice;
                    damageCost = request.Cases * productValue;

                    var officeExpenseAccount = await ResolveAccountAsync("Office Expense", "5004", "Expenses", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    journalLines.Add((officeExpenseAccount, damageCost, 0m, $"Internal department usage: {existingTxn.TransactionNumber}"));
                    journalLines.Add((inventoryAccount, 0m, damageCost, $"Finished goods consumption: {existingTxn.TransactionNumber}"));

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Free Sample")
                {
                    productValue = newProduct.CostPrice;
                    damageCost = request.Cases * productValue;

                    var marketingExpenseAccount = await ResolveAccountAsync("Marketing Expense", "5005", "Expenses", "Dr", tenantId, company.Id);
                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    journalLines.Add((marketingExpenseAccount, damageCost, 0m, $"Marketing sample distribution: {existingTxn.TransactionNumber}"));
                    journalLines.Add((inventoryAccount, 0m, damageCost, $"Finished goods sample: {existingTxn.TransactionNumber}"));

                    stockAdjustment = -request.Cases;
                }
                else if (request.TransactionType == "Stock Adjustment")
                {
                    productValue = newProduct.CostPrice;
                    damageCost = request.Cases * productValue;

                    var inventoryAccount = await ResolveAccountAsync("Finished Goods Inventory", "1003", "Assets", "Dr", tenantId, company.Id);

                    if (request.Cases >= 0)
                    {
                        var adjustmentGainAccount = await ResolveAccountAsync("Inventory Adjustment Gain", "4003", "Revenue", "Cr", tenantId, company.Id);
                        journalLines.Add((inventoryAccount, Math.Abs(damageCost), 0m, $"Physical audit surplus: {existingTxn.TransactionNumber}"));
                        journalLines.Add((adjustmentGainAccount, 0m, Math.Abs(damageCost), $"Inventory adjustment gain: {existingTxn.TransactionNumber}"));
                    }
                    else
                    {
                        var adjustmentLossAccount = await ResolveAccountAsync("Inventory Adjustment Loss", "5006", "Expenses", "Dr", tenantId, company.Id);
                        journalLines.Add((adjustmentLossAccount, Math.Abs(damageCost), 0m, $"Physical audit shortage: {existingTxn.TransactionNumber}"));
                        journalLines.Add((inventoryAccount, 0m, Math.Abs(damageCost), $"Inventory adjustment loss: {existingTxn.TransactionNumber}"));
                    }

                    stockAdjustment = request.Cases;
                }

                // Apply GL entries
                if (journalLines.Any())
                {
                    await CreateJournalEntryAsync(tenantId, company.Id, "Journal Voucher", $"Sales module auto-posting (Edited): {existingTxn.TransactionNumber}", existingTxn.TransactionNumber, journalLines, currentUserId);
                }

                // Apply stock movement
                if (stockAdjustment != 0)
                {
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
                }

                // Update properties
                existingTxn.CustomerId = newCustomer.Id;
                existingTxn.ProductId = request.ProductId;
                existingTxn.Cases = request.Cases;
                existingTxn.TransactionType = request.TransactionType;
                existingTxn.TransactionDate = request.TransactionDate.ToUniversalTime();
                existingTxn.ReferenceNumber = request.ReferenceNumber?.Trim();
                existingTxn.Remarks = request.Remarks?.Trim();
                existingTxn.PaymentMethod = request.PaymentMethod;
                existingTxn.BankAccountId = request.BankAccountId;
                existingTxn.CashBookId = request.CashBookId;
                existingTxn.UnitPrice = request.UnitPrice;
                existingTxn.DiscountAmount = request.DiscountAmount;
                existingTxn.TaxAmount = request.TaxAmount;
                existingTxn.CGST = request.CGST;
                existingTxn.SGST = request.SGST;
                existingTxn.IGST = request.IGST;
                existingTxn.MetadataJson = request.MetadataJson;
                existingTxn.TotalAmount = totalAmount;
                existingTxn.AmountReceived = amountReceived;
                existingTxn.OutstandingAmount = outstandingAmount;
                existingTxn.PaymentStatus = paymentStatus;
                existingTxn.ReturnedAmount = returnedAmount;
                existingTxn.RefundAmount = refundAmount;
                existingTxn.AdjustmentAmount = adjustmentAmount;
                existingTxn.ReturnType = returnType;
                existingTxn.IsReplacementRequired = request.IsReplacementRequired;
                existingTxn.ProductValue = productValue;
                existingTxn.DamageCost = damageCost;
                existingTxn.DamageReason = damageReason;
                existingTxn.UpdatedAt = DateTime.UtcNow;
                existingTxn.UpdatedBy = currentUserId;

                await _tenantContext.SaveChangesAsync();

                await dbTransaction.CommitAsync();

                var dto = new SalesTransactionDto
                {
                    Id = existingTxn.Id,
                    TransactionNumber = existingTxn.TransactionNumber,
                    CustomerId = existingTxn.CustomerId,
                    CustomerName = newCustomer.CustomerName,
                    CustomerCode = newCustomer.CustomerCode,
                    ProductId = existingTxn.ProductId,
                    ProductName = newProduct.Name,
                    ProductSku = newProduct.SKU ?? string.Empty,
                    Cases = existingTxn.Cases,
                    TransactionType = existingTxn.TransactionType,
                    TransactionDate = existingTxn.TransactionDate,
                    ReferenceNumber = existingTxn.ReferenceNumber,
                    Remarks = existingTxn.Remarks,
                    Status = existingTxn.Status,
                    PaymentMethod = existingTxn.PaymentMethod,
                    BankAccountId = existingTxn.BankAccountId,
                    BankAccountName = existingTxn.BankAccountId.HasValue ? (await _tenantContext.BankAccounts.FindAsync(existingTxn.BankAccountId.Value))?.BankName : null,
                    CashBookId = existingTxn.CashBookId,
                    CashBookName = existingTxn.CashBookId.HasValue ? (await _tenantContext.CashBooks.FindAsync(existingTxn.CashBookId.Value))?.Name : null,
                    UnitPrice = existingTxn.UnitPrice,
                    DiscountAmount = existingTxn.DiscountAmount,
                    TaxAmount = existingTxn.TaxAmount,
                    CGST = existingTxn.CGST,
                    SGST = existingTxn.SGST,
                    IGST = existingTxn.IGST,
                    MetadataJson = existingTxn.MetadataJson,
                    TotalAmount = existingTxn.TotalAmount,
                    AmountReceived = existingTxn.AmountReceived,
                    OutstandingAmount = existingTxn.OutstandingAmount,
                    PaymentStatus = existingTxn.PaymentStatus,
                    ReturnedAmount = existingTxn.ReturnedAmount,
                    RefundAmount = existingTxn.RefundAmount,
                    AdjustmentAmount = existingTxn.AdjustmentAmount,
                    ReturnType = existingTxn.ReturnType,
                    IsReplacementRequired = existingTxn.IsReplacementRequired,
                    ProductValue = existingTxn.ProductValue,
                    DamageCost = existingTxn.DamageCost,
                    DamageReason = existingTxn.DamageReason,
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

                // 1. REVERSE GL ENTRIES & BANK LEDGERS
                var journalEntry = await _tenantContext.JournalEntries
                    .Include(j => j.Lines)
                    .FirstOrDefaultAsync(j => j.ReferenceNumber == transaction.TransactionNumber && j.TenantId == tenantId);

                if (journalEntry != null)
                {
                    foreach (var line in journalEntry.Lines)
                    {
                        var account = await _tenantContext.Accounts.FindAsync(line.AccountId);
                        if (account != null)
                        {
                            if (line.DebitAmount > 0)
                            {
                                if (account.BalanceType == "Dr") account.CurrentBalance -= line.DebitAmount;
                                else account.CurrentBalance += line.DebitAmount;
                            }
                            if (line.CreditAmount > 0)
                            {
                                if (account.BalanceType == "Cr") account.CurrentBalance -= line.CreditAmount;
                                else account.CurrentBalance += line.CreditAmount;
                            }
                        }
                    }
                    _tenantContext.JournalEntries.Remove(journalEntry);
                }
                await _ledgerService.RemoveLedgerEntryForEntityAsync(transaction.Id, "SalesTransaction");

                // Restore customer balance
                var customer = await _tenantContext.Customers.FindAsync(transaction.CustomerId);
                if (customer != null)
                {
                    if (transaction.TransactionType == "Sales Dispatch")
                    {
                        customer.OutstandingPlaceholder = Math.Max(0m, customer.OutstandingPlaceholder - transaction.OutstandingAmount);
                        AppendCustomerLedgerEntry(customer, "Sales Cancelled", transaction.TransactionNumber, 0, transaction.TotalAmount, customer.OutstandingPlaceholder);
                    }
                    else if (transaction.TransactionType == "Customer Return")
                    {
                        customer.OutstandingPlaceholder += transaction.AdjustmentAmount;
                        AppendCustomerLedgerEntry(customer, "Returns Cancelled", transaction.TransactionNumber, transaction.ReturnedAmount, 0, customer.OutstandingPlaceholder);
                    }
                }

                // 2. REVERSE STOCK MOVEMENT ALGORITHM
                var oldMovement = await _tenantContext.InventoryMovements
                    .FirstOrDefaultAsync(m => m.ReferenceType == "SalesTransaction" && m.ReferenceId == transaction.Id && !m.IsDeleted);

                if (oldMovement != null)
                {
                    var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == oldMovement.ProductId && !p.IsDeleted);
                    if (product != null)
                    {
                        product.CurrentStock -= oldMovement.Quantity;
                    }

                    oldMovement.IsDeleted = true;
                    oldMovement.DeletedAt = DateTime.UtcNow;
                    oldMovement.DeletedBy = currentUserId;
                }

                // 3. SOFT DELETE TRANSACTION
                transaction.IsDeleted = true;
                transaction.DeletedAt = DateTime.UtcNow;
                transaction.DeletedBy = currentUserId;

                await _tenantContext.SaveChangesAsync();

                await dbTransaction.CommitAsync();

                return Success<object?>(null, "Sales transaction deleted successfully.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Transaction Failed", HttpContext.TraceIdentifier));
            }
        }

        private async Task<Account> ResolveAccountAsync(string name, string code, string groupName, string balanceType, Guid tenantId, Guid companyId)
        {
            var account = await _tenantContext.Accounts.FirstOrDefaultAsync(a => a.AccountName == name && a.TenantId == tenantId);
            if (account == null)
            {
                var group = await _tenantContext.AccountGroups.FirstOrDefaultAsync(g => g.Name == groupName && g.TenantId == tenantId);
                if (group == null)
                {
                    group = new AccountGroup
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        Name = groupName,
                        Type = groupName == "Revenue" ? "Revenue" : (groupName == "Expenses" ? "Expense" : "Asset"),
                        Code = code.Substring(0, 1) + "000",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = "System"
                    };
                    _tenantContext.AccountGroups.Add(group);
                    await _tenantContext.SaveChangesAsync();
                }

                account = new Account
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AccountName = name,
                    AccountCode = code,
                    AccountGroupId = group.Id,
                    BalanceType = balanceType,
                    CurrentBalance = 0,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = "System"
                };
                _tenantContext.Accounts.Add(account);
                await _tenantContext.SaveChangesAsync();
            }
            return account;
        }

        private async Task CreateJournalEntryAsync(
            Guid tenantId, 
            Guid companyId, 
            string voucherType, 
            string remarks, 
            string referenceNumber,
            List<(Account account, decimal debit, decimal credit, string description)> lines,
            string currentUserId)
        {
            if (!lines.Any()) return;

            var journalEntry = new JournalEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                VoucherNumber = $"JV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}",
                TransactionDate = DateTime.UtcNow,
                VoucherType = voucherType,
                ReferenceNumber = referenceNumber,
                Remarks = remarks,
                TotalAmount = lines.Sum(l => l.debit),
                Status = "Posted",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId
            };

            foreach (var line in lines)
            {
                journalEntry.Lines.Add(new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AccountId = line.account.Id,
                    Description = line.description,
                    DebitAmount = line.debit,
                    CreditAmount = line.credit
                });

                // Update running balance
                if (line.debit > 0)
                {
                    if (line.account.BalanceType == "Dr") line.account.CurrentBalance += line.debit;
                    else line.account.CurrentBalance -= line.debit;
                }
                if (line.credit > 0)
                {
                    if (line.account.BalanceType == "Cr") line.account.CurrentBalance += line.credit;
                    else line.account.CurrentBalance -= line.credit;
                }
            }

            _tenantContext.JournalEntries.Add(journalEntry);
        }

        private void AppendCustomerLedgerEntry(Customer customer, string type, string refNo, decimal debit, decimal credit, decimal balance)
        {
            var list = new List<CustomerLedgerEntry>();
            if (!string.IsNullOrWhiteSpace(customer.LedgerPlaceholder))
            {
                try
                {
                    list = System.Text.Json.JsonSerializer.Deserialize<List<CustomerLedgerEntry>>(customer.LedgerPlaceholder) ?? new List<CustomerLedgerEntry>();
                }
                catch {}
            }

            list.Add(new CustomerLedgerEntry
            {
                Date = DateTime.UtcNow,
                TransactionType = type,
                Reference = refNo,
                Debit = debit,
                Credit = credit,
                Balance = balance
            });

            customer.LedgerPlaceholder = System.Text.Json.JsonSerializer.Serialize(list);
        }

        public class CustomerLedgerEntry
        {
            public DateTime Date { get; set; }
            public string TransactionType { get; set; } = string.Empty;
            public string Reference { get; set; } = string.Empty;
            public decimal Debit { get; set; }
            public decimal Credit { get; set; }
            public decimal Balance { get; set; }
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

        // Simple Accounts V1 & New ERP Fields
        public string? PaymentMethod { get; set; }
        public Guid? BankAccountId { get; set; }
        public string? BankAccountName { get; set; }
        public Guid? CashBookId { get; set; }
        public string? CashBookName { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal CGST { get; set; }
        public decimal SGST { get; set; }
        public decimal IGST { get; set; }
        public string? MetadataJson { get; set; }

        public decimal TotalAmount { get; set; }
        public decimal AmountReceived { get; set; }
        public decimal OutstandingAmount { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public decimal ReturnedAmount { get; set; }
        public decimal RefundAmount { get; set; }
        public decimal AdjustmentAmount { get; set; }
        public string? ReturnType { get; set; }
        public bool IsReplacementRequired { get; set; }
        public decimal ProductValue { get; set; }
        public decimal DamageCost { get; set; }
        public string? DamageReason { get; set; }

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

        // Simple Accounts V1 & New ERP Fields
        public string? PaymentMethod { get; set; }
        public Guid? BankAccountId { get; set; }
        public Guid? CashBookId { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal CGST { get; set; }
        public decimal SGST { get; set; }
        public decimal IGST { get; set; }
        public string? MetadataJson { get; set; }

        public decimal TotalAmount { get; set; }
        public decimal AmountReceived { get; set; }
        public decimal ReturnedAmount { get; set; }
        public decimal RefundAmount { get; set; }
        public decimal AdjustmentAmount { get; set; }
        public string? ReturnType { get; set; }
        public bool IsReplacementRequired { get; set; }
        public decimal ProductValue { get; set; }
        public decimal DamageCost { get; set; }
        public string? DamageReason { get; set; }
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




