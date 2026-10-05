using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Finance;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/asset-categories")]
    public class AssetCategoriesController : ApiControllerBase
    {
        private readonly IAssetManagementService _assetService;

        public AssetCategoriesController(IAssetManagementService assetService)
        {
            _assetService = assetService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAssetCategories([FromQuery] bool includeInactive = false)
        {
            try
            {
                var categories = await _assetService.GetAssetCategoriesAsync(includeInactive);
                return Ok(ApiResponse<List<AssetCategoryDto>>.CreateSuccess(categories, "Asset categories retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetAssetCategoryById(Guid id)
        {
            try
            {
                var category = await _assetService.GetAssetCategoryByIdAsync(id);
                if (category == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<AssetCategoryDto>.CreateSuccess(category, "Asset category retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateAssetCategory([FromBody] CreateAssetCategoryRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _assetService.CreateAssetCategoryAsync(request);
                return CreatedAtAction(nameof(GetAssetCategoryById), new { id = created.Id }, ApiResponse<AssetCategoryDto>.CreateSuccess(created, "Asset category created successfully."));
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
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateAssetCategory(Guid id, [FromBody] UpdateAssetCategoryRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _assetService.UpdateAssetCategoryAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<AssetCategoryDto>.CreateSuccess(updated, "Asset category updated successfully."));
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
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteAssetCategory(Guid id)
        {
            try
            {
                var success = await _assetService.DeleteAssetCategoryAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Asset category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Asset category deleted successfully."));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Invalid Operation", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
