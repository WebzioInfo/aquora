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
    [Route("api/v1/vendors")]
    public class VendorsController : ApiControllerBase
    {
        private readonly IVendorService _vendorService;
        private readonly ILogger<VendorsController> _logger;

        public VendorsController(IVendorService vendorService, ILogger<VendorsController> logger)
        {
            _vendorService = vendorService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetVendors(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null)
        {
            try
            {
                var result = await _vendorService.GetVendorsAsync(pageNumber, pageSize, search);
                return Ok(ApiResponse<PagedResult<VendorDto>>.CreateSuccess(result, "Vendors retrieved successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve vendors");
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load vendors list. Please refresh the page.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("dropdown")]
        public async Task<IActionResult> GetVendorDropdown()
        {
            try
            {
                var result = await _vendorService.GetVendorDropdownAsync();
                return Ok(ApiResponse<object>.CreateSuccess(result, "Vendor dropdown retrieved successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve vendor dropdown");
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load vendor dropdown.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetVendorById(Guid id)
        {
            try
            {
                var vendor = await _vendorService.GetVendorByIdAsync(id);
                if (vendor == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Vendor record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<VendorDto>.CreateSuccess(vendor, "Vendor retrieved successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve vendor {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load vendor profile.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}/details")]
        public async Task<IActionResult> GetVendorDetails(Guid id)
        {
            try
            {
                var details = await _vendorService.GetVendorDetailsAsync(id);
                if (details == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Vendor record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<VendorDetailsDto>.CreateSuccess(details, "Vendor details retrieved successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve vendor details for {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to load vendor details.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateVendor([FromBody] CreateVendorRequest request)
        {
            if (!ModelState.IsValid)
            {
                var errorMsg = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).FirstOrDefault() ?? "Please check vendor fields.";
                return BadRequest(ApiResponse<object>.CreateFailure(errorMsg, "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _vendorService.CreateVendorAsync(request);
                return CreatedAtAction(nameof(GetVendorById), new { id = created.Id }, ApiResponse<VendorDto>.CreateSuccess(created, "Vendor created successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create vendor");
                return BadRequest(ApiResponse<object>.CreateFailure("Something went wrong while creating the vendor. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateVendor(Guid id, [FromBody] UpdateVendorRequest request)
        {
            if (!ModelState.IsValid)
            {
                var errorMsg = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).FirstOrDefault() ?? "Please check vendor fields.";
                return BadRequest(ApiResponse<object>.CreateFailure(errorMsg, "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _vendorService.UpdateVendorAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Vendor record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<VendorDto>.CreateSuccess(updated, "Vendor updated successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update vendor {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Something went wrong while updating the vendor. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost("{id:guid}/toggle-status")]
        public async Task<IActionResult> ToggleVendorStatus(Guid id)
        {
            try
            {
                var success = await _vendorService.ToggleVendorStatusAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Vendor record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Vendor status toggled successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to toggle vendor status {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to change vendor status. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteVendor(Guid id)
        {
            try
            {
                var success = await _vendorService.DeleteVendorAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Vendor record not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Vendor deleted successfully."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete vendor {Id}", id);
                return BadRequest(ApiResponse<object>.CreateFailure("Unable to delete vendor. Please try again.", "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
