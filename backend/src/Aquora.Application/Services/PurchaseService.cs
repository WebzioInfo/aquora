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

            var categoryConfig = await ResolveCategoryConfigAsync(request.PurchaseCategory);
            var treatment = categoryConfig.Treatment;

            // Category requirement validations
            if (categoryConfig.RequireVendor && (!request.VendorId.HasValue || request.VendorId.Value == Guid.Empty) && string.IsNullOrWhiteSpace(request.VendorName))
            {
                throw new ArgumentException("Vendor is required for this purchase category.");
            }

            if (categoryConfig.RequireInvoiceNumber && string.IsNullOrWhiteSpace(request.InvoiceNumber))
            {
                throw new ArgumentException("Invoice Number is required for this purchase category.");
            }

            if (treatment == "Inventory" && (request.Items == null || !request.Items.Any(i => i.Quantity > 0)))
            {
                throw new ArgumentException("Please add at least one purchase item for inventory purchases.");
            }

            if (categoryConfig.RequireAssetDetails && string.IsNullOrWhiteSpace(request.CategoryMetadataJson))
            {
                throw new ArgumentException("Asset details are required for this category.");
            }

            // Centralized calculation engine
            var effectiveSubTotal = request.SubTotal > 0 
                ? request.SubTotal 
                : (request.GrandTotal > 0 ? request.GrandTotal : 0m);

            var calc = CalculatePurchaseTotals(
                subTotal: effectiveSubTotal,
                discountAmount: request.DiscountAmount,
                otherCharges: request.OtherCharges,
                taxMode: request.TaxMode,
                gstRate: request.GSTRate,
                isInclusiveTax: request.IsInclusiveTax,
                isGstOverridden: request.IsGstOverridden,
                manualTaxAmount: request.TaxAmount,
                isInterState: request.IsInterState,
                amountPaid: request.AmountPaid,
                paymentMethod: request.PaymentMethod
            );

            if (calc.GrandTotal < 0)
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
            var grandTotal = calc.GrandTotal;
            var amountPaid = calc.AmountPaid;
            var balanceAmount = calc.BalanceAmount;
            var status = calc.PaymentStatus;

            var purchase = new Purchase
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                PurchaseNo = purchaseNo,
                PurchaseDate = request.PurchaseDate.ToUniversalTime(),
                VendorId = vendorId,
                VendorName = vendorName,
                PurchaseCategory = categoryConfig.Code,
                InvoiceNumber = request.InvoiceNumber?.Trim(),
                ReferenceNumber = request.ReferenceNumber?.Trim(),
                PaymentMethod = request.PaymentMethod,
                BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null,
                CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null,
                SubTotal = calc.SubTotal,
                TaxAmount = calc.FinalGst,
                DiscountAmount = calc.DiscountAmount,
                OtherCharges = calc.OtherCharges,
                TaxMode = calc.TaxMode,
                GSTRate = calc.GSTRate,
                TaxableAmount = calc.TaxableAmount,
                CGSTAmount = calc.CGSTAmount,
                SGSTAmount = calc.SGSTAmount,
                IGSTAmount = calc.IGSTAmount,
                IsGstOverridden = calc.IsGstOverridden,
                IsInclusiveTax = calc.IsInclusiveTax,
                IsInterState = request.IsInterState,
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
                var initialPayment = new PurchasePayment
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
                };
                purchase.Payments.Add(initialPayment);

                if (request.PaymentMethod == "BankAccount" && request.BankAccountId.HasValue)
                {
                    var bank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value);
                    if (bank != null)
                    {
                        bank.CurrentBalance -= amountPaid;
                        var bEntry = new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankAccountId = bank.Id,
                            LedgerAccountType = "BankAccount",
                            TransactionDate = initialPayment.PaymentDate,
                            ReferenceNumber = purchaseNo,
                            TransactionType = "Purchase Payment",
                            EventType = "CREATED",
                            EventLabel = "Purchase Payment",
                            Description = $"Purchase payment to {vendorName} ({request.PurchaseCategory})",
                            Debit = amountPaid,
                            Credit = 0,
                            RunningBalance = bank.CurrentBalance,
                            RelatedEntityId = initialPayment.Id,
                            RelatedEntityType = "PurchasePayment",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = currentUser
                        };
                        _context.BankLedgerEntries.Add(bEntry);

                        _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankLedgerEntryId = bEntry.Id,
                            Action = "Created",
                            OldAmount = 0m,
                            NewAmount = amountPaid,
                            Remarks = $"Initial payment recorded for purchase {purchaseNo}",
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
                        var cEntry = new BankLedgerEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            CashBookId = cash.Id,
                            LedgerAccountType = "CashBook",
                            TransactionDate = initialPayment.PaymentDate,
                            ReferenceNumber = purchaseNo,
                            TransactionType = "Purchase Payment",
                            EventType = "CREATED",
                            EventLabel = "Purchase Payment",
                            Description = $"Cash purchase payment to {vendorName} ({request.PurchaseCategory})",
                            Debit = amountPaid,
                            Credit = 0,
                            RunningBalance = cash.CurrentBalance,
                            RelatedEntityId = initialPayment.Id,
                            RelatedEntityType = "PurchasePayment",
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = currentUser
                        };
                        _context.BankLedgerEntries.Add(cEntry);

                        _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId,
                            CompanyId = companyId,
                            BankLedgerEntryId = cEntry.Id,
                            Action = "Created",
                            OldAmount = 0m,
                            NewAmount = amountPaid,
                            Remarks = $"Initial cash payment recorded for purchase {purchaseNo}",
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

            if (treatment == "Inventory" && purchase.Items.Any())
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
            else if (treatment == "Asset")
            {
                string assetName = $"{request.PurchaseCategory} - {vendorName}";
                string categoryType = request.PurchaseCategory == "Machine" ? "Machine" : (request.PurchaseCategory == "OfficeAsset" ? "OfficeAsset" : "Other");
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

            var categoryConfig = await ResolveCategoryConfigAsync(request.PurchaseCategory);
            var treatment = categoryConfig.Treatment;

            // Category requirement validations
            if (categoryConfig.RequireInvoiceNumber && string.IsNullOrWhiteSpace(request.InvoiceNumber))
            {
                throw new ArgumentException("Invoice Number is required for this purchase category.");
            }

            if (treatment == "Inventory" && (request.Items == null || !request.Items.Any(i => i.Quantity > 0)))
            {
                throw new ArgumentException("Please add at least one purchase item for inventory purchases.");
            }

            if (categoryConfig.RequireAssetDetails && string.IsNullOrWhiteSpace(request.CategoryMetadataJson))
            {
                throw new ArgumentException("Asset details are required for this category.");
            }

            // Centralized calculation engine
            var effectiveSubTotal = request.SubTotal > 0 
                ? request.SubTotal 
                : (request.GrandTotal > 0 ? request.GrandTotal : 0m);

            var calc = CalculatePurchaseTotals(
                subTotal: effectiveSubTotal,
                discountAmount: request.DiscountAmount,
                otherCharges: request.OtherCharges,
                taxMode: request.TaxMode,
                gstRate: request.GSTRate,
                isInclusiveTax: request.IsInclusiveTax,
                isGstOverridden: request.IsGstOverridden,
                manualTaxAmount: request.TaxAmount,
                isInterState: request.IsInterState,
                amountPaid: request.AmountPaid,
                paymentMethod: request.PaymentMethod
            );

            if (calc.GrandTotal <= 0 && calc.SubTotal <= 0)
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

            var newGrandTotal = calc.GrandTotal;
            if (purchase.AssetId.HasValue && newGrandTotal != oldGrandTotal)
                throw new ArgumentException("This purchase is linked to a registered asset. Its acquisition amount cannot be overwritten through purchase editing.");
            var newAmountPaid = calc.AmountPaid;
            var newBalanceAmount = calc.BalanceAmount;
            var newStatus = calc.PaymentStatus;

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

            purchase.PurchaseCategory = categoryConfig.Code;
            purchase.InvoiceNumber = request.InvoiceNumber?.Trim();
            purchase.ReferenceNumber = request.ReferenceNumber?.Trim();
            purchase.PaymentMethod = request.PaymentMethod;
            purchase.BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null;
            purchase.CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null;
            purchase.SubTotal = calc.SubTotal;
            purchase.TaxAmount = calc.FinalGst;
            purchase.DiscountAmount = calc.DiscountAmount;
            purchase.OtherCharges = calc.OtherCharges;
            purchase.TaxMode = calc.TaxMode;
            purchase.GSTRate = calc.GSTRate;
            purchase.TaxableAmount = calc.TaxableAmount;
            purchase.CGSTAmount = calc.CGSTAmount;
            purchase.SGSTAmount = calc.SGSTAmount;
            purchase.IGSTAmount = calc.IGSTAmount;
            purchase.IsGstOverridden = calc.IsGstOverridden;
            purchase.IsInclusiveTax = calc.IsInclusiveTax;
            purchase.IsInterState = request.IsInterState;
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
            if (treatment == "Inventory")
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
                    if (!purchase.Payments.Any(p => p.Id == initialPayment.Id))
                    {
                        purchase.Payments.Add(initialPayment);
                    }
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

            // Acquisition amounts on a registered asset are immutable in this general purchase edit.
            // In particular, payment or note edits must never reset depreciation/book value.

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

            var cancelTreatment = await ResolveCategoryTreatmentAsync(purchase.PurchaseCategory);
            if (cancelTreatment == "Inventory" && purchase.Items.Any())
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

            var deleteTreatment = await ResolveCategoryTreatmentAsync(purchase.PurchaseCategory);
            if (deleteTreatment == "Inventory" && purchase.Items.Any())
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
            if (!purchase.Payments.Any(p => p.Id == payment.Id))
            {
                purchase.Payments.Add(payment);
            }

            if (request.PaymentMethod == "BankAccount" && request.BankAccountId.HasValue)
            {
                var bank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value);
                if (bank != null)
                {
                    bank.CurrentBalance -= paymentAmount;
                    var bEntry = new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankAccountId = bank.Id,
                        LedgerAccountType = "BankAccount",
                        TransactionDate = payment.PaymentDate,
                        ReferenceNumber = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? request.ReferenceNo.Trim() : purchase.PurchaseNo,
                        TransactionType = "Purchase Payment",
                        EventType = "CREATED",
                        EventLabel = "Purchase Payment",
                        Description = $"Purchase payment for {purchase.PurchaseNo} ({purchase.VendorName})",
                        Debit = paymentAmount,
                        Credit = 0,
                        RunningBalance = bank.CurrentBalance,
                        RelatedEntityId = payment.Id,
                        RelatedEntityType = "PurchasePayment",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    };
                    _context.BankLedgerEntries.Add(bEntry);

                    _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankLedgerEntryId = bEntry.Id,
                        Action = "Created",
                        OldAmount = 0m,
                        NewAmount = paymentAmount,
                        Remarks = $"Purchase payment recorded for {purchase.PurchaseNo}",
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
                    var cEntry = new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        CashBookId = cash.Id,
                        LedgerAccountType = "CashBook",
                        TransactionDate = payment.PaymentDate,
                        ReferenceNumber = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? request.ReferenceNo.Trim() : purchase.PurchaseNo,
                        TransactionType = "Purchase Payment",
                        EventType = "CREATED",
                        EventLabel = "Purchase Payment",
                        Description = $"Cash purchase payment for {purchase.PurchaseNo} ({purchase.VendorName})",
                        Debit = paymentAmount,
                        Credit = 0,
                        RunningBalance = cash.CurrentBalance,
                        RelatedEntityId = payment.Id,
                        RelatedEntityType = "PurchasePayment",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    };
                    _context.BankLedgerEntries.Add(cEntry);

                    _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankLedgerEntryId = cEntry.Id,
                        Action = "Created",
                        OldAmount = 0m,
                        NewAmount = paymentAmount,
                        Remarks = $"Cash purchase payment recorded for {purchase.PurchaseNo}",
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

        public async Task<PurchasePaymentDto?> GetPaymentByIdAsync(Guid purchaseId, Guid paymentId)
        {
            var p = await _context.Purchases
                .Include(x => x.Payments)
                    .ThenInclude(pay => pay.BankAccount)
                .Include(x => x.Payments)
                    .ThenInclude(pay => pay.CashBook)
                .FirstOrDefaultAsync(x => x.Id == purchaseId && !x.IsDeleted);

            if (p == null) return null;
            var pay = p.Payments.FirstOrDefault(x => x.Id == paymentId);
            if (pay == null) return null;

            var resolveName = await GetUserResolverAsync(new[] { pay.CreatedBy });
            return new PurchasePaymentDto
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
            };
        }

        public async Task<PurchaseDto?> UpdatePaymentAsync(Guid purchaseId, Guid paymentId, UpdatePurchasePaymentRequest request)
        {
            if (request.Amount <= 0)
            {
                throw new ArgumentException("Payment amount must be greater than zero.");
            }

            if (string.IsNullOrWhiteSpace(request.PaymentMethod))
            {
                throw new ArgumentException("Payment method is required.");
            }

            if (request.PaymentMethod == "BankAccount")
            {
                if (!request.BankAccountId.HasValue || request.BankAccountId.Value == Guid.Empty)
                {
                    throw new ArgumentException("Please select a bank account.");
                }
                var bankExists = await _context.BankAccounts.AnyAsync(b => b.Id == request.BankAccountId.Value && !b.IsDeleted);
                if (!bankExists)
                {
                    throw new ArgumentException("Selected bank account was not found or is inactive.");
                }
            }
            else if (request.PaymentMethod == "Cash")
            {
                if (!request.CashBookId.HasValue || request.CashBookId.Value == Guid.Empty)
                {
                    throw new ArgumentException("Please select a cash book.");
                }
                var cashExists = await _context.CashBooks.AnyAsync(c => c.Id == request.CashBookId.Value && !c.IsDeleted);
                if (!cashExists)
                {
                    throw new ArgumentException("Selected cash book was not found or is inactive.");
                }
            }

            var dbContext = _context as DbContext;
            if (dbContext == null) throw new InvalidOperationException("Could not cast context to DbContext");

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var currentUser = _currentUserContext.Email ?? "Company Administrator";

            using var transaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var purchase = await _context.Purchases
                    .Include(p => p.Payments)
                    .Include(p => p.TimelineEvents)
                    .Include(p => p.Vendor)
                    .FirstOrDefaultAsync(p => p.Id == purchaseId && !p.IsDeleted);

                if (purchase == null) return null;

                if (purchase.IsCancelled)
                {
                    throw new InvalidOperationException("Cannot modify payments on a cancelled purchase.");
                }

                var payment = purchase.Payments.FirstOrDefault(p => p.Id == paymentId);
                if (payment == null)
                {
                    return null;
                }

                var oldAmount = payment.Amount;
                var newAmount = Math.Round(request.Amount, 2);
                var amountDelta = newAmount - oldAmount;

                var oldMethod = payment.PaymentMethod;
                var oldBankAccountId = payment.BankAccountId;
                var oldCashBookId = payment.CashBookId;
                var oldDate = payment.PaymentDate;
                var newDate = request.PaymentDate.ToUniversalTime();

                // 1. Update Payment record
                payment.Amount = newAmount;
                payment.PaymentDate = newDate;
                payment.PaymentMethod = request.PaymentMethod;
                payment.BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null;
                payment.CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null;
                payment.ReferenceNo = request.ReferenceNo?.Trim();
                payment.Notes = request.Notes?.Trim();

                // 2. Recalculate Purchase totals
                var totalPaid = Math.Round(purchase.Payments.Sum(p => p.Amount), 2);
                purchase.AmountPaid = totalPaid;
                purchase.BalanceAmount = Math.Round(Math.Max(0m, purchase.GrandTotal - purchase.AmountPaid), 2);

                if (purchase.AmountPaid >= purchase.GrandTotal) purchase.PaymentStatus = "Paid";
                else if (purchase.AmountPaid > 0) purchase.PaymentStatus = "PartiallyPaid";
                else purchase.PaymentStatus = "Unpaid";

                purchase.UpdatedAt = DateTime.UtcNow;
                purchase.UpdatedBy = currentUser;

                // Sync purchase-level payment method if this is the primary payment
                var primaryPayment = purchase.Payments.OrderBy(p => p.CreatedAt).FirstOrDefault();
                if (primaryPayment != null)
                {
                    purchase.PaymentMethod = primaryPayment.PaymentMethod;
                    purchase.BankAccountId = primaryPayment.BankAccountId;
                    purchase.CashBookId = primaryPayment.CashBookId;
                }

                // 3. Adjust Vendor Payable Balance
                if (purchase.VendorId.HasValue && amountDelta != 0)
                {
                    var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == purchase.VendorId.Value && !v.IsDeleted);
                    if (vendor != null)
                    {
                        vendor.CurrentBalance = Math.Max(0m, vendor.CurrentBalance - amountDelta);
                    }
                }

                // 4. Update / Sync BankLedgerEntry
                var ledgerEntry = await _context.BankLedgerEntries
                    .FirstOrDefaultAsync(e => e.TenantId == tenantId &&
                        ((e.RelatedEntityId == payment.Id && e.RelatedEntityType == "PurchasePayment") ||
                         (e.RelatedEntityId == purchase.Id && e.RelatedEntityType == "Purchase" && e.Debit == oldAmount &&
                          (e.BankAccountId == oldBankAccountId || e.CashBookId == oldCashBookId))));

                if (ledgerEntry != null)
                {
                    ledgerEntry.RelatedEntityId = payment.Id;
                    ledgerEntry.RelatedEntityType = "PurchasePayment";
                    ledgerEntry.TransactionDate = newDate;
                    ledgerEntry.ReferenceNumber = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? request.ReferenceNo.Trim() : purchase.PurchaseNo;
                    ledgerEntry.TransactionType = "Purchase Payment";
                    ledgerEntry.EventType = "UPDATED";
                    ledgerEntry.EventLabel = "Purchase Payment Updated";
                    ledgerEntry.AuditNotes = $"Payment edited: amount changed from ₹{oldAmount:N2} to ₹{newAmount:N2}, method: {request.PaymentMethod}.";
                    ledgerEntry.Debit = newAmount;
                    ledgerEntry.Credit = 0m;
                    ledgerEntry.UpdatedAt = DateTime.UtcNow;
                    ledgerEntry.UpdatedBy = currentUser;

                    if (request.PaymentMethod == "BankAccount")
                    {
                        ledgerEntry.LedgerAccountType = "BankAccount";
                        ledgerEntry.BankAccountId = request.BankAccountId;
                        ledgerEntry.CashBookId = null;
                        ledgerEntry.Description = $"Purchase payment to {purchase.VendorName} ({purchase.PurchaseCategory}) - Updated";
                    }
                    else
                    {
                        ledgerEntry.LedgerAccountType = "CashBook";
                        ledgerEntry.BankAccountId = null;
                        ledgerEntry.CashBookId = request.CashBookId;
                        ledgerEntry.Description = $"Cash purchase payment to {purchase.VendorName} ({purchase.PurchaseCategory}) - Updated";
                    }

                    _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankLedgerEntryId = ledgerEntry.Id,
                        Action = "Updated",
                        OldAmount = oldAmount,
                        NewAmount = newAmount,
                        Remarks = $"Purchase payment edited on purchase {purchase.PurchaseNo}. Notes: {request.Notes}",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    });
                }
                else
                {
                    // Fallback create if entry did not exist
                    var newEntry = new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankAccountId = request.PaymentMethod == "BankAccount" ? request.BankAccountId : null,
                        CashBookId = request.PaymentMethod == "Cash" ? request.CashBookId : null,
                        LedgerAccountType = request.PaymentMethod == "BankAccount" ? "BankAccount" : "CashBook",
                        TransactionDate = newDate,
                        ReferenceNumber = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? request.ReferenceNo.Trim() : purchase.PurchaseNo,
                        TransactionType = "Purchase Payment",
                        EventType = "CREATED",
                        EventLabel = "Purchase Payment",
                        Description = request.PaymentMethod == "BankAccount"
                            ? $"Purchase payment to {purchase.VendorName} ({purchase.PurchaseCategory})"
                            : $"Cash purchase payment to {purchase.VendorName} ({purchase.PurchaseCategory})",
                        Debit = newAmount,
                        Credit = 0m,
                        RunningBalance = 0m,
                        RelatedEntityId = payment.Id,
                        RelatedEntityType = "PurchasePayment",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    };
                    _context.BankLedgerEntries.Add(newEntry);

                    _context.BankLedgerAuditEntries.Add(new BankLedgerAuditEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankLedgerEntryId = newEntry.Id,
                        Action = "Created",
                        OldAmount = 0m,
                        NewAmount = newAmount,
                        Remarks = $"Purchase payment entry created for {purchase.PurchaseNo}",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = currentUser
                    });
                }

                // 5. Timeline Event
                var auditDetails = $"Updated payment of ₹{oldAmount:N2} -> ₹{newAmount:N2} via {request.PaymentMethod}. Remaining purchase balance: ₹{purchase.BalanceAmount:N2}";
                if (oldMethod != request.PaymentMethod)
                {
                    auditDetails += $" (Method changed from {oldMethod} to {request.PaymentMethod})";
                }
                var timelineEvent = new PurchaseTimelineEvent
                {
                    Id = Guid.NewGuid(),
                    PurchaseId = purchase.Id,
                    EventDate = DateTime.UtcNow,
                    Action = "Payment Updated",
                    PerformedBy = currentUser,
                    Details = auditDetails
                };
                _context.PurchaseTimelineEvents.Add(timelineEvent);
                purchase.TimelineEvents.Add(timelineEvent);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Transaction failed and rolled back during payment update for purchase {PurchaseId}", purchaseId);
                throw;
            }

            return await GetPurchaseByIdAsync(purchaseId);
        }

        public async Task<PurchaseDto?> DeletePaymentAsync(Guid purchaseId, Guid paymentId)
        {
            var dbContext = _context as DbContext;
            if (dbContext == null) throw new InvalidOperationException("Could not cast context to DbContext");

            var tenantId = GetTenantId();
            var currentUser = _currentUserContext.Email ?? "Company Administrator";

            using var transaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var purchase = await _context.Purchases
                    .Include(p => p.Payments)
                    .Include(p => p.TimelineEvents)
                    .Include(p => p.Vendor)
                    .FirstOrDefaultAsync(p => p.Id == purchaseId && !p.IsDeleted);

                if (purchase == null) return null;

                if (purchase.IsCancelled)
                {
                    throw new InvalidOperationException("Cannot modify payments on a cancelled purchase.");
                }

                var payment = purchase.Payments.FirstOrDefault(p => p.Id == paymentId);
                if (payment == null)
                {
                    return null;
                }

                var amount = payment.Amount;
                var method = payment.PaymentMethod;
                var bankAccountId = payment.BankAccountId;
                var cashBookId = payment.CashBookId;

                // 1. Remove payment
                _context.PurchasePayments.Remove(payment);
                purchase.Payments.Remove(payment);

                // 2. Recalculate Purchase totals
                var totalPaid = Math.Round(purchase.Payments.Sum(p => p.Amount), 2);
                purchase.AmountPaid = totalPaid;
                purchase.BalanceAmount = Math.Round(Math.Max(0m, purchase.GrandTotal - purchase.AmountPaid), 2);

                if (purchase.AmountPaid >= purchase.GrandTotal) purchase.PaymentStatus = "Paid";
                else if (purchase.AmountPaid > 0) purchase.PaymentStatus = "PartiallyPaid";
                else purchase.PaymentStatus = "Unpaid";

                purchase.UpdatedAt = DateTime.UtcNow;
                purchase.UpdatedBy = currentUser;

                // Sync purchase-level payment method
                var remainingPrimary = purchase.Payments.OrderBy(p => p.CreatedAt).FirstOrDefault();
                if (remainingPrimary != null)
                {
                    purchase.PaymentMethod = remainingPrimary.PaymentMethod;
                    purchase.BankAccountId = remainingPrimary.BankAccountId;
                    purchase.CashBookId = remainingPrimary.CashBookId;
                }
                else
                {
                    purchase.PaymentMethod = "Credit";
                    purchase.BankAccountId = null;
                    purchase.CashBookId = null;
                }

                // 3. Restore Vendor Payable Balance
                if (purchase.VendorId.HasValue && amount > 0)
                {
                    var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == purchase.VendorId.Value && !v.IsDeleted);
                    if (vendor != null)
                    {
                        vendor.CurrentBalance = Math.Max(0m, vendor.CurrentBalance + amount);
                    }
                }

                // 4. Remove matching BankLedgerEntry
                var matchingLedgerEntries = await _context.BankLedgerEntries
                    .Where(e => e.TenantId == tenantId &&
                        ((e.RelatedEntityId == payment.Id && e.RelatedEntityType == "PurchasePayment") ||
                         (e.RelatedEntityId == purchase.Id && e.RelatedEntityType == "Purchase" && e.Debit == amount &&
                          (e.BankAccountId == bankAccountId || e.CashBookId == cashBookId))))
                    .ToListAsync();

                if (matchingLedgerEntries.Any())
                {
                    _context.BankLedgerEntries.RemoveRange(matchingLedgerEntries);
                }

                // 5. Timeline Event
                var timelineEvent = new PurchaseTimelineEvent
                {
                    Id = Guid.NewGuid(),
                    PurchaseId = purchase.Id,
                    EventDate = DateTime.UtcNow,
                    Action = "Payment Deleted",
                    PerformedBy = currentUser,
                    Details = $"Deleted payment of ₹{amount:N2} ({method}). Remaining purchase balance increased to ₹{purchase.BalanceAmount:N2}"
                };
                _context.PurchaseTimelineEvents.Add(timelineEvent);
                purchase.TimelineEvents.Add(timelineEvent);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Transaction failed and rolled back during payment deletion for purchase {PurchaseId}", purchaseId);
                throw;
            }

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
                TaxMode = string.IsNullOrWhiteSpace(p.TaxMode) ? (p.TaxAmount > 0 ? "GST" : "NonGST") : p.TaxMode,
                GSTRate = p.GSTRate,
                TaxableAmount = p.TaxableAmount > 0 ? p.TaxableAmount : Math.Max(0, p.SubTotal - p.DiscountAmount + p.OtherCharges),
                CGSTAmount = p.CGSTAmount > 0 ? p.CGSTAmount : (p.TaxAmount > 0 && p.IGSTAmount == 0 ? Math.Round(p.TaxAmount / 2.0m, 2) : 0m),
                SGSTAmount = p.SGSTAmount > 0 ? p.SGSTAmount : (p.TaxAmount > 0 && p.IGSTAmount == 0 ? p.TaxAmount - Math.Round(p.TaxAmount / 2.0m, 2) : 0m),
                IGSTAmount = p.IGSTAmount,
                IsGstOverridden = p.IsGstOverridden,
                IsInclusiveTax = p.IsInclusiveTax,
                IsInterState = p.IsInterState,
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

        // ==========================================
        // PURCHASE CATEGORY ARCHITECTURE & CALCULATION ENGINE
        // ==========================================

        public record SystemCategoryDefinition(
            string Code,
            string Name,
            string Treatment,
            string Description,
            string? DefaultLedgerAccount,
            bool AffectsInventory,
            bool RequiresAsset,
            bool RequiresExpense,
            bool AffectsVendorLedger,
            bool IsGstApplicable,
            decimal DefaultGstRate,
            bool AllowGstRateChange,
            bool AllowCustomGstRate,
            bool RequireQuantity,
            bool RequireUnit,
            bool RequireItem,
            bool RequireServiceDescription,
            bool RequireAssetDetails,
            bool RequireInvoiceNumber,
            bool RequireVendor,
            bool RequirePaymentDetails
        );

        private static readonly SystemCategoryDefinition[] SystemCategoryDefinitions = new[]
        {
            new SystemCategoryDefinition(
                "RawMaterial",
                "Raw Material (Inventory Stock IN)",
                "Inventory",
                "Materials purchased for water plant operations and bottling production. Automatically creates inventory Stock IN movement.",
                "Raw Materials Inventory",
                AffectsInventory: true,
                RequiresAsset: false,
                RequiresExpense: false,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: true,
                RequireUnit: true,
                RequireItem: true,
                RequireServiceDescription: false,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "Machine",
                "Machine / Equipment (Capital Asset Auto-Create)",
                "Asset",
                "Capital machinery & industrial plant equipment. Automatically provisions a Fixed Asset record.",
                "Plant & Machinery",
                AffectsInventory: false,
                RequiresAsset: true,
                RequiresExpense: false,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: false,
                RequireAssetDetails: true,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "OfficeAsset",
                "Office Asset (Asset Auto-Create)",
                "Asset",
                "Office hardware, computers & furniture. Automatically registers a Fixed Asset record.",
                "Office Equipment",
                AffectsInventory: false,
                RequiresAsset: true,
                RequiresExpense: false,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: true,
                RequireUnit: true,
                RequireItem: false,
                RequireServiceDescription: false,
                RequireAssetDetails: true,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "OfficeExpense",
                "Office Expense",
                "Expense",
                "Day-to-day office consumables and operational administrative expenses.",
                "Office Expenses",
                AffectsInventory: false,
                RequiresAsset: false,
                RequiresExpense: true,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: false,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "Service",
                "Service / Consulting",
                "Expense",
                "Professional fees, technical advisory, audit, and outsourced third-party services.",
                "Professional & Legal Fees",
                AffectsInventory: false,
                RequiresAsset: false,
                RequiresExpense: true,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: true,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "Maintenance",
                "Maintenance & Repair",
                "Expense",
                "Plant machinery servicing, RO membrane cleaning, facility maintenance, and repair expenditure.",
                "Repairs & Maintenance",
                AffectsInventory: false,
                RequiresAsset: false,
                RequiresExpense: true,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: true,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "Utility",
                "Utility Bills",
                "Expense",
                "Power, electricity, municipal water, internet, and telecom billing.",
                "Utilities Expense",
                AffectsInventory: false,
                RequiresAsset: false,
                RequiresExpense: true,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: false,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "Vehicle",
                "Vehicle & Fuel Expense",
                "Expense",
                "Fleet operations, diesel/petrol, delivery vehicle maintenance, and transport expenditure.",
                "Vehicle & Fuel Expenses",
                AffectsInventory: false,
                RequiresAsset: false,
                RequiresExpense: true,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 0.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: false,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "Software",
                "Software & Subscriptions",
                "Expense",
                "Cloud SaaS subscriptions, IT licenses, security tools, and software solutions.",
                "Software & Subscriptions",
                AffectsInventory: false,
                RequiresAsset: false,
                RequiresExpense: true,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: false,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            ),
            new SystemCategoryDefinition(
                "Other",
                "Other Category",
                "Expense",
                "General fallback procurement category for sundry expenses and general procurements.",
                "General Expenses",
                AffectsInventory: false,
                RequiresAsset: false,
                RequiresExpense: true,
                AffectsVendorLedger: true,
                IsGstApplicable: true,
                DefaultGstRate: 18.0m,
                AllowGstRateChange: true,
                AllowCustomGstRate: true,
                RequireQuantity: false,
                RequireUnit: false,
                RequireItem: false,
                RequireServiceDescription: false,
                RequireAssetDetails: false,
                RequireInvoiceNumber: false,
                RequireVendor: true,
                RequirePaymentDetails: true
            )
        };

        public record CategoryResolution(
            string Code,
            string Name,
            string Treatment,
            string? DefaultLedgerAccount,
            bool AffectsInventory,
            bool RequiresAsset,
            bool RequiresExpense,
            bool AffectsVendorLedger,
            bool IsGstApplicable,
            decimal DefaultGstRate,
            bool AllowGstRateChange,
            bool AllowCustomGstRate,
            bool RequireQuantity,
            bool RequireUnit,
            bool RequireItem,
            bool RequireServiceDescription,
            bool RequireAssetDetails,
            bool RequireInvoiceNumber,
            bool RequireVendor,
            bool RequirePaymentDetails
        );

        private async Task<CategoryResolution> ResolveCategoryConfigAsync(string categoryCode)
        {
            if (string.IsNullOrWhiteSpace(categoryCode))
            {
                var def = SystemCategoryDefinitions.First(s => s.Code == "Other");
                return new CategoryResolution(def.Code, def.Name, def.Treatment, def.DefaultLedgerAccount, def.AffectsInventory, def.RequiresAsset, def.RequiresExpense, def.AffectsVendorLedger, def.IsGstApplicable, def.DefaultGstRate, def.AllowGstRateChange, def.AllowCustomGstRate, def.RequireQuantity, def.RequireUnit, def.RequireItem, def.RequireServiceDescription, def.RequireAssetDetails, def.RequireInvoiceNumber, def.RequireVendor, def.RequirePaymentDetails);
            }

            var trimmed = categoryCode.Trim();
            var normalizedTrimmed = System.Text.RegularExpressions.Regex.Replace(trimmed, @"[^a-zA-Z0-9]", "");

            // 1. Check system category definitions
            var sys = SystemCategoryDefinitions.FirstOrDefault(s =>
                string.Equals(s.Code, trimmed, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Name, trimmed, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, normalizedTrimmed, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Code, trimmed.Replace(" ", "").Replace("/", ""), StringComparison.OrdinalIgnoreCase));

            var tenantId = GetTenantId();

            if (sys != null)
            {
                // Check if tenant has stored category record
                var inDb = await _context.PurchaseCategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.TenantId == tenantId && !c.IsDeleted &&
                        (c.Code == sys.Code || c.Name == sys.Name || c.Code == trimmed));

                if (inDb != null)
                {
                    return new CategoryResolution(
                        sys.Code,
                        inDb.Name,
                        !string.IsNullOrWhiteSpace(inDb.Treatment) ? inDb.Treatment : sys.Treatment,
                        inDb.DefaultLedgerAccount ?? sys.DefaultLedgerAccount,
                        inDb.AffectsInventory,
                        inDb.RequiresAsset,
                        inDb.RequiresExpense,
                        inDb.AffectsVendorLedger,
                        inDb.IsGstApplicable,
                        inDb.DefaultGstRate > 0 ? inDb.DefaultGstRate : sys.DefaultGstRate,
                        inDb.AllowGstRateChange,
                        inDb.AllowCustomGstRate,
                        inDb.RequireQuantity,
                        inDb.RequireUnit,
                        inDb.RequireItem,
                        inDb.RequireServiceDescription,
                        inDb.RequireAssetDetails,
                        inDb.RequireInvoiceNumber,
                        inDb.RequireVendor,
                        inDb.RequirePaymentDetails
                    );
                }

                return new CategoryResolution(sys.Code, sys.Name, sys.Treatment, sys.DefaultLedgerAccount, sys.AffectsInventory, sys.RequiresAsset, sys.RequiresExpense, sys.AffectsVendorLedger, sys.IsGstApplicable, sys.DefaultGstRate, sys.AllowGstRateChange, sys.AllowCustomGstRate, sys.RequireQuantity, sys.RequireUnit, sys.RequireItem, sys.RequireServiceDescription, sys.RequireAssetDetails, sys.RequireInvoiceNumber, sys.RequireVendor, sys.RequirePaymentDetails);
            }

            // 2. Custom tenant category from DB
            var customCat = await _context.PurchaseCategories
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && !c.IsDeleted &&
                    (c.Code == trimmed || c.Name == trimmed));

            if (customCat != null)
            {
                return new CategoryResolution(
                    customCat.Code,
                    customCat.Name,
                    customCat.Treatment ?? "Expense",
                    customCat.DefaultLedgerAccount,
                    customCat.AffectsInventory,
                    customCat.RequiresAsset,
                    customCat.RequiresExpense,
                    customCat.AffectsVendorLedger,
                    customCat.IsGstApplicable,
                    customCat.DefaultGstRate,
                    customCat.AllowGstRateChange,
                    customCat.AllowCustomGstRate,
                    customCat.RequireQuantity,
                    customCat.RequireUnit,
                    customCat.RequireItem,
                    customCat.RequireServiceDescription,
                    customCat.RequireAssetDetails,
                    customCat.RequireInvoiceNumber,
                    customCat.RequireVendor,
                    customCat.RequirePaymentDetails
                );
            }

            var fallback = SystemCategoryDefinitions.First(s => s.Code == "Other");
            return new CategoryResolution(trimmed, trimmed, "Expense", fallback.DefaultLedgerAccount, false, false, true, true, true, 18.0m, true, true, false, false, false, false, false, false, true, true);
        }

        private async Task<string> ResolveCategoryTreatmentAsync(string categoryCode)
        {
            var config = await ResolveCategoryConfigAsync(categoryCode);
            return config.Treatment;
        }

        // ==========================================
        // AUTHORITATIVE PURCHASE CALCULATION ENGINE
        // ==========================================

        public record PurchaseCalculationResult(
            decimal SubTotal,
            decimal DiscountAmount,
            decimal OtherCharges,
            decimal TaxableAmount,
            string TaxMode,
            decimal GSTRate,
            decimal CalculatedGst,
            decimal FinalGst,
            decimal CGSTAmount,
            decimal SGSTAmount,
            decimal IGSTAmount,
            bool IsGstOverridden,
            bool IsInclusiveTax,
            decimal GrandTotal,
            decimal AmountPaid,
            decimal BalanceAmount,
            string PaymentStatus
        );

        public static PurchaseCalculationResult CalculatePurchaseTotals(
            decimal subTotal,
            decimal discountAmount,
            decimal otherCharges,
            string? taxMode,
            decimal gstRate,
            bool isInclusiveTax,
            bool isGstOverridden,
            decimal manualTaxAmount,
            bool isInterState,
            decimal amountPaid,
            string? paymentMethod
        )
        {
            var cleanSubTotal = Math.Max(0, Math.Round(subTotal, 2, MidpointRounding.AwayFromZero));
            var cleanDiscount = Math.Max(0, Math.Round(discountAmount, 2, MidpointRounding.AwayFromZero));
            var cleanCharges = Math.Max(0, Math.Round(otherCharges, 2, MidpointRounding.AwayFromZero));
            var cleanRate = Math.Max(0, Math.Round(gstRate, 2, MidpointRounding.AwayFromZero));
            var cleanMode = string.Equals(taxMode, "NonGST", StringComparison.OrdinalIgnoreCase) ? "NonGST" : "GST";

            decimal taxableAmount;
            decimal calculatedGst = 0m;
            decimal finalGst = 0m;
            decimal grandTotal;

            if (cleanMode == "NonGST" || cleanRate == 0)
            {
                taxableAmount = Math.Max(0, cleanSubTotal - cleanDiscount + cleanCharges);
                calculatedGst = 0m;
                finalGst = 0m;
                grandTotal = taxableAmount;
            }
            else if (!isInclusiveTax)
            {
                // GST Exclusive: Taxable = SubTotal - Discount + OtherCharges
                taxableAmount = Math.Max(0, cleanSubTotal - cleanDiscount + cleanCharges);
                calculatedGst = Math.Round(taxableAmount * (cleanRate / 100m), 2, MidpointRounding.AwayFromZero);
                finalGst = isGstOverridden
                    ? Math.Max(0, Math.Round(manualTaxAmount, 2, MidpointRounding.AwayFromZero))
                    : calculatedGst;
                grandTotal = Math.Max(0, taxableAmount + finalGst);
            }
            else
            {
                // GST Inclusive: Total with Tax = SubTotal - Discount + OtherCharges
                var totalInclusive = Math.Max(0, cleanSubTotal - cleanDiscount + cleanCharges);
                taxableAmount = Math.Round(totalInclusive / (1m + (cleanRate / 100m)), 2, MidpointRounding.AwayFromZero);
                calculatedGst = Math.Max(0, totalInclusive - taxableAmount);
                if (isGstOverridden)
                {
                    finalGst = Math.Max(0, Math.Round(manualTaxAmount, 2, MidpointRounding.AwayFromZero));
                    grandTotal = Math.Max(0, taxableAmount + finalGst);
                }
                else
                {
                    finalGst = calculatedGst;
                    grandTotal = totalInclusive;
                }
            }

            decimal cgst = 0m;
            decimal sgst = 0m;
            decimal igst = 0m;

            if (cleanMode == "GST" && finalGst > 0)
            {
                if (isInterState)
                {
                    igst = finalGst;
                    cgst = 0m;
                    sgst = 0m;
                }
                else
                {
                    cgst = Math.Round(finalGst / 2.0m, 2, MidpointRounding.AwayFromZero);
                    sgst = finalGst - cgst; // Exact decimal balance
                    igst = 0m;
                }
            }

            var cleanPaid = Math.Max(0, Math.Round(amountPaid, 2, MidpointRounding.AwayFromZero));
            if (string.Equals(paymentMethod, "Credit", StringComparison.OrdinalIgnoreCase))
            {
                cleanPaid = 0m;
            }
            else if (cleanPaid > grandTotal)
            {
                cleanPaid = grandTotal;
            }

            var balance = Math.Max(0, Math.Round(grandTotal - cleanPaid, 2, MidpointRounding.AwayFromZero));

            string status = "Unpaid";
            if (cleanPaid >= grandTotal && grandTotal > 0) status = "Paid";
            else if (cleanPaid > 0) status = "PartiallyPaid";

            return new PurchaseCalculationResult(
                cleanSubTotal,
                cleanDiscount,
                cleanCharges,
                taxableAmount,
                cleanMode,
                cleanRate,
                calculatedGst,
                finalGst,
                cgst,
                sgst,
                igst,
                isGstOverridden,
                isInclusiveTax,
                grandTotal,
                cleanPaid,
                balance,
                status
            );
        }

        public async Task<List<PurchaseCategoryDto>> GetPurchaseCategoriesAsync(bool includeInactive = false)
        {
            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();

            var existingCategories = await _context.PurchaseCategories
                .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                .ToListAsync();

            var handledCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var categoriesToKeep = new List<PurchaseCategory>();
            var categoriesToDelete = new List<PurchaseCategory>();

            foreach (var sys in SystemCategoryDefinitions)
            {
                var matches = existingCategories.Where(c =>
                    string.Equals(c.Code.Trim(), sys.Code, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(c.Code.Replace(" ", "").Replace("/", "").Trim(), sys.Code.Replace(" ", "").Replace("/", "").Trim(), StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(c.Name.Trim(), sys.Name.Trim(), StringComparison.OrdinalIgnoreCase) ||
                    c.Name.StartsWith(sys.Code, StringComparison.OrdinalIgnoreCase)
                ).OrderBy(c => c.IsSystem ? 0 : 1).ThenBy(c => c.CreatedAt).ToList();

                if (matches.Count > 0)
                {
                    var canonical = matches[0];
                    canonical.Code = sys.Code;
                    canonical.Name = sys.Name;
                    canonical.Treatment = sys.Treatment;
                    canonical.Description = sys.Description;
                    canonical.IsSystem = true;
                    canonical.IsActive = true;
                    canonical.DefaultLedgerAccount = sys.DefaultLedgerAccount;
                    canonical.AffectsInventory = sys.AffectsInventory;
                    canonical.RequiresAsset = sys.RequiresAsset;
                    canonical.RequiresExpense = sys.RequiresExpense;
                    canonical.AffectsVendorLedger = sys.AffectsVendorLedger;
                    canonical.IsGstApplicable = sys.IsGstApplicable;
                    canonical.DefaultGstRate = sys.DefaultGstRate;
                    canonical.AllowGstRateChange = sys.AllowGstRateChange;
                    canonical.AllowCustomGstRate = sys.AllowCustomGstRate;
                    canonical.RequireQuantity = sys.RequireQuantity;
                    canonical.RequireUnit = sys.RequireUnit;
                    canonical.RequireItem = sys.RequireItem;
                    canonical.RequireServiceDescription = sys.RequireServiceDescription;
                    canonical.RequireAssetDetails = sys.RequireAssetDetails;
                    canonical.RequireInvoiceNumber = sys.RequireInvoiceNumber;
                    canonical.RequireVendor = sys.RequireVendor;
                    canonical.RequirePaymentDetails = sys.RequirePaymentDetails;

                    categoriesToKeep.Add(canonical);
                    handledCodes.Add(sys.Code);

                    for (int i = 1; i < matches.Count; i++)
                    {
                        matches[i].IsDeleted = true;
                        categoriesToDelete.Add(matches[i]);
                    }
                }
                else
                {
                    var newCat = new PurchaseCategory
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        Code = sys.Code,
                        Name = sys.Name,
                        Treatment = sys.Treatment,
                        Description = sys.Description,
                        IsSystem = true,
                        IsActive = true,
                        DefaultLedgerAccount = sys.DefaultLedgerAccount,
                        AffectsInventory = sys.AffectsInventory,
                        RequiresAsset = sys.RequiresAsset,
                        RequiresExpense = sys.RequiresExpense,
                        AffectsVendorLedger = sys.AffectsVendorLedger,
                        IsGstApplicable = sys.IsGstApplicable,
                        DefaultGstRate = sys.DefaultGstRate,
                        AllowGstRateChange = sys.AllowGstRateChange,
                        AllowCustomGstRate = sys.AllowCustomGstRate,
                        RequireQuantity = sys.RequireQuantity,
                        RequireUnit = sys.RequireUnit,
                        RequireItem = sys.RequireItem,
                        RequireServiceDescription = sys.RequireServiceDescription,
                        RequireAssetDetails = sys.RequireAssetDetails,
                        RequireInvoiceNumber = sys.RequireInvoiceNumber,
                        RequireVendor = sys.RequireVendor,
                        RequirePaymentDetails = sys.RequirePaymentDetails,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = "System"
                    };
                    _context.PurchaseCategories.Add(newCat);
                    categoriesToKeep.Add(newCat);
                    handledCodes.Add(sys.Code);
                }
            }

            foreach (var custom in existingCategories)
            {
                if (!handledCodes.Contains(custom.Code) && !categoriesToDelete.Contains(custom))
                {
                    categoriesToKeep.Add(custom);
                }
            }

            var dbCtx = _context as DbContext;
            if (categoriesToDelete.Count > 0 || (dbCtx != null && dbCtx.ChangeTracker.HasChanges()))
            {
                await _context.SaveChangesAsync();
            }

            var systemCodesOrder = SystemCategoryDefinitions.Select(s => s.Code).ToList();

            var result = categoriesToKeep
                .Where(c => includeInactive || c.IsActive)
                .OrderBy(c => c.IsSystem ? 0 : 1)
                .ThenBy(c => c.IsSystem ? systemCodesOrder.IndexOf(c.Code) : 0)
                .ThenBy(c => c.Name)
                .Select(c => new PurchaseCategoryDto
                {
                    Id = c.Id,
                    TenantId = c.TenantId,
                    CompanyId = c.CompanyId,
                    Code = c.Code,
                    Name = c.Name,
                    Description = c.Description,
                    Treatment = c.Treatment,
                    IsSystem = c.IsSystem,
                    IsActive = c.IsActive,
                    DefaultLedgerAccount = c.DefaultLedgerAccount,
                    AffectsInventory = c.AffectsInventory,
                    RequiresAsset = c.RequiresAsset,
                    RequiresExpense = c.RequiresExpense,
                    AffectsVendorLedger = c.AffectsVendorLedger,
                    IsGstApplicable = c.IsGstApplicable,
                    DefaultGstRate = c.DefaultGstRate,
                    AllowGstRateChange = c.AllowGstRateChange,
                    AllowCustomGstRate = c.AllowCustomGstRate,
                    RequireQuantity = c.RequireQuantity,
                    RequireUnit = c.RequireUnit,
                    RequireItem = c.RequireItem,
                    RequireServiceDescription = c.RequireServiceDescription,
                    RequireAssetDetails = c.RequireAssetDetails,
                    RequireInvoiceNumber = c.RequireInvoiceNumber,
                    RequireVendor = c.RequireVendor,
                    RequirePaymentDetails = c.RequirePaymentDetails,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt
                })
                .ToList();

            return result;
        }

        public async Task<PurchaseCategoryDto?> GetPurchaseCategoryByIdAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var c = await _context.PurchaseCategories
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && !x.IsDeleted);

            if (c == null) return null;

            return new PurchaseCategoryDto
            {
                Id = c.Id,
                TenantId = c.TenantId,
                CompanyId = c.CompanyId,
                Code = c.Code,
                Name = c.Name,
                Description = c.Description,
                Treatment = c.Treatment,
                IsSystem = c.IsSystem,
                IsActive = c.IsActive,
                DefaultLedgerAccount = c.DefaultLedgerAccount,
                AffectsInventory = c.AffectsInventory,
                RequiresAsset = c.RequiresAsset,
                RequiresExpense = c.RequiresExpense,
                AffectsVendorLedger = c.AffectsVendorLedger,
                IsGstApplicable = c.IsGstApplicable,
                DefaultGstRate = c.DefaultGstRate,
                AllowGstRateChange = c.AllowGstRateChange,
                AllowCustomGstRate = c.AllowCustomGstRate,
                RequireQuantity = c.RequireQuantity,
                RequireUnit = c.RequireUnit,
                RequireItem = c.RequireItem,
                RequireServiceDescription = c.RequireServiceDescription,
                RequireAssetDetails = c.RequireAssetDetails,
                RequireInvoiceNumber = c.RequireInvoiceNumber,
                RequireVendor = c.RequireVendor,
                RequirePaymentDetails = c.RequirePaymentDetails,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            };
        }

        public async Task<PurchaseCategoryDto> CreatePurchaseCategoryAsync(CreatePurchaseCategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Category name is required.");
            }

            var trimmedName = request.Name.Trim();
            var treatment = request.Treatment?.Trim();
            if (treatment != "Inventory" && treatment != "Asset" && treatment != "Expense")
            {
                throw new ArgumentException("Treatment must be 'Inventory', 'Asset', or 'Expense'.");
            }

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var currentUser = _currentUserContext.Email ?? "Unknown User";

            var duplicateExists = await _context.PurchaseCategories
                .AnyAsync(c => c.TenantId == tenantId && !c.IsDeleted &&
                    (c.Name.ToLower() == trimmedName.ToLower() || c.Code.ToLower() == trimmedName.ToLower()));

            if (duplicateExists)
            {
                throw new InvalidOperationException($"A purchase category with the name '{trimmedName}' already exists.");
            }

            var baseCode = System.Text.RegularExpressions.Regex.Replace(trimmedName, @"[^a-zA-Z0-9]", "");
            if (string.IsNullOrWhiteSpace(baseCode)) baseCode = "CAT";
            var code = baseCode;
            int suffix = 1;
            while (await _context.PurchaseCategories.AnyAsync(c => c.TenantId == tenantId && c.Code == code && !c.IsDeleted))
            {
                code = $"{baseCode}_{suffix++}";
            }

            var newCategory = new PurchaseCategory
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = companyId,
                Code = code,
                Name = trimmedName,
                Description = request.Description?.Trim(),
                Treatment = treatment,
                IsSystem = false,
                IsActive = true,
                DefaultLedgerAccount = request.DefaultLedgerAccount?.Trim(),
                AffectsInventory = request.AffectsInventory || treatment == "Inventory",
                RequiresAsset = request.RequiresAsset || treatment == "Asset",
                RequiresExpense = request.RequiresExpense || treatment == "Expense",
                AffectsVendorLedger = request.AffectsVendorLedger,
                IsGstApplicable = request.IsGstApplicable,
                DefaultGstRate = request.DefaultGstRate,
                AllowGstRateChange = request.AllowGstRateChange,
                AllowCustomGstRate = request.AllowCustomGstRate,
                RequireQuantity = request.RequireQuantity,
                RequireUnit = request.RequireUnit,
                RequireItem = request.RequireItem,
                RequireServiceDescription = request.RequireServiceDescription,
                RequireAssetDetails = request.RequireAssetDetails,
                RequireInvoiceNumber = request.RequireInvoiceNumber,
                RequireVendor = request.RequireVendor,
                RequirePaymentDetails = request.RequirePaymentDetails,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUser
            };

            _context.PurchaseCategories.Add(newCategory);
            await _context.SaveChangesAsync();

            return new PurchaseCategoryDto
            {
                Id = newCategory.Id,
                TenantId = newCategory.TenantId,
                CompanyId = newCategory.CompanyId,
                Code = newCategory.Code,
                Name = newCategory.Name,
                Description = newCategory.Description,
                Treatment = newCategory.Treatment,
                IsSystem = newCategory.IsSystem,
                IsActive = newCategory.IsActive,
                DefaultLedgerAccount = newCategory.DefaultLedgerAccount,
                AffectsInventory = newCategory.AffectsInventory,
                RequiresAsset = newCategory.RequiresAsset,
                RequiresExpense = newCategory.RequiresExpense,
                AffectsVendorLedger = newCategory.AffectsVendorLedger,
                IsGstApplicable = newCategory.IsGstApplicable,
                DefaultGstRate = newCategory.DefaultGstRate,
                AllowGstRateChange = newCategory.AllowGstRateChange,
                AllowCustomGstRate = newCategory.AllowCustomGstRate,
                RequireQuantity = newCategory.RequireQuantity,
                RequireUnit = newCategory.RequireUnit,
                RequireItem = newCategory.RequireItem,
                RequireServiceDescription = newCategory.RequireServiceDescription,
                RequireAssetDetails = newCategory.RequireAssetDetails,
                RequireInvoiceNumber = newCategory.RequireInvoiceNumber,
                RequireVendor = newCategory.RequireVendor,
                RequirePaymentDetails = newCategory.RequirePaymentDetails,
                CreatedAt = newCategory.CreatedAt,
                UpdatedAt = newCategory.UpdatedAt
            };
        }

        public async Task<PurchaseCategoryDto?> UpdatePurchaseCategoryAsync(Guid id, UpdatePurchaseCategoryRequest request)
        {
            var tenantId = GetTenantId();
            var category = await _context.PurchaseCategories
                .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

            if (category == null) return null;

            var currentUser = _currentUserContext.Email ?? "Unknown User";
            var trimmedName = request.Name.Trim();
            var treatment = request.Treatment?.Trim();

            if (treatment != "Inventory" && treatment != "Asset" && treatment != "Expense")
            {
                throw new ArgumentException("Treatment must be 'Inventory', 'Asset', or 'Expense'.");
            }

            if (category.IsSystem)
            {
                category.Description = request.Description?.Trim();
                category.IsActive = request.IsActive;
                category.DefaultLedgerAccount = request.DefaultLedgerAccount?.Trim() ?? category.DefaultLedgerAccount;
                category.DefaultGstRate = request.DefaultGstRate > 0 ? request.DefaultGstRate : category.DefaultGstRate;
                category.AllowGstRateChange = request.AllowGstRateChange;
                category.AllowCustomGstRate = request.AllowCustomGstRate;
                category.UpdatedAt = DateTime.UtcNow;
                category.UpdatedBy = currentUser;
            }
            else
            {
                var nameTaken = await _context.PurchaseCategories
                    .AnyAsync(c => c.TenantId == tenantId && c.Id != id && !c.IsDeleted &&
                        c.Name.ToLower() == trimmedName.ToLower());
                if (nameTaken)
                {
                    throw new InvalidOperationException($"A purchase category with the name '{trimmedName}' already exists.");
                }

                category.Name = trimmedName;
                category.Treatment = treatment;
                category.Description = request.Description?.Trim();
                category.IsActive = request.IsActive;
                category.DefaultLedgerAccount = request.DefaultLedgerAccount?.Trim();
                category.AffectsInventory = request.AffectsInventory;
                category.RequiresAsset = request.RequiresAsset;
                category.RequiresExpense = request.RequiresExpense;
                category.AffectsVendorLedger = request.AffectsVendorLedger;
                category.IsGstApplicable = request.IsGstApplicable;
                category.DefaultGstRate = request.DefaultGstRate;
                category.AllowGstRateChange = request.AllowGstRateChange;
                category.AllowCustomGstRate = request.AllowCustomGstRate;
                category.RequireQuantity = request.RequireQuantity;
                category.RequireUnit = request.RequireUnit;
                category.RequireItem = request.RequireItem;
                category.RequireServiceDescription = request.RequireServiceDescription;
                category.RequireAssetDetails = request.RequireAssetDetails;
                category.RequireInvoiceNumber = request.RequireInvoiceNumber;
                category.RequireVendor = request.RequireVendor;
                category.RequirePaymentDetails = request.RequirePaymentDetails;
                category.UpdatedAt = DateTime.UtcNow;
                category.UpdatedBy = currentUser;
            }

            await _context.SaveChangesAsync();

            return new PurchaseCategoryDto
            {
                Id = category.Id,
                TenantId = category.TenantId,
                CompanyId = category.CompanyId,
                Code = category.Code,
                Name = category.Name,
                Description = category.Description,
                Treatment = category.Treatment,
                IsSystem = category.IsSystem,
                IsActive = category.IsActive,
                DefaultLedgerAccount = category.DefaultLedgerAccount,
                AffectsInventory = category.AffectsInventory,
                RequiresAsset = category.RequiresAsset,
                RequiresExpense = category.RequiresExpense,
                AffectsVendorLedger = category.AffectsVendorLedger,
                IsGstApplicable = category.IsGstApplicable,
                DefaultGstRate = category.DefaultGstRate,
                AllowGstRateChange = category.AllowGstRateChange,
                AllowCustomGstRate = category.AllowCustomGstRate,
                RequireQuantity = category.RequireQuantity,
                RequireUnit = category.RequireUnit,
                RequireItem = category.RequireItem,
                RequireServiceDescription = category.RequireServiceDescription,
                RequireAssetDetails = category.RequireAssetDetails,
                RequireInvoiceNumber = category.RequireInvoiceNumber,
                RequireVendor = category.RequireVendor,
                RequirePaymentDetails = category.RequirePaymentDetails,
                CreatedAt = category.CreatedAt,
                UpdatedAt = category.UpdatedAt
            };
        }

        public async Task<bool> DeletePurchaseCategoryAsync(Guid id)
        {
            var tenantId = GetTenantId();
            var category = await _context.PurchaseCategories
                .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId && !c.IsDeleted);

            if (category == null) return false;

            if (category.IsSystem)
            {
                throw new InvalidOperationException("System default categories cannot be deleted.");
            }

            var currentUser = _currentUserContext.Email ?? "Unknown User";

            var isReferenced = await _context.Purchases
                .AnyAsync(p => p.TenantId == tenantId && !p.IsDeleted &&
                    (p.PurchaseCategory == category.Code || p.PurchaseCategory == category.Name));

            if (isReferenced)
            {
                category.IsActive = false;
                category.UpdatedAt = DateTime.UtcNow;
                category.UpdatedBy = currentUser;
            }
            else
            {
                category.IsDeleted = true;
                category.DeletedAt = DateTime.UtcNow;
                category.DeletedBy = currentUser;
            }

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
