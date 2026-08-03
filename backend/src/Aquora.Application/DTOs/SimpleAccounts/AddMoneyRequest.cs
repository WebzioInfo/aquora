using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    public class AddMoneyRequest
    {
        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Source is required.")]
        public string Source { get; set; } = string.Empty;

        public string? ReferenceNo { get; set; }

        [Required(ErrorMessage = "Date is required.")]
        public DateTime Date { get; set; } = DateTime.UtcNow;

        public string? Description { get; set; }
    }
}
