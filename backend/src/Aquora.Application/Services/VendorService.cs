using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Purchase;
using Aquora.Domain.Entities.Finance;
using Aquora.Shared.Models;

namespace Aquora.Application.Services
{
    public class VendorService : IVendorService
    {
        private readonly ITenantDbContext _context;
        private readonly ITenantProvider _tenantProvider;

        public VendorService(ITenantDbContext context, ITenantProvider tenantProvider)
        {
            _context = context;
            _tenantProvider = tenantProvider;
        }

        private Guid GetTenantId() => _tenantProvider.TenantId;

        private async Task<Guid> GetCompanyIdAsync()
        {
            var company = await _context.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            return company?.Id ?? Guid.Empty;
        }

        public async Task<PagedResult<VendorDto>> GetVendorsAsync(int pageNumber, int pageSize, string? search)
        {
            var query = _context.Vendors.Where(v => !v.IsDeleted).AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(v =>
                    v.Name.ToLower().Contains(s) ||
                    (v.VendorCode != null && v.VendorCode.ToLower().Contains(s)) ||
                    (v.Phone != null && v.Phone.ToLower().Contains(s)) ||
                    (v.Email != null && v.Email.ToLower().Contains(s)) ||
                    (v.GST != null && v.GST.ToLower().Contains(s)));
            }

            var totalCount = await query.CountAsync();
            var vendors = await query
                .OrderByDescending(v => v.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var vendorIds = vendors.Select(v => v.Id).ToList();

            var purchasesStats = await _context.Purchases
                .Where(p => !p.IsDeleted && p.VendorId.HasValue && vendorIds.Contains(p.VendorId.Value))
                .GroupBy(p => p.VendorId!.Value)
                .Select(g => new
                {
                    VendorId = g.Key,
                    Count = g.Count(),
                    TotalValue = g.Sum(x => x.GrandTotal),
                    LastDate = g.Max(x => x.PurchaseDate)
                })
                .ToListAsync();

            var items = vendors.Select(v => {
                var stat = purchasesStats.FirstOrDefault(s => s.VendorId == v.Id);
                return new VendorDto
                {
                    Id = v.Id,
                    VendorCode = v.VendorCode ?? $"VND-{v.CreatedAt:yyyy}-{v.Id.ToString().Substring(0, 4).ToUpper()}",
                    Name = v.Name,
                    Phone = v.Phone,
                    Email = v.Email,
                    GST = v.GST,
                    Address = v.Address,
                    OpeningBalance = v.OpeningBalance,
                    CurrentBalance = v.CurrentBalance,
                    CreditLimit = v.CreditLimit,
                    IsActive = v.IsActive,
                    Notes = v.Notes,
                    CreatedAt = v.CreatedAt,
                    CreatedByName = "Company Administrator",
                    TotalPurchasesCount = stat?.Count ?? 0,
                    TotalPurchaseValue = stat?.TotalValue ?? 0m,
                    LastPurchaseDate = stat?.LastDate
                };
            }).ToList();

            return new PagedResult<VendorDto>(items, totalCount, pageNumber, pageSize);
        }

        public async Task<List<VendorDropdownDto>> GetVendorDropdownAsync()
        {
            return await _context.Vendors
                .Where(v => !v.IsDeleted && v.IsActive)
                .OrderBy(v => v.Name)
                .Select(v => new VendorDropdownDto
                {
                    Id = v.Id,
                    Name = v.Name,
                    GST = v.GST,
                    CurrentBalance = v.CurrentBalance
                })
                .ToListAsync();
        }

        public async Task<VendorDto?> GetVendorByIdAsync(Guid id)
        {
            var v = await _context.Vendors.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (v == null) return null;

            var purchases = await _context.Purchases
                .Where(p => !p.IsDeleted && p.VendorId == id)
                .ToListAsync();

            return new VendorDto
            {
                Id = v.Id,
                VendorCode = v.VendorCode ?? $"VND-{v.CreatedAt:yyyy}-{v.Id.ToString().Substring(0, 4).ToUpper()}",
                Name = v.Name,
                Phone = v.Phone,
                Email = v.Email,
                GST = v.GST,
                Address = v.Address,
                OpeningBalance = v.OpeningBalance,
                CurrentBalance = v.CurrentBalance,
                CreditLimit = v.CreditLimit,
                IsActive = v.IsActive,
                Notes = v.Notes,
                CreatedAt = v.CreatedAt,
                CreatedByName = "Company Administrator",
                TotalPurchasesCount = purchases.Count,
                TotalPurchaseValue = purchases.Sum(p => p.GrandTotal),
                LastPurchaseDate = purchases.Select(p => (DateTime?)p.PurchaseDate).Max()
            };
        }

        public async Task<VendorDetailsDto?> GetVendorDetailsAsync(Guid id)
        {
            var vendorDto = await GetVendorByIdAsync(id);
            if (vendorDto == null) return null;

            var purchases = await _context.Purchases
                .Include(p => p.Items)
                .Include(p => p.Payments)
                .Include(p => p.TimelineEvents)
                .Where(p => !p.IsDeleted && p.VendorId == id)
                .OrderByDescending(p => p.PurchaseDate)
                .ToListAsync();

            var purchaseDtos = purchases.Select(p => new PurchaseDto
            {
                Id = p.Id,
                PurchaseNo = p.PurchaseNo,
                PurchaseDate = p.PurchaseDate,
                VendorId = p.VendorId,
                VendorName = p.VendorName,
                VendorCode = vendorDto.VendorCode,
                PurchaseCategory = p.PurchaseCategory,
                InvoiceNumber = p.InvoiceNumber,
                ReferenceNumber = p.ReferenceNumber,
                PaymentMethod = p.PaymentMethod,
                SubTotal = p.SubTotal,
                TaxAmount = p.TaxAmount,
                DiscountAmount = p.DiscountAmount,
                OtherCharges = p.OtherCharges,
                GrandTotal = p.GrandTotal,
                AmountPaid = p.AmountPaid,
                BalanceAmount = p.BalanceAmount,
                PaymentStatus = p.PaymentStatus,
                IsCancelled = p.IsCancelled,
                CancelledAt = p.CancelledAt,
                CancelledByName = p.CancelledBy != null ? "Company Administrator" : null,
                Notes = p.Notes,
                CategoryMetadataJson = p.CategoryMetadataJson,
                CreatedAt = p.CreatedAt,
                CreatedBy = p.CreatedBy,
                CreatedByName = "Company Administrator",
                UpdatedAt = p.UpdatedAt,
                UpdatedByName = p.UpdatedBy != null ? "Company Administrator" : null
            }).ToList();

            // Construct Running Account Ledger
            var ledger = new List<VendorLedgerEntryDto>();
            decimal runningBal = vendorDto.OpeningBalance;

            if (vendorDto.OpeningBalance > 0)
            {
                ledger.Add(new VendorLedgerEntryDto
                {
                    Id = Guid.NewGuid(),
                    Date = vendorDto.CreatedAt,
                    TransactionType = "Opening Balance",
                    VoucherNo = "OB-001",
                    Credit = vendorDto.OpeningBalance,
                    Debit = 0,
                    RunningBalance = runningBal,
                    Remarks = "Initial Account Opening Balance"
                });
            }

            foreach (var p in purchases.OrderBy(x => x.PurchaseDate))
            {
                runningBal += p.GrandTotal;
                ledger.Add(new VendorLedgerEntryDto
                {
                    Id = p.Id,
                    Date = p.PurchaseDate,
                    TransactionType = "Purchase Invoice",
                    VoucherNo = p.PurchaseNo,
                    Credit = p.GrandTotal,
                    Debit = 0,
                    RunningBalance = runningBal,
                    Reference = p.InvoiceNumber ?? p.ReferenceNumber,
                    Remarks = $"Purchase Category: {p.PurchaseCategory}"
                });

                foreach (var pay in p.Payments.OrderBy(x => x.PaymentDate))
                {
                    runningBal -= pay.Amount;
                    ledger.Add(new VendorLedgerEntryDto
                    {
                        Id = pay.Id,
                        Date = pay.PaymentDate,
                        TransactionType = "Vendor Payment",
                        VoucherNo = p.PurchaseNo,
                        Credit = 0,
                        Debit = pay.Amount,
                        RunningBalance = runningBal,
                        Reference = pay.ReferenceNo,
                        Remarks = $"Payment via {pay.PaymentMethod}"
                    });
                }
            }

            // Direct vendor payments
            var directPayments = await _context.BankLedgerEntries
                .Where(e => e.RelatedEntityType == "Vendor" && e.RelatedEntityId == id)
                .ToListAsync();

            foreach (var dp in directPayments)
            {
                runningBal -= dp.Debit;
                ledger.Add(new VendorLedgerEntryDto
                {
                    Id = dp.Id,
                    Date = dp.TransactionDate,
                    TransactionType = "Vendor Payment",
                    VoucherNo = dp.ReferenceNumber,
                    Credit = 0,
                    Debit = dp.Debit,
                    RunningBalance = runningBal,
                    Reference = dp.ReferenceNumber,
                    Remarks = dp.Description
                });
            }

            // Construct Timeline Events
            var timeline = new List<VendorTimelineEventDto>
            {
                new VendorTimelineEventDto
                {
                    Id = Guid.NewGuid(),
                    EventDate = vendorDto.CreatedAt,
                    Action = "Vendor Account Registered",
                    PerformedByName = "Company Administrator",
                    Details = $"Registered vendor {vendorDto.Name} with opening balance ₹{vendorDto.OpeningBalance:N2}"
                }
            };

            foreach (var dp in directPayments)
            {
                timeline.Add(new VendorTimelineEventDto
                {
                    Id = Guid.NewGuid(),
                    EventDate = dp.TransactionDate,
                    Action = "Direct Payment Recorded",
                    PerformedByName = dp.CreatedBy ?? "Company Administrator",
                    Details = $"Paid ₹{dp.Debit:N2}. Ref: {dp.ReferenceNumber}"
                });
            }

            foreach (var p in purchases)
            {
                timeline.Add(new VendorTimelineEventDto
                {
                    Id = Guid.NewGuid(),
                    EventDate = p.CreatedAt,
                    Action = "Purchase Order Created",
                    PerformedByName = "Company Administrator",
                    Details = $"Created purchase {p.PurchaseNo} for amount ₹{p.GrandTotal:N2}"
                });

                foreach (var pay in p.Payments)
                {
                    timeline.Add(new VendorTimelineEventDto
                    {
                        Id = Guid.NewGuid(),
                        EventDate = pay.PaymentDate,
                        Action = "Payment Recorded",
                        PerformedByName = "Company Administrator",
                        Details = $"Paid ₹{pay.Amount:N2} via {pay.PaymentMethod} for purchase {p.PurchaseNo}"
                    });
                }
            }

            var totalPurchasesCount = purchases.Count;
            var totalPurchaseValue = purchases.Sum(p => p.GrandTotal);
            var paidAmount = purchases.Sum(p => p.AmountPaid);
            var pendingAmount = purchases.Sum(p => p.BalanceAmount);
            var avgPurchase = totalPurchasesCount > 0 ? totalPurchaseValue / totalPurchasesCount : 0m;
            var lastDate = purchases.Select(p => (DateTime?)p.PurchaseDate).Max();

            return new VendorDetailsDto
            {
                Vendor = vendorDto,
                SummaryStats = new VendorSummaryStatsDto
                {
                    OutstandingBalance = vendorDto.CurrentBalance,
                    TotalPurchasesCount = totalPurchasesCount,
                    TotalPurchaseValue = totalPurchaseValue,
                    PaidAmount = paidAmount,
                    PendingAmount = pendingAmount,
                    AveragePurchaseValue = avgPurchase,
                    LastPurchaseDate = lastDate
                },
                Purchases = purchaseDtos,
                Ledger = ledger.OrderByDescending(x => x.Date).ToList(),
                Timeline = timeline.OrderByDescending(x => x.EventDate).ToList()
            };
        }

        public async Task<VendorDto> CreateVendorAsync(CreateVendorRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Vendor Name is required.");
            }

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var count = await _context.Vendors.CountAsync();
            var vendorCode = $"VND-{DateTime.UtcNow:yyyy}-{(count + 1):D4}";

            var vendor = new Vendor
            {
                TenantId = tenantId,
                CompanyId = companyId,
                VendorCode = vendorCode,
                Name = request.Name.Trim(),
                Phone = request.Phone?.Trim(),
                Email = request.Email?.Trim(),
                GST = request.GST?.Trim(),
                Address = request.Address?.Trim(),
                OpeningBalance = request.OpeningBalance,
                CurrentBalance = request.OpeningBalance,
                CreditLimit = request.CreditLimit,
                IsActive = true,
                Notes = request.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "Company Administrator"
            };

            _context.Vendors.Add(vendor);
            await _context.SaveChangesAsync();

            return (await GetVendorByIdAsync(vendor.Id))!;
        }

        public async Task<VendorDto?> UpdateVendorAsync(Guid id, UpdateVendorRequest request)
        {
            var vendor = await _context.Vendors.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (vendor == null) return null;

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Vendor Name is required.");
            }

            vendor.Name = request.Name.Trim();
            vendor.Phone = request.Phone?.Trim();
            vendor.Email = request.Email?.Trim();
            vendor.GST = request.GST?.Trim();
            vendor.Address = request.Address?.Trim();
            vendor.CreditLimit = request.CreditLimit;
            vendor.IsActive = request.IsActive;
            vendor.Notes = request.Notes?.Trim();
            vendor.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return await GetVendorByIdAsync(id);
        }

        public async Task<bool> ToggleVendorStatusAsync(Guid id)
        {
            var vendor = await _context.Vendors.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (vendor == null) return false;

            vendor.IsActive = !vendor.IsActive;
            vendor.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteVendorAsync(Guid id)
        {
            var vendor = await _context.Vendors.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (vendor == null) return false;

            vendor.IsDeleted = true;
            vendor.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<VendorDto> RecordPaymentAsync(Guid id, RecordVendorPaymentRequest request)
        {
            var vendor = await _context.Vendors.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (vendor == null)
            {
                throw new ArgumentException("Vendor record not found.");
            }

            if (request.Amount <= 0)
            {
                throw new ArgumentException("Payment amount must be greater than zero.");
            }

            if (vendor.CurrentBalance <= 0)
            {
                throw new ArgumentException("Vendor has no outstanding balance to pay.");
            }

            if (request.Amount > vendor.CurrentBalance)
            {
                throw new ArgumentException($"Payment amount (₹{request.Amount:N2}) cannot exceed current outstanding balance of ₹{vendor.CurrentBalance:N2}.");
            }

            var tenantId = GetTenantId();
            var companyId = await GetCompanyIdAsync();
            var randomCode = new Random().Next(1000, 9999);
            var paymentRef = string.IsNullOrWhiteSpace(request.ReferenceNumber)
                ? $"PAY-VND-{DateTime.UtcNow:yyyyMMdd}-{randomCode}"
                : request.ReferenceNumber.Trim();
            var paymentDate = request.PaymentDate != default ? request.PaymentDate : DateTime.UtcNow;

            // Deduct from vendor balance
            vendor.CurrentBalance = Math.Max(0m, vendor.CurrentBalance - request.Amount);
            vendor.UpdatedAt = DateTime.UtcNow;

            // FIFO allocate across any unpaid purchases for this vendor
            var openPurchases = await _context.Purchases
                .Include(p => p.Payments)
                .Where(p => p.VendorId == id && !p.IsDeleted && !p.IsCancelled && p.BalanceAmount > 0)
                .OrderBy(p => p.PurchaseDate)
                .ToListAsync();

            decimal remainingPayment = request.Amount;
            foreach (var p in openPurchases)
            {
                if (remainingPayment <= 0) break;
                decimal alloc = Math.Min(remainingPayment, p.BalanceAmount);
                p.AmountPaid += alloc;
                p.BalanceAmount = Math.Max(0m, p.GrandTotal - p.AmountPaid);
                p.PaymentStatus = p.BalanceAmount <= 0 ? "Paid" : "Partially Paid";
                p.UpdatedAt = DateTime.UtcNow;

                var payment = new PurchasePayment
                {
                    Id = Guid.NewGuid(),
                    PurchaseId = p.Id,
                    PaymentDate = paymentDate,
                    Amount = alloc,
                    PaymentMethod = request.PaymentMethod,
                    BankAccountId = request.BankAccountId,
                    CashBookId = request.CashBookId,
                    ReferenceNo = paymentRef,
                    Notes = request.Notes,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = "Company Administrator"
                };
                _context.PurchasePayments.Add(payment);
                p.Payments.Add(payment);
                remainingPayment -= alloc;
            }

            // Post to bank account or cash book
            if (request.PaymentMethod == "BankAccount" && request.BankAccountId.HasValue)
            {
                var bank = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == request.BankAccountId.Value && !b.IsDeleted);
                if (bank != null)
                {
                    bank.CurrentBalance -= request.Amount;
                    _context.BankLedgerEntries.Add(new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        BankAccountId = bank.Id,
                        LedgerAccountType = "BankAccount",
                        TransactionDate = paymentDate,
                        ReferenceNumber = paymentRef,
                        TransactionType = "Debit",
                        Description = $"Payment to vendor {vendor.Name}. Ref: {paymentRef}",
                        Debit = request.Amount,
                        Credit = 0,
                        RunningBalance = bank.CurrentBalance,
                        RelatedEntityId = vendor.Id,
                        RelatedEntityType = "Vendor",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = "Company Administrator"
                    });
                }
            }
            else if (request.PaymentMethod == "Cash" && request.CashBookId.HasValue)
            {
                var cash = await _context.CashBooks.FirstOrDefaultAsync(c => c.Id == request.CashBookId.Value && !c.IsDeleted);
                if (cash != null)
                {
                    cash.CurrentBalance -= request.Amount;
                    _context.BankLedgerEntries.Add(new BankLedgerEntry
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        CompanyId = companyId,
                        CashBookId = cash.Id,
                        LedgerAccountType = "CashBook",
                        TransactionDate = paymentDate,
                        ReferenceNumber = paymentRef,
                        TransactionType = "Debit",
                        Description = $"Cash payment to vendor {vendor.Name}. Ref: {paymentRef}",
                        Debit = request.Amount,
                        Credit = 0,
                        RunningBalance = cash.CurrentBalance,
                        RelatedEntityId = vendor.Id,
                        RelatedEntityType = "Vendor",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = "Company Administrator"
                    });
                }
            }

            await _context.SaveChangesAsync();

            return (await GetVendorByIdAsync(vendor.Id))!;
        }
    }
}
