using System.Net;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Aquora.API.Controllers;

/// <summary>
/// Transactional boundary for the 20L business engine.
/// Provides authoritative endpoints for Rate Rules, Container Ledger, Deliveries,
/// Distributor Accounts, Driver Accountability, Customer Positions, Commission, and Reconciliation.
/// </summary>
[Authorize]
[ApiController]
[Route("api/v1/20l")]
public sealed class TwentyLBusinessController : ApiControllerBase
{
    private readonly ITenantDbContext _db;
    private readonly ICurrentUserContext _user;
    private readonly ITwentyLLedgerPostingService _ledger;

    public TwentyLBusinessController(ITenantDbContext db, ICurrentUserContext user, ITwentyLLedgerPostingService ledger)
    {
        _db = db; _user = user; _ledger = ledger;
    }

    #region 1. Rate Rules Engine

    [HttpGet("rate-rules")]
    public async Task<ActionResult<ApiResponse<object>>> GetRateRules(
        [FromQuery] Guid? productId = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] string? partyType = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLRateRules
            .Where(r => r.TenantId == _user.TenantId && !r.IsDeleted);

        if (productId.HasValue && productId.Value != Guid.Empty)
            query = query.Where(r => r.ProductId == productId.Value);
        if (customerId.HasValue && customerId.Value != Guid.Empty)
            query = query.Where(r => r.CustomerId == customerId.Value);
        if (!string.IsNullOrWhiteSpace(partyType) && partyType != "ALL")
            query = query.Where(r => r.PartyType == partyType);
        if (isActive.HasValue)
            query = query.Where(r => r.IsActive == isActive.Value);

        var total = await query.CountAsync();
        var rules = await query
            .OrderByDescending(r => r.Priority)
            .ThenByDescending(r => r.EffectiveFrom)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Join customer and product names
        var productIds = rules.Select(r => r.ProductId).Distinct().ToList();
        var customerIds = rules.Where(r => r.CustomerId.HasValue).Select(r => r.CustomerId!.Value).Distinct().ToList();

        var productMap = await _db.Products.Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);
        var customerMap = await _db.Customers.Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);

        var items = rules.Select(r => new
        {
            r.Id,
            r.ProductId,
            ProductName = productMap.TryGetValue(r.ProductId, out var pName) ? pName : "Unknown Product",
            r.CustomerId,
            CustomerName = r.CustomerId.HasValue && customerMap.TryGetValue(r.CustomerId.Value, out var cName) ? cName : "All Customers (Default)",
            r.PartyType,
            r.RefillType,
            r.JarOwnerType,
            r.MinimumQuantity,
            r.Priority,
            r.UnitRate,
            r.DiscountRate,
            r.TaxRate,
            r.EffectiveFrom,
            r.EffectiveTo,
            r.RequiresAuthorization,
            r.IsActive,
            r.Notes,
            r.CreatedAt,
            r.CreatedBy
        });

        return Success<object>(new { items, total, page, pageSize }, "Rate rules retrieved successfully.");
    }

    [HttpPost("rate-rules")]
    public async Task<ActionResult<ApiResponse<object>>> CreateRateRule(CreateTwentyLRateRuleRequest request)
    {
        if (request.UnitRate < 0 || request.MinimumQuantity <= 0 || request.EffectiveTo < request.EffectiveFrom)
            return ValidationError<object>("rateRule", "Rate, minimum quantity, and effective dates are invalid.");

        var requestedEnd = request.EffectiveTo?.Date ?? DateTime.MaxValue;
        var overlaps = await _db.TwentyLRateRules.AnyAsync(r => r.TenantId == _user.TenantId && !r.IsDeleted && r.IsActive &&
            r.ProductId == request.ProductId && r.CustomerId == request.CustomerId && r.RefillType == request.RefillType && r.JarOwnerType == request.JarOwnerType &&
            r.MinimumQuantity == request.MinimumQuantity && r.Priority == request.Priority && r.EffectiveFrom.Date <= requestedEnd &&
            (r.EffectiveTo == null || r.EffectiveTo >= request.EffectiveFrom.Date));
        if (overlaps) return ValidationError<object>("rateRule", "An active 20L rate rule with the same scope, priority and effective period already exists.");

        var companyId = await CompanyId();
        var rule = new TwentyLRateRule
        {
            TenantId = _user.TenantId, CompanyId = companyId, ProductId = request.ProductId,
            CustomerId = request.CustomerId, PartyType = request.PartyType, RefillType = request.RefillType,
            JarOwnerType = request.JarOwnerType, MinimumQuantity = request.MinimumQuantity, Priority = request.Priority,
            UnitRate = request.UnitRate, DiscountRate = request.DiscountRate, TaxRate = request.TaxRate,
            EffectiveFrom = request.EffectiveFrom.Date, EffectiveTo = request.EffectiveTo?.Date,
            RequiresAuthorization = request.RequiresAuthorization, Notes = request.Notes,
            CreatedAt = DateTime.UtcNow, CreatedBy = _user.UserId ?? string.Empty
        };
        _db.TwentyLRateRules.Add(rule);
        await _db.SaveChangesAsync();
        return Success<object>(new { rule.Id }, "20L rate rule created successfully.");
    }

    [HttpPut("rate-rules/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateRateRule(Guid id, UpdateTwentyLRateRuleRequest request)
    {
        var rule = await _db.TwentyLRateRules.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == _user.TenantId && !r.IsDeleted);
        if (rule == null) return Failure<object>("Rate rule not found.", "Resource not found", HttpStatusCode.NotFound);

        if (request.UnitRate < 0 || request.MinimumQuantity <= 0 || (request.EffectiveTo.HasValue && request.EffectiveTo < request.EffectiveFrom))
            return ValidationError<object>("rateRule", "Rate, minimum quantity, and effective dates are invalid.");

        rule.UnitRate = request.UnitRate;
        rule.DiscountRate = request.DiscountRate;
        rule.TaxRate = request.TaxRate;
        rule.MinimumQuantity = request.MinimumQuantity;
        rule.Priority = request.Priority;
        rule.EffectiveFrom = request.EffectiveFrom.Date;
        rule.EffectiveTo = request.EffectiveTo?.Date;
        rule.RequiresAuthorization = request.RequiresAuthorization;
        rule.IsActive = request.IsActive;
        rule.Notes = request.Notes;
        rule.UpdatedAt = DateTime.UtcNow;
        rule.UpdatedBy = _user.UserId ?? string.Empty;

        await _db.SaveChangesAsync();
        return Success<object>(new { rule.Id }, "Rate rule updated successfully.");
    }

    [HttpDelete("rate-rules/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteRateRule(Guid id)
    {
        var rule = await _db.TwentyLRateRules.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == _user.TenantId && !r.IsDeleted);
        if (rule == null) return Failure<object>("Rate rule not found.", "Resource not found", HttpStatusCode.NotFound);

        rule.IsDeleted = true;
        rule.DeletedAt = DateTime.UtcNow;
        rule.DeletedBy = _user.UserId ?? string.Empty;
        await _db.SaveChangesAsync();
        return Success<object>(new { id }, "Rate rule deleted successfully.");
    }

    [HttpGet("rate-rules/resolve")]
    public async Task<ActionResult<ApiResponse<object>>> ResolveRate(
        [FromQuery] Guid productId,
        [FromQuery] Guid? customerId = null,
        [FromQuery] string refillType = "ANY",
        [FromQuery] string jarOwnerType = "ANY",
        [FromQuery] int quantity = 1,
        [FromQuery] DateTime? on = null)
    {
        var rate = await FindRate(productId, customerId, refillType, jarOwnerType, quantity, on ?? DateTime.UtcNow);
        return rate is null
            ? Failure<object>("No effective 20L rate rule found for the given criteria.", "Rate unavailable", HttpStatusCode.NotFound)
            : Success<object>(new
            {
                rate.Id,
                rate.UnitRate,
                rate.DiscountRate,
                rate.TaxRate,
                rate.EffectiveFrom,
                rate.EffectiveTo,
                rate.RequiresAuthorization
            }, "Effective rate resolved.");
    }

    #endregion

    #region 2. Deliveries Engine

    [HttpGet("deliveries")]
    public async Task<ActionResult<ApiResponse<object>>> GetDeliveries(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] Guid? distributorId = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLDeliveries.Where(d => d.TenantId == _user.TenantId);

        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
            query = query.Where(d => d.Status == status);
        if (customerId.HasValue && customerId.Value != Guid.Empty)
            query = query.Where(d => d.CustomerId == customerId.Value);
        if (distributorId.HasValue && distributorId.Value != Guid.Empty)
            query = query.Where(d => d.DistributorId == distributorId.Value);
        if (dateFrom.HasValue)
            query = query.Where(d => d.DeliveredAt >= dateFrom.Value.Date);
        if (dateTo.HasValue)
            query = query.Where(d => d.DeliveredAt < dateTo.Value.Date.AddDays(1));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(d =>
                (d.DriverReference != null && d.DriverReference.ToLower().Contains(s)) ||
                (d.VehicleReference != null && d.VehicleReference.ToLower().Contains(s)) ||
                (d.RouteReference != null && d.RouteReference.ToLower().Contains(s)) ||
                (d.Notes != null && d.Notes.ToLower().Contains(s)));
        }

        var total = await query.CountAsync();
        var deliveries = await query
            .OrderByDescending(d => d.DeliveredAt)
            .ThenByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var customerIds = deliveries.Select(d => d.CustomerId).Distinct().ToList();
        var distributorIds = deliveries.Where(d => d.DistributorId.HasValue).Select(d => d.DistributorId!.Value).Distinct().ToList();
        var allCustIds = customerIds.Concat(distributorIds).Distinct().ToList();

        var productIds = deliveries.Select(d => d.ProductId).Distinct().ToList();

        var customerMap = await _db.Customers.Where(c => allCustIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);
        var productMap = await _db.Products.Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);

        var items = deliveries.Select(d => new
        {
            d.Id,
            d.CustomerId,
            CustomerName = customerMap.TryGetValue(d.CustomerId, out var cName) ? cName : "Unknown Customer",
            d.DistributorId,
            DistributorName = d.DistributorId.HasValue && customerMap.TryGetValue(d.DistributorId.Value, out var distName) ? distName : null,
            d.ProductId,
            ProductName = productMap.TryGetValue(d.ProductId, out var pName) ? pName : "20L Water Jar",
            d.RefillType,
            d.JarOwnerType,
            d.OrderedQuantity,
            d.FilledDeliveredQuantity,
            d.EmptyCollectedQuantity,
            d.FailedQuantity,
            d.AppliedUnitRate,
            d.DiscountAmount,
            d.TaxAmount,
            d.TotalAmount,
            d.AmountCollected,
            d.PaymentMode,
            d.Status,
            d.RouteReference,
            d.VehicleReference,
            d.DriverReference,
            d.DeliveredAt,
            d.FailureReason,
            d.Notes,
            d.IdempotencyKey,
            d.CreatedAt,
            d.CreatedBy
        });

        return Success<object>(new { items, total, page, pageSize }, "Deliveries retrieved successfully.");
    }

    [HttpGet("deliveries/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetDeliveryById(Guid id)
    {
        var delivery = await _db.TwentyLDeliveries.FirstOrDefaultAsync(d => d.Id == id && d.TenantId == _user.TenantId);
        if (delivery == null) return Failure<object>("Delivery not found.", "Resource not found", HttpStatusCode.NotFound);

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == delivery.CustomerId);
        var distributor = delivery.DistributorId.HasValue ? await _db.Customers.FirstOrDefaultAsync(c => c.Id == delivery.DistributorId.Value) : null;
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == delivery.ProductId);

        var movements = await _db.TwentyLJarMovements
            .Where(m => m.TenantId == _user.TenantId && m.ReferenceId == delivery.Id && m.ReferenceType == "TwentyLDelivery")
            .OrderBy(m => m.OccurredAt)
            .ToListAsync();

        var commission = await _db.TwentyLCommissionTransactions
            .Where(c => c.TenantId == _user.TenantId && c.DeliveryId == delivery.Id)
            .ToListAsync();

        return Success<object>(new
        {
            delivery.Id,
            delivery.CustomerId,
            CustomerName = customer?.CustomerName ?? "Unknown Customer",
            CustomerCode = customer?.CustomerCode,
            delivery.DistributorId,
            DistributorName = distributor?.CustomerName,
            delivery.ProductId,
            ProductName = product?.Name ?? "20L Water Jar",
            delivery.RefillType,
            delivery.JarOwnerType,
            delivery.OrderedQuantity,
            delivery.FilledDeliveredQuantity,
            delivery.EmptyCollectedQuantity,
            delivery.FailedQuantity,
            delivery.AppliedUnitRate,
            delivery.DiscountAmount,
            delivery.TaxAmount,
            delivery.TotalAmount,
            delivery.AmountCollected,
            delivery.PaymentMode,
            delivery.Status,
            delivery.RouteReference,
            delivery.VehicleReference,
            delivery.DriverReference,
            delivery.DeliveredAt,
            delivery.FailureReason,
            delivery.Notes,
            delivery.CreatedAt,
            delivery.CreatedBy,
            Movements = movements.Select(m => new
            {
                m.Id,
                m.MovementType,
                m.ContainerStatus,
                m.Quantity,
                m.OwnerType,
                m.HolderType,
                m.FromLocationType,
                m.ToLocationType,
                m.OccurredAt
            }),
            Commissions = commission.Select(c => new
            {
                c.Id,
                c.BeneficiaryType,
                c.Amount,
                c.TransactionType,
                c.OccurredAt
            })
        }, "Delivery details retrieved.");
    }

    [HttpPost("deliveries")]
    public async Task<ActionResult<ApiResponse<object>>> RecordDelivery(CreateTwentyLDeliveryRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _db.TwentyLDeliveries.FirstOrDefaultAsync(d => d.TenantId == _user.TenantId && d.IdempotencyKey == request.IdempotencyKey);
            if (existing is not null) return Success<object>(new { existing.Id, existing.AppliedUnitRate, existing.TotalAmount }, "Duplicate delivery request ignored.");
        }
        if (request.OrderedQuantity < 0 || request.FilledDeliveredQuantity < 0 || request.EmptyCollectedQuantity < 0 ||
            request.FilledDeliveredQuantity + request.FailedQuantity > request.OrderedQuantity)
            return ValidationError<object>("delivery", "Delivery quantities are inconsistent.");
        if (request.FailedQuantity > 0 && string.IsNullOrWhiteSpace(request.FailureReason))
            return ValidationError<object>("failureReason", "A reason is required for a partial or failed delivery.");
        if (request.ManualUnitRate.HasValue && !_user.HasPermission("20L.OverridePrice"))
            return Failure<object>("A manual 20L price override requires the 20L price-override permission.", "Authorization required", HttpStatusCode.Forbidden);

        var rate = await FindRate(request.ProductId, request.DistributorId ?? request.CustomerId, request.RefillType, request.JarOwnerType, request.FilledDeliveredQuantity, request.DeliveredAt);
        if (rate is null && !request.ManualUnitRate.HasValue)
            return Failure<object>("No effective 20L rate rule found; provide an authorized manual rate or configure a rate rule.", "Rate unavailable", HttpStatusCode.UnprocessableEntity);
        if (rate?.RequiresAuthorization == true && !request.ManualUnitRate.HasValue)
            return Failure<object>("The matching rate rule requires an authorized manual override.", "Authorization required", HttpStatusCode.Forbidden);

        var unitRate = request.ManualUnitRate ?? rate!.UnitRate;
        var subtotal = unitRate * request.FilledDeliveredQuantity;
        var discount = request.DiscountAmount ?? (rate?.DiscountRate ?? 0) * request.FilledDeliveredQuantity;
        var tax = request.TaxAmount ?? Math.Round((subtotal - discount) * (rate?.TaxRate ?? 0) / 100m, 2);
        var companyId = await CompanyId();
        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            var delivery = new TwentyLDelivery
            {
                TenantId = _user.TenantId, CompanyId = companyId, CustomerId = request.CustomerId,
                DistributorId = request.DistributorId, ProductId = request.ProductId, RateRuleId = rate?.Id,
                RefillType = request.RefillType, JarOwnerType = request.JarOwnerType, OrderedQuantity = request.OrderedQuantity,
                FilledDeliveredQuantity = request.FilledDeliveredQuantity, EmptyCollectedQuantity = request.EmptyCollectedQuantity,
                FailedQuantity = request.FailedQuantity, AppliedUnitRate = unitRate, DiscountAmount = discount, TaxAmount = tax,
                TotalAmount = subtotal - discount + tax, AmountCollected = request.AmountCollected, PaymentMode = request.PaymentMode,
                Status = request.FailedQuantity == 0 ? "COMPLETED" : "PARTIALLY_COMPLETED", RouteReference = request.RouteReference,
                VehicleReference = request.VehicleReference, DriverReference = request.DriverReference, DeliveredAt = request.DeliveredAt,
                FailureReason = request.FailureReason, Notes = request.Notes, CreatedAt = DateTime.UtcNow, CreatedBy = _user.UserId ?? string.Empty,
                IdempotencyKey = request.IdempotencyKey
            };
            _db.TwentyLDeliveries.Add(delivery);

            Guid? companyOwner = request.JarOwnerType == "COMPANY" ? null : request.DistributorId ?? request.CustomerId;
            if (request.FilledDeliveredQuantity > 0)
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition(request.JarOwnerType, companyOwner, "COMPANY", null, "PLANT", null, "FILLED", request.ProductId),
                    new TwentyLPosition(request.JarOwnerType, companyOwner, request.DistributorId.HasValue ? "DISTRIBUTOR" : "CUSTOMER", request.DistributorId ?? request.CustomerId, "CUSTOMER", null, "FILLED", request.ProductId),
                    request.FilledDeliveredQuantity, "DELIVERY", delivery.Id, "TwentyLDelivery", request.DeliveredAt, null, request.Notes));
            if (request.EmptyCollectedQuantity > 0)
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition(request.JarOwnerType, companyOwner, request.DistributorId.HasValue ? "DISTRIBUTOR" : "CUSTOMER", request.DistributorId ?? request.CustomerId, "CUSTOMER", null, "EMPTY", request.ProductId),
                    new TwentyLPosition(request.JarOwnerType, companyOwner, "COMPANY", null, "PLANT", null, "EMPTY", request.ProductId),
                    request.EmptyCollectedQuantity, "COLLECTION", delivery.Id, "TwentyLDelivery", request.DeliveredAt, null, request.Notes));

            // Distributor margin/commission is evaluated once and frozen with the delivery.
            var commissionRule = await _db.TwentyLCommissionRules.Where(r => r.TenantId == _user.TenantId && r.IsActive && !r.IsDeleted &&
                    r.BeneficiaryCustomerId == request.DistributorId && (r.ProductId == null || r.ProductId == request.ProductId) && r.MinimumQuantity <= request.FilledDeliveredQuantity &&
                    r.EffectiveFrom <= request.DeliveredAt.Date && (r.EffectiveTo == null || r.EffectiveTo >= request.DeliveredAt.Date))
                .OrderByDescending(r => r.Priority).ThenByDescending(r => r.ProductId != null).FirstOrDefaultAsync();
            if (commissionRule is not null)
            {
                var commission = commissionRule.CalculationType == "PERCENTAGE"
                    ? Math.Round(delivery.TotalAmount * commissionRule.Value / 100m, 2)
                    : commissionRule.Value * delivery.FilledDeliveredQuantity;
                _db.TwentyLCommissionTransactions.Add(new TwentyLCommissionTransaction
                {
                    TenantId = _user.TenantId, CompanyId = companyId, DeliveryId = delivery.Id, RuleId = commissionRule.Id,
                    BeneficiaryCustomerId = commissionRule.BeneficiaryCustomerId, BeneficiaryType = commissionRule.BeneficiaryType,
                    Amount = commission, OccurredAt = request.DeliveredAt, CreatedAt = DateTime.UtcNow, CreatedBy = _user.UserId ?? string.Empty
                });
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Success<object>(new { delivery.Id, delivery.AppliedUnitRate, delivery.TotalAmount }, "20L delivery and its jar ledger entries were recorded.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPost("deliveries/{id}/cancel")]
    public async Task<ActionResult<ApiResponse<object>>> CancelDelivery(Guid id, [FromBody] CancelDeliveryRequest request)
    {
        var delivery = await _db.TwentyLDeliveries.FirstOrDefaultAsync(d => d.Id == id && d.TenantId == _user.TenantId);
        if (delivery == null) return Failure<object>("Delivery not found.", "Resource not found", HttpStatusCode.NotFound);

        if (delivery.Status == "CANCELLED")
            return ValidationError<object>("status", "Delivery is already cancelled.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            return ValidationError<object>("reason", "A cancellation reason is required.");

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            Guid? companyOwner = delivery.JarOwnerType == "COMPANY" ? null : delivery.DistributorId ?? delivery.CustomerId;

            // Compensate delivery: return filled jars from customer back to plant
            if (delivery.FilledDeliveredQuantity > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition(delivery.JarOwnerType, companyOwner, delivery.DistributorId.HasValue ? "DISTRIBUTOR" : "CUSTOMER", delivery.DistributorId ?? delivery.CustomerId, "CUSTOMER", null, "FILLED", delivery.ProductId),
                    new TwentyLPosition(delivery.JarOwnerType, companyOwner, "COMPANY", null, "PLANT", null, "FILLED", delivery.ProductId),
                    delivery.FilledDeliveredQuantity, "DELIVERY_CANCELLATION", delivery.Id, "TwentyLDelivery", DateTime.UtcNow, request.Reason, "Compensating reversal for cancelled delivery."));
            }

            // Compensate collection: return collected empties from plant back to customer
            if (delivery.EmptyCollectedQuantity > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition(delivery.JarOwnerType, companyOwner, "COMPANY", null, "PLANT", null, "EMPTY", delivery.ProductId),
                    new TwentyLPosition(delivery.JarOwnerType, companyOwner, delivery.DistributorId.HasValue ? "DISTRIBUTOR" : "CUSTOMER", delivery.DistributorId ?? delivery.CustomerId, "CUSTOMER", null, "EMPTY", delivery.ProductId),
                    delivery.EmptyCollectedQuantity, "COLLECTION_CANCELLATION", delivery.Id, "TwentyLDelivery", DateTime.UtcNow, request.Reason, "Compensating reversal for cancelled empty collection."));
            }

            // Reverse any earned commission
            var commissions = await _db.TwentyLCommissionTransactions.Where(c => c.DeliveryId == delivery.Id && c.TenantId == _user.TenantId && c.TransactionType == "EARNED").ToListAsync();
            foreach (var comm in commissions)
            {
                _db.TwentyLCommissionTransactions.Add(new TwentyLCommissionTransaction
                {
                    TenantId = _user.TenantId,
                    CompanyId = delivery.CompanyId,
                    DeliveryId = delivery.Id,
                    RuleId = comm.RuleId,
                    BeneficiaryCustomerId = comm.BeneficiaryCustomerId,
                    BeneficiaryType = comm.BeneficiaryType,
                    TransactionType = "REVERSED",
                    Amount = -comm.Amount,
                    OccurredAt = DateTime.UtcNow,
                    ReversalOfId = comm.Id,
                    Reason = request.Reason,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _user.UserId ?? string.Empty
                });
            }

            delivery.Status = "CANCELLED";
            delivery.Notes = string.IsNullOrWhiteSpace(delivery.Notes)
                ? $"Cancelled on {DateTime.UtcNow:u}: {request.Reason}"
                : $"{delivery.Notes} | Cancelled on {DateTime.UtcNow:u}: {request.Reason}";
            delivery.UpdatedAt = DateTime.UtcNow;
            delivery.UpdatedBy = _user.UserId ?? string.Empty;

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new { delivery.Id, delivery.Status }, "Delivery successfully cancelled with compensating jar ledger movements.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    #endregion

    #region 3. Distributor Accounts & Settlements

    [HttpGet("distributors")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributors()
    {
        var customers = await _db.Customers
            .Where(c => c.TenantId == _user.TenantId && !c.IsDeleted && (c.CustomerType == "Distributor" || c.CustomerType == "B2B"))
            .OrderBy(c => c.CustomerName)
            .ToListAsync();

        var customerIds = customers.Select(c => c.Id).ToList();
        var profiles = await _db.TwentyLDistributorProfiles
            .Where(p => p.TenantId == _user.TenantId && customerIds.Contains(p.CustomerId) && !p.IsDeleted)
            .ToDictionaryAsync(p => p.CustomerId, p => p);

        // Derive physical jar balances from movements
        var movements = await _db.TwentyLJarMovements
            .Where(m => m.TenantId == _user.TenantId && (
                (m.ToCustomerId.HasValue && customerIds.Contains(m.ToCustomerId.Value)) ||
                (m.FromCustomerId.HasValue && customerIds.Contains(m.FromCustomerId.Value))
            ))
            .ToListAsync();

        var deliveries = await _db.TwentyLDeliveries
            .Where(d => d.TenantId == _user.TenantId && d.DistributorId.HasValue && customerIds.Contains(d.DistributorId.Value) && d.Status != "CANCELLED")
            .ToListAsync();

        var commissions = await _db.TwentyLCommissionTransactions
            .Where(c => c.TenantId == _user.TenantId && c.BeneficiaryCustomerId.HasValue && customerIds.Contains(c.BeneficiaryCustomerId.Value))
            .ToListAsync();

        var result = customers.Select(c =>
        {
            profiles.TryGetValue(c.Id, out var profile);
            var inMovements = movements.Where(m => m.ToCustomerId == c.Id).Sum(m => m.Quantity);
            var outMovements = movements.Where(m => m.FromCustomerId == c.Id).Sum(m => m.Quantity);
            var netJars = inMovements - outMovements;

            var filledIn = movements.Where(m => m.ToCustomerId == c.Id && m.ContainerStatus == "FILLED").Sum(m => m.Quantity);
            var filledOut = movements.Where(m => m.FromCustomerId == c.Id && m.ContainerStatus == "FILLED").Sum(m => m.Quantity);
            var fullJarsHeld = filledIn - filledOut;

            var emptyIn = movements.Where(m => m.ToCustomerId == c.Id && m.ContainerStatus == "EMPTY").Sum(m => m.Quantity);
            var emptyOut = movements.Where(m => m.FromCustomerId == c.Id && m.ContainerStatus == "EMPTY").Sum(m => m.Quantity);
            var emptyJarsHeld = emptyIn - emptyOut;

            var custDeliveries = deliveries.Where(d => d.DistributorId == c.Id).ToList();
            var totalSales = custDeliveries.Sum(d => d.TotalAmount);
            var totalCollected = custDeliveries.Sum(d => d.AmountCollected);
            var totalEarnedCommission = commissions.Where(cm => cm.BeneficiaryCustomerId == c.Id).Sum(cm => cm.Amount);

            return new
            {
                CustomerId = c.Id,
                c.CustomerName,
                c.CustomerCode,
                c.Phone,
                c.CustomerType,
                Profile = profile != null ? new
                {
                    profile.Id,
                    profile.DistributorType,
                    profile.JarOwnershipModel,
                    profile.VehicleOwnership,
                    profile.RouteOwnership,
                    profile.PricingModel,
                    profile.CommissionModel,
                    profile.CreditLimit,
                    profile.SecurityDeposit,
                    profile.PaymentTerms,
                    profile.EffectiveFrom,
                    profile.EffectiveTo,
                    profile.IsActive
                } : null,
                Physical = new
                {
                    FullJarsHeld = Math.Max(0, fullJarsHeld),
                    EmptyJarsHeld = Math.Max(0, emptyJarsHeld),
                    TotalJarsHeld = Math.Max(0, netJars)
                },
                Commercial = new
                {
                    TotalDeliveries = custDeliveries.Count,
                    TotalSales = totalSales,
                    TotalCollected = totalCollected,
                    CommissionEarned = totalEarnedCommission,
                    NetReceivable = totalSales - totalCollected - totalEarnedCommission
                }
            };
        });

        return Success<object>(result, "Distributor accounts summary retrieved.");
    }

    [HttpGet("distributors/{id}/summary")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorSummary(Guid id)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (customer == null) return Failure<object>("Distributor customer not found.", "Resource not found", HttpStatusCode.NotFound);

        var profile = await _db.TwentyLDistributorProfiles.FirstOrDefaultAsync(p => p.CustomerId == id && p.TenantId == _user.TenantId && !p.IsDeleted);

        var movements = await _db.TwentyLJarMovements
            .Where(m => m.TenantId == _user.TenantId && (m.ToCustomerId == id || m.FromCustomerId == id))
            .OrderByDescending(m => m.OccurredAt)
            .Take(50)
            .ToListAsync();

        var deliveries = await _db.TwentyLDeliveries
            .Where(d => d.TenantId == _user.TenantId && d.DistributorId == id && d.Status != "CANCELLED")
            .OrderByDescending(d => d.DeliveredAt)
            .Take(50)
            .ToListAsync();

        var commissions = await _db.TwentyLCommissionTransactions
            .Where(c => c.TenantId == _user.TenantId && c.BeneficiaryCustomerId == id)
            .OrderByDescending(c => c.OccurredAt)
            .Take(50)
            .ToListAsync();

        var filledIn = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.ToCustomerId == id && m.ContainerStatus == "FILLED").SumAsync(m => (int?)m.Quantity) ?? 0;
        var filledOut = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.FromCustomerId == id && m.ContainerStatus == "FILLED").SumAsync(m => (int?)m.Quantity) ?? 0;

        var emptyIn = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.ToCustomerId == id && m.ContainerStatus == "EMPTY").SumAsync(m => (int?)m.Quantity) ?? 0;
        var emptyOut = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.FromCustomerId == id && m.ContainerStatus == "EMPTY").SumAsync(m => (int?)m.Quantity) ?? 0;

        var totalSales = await _db.TwentyLDeliveries.Where(d => d.TenantId == _user.TenantId && d.DistributorId == id && d.Status != "CANCELLED").SumAsync(d => (decimal?)d.TotalAmount) ?? 0m;
        var totalCollected = await _db.TwentyLDeliveries.Where(d => d.TenantId == _user.TenantId && d.DistributorId == id && d.Status != "CANCELLED").SumAsync(d => (decimal?)d.AmountCollected) ?? 0m;
        var totalCommission = await _db.TwentyLCommissionTransactions.Where(c => c.TenantId == _user.TenantId && c.BeneficiaryCustomerId == id).SumAsync(c => (decimal?)c.Amount) ?? 0m;

        return Success<object>(new
        {
            Customer = new { customer.Id, customer.CustomerName, customer.CustomerCode, customer.Phone, customer.CustomerType },
            Profile = profile,
            Physical = new
            {
                FullJarsHeld = Math.Max(0, filledIn - filledOut),
                EmptyJarsHeld = Math.Max(0, emptyIn - emptyOut),
                TotalJarsInPossession = Math.Max(0, (filledIn - filledOut) + (emptyIn - emptyOut))
            },
            Commercial = new
            {
                TotalSales = totalSales,
                TotalCollected = totalCollected,
                CommissionEarned = totalCommission,
                NetReceivable = totalSales - totalCollected - totalCommission
            },
            RecentDeliveries = deliveries,
            RecentMovements = movements,
            RecentCommissions = commissions
        }, "Distributor details and jar accountability retrieved.");
    }

    [HttpPost("distributors/profile")]
    public async Task<ActionResult<ApiResponse<object>>> SaveDistributorProfile([FromBody] SaveDistributorProfileRequest request)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (customer == null) return Failure<object>("Customer not found.", "Resource not found", HttpStatusCode.NotFound);

        var profile = await _db.TwentyLDistributorProfiles.FirstOrDefaultAsync(p => p.CustomerId == request.CustomerId && p.TenantId == _user.TenantId && !p.IsDeleted);

        if (profile == null)
        {
            profile = new TwentyLDistributorProfile
            {
                TenantId = _user.TenantId,
                CompanyId = await CompanyId(),
                CustomerId = request.CustomerId,
                DistributorType = request.DistributorType ?? "EXTERNAL",
                JarOwnershipModel = request.JarOwnershipModel ?? "MIXED",
                VehicleOwnership = request.VehicleOwnership ?? "DISTRIBUTOR",
                RouteOwnership = request.RouteOwnership ?? "DISTRIBUTOR",
                PricingModel = request.PricingModel ?? "RATE_CARD",
                CommissionModel = request.CommissionModel ?? "NONE",
                CreditLimit = request.CreditLimit,
                SecurityDeposit = request.SecurityDeposit,
                PaymentTerms = request.PaymentTerms,
                EffectiveFrom = request.EffectiveFrom?.Date ?? DateTime.UtcNow.Date,
                EffectiveTo = request.EffectiveTo?.Date,
                IsActive = request.IsActive,
                AgreementReference = request.AgreementReference,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _user.UserId ?? string.Empty
            };
            _db.TwentyLDistributorProfiles.Add(profile);
        }
        else
        {
            profile.DistributorType = request.DistributorType ?? profile.DistributorType;
            profile.JarOwnershipModel = request.JarOwnershipModel ?? profile.JarOwnershipModel;
            profile.VehicleOwnership = request.VehicleOwnership ?? profile.VehicleOwnership;
            profile.RouteOwnership = request.RouteOwnership ?? profile.RouteOwnership;
            profile.PricingModel = request.PricingModel ?? profile.PricingModel;
            profile.CommissionModel = request.CommissionModel ?? profile.CommissionModel;
            profile.CreditLimit = request.CreditLimit;
            profile.SecurityDeposit = request.SecurityDeposit;
            profile.PaymentTerms = request.PaymentTerms;
            profile.EffectiveFrom = request.EffectiveFrom?.Date ?? profile.EffectiveFrom;
            profile.EffectiveTo = request.EffectiveTo?.Date;
            profile.IsActive = request.IsActive;
            profile.AgreementReference = request.AgreementReference;
            profile.UpdatedAt = DateTime.UtcNow;
            profile.UpdatedBy = _user.UserId ?? string.Empty;
        }

        await _db.SaveChangesAsync();
        return Success<object>(new { profile.Id }, "Distributor commercial profile saved.");
    }

    [HttpGet("distributors/{id}/settlement-preview")]
    public async Task<ActionResult<ApiResponse<object>>> PreviewSettlement(
        Guid id,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-30)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date.AddDays(1);

        var deliveries = await _db.TwentyLDeliveries
            .Where(d => d.TenantId == _user.TenantId && d.DistributorId == id && d.DeliveredAt >= start && d.DeliveredAt < end && d.Status != "CANCELLED")
            .ToListAsync();

        var commissions = await _db.TwentyLCommissionTransactions
            .Where(c => c.TenantId == _user.TenantId && c.BeneficiaryCustomerId == id && c.OccurredAt >= start && c.OccurredAt < end)
            .ToListAsync();

        var totalSales = deliveries.Sum(d => d.TotalAmount);
        var totalCollected = deliveries.Sum(d => d.AmountCollected);
        var totalCommission = commissions.Sum(c => c.Amount);

        return Success<object>(new
        {
            DistributorId = id,
            PeriodStart = start,
            PeriodEnd = end.AddDays(-1),
            TotalDeliveries = deliveries.Count,
            TotalFilledDelivered = deliveries.Sum(d => d.FilledDeliveredQuantity),
            TotalEmptyCollected = deliveries.Sum(d => d.EmptyCollectedQuantity),
            TotalSalesAmount = totalSales,
            TotalCollectedAmount = totalCollected,
            TotalCommissionEarned = totalCommission,
            NetPayable = totalSales - totalCollected - totalCommission
        }, "Settlement preview calculated.");
    }

    #endregion

    #region 4. Driver & Fleet Accountability

    [HttpGet("drivers/summary")]
    public async Task<ActionResult<ApiResponse<object>>> GetDriversSummary([FromQuery] DateTime? day = null)
    {
        var date = (day ?? DateTime.UtcNow).Date;
        var next = date.AddDays(1);

        var deliveriesToday = await _db.TwentyLDeliveries
            .Where(d => d.TenantId == _user.TenantId && d.DeliveredAt >= date && d.DeliveredAt < next && d.Status != "CANCELLED")
            .ToListAsync();

        var driverGroups = deliveriesToday
            .GroupBy(d => string.IsNullOrWhiteSpace(d.DriverReference) ? "Unassigned Driver" : d.DriverReference)
            .Select(g => new
            {
                DriverName = g.Key,
                Vehicle = g.Select(d => d.VehicleReference).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "N/A",
                TotalDeliveries = g.Count(),
                FilledDelivered = g.Sum(d => d.FilledDeliveredQuantity),
                EmptyCollected = g.Sum(d => d.EmptyCollectedQuantity),
                Failed = g.Sum(d => d.FailedQuantity),
                TotalAmount = g.Sum(d => d.TotalAmount),
                AmountCollected = g.Sum(d => d.AmountCollected),
                PendingEmptiesInHand = Math.Max(0, g.Sum(d => d.EmptyCollectedQuantity))
            })
            .ToList();

        return Success<object>(new
        {
            Day = date,
            TotalDriversActive = driverGroups.Count,
            Drivers = driverGroups
        }, "Driver accountability summary retrieved.");
    }

    #endregion

    #region 5. Customer 20L Position & Account

    [HttpGet("customers/{customerId}/jar-position")]
    public async Task<ActionResult<ApiResponse<object>>> GetCustomerJarPosition(Guid customerId)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (customer == null) return Failure<object>("Customer not found.", "Resource not found", HttpStatusCode.NotFound);

        var filledIn = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.ToCustomerId == customerId && m.ContainerStatus == "FILLED").SumAsync(m => (int?)m.Quantity) ?? 0;
        var filledOut = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.FromCustomerId == customerId && m.ContainerStatus == "FILLED").SumAsync(m => (int?)m.Quantity) ?? 0;
        var fullJarsHeld = Math.Max(0, filledIn - filledOut);

        var emptyIn = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.ToCustomerId == customerId && m.ContainerStatus == "EMPTY").SumAsync(m => (int?)m.Quantity) ?? 0;
        var emptyOut = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.FromCustomerId == customerId && m.ContainerStatus == "EMPTY").SumAsync(m => (int?)m.Quantity) ?? 0;
        var emptyJarsHeld = Math.Max(0, emptyIn - emptyOut);

        var lastDelivery = await _db.TwentyLDeliveries
            .Where(d => d.TenantId == _user.TenantId && d.CustomerId == customerId && d.Status != "CANCELLED")
            .OrderByDescending(d => d.DeliveredAt)
            .FirstOrDefaultAsync();

        var recentDeliveries = await _db.TwentyLDeliveries
            .Where(d => d.TenantId == _user.TenantId && d.CustomerId == customerId)
            .OrderByDescending(d => d.DeliveredAt)
            .Take(10)
            .ToListAsync();

        var recentMovements = await _db.TwentyLJarMovements
            .Where(m => m.TenantId == _user.TenantId && (m.ToCustomerId == customerId || m.FromCustomerId == customerId))
            .OrderByDescending(m => m.OccurredAt)
            .Take(10)
            .ToListAsync();

        return Success<object>(new
        {
            CustomerId = customer.Id,
            customer.CustomerName,
            customer.CustomerCode,
            customer.Phone,
            customer.JarDeposit,
            FullJarsHeld = fullJarsHeld,
            EmptyJarsHeld = emptyJarsHeld,
            TotalJarsHeld = fullJarsHeld + emptyJarsHeld,
            LastDelivery = lastDelivery != null ? new
            {
                lastDelivery.Id,
                lastDelivery.DeliveredAt,
                lastDelivery.FilledDeliveredQuantity,
                lastDelivery.EmptyCollectedQuantity,
                lastDelivery.TotalAmount,
                lastDelivery.Status
            } : null,
            RecentDeliveries = recentDeliveries,
            RecentMovements = recentMovements
        }, "Customer jar position and ledger history retrieved.");
    }

    #endregion

    #region 6. Container Ledger Movements & Positions

    [HttpGet("ledger")]
    [HttpGet("jar-movements")]
    public async Task<ActionResult<ApiResponse<object>>> GetJarMovements(
        [FromQuery] string? movementType = null,
        [FromQuery] string? containerStatus = null,
        [FromQuery] string? fromLocationType = null,
        [FromQuery] string? toLocationType = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId);

        if (!string.IsNullOrWhiteSpace(movementType) && movementType != "ALL")
            query = query.Where(m => m.MovementType == movementType);
        if (!string.IsNullOrWhiteSpace(containerStatus) && containerStatus != "ALL")
            query = query.Where(m => m.ContainerStatus == containerStatus);
        if (!string.IsNullOrWhiteSpace(fromLocationType) && fromLocationType != "ALL")
            query = query.Where(m => m.FromLocationType == fromLocationType);
        if (!string.IsNullOrWhiteSpace(toLocationType) && toLocationType != "ALL")
            query = query.Where(m => m.ToLocationType == toLocationType);
        if (customerId.HasValue && customerId.Value != Guid.Empty)
            query = query.Where(m => m.ToCustomerId == customerId.Value || m.FromCustomerId == customerId.Value || m.OwnerCustomerId == customerId.Value);
        if (dateFrom.HasValue)
            query = query.Where(m => m.OccurredAt >= dateFrom.Value.Date);
        if (dateTo.HasValue)
            query = query.Where(m => m.OccurredAt < dateTo.Value.Date.AddDays(1));

        var total = await query.CountAsync();
        var movements = await query
            .OrderByDescending(m => m.OccurredAt)
            .ThenByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var customerIds = movements
            .SelectMany(m => new[] { m.OwnerCustomerId, m.FromCustomerId, m.ToCustomerId, m.HolderCustomerId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var customerMap = await _db.Customers.Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);

        var items = movements.Select(m => new
        {
            m.Id,
            m.MovementType,
            m.ContainerStatus,
            m.Quantity,
            m.OwnerType,
            OwnerName = m.OwnerCustomerId.HasValue && customerMap.TryGetValue(m.OwnerCustomerId.Value, out var oName) ? oName : (m.OwnerType == "COMPANY" ? "Plant (Company)" : "Unknown"),
            m.HolderType,
            HolderName = m.HolderCustomerId.HasValue && customerMap.TryGetValue(m.HolderCustomerId.Value, out var hName) ? hName : (m.HolderType == "COMPANY" ? "Plant (Company)" : "Unknown"),
            m.FromLocationType,
            FromCustomerName = m.FromCustomerId.HasValue && customerMap.TryGetValue(m.FromCustomerId.Value, out var fromName) ? fromName : m.FromLocationType,
            m.FromLocationReference,
            m.ToLocationType,
            ToCustomerName = m.ToCustomerId.HasValue && customerMap.TryGetValue(m.ToCustomerId.Value, out var toName) ? toName : m.ToLocationType,
            m.ToLocationReference,
            m.ReferenceId,
            m.ReferenceType,
            m.OccurredAt,
            m.Reason,
            m.Notes,
            m.CreatedAt,
            m.CreatedBy
        });

        return Success<object>(new { items, total, page, pageSize }, "Jar movements retrieved successfully.");
    }

    [HttpGet("jar-movements/summary")]
    [HttpGet("movements/summary")]
    public async Task<ActionResult<ApiResponse<object>>> GetJarMovementsSummary(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null)
    {
        var movementsQuery = _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId);
        var suppliesQuery = _db.TwentyLDistributorSupplies.Where(s => s.TenantId == _user.TenantId && s.Stage != "CANCELLED");

        if (dateFrom.HasValue)
        {
            movementsQuery = movementsQuery.Where(m => m.OccurredAt >= dateFrom.Value.Date);
            suppliesQuery = suppliesQuery.Where(s => (s.DispatchedAt ?? s.CreatedAt) >= dateFrom.Value.Date);
        }
        if (dateTo.HasValue)
        {
            var endOfDay = dateTo.Value.Date.AddDays(1);
            movementsQuery = movementsQuery.Where(m => m.OccurredAt < endOfDay);
            suppliesQuery = suppliesQuery.Where(s => (s.DispatchedAt ?? s.CreatedAt) < endOfDay);
        }

        var movements = await movementsQuery.ToListAsync();
        var supplies = await suppliesQuery.ToListAsync();

        // 1. Out: Jars leaving plant / dispatches / supplies
        int movementsOut = movements
            .Where(m => (m.FromLocationType == "PLANT" && m.ToLocationType != "PLANT") ||
                        m.MovementType == "DISPATCH" || m.MovementType == "SUPPLY" || m.MovementType == "ISSUE")
            .Sum(m => m.Quantity);

        int suppliesOut = supplies.Sum(s => s.QuantitySupplied);

        var supplyRefIds = supplies.Select(s => (Guid?)s.Id).ToHashSet();
        int movementsFromSupplies = movements
            .Where(m => m.ReferenceId.HasValue && supplyRefIds.Contains(m.ReferenceId.Value))
            .Sum(m => m.Quantity);

        int totalOut = (movementsOut - movementsFromSupplies) + suppliesOut;

        // 2. Back: Empty jars returned to plant
        int movementsBack = movements
            .Where(m => (m.ToLocationType == "PLANT" && m.FromLocationType != "PLANT") ||
                        m.MovementType == "RETURN" || m.MovementType == "RETURN_EMPTY" || m.MovementType == "COLLECTION")
            .Sum(m => m.Quantity);

        int suppliesBack = supplies.Sum(s => s.QuantityEmptyReturned);

        int movementsBackFromSupplies = movements
            .Where(m => m.ReferenceId.HasValue && supplyRefIds.Contains(m.ReferenceId.Value) && (m.MovementType == "RETURN" || m.MovementType == "RETURN_EMPTY"))
            .Sum(m => m.Quantity);

        int totalBack = (movementsBack - movementsBackFromSupplies) + suppliesBack;

        // 3. Damaged jars
        int damaged = movements.Where(m => m.ContainerStatus == "DAMAGED" || m.MovementType == "DAMAGE").Sum(m => m.Quantity);

        int netMovement = totalOut - totalBack;

        return Success<object>(new
        {
            TotalOut = totalOut,
            TotalBack = totalBack,
            TotalDamaged = damaged,
            NetMovement = netMovement,
            MovementCount = movements.Count + supplies.Count,
            HasData = movements.Any() || supplies.Any()
        }, "Jar movement summary retrieved successfully.");
    }

    [HttpPost("ledger/movement")]
    [HttpPost("jar-movements")]
    public async Task<ActionResult<ApiResponse<object>>> RecordJarMovement(CreateTwentyLJarMovementRequest request)
    {
        if (request.Quantity <= 0 || string.IsNullOrWhiteSpace(request.MovementType))
            return ValidationError<object>("movement", "Quantity must be positive and a movement type is required.");
        if (request.FromLocationType == request.ToLocationType && request.FromHolderCustomerId == request.HolderCustomerId)
            return ValidationError<object>("movement", "A movement must change a holder or location.");

        try
        {
            var source = new TwentyLPosition(request.OwnerType, request.OwnerCustomerId, request.FromHolderType, request.FromHolderCustomerId, request.FromLocationType, request.FromLocationReference, request.FromContainerStatus, request.ProductId);
            var destination = new TwentyLPosition(request.OwnerType, request.OwnerCustomerId, request.HolderType, request.HolderCustomerId, request.ToLocationType, request.ToLocationReference, request.ContainerStatus, request.ProductId);
            var movement = await _ledger.PostAsync(new TwentyLPostingRequest(source, destination, request.Quantity, request.MovementType, request.ReferenceId, request.ReferenceType, request.OccurredAt ?? DateTime.UtcNow, request.Reason, request.Notes, request.MovementType == "OPENING_BALANCE", request.MovementType == "PURCHASE", request.MovementType == "ADJUSTMENT"));
            return Success<object>(new { movement.Id }, "20L jar movement recorded.");
        }
        catch (UnauthorizedAccessException ex) { return Failure<object>(ex.Message, "Authorization required", HttpStatusCode.Forbidden); }
        catch (InvalidOperationException ex) { return ValidationError<object>("movement", ex.Message); }
    }

    [HttpGet("positions")]
    [HttpGet("jar-positions")]
    public async Task<ActionResult<ApiResponse<object>>> GetJarPositions()
    {
        var positions = await _db.TwentyLJarPositions
            .Where(p => p.TenantId == _user.TenantId && p.Quantity != 0)
            .OrderBy(p => p.LocationType)
            .ThenBy(p => p.ContainerStatus)
            .ToListAsync();

        var customerIds = positions
            .SelectMany(p => new[] { p.OwnerCustomerId, p.HolderCustomerId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var customerMap = await _db.Customers.Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);

        var items = positions.Select(p => new
        {
            p.Id,
            p.PositionKey,
            p.LocationType,
            p.LocationReference,
            p.ContainerStatus,
            p.Quantity,
            p.OwnerType,
            OwnerName = p.OwnerCustomerId.HasValue && customerMap.TryGetValue(p.OwnerCustomerId.Value, out var oName) ? oName : (p.OwnerType == "COMPANY" ? "Plant" : "Unknown"),
            p.HolderType,
            HolderName = p.HolderCustomerId.HasValue && customerMap.TryGetValue(p.HolderCustomerId.Value, out var hName) ? hName : (p.HolderType == "COMPANY" ? "Plant" : "Unknown")
        });

        return Success<object>(items, "Current jar positions projection retrieved.");
    }

    [HttpGet("jar-balances")]
    public async Task<ActionResult<ApiResponse<object>>> JarBalances(Guid? ownerCustomerId = null)
    {
        var movements = _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId);
        if (ownerCustomerId.HasValue) movements = movements.Where(m => m.OwnerCustomerId == ownerCustomerId);
        var entries = await movements.ToListAsync();
        var result = entries
            .Select(m => new { m.OwnerType, m.OwnerCustomerId, locationType = m.ToLocationType, holderId = m.ToCustomerId, containerStatus = m.ContainerStatus, quantity = m.Quantity })
            .Concat(entries.Select(m => new { m.OwnerType, m.OwnerCustomerId, locationType = m.FromLocationType, holderId = m.FromCustomerId, containerStatus = m.ContainerStatus, quantity = -m.Quantity }))
            .GroupBy(x => new { x.OwnerType, x.OwnerCustomerId, x.locationType, x.holderId, x.containerStatus })
            .Select(g => new { g.Key.OwnerType, g.Key.OwnerCustomerId, g.Key.locationType, g.Key.holderId, g.Key.containerStatus, quantity = g.Sum(x => x.quantity) })
            .Where(x => x.quantity != 0)
            .OrderBy(x => x.OwnerType).ThenBy(x => x.locationType).ToList();
        return Success<object>(result, "Jar balances are ledger-derived; use movement history for reconciliation.");
    }

    #endregion

    #region 7. Commission Rules & Transactions

    [HttpGet("commission-rules")]
    public async Task<ActionResult<ApiResponse<object>>> GetCommissionRules()
    {
        var rules = await _db.TwentyLCommissionRules
            .Where(r => r.TenantId == _user.TenantId && !r.IsDeleted)
            .OrderByDescending(r => r.Priority)
            .ThenByDescending(r => r.EffectiveFrom)
            .ToListAsync();

        var customerIds = rules.Where(r => r.BeneficiaryCustomerId.HasValue).Select(r => r.BeneficiaryCustomerId!.Value).Distinct().ToList();
        var customerMap = await _db.Customers.Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);

        var items = rules.Select(r => new
        {
            r.Id,
            r.BeneficiaryCustomerId,
            BeneficiaryName = r.BeneficiaryCustomerId.HasValue && customerMap.TryGetValue(r.BeneficiaryCustomerId.Value, out var bName) ? bName : "All Distributors/Beneficiaries",
            r.BeneficiaryType,
            r.CalculationType,
            r.Value,
            r.MinimumQuantity,
            r.EffectiveFrom,
            r.EffectiveTo,
            r.Priority,
            r.IsActive,
            r.CreatedAt,
            r.CreatedBy
        });

        return Success<object>(items, "Commission rules retrieved.");
    }

    [HttpPost("commission-rules")]
    public async Task<ActionResult<ApiResponse<object>>> CreateCommissionRule(CreateTwentyLCommissionRuleRequest request)
    {
        if (request.Value < 0 || request.MinimumQuantity < 0 || (request.EffectiveTo.HasValue && request.EffectiveTo < request.EffectiveFrom) ||
            request.CalculationType is not ("PERCENTAGE" or "FIXED_PER_UNIT"))
            return ValidationError<object>("commissionRule", "Commission rule values, dates, or calculation type are invalid.");
        var rule = new TwentyLCommissionRule
        {
            TenantId = _user.TenantId, CompanyId = await CompanyId(), BeneficiaryCustomerId = request.BeneficiaryCustomerId,
            ProductId = request.ProductId, BeneficiaryType = request.BeneficiaryType, CalculationType = request.CalculationType,
            Value = request.Value, MinimumQuantity = request.MinimumQuantity, EffectiveFrom = request.EffectiveFrom.Date,
            EffectiveTo = request.EffectiveTo?.Date, Priority = request.Priority, CreatedAt = DateTime.UtcNow, CreatedBy = _user.UserId ?? string.Empty
        };
        _db.TwentyLCommissionRules.Add(rule);
        await _db.SaveChangesAsync();
        return Success<object>(new { rule.Id }, "20L commission rule created.");
    }

    [HttpGet("commission-transactions")]
    public async Task<ActionResult<ApiResponse<object>>> GetCommissionTransactions([FromQuery] Guid? beneficiaryId = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLCommissionTransactions.Where(c => c.TenantId == _user.TenantId);
        if (beneficiaryId.HasValue && beneficiaryId.Value != Guid.Empty)
            query = query.Where(c => c.BeneficiaryCustomerId == beneficiaryId.Value);

        var total = await query.CountAsync();
        var list = await query
            .OrderByDescending(c => c.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var customerIds = list.Where(c => c.BeneficiaryCustomerId.HasValue).Select(c => c.BeneficiaryCustomerId!.Value).Distinct().ToList();
        var customerMap = await _db.Customers.Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);

        var items = list.Select(c => new
        {
            c.Id,
            c.DeliveryId,
            c.BeneficiaryCustomerId,
            BeneficiaryName = c.BeneficiaryCustomerId.HasValue && customerMap.TryGetValue(c.BeneficiaryCustomerId.Value, out var bName) ? bName : "Unknown",
            c.BeneficiaryType,
            c.TransactionType,
            c.Amount,
            c.OccurredAt,
            c.Reason,
            c.CreatedAt,
            c.CreatedBy
        });

        return Success<object>(new { items, total, page, pageSize }, "Commission transactions retrieved.");
    }

    #endregion

    #region 8. Dashboard & Data Reconciliation

    [HttpGet("dashboard")]
    public async Task<ActionResult<ApiResponse<object>>> Dashboard([FromQuery] DateTime? day = null)
    {
        var date = (day ?? DateTime.UtcNow).Date;
        var next = date.AddDays(1);
        var deliveries = _db.TwentyLDeliveries.Where(d => d.TenantId == _user.TenantId && d.DeliveredAt >= date && d.DeliveredAt < next && d.Status != "CANCELLED");
        var movements = _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId && m.OccurredAt >= date && m.OccurredAt < next);

        // Plant stock
        var plantFull = await _db.TwentyLJarPositions
            .Where(p => p.TenantId == _user.TenantId && p.LocationType == "PLANT" && p.ContainerStatus == "FILLED")
            .SumAsync(p => (int?)p.Quantity) ?? 0;

        var plantEmpty = await _db.TwentyLJarPositions
            .Where(p => p.TenantId == _user.TenantId && p.LocationType == "PLANT" && p.ContainerStatus == "EMPTY")
            .SumAsync(p => (int?)p.Quantity) ?? 0;

        var customerHeld = await _db.TwentyLJarPositions
            .Where(p => p.TenantId == _user.TenantId && p.LocationType == "CUSTOMER")
            .SumAsync(p => (int?)p.Quantity) ?? 0;

        var distributorHeld = await _db.TwentyLJarPositions
            .Where(p => p.TenantId == _user.TenantId && (p.LocationType == "DISTRIBUTOR" || p.HolderType == "DISTRIBUTOR"))
            .SumAsync(p => (int?)p.Quantity) ?? 0;

        return Success<object>(new
        {
            day = date,
            deliveries = await deliveries.CountAsync(),
            filledDelivered = await deliveries.SumAsync(d => (int?)d.FilledDeliveredQuantity) ?? 0,
            emptyCollected = await deliveries.SumAsync(d => (int?)d.EmptyCollectedQuantity) ?? 0,
            failed = await deliveries.SumAsync(d => (int?)d.FailedQuantity) ?? 0,
            collections = await deliveries.SumAsync(d => (decimal?)d.AmountCollected) ?? 0m,
            revenue = await deliveries.SumAsync(d => (decimal?)d.TotalAmount) ?? 0m,
            pendingDeliveries = await _db.TwentyLDeliveries.CountAsync(d => d.TenantId == _user.TenantId && d.Status == "PENDING"),
            lostOrDamaged = await movements.Where(m => m.MovementType == "LOSS" || m.MovementType == "DAMAGE").SumAsync(m => (int?)m.Quantity) ?? 0,
            plantAvailableFullJars = Math.Max(0, plantFull),
            plantAvailableEmptyJars = Math.Max(0, plantEmpty),
            totalJarsWithCustomers = Math.Max(0, customerHeld),
            totalJarsWithDistributors = Math.Max(0, distributorHeld)
        });
    }

    [HttpGet("reconciliation")]
    public async Task<ActionResult<ApiResponse<object>>> ReconcileLedger()
    {
        // 1. Check sum of movements vs position quantities
        var allMovements = await _db.TwentyLJarMovements.Where(m => m.TenantId == _user.TenantId).ToListAsync();
        var allPositions = await _db.TwentyLJarPositions.Where(p => p.TenantId == _user.TenantId).ToListAsync();

        var ledgerIn = allMovements
            .GroupBy(m => Key(m.CompanyId, new TwentyLPosition(m.OwnerType, m.OwnerCustomerId, m.HolderType, m.HolderCustomerId, m.ToLocationType, m.ToLocationReference, m.ContainerStatus, m.ProductId)))
            .ToDictionary(g => g.Key, g => g.Sum(m => m.Quantity));

        var ledgerOut = allMovements
            .Where(m => m.MovementType != "OPENING_BALANCE" && m.MovementType != "PURCHASE")
            .GroupBy(m => Key(m.CompanyId, new TwentyLPosition(m.OwnerType, m.OwnerCustomerId, m.HolderType, m.HolderCustomerId, m.FromLocationType, m.FromLocationReference, m.ContainerStatus, m.ProductId)))
            .ToDictionary(g => g.Key, g => g.Sum(m => m.Quantity));

        var anomalies = new List<object>();

        foreach (var pos in allPositions)
        {
            var calculatedIn = ledgerIn.TryGetValue(pos.PositionKey, out var cin) ? cin : 0;
            var calculatedOut = ledgerOut.TryGetValue(pos.PositionKey, out var cout) ? cout : 0;
            var expected = calculatedIn - calculatedOut;

            if (pos.Quantity < 0)
            {
                anomalies.Add(new
                {
                    Type = "NEGATIVE_POSITION",
                    pos.PositionKey,
                    pos.Quantity,
                    Expected = expected,
                    Message = "Position projection quantity is negative."
                });
            }
        }

        // 2. Check deliveries with missing movement links
        var deliveries = await _db.TwentyLDeliveries.Where(d => d.TenantId == _user.TenantId && d.Status == "COMPLETED").ToListAsync();
        var linkedMovements = allMovements
            .Where(m => m.ReferenceType == "TwentyLDelivery" && m.ReferenceId.HasValue)
            .GroupBy(m => m.ReferenceId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        int missingMovementDeliveries = 0;
        foreach (var del in deliveries)
        {
            if (!linkedMovements.ContainsKey(del.Id))
            {
                missingMovementDeliveries++;
            }
        }

        return Success<object>(new
        {
            Status = anomalies.Count == 0 && missingMovementDeliveries == 0 ? "RECONCILED_CLEAN" : "ANOMALY_DETECTED",
            TotalLedgerMovements = allMovements.Count,
            TotalPositionsTracked = allPositions.Count,
            TotalCompletedDeliveries = deliveries.Count,
            MissingMovementDeliveries = missingMovementDeliveries,
            AnomaliesCount = anomalies.Count,
            Anomalies = anomalies
        }, "Read-only data reconciliation check completed.");
    }

    #endregion

    #region 9. 20L Trips & Multi-Stop Staged Logistics (Mode A)

    [HttpGet("trips")]
    public async Task<ActionResult<ApiResponse<object>>> GetTrips(
        [FromQuery] string? status = null,
        [FromQuery] string? driverName = null,
        [FromQuery] string? vehicleNumber = null,
        [FromQuery] DateTime? date = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLTrips
            .Include(t => t.Stops)
            .Where(t => t.TenantId == _user.TenantId && !t.IsDeleted);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(t => t.Status == status);
        if (!string.IsNullOrWhiteSpace(driverName))
            query = query.Where(t => t.DriverName.Contains(driverName));
        if (!string.IsNullOrWhiteSpace(vehicleNumber))
            query = query.Where(t => t.VehicleNumber.Contains(vehicleNumber));
        if (date.HasValue)
            query = query.Where(t => t.PlannedDate.Date == date.Value.Date);

        var total = await query.CountAsync();
        var trips = await query
            .OrderByDescending(t => t.PlannedDate)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var customerIds = trips.SelectMany(t => t.Stops.Select(s => s.CustomerId)).Distinct().ToList();
        var customerMap = await _db.Customers.Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);

        var items = trips.Select(t => new
        {
            t.Id,
            t.TripNumber,
            t.DriverName,
            t.VehicleNumber,
            t.RouteCode,
            t.PlannedDate,
            t.Status,
            t.LoadedFilledJars,
            t.LoadedEmptyJars,
            t.DeliveredFilledJars,
            t.CollectedEmptyJars,
            t.ReturnedFilledJars,
            t.ReturnedEmptyJars,
            t.DamagedJarsCount,
            t.LostJarsCount,
            t.TotalTripRevenue,
            t.TotalCashCollected,
            t.ReconciliationStatus,
            t.DiscrepancyNotes,
            t.DispatchedAt,
            t.ReturnedAt,
            t.ReconciledAt,
            StopsCount = t.Stops.Count,
            Stops = t.Stops.OrderBy(s => s.StopSequence).Select(s => new
            {
                s.Id,
                s.StopSequence,
                s.CustomerId,
                CustomerName = customerMap.TryGetValue(s.CustomerId, out var cName) ? cName : "Unknown Customer",
                s.PlannedFilledJars,
                s.DeliveredFilledJars,
                s.CollectedEmptyJars,
                s.DamagedEmptyJars,
                s.LostJars,
                s.UnitRate,
                s.TotalAmount,
                s.AmountCollected,
                s.PaymentMode,
                s.PaymentStatus,
                s.Status,
                s.FailureReason,
                s.DeliveredAt
            })
        });

        return Success<object>(new { items, total, page, pageSize }, "20L Trips retrieved successfully.");
    }

    [HttpGet("trips/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetTripById(Guid id)
    {
        var trip = await _db.TwentyLTrips
            .Include(t => t.Stops)
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == _user.TenantId && !t.IsDeleted);
        if (trip == null) return Failure<object>("Trip not found.", "Resource not found", HttpStatusCode.NotFound);

        var customerIds = trip.Stops.Select(s => s.CustomerId).Distinct().ToList();
        var customerMap = await _db.Customers.Where(c => customerIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.CustomerName);

        var movements = await _db.TwentyLJarMovements
            .Where(m => m.TenantId == _user.TenantId && m.ReferenceId == trip.Id && m.ReferenceType == "TwentyLTrip")
            .OrderBy(m => m.OccurredAt)
            .ToListAsync();

        return Success<object>(new
        {
            trip.Id,
            trip.TripNumber,
            trip.DriverName,
            trip.VehicleNumber,
            trip.RouteCode,
            trip.PlannedDate,
            trip.Status,
            trip.LoadedFilledJars,
            trip.LoadedEmptyJars,
            trip.DeliveredFilledJars,
            trip.CollectedEmptyJars,
            trip.ReturnedFilledJars,
            trip.ReturnedEmptyJars,
            trip.DamagedJarsCount,
            trip.LostJarsCount,
            trip.TotalTripRevenue,
            trip.TotalCashCollected,
            trip.ReconciliationStatus,
            trip.DiscrepancyNotes,
            trip.DispatchedAt,
            trip.ReturnedAt,
            trip.ReconciledAt,
            Stops = trip.Stops.OrderBy(s => s.StopSequence).Select(s => new
            {
                s.Id,
                s.StopSequence,
                s.CustomerId,
                CustomerName = customerMap.TryGetValue(s.CustomerId, out var cName) ? cName : "Unknown Customer",
                s.PlannedFilledJars,
                s.DeliveredFilledJars,
                s.CollectedEmptyJars,
                s.DamagedEmptyJars,
                s.LostJars,
                s.UnitRate,
                s.TotalAmount,
                s.AmountCollected,
                s.PaymentMode,
                s.PaymentStatus,
                s.Status,
                s.FailureReason,
                s.DeliveredAt
            }),
            Movements = movements
        }, "Trip details retrieved.");
    }

    [HttpPost("trips")]
    public async Task<ActionResult<ApiResponse<object>>> CreateTrip([FromBody] CreateTwentyLTripRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DriverName) || string.IsNullOrWhiteSpace(request.VehicleNumber))
            return ValidationError<object>("driver", "Driver name and Vehicle number are required.");

        var companyId = await CompanyId();
        var tripNumber = $"TRIP-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";

        var trip = new TwentyLTrip
        {
            TenantId = _user.TenantId,
            CompanyId = companyId,
            TripNumber = tripNumber,
            DriverName = request.DriverName,
            DriverCustomerId = request.DriverCustomerId,
            VehicleNumber = request.VehicleNumber,
            RouteCode = request.RouteCode,
            PlannedDate = request.PlannedDate.Date,
            Status = "PLANNED",
            ReconciliationStatus = "PENDING",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _user.UserId ?? "System"
        };

        int seq = 1;
        if (request.Stops != null && request.Stops.Count > 0)
        {
            foreach (var stopReq in request.Stops)
            {
                trip.Stops.Add(new TwentyLTripStop
                {
                    TenantId = _user.TenantId,
                    CompanyId = companyId,
                    StopSequence = seq++,
                    CustomerId = stopReq.CustomerId,
                    ProductId = stopReq.ProductId,
                    PlannedFilledJars = stopReq.PlannedFilledJars,
                    UnitRate = stopReq.UnitRate,
                    Status = "PENDING",
                    PaymentMode = stopReq.PaymentMode ?? "CREDIT",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _user.UserId ?? "System"
                });
            }
        }

        _db.TwentyLTrips.Add(trip);
        await _db.SaveChangesAsync();

        return Success<object>(new { trip.Id, trip.TripNumber }, "20L Trip planned successfully.");
    }

    [HttpPost("trips/{id}/load")]
    public async Task<ActionResult<ApiResponse<object>>> LoadTrip(Guid id, [FromBody] LoadTwentyLTripRequest request)
    {
        var trip = await _db.TwentyLTrips.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == _user.TenantId && !t.IsDeleted);
        if (trip == null) return Failure<object>("Trip not found.", "Resource not found", HttpStatusCode.NotFound);

        if (trip.Status != "PLANNED" && trip.Status != "LOADED")
            return ValidationError<object>("status", "Only Planned trips can be loaded.");

        if (request.FilledQuantity <= 0 && request.EmptyQuantity <= 0)
            return ValidationError<object>("quantity", "At least 1 filled or empty jar must be loaded.");

        var companyId = await CompanyId();

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            // 1. Post filled jar movement: Plant -> Vehicle
            if (request.FilledQuantity > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "FILLED", request.ProductId),
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "FILLED", request.ProductId),
                    request.FilledQuantity,
                    "PLANT_LOADING",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Vehicle {trip.VehicleNumber} loaded with {request.FilledQuantity} filled jars for Trip {trip.TripNumber}",
                    request.Notes
                ));
            }

            // 2. Post empty jar movement if vehicle takes empties: Plant -> Vehicle
            if (request.EmptyQuantity > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", request.ProductId),
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "EMPTY", request.ProductId),
                    request.EmptyQuantity,
                    "PLANT_LOADING",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Vehicle {trip.VehicleNumber} loaded with {request.EmptyQuantity} buffer empty jars",
                    request.Notes
                ));
            }

            trip.LoadedFilledJars += request.FilledQuantity;
            trip.LoadedEmptyJars += request.EmptyQuantity;
            trip.Status = "LOADED";
            trip.UpdatedAt = DateTime.UtcNow;
            trip.UpdatedBy = _user.UserId ?? "System";

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new { trip.Id, trip.LoadedFilledJars, trip.LoadedEmptyJars, trip.Status }, "Vehicle loaded and plant inventory updated.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPost("trips/{id}/dispatch")]
    public async Task<ActionResult<ApiResponse<object>>> DispatchTrip(Guid id)
    {
        var trip = await _db.TwentyLTrips.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == _user.TenantId && !t.IsDeleted);
        if (trip == null) return Failure<object>("Trip not found.", "Resource not found", HttpStatusCode.NotFound);

        if (trip.Status != "LOADED")
            return ValidationError<object>("status", "Trip must be loaded before dispatch.");

        trip.Status = "DISPATCHED";
        trip.DispatchedAt = DateTime.UtcNow;
        trip.UpdatedAt = DateTime.UtcNow;
        trip.UpdatedBy = _user.UserId ?? "System";

        await _db.SaveChangesAsync();
        return Success<object>(new { trip.Id, trip.Status, trip.DispatchedAt }, "Trip dispatched to route.");
    }

    [HttpPost("trips/{id}/deliver-stop")]
    public async Task<ActionResult<ApiResponse<object>>> DeliverTripStop(Guid id, [FromBody] DeliverTripStopRequest request)
    {
        var trip = await _db.TwentyLTrips.Include(t => t.Stops).FirstOrDefaultAsync(t => t.Id == id && t.TenantId == _user.TenantId && !t.IsDeleted);
        if (trip == null) return Failure<object>("Trip not found.", "Resource not found", HttpStatusCode.NotFound);

        var stop = trip.Stops.FirstOrDefault(s => s.Id == request.StopId);
        if (stop == null) return Failure<object>("Stop not found on this trip.", "Resource not found", HttpStatusCode.NotFound);

        if (stop.Status == "DELIVERED")
            return ValidationError<object>("status", "Stop is already marked delivered.");

        var defaultProduct = await _db.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
        var productId = request.ProductId ?? stop.ProductId ?? defaultProduct?.Id ?? Guid.Empty;

        // Rate Resolution
        decimal unitRate = request.ManualUnitRate ?? stop.UnitRate;
        if (unitRate <= 0)
        {
            var resolved = await FindRate(productId, stop.CustomerId, "ANY", "COMPANY", Math.Max(1, request.DeliveredFilledJars), DateTime.UtcNow);
            unitRate = resolved?.UnitRate ?? defaultProduct?.SellingPrice ?? 35m;
        }

        decimal totalAmount = unitRate * request.DeliveredFilledJars;
        decimal amountCollected = request.AmountCollected ?? (request.PaymentMode == "CREDIT" ? 0 : totalAmount);

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            // 1. Ledger Movement: Vehicle -> Customer (Filled)
            if (request.DeliveredFilledJars > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "FILLED", productId),
                    new TwentyLPosition("COMPANY", null, "CUSTOMER", stop.CustomerId, "CUSTOMER", null, "FILLED", productId),
                    request.DeliveredFilledJars,
                    "DELIVERY_DISPATCH",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Delivered to Customer from Vehicle {trip.VehicleNumber}",
                    request.Notes
                ));
            }

            // 2. Ledger Movement: Customer -> Vehicle (Empty Collection)
            if (request.CollectedEmptyJars > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "CUSTOMER", stop.CustomerId, "CUSTOMER", null, "EMPTY", productId),
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "EMPTY", productId),
                    request.CollectedEmptyJars,
                    "EMPTY_RETURN",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Collected empties into Vehicle {trip.VehicleNumber}",
                    request.Notes
                ));
            }

            // 3. Create Commercial Delivery Snapshot
            var delivery = new TwentyLDelivery
            {
                TenantId = _user.TenantId,
                CompanyId = await CompanyId(),
                CustomerId = stop.CustomerId,
                ProductId = productId,
                OrderedQuantity = stop.PlannedFilledJars > 0 ? stop.PlannedFilledJars : request.DeliveredFilledJars,
                FilledDeliveredQuantity = request.DeliveredFilledJars,
                EmptyCollectedQuantity = request.CollectedEmptyJars,
                AppliedUnitRate = unitRate,
                TotalAmount = totalAmount,
                AmountCollected = amountCollected,
                PaymentMode = request.PaymentMode ?? "CREDIT",
                Status = request.DeliveredFilledJars > 0 ? "COMPLETED" : "FAILED",
                FailureReason = request.FailureReason,
                DriverReference = trip.DriverName,
                VehicleReference = trip.VehicleNumber,
                RouteReference = trip.RouteCode,
                DeliveredAt = DateTime.UtcNow,
                Notes = request.Notes,
                IdempotencyKey = $"TRIP-STOP-{stop.Id}-{DateTime.UtcNow.Ticks}",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _user.UserId ?? "System"
            };
            _db.TwentyLDeliveries.Add(delivery);

            // Update Stop Record
            stop.DeliveredFilledJars = request.DeliveredFilledJars;
            stop.CollectedEmptyJars = request.CollectedEmptyJars;
            stop.DamagedEmptyJars = request.DamagedEmptyJars;
            stop.LostJars = request.LostJars;
            stop.UnitRate = unitRate;
            stop.TotalAmount = totalAmount;
            stop.AmountCollected = amountCollected;
            stop.PaymentMode = request.PaymentMode ?? "CREDIT";
            stop.PaymentStatus = amountCollected >= totalAmount ? "PAID" : (amountCollected > 0 ? "PARTIAL" : "PENDING");
            stop.Status = request.DeliveredFilledJars > 0 ? (request.DeliveredFilledJars < stop.PlannedFilledJars ? "PARTIAL" : "DELIVERED") : "FAILED";
            stop.FailureReason = request.FailureReason;
            stop.DeliveredAt = DateTime.UtcNow;
            stop.Notes = request.Notes;

            // Update Trip Aggregates
            trip.DeliveredFilledJars += request.DeliveredFilledJars;
            trip.CollectedEmptyJars += request.CollectedEmptyJars;
            trip.DamagedJarsCount += request.DamagedEmptyJars;
            trip.LostJarsCount += request.LostJars;
            trip.TotalTripRevenue += totalAmount;
            trip.TotalCashCollected += amountCollected;
            trip.Status = "IN_TRANSIT";

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new { stop.Id, stop.Status, stop.DeliveredFilledJars, stop.CollectedEmptyJars, stop.TotalAmount }, "Stop delivery recorded successfully.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPost("trips/{id}/return-and-reconcile")]
    public async Task<ActionResult<ApiResponse<object>>> ReturnAndReconcileTrip(Guid id, [FromBody] ReturnTripRequest request)
    {
        var trip = await _db.TwentyLTrips.Include(t => t.Stops).FirstOrDefaultAsync(t => t.Id == id && t.TenantId == _user.TenantId && !t.IsDeleted);
        if (trip == null) return Failure<object>("Trip not found.", "Resource not found", HttpStatusCode.NotFound);

        var defaultProduct = await _db.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
        var productId = defaultProduct?.Id ?? Guid.Empty;
        var companyId = await CompanyId();

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            // 1. Unload remaining filled jars: Vehicle -> Plant
            if (request.ReturnedFilledJars > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "FILLED", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "FILLED", productId),
                    request.ReturnedFilledJars,
                    "PLANT_RETURN",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Unloaded remaining {request.ReturnedFilledJars} filled jars from Vehicle {trip.VehicleNumber} to Plant",
                    request.Notes
                ));
            }

            // 2. Unload reusable collected empty jars: Vehicle -> Plant
            if (request.ReturnedEmptyJars > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "EMPTY", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", productId),
                    request.ReturnedEmptyJars,
                    "PLANT_RETURN",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Unloaded {request.ReturnedEmptyJars} reusable empty jars from Vehicle {trip.VehicleNumber} to Plant",
                    request.Notes
                ));
            }

            // 3. Unload damaged jars to Plant Quarantine: Vehicle -> Plant DAMAGED
            if (request.DamagedJarsCount > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "EMPTY", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "DAMAGED", productId),
                    request.DamagedJarsCount,
                    "DAMAGE_WRITE_OFF",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Damaged jars logged from Trip {trip.TripNumber}: {request.DamageReason}",
                    request.Notes
                ));

                // Record Inspection
                _db.TwentyLJarInspections.Add(new TwentyLJarInspection
                {
                    TenantId = _user.TenantId,
                    CompanyId = companyId,
                    InspectionNumber = $"INSP-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}",
                    ReferenceType = "TRIP",
                    ReferenceId = trip.Id,
                    SourceHolderType = "DRIVER",
                    SourceHolderName = trip.DriverName,
                    InspectedCount = request.DamagedJarsCount,
                    DamagedCount = request.DamagedJarsCount,
                    InspectionOutcome = "DAMAGED_QUARANTINE",
                    ResponsibleParty = "DRIVER",
                    DamageReason = request.DamageReason ?? "UNSPECIFIED_DAMAGE",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _user.UserId ?? "System"
                });
            }

            // 4. Record Lost jars: Vehicle -> Write off
            if (request.LostJarsCount > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", trip.DriverCustomerId, "VEHICLE", trip.VehicleNumber, "EMPTY", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "LOST", productId),
                    request.LostJarsCount,
                    "LOSS_WRITE_OFF",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Lost jars written off from Trip {trip.TripNumber}",
                    request.Notes
                ));
            }

            trip.ReturnedFilledJars = request.ReturnedFilledJars;
            trip.ReturnedEmptyJars = request.ReturnedEmptyJars;
            trip.DamagedJarsCount += request.DamagedJarsCount;
            trip.LostJarsCount += request.LostJarsCount;
            trip.Status = "COMPLETED";
            trip.ReturnedAt = DateTime.UtcNow;
            trip.ReconciledAt = DateTime.UtcNow;
            trip.ReconciledBy = _user.UserId ?? "System";

            // Invariant Check:
            // Input Jars on Vehicle = LoadedFilled + LoadedEmpty + CollectedEmpty
            // Output Jars Accounted = DeliveredFilled + ReturnedFilled + ReturnedEmpty + DamagedJars + LostJars
            int totalVehicleInflow = trip.LoadedFilledJars + trip.LoadedEmptyJars + trip.CollectedEmptyJars;
            int totalVehicleOutflow = trip.DeliveredFilledJars + trip.ReturnedFilledJars + trip.ReturnedEmptyJars + trip.DamagedJarsCount + trip.LostJarsCount;

            if (totalVehicleInflow == totalVehicleOutflow)
            {
                trip.ReconciliationStatus = "RECONCILED";
            }
            else
            {
                trip.ReconciliationStatus = "DISCREPANCY";
                trip.DiscrepancyNotes = $"Discrepancy of {Math.Abs(totalVehicleInflow - totalVehicleOutflow)} jars. Inflow: {totalVehicleInflow}, Outflow: {totalVehicleOutflow}.";
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new
            {
                trip.Id,
                trip.Status,
                trip.ReconciliationStatus,
                trip.DiscrepancyNotes,
                TotalInflow = totalVehicleInflow,
                TotalOutflow = totalVehicleOutflow
            }, "Trip returned and reconciled successfully.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    #endregion

    #region 10. Composite All-At-Once Operation Engine (Mode B)

    [HttpPost("operations/all-at-once")]
    public async Task<ActionResult<ApiResponse<object>>> ExecuteAllAtOnceOperation([FromBody] AllAtOnceOperationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DriverName) || string.IsNullOrWhiteSpace(request.VehicleNumber))
            return ValidationError<object>("driver", "Driver name and Vehicle number are required.");

        if (request.Stops == null || request.Stops.Count == 0)
            return ValidationError<object>("stops", "At least one customer delivery stop is required.");

        var defaultProduct = await _db.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
        var productId = request.ProductId ?? defaultProduct?.Id ?? Guid.Empty;
        var companyId = await CompanyId();

        int sumDeliveredFilled = request.Stops.Sum(s => s.DeliveredFilledJars);
        int sumCollectedEmpty = request.Stops.Sum(s => s.CollectedEmptyJars);

        // Invariant Validation:
        // LoadedFilled == DeliveredFilled + ReturnedFilled
        if (request.LoadedFilledJars < sumDeliveredFilled)
            return ValidationError<object>("loadedFilled", $"Loaded filled jars ({request.LoadedFilledJars}) cannot be less than delivered filled jars ({sumDeliveredFilled}).");

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            var tripNumber = $"TRIP-DIR-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
            var trip = new TwentyLTrip
            {
                TenantId = _user.TenantId,
                CompanyId = companyId,
                TripNumber = tripNumber,
                DriverName = request.DriverName,
                VehicleNumber = request.VehicleNumber,
                RouteCode = request.RouteCode,
                PlannedDate = request.OperationDate?.Date ?? DateTime.UtcNow.Date,
                Status = "COMPLETED",
                LoadedFilledJars = request.LoadedFilledJars,
                LoadedEmptyJars = request.LoadedEmptyJars,
                DeliveredFilledJars = sumDeliveredFilled,
                CollectedEmptyJars = sumCollectedEmpty,
                ReturnedFilledJars = request.ReturnedFilledJars,
                ReturnedEmptyJars = request.ReturnedEmptyJars,
                DamagedJarsCount = request.DamagedJarsCount,
                LostJarsCount = request.LostJarsCount,
                DispatchedAt = request.OperationDate ?? DateTime.UtcNow,
                ReturnedAt = DateTime.UtcNow,
                ReconciledAt = DateTime.UtcNow,
                ReconciledBy = _user.UserId ?? "System",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _user.UserId ?? "System"
            };

            // 1. Initial Load: Plant -> Vehicle
            if (request.LoadedFilledJars > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "FILLED", productId),
                    new TwentyLPosition("COMPANY", null, "DRIVER", null, "VEHICLE", request.VehicleNumber, "FILLED", productId),
                    request.LoadedFilledJars,
                    "PLANT_LOADING",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Direct loading for Trip {tripNumber}",
                    request.Notes
                ));
            }

            decimal totalRevenue = 0;
            decimal totalCollected = 0;
            int seq = 1;

            // 2. Process each customer stop
            foreach (var stopReq in request.Stops)
            {
                decimal unitRate = stopReq.UnitRate;
                if (unitRate <= 0)
                {
                    var resolved = await FindRate(productId, stopReq.CustomerId, "ANY", "COMPANY", Math.Max(1, stopReq.DeliveredFilledJars), DateTime.UtcNow);
                    unitRate = resolved?.UnitRate ?? defaultProduct?.SellingPrice ?? 35m;
                }

                decimal stopTotal = unitRate * stopReq.DeliveredFilledJars;
                decimal stopCollected = stopReq.AmountCollected ?? (stopReq.PaymentMode == "CREDIT" ? 0 : stopTotal);

                totalRevenue += stopTotal;
                totalCollected += stopCollected;

                // Move Filled: Vehicle -> Customer
                if (stopReq.DeliveredFilledJars > 0)
                {
                    await _ledger.PostAsync(new TwentyLPostingRequest(
                        new TwentyLPosition("COMPANY", null, "DRIVER", null, "VEHICLE", request.VehicleNumber, "FILLED", productId),
                        new TwentyLPosition("COMPANY", null, "CUSTOMER", stopReq.CustomerId, "CUSTOMER", null, "FILLED", productId),
                        stopReq.DeliveredFilledJars,
                        "DELIVERY_DISPATCH",
                        trip.Id,
                        "TwentyLTrip",
                        DateTime.UtcNow,
                        $"Delivered from Vehicle {request.VehicleNumber}",
                        request.Notes
                    ));
                }

                // Move Empty: Customer -> Vehicle
                if (stopReq.CollectedEmptyJars > 0)
                {
                    await _ledger.PostAsync(new TwentyLPostingRequest(
                        new TwentyLPosition("COMPANY", null, "CUSTOMER", stopReq.CustomerId, "CUSTOMER", null, "EMPTY", productId),
                        new TwentyLPosition("COMPANY", null, "DRIVER", null, "VEHICLE", request.VehicleNumber, "EMPTY", productId),
                        stopReq.CollectedEmptyJars,
                        "EMPTY_RETURN",
                        trip.Id,
                        "TwentyLTrip",
                        DateTime.UtcNow,
                        $"Collected empties to Vehicle {request.VehicleNumber}",
                        request.Notes
                    ));
                }

                trip.Stops.Add(new TwentyLTripStop
                {
                    TenantId = _user.TenantId,
                    CompanyId = companyId,
                    StopSequence = seq++,
                    CustomerId = stopReq.CustomerId,
                    ProductId = productId,
                    PlannedFilledJars = stopReq.DeliveredFilledJars,
                    DeliveredFilledJars = stopReq.DeliveredFilledJars,
                    CollectedEmptyJars = stopReq.CollectedEmptyJars,
                    UnitRate = unitRate,
                    TotalAmount = stopTotal,
                    AmountCollected = stopCollected,
                    PaymentMode = stopReq.PaymentMode ?? "CREDIT",
                    PaymentStatus = stopCollected >= stopTotal ? "PAID" : (stopCollected > 0 ? "PARTIAL" : "PENDING"),
                    Status = "DELIVERED",
                    DeliveredAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _user.UserId ?? "System"
                });

                // Record delivery record
                _db.TwentyLDeliveries.Add(new TwentyLDelivery
                {
                    TenantId = _user.TenantId,
                    CompanyId = companyId,
                    CustomerId = stopReq.CustomerId,
                    ProductId = productId,
                    OrderedQuantity = stopReq.DeliveredFilledJars,
                    FilledDeliveredQuantity = stopReq.DeliveredFilledJars,
                    EmptyCollectedQuantity = stopReq.CollectedEmptyJars,
                    AppliedUnitRate = unitRate,
                    TotalAmount = stopTotal,
                    AmountCollected = stopCollected,
                    PaymentMode = stopReq.PaymentMode ?? "CREDIT",
                    Status = "COMPLETED",
                    DriverReference = request.DriverName,
                    VehicleReference = request.VehicleNumber,
                    RouteReference = request.RouteCode,
                    DeliveredAt = DateTime.UtcNow,
                    IdempotencyKey = $"ALLATONCE-{stopReq.CustomerId}-{DateTime.UtcNow.Ticks}",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _user.UserId ?? "System"
                });
            }

            // 3. Return remaining filled: Vehicle -> Plant
            if (request.ReturnedFilledJars > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", null, "VEHICLE", request.VehicleNumber, "FILLED", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "FILLED", productId),
                    request.ReturnedFilledJars,
                    "PLANT_RETURN",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Returned filled jars to plant",
                    request.Notes
                ));
            }

            // 4. Return empties: Vehicle -> Plant
            if (request.ReturnedEmptyJars > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", null, "VEHICLE", request.VehicleNumber, "EMPTY", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", productId),
                    request.ReturnedEmptyJars,
                    "PLANT_RETURN",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Returned reusable empties to plant",
                    request.Notes
                ));
            }

            // 5. Damaged & Lost
            if (request.DamagedJarsCount > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "DRIVER", null, "VEHICLE", request.VehicleNumber, "EMPTY", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "DAMAGED", productId),
                    request.DamagedJarsCount,
                    "DAMAGE_WRITE_OFF",
                    trip.Id,
                    "TwentyLTrip",
                    DateTime.UtcNow,
                    $"Damaged jars logged: {request.DamageReason}",
                    request.Notes
                ));
            }

            trip.TotalTripRevenue = totalRevenue;
            trip.TotalCashCollected = totalCollected;

            int totalIn = request.LoadedFilledJars + request.LoadedEmptyJars + sumCollectedEmpty;
            int totalOut = sumDeliveredFilled + request.ReturnedFilledJars + request.ReturnedEmptyJars + request.DamagedJarsCount + request.LostJarsCount;

            trip.ReconciliationStatus = totalIn == totalOut ? "RECONCILED" : "DISCREPANCY";
            if (totalIn != totalOut)
            {
                trip.DiscrepancyNotes = $"Discrepancy of {Math.Abs(totalIn - totalOut)} jars. Inflow: {totalIn}, Outflow: {totalOut}.";
            }

            _db.TwentyLTrips.Add(trip);
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new
            {
                trip.Id,
                trip.TripNumber,
                trip.Status,
                trip.ReconciliationStatus,
                trip.TotalTripRevenue,
                trip.TotalCashCollected,
                StopsExecuted = trip.Stops.Count
            }, "All-at-once 20L operation posted and reconciled.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    #endregion

    #region 11. Quick Operations (Mode C)

    [HttpPost("operations/quick-delivery")]
    public async Task<ActionResult<ApiResponse<object>>> ExecuteQuickDelivery([FromBody] QuickDeliveryRequest request)
    {
        if (request.CustomerId == Guid.Empty || request.QuantityFilled <= 0)
            return ValidationError<object>("delivery", "Valid customer and filled quantity are required.");

        var defaultProduct = await _db.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
        var productId = request.ProductId ?? defaultProduct?.Id ?? Guid.Empty;
        var companyId = await CompanyId();

        decimal unitRate = request.ManualUnitRate ?? 0;
        if (unitRate <= 0)
        {
            var resolved = await FindRate(productId, request.CustomerId, "ANY", "COMPANY", request.QuantityFilled, DateTime.UtcNow);
            unitRate = resolved?.UnitRate ?? defaultProduct?.SellingPrice ?? 35m;
        }

        decimal totalAmount = unitRate * request.QuantityFilled;
        decimal amountCollected = request.AmountCollected ?? (request.PaymentMode == "CREDIT" ? 0 : totalAmount);

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            // 1. Ledger: Plant -> Customer (Filled)
            await _ledger.PostAsync(new TwentyLPostingRequest(
                new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "FILLED", productId),
                new TwentyLPosition("COMPANY", null, "CUSTOMER", request.CustomerId, "CUSTOMER", null, "FILLED", productId),
                request.QuantityFilled,
                "DELIVERY_DISPATCH",
                null,
                "TwentyLDelivery",
                DateTime.UtcNow,
                $"Quick delivery to customer",
                request.Notes
            ));

            // 2. Ledger: Customer -> Plant (Collected Empty)
            if (request.QuantityEmptyCollected > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "CUSTOMER", request.CustomerId, "CUSTOMER", null, "EMPTY", productId),
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", productId),
                    request.QuantityEmptyCollected,
                    "EMPTY_RETURN",
                    null,
                    "TwentyLDelivery",
                    DateTime.UtcNow,
                    $"Quick empty collection",
                    request.Notes
                ));
            }

            var delivery = new TwentyLDelivery
            {
                TenantId = _user.TenantId,
                CompanyId = companyId,
                CustomerId = request.CustomerId,
                ProductId = productId,
                OrderedQuantity = request.QuantityFilled,
                FilledDeliveredQuantity = request.QuantityFilled,
                EmptyCollectedQuantity = request.QuantityEmptyCollected,
                AppliedUnitRate = unitRate,
                TotalAmount = totalAmount,
                AmountCollected = amountCollected,
                PaymentMode = request.PaymentMode ?? "CASH",
                Status = "COMPLETED",
                DriverReference = request.DriverName,
                VehicleReference = request.VehicleNumber,
                DeliveredAt = DateTime.UtcNow,
                IdempotencyKey = request.IdempotencyKey ?? $"QUICK-DELIV-{DateTime.UtcNow.Ticks}",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _user.UserId ?? "System"
            };
            _db.TwentyLDeliveries.Add(delivery);

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new { delivery.Id, delivery.TotalAmount, delivery.AmountCollected }, "Quick 20L delivery recorded successfully.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPost("operations/quick-return")]
    public async Task<ActionResult<ApiResponse<object>>> ExecuteQuickReturn([FromBody] QuickReturnRequest request)
    {
        if (request.CustomerId == Guid.Empty || request.QuantityEmpty <= 0)
            return ValidationError<object>("return", "Valid customer and empty quantity are required.");

        var defaultProduct = await _db.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
        var productId = request.ProductId ?? defaultProduct?.Id ?? Guid.Empty;

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            await _ledger.PostAsync(new TwentyLPostingRequest(
                new TwentyLPosition("COMPANY", null, "CUSTOMER", request.CustomerId, "CUSTOMER", null, "EMPTY", productId),
                new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", productId),
                request.QuantityEmpty,
                "EMPTY_RETURN",
                null,
                "QuickReturn",
                DateTime.UtcNow,
                $"Direct empty return from customer",
                request.Notes
            ));

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new { request.QuantityEmpty }, "Customer empty jars returned to plant successfully.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPost("operations/quick-damage-condemnation")]
    public async Task<ActionResult<ApiResponse<object>>> ExecuteQuickDamageCondemnation([FromBody] QuickDamageCondemnationRequest request)
    {
        if (request.Quantity <= 0)
            return ValidationError<object>("quantity", "Quantity must be greater than zero.");

        var defaultProduct = await _db.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
        var productId = request.ProductId ?? defaultProduct?.Id ?? Guid.Empty;
        var companyId = await CompanyId();

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            string targetStatus = request.IsCondemnation ? "CONDEMNED" : "DAMAGED";
            string movementType = request.IsCondemnation ? "CONDEMNATION" : "DAMAGE_WRITE_OFF";

            await _ledger.PostAsync(new TwentyLPostingRequest(
                new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", productId),
                new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, targetStatus, productId),
                request.Quantity,
                movementType,
                null,
                "QualityLog",
                DateTime.UtcNow,
                request.Reason ?? "Damaged jar logged",
                request.Notes
            ));

            _db.TwentyLJarInspections.Add(new TwentyLJarInspection
            {
                TenantId = _user.TenantId,
                CompanyId = companyId,
                InspectionNumber = $"INSP-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}",
                ReferenceType = request.IsCondemnation ? "CONDEMNATION" : "DAMAGE",
                SourceHolderType = "PLANT",
                InspectedCount = request.Quantity,
                DamagedCount = request.IsCondemnation ? 0 : request.Quantity,
                CondemnedCount = request.IsCondemnation ? request.Quantity : 0,
                InspectionOutcome = targetStatus,
                ResponsibleParty = request.ResponsibleParty ?? "PLANT",
                DamageReason = request.Reason,
                CondemnationReason = request.IsCondemnation ? request.Reason : null,
                AuthorizedBy = _user.UserId ?? "System",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _user.UserId ?? "System"
            });

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new { request.Quantity, Status = targetStatus }, "Jar condition recorded and inventory updated.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    #endregion

    #region 12. Quality Inspection & Condemnation Ledger

    [HttpGet("inspections")]
    public async Task<ActionResult<ApiResponse<object>>> GetInspections(
        [FromQuery] string? outcome = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLJarInspections
            .Where(i => i.TenantId == _user.TenantId);

        if (!string.IsNullOrWhiteSpace(outcome))
            query = query.Where(i => i.InspectionOutcome == outcome);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Success<object>(new { items, total, page, pageSize }, "Jar inspection and condemnation records retrieved.");
    }

    [HttpPost("inspections/repair-to-stock")]
    public async Task<ActionResult<ApiResponse<object>>> RepairQuarantinedJarsToStock([FromBody] RepairJarsRequest request)
    {
        if (request.Quantity <= 0)
            return ValidationError<object>("quantity", "Quantity must be greater than zero.");

        var defaultProduct = await _db.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
        var productId = request.ProductId ?? defaultProduct?.Id ?? Guid.Empty;

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        try
        {
            await _ledger.PostAsync(new TwentyLPostingRequest(
                new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "DAMAGED", productId),
                new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", productId),
                request.Quantity,
                "REPAIRED_TO_STOCK",
                null,
                "QualityRepair",
                DateTime.UtcNow,
                "Repaired jars returned to reusable empty inventory",
                request.Notes
            ));

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Success<object>(new { request.Quantity }, "Repaired jars moved back to active reusable stock.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    #endregion

    #region 13. Vehicle, Driver, & Plant Real-Time Balances

    [HttpGet("balances/vehicle/{vehicleNumber}")]
    public async Task<ActionResult<ApiResponse<object>>> GetVehicleBalance(string vehicleNumber)
    {
        var positions = await _db.TwentyLJarPositions
            .Where(p => p.TenantId == _user.TenantId && p.LocationType == "VEHICLE" && p.LocationReference == vehicleNumber)
            .ToListAsync();

        int filled = positions.Where(p => p.ContainerStatus == "FILLED").Sum(p => p.Quantity);
        int empty = positions.Where(p => p.ContainerStatus == "EMPTY").Sum(p => p.Quantity);
        int damaged = positions.Where(p => p.ContainerStatus == "DAMAGED").Sum(p => p.Quantity);

        return Success<object>(new
        {
            VehicleNumber = vehicleNumber,
            FilledJars = filled,
            EmptyJars = empty,
            DamagedJars = damaged,
            TotalJarsOnVehicle = filled + empty + damaged
        }, "Vehicle physical jar balances retrieved.");
    }

    [HttpGet("balances")]
    [HttpGet("balances/plant")]
    public async Task<ActionResult<ApiResponse<object>>> GetPlantBalance()
    {
        var positions = await _db.TwentyLJarPositions
            .Where(p => p.TenantId == _user.TenantId)
            .ToListAsync();

        int plantFilled = positions.Where(p => p.LocationType == "PLANT" && p.ContainerStatus == "FILLED").Sum(p => p.Quantity);
        int plantEmpty = positions.Where(p => p.LocationType == "PLANT" && p.ContainerStatus == "EMPTY").Sum(p => p.Quantity);
        int plantDamaged = positions.Where(p => p.LocationType == "PLANT" && p.ContainerStatus == "DAMAGED").Sum(p => p.Quantity);
        int plantCondemned = positions.Where(p => p.LocationType == "PLANT" && p.ContainerStatus == "CONDEMNED").Sum(p => p.Quantity);

        int inTransit = positions.Where(p => p.LocationType == "VEHICLE").Sum(p => p.Quantity);
        int withCustomers = positions.Where(p => p.LocationType == "CUSTOMER").Sum(p => p.Quantity);
        int withDistributors = positions.Where(p => p.LocationType == "DISTRIBUTOR").Sum(p => p.Quantity);

        return Success<object>(new
        {
            Plant = new
            {
                FilledAvailable = plantFilled,
                EmptyReusable = plantEmpty,
                DamagedQuarantined = plantDamaged,
                CondemnedScrapped = plantCondemned,
                TotalAtPlant = plantFilled + plantEmpty + plantDamaged + plantCondemned
            },
            Field = new
            {
                InTransitVehicles = inTransit,
                WithCustomers = withCustomers,
                WithDistributors = withDistributors,
                TotalInCirculation = inTransit + withCustomers + withDistributors
            },
            GrandTotalSystemJars = plantFilled + plantEmpty + plantDamaged + plantCondemned + inTransit + withCustomers + withDistributors
        }, "Authoritative plant and network jar balances retrieved.");
    }

    #endregion

    #region 12. Upstream Distributor Supplies (Company -> Distributor)

    [HttpGet("distributor-supplies")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorSupplies(
        [FromQuery] Guid? distributorId = null,
        [FromQuery] string? stage = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLDistributorSupplies
            .Where(s => s.TenantId == _user.TenantId);

        if (distributorId.HasValue && distributorId.Value != Guid.Empty)
            query = query.Where(s => s.DistributorId == distributorId.Value);
        if (!string.IsNullOrWhiteSpace(stage) && stage != "ALL")
            query = query.Where(s => s.Stage == stage);
        if (fromDate.HasValue)
            query = query.Where(s => s.CreatedAt >= fromDate.Value.ToUniversalTime());
        if (toDate.HasValue)
            query = query.Where(s => s.CreatedAt <= toDate.Value.ToUniversalTime());

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Success<object>(new { Items = items, Total = total, Page = page, PageSize = pageSize }, "Distributor supplies retrieved.");
    }

    [HttpPost("distributor-supplies")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDistributorSupply([FromBody] CreateDistributorSupplyRequest request)
    {
        if (request.DistributorId == Guid.Empty) return ValidationError<object>("distributorId", "Distributor is required.");
        if (request.QuantitySupplied <= 0 && request.QuantityRequested <= 0)
            return ValidationError<object>("quantity", "Quantity supplied or requested must be greater than zero.");

        var distributor = await _db.Customers.FirstOrDefaultAsync(c => c.Id == request.DistributorId && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (distributor == null) return Failure<object>("Distributor customer record not found.", "Resource not found", HttpStatusCode.NotFound);

        var companyId = await CompanyId();
        var rate = request.AppliedRate;
        if (rate <= 0)
        {
            var resolvedRate = await FindRate(request.ProductId, request.DistributorId, "COMPANY_TO_DISTRIBUTOR", "COMPANY", request.QuantitySupplied > 0 ? request.QuantitySupplied : request.QuantityRequested, DateTime.UtcNow);
            rate = resolvedRate?.UnitRate ?? 25m;
        }

        var supplied = request.QuantitySupplied > 0 ? request.QuantitySupplied : request.QuantityRequested;
        var totalAmount = supplied * rate;
        var supplyNumber = $"SUP-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";

        var supply = new TwentyLDistributorSupply
        {
            TenantId = _user.TenantId,
            CompanyId = companyId,
            SupplyNumber = supplyNumber,
            DistributorId = request.DistributorId,
            DistributorName = distributor.CustomerName,
            ProductId = request.ProductId != Guid.Empty ? request.ProductId : Guid.NewGuid(),
            ProductName = request.ProductName ?? "20L Water Jar",
            Stage = request.Stage ?? "COMPLETED",
            QuantityRequested = request.QuantityRequested > 0 ? request.QuantityRequested : supplied,
            QuantitySupplied = supplied,
            QuantityEmptyReturned = request.QuantityEmptyReturned,
            QuantityDamaged = request.QuantityDamaged,
            AppliedRate = rate,
            TotalAmount = totalAmount,
            AmountPaid = request.AmountPaid,
            PaymentStatus = request.AmountPaid >= totalAmount ? "PAID" : (request.AmountPaid > 0 ? "PARTIAL" : "PENDING"),
            PaymentMode = request.PaymentMode ?? "CREDIT",
            VehicleNumber = request.VehicleNumber,
            DriverName = request.DriverName,
            DispatcherNotes = request.DispatcherNotes,
            ReceiverNotes = request.ReceiverNotes,
            DispatchedAt = DateTime.UtcNow,
            ReceivedAt = (request.Stage == "COMPLETED" || string.IsNullOrEmpty(request.Stage)) ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _user.UserId ?? "System"
        };

        _db.TwentyLDistributorSupplies.Add(supply);

        if (supply.Stage == "COMPLETED" || supply.Stage == "DISPATCHED")
        {
            try
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "FILLED", request.ProductId),
                    new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", request.DistributorId, "DISTRIBUTOR_DEPOT", null, "FILLED", request.ProductId),
                    supplied, "COMPANY_SUPPLY_DISPATCH", supply.Id, "DISTRIBUTOR_SUPPLY", DateTime.UtcNow, "Plant to Distributor Supply", request.DispatcherNotes
                ));

                if (request.QuantityEmptyReturned > 0)
                {
                    await _ledger.PostAsync(new TwentyLPostingRequest(
                        new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", request.DistributorId, "DISTRIBUTOR_DEPOT", null, "EMPTY", request.ProductId),
                        new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", null, "EMPTY", request.ProductId),
                        request.QuantityEmptyReturned, "DISTRIBUTOR_EMPTY_RETURN", supply.Id, "DISTRIBUTOR_SUPPLY", DateTime.UtcNow, "Distributor Empties Returned to Plant", null
                    ));
                }

                if (request.QuantityDamaged > 0)
                {
                    await _ledger.PostAsync(new TwentyLPostingRequest(
                        new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", request.DistributorId, "DISTRIBUTOR_DEPOT", null, "EMPTY", request.ProductId),
                        new TwentyLPosition("COMPANY", null, "COMPANY", null, "PLANT", "QUARANTINE", "DAMAGED", request.ProductId),
                        request.QuantityDamaged, "DISTRIBUTOR_DAMAGE_RETURN", supply.Id, "DISTRIBUTOR_SUPPLY", DateTime.UtcNow, "Distributor Damaged Jars Quarantine", null
                    ));
                }
            }
            catch (Exception ex)
            {
                supply.DispatcherNotes = $"{supply.DispatcherNotes} [Ledger: {ex.Message}]";
            }
        }

        await _db.SaveChangesAsync();
        return Success<object>(supply, "Distributor supply recorded successfully.");
    }

    [HttpPost("distributor-supplies/{id}/receive")]
    public async Task<ActionResult<ApiResponse<object>>> ReceiveDistributorSupply(Guid id, [FromBody] ReceiveDistributorSupplyRequest request)
    {
        var supply = await _db.TwentyLDistributorSupplies.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == _user.TenantId);
        if (supply == null) return Failure<object>("Distributor supply record not found.", "Resource not found", HttpStatusCode.NotFound);

        supply.Stage = "COMPLETED";
        supply.ReceivedAt = DateTime.UtcNow;
        supply.ReceiverNotes = request.Notes;
        supply.UpdatedAt = DateTime.UtcNow;
        supply.UpdatedBy = _user.UserId ?? "System";

        await _db.SaveChangesAsync();
        return Success<object>(supply, "Distributor supply marked as received.");
    }

    #endregion

    #region 13. Distributor Downstream Routes

    [HttpGet("distributors/{distributorId}/routes")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorRoutes(Guid distributorId)
    {
        var routes = await _db.TwentyLDistributorRoutes
            .Where(r => r.DistributorId == distributorId && r.TenantId == _user.TenantId && !r.IsDeleted)
            .OrderBy(r => r.RouteName)
            .ToListAsync();
        return Success<object>(routes, "Distributor routes retrieved.");
    }

    [HttpPost("distributors/{distributorId}/routes")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDistributorRoute(Guid distributorId, [FromBody] CreateDistributorRouteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RouteName)) return ValidationError<object>("routeName", "Route Name is required.");
        var companyId = await CompanyId();

        var route = new TwentyLDistributorRoute
        {
            TenantId = _user.TenantId,
            CompanyId = companyId,
            DistributorId = distributorId,
            RouteCode = string.IsNullOrWhiteSpace(request.RouteCode) ? $"RT-{Random.Shared.Next(100, 999)}" : request.RouteCode,
            RouteName = request.RouteName,
            AreaDescription = request.AreaDescription,
            DefaultDriverName = request.DefaultDriverName,
            DefaultVehicleNumber = request.DefaultVehicleNumber,
            ScheduleDays = request.ScheduleDays ?? "DAILY",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _user.UserId ?? "System"
        };

        _db.TwentyLDistributorRoutes.Add(route);
        await _db.SaveChangesAsync();
        return Success<object>(route, "Distributor route created successfully.");
    }

    [HttpPut("distributors/{distributorId}/routes/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateDistributorRoute(Guid distributorId, Guid id, [FromBody] UpdateDistributorRouteRequest request)
    {
        var route = await _db.TwentyLDistributorRoutes.FirstOrDefaultAsync(r => r.Id == id && r.DistributorId == distributorId && r.TenantId == _user.TenantId && !r.IsDeleted);
        if (route == null) return Failure<object>("Route not found.", "Resource not found", HttpStatusCode.NotFound);

        if (!string.IsNullOrWhiteSpace(request.RouteName)) route.RouteName = request.RouteName;
        if (!string.IsNullOrWhiteSpace(request.RouteCode)) route.RouteCode = request.RouteCode;
        route.AreaDescription = request.AreaDescription;
        route.DefaultDriverName = request.DefaultDriverName;
        route.DefaultVehicleNumber = request.DefaultVehicleNumber;
        if (!string.IsNullOrWhiteSpace(request.ScheduleDays)) route.ScheduleDays = request.ScheduleDays;
        route.IsActive = request.IsActive;
        route.UpdatedAt = DateTime.UtcNow;
        route.UpdatedBy = _user.UserId ?? "System";

        await _db.SaveChangesAsync();
        return Success<object>(route, "Distributor route updated.");
    }

    [HttpDelete("distributors/{distributorId}/routes/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDistributorRoute(Guid distributorId, Guid id)
    {
        var route = await _db.TwentyLDistributorRoutes.FirstOrDefaultAsync(r => r.Id == id && r.DistributorId == distributorId && r.TenantId == _user.TenantId && !r.IsDeleted);
        if (route == null) return Failure<object>("Route not found.", "Resource not found", HttpStatusCode.NotFound);

        route.IsDeleted = true;
        route.DeletedAt = DateTime.UtcNow;
        route.DeletedBy = _user.UserId ?? "System";
        await _db.SaveChangesAsync();
        return Success<object>(true, "Distributor route deleted.");
    }

    #endregion

    #region 14. Distributor Downstream Vehicles

    [HttpGet("distributors/{distributorId}/vehicles")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorVehicles(Guid distributorId)
    {
        var vehicles = await _db.TwentyLDistributorVehicles
            .Where(v => v.DistributorId == distributorId && v.TenantId == _user.TenantId && !v.IsDeleted)
            .OrderBy(v => v.RegistrationNumber)
            .ToListAsync();
        return Success<object>(vehicles, "Distributor vehicles retrieved.");
    }

    [HttpPost("distributors/{distributorId}/vehicles")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDistributorVehicle(Guid distributorId, [FromBody] CreateDistributorVehicleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RegistrationNumber)) return ValidationError<object>("registrationNumber", "Registration Number is required.");
        var companyId = await CompanyId();

        var vehicle = new TwentyLDistributorVehicle
        {
            TenantId = _user.TenantId,
            CompanyId = companyId,
            DistributorId = distributorId,
            RegistrationNumber = request.RegistrationNumber.ToUpperInvariant(),
            VehicleType = request.VehicleType ?? "MINI_TRUCK",
            CapacityJars = request.CapacityJars > 0 ? request.CapacityJars : 50,
            AssignedDriverName = request.AssignedDriverName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _user.UserId ?? "System"
        };

        _db.TwentyLDistributorVehicles.Add(vehicle);
        await _db.SaveChangesAsync();
        return Success<object>(vehicle, "Distributor vehicle created successfully.");
    }

    [HttpPut("distributors/{distributorId}/vehicles/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateDistributorVehicle(Guid distributorId, Guid id, [FromBody] UpdateDistributorVehicleRequest request)
    {
        var vehicle = await _db.TwentyLDistributorVehicles.FirstOrDefaultAsync(v => v.Id == id && v.DistributorId == distributorId && v.TenantId == _user.TenantId && !v.IsDeleted);
        if (vehicle == null) return Failure<object>("Vehicle not found.", "Resource not found", HttpStatusCode.NotFound);

        if (!string.IsNullOrWhiteSpace(request.RegistrationNumber)) vehicle.RegistrationNumber = request.RegistrationNumber.ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(request.VehicleType)) vehicle.VehicleType = request.VehicleType;
        if (request.CapacityJars > 0) vehicle.CapacityJars = request.CapacityJars;
        vehicle.AssignedDriverName = request.AssignedDriverName;
        vehicle.IsActive = request.IsActive;
        vehicle.UpdatedAt = DateTime.UtcNow;
        vehicle.UpdatedBy = _user.UserId ?? "System";

        await _db.SaveChangesAsync();
        return Success<object>(vehicle, "Distributor vehicle updated.");
    }

    [HttpDelete("distributors/{distributorId}/vehicles/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDistributorVehicle(Guid distributorId, Guid id)
    {
        var vehicle = await _db.TwentyLDistributorVehicles.FirstOrDefaultAsync(v => v.Id == id && v.DistributorId == distributorId && v.TenantId == _user.TenantId && !v.IsDeleted);
        if (vehicle == null) return Failure<object>("Vehicle not found.", "Resource not found", HttpStatusCode.NotFound);

        vehicle.IsDeleted = true;
        vehicle.DeletedAt = DateTime.UtcNow;
        vehicle.DeletedBy = _user.UserId ?? "System";
        await _db.SaveChangesAsync();
        return Success<object>(true, "Distributor vehicle deleted.");
    }

    #endregion

    #region 15. Distributor Downstream Drivers

    [HttpGet("distributors/{distributorId}/drivers")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorDrivers(Guid distributorId)
    {
        var drivers = await _db.TwentyLDistributorDrivers
            .Where(d => d.DistributorId == distributorId && d.TenantId == _user.TenantId && !d.IsDeleted)
            .OrderBy(d => d.DriverName)
            .ToListAsync();
        return Success<object>(drivers, "Distributor drivers retrieved.");
    }

    [HttpPost("distributors/{distributorId}/drivers")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDistributorDriver(Guid distributorId, [FromBody] CreateDistributorDriverRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DriverName)) return ValidationError<object>("driverName", "Driver Name is required.");
        var companyId = await CompanyId();

        var driver = new TwentyLDistributorDriver
        {
            TenantId = _user.TenantId,
            CompanyId = companyId,
            DistributorId = distributorId,
            DriverName = request.DriverName,
            Phone = request.Phone ?? string.Empty,
            LicenseNumber = request.LicenseNumber,
            AssignedVehicleNumber = request.AssignedVehicleNumber,
            CurrentRouteId = request.CurrentRouteId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _user.UserId ?? "System"
        };

        _db.TwentyLDistributorDrivers.Add(driver);
        await _db.SaveChangesAsync();
        return Success<object>(driver, "Distributor driver created successfully.");
    }

    [HttpPut("distributors/{distributorId}/drivers/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateDistributorDriver(Guid distributorId, Guid id, [FromBody] UpdateDistributorDriverRequest request)
    {
        var driver = await _db.TwentyLDistributorDrivers.FirstOrDefaultAsync(d => d.Id == id && d.DistributorId == distributorId && d.TenantId == _user.TenantId && !d.IsDeleted);
        if (driver == null) return Failure<object>("Driver not found.", "Resource not found", HttpStatusCode.NotFound);

        if (!string.IsNullOrWhiteSpace(request.DriverName)) driver.DriverName = request.DriverName;
        if (request.Phone != null) driver.Phone = request.Phone;
        driver.LicenseNumber = request.LicenseNumber;
        driver.AssignedVehicleNumber = request.AssignedVehicleNumber;
        driver.CurrentRouteId = request.CurrentRouteId;
        driver.IsActive = request.IsActive;
        driver.UpdatedAt = DateTime.UtcNow;
        driver.UpdatedBy = _user.UserId ?? "System";

        await _db.SaveChangesAsync();
        return Success<object>(driver, "Distributor driver updated.");
    }

    [HttpDelete("distributors/{distributorId}/drivers/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDistributorDriver(Guid distributorId, Guid id)
    {
        var driver = await _db.TwentyLDistributorDrivers.FirstOrDefaultAsync(d => d.Id == id && d.DistributorId == distributorId && d.TenantId == _user.TenantId && !d.IsDeleted);
        if (driver == null) return Failure<object>("Driver not found.", "Resource not found", HttpStatusCode.NotFound);

        driver.IsDeleted = true;
        driver.DeletedAt = DateTime.UtcNow;
        driver.DeletedBy = _user.UserId ?? "System";
        await _db.SaveChangesAsync();
        return Success<object>(true, "Distributor driver deleted.");
    }

    #endregion

    #region 16. Distributor Downstream Customers

    [HttpGet("distributors/{distributorId}/customers")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorCustomers(Guid distributorId, [FromQuery] Guid? routeId = null, [FromQuery] string? search = null)
    {
        var query = _db.TwentyLDistributorCustomers
            .Where(c => c.DistributorId == distributorId && c.TenantId == _user.TenantId && !c.IsDeleted);

        if (routeId.HasValue && routeId.Value != Guid.Empty)
            query = query.Where(c => c.RouteId == routeId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.CustomerName.ToLower().Contains(s) || c.Phone.Contains(s) || (c.Area != null && c.Area.ToLower().Contains(s)));
        }

        var customers = await query.OrderBy(c => c.CustomerName).ToListAsync();
        return Success<object>(customers, "Distributor customers retrieved.");
    }

    [HttpPost("distributors/{distributorId}/customers")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDistributorCustomer(Guid distributorId, [FromBody] CreateDistributorCustomerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName)) return ValidationError<object>("customerName", "Customer Name is required.");
        var companyId = await CompanyId();

        var customer = new TwentyLDistributorCustomer
        {
            TenantId = _user.TenantId,
            CompanyId = companyId,
            DistributorId = distributorId,
            CustomerName = request.CustomerName,
            Phone = request.Phone ?? string.Empty,
            Address = request.Address,
            Area = request.Area,
            RouteId = request.RouteId,
            RouteName = request.RouteName,
            DeliveryFrequency = request.DeliveryFrequency ?? "DAILY",
            DefaultRate = request.DefaultRate > 0 ? request.DefaultRate : 40m,
            AssignedDriverName = request.AssignedDriverName,
            AssignedVehicleNumber = request.AssignedVehicleNumber,
            FilledJarsHeld = request.OpeningFilledJars,
            EmptyJarsHeld = request.OpeningEmptyJars,
            SecurityDeposit = request.SecurityDeposit,
            OutstandingBalance = request.OpeningBalance,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _user.UserId ?? "System"
        };

        _db.TwentyLDistributorCustomers.Add(customer);
        await _db.SaveChangesAsync();
        return Success<object>(customer, "Distributor customer created successfully.");
    }

    [HttpPut("distributors/{distributorId}/customers/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateDistributorCustomer(Guid distributorId, Guid id, [FromBody] UpdateDistributorCustomerRequest request)
    {
        var customer = await _db.TwentyLDistributorCustomers.FirstOrDefaultAsync(c => c.Id == id && c.DistributorId == distributorId && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (customer == null) return Failure<object>("Distributor customer not found.", "Resource not found", HttpStatusCode.NotFound);

        if (!string.IsNullOrWhiteSpace(request.CustomerName)) customer.CustomerName = request.CustomerName;
        if (request.Phone != null) customer.Phone = request.Phone;
        customer.Address = request.Address;
        customer.Area = request.Area;
        customer.RouteId = request.RouteId;
        customer.RouteName = request.RouteName;
        if (!string.IsNullOrWhiteSpace(request.DeliveryFrequency)) customer.DeliveryFrequency = request.DeliveryFrequency;
        if (request.DefaultRate > 0) customer.DefaultRate = request.DefaultRate;
        customer.AssignedDriverName = request.AssignedDriverName;
        customer.AssignedVehicleNumber = request.AssignedVehicleNumber;
        customer.IsActive = request.IsActive;
        customer.UpdatedAt = DateTime.UtcNow;
        customer.UpdatedBy = _user.UserId ?? "System";

        await _db.SaveChangesAsync();
        return Success<object>(customer, "Distributor customer updated.");
    }

    [HttpDelete("distributors/{distributorId}/customers/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDistributorCustomer(Guid distributorId, Guid id)
    {
        var customer = await _db.TwentyLDistributorCustomers.FirstOrDefaultAsync(c => c.Id == id && c.DistributorId == distributorId && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (customer == null) return Failure<object>("Distributor customer not found.", "Resource not found", HttpStatusCode.NotFound);

        customer.IsDeleted = true;
        customer.DeletedAt = DateTime.UtcNow;
        customer.DeletedBy = _user.UserId ?? "System";
        await _db.SaveChangesAsync();
        return Success<object>(true, "Distributor customer deleted.");
    }

    #endregion

    #region 17. Distributor Downstream Customer Deliveries

    [HttpGet("distributors/{distributorId}/deliveries")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorDeliveries(
        Guid distributorId,
        [FromQuery] Guid? customerId = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.TwentyLDistributorDeliveries
            .Where(d => d.DistributorId == distributorId && d.TenantId == _user.TenantId);

        if (customerId.HasValue && customerId.Value != Guid.Empty)
            query = query.Where(d => d.DistributorCustomerId == customerId.Value);
        if (fromDate.HasValue)
            query = query.Where(d => d.DeliveryDate >= fromDate.Value.ToUniversalTime());
        if (toDate.HasValue)
            query = query.Where(d => d.DeliveryDate <= toDate.Value.ToUniversalTime());

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(d => d.DeliveryDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Success<object>(new { Items = items, Total = total, Page = page, PageSize = pageSize }, "Distributor customer deliveries retrieved.");
    }

    [HttpPost("distributors/{distributorId}/deliveries")]
    public async Task<ActionResult<ApiResponse<object>>> CreateDistributorCustomerDelivery(Guid distributorId, [FromBody] CreateDistributorDeliveryRequest request)
    {
        if (request.DistributorCustomerId == Guid.Empty) return ValidationError<object>("distributorCustomerId", "Customer is required.");
        if (request.QuantityFilledDelivered <= 0) return ValidationError<object>("quantityFilledDelivered", "Delivered quantity must be greater than zero.");

        var customer = await _db.TwentyLDistributorCustomers.FirstOrDefaultAsync(c => c.Id == request.DistributorCustomerId && c.DistributorId == distributorId && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (customer == null) return Failure<object>("Distributor customer not found.", "Resource not found", HttpStatusCode.NotFound);

        var companyId = await CompanyId();

        // Resolve selling rate and company supply cost snapshot
        var sellingRate = request.SellingRate > 0 ? request.SellingRate : (customer.DefaultRate > 0 ? customer.DefaultRate : 40m);
        
        // Find company refill rate snapshot
        var companyRateRule = await FindRate(request.ProductId ?? Guid.Empty, distributorId, "COMPANY_TO_DISTRIBUTOR", "COMPANY", request.QuantityFilledDelivered, DateTime.UtcNow);
        var companyRefillRate = companyRateRule?.UnitRate ?? 25m;

        var totalAmount = request.QuantityFilledDelivered * sellingRate;
        var grossMargin = (sellingRate - companyRefillRate) * request.QuantityFilledDelivered;
        var deliveryNumber = $"DDEL-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";

        var delivery = new TwentyLDistributorDelivery
        {
            TenantId = _user.TenantId,
            CompanyId = companyId,
            DeliveryNumber = deliveryNumber,
            DistributorId = distributorId,
            DistributorCustomerId = request.DistributorCustomerId,
            CustomerName = customer.CustomerName,
            RouteId = request.RouteId ?? customer.RouteId,
            RouteName = request.RouteName ?? customer.RouteName,
            DriverName = request.DriverName ?? customer.AssignedDriverName,
            VehicleNumber = request.VehicleNumber ?? customer.AssignedVehicleNumber,
            ProductId = request.ProductId,
            QuantityFilledDelivered = request.QuantityFilledDelivered,
            QuantityEmptyCollected = request.QuantityEmptyCollected,
            QuantityDamaged = request.QuantityDamaged,
            SellingRate = sellingRate,
            CompanyRefillRate = companyRefillRate,
            TotalAmount = totalAmount,
            AmountCollected = request.AmountCollected,
            PaymentMode = request.PaymentMode ?? "CASH",
            PaymentStatus = request.AmountCollected >= totalAmount ? "PAID" : (request.AmountCollected > 0 ? "PARTIAL" : "PENDING"),
            GrossMargin = grossMargin,
            DeliveryDate = DateTime.UtcNow,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = _user.UserId ?? "System"
        };

        _db.TwentyLDistributorDeliveries.Add(delivery);

        // Update customer jar position
        customer.FilledJarsHeld += request.QuantityFilledDelivered;
        customer.EmptyJarsHeld = Math.Max(0, customer.EmptyJarsHeld - request.QuantityEmptyCollected);
        if (request.AmountCollected < totalAmount)
        {
            customer.OutstandingBalance += (totalAmount - request.AmountCollected);
        }

        // Ledger: Post distributor inventory to customer inventory
        try
        {
            await _ledger.PostAsync(new TwentyLPostingRequest(
                new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", distributorId, "DISTRIBUTOR_DEPOT", null, "FILLED", request.ProductId),
                new TwentyLPosition("COMPANY", null, "CUSTOMER", customer.Id, "CUSTOMER_LOCATION", null, "FILLED", request.ProductId),
                request.QuantityFilledDelivered, "DISTRIBUTOR_CUSTOMER_DELIVERY", delivery.Id, "CUSTOMER_DELIVERY", DateTime.UtcNow, "Distributor to Customer Delivery", request.Notes
            ));

            if (request.QuantityEmptyCollected > 0)
            {
                await _ledger.PostAsync(new TwentyLPostingRequest(
                    new TwentyLPosition("COMPANY", null, "CUSTOMER", customer.Id, "CUSTOMER_LOCATION", null, "EMPTY", request.ProductId),
                    new TwentyLPosition("COMPANY", null, "DISTRIBUTOR", distributorId, "DISTRIBUTOR_DEPOT", null, "EMPTY", request.ProductId),
                    request.QuantityEmptyCollected, "DISTRIBUTOR_CUSTOMER_EMPTY_RETURN", delivery.Id, "CUSTOMER_DELIVERY", DateTime.UtcNow, "Customer Empties Collected", null
                ));
            }
        }
        catch (Exception ex)
        {
            delivery.Notes = $"{delivery.Notes} [Ledger: {ex.Message}]";
        }

        await _db.SaveChangesAsync();
        return Success<object>(delivery, "Customer delivery recorded successfully.");
    }

    #endregion

    #region 18. Distributor Business Dashboard & Reports

    [HttpGet("distributors/{distributorId}/dashboard")]
    public async Task<ActionResult<ApiResponse<object>>> GetDistributorDashboard(Guid distributorId)
    {
        var distributor = await _db.Customers.FirstOrDefaultAsync(c => c.Id == distributorId && c.TenantId == _user.TenantId && !c.IsDeleted);
        if (distributor == null) return Failure<object>("Distributor not found.", "Resource not found", HttpStatusCode.NotFound);

        var profile = await _db.TwentyLDistributorProfiles.FirstOrDefaultAsync(p => p.CustomerId == distributorId && p.TenantId == _user.TenantId && !p.IsDeleted);

        // Upstream company supply totals
        var supplies = await _db.TwentyLDistributorSupplies
            .Where(s => s.DistributorId == distributorId && s.TenantId == _user.TenantId)
            .ToListAsync();

        var totalSuppliedFilled = supplies.Sum(s => s.QuantitySupplied);
        var totalEmptiesReturned = supplies.Sum(s => s.QuantityEmptyReturned);
        var totalSupplyCost = supplies.Sum(s => s.TotalAmount);
        var totalSupplyPaid = supplies.Sum(s => s.AmountPaid);
        var companyOutstanding = totalSupplyCost - totalSupplyPaid;

        // Downstream customer delivery totals
        var deliveries = await _db.TwentyLDistributorDeliveries
            .Where(d => d.DistributorId == distributorId && d.TenantId == _user.TenantId)
            .ToListAsync();

        var totalDeliveredToCustomers = deliveries.Sum(d => d.QuantityFilledDelivered);
        var totalEmptiesFromCustomers = deliveries.Sum(d => d.QuantityEmptyCollected);
        var totalCustomerRevenue = deliveries.Sum(d => d.TotalAmount);
        var totalCustomerCollected = deliveries.Sum(d => d.AmountCollected);
        var customerOutstanding = totalCustomerRevenue - totalCustomerCollected;
        var totalGrossMargin = deliveries.Sum(d => d.GrossMargin);

        // Customer jar counts
        var customers = await _db.TwentyLDistributorCustomers
            .Where(c => c.DistributorId == distributorId && c.TenantId == _user.TenantId && !c.IsDeleted)
            .ToListAsync();

        var filledWithCustomers = customers.Sum(c => c.FilledJarsHeld);
        var emptyWithCustomers = customers.Sum(c => c.EmptyJarsHeld);

        // Physical jar position at distributor depot
        var filledAtDepot = Math.Max(0, totalSuppliedFilled - totalDeliveredToCustomers);
        var emptyAtDepot = Math.Max(0, totalEmptiesFromCustomers - totalEmptiesReturned);

        var activeRoutesCount = await _db.TwentyLDistributorRoutes.CountAsync(r => r.DistributorId == distributorId && r.TenantId == _user.TenantId && !r.IsDeleted && r.IsActive);
        var activeVehiclesCount = await _db.TwentyLDistributorVehicles.CountAsync(v => v.DistributorId == distributorId && v.TenantId == _user.TenantId && !v.IsDeleted && v.IsActive);
        var activeDriversCount = await _db.TwentyLDistributorDrivers.CountAsync(d => d.DistributorId == distributorId && d.TenantId == _user.TenantId && !d.IsDeleted && d.IsActive);

        var recentSupplies = supplies.OrderByDescending(s => s.CreatedAt).Take(5).ToList();
        var recentDeliveries = deliveries.OrderByDescending(d => d.DeliveryDate).Take(10).ToList();

        return Success<object>(new
        {
            Distributor = new
            {
                Id = distributor.Id,
                Name = distributor.CustomerName,
                Phone = distributor.Phone,
                Address = distributor.AddressLine1,
                DistributorType = profile?.DistributorType ?? "EXTERNAL",
                CreditLimit = profile?.CreditLimit ?? 0
            },
            UpstreamCompanyRelationship = new
            {
                TotalFilledJarsSupplied = totalSuppliedFilled,
                TotalEmptiesReturnedToPlant = totalEmptiesReturned,
                TotalSupplyPurchases = totalSupplyCost,
                TotalPaidToCompany = totalSupplyPaid,
                OutstandingDueToCompany = companyOutstanding
            },
            DownstreamCustomerBusiness = new
            {
                TotalFilledDelivered = totalDeliveredToCustomers,
                TotalEmptiesCollected = totalEmptiesFromCustomers,
                TotalRevenue = totalCustomerRevenue,
                TotalCollected = totalCustomerCollected,
                CustomerOutstandingDue = customerOutstanding,
                TotalGrossMarginEarned = totalGrossMargin
            },
            JarInventoryPosition = new
            {
                FilledJarsAtDepot = filledAtDepot,
                EmptyJarsAtDepot = emptyAtDepot,
                FilledWithCustomers = filledWithCustomers,
                EmptyWithCustomers = emptyWithCustomers,
                TotalPhysicalJarsInNetwork = filledAtDepot + emptyAtDepot + filledWithCustomers + emptyWithCustomers
            },
            Counts = new
            {
                ActiveCustomers = customers.Count,
                ActiveRoutes = activeRoutesCount,
                ActiveVehicles = activeVehiclesCount,
                ActiveDrivers = activeDriversCount
            },
            RecentSupplies = recentSupplies,
            RecentDeliveries = recentDeliveries
        }, "Distributor business dashboard loaded.");
    }

    #endregion

    #region 19. Driver Mobile Portal

    [HttpGet("driver-portal/today")]
    public async Task<ActionResult<ApiResponse<object>>> GetDriverPortalToday([FromQuery] Guid? distributorId = null, [FromQuery] string? driverName = null)
    {
        var distId = distributorId;
        if (!distId.HasValue || distId.Value == Guid.Empty)
        {
            var firstDist = await _db.Customers.Where(c => c.TenantId == _user.TenantId && !c.IsDeleted).Select(c => c.Id).FirstOrDefaultAsync();
            distId = firstDist;
        }

        if (!distId.HasValue || distId.Value == Guid.Empty)
            return Success<object>(new { Stops = new List<object>(), Summary = new { } }, "No distributor available.");

        var customerQuery = _db.TwentyLDistributorCustomers
            .Where(c => c.DistributorId == distId.Value && c.TenantId == _user.TenantId && !c.IsDeleted && c.IsActive);

        if (!string.IsNullOrWhiteSpace(driverName))
            customerQuery = customerQuery.Where(c => c.AssignedDriverName == driverName || string.IsNullOrEmpty(c.AssignedDriverName));

        var customers = await customerQuery.OrderBy(c => c.RouteName).ThenBy(c => c.CustomerName).ToListAsync();

        // Get today's deliveries already made by this driver
        var today = DateTime.UtcNow.Date;
        var todayDeliveries = await _db.TwentyLDistributorDeliveries
            .Where(d => d.DistributorId == distId.Value && d.TenantId == _user.TenantId && d.DeliveryDate >= today)
            .ToListAsync();

        var deliveredCustomerIds = todayDeliveries.Select(d => d.DistributorCustomerId).ToHashSet();

        var stops = customers.Select((c, idx) => new
        {
            StopNumber = idx + 1,
            CustomerId = c.Id,
            CustomerName = c.CustomerName,
            Phone = c.Phone,
            Address = c.Address,
            Area = c.Area,
            RouteName = c.RouteName,
            DefaultRate = c.DefaultRate,
            FilledHeld = c.FilledJarsHeld,
            EmptyHeld = c.EmptyJarsHeld,
            OutstandingBalance = c.OutstandingBalance,
            IsDeliveredToday = deliveredCustomerIds.Contains(c.Id),
            TodayDelivery = todayDeliveries.FirstOrDefault(d => d.DistributorCustomerId == c.Id)
        }).ToList();

        var totalLoaded = todayDeliveries.Sum(d => d.QuantityFilledDelivered) + 20; // illustrative loaded baseline
        var totalDelivered = todayDeliveries.Sum(d => d.QuantityFilledDelivered);
        var totalCollected = todayDeliveries.Sum(d => d.QuantityEmptyCollected);

        return Success<object>(new
        {
            DistributorId = distId.Value,
            DriverName = driverName ?? "Primary Driver",
            VehicleNumber = "KL-07-AW-2020",
            Date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Stops = stops,
            DriverJarPosition = new
            {
                LoadedFilled = totalLoaded,
                DeliveredFilled = totalDelivered,
                RemainingFilledInVehicle = Math.Max(0, totalLoaded - totalDelivered),
                EmptyCollectedInVehicle = totalCollected
            }
        }, "Driver portal active stops retrieved.");
    }

    [HttpPost("driver-portal/deliver-stop")]
    public async Task<ActionResult<ApiResponse<object>>> DriverDeliverStop([FromBody] DriverPortalDeliveryRequest request)
    {
        var deliveryReq = new CreateDistributorDeliveryRequest
        {
            DistributorCustomerId = request.CustomerId,
            QuantityFilledDelivered = request.QuantityFilledDelivered,
            QuantityEmptyCollected = request.QuantityEmptyCollected,
            QuantityDamaged = request.QuantityDamaged,
            SellingRate = request.SellingRate,
            AmountCollected = request.AmountCollected,
            PaymentMode = request.PaymentMode ?? "CASH",
            DriverName = request.DriverName,
            VehicleNumber = request.VehicleNumber,
            Notes = request.Notes
        };

        return await CreateDistributorCustomerDelivery(request.DistributorId, deliveryReq);
    }

    #endregion

    #region Helpers

    private async Task<TwentyLRateRule?> FindRate(Guid productId, Guid? customerId, string refillType, string jarOwnerType, int quantity, DateTime on)
        => await _db.TwentyLRateRules.Where(r => r.TenantId == _user.TenantId && r.ProductId == productId && r.IsActive && !r.IsDeleted &&
                r.EffectiveFrom <= on.Date && (r.EffectiveTo == null || r.EffectiveTo >= on.Date) && r.MinimumQuantity <= quantity &&
                (r.CustomerId == customerId || r.CustomerId == null) && (r.RefillType == refillType || r.RefillType == "ANY") && (r.JarOwnerType == jarOwnerType || r.JarOwnerType == "ANY"))
            .OrderByDescending(r => r.CustomerId == customerId).ThenByDescending(r => r.Priority).ThenByDescending(r => r.MinimumQuantity).ThenByDescending(r => r.EffectiveFrom).FirstOrDefaultAsync();

    private async Task<Guid> CompanyId() => await _db.Companies.Where(c => c.TenantId == _user.TenantId).Select(c => c.Id).FirstOrDefaultAsync();

    private static string Key(Guid companyId, TwentyLPosition p) => string.Join('|', companyId, p.ProductId?.ToString() ?? "-", p.OwnerType, p.OwnerCustomerId?.ToString() ?? "-", p.HolderType, p.HolderCustomerId?.ToString() ?? "-", p.LocationType, p.LocationReference ?? "-", p.ContainerStatus);

    #endregion
}

public sealed class CreateTwentyLRateRuleRequest
{
    public Guid ProductId { get; set; }
    public Guid? CustomerId { get; set; }
    public string PartyType { get; set; } = "ANY";
    public string RefillType { get; set; } = "ANY";
    public string JarOwnerType { get; set; } = "ANY";
    public decimal MinimumQuantity { get; set; } = 1;
    public int Priority { get; set; }
    public decimal UnitRate { get; set; }
    public decimal? DiscountRate { get; set; }
    public decimal? TaxRate { get; set; }
    public DateTime EffectiveFrom { get; set; } = DateTime.UtcNow;
    public DateTime? EffectiveTo { get; set; }
    public bool RequiresAuthorization { get; set; }
    public string? Notes { get; set; }
}

public sealed class UpdateTwentyLRateRuleRequest
{
    public decimal MinimumQuantity { get; set; } = 1;
    public int Priority { get; set; }
    public decimal UnitRate { get; set; }
    public decimal? DiscountRate { get; set; }
    public decimal? TaxRate { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool RequiresAuthorization { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

public sealed class CreateTwentyLJarMovementRequest
{
    public Guid? ProductId { get; set; }
    public string OwnerType { get; set; } = "COMPANY";
    public Guid? OwnerCustomerId { get; set; }
    public string FromHolderType { get; set; } = "COMPANY";
    public Guid? FromHolderCustomerId { get; set; }
    public string HolderType { get; set; } = "COMPANY";
    public Guid? HolderCustomerId { get; set; }
    public string FromLocationType { get; set; } = "PLANT";
    public string? FromLocationReference { get; set; }
    public string ToLocationType { get; set; } = "CUSTOMER";
    public string? ToLocationReference { get; set; }
    public string FromContainerStatus { get; set; } = "EMPTY";
    public string MovementType { get; set; } = string.Empty;
    public string ContainerStatus { get; set; } = "EMPTY";
    public int Quantity { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }
    public DateTime? OccurredAt { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
}

public sealed class CreateTwentyLCommissionRuleRequest
{
    public Guid? BeneficiaryCustomerId { get; set; }
    public Guid? ProductId { get; set; }
    public string BeneficiaryType { get; set; } = "DISTRIBUTOR";
    public string CalculationType { get; set; } = "PERCENTAGE";
    public decimal Value { get; set; }
    public decimal MinimumQuantity { get; set; }
    public DateTime EffectiveFrom { get; set; } = DateTime.UtcNow;
    public DateTime? EffectiveTo { get; set; }
    public int Priority { get; set; }
}

public sealed class CreateTwentyLDeliveryRequest
{
    public Guid CustomerId { get; set; }
    public Guid? DistributorId { get; set; }
    public Guid ProductId { get; set; }
    public string RefillType { get; set; } = "DIRECT_CUSTOMER_REFILL";
    public string JarOwnerType { get; set; } = "COMPANY";
    public int OrderedQuantity { get; set; }
    public int FilledDeliveredQuantity { get; set; }
    public int EmptyCollectedQuantity { get; set; }
    public int FailedQuantity { get; set; }
    public decimal? ManualUnitRate { get; set; }
    public decimal? DiscountAmount { get; set; }
    public decimal? TaxAmount { get; set; }
    public decimal AmountCollected { get; set; }
    public string PaymentMode { get; set; } = "CREDIT";
    public string? RouteReference { get; set; }
    public string? VehicleReference { get; set; }
    public string? DriverReference { get; set; }
    public DateTime DeliveredAt { get; set; } = DateTime.UtcNow;
    public string? FailureReason { get; set; }
    public string? Notes { get; set; }
    public string? IdempotencyKey { get; set; }
}

public sealed class CancelDeliveryRequest
{
    public string Reason { get; set; } = string.Empty;
}

public sealed class SaveDistributorProfileRequest
{
    public Guid CustomerId { get; set; }
    public string? DistributorType { get; set; } = "EXTERNAL";
    public string? JarOwnershipModel { get; set; } = "MIXED";
    public string? VehicleOwnership { get; set; } = "DISTRIBUTOR";
    public string? RouteOwnership { get; set; } = "DISTRIBUTOR";
    public string? PricingModel { get; set; } = "RATE_CARD";
    public string? CommissionModel { get; set; } = "NONE";
    public decimal CreditLimit { get; set; }
    public decimal SecurityDeposit { get; set; }
    public string? PaymentTerms { get; set; }
    public DateTime? EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public string? AgreementReference { get; set; }
}

public sealed class CreateTwentyLTripRequest
{
    public string DriverName { get; set; } = string.Empty;
    public Guid? DriverCustomerId { get; set; }
    public string VehicleNumber { get; set; } = string.Empty;
    public string? RouteCode { get; set; }
    public DateTime PlannedDate { get; set; } = DateTime.UtcNow;
    public List<CreateTwentyLTripStopRequest>? Stops { get; set; }
}

public sealed class CreateTwentyLTripStopRequest
{
    public Guid CustomerId { get; set; }
    public Guid? ProductId { get; set; }
    public int PlannedFilledJars { get; set; }
    public decimal UnitRate { get; set; }
    public string? PaymentMode { get; set; } = "CREDIT";
}

public sealed class LoadTwentyLTripRequest
{
    public Guid? ProductId { get; set; }
    public int FilledQuantity { get; set; }
    public int EmptyQuantity { get; set; }
    public string? Notes { get; set; }
}

public sealed class DeliverTripStopRequest
{
    public Guid StopId { get; set; }
    public Guid? ProductId { get; set; }
    public int DeliveredFilledJars { get; set; }
    public int CollectedEmptyJars { get; set; }
    public int DamagedEmptyJars { get; set; }
    public int LostJars { get; set; }
    public decimal? ManualUnitRate { get; set; }
    public decimal? AmountCollected { get; set; }
    public string? PaymentMode { get; set; } = "CREDIT";
    public string? FailureReason { get; set; }
    public string? Notes { get; set; }
}

public sealed class ReturnTripRequest
{
    public int ReturnedFilledJars { get; set; }
    public int ReturnedEmptyJars { get; set; }
    public int DamagedJarsCount { get; set; }
    public int LostJarsCount { get; set; }
    public string? DamageReason { get; set; }
    public string? Notes { get; set; }
}

public sealed class AllAtOnceOperationRequest
{
    public string DriverName { get; set; } = string.Empty;
    public string VehicleNumber { get; set; } = string.Empty;
    public string? RouteCode { get; set; }
    public Guid? ProductId { get; set; }
    public DateTime? OperationDate { get; set; }
    public int LoadedFilledJars { get; set; }
    public int LoadedEmptyJars { get; set; }
    public int ReturnedFilledJars { get; set; }
    public int ReturnedEmptyJars { get; set; }
    public int DamagedJarsCount { get; set; }
    public int LostJarsCount { get; set; }
    public string? DamageReason { get; set; }
    public string? Notes { get; set; }
    public List<AllAtOnceStopRequest> Stops { get; set; } = new();
}

public sealed class AllAtOnceStopRequest
{
    public Guid CustomerId { get; set; }
    public int DeliveredFilledJars { get; set; }
    public int CollectedEmptyJars { get; set; }
    public decimal UnitRate { get; set; }
    public decimal? AmountCollected { get; set; }
    public string? PaymentMode { get; set; } = "CREDIT";
}

public sealed class QuickDeliveryRequest
{
    public Guid CustomerId { get; set; }
    public Guid? ProductId { get; set; }
    public int QuantityFilled { get; set; }
    public int QuantityEmptyCollected { get; set; }
    public decimal? ManualUnitRate { get; set; }
    public decimal? AmountCollected { get; set; }
    public string? PaymentMode { get; set; } = "CASH";
    public string? DriverName { get; set; }
    public string? VehicleNumber { get; set; }
    public string? Notes { get; set; }
    public string? IdempotencyKey { get; set; }
}

public sealed class QuickReturnRequest
{
    public Guid CustomerId { get; set; }
    public Guid? ProductId { get; set; }
    public int QuantityEmpty { get; set; }
    public string? Notes { get; set; }
}

public sealed class QuickDamageCondemnationRequest
{
    public Guid? ProductId { get; set; }
    public int Quantity { get; set; }
    public bool IsCondemnation { get; set; }
    public string? ResponsibleParty { get; set; } = "PLANT";
    public string? Reason { get; set; }
    public string? Notes { get; set; }
}

public sealed class RepairJarsRequest
{
    public Guid? ProductId { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
}

public sealed class CreateDistributorSupplyRequest
{
    public Guid DistributorId { get; set; }
    public Guid ProductId { get; set; }
    public string? ProductName { get; set; }
    public int QuantityRequested { get; set; }
    public int QuantitySupplied { get; set; }
    public int QuantityEmptyReturned { get; set; }
    public int QuantityDamaged { get; set; }
    public decimal AppliedRate { get; set; }
    public decimal AmountPaid { get; set; }
    public string? PaymentMode { get; set; } = "CREDIT";
    public string? VehicleNumber { get; set; }
    public string? DriverName { get; set; }
    public string? DispatcherNotes { get; set; }
    public string? ReceiverNotes { get; set; }
    public string? Stage { get; set; } = "COMPLETED";
}

public sealed class ReceiveDistributorSupplyRequest
{
    public string? Notes { get; set; }
}

public sealed class CreateDistributorRouteRequest
{
    public string RouteCode { get; set; } = string.Empty;
    public string RouteName { get; set; } = string.Empty;
    public string? AreaDescription { get; set; }
    public string? DefaultDriverName { get; set; }
    public string? DefaultVehicleNumber { get; set; }
    public string? ScheduleDays { get; set; } = "DAILY";
}

public sealed class UpdateDistributorRouteRequest
{
    public string? RouteCode { get; set; }
    public string? RouteName { get; set; }
    public string? AreaDescription { get; set; }
    public string? DefaultDriverName { get; set; }
    public string? DefaultVehicleNumber { get; set; }
    public string? ScheduleDays { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CreateDistributorVehicleRequest
{
    public string RegistrationNumber { get; set; } = string.Empty;
    public string? VehicleType { get; set; } = "MINI_TRUCK";
    public int CapacityJars { get; set; } = 50;
    public string? AssignedDriverName { get; set; }
}

public sealed class UpdateDistributorVehicleRequest
{
    public string? RegistrationNumber { get; set; }
    public string? VehicleType { get; set; }
    public int CapacityJars { get; set; }
    public string? AssignedDriverName { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CreateDistributorDriverRequest
{
    public string DriverName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? LicenseNumber { get; set; }
    public string? AssignedVehicleNumber { get; set; }
    public Guid? CurrentRouteId { get; set; }
}

public sealed class UpdateDistributorDriverRequest
{
    public string? DriverName { get; set; }
    public string? Phone { get; set; }
    public string? LicenseNumber { get; set; }
    public string? AssignedVehicleNumber { get; set; }
    public Guid? CurrentRouteId { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CreateDistributorCustomerRequest
{
    public string CustomerName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Area { get; set; }
    public Guid? RouteId { get; set; }
    public string? RouteName { get; set; }
    public string? DeliveryFrequency { get; set; } = "DAILY";
    public decimal DefaultRate { get; set; } = 40;
    public string? AssignedDriverName { get; set; }
    public string? AssignedVehicleNumber { get; set; }
    public int OpeningFilledJars { get; set; }
    public int OpeningEmptyJars { get; set; }
    public decimal SecurityDeposit { get; set; }
    public decimal OpeningBalance { get; set; }
}

public sealed class UpdateDistributorCustomerRequest
{
    public string? CustomerName { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Area { get; set; }
    public Guid? RouteId { get; set; }
    public string? RouteName { get; set; }
    public string? DeliveryFrequency { get; set; }
    public decimal DefaultRate { get; set; }
    public string? AssignedDriverName { get; set; }
    public string? AssignedVehicleNumber { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CreateDistributorDeliveryRequest
{
    public Guid DistributorCustomerId { get; set; }
    public Guid? RouteId { get; set; }
    public string? RouteName { get; set; }
    public string? DriverName { get; set; }
    public string? VehicleNumber { get; set; }
    public Guid? ProductId { get; set; }
    public int QuantityFilledDelivered { get; set; }
    public int QuantityEmptyCollected { get; set; }
    public int QuantityDamaged { get; set; }
    public decimal SellingRate { get; set; }
    public decimal AmountCollected { get; set; }
    public string? PaymentMode { get; set; } = "CASH";
    public string? Notes { get; set; }
}

public sealed class DriverPortalDeliveryRequest
{
    public Guid DistributorId { get; set; }
    public Guid CustomerId { get; set; }
    public int QuantityFilledDelivered { get; set; }
    public int QuantityEmptyCollected { get; set; }
    public int QuantityDamaged { get; set; }
    public decimal SellingRate { get; set; }
    public decimal AmountCollected { get; set; }
    public string? PaymentMode { get; set; } = "CASH";
    public string? DriverName { get; set; }
    public string? VehicleNumber { get; set; }
    public string? Notes { get; set; }
}

