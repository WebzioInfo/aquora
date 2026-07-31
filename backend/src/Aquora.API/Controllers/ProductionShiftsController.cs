using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/production-shifts")]
    public class ProductionShiftsController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ILogger<ProductionShiftsController> _logger;

        public ProductionShiftsController(
            ITenantDbContext tenantContext,
            ICurrentUserContext currentUserContext,
            ILogger<ProductionShiftsController> logger)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _logger = logger;
        }

        private Guid GetTenantId()
        {
            if (_currentUserContext != null && _currentUserContext.TenantId != Guid.Empty)
            {
                return _currentUserContext.TenantId;
            }

            var claim = User.FindFirst("tenant_id")?.Value 
                     ?? User.FindFirst("tenantId")?.Value 
                     ?? User.FindFirst("TenantId")?.Value;

            if (!string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out var tenantId))
            {
                return tenantId;
            }

            return Guid.Empty;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<ProductionShiftDto>>>> GetShifts()
        {
            var tenantId = Guid.Empty;
            try
            {
                tenantId = GetTenantId();

                var query = _tenantContext.ProductionShifts
                    .AsNoTracking()
                    .Where(s => !s.IsDeleted);

                if (tenantId != Guid.Empty)
                {
                    query = query.Where(s => s.TenantId == tenantId || s.TenantId == Guid.Empty);
                }

                var shifts = await query
                    .OrderBy(s => s.CreatedAt)
                    .Select(s => new ProductionShiftDto
                    {
                        Id = s.Id,
                        Name = s.Name,
                        StartTime = s.StartTime,
                        EndTime = s.EndTime,
                        Description = s.Description,
                        IsActive = s.IsActive,
                        TenantId = s.TenantId,
                        CreatedAt = s.CreatedAt
                    })
                    .ToListAsync();

                _logger.LogInformation("Retrieved {Count} Production Shifts for TenantId {TenantId}.", shifts.Count, tenantId);

                return Ok(ApiResponse<List<ProductionShiftDto>>.CreateSuccess(shifts ?? new List<ProductionShiftDto>(), shifts.Count > 0 ? "Production Shifts loaded successfully." : "No Production Shifts found."));
            }
            catch (Exception ex)
            {
                var errorMsg = $"[PRIMARY EXCEPTION] Message: {ex.Message}\nType: {ex.GetType().FullName}\nInner: {ex.InnerException?.Message}\nStack: {ex.StackTrace}";
                _logger.LogError(ex, "Primary EF query failed for Production Shifts (TenantId: {TenantId}). {ErrorMsg}", tenantId, errorMsg);
                
                try
                {
                    System.IO.File.WriteAllText("exception_log.txt", errorMsg);
                }
                catch (Exception fileEx)
                {
                    _logger.LogError(fileEx, "Failed to write primary exception to exception_log.txt");
                }

                try
                {
                    var sqlShifts = await _tenantContext.ProductionShifts
                        .FromSqlRaw("SELECT * FROM \"ProductionShifts\" WHERE \"IsDeleted\" = false")
                        .AsNoTracking()
                        .Select(s => new ProductionShiftDto
                        {
                            Id = s.Id,
                            Name = s.Name,
                            StartTime = s.StartTime,
                            EndTime = s.EndTime,
                            Description = s.Description,
                            IsActive = s.IsActive,
                            TenantId = s.TenantId,
                            CreatedAt = s.CreatedAt
                        })
                        .ToListAsync();

                    return Ok(ApiResponse<List<ProductionShiftDto>>.CreateSuccess(sqlShifts ?? new List<ProductionShiftDto>(), "Production Shifts loaded successfully."));
                }
                catch (Exception fallbackEx)
                {
                    var fallbackErrorMsg = $"[FALLBACK EXCEPTION] Message: {fallbackEx.Message}\nType: {fallbackEx.GetType().FullName}\nInner: {fallbackEx.InnerException?.Message}\nStack: {fallbackEx.StackTrace}";
                    _logger.LogError(fallbackEx, "Fallback retrieval also failed for Production Shifts. {FallbackErrorMsg}", fallbackErrorMsg);
                    
                    try
                    {
                        System.IO.File.WriteAllText("exception_log.txt", errorMsg + "\n\n" + fallbackErrorMsg);
                    }
                    catch (Exception fileEx)
                    {
                        _logger.LogError(fileEx, "Failed to write fallback exception to exception_log.txt");
                    }

                    return StatusCode(500, ApiResponse<List<ProductionShiftDto>>.CreateFailure(
                        new List<object> { ex.ToString(), fallbackEx.ToString() },
                        "Unable to load Production Shifts. Please try again."
                    ));
                }
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<ProductionShiftDto>>> CreateShift([FromBody] CreateProductionShiftDto request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userIdStr = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                
                // Validate input
                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Shift Name is required."));
                if (string.IsNullOrWhiteSpace(request.StartTime))
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Start Time is required."));
                if (string.IsNullOrWhiteSpace(request.EndTime))
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("End Time is required."));
                if (request.StartTime == request.EndTime)
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("End Time cannot equal Start Time."));

                // Check duplicate name
                var exists = await _tenantContext.ProductionShifts
                    .AnyAsync(s => !s.IsDeleted && (tenantId == Guid.Empty || s.TenantId == tenantId || s.TenantId == Guid.Empty) && s.Name.ToLower() == request.Name.Trim().ToLower());
                if (exists)
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("A Production Shift with this name already exists."));

                var shift = new ProductionShift
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CompanyId = tenantId,
                    Name = request.Name.Trim(),
                    StartTime = request.StartTime,
                    EndTime = request.EndTime,
                    Description = request.Description?.Trim(),
                    IsActive = request.IsActive,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userIdStr,
                    IsDeleted = false
                };

                _tenantContext.ProductionShifts.Add(shift);
                await _tenantContext.SaveChangesAsync();

                var dto = new ProductionShiftDto
                {
                    Id = shift.Id,
                    Name = shift.Name,
                    StartTime = shift.StartTime,
                    EndTime = shift.EndTime,
                    Description = shift.Description,
                    IsActive = shift.IsActive,
                    TenantId = shift.TenantId,
                    CreatedAt = shift.CreatedAt
                };

                _logger.LogInformation("Successfully created Production Shift '{ShiftName}' with ID {ShiftId} for TenantId {TenantId}.", shift.Name, shift.Id, tenantId);

                return Ok(ApiResponse<ProductionShiftDto>.CreateSuccess(dto, "Production Shift created successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while creating Production Shift '{ShiftName}'. Exception: {Message}, InnerException: {InnerMessage}, StackTrace: {StackTrace}", request?.Name, ex.Message, ex.InnerException?.Message, ex.StackTrace);
                return StatusCode(500, ApiResponse<ProductionShiftDto>.CreateFailure("Unable to save Production Shift. Please try again."));
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<ProductionShiftDto>>> UpdateShift(Guid id, [FromBody] UpdateProductionShiftDto request)
        {
            try
            {
                var tenantId = GetTenantId();
                if (tenantId == Guid.Empty)
                {
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Tenant context is required."));
                }

                var userIdStr = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

                var shift = await _tenantContext.ProductionShifts
                    .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);

                if (shift == null)
                    return NotFound(ApiResponse<ProductionShiftDto>.CreateFailure("Requested resource not found."));

                // Validate input
                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Shift Name is required."));
                if (string.IsNullOrWhiteSpace(request.StartTime))
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Start Time is required."));
                if (string.IsNullOrWhiteSpace(request.EndTime))
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("End Time is required."));
                if (request.StartTime == request.EndTime)
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("End Time cannot equal Start Time."));

                // Check duplicate name
                var exists = await _tenantContext.ProductionShifts
                    .AnyAsync(s => s.Id != id && !s.IsDeleted && s.TenantId == tenantId && s.Name.ToLower() == request.Name.Trim().ToLower());
                if (exists)
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("A shift with this name already exists."));

                shift.Name = request.Name.Trim();
                shift.StartTime = request.StartTime;
                shift.EndTime = request.EndTime;
                shift.Description = request.Description?.Trim();
                shift.IsActive = request.IsActive;
                shift.UpdatedAt = DateTime.UtcNow;
                shift.UpdatedBy = userIdStr;

                _tenantContext.ProductionShifts.Update(shift);
                await _tenantContext.SaveChangesAsync();

                var dto = new ProductionShiftDto
                {
                    Id = shift.Id,
                    Name = shift.Name,
                    StartTime = shift.StartTime,
                    EndTime = shift.EndTime,
                    Description = shift.Description,
                    IsActive = shift.IsActive,
                    TenantId = shift.TenantId,
                    CreatedAt = shift.CreatedAt
                };

                return Ok(ApiResponse<ProductionShiftDto>.CreateSuccess(dto, "Shift updated successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Production Shift {ShiftId}.", id);
                return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Unable to update Production Shift. Please try again."));
            }
        }

        [HttpPatch("{id}/status")]
        public async Task<ActionResult<ApiResponse<ProductionShiftDto>>> PatchStatus(Guid id, [FromBody] PatchProductionShiftStatusDto request)
        {
            try
            {
                var tenantId = GetTenantId();
                if (tenantId == Guid.Empty)
                {
                    return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Tenant context is required."));
                }

                var userIdStr = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

                var shift = await _tenantContext.ProductionShifts
                    .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);

                if (shift == null)
                    return NotFound(ApiResponse<ProductionShiftDto>.CreateFailure("Requested resource not found."));

                shift.IsActive = request.IsActive;
                shift.UpdatedAt = DateTime.UtcNow;
                shift.UpdatedBy = userIdStr;

                _tenantContext.ProductionShifts.Update(shift);
                await _tenantContext.SaveChangesAsync();

                var dto = new ProductionShiftDto
                {
                    Id = shift.Id,
                    Name = shift.Name,
                    StartTime = shift.StartTime,
                    EndTime = shift.EndTime,
                    Description = shift.Description,
                    IsActive = shift.IsActive,
                    TenantId = shift.TenantId,
                    CreatedAt = shift.CreatedAt
                };

                return Ok(ApiResponse<ProductionShiftDto>.CreateSuccess(dto, "Shift status updated successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while patching Production Shift status {ShiftId}.", id);
                return BadRequest(ApiResponse<ProductionShiftDto>.CreateFailure("Unable to update Production Shift status."));
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteShift(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                if (tenantId == Guid.Empty)
                {
                    return BadRequest(ApiResponse<bool>.CreateFailure("Tenant context is required."));
                }

                var userIdStr = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

                var shift = await _tenantContext.ProductionShifts
                    .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);

                if (shift == null)
                    return NotFound(ApiResponse<bool>.CreateFailure("Requested resource not found."));

                // Check if shift is used in production batches or entries
                var isUsedInBatches = await _tenantContext.ProductionBatches
                    .AnyAsync(b => b.TenantId == tenantId && b.Shift.ToLower() == shift.Name.ToLower());
                var isUsedInEntries = await _tenantContext.ProductionEntries
                    .AnyAsync(e => e.TenantId == tenantId && e.Shift.ToLower() == shift.Name.ToLower());

                if (isUsedInBatches || isUsedInEntries)
                {
                    return BadRequest(ApiResponse<bool>.CreateFailure($"Cannot delete '{shift.Name}' because active production batches or logs reference it."));
                }

                shift.IsDeleted = true;
                shift.DeletedAt = DateTime.UtcNow;
                shift.DeletedBy = userIdStr;

                _tenantContext.ProductionShifts.Update(shift);
                await _tenantContext.SaveChangesAsync();

                return Ok(ApiResponse<bool>.CreateSuccess(true, "Shift deleted successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Production Shift {ShiftId}.", id);
                return BadRequest(ApiResponse<bool>.CreateFailure("Unable to delete Production Shift. Please try again."));
            }
        }
    }

    // DTOs for the controller
    public class ProductionShiftDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; }
        public int EmployeesAssigned { get; set; }
        public Guid TenantId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateProductionShiftDto
    {
        public string Name { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class UpdateProductionShiftDto
    {
        public string Name { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; }
    }

    public class PatchProductionShiftStatusDto
    {
        public bool IsActive { get; set; }
    }
}
