using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Application.DTOs.Finance;

namespace Aquora.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FinanceController : ControllerBase
    {
        private readonly IFinanceService _financeService;

        public FinanceController(IFinanceService financeService)
        {
            _financeService = financeService;
        }

        [HttpGet("accounts")]
        public async Task<IActionResult> GetAccounts()
        {
            var accounts = await _financeService.GetAccountsAsync();
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(accounts));
        }
        
        [HttpGet("account-groups")]
        public async Task<IActionResult> GetAccountGroups()
        {
            var groups = await _financeService.GetAccountGroupsAsync();
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(groups));
        }

        [HttpPost("seed")]
        public async Task<IActionResult> Seed()
        {
            await _financeService.SeedDefaultChartOfAccountsAsync();
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess("Seeded successfully"));
        }

        [HttpGet("journals")]
        public async Task<IActionResult> GetJournals([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var journals = await _financeService.GetJournalEntriesAsync(startDate, endDate);
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(journals));
        }

        [HttpPost("journals")]
        public async Task<IActionResult> CreateJournal([FromBody] CreateJournalEntryRequest request)
        {
            var journal = await _financeService.CreateJournalEntryAsync(request);
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(journal));
        }

        [HttpGet("assets")]
        public async Task<IActionResult> GetAssets()
        {
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(await _financeService.GetAssetsAsync()));
        }

        [HttpPost("assets")]
        public async Task<IActionResult> CreateAsset([FromBody] AssetDto request)
        {
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(await _financeService.CreateAssetAsync(request.Name, request.AssetType, request.PurchasePrice, request.PurchaseDate)));
        }

        [HttpGet("expenses")]
        public async Task<IActionResult> GetExpenses()
        {
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(await _financeService.GetExpensesAsync()));
        }

        [HttpPost("expenses")]
        public async Task<IActionResult> CreateExpense([FromBody] ExpenseRecordDto request)
        {
            return Ok(Aquora.Shared.Models.ApiResponse<object>.CreateSuccess(await _financeService.CreateExpenseAsync(request.Description, request.Category, request.Amount, request.ExpenseDate)));
        }
    }
}
