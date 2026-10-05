using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces;
using Aquora.Application.DTOs.CaseConfiguration;
using Aquora.Domain.Entities;
using Aquora.Persistence.Context;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/case-configurations")]
    [Route("api/v1/[controller]")]
    public class CaseConfigurationsController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly ITenantProvider _tenantProvider;
        private readonly ILogger<CaseConfigurationsController> _logger;

        public CaseConfigurationsController(
            ITenantDbContext tenantContext,
            ICurrentUserContext currentUserContext,
            ITenantProvider tenantProvider,
            ILogger<CaseConfigurationsController> logger)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _tenantProvider = tenantProvider;
            _logger = logger;
        }

        private bool IsAuthorizedToWrite()
        {
            var allowedRoles = new[] { "Owner", "CompanyOwner", "SuperAdmin", "PlatformAdmin", "CompanyAdmin", "Accountant", "Admin", "Manager" };
            return _currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
        }

        private static readonly HashSet<string> _ensuredSchemas = new();

        private async Task EnsureSchemaAsync()
        {
            try
            {
                var conn = _tenantContext.Database.GetDbConnection();
                var currentSchema = _tenantProvider.TenantSchemaName;
                if (string.IsNullOrWhiteSpace(currentSchema))
                {
                    currentSchema = TenantSchemaResolver.CurrentSchemaName ?? "public";
                }

                if (_ensuredSchemas.Contains(currentSchema)) return;

                if (conn.State != System.Data.ConnectionState.Open)
                {
                    await conn.OpenAsync();
                }

                using (var cmd = conn.CreateCommand())
                {
                    var sql = $@"
                        CREATE TABLE IF NOT EXISTS ""{currentSchema}"".""CaseConfigurations"" (
                            ""Id"" uuid NOT NULL PRIMARY KEY,
                            ""Name"" text NOT NULL DEFAULT '',
                            ""IsActive"" boolean NOT NULL DEFAULT true,
                            ""ProductId"" uuid NULL,
                            ""UnitsPerCase"" integer NOT NULL DEFAULT 24,
                            ""TenantId"" uuid NOT NULL,
                            ""CompanyId"" uuid NOT NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ""CreatedBy"" text NOT NULL DEFAULT 'System',
                            ""UpdatedAt"" timestamp with time zone NULL,
                            ""UpdatedBy"" text NULL,
                            ""CreatedByIP"" text NULL,
                            ""UpdatedByIP"" text NULL,
                            ""IsDeleted"" boolean NOT NULL DEFAULT false,
                            ""DeletedAt"" timestamp with time zone NULL,
                            ""DeletedBy"" text NULL
                        );

                        ALTER TABLE ""{currentSchema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""ProductId"" uuid NULL;
                        ALTER TABLE ""{currentSchema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""UnitsPerCase"" integer NOT NULL DEFAULT 24;
                        ALTER TABLE ""{currentSchema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Name"" text NOT NULL DEFAULT '';
                        ALTER TABLE ""{currentSchema}"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;
                    ";

                    if (!string.Equals(currentSchema, "public", StringComparison.OrdinalIgnoreCase))
                    {
                        sql += $@"
                            CREATE TABLE IF NOT EXISTS ""public"".""CaseConfigurations"" (
                                ""Id"" uuid NOT NULL PRIMARY KEY,
                                ""Name"" text NOT NULL DEFAULT '',
                                ""Description"" text NULL,
                                ""IsActive"" boolean NOT NULL DEFAULT true,
                                ""ProductId"" uuid NULL,
                                ""UnitsPerCase"" integer NOT NULL DEFAULT 24,
                                ""TenantId"" uuid NOT NULL,
                                ""CompanyId"" uuid NOT NULL,
                                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                ""CreatedBy"" text NOT NULL DEFAULT 'System',
                                ""UpdatedAt"" timestamp with time zone NULL,
                                ""UpdatedBy"" text NULL,
                                ""CreatedByIP"" text NULL,
                                ""UpdatedByIP"" text NULL,
                                ""IsDeleted"" boolean NOT NULL DEFAULT false,
                                ""DeletedAt"" timestamp with time zone NULL,
                                ""DeletedBy"" text NULL
                            );

                            ALTER TABLE ""public"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""ProductId"" uuid NULL;
                            ALTER TABLE ""public"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""UnitsPerCase"" integer NOT NULL DEFAULT 24;
                            ALTER TABLE ""public"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Name"" text NOT NULL DEFAULT '';
                            ALTER TABLE ""public"".""CaseConfigurations"" ADD COLUMN IF NOT EXISTS ""Description"" text NULL;
                        ";
                    }

                    cmd.CommandText = sql;
                    await cmd.ExecuteNonQueryAsync();
                }

                _ensuredSchemas.Add(currentSchema);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[CaseConfigurations] EnsureSchemaAsync warning: {Message}", ex.Message);
            }
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<CaseConfigurationDto>>>> GetCaseConfigurations([FromQuery] bool includeInactive = true)
        {
            try
            {
                await EnsureSchemaAsync();

                var query = _tenantContext.CaseConfigurations
                    .Include(c => c.Product)
                    .AsNoTracking()
                    .Where(c => !c.IsDeleted);

                if (!includeInactive)
                {
                    query = query.Where(c => c.IsActive);
                }

                var items = await query
                    .OrderByDescending(c => c.IsActive)
                    .ThenBy(c => c.Product.Name)
                    .ThenBy(c => c.UnitsPerCase)
                    .Select(c => new CaseConfigurationDto
                    {
                        Id = c.Id,
                        ProductId = c.ProductId,
                        ProductName = c.Product != null ? c.Product.Name : "Unknown Product",
                        ProductSku = c.Product != null ? c.Product.SKU : null,
                        Name = !string.IsNullOrWhiteSpace(c.Name) ? c.Name : (c.Product != null ? $"{c.Product.Name} - {c.UnitsPerCase} Units/Case" : $"{c.UnitsPerCase} Units/Case"),
                        Description = c.Description,
                        UnitsPerCase = c.UnitsPerCase > 0 ? c.UnitsPerCase : 24,
                        IsActive = c.IsActive,
                        CreatedAt = c.CreatedAt,
                        UpdatedAt = c.UpdatedAt
                    })
                    .ToListAsync();

                return Success(items, "Case configurations retrieved successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving case configurations.");
                return Failure<List<CaseConfigurationDto>>(ex.Message, "Failed to retrieve case configurations.");
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ApiResponse<CaseConfigurationDto>>> GetCaseConfigurationById(Guid id)
        {
            try
            {
                await EnsureSchemaAsync();

                var config = await _tenantContext.CaseConfigurations
                    .Include(c => c.Product)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

                if (config == null)
                {
                    return NotFound(ApiResponse<CaseConfigurationDto>.CreateFailure("Case configuration not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var dto = new CaseConfigurationDto
                {
                    Id = config.Id,
                    ProductId = config.ProductId,
                    ProductName = config.Product != null ? config.Product.Name : "Unknown Product",
                    ProductSku = config.Product != null ? config.Product.SKU : null,
                    Name = !string.IsNullOrWhiteSpace(config.Name) ? config.Name : $"{config.UnitsPerCase} Units/Case",
                    Description = config.Description,
                    UnitsPerCase = config.UnitsPerCase > 0 ? config.UnitsPerCase : 24,
                    IsActive = config.IsActive,
                    CreatedAt = config.CreatedAt,
                    UpdatedAt = config.UpdatedAt
                };

                return Success(dto, "Case configuration retrieved successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving case configuration {Id}", id);
                return Failure<CaseConfigurationDto>(ex.Message, "Failed to retrieve case configuration.");
            }
        }

        [HttpGet("product/{productId:guid}")]
        public async Task<ActionResult<ApiResponse<CaseConfigurationDto>>> GetByProductId(Guid productId)
        {
            try
            {
                await EnsureSchemaAsync();

                var config = await _tenantContext.CaseConfigurations
                    .Include(c => c.Product)
                    .AsNoTracking()
                    .Where(c => c.ProductId == productId && c.IsActive && !c.IsDeleted)
                    .OrderByDescending(c => c.CreatedAt)
                    .FirstOrDefaultAsync();

                if (config == null)
                {
                    return NotFound(ApiResponse<CaseConfigurationDto>.CreateFailure("Active case configuration for product not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var dto = new CaseConfigurationDto
                {
                    Id = config.Id,
                    ProductId = config.ProductId,
                    ProductName = config.Product != null ? config.Product.Name : "Unknown Product",
                    ProductSku = config.Product != null ? config.Product.SKU : null,
                    Name = !string.IsNullOrWhiteSpace(config.Name) ? config.Name : $"{config.UnitsPerCase} Units/Case",
                    Description = config.Description,
                    UnitsPerCase = config.UnitsPerCase > 0 ? config.UnitsPerCase : 24,
                    IsActive = config.IsActive,
                    CreatedAt = config.CreatedAt,
                    UpdatedAt = config.UpdatedAt
                };

                return Success(dto, "Active product case configuration retrieved successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving case configuration for product {ProductId}", productId);
                return Failure<CaseConfigurationDto>(ex.Message, "Failed to retrieve case configuration.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<CaseConfigurationDto>>> CreateCaseConfiguration([FromBody] CreateCaseConfigurationDto request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<CaseConfigurationDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                await EnsureSchemaAsync();

                if (request.UnitsPerCase <= 0)
                {
                    return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure("Units per case must be a positive integer greater than 0.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var product = await _tenantContext.Products
                    .FirstOrDefaultAsync(p => p.Id == request.ProductId && !p.IsDeleted);

                if (product == null)
                {
                    return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure("Selected product does not exist or has been deleted.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure("Active company record not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var trimmedName = string.IsNullOrWhiteSpace(request.Name)
                    ? $"{product.Name} - {request.UnitsPerCase} Units/Case"
                    : request.Name.Trim();

                var trimmedDesc = string.IsNullOrWhiteSpace(request.Description)
                    ? null
                    : request.Description.Trim();

                // Duplicate Protection: Check if identical configuration already exists for this product
                var existingDuplicate = await _tenantContext.CaseConfigurations
                    .FirstOrDefaultAsync(c => c.ProductId == request.ProductId
                                && !c.IsDeleted
                                && (c.UnitsPerCase == request.UnitsPerCase || c.Name.ToLower() == trimmedName.ToLower()));

                if (existingDuplicate != null)
                {
                    if (!existingDuplicate.IsActive)
                    {
                        // Reactivate previously deactivated configuration
                        existingDuplicate.IsActive = request.IsActive;
                        existingDuplicate.Name = trimmedName;
                        existingDuplicate.UnitsPerCase = request.UnitsPerCase;
                        existingDuplicate.Description = trimmedDesc;
                        existingDuplicate.UpdatedAt = DateTime.UtcNow;
                        existingDuplicate.UpdatedBy = _currentUserContext.UserId?.ToString() ?? "System";
                        await _tenantContext.SaveChangesAsync();

                        var reactivatedDto = new CaseConfigurationDto
                        {
                            Id = existingDuplicate.Id,
                            ProductId = product.Id,
                            ProductName = product.Name,
                            ProductSku = product.SKU,
                            Name = existingDuplicate.Name,
                            Description = existingDuplicate.Description,
                            UnitsPerCase = existingDuplicate.UnitsPerCase,
                            IsActive = existingDuplicate.IsActive,
                            CreatedAt = existingDuplicate.CreatedAt,
                            UpdatedAt = existingDuplicate.UpdatedAt
                        };
                        return Success(reactivatedDto, "Case configuration reactivated successfully.");
                    }

                    return Conflict(ApiResponse<CaseConfigurationDto>.CreateFailure(
                        "An identical case configuration already exists.",
                        "An identical case configuration already exists.",
                        HttpContext.TraceIdentifier));
                }

                var config = new CaseConfiguration
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    UnitsPerCase = request.UnitsPerCase,
                    Name = trimmedName,
                    Description = trimmedDesc,
                    IsActive = request.IsActive,
                    TenantId = _currentUserContext.TenantId,
                    CompanyId = company.Id,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = _currentUserContext.UserId?.ToString() ?? "System"
                };

                _tenantContext.CaseConfigurations.Add(config);
                await _tenantContext.SaveChangesAsync();

                var dto = new CaseConfigurationDto
                {
                    Id = config.Id,
                    ProductId = product.Id,
                    ProductName = product.Name,
                    ProductSku = product.SKU,
                    Name = config.Name,
                    Description = config.Description,
                    UnitsPerCase = config.UnitsPerCase,
                    IsActive = config.IsActive,
                    CreatedAt = config.CreatedAt,
                    UpdatedAt = config.UpdatedAt
                };

                return CreatedAtAction(nameof(GetCaseConfigurationById), new { id = config.Id }, ApiResponse<CaseConfigurationDto>.CreateSuccess(dto, "Case configuration created successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while creating case configuration.");
                return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure(ex.Message, "Failed to create case configuration.", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<ActionResult<ApiResponse<CaseConfigurationDto>>> UpdateCaseConfiguration(Guid id, [FromBody] UpdateCaseConfigurationDto request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<CaseConfigurationDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                await EnsureSchemaAsync();

                if (request.UnitsPerCase <= 0)
                {
                    return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure("Units per case must be a positive integer greater than zero.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var config = await _tenantContext.CaseConfigurations
                    .Include(c => c.Product)
                    .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

                if (config == null)
                {
                    return NotFound(ApiResponse<CaseConfigurationDto>.CreateFailure("Case configuration not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // If ProductId changed, ensure selected product exists
                if (request.ProductId.HasValue && request.ProductId.Value != config.ProductId)
                {
                    var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId.Value && !p.IsDeleted);
                    if (product == null)
                    {
                        return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure("Selected product does not exist.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                    config.ProductId = product.Id;
                    config.Product = product;
                }

                var targetProductId = request.ProductId ?? config.ProductId;
                var trimmedName = !string.IsNullOrWhiteSpace(request.Name)
                    ? request.Name.Trim()
                    : config.Name;

                // Check duplicate if units or name is changing
                var duplicate = await _tenantContext.CaseConfigurations
                    .AnyAsync(c => c.Id != id 
                                && c.ProductId == targetProductId 
                                && !c.IsDeleted 
                                && (c.UnitsPerCase == request.UnitsPerCase || c.Name.ToLower() == trimmedName.ToLower()));

                if (duplicate)
                {
                    return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure(
                        "An identical case configuration already exists.",
                        "Duplicate Configuration",
                        HttpContext.TraceIdentifier));
                }

                config.UnitsPerCase = request.UnitsPerCase;
                config.Name = trimmedName;
                if (request.Description != null)
                {
                    config.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
                }

                if (request.IsActive.HasValue)
                {
                    config.IsActive = request.IsActive.Value;
                }
                config.UpdatedAt = DateTime.UtcNow;
                config.UpdatedBy = _currentUserContext.UserId?.ToString() ?? "System";

                await _tenantContext.SaveChangesAsync();

                var dto = new CaseConfigurationDto
                {
                    Id = config.Id,
                    ProductId = config.ProductId,
                    ProductName = config.Product != null ? config.Product.Name : "Unknown Product",
                    ProductSku = config.Product != null ? config.Product.SKU : null,
                    Name = config.Name,
                    Description = config.Description,
                    UnitsPerCase = config.UnitsPerCase,
                    IsActive = config.IsActive,
                    CreatedAt = config.CreatedAt,
                    UpdatedAt = config.UpdatedAt
                };

                return Success(dto, "Case configuration updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while updating case configuration {Id}", id);
                return BadRequest(ApiResponse<CaseConfigurationDto>.CreateFailure(ex.Message, "Failed to update case configuration.", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteCaseConfiguration(Guid id)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<bool>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var config = await _tenantContext.CaseConfigurations.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
                if (config == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Case configuration not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                config.IsActive = false;
                config.IsDeleted = true;
                config.DeletedAt = DateTime.UtcNow;
                config.DeletedBy = _currentUserContext.UserId?.ToString() ?? "System";

                await _tenantContext.SaveChangesAsync();
                return Success(true, "Case configuration deactivated/deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while deleting case configuration {Id}", id);
                return Failure<bool>(ex.Message, "Failed to delete case configuration.");
            }
        }
    }
}
