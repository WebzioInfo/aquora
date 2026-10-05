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
    [Route("api/v1/expense-categories")]
    public class ExpenseCategoriesController : ApiControllerBase
    {
        private readonly ISimpleAccountsService _accountsService;

        public ExpenseCategoriesController(ISimpleAccountsService accountsService)
        {
            _accountsService = accountsService;
        }

        [HttpGet]
        public async Task<IActionResult> GetExpenseCategories([FromQuery] bool includeInactive = false)
        {
            try
            {
                var categories = await _accountsService.GetExpenseCategoriesAsync(includeInactive);
                return Ok(ApiResponse<List<ExpenseCategoryDto>>.CreateSuccess(categories, "Expense categories retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetExpenseCategoryById(Guid id)
        {
            try
            {
                var category = await _accountsService.GetExpenseCategoryByIdAsync(id);
                if (category == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Expense category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<ExpenseCategoryDto>.CreateSuccess(category, "Expense category retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateExpenseCategory([FromBody] CreateExpenseCategoryRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _accountsService.CreateExpenseCategoryAsync(request);
                return CreatedAtAction(nameof(GetExpenseCategoryById), new { id = created.Id }, ApiResponse<ExpenseCategoryDto>.CreateSuccess(created, "Expense category created successfully."));
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
        public async Task<IActionResult> UpdateExpenseCategory(Guid id, [FromBody] UpdateExpenseCategoryRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _accountsService.UpdateExpenseCategoryAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Expense category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<ExpenseCategoryDto>.CreateSuccess(updated, "Expense category updated successfully."));
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
        public async Task<IActionResult> DeleteExpenseCategory(Guid id)
        {
            try
            {
                var success = await _accountsService.DeleteExpenseCategoryAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Expense category not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Expense category deleted successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
