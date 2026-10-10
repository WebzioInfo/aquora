using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.SimpleAccounts
{
    public class SettleCashBookRequest
    {
        [Range(0.01, double.MaxValue, ErrorMessage = "Settlement amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Settlement mode is required (Cash or Bank).")]
        public string SettlementVia { get; set; } = "Cash"; // "Cash" or "Bank"

        public Guid? SourceCashBookId { get; set; }

        public Guid? SourceBankAccountId { get; set; }

        [Required(ErrorMessage = "Date is required.")]
        public DateTime Date { get; set; } = DateTime.UtcNow;

        public string? ReferenceNo { get; set; }

        public string? Description { get; set; }

        public bool IsOwnerContribution { get; set; } = false;

        public Guid? OwnerId { get; set; }
    }
}
