using System;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    public class BankLedgerFilterDto
    {
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public string? TransactionType { get; set; }
        public string? CreatedBy { get; set; }
        public decimal? MinimumAmount { get; set; }
        public decimal? MaximumAmount { get; set; }
        public string? SortBy { get; set; } = "TransactionDate";
        public string? SortOrder { get; set; } = "desc";
    }
}
