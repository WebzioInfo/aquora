using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Aquora.Application.Interfaces;
using Aquora.Application.DTOs.Products;
using Aquora.Domain.Entities;
using Aquora.Shared.Models;

using Aquora.Application.Interfaces.Services;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ProductsController : ApiControllerBase
    {
        private readonly ITenantDbContext _tenantContext;
        private readonly ICurrentUserContext _currentUserContext;
        private readonly IPlatformDbContext _platformContext;
        private readonly IInventoryMovementService _inventoryMovementService;

        public ProductsController(
            ITenantDbContext tenantContext, 
            ICurrentUserContext currentUserContext,
            IPlatformDbContext platformContext,
            IInventoryMovementService inventoryMovementService)
        {
            _tenantContext = tenantContext;
            _currentUserContext = currentUserContext;
            _platformContext = platformContext;
            _inventoryMovementService = inventoryMovementService;
        }

        private bool IsAuthorizedToWrite()
        {
            var allowedRoles = new[] { "CompanyAdmin", "Admin", "Manager", "Accountant" };
            return _currentUserContext.Roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResult<ProductDto>>>> GetProducts(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? searchTerm = null)
        {
            try
            {
                var query = _tenantContext.Products
                    .Include(p => p.Brand)
                    .Where(p => !p.IsDeleted)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var term = searchTerm.Trim().ToLower();
                    query = query.Where(p => p.Name.ToLower().Contains(term) || (p.SKU != null && p.SKU.ToLower().Contains(term)));
                }

                var totalCount = await query.CountAsync();
                var items = await query
                    .OrderByDescending(p => p.CreatedAt)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .Select(p => new ProductDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        BrandId = p.BrandId,
                        BrandName = p.Brand.Name,
                        SKU = p.SKU,
                        IsActive = p.IsActive,
                        CurrentStock = p.CurrentStock,
                        Category = p.Category,
                        DisplayOrder = p.DisplayOrder,
                        BottleSize = p.BottleSize,
                        ImageUrl = p.ImageUrl,
                        CreatedAt = p.CreatedAt,
                        UpdatedAt = p.UpdatedAt
                    })
                    .ToListAsync();

                var pagedResult = new PagedResult<ProductDto>(items, totalCount, pageNumber, pageSize);
                return Success(pagedResult, "Products retrieved successfully.");
            }
            catch (Exception)
            {
                return Failure<PagedResult<ProductDto>>("An internal error occurred.", "Failed to retrieve products.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<ProductDto>>> GetProductById(Guid id)
        {
            try
            {
                var product = await _tenantContext.Products
                    .Include(p => p.Brand)
                    .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

                if (product == null)
                {
                    return NotFound(ApiResponse<ProductDto>.CreateFailure("Product not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                var dto = new ProductDto
                {
                    Id = product.Id,
                    Name = product.Name,
                    BrandId = product.BrandId,
                    BrandName = product.Brand.Name,
                    SKU = product.SKU,
                    IsActive = product.IsActive,
                    CurrentStock = product.CurrentStock,
                    Category = product.Category,
                    DisplayOrder = product.DisplayOrder,
                    BottleSize = product.BottleSize,
                    ImageUrl = product.ImageUrl,
                    CreatedAt = product.CreatedAt,
                    UpdatedAt = product.UpdatedAt
                };

                return Success(dto, "Product retrieved successfully.");
            }
            catch (Exception)
            {
                return Failure<ProductDto>("An internal error occurred.", "Failed to retrieve product.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<ProductDto>>> CreateProduct([FromBody] CreateProductDto request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<ProductDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Product name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var brand = await _tenantContext.Brands.FirstOrDefaultAsync(b => b.Id == request.BrandId && !b.IsDeleted);
                if (brand == null)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Selected brand does not exist.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Active company not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var nameExists = await _tenantContext.Products.AnyAsync(p => p.BrandId == request.BrandId && p.Name.ToLower() == request.Name.Trim().ToLower() && !p.IsDeleted);
                if (nameExists)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("A product with this name already exists for the selected brand.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (!string.IsNullOrWhiteSpace(request.SKU))
                {
                    var skuExists = await _tenantContext.Products.AnyAsync(p => p.SKU.ToLower() == request.SKU.Trim().ToLower() && !p.IsDeleted);
                    if (skuExists)
                    {
                        return BadRequest(ApiResponse<ProductDto>.CreateFailure("SKU must be unique.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                var product = new Product
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name.Trim(),
                    BrandId = request.BrandId,
                    SKU = string.IsNullOrWhiteSpace(request.SKU) ? null : request.SKU.Trim(),
                    IsActive = request.IsActive,
                    CurrentStock = 0.0m, // Initialize to 0, balance engine will set it
                    Category = request.Category,
                    DisplayOrder = request.DisplayOrder,
                    BottleSize = request.BottleSize,
                    ImageUrl = request.ImageUrl
                };

                var dbContext = _tenantContext as DbContext;
                if (dbContext == null)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
                }

                using var transaction = await dbContext.Database.BeginTransactionAsync();
                try
                {
                    _tenantContext.Products.Add(product);
                    await _tenantContext.SaveChangesAsync();

                    decimal openingStockQty = request.OpeningStock ?? 0.0m;

                    await _inventoryMovementService.RecordProductMovementAsync(
                        _tenantContext,
                        product.Id,
                        openingStockQty,
                        "OpeningStock",
                        product.Id,
                        "Opening Stock",
                        _currentUserContext.TenantId,
                        company.Id,
                        _currentUserContext.UserId?.ToString() ?? "System");

                    await _tenantContext.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                var dto = new ProductDto
                {
                    Id = product.Id,
                    Name = product.Name,
                    BrandId = product.BrandId,
                    BrandName = brand.Name,
                    SKU = product.SKU,
                    IsActive = product.IsActive,
                    CurrentStock = product.CurrentStock,
                    Category = product.Category,
                    DisplayOrder = product.DisplayOrder,
                    BottleSize = product.BottleSize,
                    ImageUrl = product.ImageUrl,
                    CreatedAt = product.CreatedAt,
                    UpdatedAt = product.UpdatedAt
                };

                return Success(dto, "Product created successfully.");
            }
            catch (Exception)
            {
                return Failure<ProductDto>("An internal error occurred.", "Failed to create product.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<ProductDto>>> UpdateProduct(Guid id, [FromBody] UpdateProductDto request)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<ProductDto>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
                if (product == null)
                {
                    return NotFound(ApiResponse<ProductDto>.CreateFailure("Product not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Product name is required.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var brand = await _tenantContext.Brands.FirstOrDefaultAsync(b => b.Id == request.BrandId && !b.IsDeleted);
                if (brand == null)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Selected brand does not exist.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var company = await _tenantContext.Companies.FirstOrDefaultAsync(c => !c.IsDeleted);
                if (company == null)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Active company not found.", "Validation Error", HttpContext.TraceIdentifier));
                }

                var nameExists = await _tenantContext.Products.AnyAsync(p => p.Id != id && p.BrandId == request.BrandId && p.Name.ToLower() == request.Name.Trim().ToLower() && !p.IsDeleted);
                if (nameExists)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("A product with this name already exists for the selected brand.", "Validation Error", HttpContext.TraceIdentifier));
                }

                if (!string.IsNullOrWhiteSpace(request.SKU))
                {
                    var skuExists = await _tenantContext.Products.AnyAsync(p => p.Id != id && p.SKU.ToLower() == request.SKU.Trim().ToLower() && !p.IsDeleted);
                    if (skuExists)
                    {
                        return BadRequest(ApiResponse<ProductDto>.CreateFailure("SKU must be unique.", "Validation Error", HttpContext.TraceIdentifier));
                    }
                }

                var dbContext = _tenantContext as DbContext;
                if (dbContext == null)
                {
                    return BadRequest(ApiResponse<ProductDto>.CreateFailure("Database context is invalid.", "Infrastructure Error", HttpContext.TraceIdentifier));
                }

                using var transaction = await dbContext.Database.BeginTransactionAsync();
                try
                {
                    product.Name = request.Name.Trim();
                    product.BrandId = request.BrandId;
                    product.SKU = string.IsNullOrWhiteSpace(request.SKU) ? null : request.SKU.Trim();
                    product.IsActive = request.IsActive;
                    product.Category = request.Category;
                    product.DisplayOrder = request.DisplayOrder;
                    product.BottleSize = request.BottleSize;
                    product.ImageUrl = request.ImageUrl;

                    if (request.CurrentStock.HasValue && request.CurrentStock.Value != product.CurrentStock)
                    {
                        decimal diff = request.CurrentStock.Value - product.CurrentStock;
                        await _inventoryMovementService.RecordProductMovementAsync(
                            _tenantContext,
                            product.Id,
                            diff,
                            "StockAdjustment",
                            product.Id,
                            "Manual Stock Correction",
                            _currentUserContext.TenantId,
                            company.Id,
                            _currentUserContext.UserId?.ToString() ?? "System");
                    }

                    await _tenantContext.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                var dto = new ProductDto
                {
                    Id = product.Id,
                    Name = product.Name,
                    BrandId = product.BrandId,
                    BrandName = brand.Name,
                    SKU = product.SKU,
                    IsActive = product.IsActive,
                    CurrentStock = product.CurrentStock,
                    Category = product.Category,
                    DisplayOrder = product.DisplayOrder,
                    BottleSize = product.BottleSize,
                    ImageUrl = product.ImageUrl,
                    CreatedAt = product.CreatedAt,
                    UpdatedAt = product.UpdatedAt
                };

                return Success(dto, "Product updated successfully.");
            }
            catch (Exception)
            {
                return Failure<ProductDto>("An internal error occurred.", "Failed to update product.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteProduct(Guid id)
        {
            if (!IsAuthorizedToWrite())
            {
                return StatusCode(403, ApiResponse<bool>.CreateFailure("You do not have permission to perform this action.", "Forbidden", HttpContext.TraceIdentifier));
            }

            try
            {
                var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
                if (product == null)
                {
                    return NotFound(ApiResponse<bool>.CreateFailure("Product not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                product.IsDeleted = true;
                await _tenantContext.SaveChangesAsync();

                return Success(true, "Product deleted successfully.");
            }
            catch (Exception)
            {
                return Failure<bool>("An internal error occurred.", "Failed to delete product.");
            }
        }

        [HttpGet("brands")]
        public async Task<ActionResult<ApiResponse<List<BrandDto>>>> GetBrands()
        {
            try
            {
                var brands = await _tenantContext.Brands
                    .Where(b => !b.IsDeleted)
                    .OrderBy(b => b.Name)
                    .Select(b => new BrandDto
                    {
                        Id = b.Id,
                        Name = b.Name
                    })
                    .ToListAsync();

                return Success(brands, "Brands loaded successfully.");
            }
            catch (Exception)
            {
                return Failure<List<BrandDto>>("An internal error occurred.", "Failed to load brands.");
            }
        }

        [HttpGet("{id:guid}/movements")]
        public async Task<ActionResult<ApiResponse<PagedResult<InventoryMovementDto>>>> GetMovements(
            Guid id,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var product = await _tenantContext.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
                if (product == null)
                {
                    return NotFound(ApiResponse<PagedResult<InventoryMovementDto>>.CreateFailure("Product not found.", "Not Found", HttpContext.TraceIdentifier));
                }

                // Compute ALL movements in chronological order for running balance
                var allMovements = await _tenantContext.InventoryMovements
                    .Where(m => m.ProductId == id && m.InventoryType == "FinishedProduct" && !m.IsDeleted)
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => new
                    {
                        m.Id,
                        m.Quantity,
                        m.ReferenceType,
                        m.CreatedAt,
                        m.CreatedBy,
                        m.Notes
                    })
                    .ToListAsync();

                // Compute running balance prefix-sum
                decimal runningBalance = 0;
                var withBalance = allMovements.Select(m =>
                {
                    runningBalance += m.Quantity;
                    return new
                    {
                        m.Id,
                        m.Quantity,
                        m.ReferenceType,
                        BalanceAfter = runningBalance,
                        m.CreatedAt,
                        m.CreatedBy,
                        m.Notes
                    };
                }).ToList();

                // Reverse so latest movement appears first for UI display
                withBalance.Reverse();

                var totalCount = withBalance.Count;
                var pagedItems = withBalance
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                // Look up operator names for the paged items only to prevent N+1 queries
                var userIds = pagedItems
                    .Select(m => m.CreatedBy)
                    .Where(cb => !string.IsNullOrEmpty(cb) && Guid.TryParse(cb, out _))
                    .Select(Guid.Parse)
                    .Distinct()
                    .ToList();

                var usersMap = await _platformContext.Users
                    .Where(u => userIds.Contains(u.Id))
                    .Select(u => new { u.Id, u.FirstName, u.LastName, u.Username })
                    .ToDictionaryAsync(u => u.Id, u => {
                        var fullName = $"{u.FirstName} {u.LastName}".Trim();
                        return !string.IsNullOrEmpty(fullName) ? fullName : (u.Username ?? "Unknown User");
                    });

                var pagedDto = pagedItems.Select(m =>
                {
                    string opName = "Unknown User";
                    if (string.IsNullOrEmpty(m.CreatedBy))
                    {
                        opName = "Unknown User";
                    }
                    else if (m.CreatedBy.Equals("System", StringComparison.OrdinalIgnoreCase))
                    {
                        opName = "System";
                    }
                    else if (Guid.TryParse(m.CreatedBy, out var userGuid))
                    {
                        if (!usersMap.TryGetValue(userGuid, out opName))
                        {
                            opName = "Unknown User";
                        }
                    }
                    else
                    {
                        opName = m.CreatedBy;
                    }

                    return new InventoryMovementDto
                    {
                        Id = m.Id,
                        Quantity = m.Quantity,
                        ReferenceType = m.ReferenceType ?? "Unknown",
                        BalanceAfter = m.BalanceAfter,
                        CreatedAt = m.CreatedAt,
                        OperatorName = opName,
                        Unit = "Cases",
                        Notes = m.Notes
                    };
                }).ToList();

                var result = new PagedResult<InventoryMovementDto>(pagedDto, totalCount, pageNumber, pageSize);
                return Success(result, "Product movements retrieved successfully.");
            }
            catch (Exception)
            {
                return Failure<PagedResult<InventoryMovementDto>>("An internal error occurred.", "Failed to retrieve product movements.");
            }
        }
    }
}
