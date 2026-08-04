using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class PurchasePayment : BaseEntity
    {
        public Guid PurchaseId { get; set; }
        public virtual Purchase Purchase { get; set; } = null!;

        public DateTime PaymentDate { get; set; }
        public string PaymentMethod { get; set; } = "BankAccount"; // Cash, BankAccount, UPI, Cheque
        public Guid? BankAccountId { get; set; }
        public virtual BankAccount? BankAccount { get; set; }
        public Guid? CashBookId { get; set; }
        public virtual CashBook? CashBook { get; set; }

        public decimal Amount { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
    }
}
