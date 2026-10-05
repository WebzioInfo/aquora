using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Purchase;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/purchase-categories")]
    public class PurchaseCategoriesController : ApiControllerBase
    {
        private readonly IPurchaseService _purchaseService;

        public PurchaseCategoriesController(IPurchaseService purchaseService)
        {
            _purchaseService = purchaseService;
        }

        [HttpGet]
        public async Task<IActionResult> GetPurchaseCategories([FromQuery] bool includeInactive = false)
        {
            try
            {
                var categories = await _purchaseService.GetPurchaseCategoriesAsync(includeInactive);
                return Ok(ApiResponse<List<PurchaseCategoryDto>>.CreateSuccess(categories, "Purchase categories retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetPurchaseCategoryById(Guid id)
        {
            try
            {
                var category = await _purchaseService.GetPurchaseCategoryByIdAsync(id);
                if (category == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<PurchaseCategoryDto>.CreateSuccess(category, "Purchase category retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreatePurchaseCategory([FromBody] CreatePurchaseCategoryRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid purchase category data.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var category = await _purchaseService.CreatePurchaseCategoryAsync(request);
                return CreatedAtAction(nameof(GetPurchaseCategoryById), new { id = category.Id },
                    ApiResponse<PurchaseCategoryDto>.CreateSuccess(category, "Purchase category created successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ApiResponse<object>.CreateFailure(ex.Message, "Conflict", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Internal Server Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdatePurchaseCategory(Guid id, [FromBody] UpdatePurchaseCategoryRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid purchase category data.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var category = await _purchaseService.UpdatePurchaseCategoryAsync(id, request);
                if (category == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<PurchaseCategoryDto>.CreateSuccess(category, "Purchase category updated successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ApiResponse<object>.CreateFailure(ex.Message, "Conflict", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Internal Server Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeletePurchaseCategory(Guid id)
        {
            try
            {
                var success = await _purchaseService.DeletePurchaseCategoryAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Purchase category processed successfully."));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Operation Not Allowed", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Internal Server Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
