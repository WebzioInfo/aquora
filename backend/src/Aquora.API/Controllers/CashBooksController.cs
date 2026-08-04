using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/cash-books")]
    public class CashBooksController : ApiControllerBase
    {
        private readonly ISimpleAccountsService _accountsService;
        private readonly ILedgerService _ledgerService;

        public CashBooksController(ISimpleAccountsService accountsService, ILedgerService ledgerService)
        {
            _accountsService = accountsService;
            _ledgerService = ledgerService;
        }

        [HttpGet]
        public async Task<IActionResult> GetCashBooks([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null, [FromQuery] string? status = null)
        {
            var result = await _accountsService.GetCashBooksAsync(pageNumber, pageSize, search, status);
            return Ok(ApiResponse<PagedResult<CashBookDto>>.CreateSuccess(result, "Cash books retrieved successfully."));
        }

        [HttpGet("dropdown")]
        public async Task<IActionResult> GetCashBookDropdown()
        {
            var list = await _accountsService.GetCashBookDropdownAsync();
            return Ok(ApiResponse<List<CashBookDropdownDto>>.CreateSuccess(list, "Cash book dropdown retrieved successfully."));
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetCashBookById(Guid id)
        {
            var cashBook = await _accountsService.GetCashBookByIdAsync(id);
            if (cashBook == null) return NotFound(ApiResponse<object>.CreateFailure("Cash book not found.", "Not Found", HttpContext.TraceIdentifier));
            return Ok(ApiResponse<CashBookDto>.CreateSuccess(cashBook, "Cash book retrieved successfully."));
        }

        [HttpPost]
        public async Task<IActionResult> CreateCashBook([FromBody] CreateCashBookRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            var created = await _accountsService.CreateCashBookAsync(request);
            return CreatedAtAction(nameof(GetCashBookById), new { id = created.Id }, ApiResponse<CashBookDto>.CreateSuccess(created, "Cash book created successfully."));
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateCashBook(Guid id, [FromBody] UpdateCashBookRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            var updated = await _accountsService.UpdateCashBookAsync(id, request);
            if (updated == null) return NotFound(ApiResponse<object>.CreateFailure("Cash book not found.", "Not Found", HttpContext.TraceIdentifier));
            return Ok(ApiResponse<CashBookDto>.CreateSuccess(updated, "Cash book updated successfully."));
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteCashBook(Guid id)
        {
            var success = await _accountsService.DeleteCashBookAsync(id);
            if (!success) return NotFound(ApiResponse<object>.CreateFailure("Cash book not found.", "Not Found", HttpContext.TraceIdentifier));
            return Ok(ApiResponse<bool>.CreateSuccess(true, "Cash book deleted successfully."));
        }

        [HttpGet("{id:guid}/ledger")]
        public async Task<IActionResult> GetCashBookLedger(
            Guid id,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null,
            [FromQuery] DateTime? dateFrom = null,
            [FromQuery] DateTime? dateTo = null,
            [FromQuery] string? transactionType = null,
            [FromQuery] string? createdBy = null,
            [FromQuery] decimal? minAmount = null,
            [FromQuery] decimal? maxAmount = null,
            [FromQuery] string? sortBy = "TransactionDate",
            [FromQuery] string? sortOrder = "desc")
        {
            var filter = new BankLedgerFilterDto
            {
                DateFrom = dateFrom,
                DateTo = dateTo,
                TransactionType = transactionType,
                CreatedBy = createdBy,
                MinimumAmount = minAmount,
                MaximumAmount = maxAmount,
                SortBy = sortBy,
                SortOrder = sortOrder
            };
            
            var result = await _ledgerService.GetCashBookLedgerAsync(id, pageNumber, pageSize, search, filter);
            return Ok(ApiResponse<PagedResult<BankLedgerEntryDto>>.CreateSuccess(result, "Cash ledger retrieved successfully."));
        }

        [HttpGet("{id:guid}/summary")]
        public async Task<IActionResult> GetCashBookSummary(Guid id)
        {
            var result = await _ledgerService.GetCashBookSummaryAsync(id);
            return Ok(ApiResponse<BankSummaryDto>.CreateSuccess(result, "Cash book summary retrieved successfully."));
        }

        [HttpGet("ledger/{ledgerEntryId:guid}/history")]
        public async Task<IActionResult> GetCashLedgerHistory(Guid ledgerEntryId)
        {
            var result = await _ledgerService.GetLedgerHistoryAsync(ledgerEntryId);
            return Ok(ApiResponse<List<BankLedgerAuditEntryDto>>.CreateSuccess(result, "Cash ledger history retrieved successfully."));
        }

        [HttpPost("{id:guid}/deposit")]
        public async Task<IActionResult> AddCashMoney(Guid id, [FromBody] AddMoneyRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var entryId = await _ledgerService.AddMoneyAsync(null, id, request);
                return Ok(ApiResponse<Guid>.CreateSuccess(entryId, "Deposit recorded successfully."));
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

        [HttpPut("deposit/{ledgerEntryId:guid}")]
        public async Task<IActionResult> UpdateCashDeposit(Guid ledgerEntryId, [FromBody] AddMoneyRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                await _ledgerService.UpdateDepositAsync(ledgerEntryId, request);
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Deposit updated successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpDelete("deposit/{ledgerEntryId:guid}")]
        public async Task<IActionResult> DeleteCashDeposit(Guid ledgerEntryId)
        {
            try
            {
                await _ledgerService.DeleteDepositAsync(ledgerEntryId);
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Deposit deleted successfully."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Validation Error", HttpContext.TraceIdentifier));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost("ledger/{ledgerEntryId:guid}/reverse")]
        public async Task<IActionResult> ReverseCashLedgerEntry(Guid ledgerEntryId, [FromBody] ReverseCashLedgerRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Reversal reason is required.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var reversalId = await _ledgerService.ReverseTransactionAsync(ledgerEntryId, request.Reason);
                return Ok(ApiResponse<Guid>.CreateSuccess(reversalId, "Ledger entry reversed successfully."));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Business Rule Violation", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
    }

    public class ReverseCashLedgerRequest
    {
        public string Reason { get; set; } = string.Empty;
    }
}
