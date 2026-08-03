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
    [Route("api/v1/simple-accounts")]
    public class SimpleAccountsController : ApiControllerBase
    {
        private readonly ISimpleAccountsService _accountsService;

        public SimpleAccountsController(ISimpleAccountsService accountsService)
        {
            _accountsService = accountsService;
        }

        [HttpGet("asset-summary")]
        public async Task<IActionResult> GetAssetSummary()
        {
            try
            {
                var summary = await _accountsService.GetAssetSummaryAsync();
                return Ok(ApiResponse<AssetSummaryDto>.CreateSuccess(summary, "Asset summary retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }

        [HttpGet("dashboard-summary")]
        public async Task<IActionResult> GetDashboardSummary()
        {
            try
            {
                var summary = await _accountsService.GetDashboardSummaryAsync();
                return Ok(ApiResponse<SimpleAccountsDashboardSummaryDto>.CreateSuccess(summary, "Dashboard summary retrieved successfully."));
            }
            catch (Exception ex)
            {
                return BadRequest(ApiResponse<object>.CreateFailure(ex.Message, "Error", HttpContext.TraceIdentifier));
            }
        }
    }
}
