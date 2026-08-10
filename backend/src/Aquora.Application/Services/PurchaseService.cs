using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Purchase;
using Aquora.Domain.Common;
using Aquora.Domain.Entities;
using Aquora.Domain.Entities.Finance;
using Aquora.Shared.Models;

namespace Aquora.Application.Services
{
    public class PurchaseService : IPurchaseService
    {
        private readonly ITenantDbContext _context;
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ILedgerService _bankLedgerService;
        private readonly ILogger<PurchaseService> _logger;

        public PurchaseService(
            ITenantDbContext context,
            IPlatformDbContext platformContext,
            ITenantProvider tenantProvider,
            ICurrentUserContext currentUserContext,
            ILedgerService bankLedgerService,
            ILogger<PurchaseService> logger)
        {
            _context = context;
            _platformContext = platformContext;
            _tenantProvider = tenantProvider;
            _currentUserContext = currentUserContext;
            _bankLedgerService = bankLedgerService;
            _logger = logger;
        }

        private Guid GetTenantId() => _tenantProvider.TenantId;

        private async Task<Guid> GetCompanyIdAsync()
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            return company?.Id ?? Guid.Empty;
        }

        private async Task<string> GeneratePurchaseNumberAsync()
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"PUR-{year}-";

            var countThisYear = await _context.Purchases
                .Where(p => p.PurchaseNo.StartsWith(prefix))
                .CountAsync();

            var nextSeq = countThisYear + 1;
            return $"{prefix}{nextSeq:D6}";
        }

        public async Task<PagedPurchasesResponseDto> GetPurchasesPagedAsync(
            int pageNumber,
            int pageSize,
            string? search,
            DateTime? startDate,
            DateTime? endDate,
            Guid? vendorId,
            string? category,
            string? paymentStatus)
        {
            var query = _context.Purchases
                .Include(p => p.Vendor)
                .Include(p => p.BankAccount)
                .Include(p => p.CashBook)
                .Include(p => p.Asset)
                .Where(p => !p.IsDeleted)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(p =>
                    p.PurchaseNo.ToLower().Contains(s) ||
                    p.VendorName.ToLower().Contains(s) ||
                    (p.InvoiceNumber != null && p.InvoiceNumber.ToLower().Contains(s)) ||
                    (p.ReferenceNumber != null && p.ReferenceNumber.ToLower().Contains(s)));
            }

            if (startDate.HasValue)
            {
                query = query.Where(p => p.PurchaseDate >= startDate.Value.Date);
            }

            if (endDate.HasValue)
            {
                var endOfDays = endDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(p => p.PurchaseDate <= endOfDays);
            }

            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
            {
                query = query.Where(p => p.VendorId == vendorId.Value);
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(p => p.PurchaseCategory == category);
            }

            if (!string.IsNullOrWhiteSpace(paymentStatus))
            {
                query = query.Where(p => p.PaymentStatus == paymentStatus);
            }

            var totalCount = await query.CountAsync();

            var today = DateTime.UtcNow.Date;
            var baseStatsQuery = _context.Purchases.Where(p => !p.IsDeleted).AsNoTracking();

            var stats = new PurchaseSummaryStatsDto
            {
                TotalPurchasesCount = await baseStatsQuery.CountAsync(),
                TodayPurchasesCount = await baseStatsQuery.CountAsync(p => p.PurchaseDate >= today),
                TotalPurchaseValue = await baseStatsQuery.SumAsync(p => (decimal?)p.GrandTotal) ?? 0m,
                OutstandingBalance = await baseStatsQuery.SumAsync(p => (decimal?)p.BalanceAmount) ?? 0m,
                PendingPaymentsCount = await baseStatsQuery.CountAsync(p => p.BalanceAmount > 0),
                ActiveVendorsCount = await _context.Vendors.CountAsync(v => !v.IsDeleted && v.IsActive)
            };

            var rawItems = await query
                .OrderByDescending(p => p.PurchaseDate)
                .ThenByDescending(p => p.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userIds = rawItems.Select(p => p.CreatedBy)
                .Concat(rawItems.Select(p => p.UpdatedBy))
                .Concat(rawItems.Select(p => p.CancelledBy));
            var resolveName = await GetUserResolverAsync(userIds);

            var dtos = rawItems.Select(p => MapToDto(p, resolveName)).ToList();

            return new PagedPurchasesResponseDto
            {
                Items = dtos,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize,
                SummaryStats = stats
            };
        }

        public async Task<PagedResult<PurchaseDto>> GetPurchasesAsync(
            int pageNumber,
            int pageSize,
            string? search,
            DateTime? startDate,
            DateTime? endDate,
            Guid? vendorId,
            string? category,
            string? paymentStatus)
        {
            var res = await GetPurchasesPagedAsync(pageNumber, pageSize, search, startDate, endDate, vendorId, category, paymentStatus);
            return new PagedResult<PurchaseDto>(res.Items, res.TotalCount, res.PageNumber, res.PageSize);
        }

        public async Task<PurchaseDto?> GetPurchaseByIdAsync(Guid id)
        {
            var p = await _context.Purchases
                .Include(x => x.Vendor)
                .Include(x => x.BankAccount)
                .Include(x => x.CashBook)
                .Include(x => x.Asset)
                .Include(x => x.Items)
                    .ThenInclude(i => i.RawMaterial)
                .Include(x => x.Payments)
                    .ThenInclude(pay => pay.BankAccount)
                .Include(x => x.Payments)
                    .ThenInclude(pay => pay.CashBook)
                .Include(x => x.TimelineEvents)
                .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

            if (p == null) return null;

            var userIds = new List<string?> { p.CreatedBy, p.UpdatedBy, p.CancelledBy }
                .Concat(p.Payments.Select(pay => pay.CreatedBy))
                .Concat(p.TimelineEvents.Select(t => t.PerformedBy));
            var resolveName = await GetUserResolverAsync(userIds);

            var dto = MapToDto(p, resolveName);
            dto.Items = p.Items.Select(i => new PurchaseItemDto
            {
                Id = i.Id,
                PurchaseId = i.PurchaseId,
                RawMaterialId = i.RawMaterialId,
                RawMaterialName = i.RawMaterial?.Name ?? i.ItemName,
                ItemName = i.ItemName,
                Quantity = i.Quantity,
                Unit = i.Unit,
                UnitPrice = i.UnitPrice,
                GSTPercent = i.GSTPercent,
                DiscountAmount = i.DiscountAmount,
                TotalAmount = i.TotalAmount
            }).ToList();

            dto.Payments = p.Payments.OrderByDescending(pay => pay.CreatedAt).Select(pay => new PurchasePaymentDto
            {
                Id = pay.Id,
                PurchaseId = pay.PurchaseId,
                PaymentDate = pay.PaymentDate,
                PaymentMethod = pay.PaymentMethod,
                BankAccountId = pay.BankAccountId,
                BankAccountName = pay.BankAccount?.BankName,
                CashBookId = pay.CashBookId,
                CashBookName = pay.CashBook?.Name,
                Amount = pay.Amount,
                ReferenceNo = pay.ReferenceNo,
                Notes = pay.Notes,
                CreatedAt = pay.CreatedAt,
                CreatedBy = pay.CreatedBy,
                CreatedByName = resolveName(pay.CreatedBy)
            }).ToList();

            dto.TimelineEvents = p.TimelineEvents.OrderByDescending(t => t.EventDate).Select(t => new PurchaseTimelineEventDto
            {
                Id = t.Id,
                PurchaseId = t.PurchaseId,
                EventDate = t.EventDate,
                Action = t.Action,
                PerformedBy = t.PerformedBy,
                PerformedByName = resolveName(t.PerformedBy),
                Details = t.Details,
                Notes = t.Notes
            }).ToList();

            return dto;
        }

        public async Task<PurchaseDto> CreatePurchaseAsync(CreatePurchaseRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.PurchaseCategory))
            {
                throw new ArgumentException("Purchase Category is required.");
            }

            if (request.GrandTotal < 0)
            {
                throw new ArgumentException("Grand Total cannot be negative.");
            }

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var currentUser = _currentUserContext.Email ?? "Company Administrator";

            string vendorName = request.VendorName;
            Guid? vendorId = request.VendorId;

            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
            {
                var existingVendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == vendorId.Value && !v.IsDeleted);
                if (existingVendor != null)
                {
                    vendorName = existingVendor.Name;
                }
            }
            else if (!string.IsNullOrWhiteSpace(request.VendorName))
            {
                var newVendor = new Vendor
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    VendorCode = $"VND-{DateTime.UtcNow:yyyy}-{(await _context.Vendors.CountAsync() + 1):D4}",
                    Name = request.VendorName.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUser
                };
                _context.Vendors.Add(newVendor);
                await _context.SaveChangesAsync();
                vendorId = newVendor.Id;
                vendorName = newVendor.Name;
            }

            var purchaseNo = await GeneratePurchaseNumberAsync();
            var grandTotal = Math.Round(request.GrandTotal, 2);
            var amountPaid = Math.Round(request.AmountPaid, 2);
            if (amountPaid > grandTotal) amountPaid = grandTotal;
            var balanceAmount = Math.Round(grandTotal - amountPaid, 2);

            string status = "Unpaid";
            if (amountPaid >= grandTotal && grandTotal > 0) status = "Paid";
            else if (amountPaid > 0) status = "PartiallyPaid";

            var purchase = new Purchase
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                PurchaseNo = purchaseNo,
                PurchaseDate = request.PurchaseDate.ToUniversalTime(),
                VendorId = vendorId,
                VendorName = vendorName,
                PurchaseCategory = request.PurchaseCategory,
                InvoiceNumber = request.InvoiceNumber?.Trim(),
                ReferenceNumber = request.ReferenceNumber?.Trim(),
                PaymentMethod = request.PaymentMethod,
                BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null,
                CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null,
                SubTotal = request.SubTotal,
                TaxAmount = request.TaxAmount,
                DiscountAmount = request.DiscountAmount,
                OtherCharges = request.OtherCharges,
                GrandTotal = grandTotal,
                AmountPaid = amountPaid,
                BalanceAmount = balanceAmount,
                PaymentStatus = status,
                Notes = request.Notes?.Trim(),
                AttachmentUrl = request.AttachmentUrl,
                CategoryMetadataJson = request.CategoryMetadataJson,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUser
            };

            if (request.Items != null && request.Items.Any())
            {
                foreach (var item in request.Items)
                {
                    if (item.Quantity <= 0) continue;

                    purchase.Items.Add(new PurchaseItem
                    {
                        Id = Guid.NewGuid(),
                        PurchaseId = purchase.Id,
                        RawMaterialId = item.RawMaterialId,
                        ItemName = item.ItemName.Trim(),
                        Quantity = item.Quantity,
                        Unit = item.Unit,
                        UnitPrice = item.UnitPrice,
                        GSTPercent = item.GSTPercent,
                        DiscountAmount = item.DiscountAmount,
                        TotalAmount = item.TotalAmount
                    });
                }
            }

            if (amountPaid > 0)
            {
                purchase.Payments.Add(new PurchasePayment
                {
                    Id = Guid.NewGuid(),
                    PurchaseId = purchase.Id,
                    PaymentDate = request.PurchaseDate.ToUniversalTime(),
                    PaymentMethod = request.PaymentMethod,
                    BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null,
                    CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null,
                    Amount = amountPaid,
                    ReferenceNo = request.ReferenceNumber,
                    Notes = "Initial payment on purchase creation",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUser
                });

                if (request.PaymentMethod == "BankAccount" && request.BankAccountId.HasValue)
                {
                    var bank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value);
                    if (bank != null)
                    {
                        bank.CurrentBalance -= amountPaid;
                        _context.BankLedgerEntries.Add(new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankAccountId = bank.Id,
                            LedgerAccountType = "BankAccount",
                            TransactionDate = DateTime.UtcNow,
                            ReferenceNumber = purchaseNo,
                            TransactionType = "Debit",
                            Description = $"Purchase payment to {vendorName} ({request.PurchaseCategory})",
                            Debit = amountPaid,
                            Credit = 0,
                            RunningBalance = bank.CurrentBalance,
                            RelatedEntityId = purchase.Id,
                            RelatedEntityType = "Purchase",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = currentUser
                        });
                    }
                }
                else if (request.PaymentMethod == "Cash" && request.CashBookId.HasValue)
                {
                    var cash = await _context.CashBooks.FirstOrDefaultAsync(c => c.Id == request.CashBookId.Value);
                    if (cash != null)
                    {
                        cash.CurrentBalance -= amountPaid;
                        _context.BankLedgerEntries.Add(new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            CashBookId = cash.Id,
                            LedgerAccountType = "CashBook",
                            TransactionDate = DateTime.UtcNow,
                            ReferenceNumber = purchaseNo,
                            TransactionType = "Debit",
                            Description = $"Cash purchase payment to {vendorName} ({request.PurchaseCategory})",
                            Debit = amountPaid,
                            Credit = 0,
                            RunningBalance = cash.CurrentBalance,
                            RelatedEntityId = purchase.Id,
                            RelatedEntityType = "Purchase",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = currentUser
                        });
                    }
                }
            }

            if (vendorId.HasValue && balanceAmount > 0)
            {
                var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == vendorId.Value);
                if (vendor != null)
                {
                    vendor.CurrentBalance += balanceAmount;
                }
            }

            if (request.PurchaseCategory == "RawMaterial" && purchase.Items.Any())
            {
                foreach (var item in purchase.Items)
                {
                    if (item.RawMaterialId.HasValue)
                    {
                        var rm = await _context.RawMaterials.FirstOrDefaultAsync(r => r.Id == item.RawMaterialId.Value);
                        if (rm != null)
                        {
                            rm.CurrentStock += item.Quantity;
                            _context.InventoryMovements.Add(new InventoryMovement
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                CompanyId = companyId,
                                RawMaterialId = rm.Id,
                                InventoryType = "RawMaterial",
                                ReferenceType = "PURCHASE",
                                ReferenceId = purchase.Id,
                                Quantity = item.Quantity,
                                Notes = $"Raw material purchase {purchaseNo} from {vendorName}",
                                BalanceAfter = rm.CurrentStock,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = currentUser
                            });
                        }
                    }
                }
            }
            else if (request.PurchaseCategory == "Machine" || request.PurchaseCategory == "OfficeAsset")
            {
                string assetName = $"{request.PurchaseCategory} - {vendorName}";
                string categoryType = request.PurchaseCategory == "Machine" ? "Machine" : "OfficeAsset";
                string serialNo = "";
                string location = "Main Facility";

                if (!string.IsNullOrWhiteSpace(request.CategoryMetadataJson))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(request.CategoryMetadataJson);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("machineName", out var mn) && !string.IsNullOrWhiteSpace(mn.GetString())) assetName = mn.GetString()!;
                        if (root.TryGetProperty("assetName", out var an) && !string.IsNullOrWhiteSpace(an.GetString())) assetName = an.GetString()!;
                        if (root.TryGetProperty("serialNumber", out var sn) && !string.IsNullOrWhiteSpace(sn.GetString())) serialNo = sn.GetString()!;
                        if (root.TryGetProperty("location", out var loc) && !string.IsNullOrWhiteSpace(loc.GetString())) location = loc.GetString()!;
                    }
                    catch { }
                }

                var newAsset = new Asset
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = companyId,
                    AssetName = assetName,
                    AssetCategory = categoryType,
                    SerialNumber = serialNo,
                    PurchaseDate = request.PurchaseDate.ToUniversalTime(),
                    PurchasePrice = grandTotal,
                    SupplierId = vendorId,
                    CurrentStatus = "Active",
                    Location = location,
                    CurrentValue = grandTotal,
                    Notes = $"Created via Purchase {purchaseNo}",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUser
                };

                _context.Assets.Add(newAsset);
                await _context.SaveChangesAsync();

                purchase.AssetId = newAsset.Id;

                _context.AssetHistories.Add(new AssetHistory
                {
                    Id = Guid.NewGuid(),
                    AssetId = newAsset.Id,
                    Date = DateTime.UtcNow,
                    Action = "Purchased",
                    PerformedBy = currentUser,
                    NewValue = $"₹{grandTotal:N2}",
                    Remarks = $"Purchased via Invoice {purchaseNo} from {vendorName}"
                });
            }

            purchase.TimelineEvents.Add(new PurchaseTimelineEvent
            {
                Id = Guid.NewGuid(),
                PurchaseId = purchase.Id,
                EventDate = DateTime.UtcNow,
                Action = "Purchase Created",
                PerformedBy = currentUser,
                Details = $"Created {request.PurchaseCategory} purchase record for ₹{grandTotal:N2} ({status})"
            });

            _context.Purchases.Add(purchase);
            await _context.SaveChangesAsync();

            return (await GetPurchaseByIdAsync(purchase.Id))!;
        }

        public async Task<PurchaseDto?> UpdatePurchaseAsync(Guid id, UpdatePurchaseRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.VendorName) && (!request.VendorId.HasValue || request.VendorId.Value == Guid.Empty))
            {
                throw new ArgumentException("Please select a vendor before saving the purchase.");
            }

            if (string.IsNullOrWhiteSpace(request.PurchaseCategory))
            {
                throw new ArgumentException("Please choose a purchase category.");
            }

            if (request.PurchaseCategory == "RawMaterial" && (request.Items == null || !request.Items.Any(i => i.Quantity > 0)))
            {
                throw new ArgumentException("Please add at least one purchase item.");
            }

            if (request.GrandTotal <= 0)
            {
                throw new ArgumentException("Please enter a valid purchase amount.");
            }

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();

            var dbContext = _context as DbContext;
            if (dbContext == null) throw new InvalidOperationException("Could not cast context to DbContext");

            using var transaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var purchase = await _context.Purchases
                    .Include(p => p.Items)
                        .ThenInclude(i => i.RawMaterial)
                    .Include(p => p.Payments)
                    .Include(p => p.TimelineEvents)
                    .Include(p => p.Vendor)
                    .Include(p => p.Asset)
                    .FirstOrDefaultAsync(p => p.Id == id && (companyId == Guid.Empty || p.CompanyId == companyId) && !p.IsDeleted);

                if (purchase == null) return null;

            var currentUser = _currentUserContext.Email ?? "Unknown User";

            var oldVendorId = purchase.VendorId;
            var oldBalanceAmount = purchase.BalanceAmount;
            var oldAmountPaid = purchase.AmountPaid;
            var oldPaymentMethod = purchase.PaymentMethod;
            var oldBankAccountId = purchase.BankAccountId;
            var oldCashBookId = purchase.CashBookId;
            var oldGrandTotal = purchase.GrandTotal;

            var newGrandTotal = Math.Round(request.GrandTotal, 2);
            var newAmountPaid = Math.Round(request.AmountPaid, 2);
            if (newAmountPaid > newGrandTotal) newAmountPaid = newGrandTotal;
            var newBalanceAmount = Math.Round(newGrandTotal - newAmountPaid, 2);

            string newStatus = "Unpaid";
            if (newAmountPaid >= newGrandTotal && newGrandTotal > 0) newStatus = "Paid";
            else if (newAmountPaid > 0) newStatus = "PartiallyPaid";

            purchase.PurchaseDate = request.PurchaseDate.ToUniversalTime();
            if (request.VendorId.HasValue && request.VendorId.Value != Guid.Empty)
            {
                purchase.VendorId = request.VendorId.Value;
                if (!string.IsNullOrWhiteSpace(request.VendorName))
                {
                    purchase.VendorName = request.VendorName;
                }
            }
            else if (!string.IsNullOrWhiteSpace(request.VendorName))
            {
                purchase.VendorName = request.VendorName;
            }

            purchase.PurchaseCategory = request.PurchaseCategory;
            purchase.InvoiceNumber = request.InvoiceNumber?.Trim();
            purchase.ReferenceNumber = request.ReferenceNumber?.Trim();
            purchase.PaymentMethod = request.PaymentMethod;
            purchase.BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null;
            purchase.CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null;
            purchase.SubTotal = request.SubTotal;
            purchase.TaxAmount = request.TaxAmount;
            purchase.DiscountAmount = request.DiscountAmount;
            purchase.OtherCharges = request.OtherCharges;
            purchase.GrandTotal = newGrandTotal;
            purchase.AmountPaid = newAmountPaid;
            purchase.BalanceAmount = newBalanceAmount;
            purchase.PaymentStatus = newStatus;
            purchase.Notes = request.Notes?.Trim();
            purchase.AttachmentUrl = request.AttachmentUrl;
            purchase.CategoryMetadataJson = request.CategoryMetadataJson;
            purchase.UpdatedAt = DateTime.UtcNow;
            purchase.UpdatedBy = currentUser;

            // Line items reconciliation
            if (request.PurchaseCategory == "RawMaterial")
            {
                var existingItems = purchase.Items.ToList();
                var requestItems = request.Items ?? new List<CreatePurchaseItemRequest>();

                var itemsToRemove = existingItems.Where(ei => !requestItems.Any(ri => (ri.Id.HasValue && ri.Id.Value != Guid.Empty && ri.Id.Value == ei.Id) || (ri.RawMaterialId.HasValue && ri.RawMaterialId.Value == ei.RawMaterialId) || (!ri.RawMaterialId.HasValue && string.Equals(ri.ItemName.Trim(), ei.ItemName.Trim(), StringComparison.OrdinalIgnoreCase)))).ToList();
                foreach (var itemToRemove in itemsToRemove)
                {
                    if (itemToRemove.RawMaterialId.HasValue)
                    {
                        var rm = await _context.RawMaterials.FirstOrDefaultAsync(r => r.Id == itemToRemove.RawMaterialId.Value);
                        if (rm != null)
                        {
                            rm.CurrentStock = Math.Max(0, rm.CurrentStock - itemToRemove.Quantity);
                            _context.InventoryMovements.Add(new InventoryMovement
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                CompanyId = companyId,
                                RawMaterialId = rm.Id,
                                InventoryType = "RawMaterial",
                                ReferenceType = "PURCHASE_EDIT_REMOVE",
                                ReferenceId = purchase.Id,
                                Quantity = -itemToRemove.Quantity,
                                Notes = $"Removed item on purchase edit ({purchase.PurchaseNo})",
                                BalanceAfter = rm.CurrentStock,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = currentUser
                            });
                        }
                    }
                    purchase.Items.Remove(itemToRemove);
                    _context.PurchaseItems.Remove(itemToRemove);
                }

                foreach (var reqItem in requestItems)
                {
                    if (reqItem.Quantity <= 0) continue;

                    var existing = existingItems.FirstOrDefault(ei => (reqItem.Id.HasValue && reqItem.Id.Value != Guid.Empty && ei.Id == reqItem.Id.Value) || (reqItem.RawMaterialId.HasValue && ei.RawMaterialId == reqItem.RawMaterialId.Value) || (!reqItem.RawMaterialId.HasValue && string.Equals(ei.ItemName.Trim(), reqItem.ItemName.Trim(), StringComparison.OrdinalIgnoreCase)));

                    if (existing != null)
                    {
                        var qtyDelta = reqItem.Quantity - existing.Quantity;
                        if (qtyDelta != 0 && existing.RawMaterialId.HasValue)
                        {
                            var rm = await _context.RawMaterials.FirstOrDefaultAsync(r => r.Id == existing.RawMaterialId.Value);
                            if (rm != null)
                            {
                                rm.CurrentStock += qtyDelta;
                                _context.InventoryMovements.Add(new InventoryMovement
                                {
                                    Id = Guid.NewGuid(),
                                    TenantId = tenantId,
                                    CompanyId = companyId,
                                    RawMaterialId = rm.Id,
                                    InventoryType = "RawMaterial",
                                    ReferenceType = "PURCHASE_EDIT_DELTA",
                                    ReferenceId = purchase.Id,
                                    Quantity = qtyDelta,
                                    Notes = $"Quantity adjusted on purchase edit ({purchase.PurchaseNo})",
                                    BalanceAfter = rm.CurrentStock,
                                    CreatedAt = DateTime.UtcNow,
                                    CreatedBy = currentUser
                                });
                            }
                        }

                        existing.ItemName = reqItem.ItemName.Trim();
                        existing.Quantity = reqItem.Quantity;
                        existing.Unit = reqItem.Unit;
                        existing.UnitPrice = reqItem.UnitPrice;
                        existing.GSTPercent = reqItem.GSTPercent;
                        existing.DiscountAmount = reqItem.DiscountAmount;
                        existing.TotalAmount = reqItem.TotalAmount;
                    }
                    else
                    {
                        var newItem = new PurchaseItem
                        {
                            Id = Guid.NewGuid(),
                            PurchaseId = purchase.Id,
                            RawMaterialId = reqItem.RawMaterialId,
                            ItemName = reqItem.ItemName.Trim(),
                            Quantity = reqItem.Quantity,
                            Unit = reqItem.Unit,
                            UnitPrice = reqItem.UnitPrice,
                            GSTPercent = reqItem.GSTPercent,
                            DiscountAmount = reqItem.DiscountAmount,
                            TotalAmount = reqItem.TotalAmount
                        };

                        _context.PurchaseItems.Add(newItem);
                        purchase.Items.Add(newItem);

                        if (newItem.RawMaterialId.HasValue)
                        {
                            var rm = await _context.RawMaterials.FirstOrDefaultAsync(r => r.Id == newItem.RawMaterialId.Value);
                            if (rm != null)
                            {
                                rm.CurrentStock += newItem.Quantity;
                                _context.InventoryMovements.Add(new InventoryMovement
                                {
                                    Id = Guid.NewGuid(),
                                    TenantId = tenantId,
                                    CompanyId = companyId,
                                    RawMaterialId = rm.Id,
                                    InventoryType = "RawMaterial",
                                    ReferenceType = "PURCHASE_EDIT_ADD",
                                    ReferenceId = purchase.Id,
                                    Quantity = newItem.Quantity,
                                    Notes = $"Added item on purchase edit ({purchase.PurchaseNo})",
                                    BalanceAfter = rm.CurrentStock,
                                    CreatedAt = DateTime.UtcNow,
                                    CreatedBy = currentUser
                                });
                            }
                        }
                    }
                }
            }

            // 1. Audit timeline comparison list
            var changesList = new List<string>();

            if (oldPaymentMethod != request.PaymentMethod)
                changesList.Add($"Payment Method: {oldPaymentMethod} -> {request.PaymentMethod}");

            if (oldBankAccountId != (request.PaymentMethod == "BankAccount" ? request.BankAccountId : null))
            {
                var oldBank = oldBankAccountId.HasValue ? await _context.BankAccounts.FindAsync(oldBankAccountId.Value) : null;
                var newBank = (request.PaymentMethod == "BankAccount" && request.BankAccountId.HasValue) ? await _context.BankAccounts.FindAsync(request.BankAccountId.Value) : null;
                changesList.Add($"Bank Account: {oldBank?.BankName ?? "None"} -> {newBank?.BankName ?? "None"}");
            }

            if (oldCashBookId != (request.PaymentMethod == "Cash" ? request.CashBookId : null))
            {
                var oldCash = oldCashBookId.HasValue ? await _context.CashBooks.FindAsync(oldCashBookId.Value) : null;
                var newCash = (request.PaymentMethod == "Cash" && request.CashBookId.HasValue) ? await _context.CashBooks.FindAsync(request.CashBookId.Value) : null;
                changesList.Add($"Cash Book: {oldCash?.Name ?? "None"} -> {newCash?.Name ?? "None"}");
            }

            if (Math.Abs(oldAmountPaid - newAmountPaid) > 0.01m)
                changesList.Add($"Amount Paid: ₹{oldAmountPaid:N2} -> ₹{newAmountPaid:N2}");

            if (Math.Abs(oldGrandTotal - newGrandTotal) > 0.01m)
                changesList.Add($"Grand Total: ₹{oldGrandTotal:N2} -> ₹{newGrandTotal:N2}");

            if (oldVendorId != request.VendorId)
            {
                var oldVendor = oldVendorId.HasValue ? await _context.Vendors.FindAsync(oldVendorId.Value) : null;
                var newVendor = (request.VendorId.HasValue && request.VendorId.Value != Guid.Empty) ? await _context.Vendors.FindAsync(request.VendorId.Value) : null;
                changesList.Add($"Vendor: {oldVendor?.Name ?? "None"} -> {newVendor?.Name ?? "None"}");
            }

            // 2. Vendor Balance Adjustment (with Vendor change checks)
            var newVendorId = request.VendorId;
            if (oldVendorId != newVendorId)
            {
                // Vendor changed
                if (oldVendorId.HasValue)
                {
                    var oldVendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == oldVendorId.Value && !v.IsDeleted);
                    if (oldVendor != null)
                    {
                        oldVendor.CurrentBalance = Math.Max(0, oldVendor.CurrentBalance - oldBalanceAmount);
                    }
                }

                if (newVendorId.HasValue && newVendorId.Value != Guid.Empty)
                {
                    var newVendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == newVendorId.Value && !v.IsDeleted);
                    if (newVendor != null)
                    {
                        newVendor.CurrentBalance = Math.Max(0, newVendor.CurrentBalance + newBalanceAmount);
                    }
                }
            }
            else
            {
                // Vendor same, adjust balance delta
                var balanceDelta = newBalanceAmount - oldBalanceAmount;
                if (balanceDelta != 0 && purchase.VendorId.HasValue)
                {
                    var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == purchase.VendorId.Value && !v.IsDeleted);
                    if (vendor != null)
                    {
                        vendor.CurrentBalance = Math.Max(0, vendor.CurrentBalance + balanceDelta);
                    }
                }
            }

            // 3. Bank / Cash Ledger Entry Synchronization
            var existingLedgerEntries = await _context.BankLedgerEntries
                .Where(le => le.RelatedEntityId == purchase.Id && le.RelatedEntityType == "Purchase")
                .ToListAsync();

            // Reverse previous ledger transactions from bank/cash balances
            foreach (var le in existingLedgerEntries)
            {
                if (le.LedgerAccountType == "BankAccount" && le.BankAccountId.HasValue)
                {
                    var bank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == le.BankAccountId.Value);
                    if (bank != null)
                    {
                        bank.CurrentBalance += le.Debit; // reverse debit (add it back)
                    }
                }
                else if (le.LedgerAccountType == "CashBook" && le.CashBookId.HasValue)
                {
                    var cash = await _context.CashBooks.FirstOrDefaultAsync(c => c.Id == le.CashBookId.Value);
                    if (cash != null)
                    {
                        cash.CurrentBalance += le.Debit; // reverse debit (add it back)
                    }
                }
            }

            // Remove old entries from DB context
            _context.BankLedgerEntries.RemoveRange(existingLedgerEntries);

            // Create new ledger entry and deduct new balance from new account/cash book
            if (newAmountPaid > 0)
            {
                if (request.PaymentMethod == "BankAccount" && request.BankAccountId.HasValue)
                {
                    var bank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value);
                    if (bank != null)
                    {
                        bank.CurrentBalance -= newAmountPaid;
                        _context.BankLedgerEntries.Add(new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankAccountId = bank.Id,
                            LedgerAccountType = "BankAccount",
                            TransactionDate = DateTime.UtcNow,
                            ReferenceNumber = purchase.PurchaseNo,
                            TransactionType = "Debit",
                            Description = $"Purchase payment to {purchase.VendorName} ({purchase.PurchaseCategory}) - Updated",
                            Debit = newAmountPaid,
                            Credit = 0,
                            RunningBalance = bank.CurrentBalance,
                            RelatedEntityId = purchase.Id,
                            RelatedEntityType = "Purchase",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = currentUser
                        });
                    }
                }
                else if (request.PaymentMethod == "Cash" && request.CashBookId.HasValue)
                {
                    var cash = await _context.CashBooks.FirstOrDefaultAsync(c => c.Id == request.CashBookId.Value);
                    if (cash != null)
                    {
                        cash.CurrentBalance -= newAmountPaid;
                        _context.BankLedgerEntries.Add(new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            CashBookId = cash.Id,
                            LedgerAccountType = "CashBook",
                            TransactionDate = DateTime.UtcNow,
                            ReferenceNumber = purchase.PurchaseNo,
                            TransactionType = "Debit",
                            Description = $"Cash purchase payment to {purchase.VendorName} ({purchase.PurchaseCategory}) - Updated",
                            Debit = newAmountPaid,
                            Credit = 0,
                            RunningBalance = cash.CurrentBalance,
                            RelatedEntityId = purchase.Id,
                            RelatedEntityType = "Purchase",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = currentUser
                        });
                    }
                }
            }

            // 4. Payment Settlement History Update
            var initialPayment = purchase.Payments.OrderBy(p => p.CreatedAt).FirstOrDefault();
            if (newAmountPaid > 0)
            {
                if (initialPayment == null)
                {
                    initialPayment = new PurchasePayment
                    {
                        Id = Guid.NewGuid(),
                        PurchaseId = purchase.Id,
                        PaymentDate = purchase.PurchaseDate,
                        PaymentMethod = purchase.PaymentMethod,
                        BankAccountId = purchase.BankAccountId,
                        CashBookId = purchase.CashBookId,
                        Amount = newAmountPaid,
                        ReferenceNo = purchase.ReferenceNumber,
                        Notes = "Payment synchronized from purchase edit",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    };
                    _context.PurchasePayments.Add(initialPayment);
                    purchase.Payments.Add(initialPayment);
                }
                else
                {
                    initialPayment.PaymentDate = purchase.PurchaseDate;
                    initialPayment.PaymentMethod = purchase.PaymentMethod;
                    initialPayment.BankAccountId = purchase.BankAccountId;
                    initialPayment.CashBookId = purchase.CashBookId;
                    initialPayment.Amount = newAmountPaid;
                    initialPayment.ReferenceNo = purchase.ReferenceNumber;
                    initialPayment.Notes = "Payment updated during purchase edit";
                }
            }
            else
            {
                if (initialPayment != null)
                {
                    _context.PurchasePayments.Remove(initialPayment);
                    purchase.Payments.Remove(initialPayment);
                }
            }

            // 5. Asset price update
            if (purchase.AssetId.HasValue)
            {
                var asset = await _context.Assets.FirstOrDefaultAsync(a => a.Id == purchase.AssetId.Value);
                if (asset != null)
                {
                    asset.PurchasePrice = newGrandTotal;
                    asset.CurrentValue = newGrandTotal;
                    asset.UpdatedAt = DateTime.UtcNow;
                    asset.UpdatedBy = currentUser;
                }
            }

            // 6. Timeline and audit log entry
            var detailsString = $"Updated purchase {purchase.PurchaseNo}. Total: ₹{newGrandTotal:N2}.";
            if (changesList.Any())
            {
                detailsString += " Changes: " + string.Join(", ", changesList);
            }

            var timelineEvent = new PurchaseTimelineEvent
            {
                Id = Guid.NewGuid(),
                PurchaseId = purchase.Id,
                EventDate = DateTime.UtcNow,
                Action = "Purchase Updated",
                PerformedBy = currentUser,
                Details = detailsString
            };
            _context.PurchaseTimelineEvents.Add(timelineEvent);
            purchase.TimelineEvents.Add(timelineEvent);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateConcurrencyException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogCritical("DbUpdateConcurrencyException Caught inside UpdatePurchaseAsync!");
                foreach (var entry in ex.Entries)
                {
                    _logger.LogCritical("Concurrency Failure - Entity: {Entity}, State: {State}",
                        entry.Entity.GetType().Name, entry.State);

                    foreach (var p in entry.Properties)
                    {
                        _logger.LogCritical("  Property: {Property} = {Value}", p.Metadata.Name, p.CurrentValue);
                    }
                }
                throw;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Transaction failed and rolled back during Purchase Update");
                throw;
            }

            return await GetPurchaseByIdAsync(id);
        }

        public async Task<bool> CancelPurchaseAsync(Guid id)
        {
            var purchase = await _context.Purchases
                .Include(p => p.Items)
                .Include(p => p.TimelineEvents)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (purchase == null || purchase.IsCancelled) return false;

            var currentUser = _currentUserContext.Email ?? "Company Administrator";

            purchase.IsCancelled = true;
            purchase.CancelledAt = DateTime.UtcNow;
            purchase.CancelledBy = currentUser;
            purchase.PaymentStatus = "Cancelled";

            if (purchase.VendorId.HasValue && purchase.BalanceAmount > 0)
            {
                var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == purchase.VendorId.Value);
                if (vendor != null)
                {
                    vendor.CurrentBalance = Math.Max(0, vendor.CurrentBalance - purchase.BalanceAmount);
                }
            }

            if (purchase.PurchaseCategory == "RawMaterial" && purchase.Items.Any())
            {
                foreach (var item in purchase.Items)
                {
                    if (item.RawMaterialId.HasValue)
                    {
                        var rm = await _context.RawMaterials.FirstOrDefaultAsync(r => r.Id == item.RawMaterialId.Value);
                        if (rm != null)
                        {
                            rm.CurrentStock = Math.Max(0, rm.CurrentStock - item.Quantity);
                            _context.InventoryMovements.Add(new InventoryMovement
                            {
                                Id = Guid.NewGuid(),
                                TenantId = purchase.TenantId,
                                CompanyId = purchase.CompanyId,
                                RawMaterialId = rm.Id,
                                InventoryType = "RawMaterial",
                                ReferenceType = "PURCHASE_CANCEL",
                                ReferenceId = purchase.Id,
                                Quantity = -item.Quantity,
                                Notes = $"Reversal for cancelled purchase {purchase.PurchaseNo}",
                                BalanceAfter = rm.CurrentStock,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = currentUser
                            });
                        }
                    }
                }
            }

            var timelineEvent = new PurchaseTimelineEvent
            {
                Id = Guid.NewGuid(),
                PurchaseId = purchase.Id,
                EventDate = DateTime.UtcNow,
                Action = "Purchase Cancelled",
                PerformedBy = currentUser,
                Details = $"Cancelled purchase {purchase.PurchaseNo}. Reversed vendor balance and inventory movement."
            };
            _context.PurchaseTimelineEvents.Add(timelineEvent);
            purchase.TimelineEvents.Add(timelineEvent);

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<CreatePurchaseRequest?> DuplicatePurchaseAsync(Guid id)
        {
            var p = await GetPurchaseByIdAsync(id);
            if (p == null) return null;

            return new CreatePurchaseRequest
            {
                PurchaseDate = DateTime.UtcNow,
                VendorId = p.VendorId,
                VendorName = p.VendorName,
                PurchaseCategory = p.PurchaseCategory,
                InvoiceNumber = $"COPY-{p.InvoiceNumber}",
                ReferenceNumber = p.ReferenceNumber,
                PaymentMethod = "Credit",
                SubTotal = p.SubTotal,
                TaxAmount = p.TaxAmount,
                DiscountAmount = p.DiscountAmount,
                OtherCharges = p.OtherCharges,
                GrandTotal = p.GrandTotal,
                AmountPaid = 0,
                Notes = $"Duplicate of purchase {p.PurchaseNo}. {p.Notes}",
                CategoryMetadataJson = p.CategoryMetadataJson,
                Items = p.Items.Select(i => new CreatePurchaseItemRequest
                {
                    RawMaterialId = i.RawMaterialId,
                    ItemName = i.ItemName,
                    Quantity = i.Quantity,
                    Unit = i.Unit,
                    UnitPrice = i.UnitPrice,
                    GSTPercent = i.GSTPercent,
                    DiscountAmount = i.DiscountAmount,
                    TotalAmount = i.TotalAmount
                }).ToList()
            };
        }

        public async Task<bool> DeletePurchaseAsync(Guid id)
        {
            var purchase = await _context.Purchases
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (purchase == null) return false;

            var currentUser = _currentUserContext.Email ?? "Company Administrator";

            purchase.IsDeleted = true;
            purchase.DeletedAt = DateTime.UtcNow;
            purchase.DeletedBy = currentUser;

            if (purchase.PurchaseCategory == "RawMaterial" && purchase.Items.Any())
            {
                foreach (var item in purchase.Items)
                {
                    if (item.RawMaterialId.HasValue)
                    {
                        var rm = await _context.RawMaterials.FirstOrDefaultAsync(r => r.Id == item.RawMaterialId.Value);
                        if (rm != null)
                        {
                            rm.CurrentStock = Math.Max(0, rm.CurrentStock - item.Quantity);
                            _context.InventoryMovements.Add(new InventoryMovement
                            {
                                Id = Guid.NewGuid(),
                                TenantId = purchase.TenantId,
                                CompanyId = purchase.CompanyId,
                                RawMaterialId = rm.Id,
                                InventoryType = "RawMaterial",
                                ReferenceType = "PURCHASE_DELETE",
                                ReferenceId = purchase.Id,
                                Quantity = -item.Quantity,
                                Notes = $"Reversal due to purchase deletion {purchase.PurchaseNo}",
                                BalanceAfter = rm.CurrentStock,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = currentUser
                            });
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<PurchaseDto?> AddPaymentAsync(Guid purchaseId, AddPurchasePaymentRequest request)
        {
            var purchase = await _context.Purchases
                .Include(p => p.Payments)
                .Include(p => p.TimelineEvents)
                .FirstOrDefaultAsync(p => p.Id == purchaseId && !p.IsDeleted);

            if (purchase == null) return null;

            if (request.Amount <= 0)
            {
                throw new ArgumentException("Payment amount must be greater than zero.");
            }

            var currentUser = _currentUserContext.Email ?? "Company Administrator";
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();

            var paymentAmount = Math.Round(request.Amount, 2);
            purchase.AmountPaid = Math.Round(purchase.AmountPaid + paymentAmount, 2);
            if (purchase.AmountPaid > purchase.GrandTotal) purchase.AmountPaid = purchase.GrandTotal;
            purchase.BalanceAmount = Math.Round(purchase.GrandTotal - purchase.AmountPaid, 2);

            if (purchase.AmountPaid >= purchase.GrandTotal) purchase.PaymentStatus = "Paid";
            else purchase.PaymentStatus = "PartiallyPaid";

            var payment = new PurchasePayment
            {
                Id = Guid.NewGuid(),
                PurchaseId = purchase.Id,
                PaymentDate = request.PaymentDate.ToUniversalTime(),
                PaymentMethod = request.PaymentMethod,
                BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null,
                CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null,
                Amount = paymentAmount,
                ReferenceNo = request.ReferenceNo,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUser
            };
            _context.PurchasePayments.Add(payment);
            purchase.Payments.Add(payment);

            if (request.PaymentMethod == "BankAccount" && request.BankAccountId.HasValue)
            {
                var bank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value);
                if (bank != null)
                {
                    bank.CurrentBalance -= paymentAmount;
                    _context.BankLedgerEntries.Add(new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankAccountId = bank.Id,
                        LedgerAccountType = "BankAccount",
                        TransactionDate = DateTime.UtcNow,
                        ReferenceNumber = purchase.PurchaseNo,
                        TransactionType = "Debit",
                        Description = $"Subsequent purchase payment for {purchase.PurchaseNo} ({purchase.VendorName})",
                        Debit = paymentAmount,
                        Credit = 0,
                        RunningBalance = bank.CurrentBalance,
                        RelatedEntityId = purchase.Id,
                        RelatedEntityType = "Purchase",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    });
                }
            }
            else if (request.PaymentMethod == "Cash" && request.CashBookId.HasValue)
            {
                var cash = await _context.CashBooks.FirstOrDefaultAsync(c => c.Id == request.CashBookId.Value);
                if (cash != null)
                {
                    cash.CurrentBalance -= paymentAmount;
                    _context.BankLedgerEntries.Add(new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        CashBookId = cash.Id,
                        LedgerAccountType = "CashBook",
                        TransactionDate = DateTime.UtcNow,
                        ReferenceNumber = purchase.PurchaseNo,
                        TransactionType = "Debit",
                        Description = $"Subsequent cash purchase payment for {purchase.PurchaseNo} ({purchase.VendorName})",
                        Debit = paymentAmount,
                        Credit = 0,
                        RunningBalance = cash.CurrentBalance,
                        RelatedEntityId = purchase.Id,
                        RelatedEntityType = "Purchase",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    });
                }
            }

            if (purchase.VendorId.HasValue)
            {
                var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == purchase.VendorId.Value);
                if (vendor != null)
                {
                    vendor.CurrentBalance = Math.Max(0, vendor.CurrentBalance - paymentAmount);
                }
            }

            var timelineEvent = new PurchaseTimelineEvent
            {
                Id = Guid.NewGuid(),
                PurchaseId = purchase.Id,
                EventDate = DateTime.UtcNow,
                Action = "Payment Received",
                PerformedBy = currentUser,
                Details = $"Recorded payment of ₹{paymentAmount:N2} via {request.PaymentMethod}. Remaining balance: ₹{purchase.BalanceAmount:N2}"
            };
            _context.PurchaseTimelineEvents.Add(timelineEvent);
            purchase.TimelineEvents.Add(timelineEvent);

            await _context.SaveChangesAsync();
            return await GetPurchaseByIdAsync(purchaseId);
        }

        public async Task<List<AssetHistoryDto>> GetAssetHistoryAsync(Guid assetId)
        {
            var histories = await _context.AssetHistories
                .Where(h => h.AssetId == assetId)
                .OrderByDescending(h => h.Date)
                .ToListAsync();

            var resolveName = await GetUserResolverAsync(histories.Select(h => h.PerformedBy));

            return histories.Select(h => new AssetHistoryDto
            {
                Id = h.Id,
                AssetId = h.AssetId,
                Date = h.Date,
                Action = h.Action,
                PerformedBy = h.PerformedBy,
                PerformedByName = resolveName(h.PerformedBy),
                PreviousValue = h.PreviousValue,
                NewValue = h.NewValue,
                Remarks = h.Remarks
            }).ToList();
        }

        private async Task<Func<string?, string>> GetUserResolverAsync(IEnumerable<string?> userIdentities)
        {
            var userEmails = new HashSet<string>(userIdentities.Where(x => !string.IsNullOrWhiteSpace(x))!, StringComparer.OrdinalIgnoreCase);
            var userMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            if (userEmails.Any())
            {
                var users = await _context.Users
                    .Where(u => (u.Email != null && userEmails.Contains(u.Email)) || (u.Username != null && userEmails.Contains(u.Username)))
                    .ToListAsync();
                foreach (var u in users)
                {
                    var fullName = $"{u.FirstName} {u.LastName}".Trim();
                    var displayName = string.IsNullOrWhiteSpace(fullName) ? (u.Username ?? u.Email) : fullName;
                    if (!string.IsNullOrEmpty(u.Email)) userMap[u.Email] = displayName;
                    if (!string.IsNullOrEmpty(u.Username)) userMap[u.Username] = displayName;
                }
            }

            return (identity) =>
            {
                if (string.IsNullOrWhiteSpace(identity)) return "Unknown User";
                if (userMap.TryGetValue(identity, out var disp)) return disp;
                if (identity.Contains("@"))
                {
                    var local = identity.Split('@')[0];
                    var parts = local.Split(new[] { '.', '_', '-' }, StringSplitOptions.RemoveEmptyEntries);
                    return string.Join(" ", parts.Select(pt => pt.Length > 0 ? char.ToUpper(pt[0]) + pt.Substring(1).ToLower() : ""));
                }
                return identity;
            };
        }

        private PurchaseDto MapToDto(Purchase p, Func<string?, string> resolveName)
        {
            return new PurchaseDto
            {
                Id = p.Id,
                PurchaseNo = p.PurchaseNo,
                PurchaseDate = p.PurchaseDate,
                VendorId = p.VendorId,
                VendorName = p.VendorName,
                VendorCode = p.Vendor?.VendorCode ?? (p.VendorId.HasValue ? $"VND-{p.VendorId.Value.ToString().Substring(0, 4).ToUpper()}" : null),
                PurchaseCategory = p.PurchaseCategory,
                InvoiceNumber = p.InvoiceNumber,
                ReferenceNumber = p.ReferenceNumber,
                PaymentMethod = p.PaymentMethod,
                BankAccountId = p.BankAccountId,
                BankAccountName = p.BankAccount?.BankName,
                CashBookId = p.CashBookId,
                CashBookName = p.CashBook?.Name,
                SubTotal = p.SubTotal,
                TaxAmount = p.TaxAmount,
                DiscountAmount = p.DiscountAmount,
                OtherCharges = p.OtherCharges,
                GrandTotal = p.GrandTotal,
                AmountPaid = p.AmountPaid,
                BalanceAmount = p.BalanceAmount,
                PaymentStatus = p.IsCancelled ? "Cancelled" : p.PaymentStatus,
                IsCancelled = p.IsCancelled,
                CancelledAt = p.CancelledAt,
                CancelledByName = p.CancelledBy != null ? resolveName(p.CancelledBy) : null,
                Notes = p.Notes,
                AttachmentUrl = p.AttachmentUrl,
                AssetId = p.AssetId,
                AssetName = p.Asset?.AssetName,
                CategoryMetadataJson = p.CategoryMetadataJson,
                CreatedAt = p.CreatedAt,
                CreatedBy = p.CreatedBy,
                CreatedByName = resolveName(p.CreatedBy),
                UpdatedAt = p.UpdatedAt,
                UpdatedByName = p.UpdatedBy != null ? resolveName(p.UpdatedBy) : null
            };
        }
    }
}
