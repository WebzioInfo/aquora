using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Aquora.Application.Interfaces.Services;
using Aquora.Shared.Models;

namespace Aquora.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class BusinessFinanceController : ApiControllerBase
    {
        private readonly IBusinessFinanceService _financeService;

        public BusinessFinanceController(IBusinessFinanceService financeService)
        {
            _financeService = financeService;
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetDashboardKpisAsync()));
        }

        [HttpGet("expenses")]
        public async Task<IActionResult> GetExpenses()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetExpenseAnalyticsAsync()));
        }

        [HttpGet("production-cost")]
        public async Task<IActionResult> GetProductionCost()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetProductionCostAnalysisAsync()));
        }

        [HttpGet("material-loss")]
        public async Task<IActionResult> GetMaterialLoss()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetMaterialLossAnalysisAsync()));
        }

        [HttpGet("machine-cost")]
        public async Task<IActionResult> GetMachineCost()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetMachineCostAnalysisAsync()));
        }

        [HttpGet("employee-impact")]
        public async Task<IActionResult> GetEmployeeImpact()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetEmployeeImpactAsync()));
        }

        [HttpGet("product-profitability")]
        public async Task<IActionResult> GetProductProfitability()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetProductProfitabilityAsync()));
        }

        [HttpGet("customer-analytics")]
        public async Task<IActionResult> GetCustomerAnalytics()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetCustomerAnalyticsAsync()));
        }

        [HttpGet("insights")]
        public async Task<IActionResult> GetInsights()
        {
            return Ok(ApiResponse<object>.CreateSuccess(await _financeService.GetAiInsightsAsync()));
        }
    }
}
