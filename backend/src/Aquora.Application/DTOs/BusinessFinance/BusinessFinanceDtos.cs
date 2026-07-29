using System;
using System.Collections.Generic;

namespace Aquora.Application.DTOs.BusinessFinance
{
    public class DashboardKpiDto
    {
        public decimal TodayRevenue { get; set; }
        public decimal TodayExpense { get; set; }
        public decimal TodayProfit { get; set; }
        
        public decimal MonthlyRevenue { get; set; }
        public decimal MonthlyExpense { get; set; }
        public decimal MonthlyProfit { get; set; }
        
        public decimal YearlyProfit { get; set; }
        public decimal CashInHand { get; set; }
        public decimal BankBalance { get; set; }
        
        public decimal PendingReceivables { get; set; }
        public decimal PendingPayables { get; set; }
        public decimal NetWorth { get; set; }
    }

    public class ExpenseAnalyticsDto
    {
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public decimal PercentageChange { get; set; }
        public string Trend { get; set; } = "Up";
    }

    public class ProductionCostDto
    {
        public decimal TotalCost { get; set; }
        public decimal CostPerBottle { get; set; }
        public decimal CostPerLiter { get; set; }
        public decimal CostPerBatch { get; set; }
        public decimal MaterialCost { get; set; }
        public decimal LabourCost { get; set; }
        public decimal ElectricityCost { get; set; }
        public decimal MachineCost { get; set; }
    }

    public class MaterialLossDto
    {
        public string MaterialName { get; set; } = string.Empty;
        public decimal TotalLossValue { get; set; }
        public decimal LossPercentage { get; set; }
        public string Trend { get; set; } = "Up";
    }

    public class MachineCostDto
    {
        public string MachineName { get; set; } = string.Empty;
        public decimal TotalCost { get; set; }
        public decimal CostPerHour { get; set; }
        public decimal DowntimeHours { get; set; }
        public decimal Efficiency { get; set; }
    }

    public class EmployeeImpactDto
    {
        public string EmployeeName { get; set; } = string.Empty;
        public decimal ProductionValue { get; set; }
        public decimal WastageValue { get; set; }
        public decimal Efficiency { get; set; }
    }

    public class ProductProfitabilityDto
    {
        public string ProductName { get; set; } = string.Empty;
        public decimal Revenue { get; set; }
        public decimal TotalCost { get; set; }
        public decimal Profit { get; set; }
        public decimal ProfitMargin { get; set; }
    }

    public class CustomerAnalyticsDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public decimal TotalRevenue { get; set; }
        public decimal OutstandingBalance { get; set; }
        public decimal CollectionRate { get; set; }
    }

    public class AiInsightDto
    {
        public string Insight { get; set; } = string.Empty;
        public string Type { get; set; } = "Warning"; // Warning, Success, Info
    }
}
