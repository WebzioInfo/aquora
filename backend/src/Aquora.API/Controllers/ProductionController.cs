using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.API.Controllers;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;

using Microsoft.AspNetCore.SignalR;
using Aquora.API.Hubs;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ProductionController : ApiControllerBase
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantDbContext _tenantContext;
        private readonly IHubContext<DashboardHub> _dashboardHub;

        public ProductionController(
            IPlatformDbContext platformContext,
            ITenantDbContext tenantContext,
            IHubContext<DashboardHub> dashboardHub)
        {
            _platformContext = platformContext;
            _tenantContext = tenantContext;
            _dashboardHub = dashboardHub;
        }

        private async Task NotifyDashboardAsync(string eventName, object? data = null)
        {
            try
            {
                var tenantId = GetTenantId().ToString();
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
                // Non-blocking telemetry warning
                Console.WriteLine($"[SIGNALR WARNING]: Failed to emit dashboard event '{eventName}': {ex.Message}");
            }
        }

        private Guid GetTenantId()
        {
            var claim = User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var tenantId))
            {
                throw new UnauthorizedAccessException("Tenant context is missing or invalid.");
            }
            return tenantId;
        }

        private string GetCurrentUserId()
        {
            return User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "System";
        }

        private string GetCurrentUserEmail()
        {
            return User.FindFirst("email")?.Value ?? User.Identity?.Name ?? "operator@aquora.com";
        }

        private string GetCurrentUserName()
        {
            var firstName = User.FindFirst("given_name")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.GivenName)?.Value;
            var lastName = User.FindFirst("family_name")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Surname)?.Value;
            if (!string.IsNullOrEmpty(firstName))
            {
                return $"{firstName} {lastName}".Trim();
            }
            return GetCurrentUserEmail().Split('@')[0];
        }

        // 1. GET api/v1/production/lines
        [HttpGet("lines")]
        public async Task<ActionResult<ApiResponse<List<ProductionLineDto>>>> GetProductionLines([FromQuery] bool includeInactive = false)
        {
            try
            {
                var tenantId = GetTenantId();
                var query = _tenantContext.ProductionLines.Where(l => !l.IsDeleted);
                if (!includeInactive)
                {
                    query = query.Where(l => l.IsActive);
                }
                var lines = await query.OrderBy(l => l.Code).ToListAsync();

                var activeBatches = await _tenantContext.ProductionBatches
                    .Where(b => b.Status == "Active" && !b.IsDeleted)
                    .ToListAsync();

                var result = new List<ProductionLineDto>();
                foreach (var line in lines)
                {
                    var activeBatch = activeBatches.FirstOrDefault(b => b.ProductionLineId == line.Id);
                    result.Add(new ProductionLineDto
                    {
                        LineId = line.Id,
                        Name = line.Name,
                        Code = line.Code,
                        IsActive = line.IsActive,
                        HasActiveBatch = activeBatch != null,
                        ActiveBatch = activeBatch != null ? new ActiveBatchSummaryDto
                        {
                            BatchId = activeBatch.Id,
                            BatchNumber = activeBatch.BatchNumber,
                            Product = activeBatch.Product,
                            Shift = activeBatch.Shift,
                            StartedAt = activeBatch.StartedAt,
                            TargetQuantity = activeBatch.TargetQuantity,
                            ProducedQuantity = activeBatch.ProducedQuantity
                        } : null
                    });
                }

                return Success<List<ProductionLineDto>>(result, "Production lines loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<ProductionLineDto>>(ex.Message, "Failed to load production lines.");
            }
        }

        [HttpGet("cockpit-reporting")]
        public async Task<ActionResult<ApiResponse<CockpitReportingDto>>> GetCockpitReporting(
            [FromQuery] string range = "today",
            [FromQuery] int tzOffset = -330)
        {
            try
            {
                var tenantId = GetTenantId();
                var nowUtc = DateTime.UtcNow;
                var dateFilter = (range ?? "today").ToLower().Trim();

                var userOffset = TimeSpan.FromMinutes(-tzOffset);
                var nowLocal = nowUtc.Add(userOffset);
                var todayLocalStart = nowLocal.Date;

                DateTime queryUtcStart;
                if (dateFilter == "7days")
                {
                    queryUtcStart = todayLocalStart.AddDays(-6).Subtract(userOffset);
                }
                else if (dateFilter == "30days")
                {
                    queryUtcStart = todayLocalStart.AddDays(-29).Subtract(userOffset);
                }
                else // "today"
                {
                    queryUtcStart = todayLocalStart.Subtract(userOffset);
                }

                DateTime ToLocal(DateTime dt)
                {
                    if (dt == default) return nowLocal;
                    var utc = dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);
                    return utc.Add(userOffset);
                }

                DateTime GetTransactionLocalTime(SalesTransaction s)
                {
                    if (s.CreatedAt != default)
                    {
                        var localCreated = ToLocal(s.CreatedAt);
                        if (s.TransactionDate != default)
                        {
                            var localTxnDate = ToLocal(s.TransactionDate);
                            if (localTxnDate.TimeOfDay != TimeSpan.Zero)
                            {
                                return localTxnDate;
                            }
                        }
                        return localCreated;
                    }
                    return ToLocal(s.TransactionDate != default ? s.TransactionDate : nowUtc);
                }

                // 1. Fetch Production Batches in range
                var batches = await _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .Where(b => b.TenantId == tenantId && !b.IsDeleted && 
                                (b.StartedAt >= queryUtcStart || (b.CompletedAt.HasValue && b.CompletedAt.Value >= queryUtcStart) || b.CreatedAt >= queryUtcStart))
                    .ToListAsync();

                // 2. Fetch Production Entries in range (Primary Source for Production Entries)
                var entries = await _tenantContext.ProductionEntries
                    .Include(e => e.Product)
                    .Where(e => e.TenantId == tenantId && !e.IsDeleted && 
                                (e.CreatedAt >= queryUtcStart || e.Date >= queryUtcStart.Date))
                    .ToListAsync();

                // 3. Fetch Sales Transactions in range
                var salesTxns = await _tenantContext.SalesTransactions
                    .Include(s => s.Product)
                    .Include(s => s.Customer)
                    .Where(s => s.TenantId == tenantId && !s.IsDeleted && 
                                (s.TransactionDate >= queryUtcStart || s.CreatedAt >= queryUtcStart))
                    .ToListAsync();

                // 4. Fetch Active Production Lines
                var activeLines = await _tenantContext.ProductionLines
                    .Where(l => l.TenantId == tenantId && !l.IsDeleted && l.IsActive)
                    .ToListAsync();

                var prodTrendPoints = new List<ProductionTrendPointDto>();
                var dispatchTrendPoints = new List<DispatchTrendPointDto>();

                if (dateFilter == "today")
                {
                    var localEntries = entries.Select(e => new { Entry = e, LocalDt = ToLocal(e.CreatedAt != default ? e.CreatedAt : e.Date) })
                                              .Where(x => x.LocalDt.Date == todayLocalStart)
                                              .OrderBy(x => x.LocalDt)
                                              .ToList();

                    var localBatches = batches.Select(b => new { Batch = b, LocalDt = ToLocal(b.StartedAt != default ? b.StartedAt : b.CreatedAt) })
                                              .Where(x => x.LocalDt.Date == todayLocalStart)
                                              .ToList();

                    // Generate event-driven points for Production Trend
                    int cumulativeProduction = 0;
                    foreach (var item in localEntries)
                    {
                        var e = item.Entry;
                        var pName = e.Product?.Name ?? "Standard Bottled Water";
                        var timeFormatted = item.LocalDt.ToString("hh:mm tt");
                        var dateStr = item.LocalDt.ToString("dd MMM yyyy");
                        
                        var activeBatch = batches.FirstOrDefault(b => b.ProductionLineId == e.ProductionLineId && b.StartedAt <= e.CreatedAt && (b.CompletedAt == null || b.CompletedAt >= e.CreatedAt));
                        string batchNumber = activeBatch?.BatchNumber ?? "-";

                        cumulativeProduction += e.CasesProduced;

                        prodTrendPoints.Add(new ProductionTrendPointDto
                        {
                            Label = timeFormatted,
                            DateStr = dateStr,
                            Hour = item.LocalDt.Hour,
                            TotalCases = cumulativeProduction,
                            LoggedCases = e.CasesProduced,
                            EntriesCount = 1,
                            RecordedTimes = new List<string> { timeFormatted },
                            Products = new List<ProductBreakdownDto>
                            {
                                new ProductBreakdownDto
                                {
                                    ProductName = pName,
                                    Cases = e.CasesProduced,
                                    EntriesCount = 1,
                                    RecordedTimes = new List<string> { timeFormatted }
                                }
                            },
                            OperatorName = !string.IsNullOrWhiteSpace(e.OperatorName) ? e.OperatorName : activeBatch?.OperatorName ?? "-",
                            Shift = !string.IsNullOrWhiteSpace(e.Shift) ? e.Shift : activeBatch?.Shift ?? "-",
                            BatchNumber = batchNumber,
                            Timestamp = new DateTimeOffset(item.LocalDt).ToUnixTimeMilliseconds()
                        });
                    }

                    // Generate event-driven points for Dispatch Trend
                    var localDispatches = salesTxns
                        .Select(s => new { Txn = s, LocalDt = GetTransactionLocalTime(s) })
                        .Where(x => x.LocalDt.Date == todayLocalStart)
                        .OrderBy(x => x.LocalDt)
                        .ToList();

                    int runningNetTotal = 0;
                    int runningDispatchedTotal = 0;
                    int runningReturnedTotal = 0;
                    int runningDamageTotal = 0;

                    foreach (var item in localDispatches)
                    {
                        var s = item.Txn;
                        var pName = s.Product?.Name ?? "Standard Bottled Water";
                        var cName = s.Customer?.CustomerName ?? s.Customer?.BusinessName ?? "General Customer";
                        var timeFormatted = item.LocalDt.ToString("hh:mm tt");
                        var dateStr = item.LocalDt.ToString("dd MMM yyyy");
                        var dayOfWeekStr = item.LocalDt.ToString("dddd");
                        int casesInt = Convert.ToInt32(s.Cases);

                        bool isReturn = s.TransactionType == "Customer Return";
                        bool isDamage = s.TransactionType == "Damage";

                        if (isReturn)
                        {
                            runningReturnedTotal += casesInt;
                            runningNetTotal = Math.Max(0, runningNetTotal - casesInt);
                        }
                        else if (isDamage)
                        {
                            runningDamageTotal += casesInt;
                        }
                        else
                        {
                            runningDispatchedTotal += casesInt;
                            runningNetTotal += casesInt;
                        }

                        dispatchTrendPoints.Add(new DispatchTrendPointDto
                        {
                            Label = timeFormatted,
                            DateStr = dateStr,
                            DayOfWeek = dayOfWeekStr,
                            Hour = item.LocalDt.Hour,
                            DispatchedCases = runningDispatchedTotal,
                            LoggedDispatched = (!isReturn && !isDamage) ? casesInt : 0,
                            ReturnedCases = runningReturnedTotal,
                            LoggedReturned = isReturn ? casesInt : 0,
                            DamageCases = runningDamageTotal,
                            LoggedDamage = isDamage ? casesInt : 0,
                            NetDispatchCases = runningNetTotal,
                            EntriesCount = 1,
                            RecordedTimes = new List<string> { timeFormatted },
                            TransactionType = s.TransactionType,
                            TransactionNumber = !string.IsNullOrWhiteSpace(s.TransactionNumber) ? s.TransactionNumber : (s.ReferenceNumber ?? "-"),
                            CustomerName = cName,
                            ProductName = pName,
                            Quantity = casesInt,
                            RunningTotal = runningNetTotal,
                            Timestamp = new DateTimeOffset(item.LocalDt).ToUnixTimeMilliseconds(),
                            Products = new List<DispatchProductBreakdownDto>
                            {
                                new DispatchProductBreakdownDto
                                {
                                    ProductName = pName,
                                    DispatchedCases = (!isReturn && !isDamage) ? casesInt : 0,
                                    ReturnedCases = isReturn ? casesInt : 0,
                                    NetDispatchCases = isReturn ? -casesInt : (isDamage ? 0 : casesInt)
                                }
                            }
                        });
                    }
                }
                else if (dateFilter == "7days")
                {
                    int runningNetTotal = 0;
                    int runningDispatchedTotal = 0;
                    int runningReturnedTotal = 0;
                    int runningDamageTotal = 0;

                    for (int i = 6; i >= 0; i--)
                    {
                        var dayDate = todayLocalStart.AddDays(-i);
                        var dayLabel = dayDate.ToString("ddd");
                        var dateFullStr = dayDate.ToString("dd MMM yyyy");
                        var dayOfWeekStr = dayDate.ToString("dddd");

                        var dayEntries = entries.Select(e => new { Entry = e, LocalDt = ToLocal(e.CreatedAt != default ? e.CreatedAt : e.Date) })
                                                .Where(x => x.LocalDt.Date == dayDate)
                                                .ToList();

                        var dayBatches = batches.Select(b => new { Batch = b, LocalDt = ToLocal(b.StartedAt != default ? b.StartedAt : b.CreatedAt) })
                                               .Where(x => x.LocalDt.Date == dayDate)
                                               .ToList();

                        var productMap = new Dictionary<string, (int cases, int count, List<string> times)>();
                        foreach (var item in dayEntries)
                        {
                            var e = item.Entry;
                            var pName = e.Product?.Name ?? "Standard Bottled Water";
                            if (!productMap.ContainsKey(pName)) productMap[pName] = (0, 0, new List<string>());
                            var current = productMap[pName];
                            productMap[pName] = (current.cases + e.CasesProduced, current.count + 1, current.times);
                        }

                        if (dayEntries.Count == 0)
                        {
                            foreach (var item in dayBatches)
                            {
                                var b = item.Batch;
                                var pName = !string.IsNullOrWhiteSpace(b.Product) ? b.Product : "Standard Bottled Water";
                                if (!productMap.ContainsKey(pName)) productMap[pName] = (0, 0, new List<string>());
                                var current = productMap[pName];
                                productMap[pName] = (current.cases + b.ProducedQuantity, current.count + 1, current.times);
                            }
                        }

                        prodTrendPoints.Add(new ProductionTrendPointDto
                        {
                            Label = dayLabel,
                            DateStr = dateFullStr,
                            Hour = -1,
                            TotalCases = productMap.Values.Sum(v => v.cases),
                            EntriesCount = productMap.Values.Sum(v => v.count),
                            Products = productMap.Select(kv => new ProductBreakdownDto { ProductName = kv.Key, Cases = kv.Value.cases, EntriesCount = kv.Value.count }).ToList()
                        });

                        var dayDispatches = salesTxns.Select(s => new { Txn = s, LocalDt = GetTransactionLocalTime(s) })
                                                    .Where(x => x.LocalDt.Date == dayDate)
                                                    .ToList();

                        int pDisp = dayDispatches.Where(x => x.Txn.TransactionType == "Sales Dispatch" || string.IsNullOrEmpty(x.Txn.TransactionType)).Sum(x => Convert.ToInt32(x.Txn.Cases));
                        int pRet = dayDispatches.Where(x => x.Txn.TransactionType == "Customer Return").Sum(x => Convert.ToInt32(x.Txn.Cases));
                        int pDam = dayDispatches.Where(x => x.Txn.TransactionType == "Damage").Sum(x => Convert.ToInt32(x.Txn.Cases));

                        runningDispatchedTotal += pDisp;
                        runningReturnedTotal += pRet;
                        runningDamageTotal += pDam;
                        runningNetTotal = Math.Max(0, runningNetTotal + pDisp - pRet);

                        var dispatchProductMap = new Dictionary<string, (int dispatched, int returned)>();
                        foreach (var item in dayDispatches)
                        {
                            var s = item.Txn;
                            var pName = s.Product?.Name ?? "Standard Bottled Water";
                            if (!dispatchProductMap.ContainsKey(pName)) dispatchProductMap[pName] = (0, 0);
                            int casesInt = Convert.ToInt32(s.Cases);
                            if (s.TransactionType == "Sales Dispatch" || string.IsNullOrEmpty(s.TransactionType))
                                dispatchProductMap[pName] = (dispatchProductMap[pName].dispatched + casesInt, dispatchProductMap[pName].returned);
                            else if (s.TransactionType == "Customer Return")
                                dispatchProductMap[pName] = (dispatchProductMap[pName].dispatched, dispatchProductMap[pName].returned + casesInt);
                        }

                        dispatchTrendPoints.Add(new DispatchTrendPointDto
                        {
                            Label = dayLabel,
                            DateStr = dateFullStr,
                            DayOfWeek = dayOfWeekStr,
                            Hour = -1,
                            DispatchedCases = runningDispatchedTotal,
                            LoggedDispatched = pDisp,
                            ReturnedCases = runningReturnedTotal,
                            LoggedReturned = pRet,
                            DamageCases = runningDamageTotal,
                            LoggedDamage = pDam,
                            NetDispatchCases = runningNetTotal,
                            Products = dispatchProductMap.Select(kv => new DispatchProductBreakdownDto { ProductName = kv.Key, DispatchedCases = kv.Value.dispatched, ReturnedCases = kv.Value.returned, NetDispatchCases = Math.Max(0, kv.Value.dispatched - kv.Value.returned) }).ToList()
                        });
                    }
                }
                else // 30days
                {
                    int runningNetTotal = 0;
                    int runningDispatchedTotal = 0;
                    int runningReturnedTotal = 0;
                    int runningDamageTotal = 0;

                    for (int i = 29; i >= 0; i--)
                    {
                        var dayDate = todayLocalStart.AddDays(-i);
                        var dayLabel = dayDate.ToString("d MMM");
                        var dateFullStr = dayDate.ToString("dd MMM yyyy");
                        var dayOfWeekStr = dayDate.ToString("dddd");

                        var dayEntries = entries.Select(e => new { Entry = e, LocalDt = ToLocal(e.CreatedAt != default ? e.CreatedAt : e.Date) })
                                                .Where(x => x.LocalDt.Date == dayDate)
                                                .ToList();

                        var dayBatches = batches.Select(b => new { Batch = b, LocalDt = ToLocal(b.StartedAt != default ? b.StartedAt : b.CreatedAt) })
                                               .Where(x => x.LocalDt.Date == dayDate)
                                               .ToList();

                        var productMap = new Dictionary<string, (int cases, int count, List<string> times)>();
                        foreach (var item in dayEntries)
                        {
                            var e = item.Entry;
                            var pName = e.Product?.Name ?? "Standard Bottled Water";
                            if (!productMap.ContainsKey(pName)) productMap[pName] = (0, 0, new List<string>());
                            var current = productMap[pName];
                            productMap[pName] = (current.cases + e.CasesProduced, current.count + 1, current.times);
                        }

                        if (dayEntries.Count == 0)
                        {
                            foreach (var item in dayBatches)
                            {
                                var b = item.Batch;
                                var pName = !string.IsNullOrWhiteSpace(b.Product) ? b.Product : "Standard Bottled Water";
                                if (!productMap.ContainsKey(pName)) productMap[pName] = (0, 0, new List<string>());
                                var current = productMap[pName];
                                productMap[pName] = (current.cases + b.ProducedQuantity, current.count + 1, current.times);
                            }
                        }

                        prodTrendPoints.Add(new ProductionTrendPointDto
                        {
                            Label = dayLabel,
                            DateStr = dateFullStr,
                            Hour = -1,
                            TotalCases = productMap.Values.Sum(v => v.cases),
                            EntriesCount = productMap.Values.Sum(v => v.count),
                            Products = productMap.Select(kv => new ProductBreakdownDto { ProductName = kv.Key, Cases = kv.Value.cases, EntriesCount = kv.Value.count }).ToList()
                        });

                        var dayDispatches = salesTxns.Select(s => new { Txn = s, LocalDt = GetTransactionLocalTime(s) })
                                                    .Where(x => x.LocalDt.Date == dayDate)
                                                    .ToList();

                        int pDisp = dayDispatches.Where(x => x.Txn.TransactionType == "Sales Dispatch" || string.IsNullOrEmpty(x.Txn.TransactionType)).Sum(x => Convert.ToInt32(x.Txn.Cases));
                        int pRet = dayDispatches.Where(x => x.Txn.TransactionType == "Customer Return").Sum(x => Convert.ToInt32(x.Txn.Cases));
                        int pDam = dayDispatches.Where(x => x.Txn.TransactionType == "Damage").Sum(x => Convert.ToInt32(x.Txn.Cases));

                        runningDispatchedTotal += pDisp;
                        runningReturnedTotal += pRet;
                        runningDamageTotal += pDam;
                        runningNetTotal = Math.Max(0, runningNetTotal + pDisp - pRet);

                        var dispatchProductMap = new Dictionary<string, (int dispatched, int returned)>();
                        foreach (var item in dayDispatches)
                        {
                            var s = item.Txn;
                            var pName = s.Product?.Name ?? "Standard Bottled Water";
                            if (!dispatchProductMap.ContainsKey(pName)) dispatchProductMap[pName] = (0, 0);
                            int casesInt = Convert.ToInt32(s.Cases);
                            if (s.TransactionType == "Sales Dispatch" || string.IsNullOrEmpty(s.TransactionType))
                                dispatchProductMap[pName] = (dispatchProductMap[pName].dispatched + casesInt, dispatchProductMap[pName].returned);
                            else if (s.TransactionType == "Customer Return")
                                dispatchProductMap[pName] = (dispatchProductMap[pName].dispatched, dispatchProductMap[pName].returned + casesInt);
                        }

                        dispatchTrendPoints.Add(new DispatchTrendPointDto
                        {
                            Label = dayLabel,
                            DateStr = dateFullStr,
                            DayOfWeek = dayOfWeekStr,
                            Hour = -1,
                            DispatchedCases = runningDispatchedTotal,
                            LoggedDispatched = pDisp,
                            ReturnedCases = runningReturnedTotal,
                            LoggedReturned = pRet,
                            DamageCases = runningDamageTotal,
                            LoggedDamage = pDam,
                            NetDispatchCases = runningNetTotal,
                            Products = dispatchProductMap.Select(kv => new DispatchProductBreakdownDto { ProductName = kv.Key, DispatchedCases = kv.Value.dispatched, ReturnedCases = kv.Value.returned, NetDispatchCases = Math.Max(0, kv.Value.dispatched - kv.Value.returned) }).ToList()
                        });
                    }
                }

                // STRICT SINGLE SOURCE OF TRUTH METRICS
                int totalProdCases = prodTrendPoints.Sum(p => p.LoggedCases > 0 ? p.LoggedCases : p.TotalCases);
                int totalDispCases = dispatchTrendPoints.Sum(p => p.LoggedDispatched);
                int totalRetCases = dispatchTrendPoints.Sum(p => p.LoggedReturned);
                if (dateFilter == "today" && dispatchTrendPoints.Any())
                {
                    totalDispCases = dispatchTrendPoints.Last().DispatchedCases;
                    totalRetCases = dispatchTrendPoints.Last().ReturnedCases;
                }
                int netDispCases = Math.Max(0, totalDispCases - totalRetCases);

                int totalTargetCases = batches.Sum(b => b.TargetQuantity);
                if (totalTargetCases == 0) totalTargetCases = totalProdCases > 0 ? (int)(totalProdCases * 1.2) : 1000;

                int effPct = totalTargetCases > 0 ? Math.Min(100, (int)Math.Round((double)totalProdCases / totalTargetCases * 100)) : 0;

                // Batch Status Breakdown
                var runningCount = batches.Count(b => b.Status == "Active" || b.Status == "Running");
                var completedCount = batches.Count(b => b.Status == "Completed");
                var pausedCount = batches.Count(b => b.Status == "Paused");
                var cancelledCount = batches.Count(b => b.Status == "Cancelled" || b.Status == "Stopped");

                var batchStatus = new List<BatchStatusItemDto>
                {
                    new BatchStatusItemDto { Label = "Running", Value = runningCount, Color = "#10B981" },
                    new BatchStatusItemDto { Label = "Completed", Value = completedCount, Color = "#2563EB" },
                    new BatchStatusItemDto { Label = "Paused", Value = pausedCount, Color = "#F59E0B" },
                    new BatchStatusItemDto { Label = "Cancelled", Value = cancelledCount, Color = "#EF4444" }
                }.Where(b => b.Value > 0).ToList();

                // Running Lines
                var runningLinesList = new List<RunningLineItemDto>();
                foreach (var line in activeLines)
                {
                    var lineBatch = batches.FirstOrDefault(b => b.ProductionLineId == line.Id && (b.Status == "Active" || b.Status == "Running"));
                    var isRunning = lineBatch != null;
                    var isPaused = !isRunning && batches.Any(b => b.ProductionLineId == line.Id && b.Status == "Paused");

                    runningLinesList.Add(new RunningLineItemDto
                    {
                        LineId = line.Id,
                        LineName = line.Name,
                        IsActive = line.IsActive,
                        Status = isRunning ? "Running" : isPaused ? "Paused" : "Idle",
                        BatchNumber = lineBatch?.BatchNumber,
                        Product = lineBatch?.Product,
                        OperatorName = lineBatch?.OperatorName,
                        Shift = lineBatch?.Shift,
                        ProducedQuantity = lineBatch?.ProducedQuantity ?? 0,
                        TargetQuantity = lineBatch?.TargetQuantity ?? 0,
                        ProgressPercentage = (lineBatch?.TargetQuantity > 0) ? Math.Min(100, (int)Math.Round((double)lineBatch.ProducedQuantity / lineBatch.TargetQuantity * 100)) : 0
                    });
                }

                // Recent Activity
                var activities = new List<DashboardActivityDto>();
                foreach (var b in batches.OrderByDescending(b => b.StartedAt).Take(6))
                {
                    activities.Add(new DashboardActivityDto
                    {
                        Time = b.StartedAt.ToString("HH:mm"),
                        Timestamp = new DateTimeOffset(b.StartedAt).ToUnixTimeMilliseconds(),
                        Text = $"Batch {b.BatchNumber} ({b.Product ?? "Bottled Water"}) started on {b.ProductionLine?.Name ?? "Production Line"}"
                    });
                }

                var reportingDto = new CockpitReportingDto
                {
                    Range = dateFilter,
                    ProductionTotalCases = totalProdCases,
                    DispatchTotalCases = totalDispCases,
                    ReturnTotalCases = totalRetCases,
                    NetDispatchCases = netDispCases,
                    TargetTotalCases = totalTargetCases,
                    EfficiencyPercentage = effPct,
                    RunningLinesCount = runningLinesList.Count(l => l.Status == "Running"),
                    TotalActiveLinesCount = activeLines.Count,
                    ActiveBatchesCount = runningCount,
                    ProductionTrend = prodTrendPoints,
                    DispatchTrend = dispatchTrendPoints,
                    BatchStatusBreakdown = batchStatus,
                    RunningLines = runningLinesList,
                    RecentActivities = activities
                };

                return Success(reportingDto, "Cockpit reporting statistics loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<CockpitReportingDto>(ex.Message, "Failed to load cockpit reporting statistics.");
            }
        }

        [HttpGet("dashboard")]
        public async Task<ActionResult<ApiResponse<ProductionDashboardDto>>> GetProductionDashboardStats()
        {
            try
            {
                var tenantId = GetTenantId();
                var today = DateTime.UtcNow.Date;
                var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
                var startOfMonth = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);

                var todayProduction = await _tenantContext.ProductionBatches
                    .Where(b => b.TenantId == tenantId && !b.IsDeleted && (b.StartedAt >= today || (b.CompletedAt.HasValue && b.CompletedAt.Value >= today)))
                    .SumAsync(b => b.ProducedQuantity);

                var todayTarget = await _tenantContext.ProductionBatches
                    .Where(b => b.TenantId == tenantId && !b.IsDeleted && (b.StartedAt >= today || (b.CompletedAt.HasValue && b.CompletedAt.Value >= today)))
                    .SumAsync(b => b.TargetQuantity);

                var weeklyProduction = await _tenantContext.ProductionBatches
                    .Where(b => b.TenantId == tenantId && !b.IsDeleted && b.StartedAt >= startOfWeek)
                    .SumAsync(b => b.ProducedQuantity);

                var monthlyProduction = await _tenantContext.ProductionBatches
                    .Where(b => b.TenantId == tenantId && !b.IsDeleted && b.StartedAt >= startOfMonth)
                    .SumAsync(b => b.ProducedQuantity);

                var pendingDispatch = await _tenantContext.OperationsFillingQueues
                    .CountAsync(q => q.TenantId == tenantId && !q.IsDeleted && (q.Status == "Pending" || q.Status == "InProgress"));

                var pendingDispatchHighPriority = await _tenantContext.OperationsFillingQueues
                    .CountAsync(q => q.TenantId == tenantId && !q.IsDeleted && (q.Status == "Pending" || q.Status == "InProgress") && (q.Priority == "Immediate" || q.Priority == "High"));

                var dto = new ProductionDashboardDto
                {
                    TodayProduction = todayProduction,
                    TodayTarget = todayTarget,
                    WeeklyProduction = weeklyProduction,
                    MonthlyProduction = monthlyProduction,
                    PendingDispatch = pendingDispatch,
                    PendingDispatchHighPriority = pendingDispatchHighPriority
                };

                return Success(dto, "Production dashboard stats loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<ProductionDashboardDto>(ex.Message, "Failed to load production dashboard stats.");
            }
        }

        // 2b. GET api/v1/production/batches (Complete batch register)
        [HttpGet("batches")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetAllBatches(
            [FromQuery] string? status = null,
            [FromQuery] Guid? lineId = null,
            [FromQuery] string? search = null,
            [FromQuery] DateTime? date = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var query = _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .Where(b => !b.IsDeleted);

                if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
                {
                    if (status.Equals("Active", StringComparison.OrdinalIgnoreCase) || status.Equals("Running", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(b => b.CompletedAt == null && (b.Status == "Active" || b.Status == "Running" || b.Status == "Bottling Active" || b.Status == "In Progress"));
                    }
                    else if (status.Equals("Paused", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(b => b.Status == "Paused");
                    }
                    else if (status.Equals("Completed", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(b => b.CompletedAt != null || b.Status == "Completed");
                    }
                    else if (status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase) || status.Equals("Stopped", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(b => b.Status == "Cancelled" || b.Status == "Stopped");
                    }
                    else
                    {
                        query = query.Where(b => b.Status.ToLower() == status.ToLower());
                    }
                }

                if (lineId.HasValue && lineId.Value != Guid.Empty)
                {
                    query = query.Where(b => b.ProductionLineId == lineId.Value);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim().ToLower();
                    query = query.Where(b => b.BatchNumber.ToLower().Contains(s) ||
                                             (b.Product != null && b.Product.ToLower().Contains(s)) ||
                                             (b.OperatorName != null && b.OperatorName.ToLower().Contains(s)));
                }

                if (date.HasValue)
                {
                    var targetDate = date.Value.Date;
                    var nextDate = targetDate.AddDays(1);
                    query = query.Where(b => (b.StartedAt != default ? b.StartedAt : b.CreatedAt) >= targetDate &&
                                             (b.StartedAt != default ? b.StartedAt : b.CreatedAt) < nextDate);
                }

                var batches = await query
                    .OrderByDescending(b => b.StartedAt != default ? b.StartedAt : b.CreatedAt)
                    .ThenByDescending(b => b.CreatedAt)
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Shift,
                        ProductionLineId = b.ProductionLineId,
                        ProductionLineName = b.ProductionLine != null ? b.ProductionLine.Name : "Line 1",
                        ProductionLineCode = b.ProductionLine != null ? b.ProductionLine.Code : "L001",
                        b.OperatorId,
                        b.OperatorName,
                        b.StartedAt,
                        b.CompletedAt,
                        b.TargetQuantity,
                        b.ProducedQuantity,
                        b.Status,
                        b.CreatedAt
                    })
                    .ToListAsync();

                return Success<List<object>>(batches.Cast<object>().ToList(), "Batches loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<object>>(ex.Message, "Failed to load batches.");
            }
        }

        // GET api/v1/production/batches/{id:guid}
        [HttpGet("batches/{id:guid}")]
        public async Task<ActionResult<ApiResponse<object>>> GetBatchById(Guid id)
        {
            try
            {
                var batch = await _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .Where(b => b.Id == id && !b.IsDeleted)
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Shift,
                        ProductionLineId = b.ProductionLineId,
                        ProductionLineName = b.ProductionLine != null ? b.ProductionLine.Name : "Line 1",
                        ProductionLineCode = b.ProductionLine != null ? b.ProductionLine.Code : "L001",
                        b.OperatorId,
                        b.OperatorName,
                        b.StartedAt,
                        b.CompletedAt,
                        b.TargetQuantity,
                        b.ProducedQuantity,
                        b.Status,
                        b.CreatedAt
                    })
                    .FirstOrDefaultAsync();

                if (batch == null)
                    return Failure<object>("Batch not found.", "NotFound", System.Net.HttpStatusCode.NotFound);

                return Success<object>(batch, "Batch loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to load batch.");
            }
        }

        // 2c. GET api/v1/production/batches/active
        [HttpGet("batches/active")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetActiveBatches()
        {
            try
            {
                var tenantId = GetTenantId();
                var activeBatches = await _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .Where(b => !b.IsDeleted && b.CompletedAt == null && (b.Status == "Active" || b.Status == "Running" || b.Status == "Bottling Active" || b.Status == "In Progress"))
                    .OrderByDescending(b => b.StartedAt)
                    .ThenByDescending(b => b.CreatedAt)
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Shift,
                        ProductionLineId = b.ProductionLineId,
                        ProductionLineName = b.ProductionLine != null ? b.ProductionLine.Name : "Line 1",
                        ProductionLineCode = b.ProductionLine != null ? b.ProductionLine.Code : "L001",
                        b.OperatorId,
                        b.OperatorName,
                        b.StartedAt,
                        b.CompletedAt,
                        b.TargetQuantity,
                        b.ProducedQuantity,
                        b.Status,
                        b.CreatedAt
                    })
                    .ToListAsync();

                return Success<List<object>>(activeBatches.Cast<object>().ToList(), "Active batches loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<object>>(ex.Message, "Failed to load active batches.");
            }
        }

        // 2d. GET api/v1/production/batches/summary
        [HttpGet("batches/summary")]
        public async Task<ActionResult<ApiResponse<object>>> GetBatchesSummary([FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
        {
            try
            {
                var tenantId = GetTenantId();
                var today = DateTime.UtcNow.Date;

                var allBatches = await _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .Where(b => !b.IsDeleted)
                    .OrderByDescending(b => b.CreatedAt)
                    .ToListAsync();

                var activeList = allBatches
                    .Where(b => b.CompletedAt == null && b.Status != "Completed" && b.Status != "Stopped" && b.Status != "Closed" && b.Status != "Cancelled" && (b.Status == "Active" || b.Status == "Running" || b.Status == "Bottling Active" || b.Status == "In Progress"))
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Shift,
                        ProductionLineId = b.ProductionLineId,
                        ProductionLineName = b.ProductionLine != null ? b.ProductionLine.Name : "Line 1",
                        ProductionLineCode = b.ProductionLine != null ? b.ProductionLine.Code : "L001",
                        b.OperatorId,
                        b.OperatorName,
                        b.StartedAt,
                        b.CompletedAt,
                        b.TargetQuantity,
                        b.ProducedQuantity,
                        b.Status,
                        b.CreatedAt
                    })
                    .ToList();

                var completedList = allBatches
                    .Where(b => b.CompletedAt != null || b.Status == "Completed")
                    .Take(5)
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Shift,
                        ProductionLineId = b.ProductionLineId,
                        ProductionLineName = b.ProductionLine != null ? b.ProductionLine.Name : "Line 1",
                        ProductionLineCode = b.ProductionLine != null ? b.ProductionLine.Code : "L001",
                        b.OperatorId,
                        b.OperatorName,
                        b.StartedAt,
                        b.CompletedAt,
                        b.TargetQuantity,
                        b.ProducedQuantity,
                        b.Status,
                        b.CreatedAt
                    })
                    .ToList();

                var from = dateFrom?.Date;
                var to = dateTo?.Date.AddDays(1);

                var periodBatches = allBatches.AsEnumerable();
                if (from.HasValue) periodBatches = periodBatches.Where(b => (b.CompletedAt ?? b.StartedAt) >= from.Value);
                if (to.HasValue) periodBatches = periodBatches.Where(b => (b.CompletedAt ?? b.StartedAt) < to.Value);

                int activeProduced = activeList.Sum(b => b.ProducedQuantity);
                int periodProduced = periodBatches.Sum(b => b.ProducedQuantity);
                int todayProduced = allBatches.Where(b => (b.CompletedAt ?? b.StartedAt).Date == today).Sum(b => b.ProducedQuantity);
                int totalProduced = allBatches.Sum(b => b.ProducedQuantity);

                return Success<object>(new
                {
                    ActiveBatches = activeList,
                    RecentCompletedBatches = completedList,
                    ActiveCount = activeList.Count,
                    CompletedCount = allBatches.Count(b => b.CompletedAt != null || b.Status == "Completed"),
                    TotalBatchesCount = allBatches.Count,
                    ActiveProducedQuantity = activeProduced,
                    PeriodProducedQuantity = periodProduced,
                    TodayProducedQuantity = todayProduced,
                    TotalProducedQuantity = totalProduced
                }, "Batches summary loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to load batches summary.");
            }
        }

        // 2. GET api/v1/production/batch/active
        [HttpGet("batch/active")]
        public async Task<ActionResult<ApiResponse<object>>> GetActiveBatch([FromQuery] Guid lineId)
        {
            try
            {
                var tenantId = GetTenantId();
                var userIdStr = GetCurrentUserId();
                
                if (lineId == Guid.Empty)
                {
                    return ValidationError<object>("lineId", "Production line ID is required.");
                }

                var userGuid = Guid.TryParse(userIdStr, out var uId) ? uId : Guid.Empty;
                
                var activeBatchQuery = _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .Where(b => b.Status == "Active" && !b.IsDeleted && b.ProductionLineId == lineId);

                var activeBatch = await activeBatchQuery.OrderByDescending(b => b.CreatedAt).FirstOrDefaultAsync();

                if (activeBatch == null)
                {
                    return Success<object?>(null, "No active batch found.");
                }

                // Load station logs for this active batch
                var stationLogs = await _tenantContext.ProductionStationData
                    .Where(s => s.ProductionBatchId == activeBatch.Id && !s.IsDeleted)
                    .OrderBy(s => s.Timestamp)
                    .Select(s => new
                    {
                        s.Id,
                        s.StationCode,
                        s.OperatorName,
                        s.Timestamp,
                        s.InputQty,
                        s.OutputQty,
                        s.WastageQty,
                        s.Efficiency,
                        s.AdditionalData
                    })
                    .ToListAsync();

                // Calculate real-time totals
                int totalWastage = stationLogs.Sum(s => s.WastageQty);
                int initialPreforms = stationLogs.FirstOrDefault(s => s.StationCode == "BLOW_MOULDING")?.InputQty ?? 0;
                int finishedStored = stationLogs.FirstOrDefault(s => s.StationCode == "FINISHED_GOODS")?.OutputQty ?? 0;
                
                double overallYield = initialPreforms > 0 ? Math.Round(((double)finishedStored / initialPreforms) * 100, 2) : 0;
                
                var response = new
                {
                    BatchId = activeBatch.Id,
                    BatchNumber = activeBatch.BatchNumber,
                    Product = activeBatch.Product,
                    Shift = activeBatch.Shift,
                    ProductionLineId = activeBatch.ProductionLineId,
                    ProductionLineName = activeBatch.ProductionLine?.Name,
                    OperatorId = activeBatch.OperatorId,
                    OperatorName = activeBatch.OperatorName,
                    StartedAt = activeBatch.StartedAt,
                    TargetQuantity = activeBatch.TargetQuantity,
                    ProducedQuantity = activeBatch.ProducedQuantity,
                    RemainingQuantity = Math.Max(0, activeBatch.TargetQuantity - activeBatch.ProducedQuantity),
                    Status = activeBatch.Status,
                    StationLogs = stationLogs,
                    Calculations = new
                    {
                        TotalWastage = totalWastage,
                        OverallYieldPercentage = overallYield,
                        RawMaterialPreformsConsumed = initialPreforms
                    }
                };

                return Success<object>(response, "Active batch retrieved.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to load active batch.");
            }
        }

        // 2d. POST api/v1/production/batches/{batchId}/stop
        [HttpPost("batches/{batchId}/stop")]
        public async Task<ActionResult<ApiResponse<object>>> StopBatch([FromRoute] Guid batchId, [FromBody] StopProductionBatchRequest? request)
        {
            if (batchId == Guid.Empty)
            {
                return ValidationError<object>("batchId", "Batch ID is required.");
            }

            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return Failure<object>("Database context is invalid.", "Infrastructure error");
            }

            using var transaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                // 1. Fetch ProductionBatch
                var batch = await _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .FirstOrDefaultAsync(b => b.Id == batchId && !b.IsDeleted);

                if (batch == null)
                {
                    return Failure<object>("Production batch not found.", "Validation failed");
                }

                if (batch.Status == "Completed" || batch.Status == "Stopped" || batch.Status == "Closed")
                {
                    return Failure<object>($"Production batch is already {batch.Status.ToLower()}.", "Validation failed");
                }

                var now = DateTime.UtcNow;

                // 2. Fetch corresponding ProductionSession (if matching by ID or BatchNumber)
                var session = await _tenantContext.ProductionSessions
                    .Include(s => s.ProductionEntries)
                    .FirstOrDefaultAsync(s => (s.Id == batchId || (s.BatchNumber == batch.BatchNumber && s.ProductionLineId == batch.ProductionLineId)) && s.Status == "Running" && !s.IsDeleted);

                int producedQty = batch.ProducedQuantity;
                if (session != null)
                {
                    session.Status = "Completed";
                    session.EndedAt = now;
                    var stopReasonText = !string.IsNullOrWhiteSpace(request?.Reason) ? request.Reason : "Batch Stopped";
                    var remarksText = !string.IsNullOrWhiteSpace(request?.Remarks) ? request.Remarks : null;
                    session.Remarks = remarksText != null ? $"{stopReasonText} - {remarksText}" : stopReasonText;
                    session.TotalCasesProduced = session.ProductionEntries.Where(e => !e.IsDeleted).Sum(e => e.CasesProduced);
                    producedQty = session.TotalCasesProduced;
                }

                // 3. Update Batch state
                batch.Status = "Completed";
                batch.CompletedAt = now;
                batch.ProducedQuantity = producedQty;

                // 4. Record Audit Log
                var tenantId = GetTenantId();
                var userIdStr = GetCurrentUserId();
                var userEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "operator@aquzio.com";
                var lineName = batch.ProductionLine?.Name ?? "Production Line";

                var auditLog = new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userIdStr,
                    UserEmail = userEmail,
                    Action = "StopBatch",
                    TableName = "ProductionBatch",
                    PrimaryKey = batch.Id.ToString(),
                    Timestamp = now,
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Device = Request.Headers["User-Agent"].ToString() ?? "Aquzio Console",
                    Reason = $"Production batch {batch.BatchNumber} stopped on line '{lineName}'. Reason: {request?.Reason ?? "Production Completed"}. Total cases: {producedQty}.",
                    Module = "Production"
                };
                _tenantContext.AuditLogs.Add(auditLog);

                await _tenantContext.SaveChangesAsync();
                await transaction.CommitAsync();

                // Live SignalR Dashboard Notification
                await NotifyDashboardAsync("BatchStopped", new
                {
                    batchId = batch.Id,
                    batchNumber = batch.BatchNumber,
                    lineId = batch.ProductionLineId,
                    lineName = lineName,
                    producedQuantity = producedQty,
                    stoppedAt = now
                });

                Serilog.Log.Information(
                    "[BATCH STOP TRANSACTION SUCCESS]: TenantId={TenantId}, BatchId={BatchId}, BatchNumber={BatchNumber}, ProducedQty={ProducedQty}, StoppedAt={StoppedAt}",
                    tenantId, batch.Id, batch.BatchNumber, producedQty, now
                );

                return Success<object>(new
                {
                    batch.Id,
                    batch.BatchNumber,
                    Status = batch.Status,
                    batch.ProducedQuantity,
                    CompletedAt = batch.CompletedAt,
                    LineName = lineName
                }, "Production batch stopped successfully.");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                Serilog.Log.Error(ex, "[BATCH STOP FAILURE]: BatchId={BatchId}", batchId);
                return Failure<object>(ex.Message, "Unable to stop the production batch. Please try again.");
            }
        }

        // 2b. GET /api/operator/production-context
        [HttpGet("/api/operator/production-context")]
        public async Task<ActionResult<ApiResponse<object>>> GetProductionContext([FromQuery] Guid lineId)
        {
            try
            {
                if (lineId == Guid.Empty)
                {
                    return ValidationError<object>("lineId", "Production line ID is required.");
                }

                Aquora.Domain.Entities.ProductionSession? activeSession = null;
                try
                {
                    activeSession = await _tenantContext.ProductionSessions
                        .Include(s => s.Product)
                        .Include(s => s.ProductionLine)
                        .Include(s => s.ProductionEntries)
                        .FirstOrDefaultAsync(s => s.ProductionLineId == lineId && s.Status == "Running" && !s.IsDeleted);
                }
                catch (Exception ex) when (ex.Message.Contains("42703") || ex.Message.Contains("CapMaterialId"))
                {
                    // Graceful fallback for outdated tenant schemas missing new columns (e.g., CapMaterialId)
                    activeSession = await _tenantContext.ProductionSessions
                        .Include(s => s.Product)
                        .Include(s => s.ProductionLine)
                        .FirstOrDefaultAsync(s => s.ProductionLineId == lineId && s.Status == "Running" && !s.IsDeleted);

                    if (activeSession != null)
                    {
                        activeSession.ProductionEntries = new List<Aquora.Domain.Entities.ProductionEntry>();
                    }
                    else
                    {
                        return Failure<object>("Tenant schema is outdated. Pending migration detected.", "Schema Error");
                    }
                }

                if (activeSession == null)
                {
                    var fallback = new
                    {
                        CanEnterProductionPage = false,
                        Status = "None"
                    };
                    return Success<object>(fallback, "No active production session running.");
                }

                // Compute runtime metrics
                var now = DateTime.UtcNow;
                var duration = now - activeSession.StartedAt;
                var runningDuration = $"{(int)duration.TotalHours:D2}:{duration.Minutes:D2}"; // "HH:MM"

                // Map lineColor based on name
                string lineColor = "#1A56DB";
                string lineName = activeSession.ProductionLine?.Name ?? "";
                if (lineName.Contains("1")) lineColor = "#1A56DB";
                else if (lineName.Contains("2")) lineColor = "#16A34A";
                else if (lineName.Contains("3")) lineColor = "#EA580C";
                else if (lineName.Contains("4")) lineColor = "#7C3AED";
                else if (lineName.Contains("5")) lineColor = "#0891B2";
                else if (lineName.Contains("6")) lineColor = "#DC2626";
                else if (lineName.Contains("7")) lineColor = "#4F46E5";
                else if (lineName.Contains("8")) lineColor = "#0D9488";

                var response = new
                {
                    Id = activeSession.Id,
                    LineId = activeSession.ProductionLineId,
                    LineName = lineName,
                    LineColor = lineColor,
                    BatchId = activeSession.Id,
                    BatchNumber = activeSession.BatchNumber,
                    ProductId = activeSession.ProductId,
                    ProductName = activeSession.Product?.Name ?? "Unknown Product",
                    SkuName = activeSession.Product?.Name ?? "Unknown Product",
                    Sku = activeSession.Product?.SKU ?? "Unknown",
                    Status = activeSession.Status, // "Running"
                    StartedAt = activeSession.StartedAt,
                    StartedAtTime = activeSession.StartedAt.AddHours(5.5).ToString("hh:mm tt"), // GMT+5.30 representation
                    RunningDuration = runningDuration,
                    CasesProduced = activeSession.ProductionEntries.Where(e => !e.IsDeleted).Sum(e => e.CasesProduced),
                    EntriesCaptured = activeSession.ProductionEntries.Count(e => !e.IsDeleted),
                    CanEndBatch = true,
                    CanEnterProductionPage = true
                };

                return Success<object>(response, "Production context loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to load production context.");
            }
        }

        // 3. POST api/v1/production/batch/start
        [HttpPost("batch/start")]
        public async Task<ActionResult<ApiResponse<object>>> StartBatch([FromBody] StartBatchRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userIdStr = GetCurrentUserId();
                var userGuid = Guid.TryParse(userIdStr, out var uId) ? uId : Guid.Empty;
                
                var userRecord = await _platformContext.Users.FirstOrDefaultAsync(u => u.Id == userGuid);

                // Auto-generate batch number B-YYYYMMDD-XXX
                var existingActiveBatch = await _tenantContext.ProductionBatches
                    .AnyAsync(b => b.ProductionLineId == request.ProductionLineId && b.Status == "Active" && !b.IsDeleted);

                if (existingActiveBatch)
                {
                    return Failure<object>("There is already an active batch running on this production line.", "Validation failed");
                }

                // Fetch default tenant company mapping
                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                
                if (company == null)
                {
                    return Failure<object>("Tenant configurations are incomplete. Company is missing.", "Validation failed");
                }

                if (string.IsNullOrWhiteSpace(request.BatchNumber))
                {
                    return Failure<object>("Batch Number is required.", "Validation failed");
                }

                var batchNumber = request.BatchNumber.Trim();
                
                // Uniqueness check: reject duplicates globally within tenant context (exclude deleted)
                var isDuplicateBatch = await _tenantContext.ProductionBatches
                    .AnyAsync(s => s.BatchNumber == batchNumber && !s.IsDeleted);

                if (isDuplicateBatch)
                {
                    return Failure<object>("A production batch with this batch number already exists.", "Conflict");
                }

                // Query the sku product matching request.Product, or fallback to first active product
                var sku = await _tenantContext.Products
                    .FirstOrDefaultAsync(p => p.Name == request.Product && !p.IsDeleted);

                if (sku == null)
                {
                    return Failure<object>($"Product '{request.Product}' could not be found.", "Validation failed");
                }

                var dbContext = _tenantContext as DbContext;
                if (dbContext == null)
                {
                    return Failure<object>("Database context is invalid.", "Infrastructure error");
                }

                using var transaction = await dbContext.Database.BeginTransactionAsync();
                try
                {
                    var batchId = Guid.NewGuid();

                    var newBatch = new ProductionBatch
                    {
                        Id = batchId,
                        BatchNumber = batchNumber,
                        Product = request.Product,
                        Shift = request.Shift,
                        ProductionLineId = request.ProductionLineId,
                        OperatorId = userGuid,
                        OperatorName = GetCurrentUserName(),
                        StartedAt = DateTime.UtcNow,
                        Status = "Active",
                        TargetQuantity = request.TargetQuantity,
                        ProducedQuantity = 0,
                        TenantId = tenantId,
                        CompanyId = company.Id,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userIdStr
                    };

                    var session = new ProductionSession
                    {
                        Id = batchId,
                        TenantId = tenantId,
                        CompanyId = company.Id,
                        BatchNumber = batchNumber,
                        ProductionLineId = request.ProductionLineId,
                        OperatorId = userGuid,
                        OperatorName = GetCurrentUserName(),
                        Shift = request.Shift,
                        ProductId = sku.Id,
                        StartedAt = newBatch.StartedAt,
                        Status = "Running",
                        Remarks = "Started from admin panel",
                        TotalCasesProduced = 0,
                        CreatedBy = userIdStr,
                        CreatedAt = DateTime.UtcNow
                    };

                    var userEmail = userRecord?.Email ?? "admin@aquora.com";
                    var auditLog = new AuditLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        UserId = userIdStr,
                        UserEmail = userEmail,
                        Action = "StartBatch",
                        TableName = "ProductionBatch",
                        PrimaryKey = batchId.ToString(),
                        Timestamp = DateTime.UtcNow,
                        IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                        Device = Request.Headers["User-Agent"].ToString() ?? "Admin Panel",
                        Reason = $"Production batch {batchNumber} started on line {request.ProductionLineId} via Admin Console.",
                        Module = "Production"
                    };

                    _tenantContext.ProductionBatches.Add(newBatch);
                    _tenantContext.ProductionSessions.Add(session);
                    _tenantContext.AuditLogs.Add(auditLog);

                    var affectedRows = await _tenantContext.SaveChangesAsync();
                    if (affectedRows <= 0)
                    {
                        throw new Exception("Database operation failed: no rows were affected when persisting the production session.");
                    }

                    await transaction.CommitAsync();

                    await NotifyDashboardAsync("batch-started");

                    Serilog.Log.Information(
                        "[ADMIN BATCH START TRANSACTION SUCCESS]: TenantId={TenantId}, CompanyId={CompanyId}, SchemaName={SchemaName}, BatchId={BatchId}, ProductionLineId={ProductionLineId}, OperatorId={OperatorId}, TransactionId={TransactionId}, RowsAffected={RowsAffected}",
                        tenantId,
                        company.Id,
                        (_tenantContext as Aquora.Persistence.Context.TenantDbContext)?.SchemaName ?? "public",
                        batchId,
                        request.ProductionLineId,
                        userGuid,
                        transaction.TransactionId,
                        affectedRows
                    );

                    return Success<object>(new
                    {
                        BatchId = newBatch.Id,
                        BatchNumber = newBatch.BatchNumber,
                        Product = newBatch.Product,
                        Shift = newBatch.Shift,
                        ProductionLineId = newBatch.ProductionLineId,
                        StartedAt = newBatch.StartedAt,
                        Status = newBatch.Status
                    }, "Production batch started successfully.");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    return Failure<object>(ex.Message, "Failed to start batch.");
                }
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to start batch.");
            }
        }

        // 4. POST api/v1/production/batch/{batchId}/station-data
        [HttpPost("batch/{batchId}/station-data")]
        public async Task<ActionResult<ApiResponse<object>>> SubmitStationData(Guid batchId, [FromBody] SubmitStationDataRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var batch = await _tenantContext.ProductionBatches.FirstOrDefaultAsync(b => b.Id == batchId && !b.IsDeleted);
                
                if (batch == null)
                {
                    return Failure<object>("Active batch not found.", "Not Found", System.Net.HttpStatusCode.NotFound);
                }

                if (batch.Status != "Active")
                {
                    return Failure<object>("This production batch is no longer active.", "Validation failed");
                }

                double efficiency = request.InputQty > 0 ? (double)request.OutputQty / request.InputQty : 0;
                efficiency = Math.Round(efficiency, 4);

                var stationData = new ProductionStationData
                {
                    ProductionBatchId = batchId,
                    StationCode = request.StationCode.ToUpperInvariant(),
                    OperatorName = GetCurrentUserName(),
                    Timestamp = DateTime.UtcNow,
                    InputQty = request.InputQty,
                    OutputQty = request.OutputQty,
                    WastageQty = request.WastageQty,
                    Efficiency = efficiency,
                    AdditionalData = request.AdditionalData,
                    TenantId = tenantId,
                    CompanyId = batch.CompanyId
                };

                _tenantContext.ProductionStationData.Add(stationData);

                // If station is Finished Goods, update the batch's total produced quantity
                if (stationData.StationCode == "FINISHED_GOODS")
                {
                    batch.ProducedQuantity = stationData.OutputQty;
                }

                await _tenantContext.SaveChangesAsync();

                return Success<object>(new
                {
                    stationData.Id,
                    stationData.StationCode,
                    stationData.OutputQty,
                    stationData.Efficiency
                }, "Process parameters logged successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to submit station parameters.");
            }
        }

        // 5. POST api/v1/production/batch/{batchId}/complete
        [HttpPost("batch/{batchId}/complete")]
        public async Task<ActionResult<ApiResponse<object>>> CompleteBatch(Guid batchId)
        {
            try
            {
                var tenantId = GetTenantId();
                var batch = await _tenantContext.ProductionBatches.FirstOrDefaultAsync(b => b.Id == batchId && !b.IsDeleted);

                if (batch == null)
                {
                    return Failure<object>("Active batch not found.", "Not Found", System.Net.HttpStatusCode.NotFound);
                }

                // Validation 3: Prevent batch completion until all required stations are complete
                var loggedStations = await _tenantContext.ProductionStationData
                    .Where(s => s.ProductionBatchId == batchId && !s.IsDeleted)
                    .Select(s => s.StationCode)
                    .ToListAsync();

                var requiredStations = new[] { "BLOW_MOULDING", "FILLING", "LABELLING", "SHRINK_WRAPPING", "CARTON_PACKING", "FINISHED_GOODS" };
                var missingStations = requiredStations.Where(rs => !loggedStations.Contains(rs)).ToList();

                if (missingStations.Any())
                {
                    var missingStr = string.Join(", ", missingStations);
                    return Failure<object>($"Cannot complete batch. The following process stations have no logged parameters: {missingStr}", "Validation failed");
                }

                batch.Status = "Completed";
                batch.CompletedAt = DateTime.UtcNow;

                await _tenantContext.SaveChangesAsync();
                await NotifyDashboardAsync("batch-completed");

                return Success<object>(new
                {
                    BatchId = batch.Id,
                    Status = batch.Status,
                    CompletedAt = batch.CompletedAt
                }, "Production batch completed and locked successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to complete batch.");
            }
        }

        // 5b. POST api/v1/production/batch/{batchId}/pause
        [HttpPost("batch/{batchId}/pause")]
        public async Task<ActionResult<ApiResponse<object>>> PauseBatch(Guid batchId)
        {
            try
            {
                var tenantId = GetTenantId();
                var batch = await _tenantContext.ProductionBatches.FirstOrDefaultAsync(b => b.Id == batchId && !b.IsDeleted);
                if (batch == null)
                {
                    return Failure<object>("Active batch not found.", "Not Found", System.Net.HttpStatusCode.NotFound);
                }

                batch.Status = "Paused";
                batch.UpdatedAt = DateTime.UtcNow;
                batch.UpdatedBy = GetCurrentUserId();

                var session = await _tenantContext.ProductionSessions.FirstOrDefaultAsync(s => s.Id == batchId && !s.IsDeleted);
                if (session != null)
                {
                    session.Status = "Paused";
                    session.UpdatedAt = DateTime.UtcNow;
                    session.UpdatedBy = GetCurrentUserId();
                }

                await _tenantContext.SaveChangesAsync();
                await NotifyDashboardAsync("batch-status-changed");

                return Success<object>(new { BatchId = batch.Id, Status = batch.Status }, "Production batch paused.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to pause batch.");
            }
        }

        // 5c. POST api/v1/production/batch/{batchId}/resume
        [HttpPost("batch/{batchId}/resume")]
        public async Task<ActionResult<ApiResponse<object>>> ResumeBatch(Guid batchId)
        {
            try
            {
                var tenantId = GetTenantId();
                var batch = await _tenantContext.ProductionBatches.FirstOrDefaultAsync(b => b.Id == batchId && !b.IsDeleted);
                if (batch == null)
                {
                    return Failure<object>("Active batch not found.", "Not Found", System.Net.HttpStatusCode.NotFound);
                }

                batch.Status = "Active";
                batch.UpdatedAt = DateTime.UtcNow;
                batch.UpdatedBy = GetCurrentUserId();

                var session = await _tenantContext.ProductionSessions.FirstOrDefaultAsync(s => s.Id == batchId && !s.IsDeleted);
                if (session != null)
                {
                    session.Status = "Running";
                    session.UpdatedAt = DateTime.UtcNow;
                    session.UpdatedBy = GetCurrentUserId();
                }

                await _tenantContext.SaveChangesAsync();
                await NotifyDashboardAsync("batch-status-changed");
                return Success<object>(new { BatchId = batch.Id, Status = batch.Status }, "Production batch resumed.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to resume batch.");
            }
        }

        // 6. GET api/v1/production/batch/history
        [HttpGet("batch/history")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetBatchHistory([FromQuery] Guid lineId)
        {
            try
            {
                var tenantId = GetTenantId();
                if (lineId == Guid.Empty)
                {
                    return ValidationError<List<object>>("lineId", "Production line ID is required.");
                }

                var history = await _tenantContext.ProductionBatches
                    .Include(b => b.ProductionLine)
                    .Where(b => b.Status == "Completed" && !b.IsDeleted && b.ProductionLineId == lineId)
                    .OrderByDescending(b => b.CompletedAt)
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Shift,
                        ProductionLineName = b.ProductionLine.Name,
                        b.OperatorName,
                        b.StartedAt,
                        b.CompletedAt,
                        b.TargetQuantity,
                        b.ProducedQuantity
                    })
                    .ToListAsync();

                return Success<List<object>>(history.Cast<object>().ToList(), "Production history retrieved.");
            }
            catch (Exception ex)
            {
                return Failure<List<object>>(ex.Message, "Failed to retrieve history.");
            }
        }

        // 1b. POST api/v1/production/lines
        [HttpPost("lines")]
        public async Task<ActionResult<ApiResponse<object>>> CreateProductionLine([FromBody] CreateLineRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Code))
                {
                    return Failure<object>("Name and Code are required.", "Validation failed", System.Net.HttpStatusCode.BadRequest);
                }

                var cleanName = request.Name.Trim();
                var cleanCode = request.Code.Trim().ToUpper();

                // Check if code is already taken in this tenant
                var codeExists = await _tenantContext.ProductionLines
                    .AnyAsync(l => l.Code.ToUpper() == cleanCode && !l.IsDeleted);
                if (codeExists)
                {
                    return Failure<object>($"Production line with code '{cleanCode}' already exists.", "Validation failed", System.Net.HttpStatusCode.BadRequest);
                }

                // Get company or fallback
                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                Guid companyId = company != null ? company.Id : (tenantId != Guid.Empty ? tenantId : Guid.NewGuid());

                var line = new ProductionLine
                {
                    Id = Guid.NewGuid(),
                    Name = cleanName,
                    Code = cleanCode,
                    IsActive = request.IsActive ?? true,
                    TenantId = tenantId,
                    CompanyId = companyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = GetCurrentUserId()
                };

                _tenantContext.ProductionLines.Add(line);
                await _tenantContext.SaveChangesAsync();

                var dto = new ProductionLineDto
                {
                    LineId = line.Id,
                    Name = line.Name,
                    Code = line.Code,
                    IsActive = line.IsActive,
                    HasActiveBatch = false,
                    ActiveBatch = null
                };

                return Success<object>(dto, "Production line created successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to create production line.", System.Net.HttpStatusCode.InternalServerError);
            }
        }

        // 1c. PUT api/v1/production/lines/{id}
        [HttpPut("lines/{id}")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateProductionLine(Guid id, [FromBody] UpdateLineRequest request)
        {
            try
            {
                var line = await _tenantContext.ProductionLines
                    .FirstOrDefaultAsync(l => l.Id == id && !l.IsDeleted);

                if (line == null)
                {
                    return Failure<object>("Production line not found.", "Not found", System.Net.HttpStatusCode.NotFound);
                }

                if (!string.IsNullOrWhiteSpace(request.Name))
                {
                    line.Name = request.Name.Trim();
                }

                if (!string.IsNullOrWhiteSpace(request.Code))
                {
                    var cleanCode = request.Code.Trim().ToUpper();
                    var codeExists = await _tenantContext.ProductionLines
                        .AnyAsync(l => l.Id != id && l.Code.ToUpper() == cleanCode && !l.IsDeleted);
                    if (codeExists)
                    {
                        return Failure<object>($"Production line with code '{cleanCode}' already exists.", "Validation failed", System.Net.HttpStatusCode.BadRequest);
                    }
                    line.Code = cleanCode;
                }

                if (request.IsActive.HasValue)
                {
                    line.IsActive = request.IsActive.Value;
                }

                line.UpdatedAt = DateTime.UtcNow;
                line.UpdatedBy = GetCurrentUserId();

                await _tenantContext.SaveChangesAsync();

                var activeBatch = await _tenantContext.ProductionBatches
                    .FirstOrDefaultAsync(b => b.ProductionLineId == line.Id && b.Status == "Active" && !b.IsDeleted);

                var dto = new ProductionLineDto
                {
                    LineId = line.Id,
                    Name = line.Name,
                    Code = line.Code,
                    IsActive = line.IsActive,
                    HasActiveBatch = activeBatch != null,
                    ActiveBatch = activeBatch == null ? null : new ActiveBatchSummaryDto
                    {
                        BatchId = activeBatch.Id,
                        BatchNumber = activeBatch.BatchNumber,
                        Product = activeBatch.Product,
                        Shift = activeBatch.Shift,
                        StartedAt = activeBatch.StartedAt,
                        TargetQuantity = activeBatch.TargetQuantity,
                        ProducedQuantity = activeBatch.ProducedQuantity
                    }
                };

                return Success<object>(dto, "Production line updated successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to update production line.", System.Net.HttpStatusCode.InternalServerError);
            }
        }

        // 1d. DELETE api/v1/production/lines/{id}
        [HttpDelete("lines/{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteProductionLine(Guid id)
        {
            try
            {
                var line = await _tenantContext.ProductionLines
                    .FirstOrDefaultAsync(l => l.Id == id && !l.IsDeleted);

                if (line == null)
                {
                    return Failure<object>("Production line not found.", "Not found", System.Net.HttpStatusCode.NotFound);
                }

                // Soft-delete
                line.IsDeleted = true;
                line.DeletedAt = DateTime.UtcNow;
                line.DeletedBy = GetCurrentUserId();

                await _tenantContext.SaveChangesAsync();

                return Success<object?>(null, "Production line deleted successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to delete production line.", System.Net.HttpStatusCode.InternalServerError);
            }
        }

        // 12. POST api/v1/production/line-switch
        [HttpPost("line-switch")]
        public async Task<ActionResult<ApiResponse<object>>> LogLineSwitch([FromBody] LogLineSwitchRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userIdStr = GetCurrentUserId();
                var userGuid = Guid.TryParse(userIdStr, out var uGuid) ? uGuid : Guid.Empty;

                if (request == null || request.NewLineId == Guid.Empty)
                {
                    return ValidationError<object>("NewLineId", "New production line ID is required.");
                }

                var log = new OperatorContextLog
                {
                    UserId = userGuid,
                    OldLineId = request.OldLineId,
                    NewLineId = request.NewLineId,
                    ChangedAt = DateTime.UtcNow,
                    Device = request.Device ?? Request.Headers["User-Agent"].ToString() ?? "Unknown",
                    IPAddress = request.IPAddress ?? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    TenantId = tenantId
                };

                _tenantContext.OperatorContextLogs.Add(log);
                await _tenantContext.SaveChangesAsync();

                return Success<object?>(null, "Line switch logged successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AUDIT LOG ERROR]: {ex.Message}");
                return Failure<object>(ex.Message, "Failed to log line switch.");
            }
        }
    }

    public class LogLineSwitchRequest
    {
        public Guid? OldLineId { get; set; }
        public Guid NewLineId { get; set; }
        public string? Device { get; set; }
        public string? IPAddress { get; set; }
    }

    public class CreateLineRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public bool? IsActive { get; set; }
    }

    public class UpdateLineRequest
    {
        public string? Name { get; set; }
        public string? Code { get; set; }
        public bool? IsActive { get; set; }
    }

    public class StartBatchRequest
    {
        public Guid ProductionLineId { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        public string Product { get; set; } = string.Empty;
        public string Shift { get; set; } = string.Empty;
        public int TargetQuantity { get; set; }
    }

    public class SubmitStationDataRequest
    {
        public string StationCode { get; set; } = string.Empty;
        public int InputQty { get; set; }
        public int OutputQty { get; set; }
        public int WastageQty { get; set; }
        public string? AdditionalData { get; set; }
    }

    public class ProductionDashboardDto
    {
        public int TodayProduction { get; set; }
        public int TodayTarget { get; set; }
        public int WeeklyProduction { get; set; }
        public int MonthlyProduction { get; set; }
        public int PendingDispatch { get; set; }
        public int PendingDispatchHighPriority { get; set; }
    }

    public class ProductionLineDto
    {
        public Guid LineId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool HasActiveBatch { get; set; }
        public ActiveBatchSummaryDto? ActiveBatch { get; set; }
    }

    public class ActiveBatchSummaryDto
    {
        public Guid BatchId { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        public string Product { get; set; } = string.Empty;
        public string Shift { get; set; } = string.Empty;
        public DateTime StartedAt { get; set; }
        public int TargetQuantity { get; set; }
        public int ProducedQuantity { get; set; }
    }

    public class CockpitReportingDto
    {
        public string Range { get; set; } = "today";
        public int ProductionTotalCases { get; set; }
        public int DispatchTotalCases { get; set; }
        public int ReturnTotalCases { get; set; }
        public int NetDispatchCases { get; set; }
        public int TargetTotalCases { get; set; }
        public int EfficiencyPercentage { get; set; }
        public int RunningLinesCount { get; set; }
        public int TotalActiveLinesCount { get; set; }
        public int ActiveBatchesCount { get; set; }
        public List<ProductionTrendPointDto> ProductionTrend { get; set; } = new();
        public List<DispatchTrendPointDto> DispatchTrend { get; set; } = new();
        public List<BatchStatusItemDto> BatchStatusBreakdown { get; set; } = new();
        public List<RunningLineItemDto> RunningLines { get; set; } = new();
        public List<DashboardActivityDto> RecentActivities { get; set; } = new();
    }

    public class ProductionTrendPointDto
    {
        public string Label { get; set; } = string.Empty;
        public string DateStr { get; set; } = string.Empty;
        public int Hour { get; set; }
        public int TotalCases { get; set; }
        public int LoggedCases { get; set; }
        public int EntriesCount { get; set; }
        public List<string> RecordedTimes { get; set; } = new();
        public List<ProductBreakdownDto> Products { get; set; } = new();
        
        // Detailed Event Data for 'today' view
        public string? OperatorName { get; set; }
        public string? Shift { get; set; }
        public string? BatchNumber { get; set; }
        public long Timestamp { get; set; }
    }

    public class DispatchTrendPointDto
    {
        public string Label { get; set; } = string.Empty;
        public string DateStr { get; set; } = string.Empty;
        public string DayOfWeek { get; set; } = string.Empty;
        public int Hour { get; set; }
        public int DispatchedCases { get; set; }
        public int LoggedDispatched { get; set; }
        public int ReturnedCases { get; set; }
        public int LoggedReturned { get; set; }
        public int DamageCases { get; set; }
        public int LoggedDamage { get; set; }
        public int NetDispatchCases { get; set; }
        public int EntriesCount { get; set; }
        public List<string> RecordedTimes { get; set; } = new();
        public List<DispatchProductBreakdownDto> Products { get; set; } = new();

        // Event-level detail fields for tooltips & time-series event mapping
        public string? TransactionType { get; set; }
        public string? TransactionNumber { get; set; }
        public string? CustomerName { get; set; }
        public string? ProductName { get; set; }
        public int Quantity { get; set; }
        public int RunningTotal { get; set; }
        public long Timestamp { get; set; }
    }

    public class ProductBreakdownDto
    {
        public string ProductName { get; set; } = string.Empty;
        public int Cases { get; set; }
        public int EntriesCount { get; set; }
        public List<string> RecordedTimes { get; set; } = new();
    }

    public class DispatchProductBreakdownDto
    {
        public string ProductName { get; set; } = string.Empty;
        public int DispatchedCases { get; set; }
        public int ReturnedCases { get; set; }
        public int NetDispatchCases { get; set; }
    }

    public class BatchStatusItemDto
    {
        public string Label { get; set; } = string.Empty;
        public int Value { get; set; }
        public string Color { get; set; } = string.Empty;
    }

    public class RunningLineItemDto
    {
        public Guid LineId { get; set; }
        public string LineName { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string Status { get; set; } = "Idle";
        public string? BatchNumber { get; set; }
        public string? Product { get; set; }
        public string? OperatorName { get; set; }
        public string? Shift { get; set; }
        public int ProducedQuantity { get; set; }
        public int TargetQuantity { get; set; }
        public int ProgressPercentage { get; set; }
    }

    public class DashboardActivityDto
    {
        public string Time { get; set; } = string.Empty;
        public long Timestamp { get; set; }
        public string Text { get; set; } = string.Empty;
    }

    public class StopProductionBatchRequest
    {
        public string? Reason { get; set; }
        public string? Remarks { get; set; }
    }
}
