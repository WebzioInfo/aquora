using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/owners")]
    public class OwnersController : ApiControllerBase
    {
        private readonly ISimpleAccountsService _accountsService;

        public OwnersController(ISimpleAccountsService accountsService)
        {
            _accountsService = accountsService;
        }

        [HttpGet]
        public async Task<IActionResult> GetOwners()
        {
            try
            {
                var owners = await _accountsService.GetOwnersAsync();
                return Ok(ApiResponse<List<OwnerDto>>.CreateSuccess(owners, "Owners retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetOwnerSummaries()
        {
            try
            {
                var summaries = await _accountsService.GetOwnerSummariesAsync();
                return Ok(ApiResponse<List<OwnerSummaryDto>>.CreateSuccess(summaries, "Owner summaries retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("total-investment")]
        public async Task<IActionResult> GetCompanyTotalInvestment()
        {
            try
            {
                var total = await _accountsService.GetCompanyTotalInvestmentAsync();
                return Ok(ApiResponse<CompanyTotalInvestmentDto>.CreateSuccess(total, "Company total investment retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetOwnerById(Guid id)
        {
            try
            {
                var owner = await _accountsService.GetOwnerByIdAsync(id);
                if (owner == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Owner not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<OwnerDto>.CreateSuccess(owner, "Owner retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateOwner([FromBody] CreateOwnerRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _accountsService.CreateOwnerAsync(request);
                return CreatedAtAction(nameof(GetOwnerById), new { id = created.Id }, ApiResponse<OwnerDto>.CreateSuccess(created, "Owner created successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateOwner(Guid id, [FromBody] UpdateOwnerRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _accountsService.UpdateOwnerAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Owner not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<OwnerDto>.CreateSuccess(updated, "Owner updated successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteOwner(Guid id)
        {
            try
            {
                var success = await _accountsService.DeleteOwnerAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Owner not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Owner deleted successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost("{id:guid}/transactions")]
        public async Task<IActionResult> AddOwnerTransaction(Guid id, [FromBody] CreateOwnerInvestmentTransactionRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _accountsService.AddOwnerTransactionAsync(id, request);
                return Ok(ApiResponse<OwnerInvestmentTransactionDto>.CreateSuccess(created, "Owner investment transaction created successfully."));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
