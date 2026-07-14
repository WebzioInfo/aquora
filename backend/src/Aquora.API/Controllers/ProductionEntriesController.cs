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
    [Route("api/v1/production-entries")]
    public class ProductionEntriesController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly IPlatformDbContext _platformContext;
        private readonly Microsoft.Extensions.Logging.ILogger<ProductionEntriesController> _logger;

        public ProductionEntriesController(
            ITenantDbContext tenantContext,
            IPlatformDbContext platformContext,
            Microsoft.Extensions.Logging.ILogger<ProductionEntriesController> logger)
        {
            _tenantContext = tenantContext;
            _platformContext = platformContext;
            _logger = logger;
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

        // GET api/v1/production-entries/today
        [HttpGet("today")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetTodayEntries([FromQuery] Guid lineId, [FromQuery] string? shift)
        {
            try
            {
                var todayUtc = DateTime.UtcNow.Date;
                var query = _tenantContext.ProductionEntries
                    .Include(e => e.Product)
                    .Include(e => e.PreformMaterial)
                    .Include(e => e.CapMaterial)
                    .Include(e => e.LabelMaterial)
                    .Include(e => e.ShrinkMaterial)
                    .Include(e => e.GlueMaterial)
                    .Where(e => !e.IsDeleted && e.ProductionLineId == lineId && e.Date == todayUtc);

                if (!string.IsNullOrEmpty(shift))
                {
                    query = query.Where(e => e.Shift == shift);
                }

                List<Aquora.Domain.Entities.ProductionEntry> entries;
                try
                {
                    entries = await query
                        .OrderByDescending(e => e.CreatedAt)
                        .ToListAsync();
                }
                catch (Exception ex) when (ex.ToString().Contains("42703") || ex.ToString().Contains("CapMaterialId"))
                {
                    return Failure<List<object>>("Tenant schema is outdated. Pending migration detected.", "Schema Error");
                }

                var result = entries.Select(e => new
                {
                    e.Id,
                    e.OperatorName,
                    e.Shift,
                    e.Time,
                    SkuName = e.Product?.Name ?? "Unknown Product",
                    CaseConfigurationName = "N/A",
                    e.CasesProduced,
                    PreformName = e.PreformMaterial?.Name ?? "Unknown Preform",
                    e.PreformUsage,
                    e.PreformWastage,
                    PreformUnit = e.PreformMaterial?.Unit ?? "PCS",
                    CapName = e.CapMaterial?.Name,
                    e.CapUsage,
                    e.CapWastage,
                    CapUnit = e.CapMaterial?.Unit ?? "BOX",
                    LabelName = e.LabelMaterial?.Name ?? "Unknown Label",
                    e.LabelUsage,
                    e.LabelWastage,
                    LabelUnit = e.LabelMaterial?.Unit ?? "PCS",
                    ShrinkName = e.ShrinkMaterial?.Name ?? "Unknown Shrink",
                    e.ShrinkUsage,
                    e.ShrinkWastage,
                    ShrinkUnit = e.ShrinkMaterial?.Unit ?? "KG",
                    GlueName = e.GlueMaterial?.Name,
                    e.GlueUsage,
                    GlueUnit = e.GlueMaterial?.Unit ?? "KG",
                    e.InkUsed,
                    e.MakeupUsed,
                    e.CreatedAt
                }).Cast<object>().ToList();

                return Success<List<object>>(result, "Today's production entries loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<object>>(ex.Message, "Failed to load today's production entries.");
            }
        }

        // GET api/v1/production-entries/session/{sessionId}/entries
        [HttpGet("session/{sessionId}/entries")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetSessionEntries(Guid sessionId)
        {
            try
            {
                var query = _tenantContext.ProductionEntries
                    .Include(e => e.Product)
                    .Include(e => e.PreformMaterial)
                    .Include(e => e.CapMaterial)
                    .Include(e => e.LabelMaterial)
                    .Include(e => e.ShrinkMaterial)
                    .Include(e => e.GlueMaterial)
                    .Where(e => !e.IsDeleted && e.ProductionSessionId == sessionId);

                List<Aquora.Domain.Entities.ProductionEntry> entries;
                try
                {
                    entries = await query
                        .OrderByDescending(e => e.CreatedAt)
                        .ToListAsync();
                }
                catch (Exception ex) when (ex.ToString().Contains("42703") || ex.ToString().Contains("CapMaterialId"))
                {
                    return Failure<List<object>>("Tenant schema is outdated. Pending migration detected.", "Schema Error");
                }

                var result = entries.Select(e => new
                {
                    e.Id,
                    e.OperatorName,
                    e.Shift,
                    e.Time,
                    SkuName = e.Product?.Name ?? "Unknown Product",
                    CaseConfigurationName = "N/A",
                    e.CasesProduced,
                    PreformName = e.PreformMaterial?.Name ?? "Unknown Preform",
                    e.PreformUsage,
                    e.PreformWastage,
                    PreformUnit = e.PreformMaterial?.Unit ?? "PCS",
                    CapName = e.CapMaterial?.Name,
                    e.CapUsage,
                    e.CapWastage,
                    CapUnit = e.CapMaterial?.Unit ?? "BOX",
                    LabelName = e.LabelMaterial?.Name ?? "Unknown Label",
                    e.LabelUsage,
                    e.LabelWastage,
                    LabelUnit = e.LabelMaterial?.Unit ?? "PCS",
                    ShrinkName = e.ShrinkMaterial?.Name ?? "Unknown Shrink",
                    e.ShrinkUsage,
                    e.ShrinkWastage,
                    ShrinkUnit = e.ShrinkMaterial?.Unit ?? "KG",
                    GlueName = e.GlueMaterial?.Name,
                    e.GlueUsage,
                    GlueUnit = e.GlueMaterial?.Unit ?? "KG",
                    e.InkUsed,
                    e.MakeupUsed,
                    e.CreatedAt
                }).Cast<object>().ToList();

                return Success<List<object>>(result, "Session entries loaded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load entries for session {SessionId}.", sessionId);
                return Failure<List<object>>(ex.Message, "Failed to load session entries.");
            }
        }

        // POST api/v1/production-entries
        [HttpPost]
        public async Task<ActionResult<ApiResponse<object>>> CreateEntry([FromBody] CreateProductionEntryRequest request)
        {
            if (request == null)
            {
                return Failure<object>("Invalid production entry data.", "Validation failed");
            }

            // Client/EF database transaction
            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return Failure<object>("Database context configuration is invalid.", "Infrastructure error");
            }

            var strategy = dbContext.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await dbContext.Database.BeginTransactionAsync();
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                var correlationId = Guid.NewGuid().ToString("N");

                try
                {
                    var tenantId = GetTenantId();
                    var userIdStr = GetCurrentUserId();
                    var userGuid = Guid.TryParse(userIdStr, out var uGuid) ? uGuid : Guid.Empty;

                    // 1. Fetch related line
                    var line = await _tenantContext.ProductionLines.FirstOrDefaultAsync(l => l.Id == request.ProductionLineId && !l.IsDeleted);
                    if (line == null)
                    {
                        return Failure<object>("Selected production line not found.", "Validation failed");
                    }

                // 1b. Fetch active production session
                var activeSession = await _tenantContext.ProductionSessions
                    .FirstOrDefaultAsync(s => s.ProductionLineId == request.ProductionLineId && s.Status == "Running" && !s.IsDeleted);
                if (activeSession == null)
                {
                    return Failure<object>("No active production batch found. Please start a batch first.", "Validation failed");
                }

                if (string.IsNullOrWhiteSpace(activeSession.Shift))
                {
                    return Failure<object>("Active batch is missing shift information.", "Validation failed");
                }

                // 2. Load SKU & Case Config from session
                var sku = await _tenantContext.Products.FirstOrDefaultAsync(s => s.Id == activeSession.ProductId && !s.IsDeleted);
                if (sku == null)
                {
                    return Failure<object>("Batch configuration is incomplete. Selected Product not found.", "Validation failed");
                }

                // 3. Validate and load raw materials
                var preform = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Id == request.PreformMaterialId && !m.IsDeleted);
                if (preform == null)
                {
                    return Failure<object>("Selected Preform material not found.", "Validation failed");
                }

                RawMaterial? cap = null;
                if (request.CapMaterialId.HasValue && request.CapMaterialId != Guid.Empty)
                {
                    cap = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Id == request.CapMaterialId.Value && !m.IsDeleted);
                    if (cap == null)
                    {
                        return Failure<object>("Selected Cap material not found.", "Validation failed");
                    }
                }
                else if (request.CapUsage > 0 || request.CapWastage > 0)
                {
                    return Failure<object>("Cap material must be selected when usage or wastage is greater than 0.", "Validation failed");
                }

                var label = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Id == request.LabelMaterialId && !m.IsDeleted);
                if (label == null)
                {
                    return Failure<object>("Selected Label material not found.", "Validation failed");
                }

                var shrink = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Id == request.ShrinkMaterialId && !m.IsDeleted);
                if (shrink == null)
                {
                    return Failure<object>("Selected Shrink Film material not found.", "Validation failed");
                }

                RawMaterial? glue = null;
                if (request.GlueMaterialId.HasValue && request.GlueMaterialId != Guid.Empty)
                {
                    glue = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Id == request.GlueMaterialId.Value && !m.IsDeleted);
                    if (glue == null)
                    {
                        return Failure<object>("Selected Glue material not found.", "Validation failed");
                    }
                }

                RawMaterial? ink = null;
                if (request.InkUsed)
                {
                    var inkId = await GetDefaultInkMaterialIdAsync(line.CompanyId);
                    if (!inkId.HasValue)
                    {
                        return Failure<object>("No active Ink material is configured in Inventory Settings.", "Validation failed");
                    }
                    ink = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Id == inkId.Value && !m.IsDeleted);
                    if (ink == null)
                    {
                        return Failure<object>("Configured default Ink material not found.", "Validation failed");
                    }
                }

                RawMaterial? makeup = null;
                if (request.MakeupUsed)
                {
                    var makeupId = await GetDefaultMakeupMaterialIdAsync(line.CompanyId);
                    if (!makeupId.HasValue)
                    {
                        return Failure<object>("No active Makeup material is configured in Inventory Settings.", "Validation failed");
                    }
                    makeup = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Id == makeupId.Value && !m.IsDeleted);
                    if (makeup == null)
                    {
                        return Failure<object>("Configured default Makeup material not found.", "Validation failed");
                    }
                }

                // 4. Stock validation checks & conversions
                // a. Preforms
                decimal preformDeduction = (request.PreformUsage * preform.ConversionFactor) + request.PreformWastage;
                if (preformDeduction < 0) return Failure<object>("Preform usage and wastage cannot be negative.", "Validation failed");

                // a2. Caps
                decimal capDeduction = 0;
                if (cap != null)
                {
                    capDeduction = (request.CapUsage * cap.ConversionFactor) + request.CapWastage;
                    if (capDeduction < 0) return Failure<object>("Cap usage and wastage cannot be negative.", "Validation failed");
                }

                // b. Labels
                decimal labelDeduction = (request.LabelUsage * label.ConversionFactor) + request.LabelWastage;
                if (labelDeduction < 0) return Failure<object>("Label usage and wastage cannot be negative.", "Validation failed");

                // c. Shrink
                decimal shrinkDeduction = (request.ShrinkUsage * shrink.ConversionFactor) + request.ShrinkWastage;
                if (shrinkDeduction < 0) return Failure<object>("Shrink Film usage and wastage cannot be negative.", "Validation failed");

                // d. Glue (Optional)
                decimal glueDeduction = 0;
                if (glue != null && request.GlueUsage.HasValue)
                {
                    glueDeduction = request.GlueUsage.Value * glue.ConversionFactor;
                    if (glueDeduction < 0) return Failure<object>("Glue usage cannot be negative.", "Validation failed");
                }

                // 5. Apply stock deductions & build audit movements
                var movements = new List<InventoryMovement>();
                var movementIds = new List<Guid>();
                var entryId = Guid.NewGuid();

                // a. Preforms
                preform.CurrentStock -= preformDeduction;
                var movPreform = new InventoryMovement
                {
                    Id = Guid.NewGuid(),
                    RawMaterialId = preform.Id,
                    Quantity = -preformDeduction,
                    ReferenceType = "ProductionEntry",
                    ReferenceId = entryId,
                    TenantId = tenantId,
                    CompanyId = line.CompanyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userIdStr
                };
                movements.Add(movPreform);
                movementIds.Add(movPreform.Id);

                // a2. Caps
                if (cap != null && capDeduction > 0)
                {
                    cap.CurrentStock -= capDeduction;
                    var movCap = new InventoryMovement
                    {
                        Id = Guid.NewGuid(),
                        RawMaterialId = cap.Id,
                        Quantity = -capDeduction,
                        ReferenceType = "ProductionEntry",
                        ReferenceId = entryId,
                        TenantId = tenantId,
                        CompanyId = line.CompanyId,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userIdStr
                    };
                    movements.Add(movCap);
                    movementIds.Add(movCap.Id);
                }

                // b. Labels
                label.CurrentStock -= labelDeduction;
                var movLabel = new InventoryMovement
                {
                    Id = Guid.NewGuid(),
                    RawMaterialId = label.Id,
                    Quantity = -labelDeduction,
                    ReferenceType = "ProductionEntry",
                    ReferenceId = entryId,
                    TenantId = tenantId,
                    CompanyId = line.CompanyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userIdStr
                };
                movements.Add(movLabel);
                movementIds.Add(movLabel.Id);

                // c. Shrink
                shrink.CurrentStock -= shrinkDeduction;
                var movShrink = new InventoryMovement
                {
                    Id = Guid.NewGuid(),
                    RawMaterialId = shrink.Id,
                    Quantity = -shrinkDeduction,
                    ReferenceType = "ProductionEntry",
                    ReferenceId = entryId,
                    TenantId = tenantId,
                    CompanyId = line.CompanyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userIdStr
                };
                movements.Add(movShrink);
                movementIds.Add(movShrink.Id);

                // d. Glue
                if (glue != null && glueDeduction > 0)
                {
                    glue.CurrentStock -= glueDeduction;
                    var movGlue = new InventoryMovement
                    {
                        Id = Guid.NewGuid(),
                        RawMaterialId = glue.Id,
                        Quantity = -glueDeduction,
                        ReferenceType = "ProductionEntry",
                        ReferenceId = entryId,
                        TenantId = tenantId,
                        CompanyId = line.CompanyId,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userIdStr
                    };
                    movements.Add(movGlue);
                    movementIds.Add(movGlue.Id);
                }

                // e. Ink
                if (request.InkUsed && ink != null)
                {
                    ink.CurrentStock -= 1.0m;
                    var movInk = new InventoryMovement
                    {
                        Id = Guid.NewGuid(),
                        RawMaterialId = ink.Id,
                        Quantity = -1.0m,
                        ReferenceType = "ProductionEntry",
                        ReferenceId = entryId,
                        TenantId = tenantId,
                        CompanyId = line.CompanyId,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userIdStr
                    };
                    movements.Add(movInk);
                    movementIds.Add(movInk.Id);
                }

                // f. Makeup
                if (request.MakeupUsed && makeup != null)
                {
                    makeup.CurrentStock -= 1.0m;
                    var movMakeup = new InventoryMovement
                    {
                        Id = Guid.NewGuid(),
                        RawMaterialId = makeup.Id,
                        Quantity = -1.0m,
                        ReferenceType = "ProductionEntry",
                        ReferenceId = entryId,
                        TenantId = tenantId,
                        CompanyId = line.CompanyId,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = userIdStr
                    };
                    movements.Add(movMakeup);
                    movementIds.Add(movMakeup.Id);
                }

                // 5b. Update Finished Product Stock & log movement
                sku.CurrentStock += request.CasesProduced;
                var finishedProductMov = new InventoryMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = sku.Id,
                    RawMaterialId = null,
                    Quantity = request.CasesProduced,
                    ReferenceType = "ProductionCompleted",
                    ReferenceId = entryId,
                    InventoryType = "FinishedProduct",
                    Notes = "Produced in Manufacturing",
                    TenantId = tenantId,
                    CompanyId = line.CompanyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userIdStr
                };
                movements.Add(finishedProductMov);
                movementIds.Add(finishedProductMov.Id);

                // Add all movements to db
                _tenantContext.InventoryMovements.AddRange(movements);

                // Create the production entry
                var entry = new ProductionEntry
                {
                    Id = entryId,
                    OperatorId = activeSession.OperatorId,
                    OperatorName = activeSession.OperatorName,
                    ProductionLineId = line.Id,
                    Shift = activeSession.Shift,
                    Date = DateTime.UtcNow.Date,
                    Time = DateTime.UtcNow.ToString("hh:mm tt"), // 12-hour format e.g. "10:42 AM"
                    ProductId = sku.Id,
                    CasesProduced = request.CasesProduced,
                    PreformMaterialId = preform.Id,
                    PreformUsage = request.PreformUsage,
                    PreformWastage = request.PreformWastage,
                    CapMaterialId = cap?.Id,
                    CapUsage = request.CapUsage,
                    CapWastage = request.CapWastage,
                    LabelMaterialId = label.Id,
                    LabelUsage = request.LabelUsage,
                    LabelWastage = request.LabelWastage,
                    ShrinkMaterialId = shrink.Id,
                    ShrinkUsage = request.ShrinkUsage,
                    ShrinkWastage = request.ShrinkWastage,
                    GlueMaterialId = glue?.Id,
                    GlueUsage = request.GlueUsage,
                    InkUsed = request.InkUsed,
                    MakeupUsed = request.MakeupUsed,
                    InventoryMovementIds = string.Join(",", movementIds.Select(id => id.ToString())),
                    ProductionSessionId = activeSession.Id,
                    TenantId = tenantId,
                    CompanyId = line.CompanyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userIdStr
                };

                _tenantContext.ProductionEntries.Add(entry);

                // Update ProducedQuantity on the corresponding ProductionBatch
                var batch = await _tenantContext.ProductionBatches
                    .FirstOrDefaultAsync(b => b.Id == activeSession.Id && !b.IsDeleted);
                if (batch != null)
                {
                    batch.ProducedQuantity = activeSession.ProductionEntries.Where(e => !e.IsDeleted).Sum(e => e.CasesProduced) + request.CasesProduced;
                }

                // Create audit log for entry creation
                var userEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "operator@aquora.com";
                var auditLog = new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userIdStr,
                    UserEmail = userEmail,
                    Action = "CreateEntry",
                    TableName = "ProductionEntry",
                    PrimaryKey = entryId.ToString(),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Device = Request.Headers["User-Agent"].ToString() ?? "Operator Station",
                    Reason = $"Production entry created under batch {activeSession.BatchNumber} on line {line.Name}. Cases produced: {request.CasesProduced}.",
                    Module = "Production"
                };
                _tenantContext.AuditLogs.Add(auditLog);

                var affectedRows = await _tenantContext.SaveChangesAsync();
                if (affectedRows <= 0)
                {
                    throw new Exception("Database operation failed: no rows were affected when saving production entry.");
                }

                await transaction.CommitAsync();

                // Detailed transaction success log
                    Serilog.Log.Information(
                        "[PRODUCTION ENTRY TRANSACTION SUCCESS]: TenantId={TenantId}, CompanyId={CompanyId}, SchemaName={SchemaName}, EntryId={EntryId}, BatchId={BatchId}, OperatorId={OperatorId}, TransactionId={TransactionId}, RowsAffected={RowsAffected}, ElapsedMs={ElapsedMs}, CorrelationId={CorrelationId}",
                        tenantId,
                        line.CompanyId,
                        (_tenantContext as Aquora.Persistence.Context.TenantDbContext)?.SchemaName ?? "public",
                        entryId,
                        activeSession.Id,
                        userGuid,
                        transaction.TransactionId,
                        affectedRows,
                        stopwatch.ElapsedMilliseconds,
                        correlationId
                    );

                    return Success<object>(new { EntryId = entry.Id, Time = entry.Time }, "Production Entry Saved Successfully.");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    stopwatch.Stop();
                    var errorMsg = ex.InnerException?.Message ?? ex.Message;
                    
                    _logger.LogError(ex, "CreateProductionEntry unexpected exception. Tenant: {TenantId}, LineId: {LineId}, ElapsedMs: {ElapsedMs}, CorrelationId: {CorrelationId}", 
                        GetTenantId(), request.ProductionLineId, stopwatch.ElapsedMilliseconds, correlationId);
                        
                    return Failure<object>($"An unexpected database or connection error occurred while saving your entry. Details: {errorMsg}", "Failed to save production entry.");
                }
            });
        }

        // GET api/v1/production-entries/session/active
        [HttpGet("session/active")]
        public async Task<ActionResult<ApiResponse<object>>> GetActiveSession([FromQuery] Guid lineId)
        {
            try
            {
                var activeSession = await _tenantContext.ProductionSessions
                    .Include(s => s.Product)
                    .Include(s => s.ProductionLine)
                    .Include(s => s.ProductionEntries)
                    .FirstOrDefaultAsync(s => s.ProductionLineId == lineId && s.Status == "Running" && !s.IsDeleted);

                if (activeSession == null)
                {
                    var fallbackResult = new
                    {
                        CanEnterProductionPage = false,
                        BatchStatus = "None"
                    };
                    return Success<object>(fallbackResult, "No active production session running.");
                }

                // Compute runtime metrics
                var now = DateTime.UtcNow;
                var duration = now - activeSession.StartedAt;
                var durationStr = $"{(int)duration.TotalHours:D2}h {duration.Minutes:D2}m";

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

                var result = new
                {
                    activeSession.Id,
                    activeSession.BatchNumber,
                    activeSession.Shift,
                    SkuId = activeSession.ProductId,
                    SkuName = activeSession.Product?.Name ?? "Unknown Product",
                    SkuCode = activeSession.Product?.SKU ?? "Unknown",
                    StartedAt = activeSession.StartedAt,
                    StartedAtFormatted = activeSession.StartedAt.AddHours(5.5).ToString("hh:mm tt"), // GMT+5.30 representation matching local time
                    Duration = durationStr,
                    EntriesCount = activeSession.ProductionEntries.Count(e => !e.IsDeleted),
                    TotalCasesProduced = activeSession.ProductionEntries.Where(e => !e.IsDeleted).Sum(e => e.CasesProduced),
                    activeSession.OperatorName,
                    activeSession.Status,

                    // Unified single-source-of-truth visual context properties
                    LineId = activeSession.ProductionLineId,
                    LineName = lineName,
                    LineColor = lineColor,
                    BatchId = activeSession.Id,
                    ProductName = activeSession.Product?.Name ?? "Unknown Product",
                    BatchStatus = activeSession.Status,
                    StartedAtTime = activeSession.StartedAt.AddHours(5.5).ToString("hh:mm tt"),
                    RunningTime = durationStr,
                    Entries = activeSession.ProductionEntries.Count(e => !e.IsDeleted),
                    CasesProduced = activeSession.ProductionEntries.Where(e => !e.IsDeleted).Sum(e => e.CasesProduced),
                    CanEnterProductionPage = true
                };

                return Success<object>(result, "Active production session loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to load active production session.");
            }
        }

        // POST api/v1/production-entries/session/start
        [HttpPost("session/start")]
        public async Task<ActionResult<ApiResponse<object>>> StartSession([FromBody] StartProductionSessionRequest request)
        {
            if (request == null)
            {
                return Failure<object>("Invalid session request.", "Validation failed");
            }

            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return Failure<object>("Database context is invalid.", "Infrastructure error");
            }

            // Validation 1: Required Shift
            if (string.IsNullOrWhiteSpace(request.Shift) || 
                !(request.Shift.Equals("Morning", StringComparison.OrdinalIgnoreCase) || 
                  request.Shift.Equals("Evening", StringComparison.OrdinalIgnoreCase) || 
                  request.Shift.Equals("Night", StringComparison.OrdinalIgnoreCase)))
            {
                return ValidationError<object>("Shift", "Shift is required and must be either Morning, Evening, or Night.");
            }

            // Validation 2: Required Product
            if (request.ProductId == Guid.Empty)
            {
                return ValidationError<object>("ProductId", "Product Selection is required.");
            }

            // Validation 3: Required Production Start Time
            if (!request.ProductionStartTime.HasValue)
            {
                return ValidationError<object>("ProductionStartTime", "Production Start Time is required.");
            }

            using var transaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var tenantId = GetTenantId();
                var userIdStr = GetCurrentUserId();
                var userGuid = Guid.TryParse(userIdStr, out var uGuid) ? uGuid : Guid.Empty;

                // 1. Check for existing active session on line
                var existing = await _tenantContext.ProductionSessions
                    .AnyAsync(s => s.ProductionLineId == request.ProductionLineId && s.Status == "Running" && !s.IsDeleted);

                if (existing)
                {
                    return ValidationError<object>("ProductionLineId", "A production batch is already running on this line. End it before starting a new one.");
                }

                // 2. Load line and product
                var line = await _tenantContext.ProductionLines.FirstOrDefaultAsync(l => l.Id == request.ProductionLineId && !l.IsDeleted);
                if (line == null) return ValidationError<object>("ProductionLineId", "Selected production line not found.");

                var sku = await _tenantContext.Products.FirstOrDefaultAsync(s => s.Id == request.ProductId && !s.IsDeleted);
                if (sku == null) return ValidationError<object>("ProductId", "Selected Product not found.");

                // User roles check for permissions
                var allowedRoles = new[] { "Company Owner", "Factory Manager", "Production Manager", "Supervisor", "Platform Owner", "Platform Administrator", "Admin" };
                var userRoles = User.FindAll(System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).ToList();
                var isSupervisorOrAdmin = userRoles.Any(r => 
                    allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase) || 
                    r.Contains("Admin", StringComparison.OrdinalIgnoreCase) || 
                    r.Contains("Supervisor", StringComparison.OrdinalIgnoreCase) || 
                    r.Contains("Manager", StringComparison.OrdinalIgnoreCase));

                var isAdmin = userRoles.Any(r => 
                    r.Equals("Admin", StringComparison.OrdinalIgnoreCase) || 
                    r.Equals("Platform Owner", StringComparison.OrdinalIgnoreCase) || 
                    r.Equals("Platform Administrator", StringComparison.OrdinalIgnoreCase) || 
                    r.Equals("Company Owner", StringComparison.OrdinalIgnoreCase) || 
                    r.Equals("Factory Manager", StringComparison.OrdinalIgnoreCase) ||
                    r.Contains("Admin", StringComparison.OrdinalIgnoreCase));

                // 3. Validate batch number
                if (string.IsNullOrWhiteSpace(request.BatchNumber))
                {
                    return ValidationError<object>("BatchNumber", "Batch Number is required.");
                }

                var batchNumber = request.BatchNumber.Trim();

                // Uniqueness check: reject duplicates globally within tenant context (exclude deleted)
                var isDuplicateBatch = await _tenantContext.ProductionSessions
                    .AnyAsync(s => s.BatchNumber == batchNumber && !s.IsDeleted);

                if (isDuplicateBatch)
                {
                    return ValidationError<object>("BatchNumber", "A production batch with this batch number already exists.", System.Net.HttpStatusCode.Conflict);
                }

                // 4. Start Time Validations
                var productionStartTimeUtc = request.ProductionStartTime.Value;
                var now = DateTime.UtcNow;
                var timeDifference = now - productionStartTimeUtc;

                // Future time check: Not allowed unless Admin
                if (productionStartTimeUtc > now.AddSeconds(15)) // 15 seconds grace for small clock offsets
                {
                    if (!isAdmin)
                    {
                        return ValidationError<object>("ProductionStartTime", "Future production start time is not allowed unless you are an Admin.");
                    }
                }

                // Past time check: Allowed only within configurable tolerance (default 30 minutes) unless Supervisor or Admin
                if (timeDifference.TotalMinutes > 0)
                {
                    var toleranceMinutes = 30; // configurable default
                    if (timeDifference.TotalMinutes > toleranceMinutes)
                    {
                        if (!isSupervisorOrAdmin)
                        {
                            return ValidationError<object>("ProductionStartTime", $"Past start time is allowed only within {toleranceMinutes} minutes tolerance.");
                        }
                    }
                }

                // Notes max length validation
                var notes = request.Notes?.Trim();
                if (notes != null && notes.Length > 500)
                {
                    return ValidationError<object>("Notes", "Batch Notes cannot exceed 500 characters.");
                }

                var batchId = Guid.NewGuid();

                // 5. Create ProductionBatch
                var batch = new ProductionBatch
                {
                    Id = batchId,
                    BatchNumber = batchNumber,
                    Product = sku.Name,
                    Shift = request.Shift,
                    ProductionLineId = request.ProductionLineId,
                    OperatorId = userGuid,
                    OperatorName = GetCurrentUserName(),
                    StartedAt = productionStartTimeUtc,
                    Status = "Active",
                    TargetQuantity = 1000,
                    ProducedQuantity = 0,
                    TenantId = tenantId,
                    CompanyId = line.CompanyId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userIdStr
                };

                // 6. Create ProductionSession
                var session = new ProductionSession
                {
                    Id = batchId,
                    TenantId = tenantId,
                    CompanyId = line.CompanyId,
                    BatchNumber = batchNumber,
                    ProductionLineId = request.ProductionLineId,
                    OperatorId = userGuid,
                    OperatorName = GetCurrentUserName(),
                    Shift = request.Shift,
                    ProductId = sku.Id,
                    StartedAt = productionStartTimeUtc,
                    Status = "Running",
                    Remarks = notes,
                    TotalCasesProduced = 0,
                    CreatedBy = userIdStr,
                    CreatedAt = DateTime.UtcNow
                };

                // 7. Create Initial Audit
                var userEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "operator@aquora.com";
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
                    Device = Request.Headers["User-Agent"].ToString() ?? "Operator Station",
                    Reason = $"Production batch {batchNumber} started on line {line.Name}.",
                    Module = "Production"
                };

                _tenantContext.ProductionBatches.Add(batch);
                _tenantContext.ProductionSessions.Add(session);
                _tenantContext.AuditLogs.Add(auditLog);

                var affectedRows = await _tenantContext.SaveChangesAsync();
                if (affectedRows <= 0)
                {
                    throw new Exception("Database operation failed: no rows were affected when persisting the production session.");
                }

                await transaction.CommitAsync();

                // Detailed transaction success log
                Serilog.Log.Information(
                    "[BATCH START TRANSACTION SUCCESS]: TenantId={TenantId}, CompanyId={CompanyId}, SchemaName={SchemaName}, BatchId={BatchId}, ProductionLineId={ProductionLineId}, OperatorId={OperatorId}, TransactionId={TransactionId}, RowsAffected={RowsAffected}",
                    tenantId,
                    line.CompanyId,
                    (_tenantContext as Aquora.Persistence.Context.TenantDbContext)?.SchemaName ?? "public",
                    batchId,
                    request.ProductionLineId,
                    userGuid,
                    transaction.TransactionId,
                    affectedRows
                );

                Serilog.Log.Information("Batch Creation: User={User}, Product={Product}, BatchNumber={BatchNumber}, Shift={Shift}, Timestamp={Timestamp}",
                    userIdStr, sku.Id, batchNumber, request.Shift, DateTime.UtcNow);

                return Success<object>(new { session.Id, session.BatchNumber, session.Status }, "Production Session started successfully.");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                
                // Detailed error logging in Development
                Serilog.Log.Error(ex, "Failed to start production session. DTO: {@Request}", request);

                return Failure<object>(ex.Message, "Failed to start production session.");
            }
        }

        // POST api/v1/production-entries/session/end
        [HttpPost("session/end")]
        public async Task<ActionResult<ApiResponse<object>>> EndSession([FromBody] EndProductionSessionRequest request)
        {
            if (request == null || !request.ConfirmClose)
            {
                return Failure<object>("Session closing confirmation is required.", "Validation failed");
            }

            var dbContext = _tenantContext as DbContext;
            if (dbContext == null)
            {
                return Failure<object>("Database context is invalid.", "Infrastructure error");
            }

            using var transaction = await dbContext.Database.BeginTransactionAsync();
            try
            {
                var session = await _tenantContext.ProductionSessions
                    .Include(s => s.ProductionEntries)
                    .FirstOrDefaultAsync(s => s.Id == request.SessionId && s.Status == "Running" && !s.IsDeleted);

                if (session == null)
                {
                    return Failure<object>("Active production session not found or already ended.", "Validation failed");
                }

                // Lock batch & save statistics
                session.Status = "Completed";
                session.EndedAt = DateTime.UtcNow;
                session.Remarks = request.Remarks;
                session.TotalCasesProduced = session.ProductionEntries.Where(e => !e.IsDeleted).Sum(e => e.CasesProduced);

                var batch = await _tenantContext.ProductionBatches
                    .FirstOrDefaultAsync(b => b.Id == session.Id && !b.IsDeleted);
                if (batch != null)
                {
                    batch.Status = "Completed";
                    batch.CompletedAt = session.EndedAt;
                    batch.ProducedQuantity = session.TotalCasesProduced;
                }

                var tenantId = GetTenantId();
                var userIdStr = GetCurrentUserId();
                var userGuid = Guid.TryParse(userIdStr, out var uGuid) ? uGuid : Guid.Empty;
                var userEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "operator@aquora.com";
                var auditLog = new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userIdStr,
                    UserEmail = userEmail,
                    Action = "EndBatch",
                    TableName = "ProductionBatch",
                    PrimaryKey = session.Id.ToString(),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Device = Request.Headers["User-Agent"].ToString() ?? "Operator Station",
                    Reason = $"Production batch {session.BatchNumber} ended.",
                    Module = "Production"
                };
                _tenantContext.AuditLogs.Add(auditLog);

                var affectedRows = await _tenantContext.SaveChangesAsync();
                if (affectedRows <= 0)
                {
                    throw new Exception("Database operation failed: no rows were affected when saving ending production session.");
                }

                await transaction.CommitAsync();

                // Detailed transaction success log
                Serilog.Log.Information(
                    "[BATCH END TRANSACTION SUCCESS]: TenantId={TenantId}, CompanyId={CompanyId}, SchemaName={SchemaName}, BatchId={BatchId}, OperatorId={OperatorId}, TransactionId={TransactionId}, RowsAffected={RowsAffected}",
                    tenantId,
                    session.CompanyId,
                    (_tenantContext as Aquora.Persistence.Context.TenantDbContext)?.SchemaName ?? "public",
                    session.Id,
                    userGuid,
                    transaction.TransactionId,
                    affectedRows
                );

                var duration = session.EndedAt.Value - session.StartedAt;
                var durationStr = $"{(int)duration.TotalHours:D2}h {duration.Minutes:D2}m";

                return Success<object>(new
                {
                    session.Id,
                    session.BatchNumber,
                    session.TotalCasesProduced,
                    EntriesCount = session.ProductionEntries.Count(e => !e.IsDeleted),
                    Duration = durationStr,
                    Status = session.Status
                }, "Production Batch successfully closed.");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return Failure<object>(ex.Message, "Failed to close production batch.");
            }
        }

        // GET api/v1/production-entries/session/summary
        [HttpGet("session/summary")]
        public async Task<ActionResult<ApiResponse<object>>> GetSessionSummary([FromQuery] Guid sessionId)
        {
            try
            {
                Aquora.Domain.Entities.ProductionSession? session = null;
                try
                {
                    session = await _tenantContext.ProductionSessions
                        .Include(s => s.Product)
                        .Include(s => s.ProductionEntries)
                            .ThenInclude(e => e.PreformMaterial)
                        .Include(s => s.ProductionEntries)
                            .ThenInclude(e => e.CapMaterial)
                        .Include(s => s.ProductionEntries)
                            .ThenInclude(e => e.LabelMaterial)
                        .Include(s => s.ProductionEntries)
                            .ThenInclude(e => e.ShrinkMaterial)
                        .Include(s => s.ProductionEntries)
                            .ThenInclude(e => e.GlueMaterial)
                        .FirstOrDefaultAsync(s => s.Id == sessionId && !s.IsDeleted);
                }
                catch (Exception ex) when (ex.ToString().Contains("42703") || ex.ToString().Contains("CapMaterialId"))
                {
                    return Failure<object>("Tenant schema is outdated. Pending migration detected.", "Schema Error");
                }

                if (session == null)
                {
                    return NotFound(Failure<object>("Production session not found.", "Not found"));
                }

                // Compute runtime metrics
                var endedAt = session.EndedAt ?? DateTime.UtcNow;
                var duration = endedAt - session.StartedAt;
                var durationStr = $"{(int)duration.TotalHours:D2}h {duration.Minutes:D2}m";

                // Get list of entries
                var activeEntries = session.ProductionEntries.Where(e => !e.IsDeleted).ToList();

                // Compute material consumption totals
                var materialConsumption = new List<object>();

                // We'll query all active raw materials to compare stocks
                var rawMaterialsList = await _tenantContext.RawMaterials.Where(m => !m.IsDeleted).ToListAsync();

                // 1. Preforms
                var preformEntries = activeEntries.Where(e => e.PreformMaterialId != Guid.Empty).ToList();
                var preformGroups = preformEntries.GroupBy(e => e.PreformMaterialId);
                foreach (var g in preformGroups)
                {
                    var mat = rawMaterialsList.FirstOrDefault(m => m.Id == g.Key);
                    if (mat != null)
                    {
                        var consumedBase = g.Sum(e => e.PreformUsage * mat.ConversionFactor);
                        var wasteBase = g.Sum(e => e.PreformWastage);
                        var totalBase = consumedBase + wasteBase;
                        materialConsumption.Add(new
                        {
                            MaterialName = mat.Name,
                            Category = mat.Category,
                            Unit = mat.Unit,
                            BaseUnit = mat.BaseUnit,
                            Consumed = g.Sum(e => e.PreformUsage),
                            Waste = g.Sum(e => e.PreformWastage),
                            OpeningStock = mat.CurrentStock + totalBase,
                            RemainingStock = mat.CurrentStock
                        });
                    }
                }

                // 1b. Caps
                var capEntries = activeEntries.Where(e => e.CapMaterialId.HasValue && e.CapMaterialId != Guid.Empty).ToList();
                var capGroups = capEntries.GroupBy(e => e.CapMaterialId!.Value);
                foreach (var g in capGroups)
                {
                    var mat = rawMaterialsList.FirstOrDefault(m => m.Id == g.Key);
                    if (mat != null)
                    {
                        var consumedBase = g.Sum(e => e.CapUsage * mat.ConversionFactor);
                        var wasteBase = g.Sum(e => e.CapWastage);
                        var totalBase = consumedBase + wasteBase;
                        materialConsumption.Add(new
                        {
                            MaterialName = mat.Name,
                            Category = mat.Category,
                            Unit = mat.Unit,
                            BaseUnit = mat.BaseUnit,
                            Consumed = g.Sum(e => e.CapUsage),
                            Waste = g.Sum(e => e.CapWastage),
                            OpeningStock = mat.CurrentStock + totalBase,
                            RemainingStock = mat.CurrentStock
                        });
                    }
                }

                // 2. Labels
                var labelEntries = activeEntries.Where(e => e.LabelMaterialId != Guid.Empty).ToList();
                var labelGroups = labelEntries.GroupBy(e => e.LabelMaterialId);
                foreach (var g in labelGroups)
                {
                    var mat = rawMaterialsList.FirstOrDefault(m => m.Id == g.Key);
                    if (mat != null)
                    {
                        var consumedBase = g.Sum(e => e.LabelUsage * mat.ConversionFactor);
                        var wasteBase = g.Sum(e => e.LabelWastage);
                        var totalBase = consumedBase + wasteBase;
                        materialConsumption.Add(new
                        {
                            MaterialName = mat.Name,
                            Category = mat.Category,
                            Unit = mat.Unit,
                            BaseUnit = mat.BaseUnit,
                            Consumed = g.Sum(e => e.LabelUsage),
                            Waste = g.Sum(e => e.LabelWastage),
                            OpeningStock = mat.CurrentStock + totalBase,
                            RemainingStock = mat.CurrentStock
                        });
                    }
                }

                // 3. Shrink Film
                var shrinkEntries = activeEntries.Where(e => e.ShrinkMaterialId != Guid.Empty).ToList();
                var shrinkGroups = shrinkEntries.GroupBy(e => e.ShrinkMaterialId);
                foreach (var g in shrinkGroups)
                {
                    var mat = rawMaterialsList.FirstOrDefault(m => m.Id == g.Key);
                    if (mat != null)
                    {
                        var consumedBase = g.Sum(e => e.ShrinkUsage * mat.ConversionFactor);
                        var wasteBase = g.Sum(e => e.ShrinkWastage);
                        var totalBase = consumedBase + wasteBase;
                        materialConsumption.Add(new
                        {
                            MaterialName = mat.Name,
                            Category = mat.Category,
                            Unit = mat.Unit,
                            BaseUnit = mat.BaseUnit,
                            Consumed = g.Sum(e => e.ShrinkUsage),
                            Waste = g.Sum(e => e.ShrinkWastage),
                            OpeningStock = mat.CurrentStock + totalBase,
                            RemainingStock = mat.CurrentStock
                        });
                    }
                }

                // 4. Glue
                var glueEntries = activeEntries.Where(e => e.GlueMaterialId.HasValue && e.GlueMaterialId != Guid.Empty).ToList();
                var glueGroups = glueEntries.GroupBy(e => e.GlueMaterialId!.Value);
                foreach (var g in glueGroups)
                {
                    var mat = rawMaterialsList.FirstOrDefault(m => m.Id == g.Key);
                    if (mat != null)
                    {
                        var consumedBase = g.Sum(e => (e.GlueUsage ?? 0) * mat.ConversionFactor);
                        materialConsumption.Add(new
                        {
                            MaterialName = mat.Name,
                            Category = mat.Category,
                            Unit = mat.Unit,
                            BaseUnit = mat.BaseUnit,
                            Consumed = g.Sum(e => e.GlueUsage ?? 0),
                            Waste = 0.0m,
                            OpeningStock = mat.CurrentStock + consumedBase,
                            RemainingStock = mat.CurrentStock
                        });
                    }
                }

                // 5. Ink Used (Toggles)
                var inkUsedCount = activeEntries.Count(e => e.InkUsed);
                if (inkUsedCount > 0)
                {
                    var inkMat = rawMaterialsList.FirstOrDefault(m => m.Category == "INK");
                    if (inkMat != null)
                    {
                        materialConsumption.Add(new
                        {
                            MaterialName = inkMat.Name,
                            Category = inkMat.Category,
                            Unit = inkMat.Unit,
                            BaseUnit = inkMat.BaseUnit,
                            Consumed = (decimal)inkUsedCount,
                            Waste = 0.0m,
                            OpeningStock = inkMat.CurrentStock + inkUsedCount,
                            RemainingStock = inkMat.CurrentStock
                        });
                    }
                }

                // 6. Makeup Used (Toggles)
                var makeupUsedCount = activeEntries.Count(e => e.MakeupUsed);
                if (makeupUsedCount > 0)
                {
                    var makeupMat = rawMaterialsList.FirstOrDefault(m => m.Category == "MAKEUP");
                    if (makeupMat != null)
                    {
                        materialConsumption.Add(new
                        {
                            MaterialName = makeupMat.Name,
                            Category = makeupMat.Category,
                            Unit = makeupMat.Unit,
                            BaseUnit = makeupMat.BaseUnit,
                            Consumed = (decimal)makeupUsedCount,
                            Waste = 0.0m,
                            OpeningStock = makeupMat.CurrentStock + makeupUsedCount,
                            RemainingStock = makeupMat.CurrentStock
                        });
                    }
                }

                var summary = new
                {
                    SessionId = session.Id,
                    session.BatchNumber,
                    SkuName = session.Product?.Name ?? "Unknown Product",
                    SkuCode = session.Product?.SKU ?? "Unknown",
                    CaseConfigurationName = "N/A",
                    session.OperatorName,
                    session.Shift,
                    StartedAt = session.StartedAt,
                    EndedAt = session.EndedAt,
                    Duration = durationStr,
                    CasesProduced = activeEntries.Sum(e => e.CasesProduced),
                    EntriesCount = activeEntries.Count,
                    PreformUsed = activeEntries.Sum(e => e.PreformUsage),
                    PreformWaste = activeEntries.Sum(e => e.PreformWastage),
                    CapUsed = activeEntries.Sum(e => e.CapUsage),
                    CapWaste = activeEntries.Sum(e => e.CapWastage),
                    LabelUsed = activeEntries.Sum(e => e.LabelUsage),
                    LabelWaste = activeEntries.Sum(e => e.LabelWastage),
                    ShrinkUsed = activeEntries.Sum(e => e.ShrinkUsage),
                    ShrinkWaste = activeEntries.Sum(e => e.ShrinkWastage),
                    GlueUsed = activeEntries.Sum(e => e.GlueUsage ?? 0),
                    InkUsed = inkUsedCount,
                    MakeupUsed = makeupUsedCount,
                    InventorySummary = materialConsumption
                };

                return Success<object>(summary, "Session summary loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<object>(ex.Message, "Failed to load session summary.");
            }
        }

        public class StartProductionSessionRequest
        {
            public Guid ProductionLineId { get; set; }
            public string Shift { get; set; } = string.Empty;
            public string? BatchNumber { get; set; }
            public Guid ProductId { get; set; }
            public DateTime? ProductionStartTime { get; set; }
            public string? Notes { get; set; }
        }

        public class EndProductionSessionRequest
        {
            public Guid SessionId { get; set; }
            public string? Remarks { get; set; }
            public bool ConfirmClose { get; set; }
        }

        // GET api/v1/production-entries/skus
        [HttpGet("skus")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetSkus([FromQuery] string? search)
        {
            try
            {
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();

                var query = _tenantContext.Products
                    .Where(s => !s.IsDeleted && s.IsActive);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchLower = search.ToLower().Trim();
                    query = query.Where(s => 
                        s.Name.ToLower().Contains(searchLower) || 
                        (s.SKU != null && s.SKU.ToLower().Contains(searchLower)) || 
                        (s.SKU != null && ("barcode-" + s.SKU.ToLower()).Contains(searchLower))
                    );
                }

                var skusList = await query
                    .OrderBy(s => s.Name)
                    .Select(s => new {
                        id = s.Id,
                        name = s.Name,
                        sku = s.SKU,
                        barcode = s.SKU != null ? "BARCODE-" + s.SKU : "",
                        isActive = s.IsActive
                    })
                    .ToListAsync();

                stopwatch.Stop();
                var tenantId = GetTenantId();
                var userId = GetCurrentUserId();

                Serilog.Log.Information("Product Fetch: Tenant={TenantId}, User={UserId}, Count={Count}, QueryTimeMs={QueryTimeMs}",
                    tenantId, userId, skusList.Count, stopwatch.ElapsedMilliseconds);

                return Success<List<object>>(skusList.Cast<object>().ToList(), "SKU products loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<object>>(ex.Message, "Failed to load SKU products.");
            }
        }

        // GET api/v1/production-entries/case-configs
        [HttpGet("case-configs")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetCaseConfigs()
        {
            try
            {
                var configs = await _tenantContext.CaseConfigurations
                    .Where(c => !c.IsDeleted && c.IsActive)
                    .OrderBy(c => c.Name)
                    .Select(c => new { c.Id, c.Name })
                    .ToListAsync();
                return Success<List<object>>(configs.Cast<object>().ToList(), "Case configurations loaded successfully.");
            }
            catch (Exception ex)
            {
                return Failure<List<object>>(ex.Message, "Failed to load case configurations.");
            }
        }

        // GET api/v1/production-entries/materials
        [HttpGet("materials")]
        public async Task<ActionResult<ApiResponse<List<object>>>> GetMaterials([FromQuery] string? category)
        {
            try
            {
                var tenantId = GetTenantId();
                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                var companyId = company?.Id ?? Guid.Empty;

                var query = _tenantContext.RawMaterials.Where(m => !m.IsDeleted && m.IsActive);
                if (!string.IsNullOrEmpty(category))
                {
                    query = query.Where(m => m.Category == category);
                }

                var materials = await query
                    .OrderBy(m => m.Name)
                    .Select(m => new
                    {
                        m.Id,
                        m.Name,
                        m.Code,
                        m.Category,
                        m.Unit,
                        m.BaseUnit,
                        m.ConversionFactor,
                        m.CurrentStock,
                        m.IsActive
                    })
                    .ToListAsync();

                if (!string.IsNullOrEmpty(category) && !materials.Any())
                {
                    var totalMaterialsCount = await _tenantContext.RawMaterials.CountAsync(m => !m.IsDeleted && m.IsActive);
                    _logger.LogWarning("Requested Category '{Category}' contains no active materials. Tenant ID: {TenantId}, Company ID: {CompanyId}, Total Active Materials: {TotalMaterials}, Returned Materials: 0, Applied Filters: IsDeleted=False, IsActive=True, Category={Category}",
                        category, tenantId, companyId, totalMaterialsCount, category);
                }

                return Success<List<object>>(materials.Cast<object>().ToList(), "Raw materials loaded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load raw materials.");
                return Failure<List<object>>(ex.Message, "Failed to load raw materials.");
            }
        }

        private async Task<Guid?> GetDefaultInkMaterialIdAsync(Guid companyId)
        {
            var dir = System.IO.Path.Combine(AppContext.BaseDirectory, "settings");
            var filePath = System.IO.Path.Combine(dir, $"inventory-settings-{companyId}.json");
            if (System.IO.File.Exists(filePath))
            {
                try
                {
                    var json = await System.IO.File.ReadAllTextAsync(filePath);
                    using var doc = System.Text.Json.JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("defaultInkMaterialId", out var prop) && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        if (Guid.TryParse(prop.GetString(), out var id)) return id;
                    }
                    if (doc.RootElement.TryGetProperty("DefaultInkMaterialId", out var propCamel) && propCamel.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        if (Guid.TryParse(propCamel.GetString(), out var id)) return id;
                    }
                }
                catch {}
            }
            var firstInk = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Category == "INK" && m.IsActive && !m.IsDeleted);
            return firstInk?.Id;
        }

        private async Task<Guid?> GetDefaultMakeupMaterialIdAsync(Guid companyId)
        {
            var dir = System.IO.Path.Combine(AppContext.BaseDirectory, "settings");
            var filePath = System.IO.Path.Combine(dir, $"inventory-settings-{companyId}.json");
            if (System.IO.File.Exists(filePath))
            {
                try
                {
                    var json = await System.IO.File.ReadAllTextAsync(filePath);
                    using var doc = System.Text.Json.JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("defaultMakeupMaterialId", out var prop) && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        if (Guid.TryParse(prop.GetString(), out var id)) return id;
                    }
                    if (doc.RootElement.TryGetProperty("DefaultMakeupMaterialId", out var propCamel) && propCamel.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        if (Guid.TryParse(propCamel.GetString(), out var id)) return id;
                    }
                }
                catch {}
            }
            var firstMakeup = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Category == "MAKEUP" && m.IsActive && !m.IsDeleted);
            return firstMakeup?.Id;
        }
    }

    public class CreateProductionEntryRequest
    {
        public Guid ProductionLineId { get; set; }
        public string? Shift { get; set; }
        public Guid? SkuProductId { get; set; }
        public int CasesProduced { get; set; }

        public Guid PreformMaterialId { get; set; }
        public decimal PreformUsage { get; set; }
        public decimal PreformWastage { get; set; }

        public Guid? CapMaterialId { get; set; }
        public decimal CapUsage { get; set; }
        public decimal CapWastage { get; set; }

        public Guid LabelMaterialId { get; set; }
        public decimal LabelUsage { get; set; }
        public decimal LabelWastage { get; set; }

        public Guid ShrinkMaterialId { get; set; }
        public decimal ShrinkUsage { get; set; }
        public decimal ShrinkWastage { get; set; }

        public Guid? GlueMaterialId { get; set; }
        public decimal? GlueUsage { get; set; }

        public Guid? InkMaterialId { get; set; }
        public bool InkUsed { get; set; }

        public Guid? MakeupMaterialId { get; set; }
        public bool MakeupUsed { get; set; }
    }
}
