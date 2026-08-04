using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.SimpleAccounts;
using Aquora.Shared.Models;

// BankAccounts Controller for Aquora ERP Accounts Module
namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/bank-accounts")]
    public class BankAccountsController : ApiControllerBase
    {
        private readonly ISimpleAccountsService _accountsService;
        private readonly ILedgerService _bankLedgerService;

        public BankAccountsController(ISimpleAccountsService accountsService, ILedgerService bankLedgerService)
        {
            _accountsService = accountsService;
            _bankLedgerService = bankLedgerService;
        }

        [HttpGet]
        public async Task<IActionResult> GetBankAccounts(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null)
        {
            try
            {
                var result = await _accountsService.GetBankAccountsAsync(pageNumber, pageSize, search, status);
                return Ok(ApiResponse<PagedResult<BankAccountDto>>.CreateSuccess(result, "Bank accounts retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("dropdown")]
        public async Task<IActionResult> GetBankAccountDropdown()
        {
            try
            {
                var list = await _accountsService.GetBankAccountDropdownAsync();
                return Ok(ApiResponse<List<BankAccountDropdownDto>>.CreateSuccess(list, "Bank account dropdown retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetBankAccountById(Guid id)
        {
            try
            {
                var bank = await _accountsService.GetBankAccountByIdAsync(id);
                if (bank == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Bank account not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<BankAccountDto>.CreateSuccess(bank, "Bank account retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateBankAccount([FromBody] CreateBankAccountRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var created = await _accountsService.CreateBankAccountAsync(request);
                return CreatedAtAction(nameof(GetBankAccountById), new { id = created.Id }, ApiResponse<BankAccountDto>.CreateSuccess(created, "Bank account created successfully."));
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
        public async Task<IActionResult> UpdateBankAccount(Guid id, [FromBody] UpdateBankAccountRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var updated = await _accountsService.UpdateBankAccountAsync(id, request);
                if (updated == null)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Bank account not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<BankAccountDto>.CreateSuccess(updated, "Bank account updated successfully."));
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
        public async Task<IActionResult> DeleteBankAccount(Guid id)
        {
            try
            {
                var success = await _accountsService.DeleteBankAccountAsync(id);
                if (!success)
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Bank account not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return Ok(ApiResponse<bool>.CreateSuccess(true, "Bank account deleted successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
        [HttpGet("{id:guid}/ledger")]
        public async Task<IActionResult> GetBankLedger(
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
            try
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
                
                var result = await _bankLedgerService.GetLedgerAsync(id, pageNumber, pageSize, search, filter);
                return Ok(ApiResponse<PagedResult<BankLedgerEntryDto>>.CreateSuccess(result, "Bank ledger retrieved successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("{id:guid}/summary")]
        public async Task<IActionResult> GetBankSummary(Guid id)
        {
            try
            {
                var result = await _bankLedgerService.GetBankSummaryAsync(id);
                return Ok(ApiResponse<BankSummaryDto>.CreateSuccess(result, "Bank summary retrieved successfully."));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.CreateFailure(ex.Message, "Not Found", HttpContext.TraceIdentifier));
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(ApiResponse<object>.CreateFailure("Bank account not found.", "Not Found", HttpContext.TraceIdentifier));
                }
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("ledger/{ledgerEntryId:guid}/history")]
        public async Task<IActionResult> GetBankLedgerHistory(Guid ledgerEntryId)
        {
            try
            {
                var result = await _bankLedgerService.GetLedgerHistoryAsync(ledgerEntryId);
                return Ok(ApiResponse<List<BankLedgerAuditEntryDto>>.CreateSuccess(result, "Bank ledger history retrieved successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpPost("{id:guid}/deposit")]
        public async Task<IActionResult> AddBankMoney(Guid id, [FromBody] AddMoneyRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var entryId = await _bankLedgerService.AddMoneyAsync(id, null, request);
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
        public async Task<IActionResult> UpdateBankDeposit(Guid ledgerEntryId, [FromBody] AddMoneyRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Invalid model state.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                await _bankLedgerService.UpdateDepositAsync(ledgerEntryId, request);
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
        public async Task<IActionResult> DeleteBankDeposit(Guid ledgerEntryId)
        {
            try
            {
                await _bankLedgerService.DeleteDepositAsync(ledgerEntryId);
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
        public async Task<IActionResult> ReverseBankLedgerEntry(Guid ledgerEntryId, [FromBody] ReverseLedgerRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                return BadRequest(ApiResponse<object>.CreateFailure("Reversal reason is required.", "Validation Error", HttpContext.TraceIdentifier));
            }

            try
            {
                var reversalId = await _bankLedgerService.ReverseTransactionAsync(ledgerEntryId, request.Reason);
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

    public class ReverseLedgerRequest
    {
        public string Reason { get; set; } = string.Empty;
    }
}
