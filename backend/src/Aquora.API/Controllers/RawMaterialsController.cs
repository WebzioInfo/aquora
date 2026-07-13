using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.DTOs.RawMaterials;
using Aquora.Domain.Entities;
using Aquora.Domain.Enums;
using Aquora.Shared.Models;

using Microsoft.Extensions.Logging;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class RawMaterialsController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ILogger<RawMaterialsController> _logger;

        public RawMaterialsController(
            ITenantDbContext tenantContext, 
            ICurrentUserContext currentUserContext,
            ILogger<RawMaterialsController> logger)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _logger = logger;
        }

        private bool IsAuthorizedToWrite()
        {
            var allowedRoles = new[] { "CompanyAdmin", "Admin", "Manager", "Accountant" };
            return _currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<RawMaterialDto>>>> GetRawMaterials(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? searchTerm = null)
        {
            try
            {
                var query = _tenantContext.RawMaterials
                    .Where(rm => !rm.IsDeleted)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var term = searchTerm.Trim().ToLower();
                    query = query.Where(rm => rm.Name.ToLower().Contains(term) || rm.Category.ToLower().Contains(term));
                }

                var totalCount = await query.CountAsync();
                var items = await query
                    .OrderByDescending(rm => rm.CreatedAt)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .Select(rm => new RawMaterialDto
                    {
                        Id = rm.Id,
                        Name = rm.Name,
                        Category = rm.Category,
                        Unit = rm.Unit,
                        IsActive = rm.IsActive,
                        CurrentStock = rm.CurrentStock,
                        CreatedAt = rm.CreatedAt,
                        UpdatedAt = rm.UpdatedAt
                    })
                    .ToListAsync();

                var pagedResult = new PagedResult<RawMaterialDto>(items, totalCount, pageNumber, pageSize);
                return Success(pagedResult, "Raw materials retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<PagedResult<RawMaterialDto>>(ex.Message, "Failed to retrieve raw materials.");
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ApiResponse<RawMaterialDto>>> GetRawMaterialById(Guid id)
        {
            try
            {
                var material = await _tenantContext.RawMaterials
                    .FirstOrDefaultAsync(rm => rm.Id == id && !rm.IsDeleted);

                if (material == null)
                {
                    return NotFound(ApiResponse<RawMaterialDto>.CreateFailure("Raw material not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var dto = new RawMaterialDto
                {
                    Id = material.Id,
                    Name = material.Name,
                    Category = material.Category,
                    Unit = material.Unit,
                    IsActive = material.IsActive,
                    CurrentStock = material.CurrentStock,
                    CreatedAt = material.CreatedAt,
                    UpdatedAt = material.UpdatedAt
                };

                return Success(dto, "Raw material retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<RawMaterialDto>(ex.Message, "Failed to retrieve raw material.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<RawMaterialDto>>> CreateRawMaterial([FromBody] CreateRawMaterialDto request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<RawMaterialDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            Company? company = null;
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("Raw material name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (!Enum.TryParse<RawMaterialCategory>(request.Category.ToUpperInvariant(), out var categoryEnum))
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure($"Invalid category. Allowed values: {string.Join(", ", Enum.GetNames(typeof(RawMaterialCategory)))}", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (!Enum.TryParse<RawMaterialUnit>(request.Unit.ToUpperInvariant(), out var unitEnum))
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure($"Invalid unit. Allowed values: {string.Join(", ", Enum.GetNames(typeof(RawMaterialUnit)))}", "Validation Error", HttpContext.TraceIdentifier));
                }

                company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("Tenant configurations are incomplete. Company is missing.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var trimmedName = request.Name.Trim();
                var nameExists = await _tenantContext.RawMaterials
                    .AnyAsync(rm => rm.CompanyId == company.Id && rm.Name.ToLower() == trimmedName.ToLower() && !rm.IsDeleted);
                if (nameExists)
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("A raw material with this name already exists in this company.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var dbContext = _tenantContext as DbContext;
                if (dbContext == null)
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
                }

                using var transaction = await dbContext.Database.BeginTransactionAsync();
                try
                {
                    var rawMaterial = new RawMaterial
                    {
                        Id = Guid.NewGuid(),
                        Name = trimmedName,
                        Category = categoryEnum.ToString(),
                        Unit = unitEnum.ToString(),
                        IsActive = request.IsActive,
                        CompanyId = company.Id,
                        // Populate legacy fields required by db constraints
                        Code = trimmedName.Replace(" ", "_").ToUpperInvariant(),
                        BaseUnit = unitEnum.ToString(),
                        ConversionFactor = 1.0m,
                        CurrentStock = request.CurrentStock
                    };

                    _tenantContext.RawMaterials.Add(rawMaterial);

                    // Every stock modification must create one ledger entry
                    var movement = new InventoryMovement
                    {
                        Id = Guid.NewGuid(),
                        RawMaterialId = rawMaterial.Id,
                        Quantity = request.CurrentStock,
                        ReferenceType = "OpeningStock",
                        ReferenceId = rawMaterial.Id,
                        TenantId = _currentUserContext.TenantId,
                        CompanyId = company.Id,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = _currentUserContext.UserId?.ToString() ?? "System"
                    };
                    _tenantContext.InventoryMovements.Add(movement);

                    await _tenantContext.SaveChangesAsync();
                    await transaction.CommitAsync();

                    var dto = new RawMaterialDto
                    {
                        Id = rawMaterial.Id,
                        Name = rawMaterial.Name,
                        Category = rawMaterial.Category,
                        Unit = rawMaterial.Unit,
                        IsActive = rawMaterial.IsActive,
                        CurrentStock = rawMaterial.CurrentStock,
                        CreatedAt = rawMaterial.CreatedAt,
                        UpdatedAt = rawMaterial.UpdatedAt
                    };

                    return Success(dto, "Raw material created successfully.");
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
            catch (DbUpdateException ex)
            {
                var innerMsg = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError(ex, "RawMaterial creation database save failed. Tenant: {TenantId}, Company: {CompanyId}, Name: {Name}, Error: {Error}",
                    _currentUserContext.TenantId, company?.Id, request.Name, innerMsg);

                return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure(
                    $"Database constraint failed: {innerMsg}", 
                    "Database Error", 
                    HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RawMaterial creation failed due to unexpected error. Tenant: {TenantId}, Company: {CompanyId}, Name: {Name}",
                    _currentUserContext.TenantId, company?.Id, request.Name);

                return StatusCode(500, ApiResponse<RawMaterialDto>.CreateFailure(
                    ex.Message, 
                    "Unexpected Error", 
                    HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<ApiResponse<RawMaterialDto>>> UpdateRawMaterial(Guid id, [FromBody] UpdateRawMaterialDto request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<RawMaterialDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            Company? company = null;
            try
            {
                var rawMaterial = await _tenantContext.RawMaterials.FirstOrDefaultAsync(rm => rm.Id == id && !rm.IsDeleted);
                if (rawMaterial == null)
                {
                    return NotFound(ApiResponse<RawMaterialDto>.CreateFailure("Raw material not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("Raw material name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (!Enum.TryParse<RawMaterialCategory>(request.Category.ToUpperInvariant(), out var categoryEnum))
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure($"Invalid category. Allowed values: {string.Join(", ", Enum.GetNames(typeof(RawMaterialCategory)))}", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (!Enum.TryParse<RawMaterialUnit>(request.Unit.ToUpperInvariant(), out var unitEnum))
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure($"Invalid unit. Allowed values: {string.Join(", ", Enum.GetNames(typeof(RawMaterialUnit)))}", "Validation Error", HttpContext.TraceIdentifier));
                }

                company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("Tenant configurations are incomplete. Company is missing.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var trimmedName = request.Name.Trim();
                var nameExists = await _tenantContext.RawMaterials
                    .AnyAsync(rm => rm.Id != id && rm.CompanyId == company.Id && rm.Name.ToLower() == trimmedName.ToLower() && !rm.IsDeleted);
                if (nameExists)
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("A raw material with this name already exists in this company.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var tenantId = _currentUserContext.TenantId;
                var userIdStr = _currentUserContext.UserId?.ToString() ?? "System";

                var dbContext = _tenantContext as DbContext;
                if (dbContext == null)
                {
                    return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
                }

                using var transaction = await dbContext.Database.BeginTransactionAsync();
                try
                {
                    rawMaterial.Name = trimmedName;
                    rawMaterial.Category = categoryEnum.ToString();
                    rawMaterial.Unit = unitEnum.ToString();
                    rawMaterial.IsActive = request.IsActive;
                    rawMaterial.CompanyId = company.Id;

                    if (request.CurrentStock.HasValue && request.CurrentStock.Value != rawMaterial.CurrentStock)
                    {
                        decimal diff = request.CurrentStock.Value - rawMaterial.CurrentStock;
                        rawMaterial.CurrentStock = request.CurrentStock.Value;
                        
                        var movement = new InventoryMovement
                        {
                            Id = Guid.NewGuid(),
                            RawMaterialId = rawMaterial.Id,
                            Quantity = diff,
                            ReferenceType = "StockAdjustment",
                            ReferenceId = rawMaterial.Id,
                            TenantId = tenantId,
                            CompanyId = company.Id,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = userIdStr
                        };
                        _tenantContext.InventoryMovements.Add(movement);
                    }
                    else if (request.StockAdjustment.HasValue && request.StockAdjustment.Value != 0)
                    {
                        rawMaterial.CurrentStock += request.StockAdjustment.Value;
                        
                        var movement = new InventoryMovement
                        {
                            Id = Guid.NewGuid(),
                            RawMaterialId = rawMaterial.Id,
                            Quantity = request.StockAdjustment.Value,
                            ReferenceType = "StockAdjustment",
                            ReferenceId = rawMaterial.Id,
                            TenantId = tenantId,
                            CompanyId = company.Id,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = userIdStr
                        };
                        _tenantContext.InventoryMovements.Add(movement);
                    }

                    await _tenantContext.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                var dto = new RawMaterialDto
                {
                    Id = rawMaterial.Id,
                    Name = rawMaterial.Name,
                    Category = rawMaterial.Category,
                    Unit = rawMaterial.Unit,
                    IsActive = rawMaterial.IsActive,
                    CurrentStock = rawMaterial.CurrentStock,
                    CreatedAt = rawMaterial.CreatedAt,
                    UpdatedAt = rawMaterial.UpdatedAt
                };

                return Success(dto, "Raw material updated successfully.");
            }
            catch (DbUpdateException ex)
            {
                var innerMsg = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError(ex, "RawMaterial update database save failed. Tenant: {TenantId}, Company: {CompanyId}, Name: {Name}, Error: {Error}",
                    _currentUserContext.TenantId, company?.Id, request.Name, innerMsg);

                return BadRequest(ApiResponse<RawMaterialDto>.CreateFailure(
                    $"Database constraint failed: {innerMsg}", 
                    "Database Error", 
                    HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RawMaterial update failed due to unexpected error. Tenant: {TenantId}, Company: {CompanyId}, Name: {Name}",
                    _currentUserContext.TenantId, company?.Id, request.Name);

                return StatusCode(500, ApiResponse<RawMaterialDto>.CreateFailure(
                    ex.Message, 
                    "Unexpected Error", 
                    HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteRawMaterial(Guid id)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<bool>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var rawMaterial = await _tenantContext.RawMaterials.FirstOrDefaultAsync(rm => rm.Id == id && !rm.IsDeleted);
                if (rawMaterial == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Raw material not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                rawMaterial.IsDeleted = true;
                await _tenantContext.SaveChangesAsync();

                return Success(true, "Raw material deleted successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to delete raw material.");
            }
        }

        /// <summary>
        /// Returns paginated inventory movements for a specific raw material,
        /// including a running stock balance computed across all movements (chronological order).
        /// Movement history is lazily loaded — only fetched when the user expands a specific item row.
        /// </summary>
        [HttpGet("{id:guid}/movements")]
        public async Task<ActionResult<ApiResponse<PagedResult<InventoryMovementDto>>>> GetMovements(
            Guid id,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var material = await _tenantContext.RawMaterials.FirstOrDefaultAsync(rm => rm.Id == id && !rm.IsDeleted);
                if (material == null)
                    return NotFound(ApiResponse<PagedResult<InventoryMovementDto>>.CreateFailure("Raw material not found.", "Not Found", HttpContext.TraceIdentifier));

                // Compute ALL movements in chronological order for running balance
                var allMovements = await _tenantContext.InventoryMovements
                    .Where(m => m.RawMaterialId == id && !m.IsDeleted)
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => new
                    {
                        m.Id,
                        m.Quantity,
                        m.ReferenceType,
                        m.ReferenceId,
                        m.CreatedAt,
                        m.CreatedBy
                    })
                    .ToListAsync();

                // Compute running balance prefix-sum
                decimal runningBalance = 0;
                var withBalance = allMovements.Select(m =>
                {
                    runningBalance += m.Quantity;
                    return new InventoryMovementDto
                    {
                        Id = m.Id,
                        Quantity = m.Quantity,
                        ReferenceType = m.ReferenceType ?? "Unknown",
                        ReferenceId = m.ReferenceId,
                        BalanceAfter = runningBalance,
                        CreatedAt = m.CreatedAt,
                        CreatedBy = m.CreatedBy ?? "System",
                        Unit = material.Unit
                    };
                }).ToList();

                // Reverse so latest movement appears first for UI display
                withBalance.Reverse();

                var totalCount = withBalance.Count;
                var paged = withBalance
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                var result = new PagedResult<InventoryMovementDto>(paged, totalCount, pageNumber, pageSize);
                return Success(result, "Inventory movements retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<PagedResult<InventoryMovementDto>>(ex.Message, "Failed to retrieve inventory movements.");
            }
        }

        [HttpGet("settings")]
        public async Task<ActionResult<ApiResponse<InventorySettingsDto>>> GetInventorySettings()
        {
            var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) return BadRequest(ApiResponse<InventorySettingsDto>.CreateFailure("Company context missing.", "Error", HttpContext.TraceIdentifier));
            
            var settings = await GetInventorySettingsAsync(company.Id);
            return Success(settings, "Inventory settings loaded successfully.");
        }

        [HttpPost("settings")]
        public async Task<ActionResult<ApiResponse<InventorySettingsDto>>> UpdateInventorySettings([FromBody] InventorySettingsDto request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<InventorySettingsDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
            if (company == null) return BadRequest(ApiResponse<InventorySettingsDto>.CreateFailure("Company context missing.", "Error", HttpContext.TraceIdentifier));

            var dir = Path.Combine(AppContext.BaseDirectory, "settings");
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            var filePath = Path.Combine(dir, $"inventory-settings-{company.Id}.json");
            var json = System.Text.Json.JsonSerializer.Serialize(request);
            await System.IO.File.WriteAllTextAsync(filePath, json);

            return Success(request, "Inventory settings updated successfully.");
        }

        private async Task<InventorySettingsDto> GetInventorySettingsAsync(Guid companyId)
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "settings");
            var filePath = Path.Combine(dir, $"inventory-settings-{companyId}.json");
            if (System.IO.File.Exists(filePath))
            {
                try
                {
                    var json = await System.IO.File.ReadAllTextAsync(filePath);
                    return System.Text.Json.JsonSerializer.Deserialize<InventorySettingsDto>(json) ?? new InventorySettingsDto();
                }
                catch
                {
                    // Fallback
                }
            }

            var defaultInk = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Category == "INK" && m.IsActive && !m.IsDeleted);
            var defaultMakeup = await _tenantContext.RawMaterials.FirstOrDefaultAsync(m => m.Category == "MAKEUP" && m.IsActive && !m.IsDeleted);

            return new InventorySettingsDto
            {
                DefaultInkMaterialId = defaultInk?.Id,
                DefaultMakeupMaterialId = defaultMakeup?.Id
            };
        }
    }


    public class InventorySettingsDto
    {
        public Guid? DefaultInkMaterialId { get; set; }
        public Guid? DefaultMakeupMaterialId { get; set; }
    }

    public class InventoryMovementDto
    {
        public Guid Id { get; set; }
        public decimal Quantity { get; set; }
        public string ReferenceType { get; set; } = string.Empty;
        public Guid ReferenceId { get; set; }
        public decimal BalanceAfter { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
    }
}

