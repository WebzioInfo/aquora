using System;
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
    [Route("api/v1/accounts-ledger")]
    public class AccountsLedgerController : ApiControllerBase
    {
        private readonly ILedgerService _ledgerService;

        public AccountsLedgerController(ILedgerService ledgerService)
        {
            _ledgerService = ledgerService;
        }

        [HttpGet("transactions")]
        public async Task<IActionResult> GetTransactions([FromQuery] UnifiedLedgerFilterDto filter)
        {
            try
            {
                var result = await _ledgerService.GetUnifiedLedgerAsync(filter);
                return Ok(ApiResponse<PagedResult<UnifiedLedgerEntryDto>>.CreateSuccess(result, "Transactions retrieved successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary([FromQuery] UnifiedLedgerFilterDto filter)
        {
            try
            {
                var result = await _ledgerService.GetUnifiedLedgerSummaryAsync(filter);
                return Ok(ApiResponse<UnifiedLedgerSummaryDto>.CreateSuccess(result, "Summary retrieved successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("accounts")]
        public async Task<IActionResult> GetAccounts()
        {
            try
            {
                var result = await _ledgerService.GetAccountsMetadataAsync();
                return Ok(ApiResponse<AccountsMetadataDto>.CreateSuccess(result, "Accounts metadata retrieved successfully."));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
