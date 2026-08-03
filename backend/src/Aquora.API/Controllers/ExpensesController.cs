using System;
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
    [Route("api/v1/expenses")]
    public class ExpensesController : ApiControllerBase
    {
        private readonly ISimpleAccountsService _accountsService;

        public ExpensesController(ISimpleAccountsService accountsService)
        {
            _accountsService = accountsService;
        }

        [HttpGet]
        public async Task<IActionResult> GetExpenses(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? category = null,
            [FromQuery] int? month = null,
            [FromQuery] string? paymentMethod = null)
        {
            try
            {
                var result = await _accountsService.GetExpensesAsync(
                    pageNumber, pageSize, search, startDate, endDate, category, month, paymentMethod);
                return Ok(ApiResponse<PagedResult<SimpleExpenseDto>>.CreateSuccess(result, "Expenses retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetExpenseById(Guid id)
        {
            try
            {
                var expense = await _accountsService.GetExpenseByIdAsync(id);
                if (expense == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Expense not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<SimpleExpenseDto>.CreateSuccess(expense, "Expense retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateExpense([FromBody] CreateSimpleExpenseRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _accountsService.CreateExpenseAsync(request);
                return CreatedAtAction(nameof(GetExpenseById), new { id = created.Id }, ApiResponse<SimpleExpenseDto>.CreateSuccess(created, "Expense created successfully."));
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

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateExpense(Guid id, [FromBody] UpdateSimpleExpenseRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _accountsService.UpdateExpenseAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Expense not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<SimpleExpenseDto>.CreateSuccess(updated, "Expense updated successfully."));
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

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteExpense(Guid id)
        {
            try
            {
                var success = await _accountsService.DeleteExpenseAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Expense not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Expense deleted successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
