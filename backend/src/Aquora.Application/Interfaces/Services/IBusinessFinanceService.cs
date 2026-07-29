using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Aquora.Application.DTOs.BusinessFinance;

namespace Aquora.Application.Interfaces.Services
{
    public interface IBusinessFinanceService
    {
        Task<DashboardKpiDto> GetDashboardKpisAsync();
        Task<List<ExpenseAnalyticsDto>> GetExpenseAnalyticsAsync();
        Task<ProductionCostDto> GetProductionCostAnalysisAsync();
        Task<List<MaterialLossDto>> GetMaterialLossAnalysisAsync();
        Task<List<MachineCostDto>> GetMachineCostAnalysisAsync();
        Task<List<EmployeeImpactDto>> GetEmployeeImpactAsync();
        Task<List<ProductProfitabilityDto>> GetProductProfitabilityAsync();
        Task<List<CustomerAnalyticsDto>> GetCustomerAnalyticsAsync();
        Task<List<AiInsightDto>> GetAiInsightsAsync();
    }
}
