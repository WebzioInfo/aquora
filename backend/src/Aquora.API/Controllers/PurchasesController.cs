using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Purchase;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/purchases")]
    public class PurchasesController : ApiControllerBase
    {
        private readonly IPurchaseService _purchaseService;
        private readonly ILogger<PurchasesController> _logger;

        public PurchasesController(IPurchaseService purchaseService, ILogger<PurchasesController> logger)
        {
            _purchaseService = purchaseService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetPurchases(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] Guid? vendorId = null,
            [FromQuery] string? category = null,
            [FromQuery] string? paymentStatus = null)
        {
            try
            {
                var result = await _purchaseService.GetPurchasesPagedAsync(
                    pageNumber, pageSize, search, startDate, endDate, vendorId, category, paymentStatus);
                return Ok(ApiResponse<PagedPurchasesResponseDto>.CreateSuccess(result, "Purchases retrieved successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve purchases list");
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load purchases. Please refresh the page.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetPurchaseById(Guid id)
        {
            try
            {
                var purchase = await _purchaseService.GetPurchaseByIdAsync(id);
                if (purchase == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<PurchaseDto>.CreateSuccess(purchase, "Purchase details retrieved successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve purchase details for {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load purchase details. Please refresh the page.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreatePurchase([FromBody] CreatePurchaseRequest request)
        {
            if (!ModelState.IsValid)
            {
                var errorMsg = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).FirstOrDefault() ?? "Please check the required fields.";
                return BadRequest(ApiResponse<object>.CreateFailure(errorMsg, "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _purchaseService.CreatePurchaseAsync(request);
                return CreatedAtAction(nameof(GetPurchaseById), new { id = created.Id }, ApiResponse<PurchaseDto>.CreateSuccess(created, "Purchase created successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create purchase");
                return BadRequest(ApiResponse<object>.CreateFailure("Something went wrong while creating the purchase. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdatePurchase(Guid id, [FromBody] UpdatePurchaseRequest request)
        {
            if (!ModelState.IsValid)
            {
                var errorMsg = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).FirstOrDefault() ?? "Please check the required fields.";
                return BadRequest(ApiResponse<object>.CreateFailure(errorMsg, "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _purchaseService.UpdatePurchaseAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<PurchaseDto>.CreateSuccess(updated, "Purchase updated successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update purchase {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Something went wrong while updating the purchase. Please refresh the page and try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost("{id:guid}/cancel")]
        public async Task<IActionResult> CancelPurchase(Guid id)
        {
            try
            {
                var success = await _purchaseService.CancelPurchaseAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase record not found or already cancelled.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Purchase cancelled successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to cancel purchase {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to cancel purchase. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost("{id:guid}/duplicate")]
        public async Task<IActionResult> DuplicatePurchase(Guid id)
        {
            try
            {
                var duplicateDraft = await _purchaseService.DuplicatePurchaseAsync(id);
                if (duplicateDraft == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<CreatePurchaseRequest>.CreateSuccess(duplicateDraft, "Duplicate draft generated successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to duplicate purchase {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to duplicate purchase draft. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeletePurchase(Guid id)
        {
            try
            {
                var success = await _purchaseService.DeletePurchaseAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Purchase deleted successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete purchase {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to delete purchase record. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost("{id:guid}/payments")]
        public async Task<IActionResult> AddPayment(Guid id, [FromBody] AddPurchasePaymentRequest request)
        {
            if (!ModelState.IsValid)
            {
                var errorMsg = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).FirstOrDefault() ?? "Please enter a valid payment amount.";
                return BadRequest(ApiResponse<object>.CreateFailure(errorMsg, "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _purchaseService.AddPaymentAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Purchase record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<PurchaseDto>.CreateSuccess(updated, "Payment recorded successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to record payment for purchase {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Something went wrong while recording the payment. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("assets/{assetId:guid}/history")]
        public async Task<IActionResult> GetAssetHistory(Guid assetId)
        {
            try
            {
                var history = await _purchaseService.GetAssetHistoryAsync(assetId);
                return Ok(ApiResponse<object>.CreateSuccess(history, "Asset history retrieved successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve asset history for {AssetId}", assetId);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load asset history.", "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
