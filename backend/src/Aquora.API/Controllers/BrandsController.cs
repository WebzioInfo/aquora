using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.DTOs.Products;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;
using System.Collections.Generic;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class BrandsController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;

        public BrandsController(ITenantDbContext tenantContext, ICurrentUserContext currentUserContext)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
        }

        private bool IsAuthorizedToWrite()
        {
            var allowedRoles = new[] { "CompanyAdmin", "Admin", "Manager", "Accountant" };
            return _currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<BrandDto>>>> GetBrands(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? searchTerm = null)
        {
            try
            {
                var query = _tenantContext.Brands.Where(b => !b.IsDeleted).AsQueryable();
                
                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var term = searchTerm.Trim().ToLower();
                    query = query.Where(b => b.Name.ToLower().Contains(term) || (b.Code != null && b.Code.ToLower().Contains(term)));
                }
                
                var totalCount = await query.CountAsync();
                var items = await query
                    .OrderByDescending(b => b.CreatedAt)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .Select(b => new BrandDto
                    {
                        Id = b.Id,
                        Name = b.Name,
                        Code = b.Code,
                        Description = b.Description,
                        IsActive = b.IsActive,
                        CreatedAt = b.CreatedAt
                    })
                    .ToListAsync();

                var pagedResult = new PagedResult<BrandDto>(items, totalCount, pageNumber, pageSize);
                return Success(pagedResult, "Brands retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<PagedResult<BrandDto>>(ex.Message, "Failed to retrieve brands.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<BrandDto>>> GetBrandById(Guid id)
        {
            try
            {
                var brand = await _tenantContext.Brands.FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted);

                if (brand == null)
                {
                    return NotFound(ApiResponse<BrandDto>.CreateFailure("Brand not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var dto = new BrandDto
                {
                    Id = brand.Id,
                    Name = brand.Name,
                    Code = brand.Code,
                    Description = brand.Description,
                    IsActive = brand.IsActive,
                    CreatedAt = brand.CreatedAt
                };

                return Success(dto, "Brand retrieved successfully.");
            }
            catch (Exception ex)
            {
                return Failure<BrandDto>(ex.Message, "Failed to retrieve brand.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<BrandDto>>> CreateBrand([FromBody] CreateBrandRequest request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<BrandDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(ApiResponse<BrandDto>.CreateFailure("Brand name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var nameExists = await _tenantContext.Brands.AnyAsync(b => b.Name.ToLower() == request.Name.Trim().ToLower() && !b.IsDeleted);
                if (nameExists)
                {
                    return BadRequest(ApiResponse<BrandDto>.CreateFailure("A brand with this name already exists.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (!string.IsNullOrWhiteSpace(request.Code))
                {
                    var codeExists = await _tenantContext.Brands.AnyAsync(b => b.Code != null && b.Code.ToLower() == request.Code.Trim().ToLower() && !b.IsDeleted);
                    if (codeExists)
                    {
                        return BadRequest(ApiResponse<BrandDto>.CreateFailure("Brand code must be unique.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                var brand = new Brand
                {
                    Name = request.Name.Trim(),
                    Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim(),
                    Description = request.Description?.Trim(),
                    IsActive = request.IsActive
                };

                _tenantContext.Brands.Add(brand);
                await _tenantContext.SaveChangesAsync();

                var dto = new BrandDto
                {
                    Id = brand.Id,
                    Name = brand.Name,
                    Code = brand.Code,
                    Description = brand.Description,
                    IsActive = brand.IsActive,
                    CreatedAt = brand.CreatedAt
                };

                return Success(dto, "Brand created successfully.");
            }
            catch (Exception ex)
            {
                return Failure<BrandDto>(ex.Message, "Failed to create brand.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<BrandDto>>> UpdateBrand(Guid id, [FromBody] UpdateBrandRequest request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<BrandDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var brand = await _tenantContext.Brands.FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted);
                if (brand == null)
                {
                    return NotFound(ApiResponse<BrandDto>.CreateFailure("Brand not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(ApiResponse<BrandDto>.CreateFailure("Brand name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (brand.Name.ToLower() != request.Name.Trim().ToLower())
                {
                    var nameExists = await _tenantContext.Brands.AnyAsync(b => b.Name.ToLower() == request.Name.Trim().ToLower() && !b.IsDeleted);
                    if (nameExists)
                    {
                        return BadRequest(ApiResponse<BrandDto>.CreateFailure("A brand with this name already exists.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                if (!string.IsNullOrWhiteSpace(request.Code) && brand.Code?.ToLower() != request.Code.Trim().ToLower())
                {
                    var codeExists = await _tenantContext.Brands.AnyAsync(b => b.Code != null && b.Code.ToLower() == request.Code.Trim().ToLower() && !b.IsDeleted);
                    if (codeExists)
                    {
                        return BadRequest(ApiResponse<BrandDto>.CreateFailure("Brand code must be unique.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                brand.Name = request.Name.Trim();
                brand.Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim();
                brand.Description = request.Description?.Trim();
                brand.IsActive = request.IsActive;

                _tenantContext.Brands.Update(brand);
                await _tenantContext.SaveChangesAsync();

                var dto = new BrandDto
                {
                    Id = brand.Id,
                    Name = brand.Name,
                    Code = brand.Code,
                    Description = brand.Description,
                    IsActive = brand.IsActive,
                    CreatedAt = brand.CreatedAt
                };

                return Success(dto, "Brand updated successfully.");
            }
            catch (Exception ex)
            {
                return Failure<BrandDto>(ex.Message, "Failed to update brand.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteBrand(Guid id)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<bool>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var brand = await _tenantContext.Brands.FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted);
                if (brand == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Brand not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                _tenantContext.Brands.Remove(brand); // This will trigger soft delete thanks to context configuration
                await _tenantContext.SaveChangesAsync();
                
                return Success(true, "Brand deleted successfully.");
            }
            catch (Exception ex)
            {
                return Failure<bool>(ex.Message, "Failed to delete brand.");
            }
        }
    }
}
