using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;
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
        private readonly IInventoryMovementService _inventoryMovementService;

        public OperationsController(
            ITenantDbContext tenantContext, 
            ICurrentUserContext userContext,
            IInventoryMovementService inventoryMovementService)
        {
            _tenantContext = tenantContext;
            _userContext = userContext;
            _inventoryMovementService = inventoryMovementService;
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

            if (dto.ReturnedEmptyCount > 0)
            {
                await _inventoryMovementService.RecordOutstandingJarMovementAsync(
                    _tenantContext,
                    visit.DistributorId,
                    -dto.ReturnedEmptyCount,
                    "Unloading_Return",
                    unloading.Id,
                    "Empty jars returned to plant",
                    tenantId,
                    visit.CompanyId,
                    _userContext.UserId.ToString()
                );
            }

            if (dto.LaterRequirement > 0)
            {
                await _inventoryMovementService.RecordReservedEmptyJarMovementAsync(
                    _tenantContext,
                    visit.DistributorId,
                    dto.LaterRequirement,
                    "Unloading_Reserve",
                    unloading.Id,
                    "Empty jars reserved for later filling",
                    tenantId,
                    visit.CompanyId,
                    _userContext.UserId.ToString()
                );
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

            if (dto.QuantityLoaded > 0)
            {
                await _inventoryMovementService.RecordOutstandingJarMovementAsync(
                    _tenantContext,
                    visit.DistributorId,
                    dto.QuantityLoaded,
                    "Loading_Dispatch",
                    loading.Id,
                    "Full jars dispatched to distributor",
                    tenantId,
                    visit.CompanyId,
                    _userContext.UserId.ToString()
                );
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
                .Where(c => c.TenantId == tenantId && c.CreatedAt >= today && c.ConditionType != "Normal")
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
                outstandingJars = await _tenantContext.Customers.Where(c => c.TenantId == tenantId && !c.IsDeleted).SumAsync(c => c.OutstandingJars)
            });
        }

        [HttpGet("distributors")]
        public async Task<ActionResult<ApiResponse<object>>> GetDistributors()
        {
            var tenantId = _userContext.TenantId;
            var list = await _tenantContext.Customers
                .Where(c => c.TenantId == tenantId && c.IsActive && !c.IsDeleted)
                .Select(c => new
                {
                    c.Id,
                    c.CustomerName,
                    c.CustomerCode,
                    c.Phone,
                    c.OutstandingJars,
                    c.AssignedVehicle,
                    c.AssignedDriver,
                    c.MaxJarLimit,
                    c.ReservedEmptyJars
                })
                .ToListAsync();
            return Success<object>(list);
        }

        [HttpGet("distributor/{distributorId}/context")]
        public async Task<ActionResult<ApiResponse<object>>> GetDistributorContext(Guid distributorId)
        {
            var tenantId = _userContext.TenantId;
            var distributor = await _tenantContext.Customers
                .FirstOrDefaultAsync(c => c.Id == distributorId && c.TenantId == tenantId);
            if (distributor == null) return Failure<object>("Distributor not found", "Not Found", HttpStatusCode.NotFound);

            var reservedFilled = await _tenantContext.OperationsReservedJars
                .Where(r => r.DistributorId == distributorId && r.Type == "Filled" && r.Status == "Pending" && r.TenantId == tenantId)
                .SumAsync(r => r.Quantity);

            var condemnations = await _tenantContext.OperationsJarConditions
                .Where(c => c.Visit.DistributorId == distributorId && c.ConditionType != "Normal" && c.TenantId == tenantId)
                .SumAsync(c => c.Quantity);

            return Success<object>(new
            {
                distributorId = distributor.Id,
                distributorName = distributor.CustomerName,
                outstandingJars = distributor.OutstandingJars,
                reservedEmpty = distributor.ReservedEmptyJars,
                reservedEmptyJars = distributor.ReservedEmptyJars,
                reservedFilled,
                condemnations,
                assignedVehicle = distributor.AssignedVehicle ?? string.Empty,
                assignedDriver = distributor.AssignedDriver ?? string.Empty
            });
        }

        [HttpPost("washing")]
        public async Task<ActionResult<ApiResponse<object>>> RecordWashing([FromBody] WashingLogDto dto)
        {
            var tenantId = _userContext.TenantId;
            var companyId = await _tenantContext.Companies.Select(c => c.Id).FirstOrDefaultAsync();

            var washing = new OperationsWashingLog
            {
                TenantId = tenantId,
                CompanyId = companyId,
                WashedCount = dto.WashedCount,
                RejectedCount = dto.RejectedCount,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userContext.UserId.ToString()
            };

            _tenantContext.OperationsWashingLogs.Add(washing);
            await _tenantContext.SaveChangesAsync(default);

            return Success<object>(new { washing.Id }, "Washing recorded successfully");
        }

        [HttpPost("filling")]
        public async Task<ActionResult<ApiResponse<object>>> RecordFilling([FromBody] FillingLogDto dto)
        {
            var tenantId = _userContext.TenantId;
            var companyId = await _tenantContext.Companies.Select(c => c.Id).FirstOrDefaultAsync();

            var filling = new OperationsFillingLog
            {
                TenantId = tenantId,
                CompanyId = companyId,
                ProductId = dto.ProductId,
                BrandId = dto.BrandId,
                FilledCount = dto.FilledCount,
                RejectedCount = dto.RejectedCount,
                LeakageCount = dto.LeakageCount,
                CapFailureCount = dto.CapFailureCount,
                SealFailureCount = dto.SealFailureCount,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userContext.UserId.ToString()
            };

            _tenantContext.OperationsFillingLogs.Add(filling);
            await _tenantContext.SaveChangesAsync(default);

            return Success<object>(new { filling.Id }, "Filling recorded successfully");
        }

        [HttpPost("reserve")]
        public async Task<ActionResult<ApiResponse<object>>> RecordReservation([FromBody] ReserveDto dto)
        {
            var tenantId = _userContext.TenantId;
            var companyId = await _tenantContext.Companies.Select(c => c.Id).FirstOrDefaultAsync();

            var reservation = new OperationsReservedJar
            {
                TenantId = tenantId,
                CompanyId = companyId,
                DistributorId = dto.DistributorId,
                Quantity = dto.Quantity,
                Type = dto.Type, // Empty or Filled
                Reason = dto.Reason,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow,
                CreatedBy = _userContext.UserId.ToString()
            };

            _tenantContext.OperationsReservedJars.Add(reservation);

            if (dto.Type == "Empty")
            {
                await _inventoryMovementService.RecordReservedEmptyJarMovementAsync(
                    _tenantContext,
                    dto.DistributorId,
                    dto.Quantity,
                    "Reservation_Add",
                    reservation.Id,
                    dto.Reason,
                    tenantId,
                    companyId,
                    _userContext.UserId.ToString()
                );
            }

            await _tenantContext.SaveChangesAsync(default);

            return Success<object>(new { reservation.Id }, "Reservation recorded successfully");
        }

        [HttpPost("reservations/claim")]
        public async Task<ActionResult<ApiResponse<object>>> ClaimReservations([FromBody] ClaimDto dto)
        {
            var tenantId = _userContext.TenantId;
            var reservations = await _tenantContext.OperationsReservedJars
                .Where(r => r.DistributorId == dto.DistributorId && r.Type == dto.Type && r.Status == "Pending" && r.TenantId == tenantId)
                .ToListAsync();

            int totalClaimed = 0;
            foreach (var r in reservations)
            {
                r.Status = "Claimed";
                r.ClaimedAt = DateTime.UtcNow;
                totalClaimed += r.Quantity;
            }

            if (dto.Type == "Empty" && totalClaimed > 0)
            {
                var companyId = await _tenantContext.Companies.Select(c => c.Id).FirstOrDefaultAsync();
                await _inventoryMovementService.RecordReservedEmptyJarMovementAsync(
                    _tenantContext,
                    dto.DistributorId,
                    -totalClaimed,
                    "Reservation_Claim",
                    Guid.NewGuid(), // Bulk claim
                    "Claimed reserved empty jars",
                    tenantId,
                    companyId,
                    _userContext.UserId.ToString()
                );
            }

            await _tenantContext.SaveChangesAsync(default);
            return Success<object?>(null, "Reservations claimed successfully");
        }

        [HttpGet("dashboard-extended")]
        public async Task<ActionResult<ApiResponse<object>>> GetDashboardExtended()
        {
            var tenantId = _userContext.TenantId;
            var today = DateTime.UtcNow.Date;

            // Raw aggregations
            var returnedEmptyTotal = await _tenantContext.OperationsUnloadings
                .Where(u => u.TenantId == tenantId)
                .SumAsync(u => u.ReturnedEmptyCount);

            var washedTotal = await _tenantContext.OperationsWashingLogs
                .Where(w => w.TenantId == tenantId)
                .SumAsync(w => w.WashedCount);

            var isolatedTotal = await _tenantContext.OperationsQuarantines
                .Where(q => q.TenantId == tenantId && q.Status == "Quarantined")
                .SumAsync(q => q.Quantity);

            var filledTotal = await _tenantContext.OperationsFillingLogs
                .Where(f => f.TenantId == tenantId)
                .SumAsync(f => f.FilledCount);

            var rejectedFillingTotal = await _tenantContext.OperationsFillingLogs
                .Where(f => f.TenantId == tenantId)
                .SumAsync(f => f.RejectedCount);

            var loadedTotal = await _tenantContext.OperationsLoadings
                .Where(l => l.TenantId == tenantId)
                .SumAsync(l => l.QuantityLoaded);

            var reservedFilledTotal = await _tenantContext.OperationsReservedJars
                .Where(r => r.TenantId == tenantId && r.Type == "Filled" && r.Status == "Pending")
                .SumAsync(r => r.Quantity);

            var reservedEmptyTotal = await _tenantContext.Customers
                .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                .SumAsync(c => c.ReservedEmptyJars);

            // Isolation Releases: older than 24 hours
            var cutoff = DateTime.UtcNow.AddHours(-24);
            var isolationPending = await _tenantContext.OperationsQuarantines
                .Where(q => q.TenantId == tenantId && q.Status == "Quarantined" && q.CreatedAt > cutoff)
                .SumAsync(q => q.Quantity);

            var isolationEndingToday = await _tenantContext.OperationsQuarantines
                .Where(q => q.TenantId == tenantId && q.Status == "Quarantined" && q.CreatedAt <= cutoff)
                .SumAsync(q => q.Quantity);

            // Inventory derived states
            var dirtyJars = Math.Max(0, returnedEmptyTotal - washedTotal - isolatedTotal);
            var cleanJars = Math.Max(0, washedTotal - filledTotal - rejectedFillingTotal);
            var filledStock = Math.Max(0, filledTotal - loadedTotal - reservedFilledTotal);

            // Daily metrics
            var todayReturns = await _tenantContext.OperationsUnloadings
                .Where(u => u.TenantId == tenantId && u.CreatedAt >= today)
                .SumAsync(u => u.ReturnedEmptyCount);

            var todayDispatch = await _tenantContext.OperationsLoadings
                .Where(l => l.TenantId == tenantId && l.CreatedAt >= today)
                .SumAsync(l => l.QuantityLoaded);

            var todayDamage = await _tenantContext.OperationsJarConditions
                .Where(c => c.TenantId == tenantId && c.CreatedAt >= today && c.ConditionType != "Normal")
                .SumAsync(c => c.Quantity);

            // Telemetry Quality Rates
            var leakages = await _tenantContext.OperationsFillingLogs
                .Where(f => f.TenantId == tenantId)
                .SumAsync(f => f.LeakageCount);

            double leakageRate = filledTotal > 0 ? (double)leakages / filledTotal * 100 : 0;
            double breakageRate = washedTotal > 0 ? (double)(rejectedFillingTotal + todayDamage) / washedTotal * 100 : 0;
            double recoveryRate = returnedEmptyTotal > 0 ? (double)(returnedEmptyTotal - todayDamage) / returnedEmptyTotal * 100 : 100;

            return Success<object>(new
            {
                dirtyJars,
                quarantineQueue = isolationPending,
                isolationEndingToday,
                cleanJars,
                filledStock,
                reservedFilled = reservedFilledTotal,
                reservedEmpty = reservedEmptyTotal,
                todayReturns,
                todayDispatch,
                todayDamage,
                leakageRate = Math.Round(leakageRate, 2),
                breakageRate = Math.Round(breakageRate, 2),
                recoveryRate = Math.Round(recoveryRate, 2)
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
    public class WashingLogDto
    {
        public int WashedCount { get; set; }
        public int RejectedCount { get; set; }
    }

    public class FillingLogDto
    {
        public Guid ProductId { get; set; }
        public Guid BrandId { get; set; }
        public int FilledCount { get; set; }
        public int RejectedCount { get; set; }
        public int LeakageCount { get; set; }
        public int CapFailureCount { get; set; }
        public int SealFailureCount { get; set; }
    }

    public class ReserveDto
    {
        public Guid DistributorId { get; set; }
        public int Quantity { get; set; }
        public string Type { get; set; } = "Empty"; // Empty, Filled
        public string Reason { get; set; } = string.Empty;
    }

    public class ClaimDto
    {
        public Guid DistributorId { get; set; }
        public string Type { get; set; } = "Empty";
    }
}
