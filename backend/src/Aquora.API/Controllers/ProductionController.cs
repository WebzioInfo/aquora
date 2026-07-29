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

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ProductionController : ApiControllerBase
    {
        private readonly IPlatformDbContext _platformContext;
        private readonly ITenantDbContext _tenantContext;

        public ProductionController(
            IPlatformDbContext platformContext,
            ITenantDbContext tenantContext)
        {
            _platformContext = platformContext;
            _tenantContext = tenantContext;
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
        public async Task<ActionResult<ApiResponse<List<object>>>> GetProductionLines([FromQuery] bool includeInactive = false)
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
                if (lines.Count == 0)
                {
                    var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                    if (company != null)
                    {
                        var line1 = new ProductionLine
                        {
                            Id = Guid.NewGuid(),
                            Name = "Line 1",
                            Code = "L001",
                            IsActive = true,
                            TenantId = tenantId,
                            CompanyId = company.Id,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = "System"
                        };
                        var line2 = new ProductionLine
                        {
                            Id = Guid.NewGuid(),
                            Name = "Line 2",
                            Code = "L002",
                            IsActive = true,
                            TenantId = tenantId,
                            CompanyId = company.Id,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = "System"
                        };
                        _tenantContext.ProductionLines.AddRange(line1, line2);
                        await _tenantContext.SaveChangesAsync();
                        lines = new List<ProductionLine> { line1, line2 };
                    }
                }

                var activeBatches = await _tenantContext.ProductionBatches
                    .Where(b => b.Status == "Active" && !b.IsDeleted)
                    .ToListAsync();

                var result = new List<object>();
                foreach (var line in lines)
                {
                    var activeBatch = activeBatches.FirstOrDefault(b => b.ProductionLineId == line.Id);
                    result.Add(new
                    {
                        LineId = line.Id,
                        Name = line.Name,
                        Code = line.Code,
                        IsActive = line.IsActive,
                        HasActiveBatch = activeBatch != null,
                        ActiveBatch = activeBatch != null ? new
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

                return Success<List<object>>(result, "Production lines loaded successfully.");
            }
            catch (Exception)
            {
                return Failure<List<object>>("An internal error occurred.", "Failed to load production lines.");
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
            catch (Exception)
            {
                return Failure<ProductionDashboardDto>("An internal error occurred.", "Failed to load production dashboard stats.");
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
                    .Where(b => !b.IsDeleted)
                    .OrderByDescending(b => b.CreatedAt)
                    .Select(b => new
                    {
                        b.Id,
                        b.BatchNumber,
                        b.Product,
                        b.Shift,
                        ProductionLineId = b.ProductionLineId,
                        ProductionLineName = b.ProductionLine != null ? b.ProductionLine.Name : "Unknown",
                        ProductionLineCode = b.ProductionLine != null ? b.ProductionLine.Code : "L001",
                        b.OperatorId,
                        b.OperatorName,
                        b.StartedAt,
                        b.CompletedAt,
                        b.TargetQuantity,
                        b.ProducedQuantity,
                        b.Status, b.CreatedAt
                    })
                    .ToListAsync();

                return Success<List<object>>(activeBatches.Cast<object>().ToList(), "Active batches loaded successfully.");
            }
            catch (Exception)
            {
                return Failure<List<object>>("An internal error occurred.", "Failed to load active batches.");
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
                    return Success<object>(null, "No active batch found.");
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
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to load active batch.");
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
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to load production context.");
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
                    sku = await _tenantContext.Products.FirstOrDefaultAsync(p => !p.IsDeleted);
                }

                if (sku == null)
                {
                    return Failure<object>("No product configuration was found to initialize this batch.", "Validation failed");
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
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    return Failure<object>("An internal error occurred.", "Failed to start batch.");
                }
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to start batch.");
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
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to submit station parameters.");
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

                return Success<object>(new
                {
                    BatchId = batch.Id,
                    Status = batch.Status,
                    CompletedAt = batch.CompletedAt
                }, "Production batch completed and locked successfully.");
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to complete batch.");
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
                return Success<object>(new { BatchId = batch.Id, Status = batch.Status }, "Production batch paused.");
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to pause batch.");
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
                return Success<object>(new { BatchId = batch.Id, Status = batch.Status }, "Production batch resumed.");
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to resume batch.");
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
            catch (Exception)
            {
                return Failure<List<object>>("An internal error occurred.", "Failed to retrieve history.");
            }
        }

        // 1b. POST api/v1/production/lines
        [HttpPost("lines")]
        public async Task<ActionResult<ApiResponse<object>>> CreateProductionLine([FromBody] CreateLineRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                if (string.IsNullOrEmpty(request.Name) || string.IsNullOrEmpty(request.Code))
                {
                    return Failure<object>("Name and Code are required.", "Validation failed", System.Net.HttpStatusCode.BadRequest);
                }

                // Check if code is already taken in this tenant
                var codeExists = await _tenantContext.ProductionLines
                    .AnyAsync(l => l.Code.ToUpper() == request.Code.ToUpper() && !l.IsDeleted);
                if (codeExists)
                {
                    return Failure<object>($"Production line with code '{request.Code}' already exists.", "Validation failed", System.Net.HttpStatusCode.BadRequest);
                }

                // Get first company to map
                var company = await _tenantContext.Companies.FirstOrDefaultAsync();

                if (company == null)
                {
                    return Failure<object>("Company infrastructure must be seeded first.", "Infrastructure missing", System.Net.HttpStatusCode.BadRequest);
                }

                var line = new ProductionLine
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name.Trim(),
                    Code = request.Code.Trim().ToUpper(),
                    IsActive = request.IsActive ?? true,
                    TenantId = tenantId,
                    CompanyId = company.Id,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = GetCurrentUserId()
                };

                _tenantContext.ProductionLines.Add(line);
                await _tenantContext.SaveChangesAsync();

                return Success<object>(new { line.Id, line.Name, line.Code, line.IsActive }, "Production line created successfully.");
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to create production line.", System.Net.HttpStatusCode.InternalServerError);
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

                if (!string.IsNullOrEmpty(request.Name))
                {
                    line.Name = request.Name.Trim();
                }

                if (!string.IsNullOrEmpty(request.Code))
                {
                    var codeExists = await _tenantContext.ProductionLines
                        .AnyAsync(l => l.Id != id && l.Code.ToUpper() == request.Code.ToUpper() && !l.IsDeleted);
                    if (codeExists)
                    {
                        return Failure<object>($"Production line with code '{request.Code}' already exists.", "Validation failed", System.Net.HttpStatusCode.BadRequest);
                    }
                    line.Code = request.Code.Trim().ToUpper();
                }

                if (request.IsActive.HasValue)
                {
                    line.IsActive = request.IsActive.Value;
                }

                line.UpdatedAt = DateTime.UtcNow;
                line.UpdatedBy = GetCurrentUserId();

                await _tenantContext.SaveChangesAsync();

                return Success<object>(new { line.Id, line.Name, line.Code, line.IsActive }, "Production line updated successfully.");
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to update production line.", System.Net.HttpStatusCode.InternalServerError);
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

                return Success<object>(null, "Production line deleted successfully.");
            }
            catch (Exception)
            {
                return Failure<object>("An internal error occurred.", "Failed to delete production line.", System.Net.HttpStatusCode.InternalServerError);
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

                return Success<object>(null, "Line switch logged successfully.");
            }
            catch (Exception)
            {
                Console.WriteLine($"[AUDIT LOG ERROR]: {"An internal error occurred."}");
                return Failure<object>("An internal error occurred.", "Failed to log line switch.");
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
}
