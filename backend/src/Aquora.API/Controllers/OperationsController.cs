using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Aquora.Shared.Models;
using System.Net;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class OperationsController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _userContext;

        public OperationsController(ITenantDbContext tenantContext, ICurrentUserContext userContext)
        {
            _tenantContext = tenantContext;
            _userContext = userContext;
        }

        [HttpPost("visit")]
        public async Task<ActionResult<ApiResponse<object>>> RecordArrival([FromBody] ArrivalDto dto)
        {
            var tenantId = _userContext.TenantId;
            var companyId = await _tenantContext.Companies.Select(c => c.Id).FirstOrDefaultAsync();
            
            var visit = new OperationsVisit
            {
                TenantId = tenantId,
                CompanyId = companyId,
                ArrivalTime = dto.ArrivalTime,
                VehicleNumber = dto.VehicleNumber,
                DriverName = dto.DriverName,
                DistributorId = dto.DistributorId,
                ExpectedCollectionTime = dto.ExpectedCollectionTime,
                Priority = dto.Priority,
                Remarks = dto.Remarks,
                Status = "Arrival",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userContext.UserId.ToString()
            };

            _tenantContext.OperationsVisits.Add(visit);
            await _tenantContext.SaveChangesAsync(default);

            return Success<object>(new { visit.Id, visit.Status }, "Arrival recorded successfully");
        }

        [HttpPost("visit/{visitId}/unload")]
        public async Task<ActionResult<ApiResponse<object>>> RecordUnloading(Guid visitId, [FromBody] UnloadingDto dto)
        {
            var tenantId = _userContext.TenantId;
            var visit = await _tenantContext.OperationsVisits.FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId);
            if (visit == null) return Failure<object>("Visit not found", "Not Found", HttpStatusCode.NotFound);

            var unloading = new OperationsUnloading
            {
                TenantId = tenantId,
                CompanyId = visit.CompanyId,
                VisitId = visit.Id,
                BrandId = dto.BrandId,
                ReturnedEmptyCount = dto.ReturnedEmptyCount,
                ImmediateRequirement = dto.ImmediateRequirement,
                LaterRequirement = dto.LaterRequirement,
                ScheduledRequirement = dto.ScheduledRequirement,
                ScheduledDate = dto.ScheduledDate,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userContext.UserId.ToString()
            };

            _tenantContext.OperationsUnloadings.Add(unloading);

            // Add conditions if any
            foreach (var cond in dto.Conditions)
            {
                var conditionEntry = new OperationsJarCondition
                {
                    TenantId = tenantId,
                    CompanyId = visit.CompanyId,
                    VisitId = visit.Id,
                    ConditionType = cond.ConditionType,
                    Quantity = cond.Quantity,
                    DamageLocation = "Unloading",
                    Responsibility = cond.Responsibility,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _userContext.UserId.ToString()
                };
                _tenantContext.OperationsJarConditions.Add(conditionEntry);

                // Auto-Quarantine logic for specific conditions
                if (cond.ConditionType == "Oil Smell" || cond.ConditionType == "Chemical" || cond.ConditionType == "Diesel" || cond.ConditionType == "Paint")
                {
                    var quarantine = new OperationsQuarantine
                    {
                        TenantId = tenantId,
                        CompanyId = visit.CompanyId,
                        VisitId = visit.Id,
                        Reason = cond.ConditionType,
                        HoldDurationHours = 48, // Default
                        Quantity = cond.Quantity,
                        Status = "Quarantined",
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = _userContext.UserId.ToString()
                    };
                    _tenantContext.OperationsQuarantines.Add(quarantine);
                }
            }

            // Generate Queue entry if immediate requirement exists
            if (dto.ImmediateRequirement > 0)
            {
                var queue = new OperationsFillingQueue
                {
                    TenantId = tenantId,
                    CompanyId = visit.CompanyId,
                    DistributorId = visit.DistributorId,
                    VisitId = visit.Id,
                    BrandId = dto.BrandId,
                    Priority = visit.Priority,
                    RequestedQuantity = dto.ImmediateRequirement,
                    RemainingQuantity = dto.ImmediateRequirement,
                    CompletedQuantity = 0,
                    Status = "Pending",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _userContext.UserId.ToString()
                };
                _tenantContext.OperationsFillingQueues.Add(queue);
            }

            visit.Status = "Unloaded";
            await _tenantContext.SaveChangesAsync(default);

            return Success<object>(new { unloading.Id }, "Unloading recorded successfully");
        }

        [HttpGet("queue")]
        public async Task<ActionResult<ApiResponse<object>>> GetLiveQueue()
        {
            var tenantId = _userContext.TenantId;
            var queue = await _tenantContext.OperationsFillingQueues
                .Where(q => q.TenantId == tenantId && q.Status != "Completed" && q.Status != "Cancelled")
                .Select(q => new
                {
                    q.Id,
                    q.VisitId,
                    q.Priority,
                    BrandName = q.Brand.Name,
                    DistributorName = q.Distributor.CustomerName,
                    VehicleNumber = q.Visit.VehicleNumber,
                    q.RequestedQuantity,
                    q.RemainingQuantity,
                    q.CompletedQuantity,
                    q.CreatedAt
                })
                .OrderByDescending(q => q.Priority == "Immediate" ? 3 : q.Priority == "High" ? 2 : 1)
                .ThenBy(q => q.CreatedAt)
                .ToListAsync();

            return Success<object>(queue);
        }

        [HttpPost("visit/{visitId}/load")]
        public async Task<ActionResult<ApiResponse<object>>> RecordLoading(Guid visitId, [FromBody] LoadingDto dto)
        {
            var tenantId = _userContext.TenantId;
            var visit = await _tenantContext.OperationsVisits.FirstOrDefaultAsync(v => v.Id == visitId && v.TenantId == tenantId);
            if (visit == null) return Failure<object>("Visit not found", "Not Found", HttpStatusCode.NotFound);

            var loading = new OperationsLoading
            {
                TenantId = tenantId,
                CompanyId = visit.CompanyId,
                VisitId = visit.Id,
                ProductId = dto.ProductId,
                BrandId = dto.BrandId,
                BatchNumber = dto.BatchNumber,
                CapMaterialId = dto.CapMaterialId,
                SealMaterialId = dto.SealMaterialId,
                SealRequired = dto.SealRequired,
                QuantityLoaded = dto.QuantityLoaded,
                LoadedBy = dto.LoadedBy,
                LoadingTime = DateTime.UtcNow,
                VehicleNumber = visit.VehicleNumber,
                Remarks = dto.Remarks,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userContext.UserId.ToString()
            };

            _tenantContext.OperationsLoadings.Add(loading);

            // Update queue if applicable
            var queueItem = await _tenantContext.OperationsFillingQueues
                .Where(q => q.TenantId == tenantId && q.DistributorId == visit.DistributorId && q.BrandId == dto.BrandId && q.RemainingQuantity > 0)
                .OrderBy(q => q.CreatedAt)
                .FirstOrDefaultAsync();

            if (queueItem != null)
            {
                queueItem.CompletedQuantity += dto.QuantityLoaded;
                queueItem.RemainingQuantity = Math.Max(0, queueItem.RequestedQuantity - queueItem.CompletedQuantity);
                if (queueItem.RemainingQuantity == 0)
                {
                    queueItem.Status = "Completed";
                }
            }

            visit.Status = "Completed";
            await _tenantContext.SaveChangesAsync(default);

            return Success<object>(new { loading.Id }, "Loading recorded successfully");
        }

        [HttpGet("dashboard")]
        public async Task<ActionResult<ApiResponse<object>>> GetDashboardMetrics()
        {
            var tenantId = _userContext.TenantId;
            var today = DateTime.UtcNow.Date;

            var returnedToday = await _tenantContext.OperationsUnloadings
                .Where(u => u.TenantId == tenantId && u.CreatedAt >= today)
                .SumAsync(u => u.ReturnedEmptyCount);

            var loadedToday = await _tenantContext.OperationsLoadings
                .Where(l => l.TenantId == tenantId && l.CreatedAt >= today)
                .SumAsync(l => l.QuantityLoaded);

            var damagedToday = await _tenantContext.OperationsJarConditions
                .Where(c => c.TenantId == tenantId && c.CreatedAt >= today && c.ConditionType != "Good")
                .SumAsync(c => c.Quantity);

            var pendingQueue = await _tenantContext.OperationsFillingQueues
                .Where(q => q.TenantId == tenantId && q.RemainingQuantity > 0)
                .SumAsync(q => q.RemainingQuantity);

            var quarantineTotal = await _tenantContext.OperationsQuarantines
                .Where(q => q.TenantId == tenantId && q.Status == "Quarantined")
                .SumAsync(q => q.Quantity);

            return Success<object>(new
            {
                returnedToday,
                loadedToday,
                pendingQueue,
                damagedToday,
                quarantineTotal,
                outstandingJars = 0 // In future, integrate with customer ledger
            });
        }
    }

    public class ArrivalDto
    {
        public DateTime ArrivalTime { get; set; }
        public string VehicleNumber { get; set; } = string.Empty;
        public string DriverName { get; set; } = string.Empty;
        public Guid DistributorId { get; set; }
        public DateTime? ExpectedCollectionTime { get; set; }
        public string Priority { get; set; } = "Normal";
        public string? Remarks { get; set; }
    }

    public class UnloadingDto
    {
        public Guid BrandId { get; set; }
        public int ReturnedEmptyCount { get; set; }
        public int ImmediateRequirement { get; set; }
        public int LaterRequirement { get; set; }
        public int ScheduledRequirement { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public List<ConditionDto> Conditions { get; set; } = new List<ConditionDto>();
    }

    public class ConditionDto
    {
        public string ConditionType { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string? Responsibility { get; set; }
    }

    public class LoadingDto
    {
        public Guid ProductId { get; set; }
        public Guid BrandId { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        public Guid? CapMaterialId { get; set; }
        public Guid? SealMaterialId { get; set; }
        public bool SealRequired { get; set; }
        public int QuantityLoaded { get; set; }
        public string LoadedBy { get; set; } = string.Empty;
        public string? Remarks { get; set; }
    }
}
