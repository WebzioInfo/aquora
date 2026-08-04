using System;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    public class BankSummaryDto
    {
        public decimal CurrentBalance { get; set; }
        public decimal TotalMoneyReceived { get; set; }
        public decimal TotalMoneyPaid { get; set; }
        public int TotalTransactions { get; set; }
        
        public decimal LargestDeposit { get; set; }
        public decimal LargestExpense { get; set; }
        
        public int TodaysTransactions { get; set; }
        public int ThisMonthTransactions { get; set; }
        public decimal AverageMonthlyFlow { get; set; }
        public DateTime? LastTransactionDate { get; set; }
        public string? LastTransactionDescription { get; set; }
        public decimal LastTransactionAmount { get; set; }
    }
}
