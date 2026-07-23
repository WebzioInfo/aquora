using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

        public ProductionShiftsController(
            ITenantDbContext tenantContext,
            ICurrentUserContext currentUserContext)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
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

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<ProductionShiftDto>>>> GetShifts()
        {
            var tenantId = GetTenantId();
            
            var shifts = await _tenantContext.ProductionShifts
                .Where(s => !s.IsDeleted && s.TenantId == tenantId)
                .OrderBy(s => s.CreatedAt)
                .Select(s => new ProductionShiftDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime,
                    IsActive = s.IsActive,
                    TenantId = s.TenantId,
                    CreatedAt = s.CreatedAt
                })
                .ToListAsync();

            return Ok(ApiResponse<List<ProductionShiftDto>>.CreateSuccess(shifts));
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<ProductionShiftDto>>> CreateShift([FromBody] CreateProductionShiftDto request)
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
                .AnyAsync(s => !s.IsDeleted && s.TenantId == tenantId && s.Name.ToLower() == request.Name.ToLower());
            if (exists)
                return Conflict(ApiResponse<ProductionShiftDto>.CreateFailure("A shift with this name already exists."));

            var shift = new ProductionShift
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CompanyId = tenantId, // Root company
                Name = request.Name.Trim(),
                StartTime = request.StartTime,
                EndTime = request.EndTime,
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
                IsActive = shift.IsActive,
                TenantId = shift.TenantId,
                CreatedAt = shift.CreatedAt
            };

            return Ok(ApiResponse<ProductionShiftDto>.CreateSuccess(dto, "Shift created successfully."));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<ProductionShiftDto>>> UpdateShift(Guid id, [FromBody] UpdateProductionShiftDto request)
        {
            var tenantId = GetTenantId();
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
                .AnyAsync(s => s.Id != id && !s.IsDeleted && s.TenantId == tenantId && s.Name.ToLower() == request.Name.ToLower());
            if (exists)
                return Conflict(ApiResponse<ProductionShiftDto>.CreateFailure("A shift with this name already exists."));

            shift.Name = request.Name.Trim();
            shift.StartTime = request.StartTime;
            shift.EndTime = request.EndTime;
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
                IsActive = shift.IsActive,
                TenantId = shift.TenantId,
                CreatedAt = shift.CreatedAt
            };

            return Ok(ApiResponse<ProductionShiftDto>.CreateSuccess(dto, "Shift updated successfully."));
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteShift(Guid id)
        {
            var tenantId = GetTenantId();
            var userIdStr = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            var shift = await _tenantContext.ProductionShifts
                .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == tenantId && !s.IsDeleted);

            if (shift == null)
                return NotFound(ApiResponse<bool>.CreateFailure("Requested resource not found."));

            shift.IsDeleted = true;
            shift.DeletedAt = DateTime.UtcNow;
            shift.DeletedBy = userIdStr;

            _tenantContext.ProductionShifts.Update(shift);
            await _tenantContext.SaveChangesAsync();

            return Ok(ApiResponse<bool>.CreateSuccess(true, "Shift deleted successfully."));
        }
    }

    // DTOs for the controller
    public class ProductionShiftDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string StartTime { get; set; }
        public string EndTime { get; set; }
        public bool IsActive { get; set; }
        public Guid TenantId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateProductionShiftDto
    {
        public string Name { get; set; }
        public string StartTime { get; set; }
        public string EndTime { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class UpdateProductionShiftDto
    {
        public string Name { get; set; }
        public string StartTime { get; set; }
        public string EndTime { get; set; }
        public bool IsActive { get; set; }
    }
}
