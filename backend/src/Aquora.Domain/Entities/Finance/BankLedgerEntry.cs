using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class BankLedgerEntry : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public Guid? BankAccountId { get; set; }
        public virtual BankAccount? BankAccount { get; set; }

        public Guid? CashBookId { get; set; }
        public virtual CashBook? CashBook { get; set; }
        public string? LedgerAccountType { get; set; } = "BankAccount";

        public DateTime TransactionDate { get; set; }
        
        public string ReferenceNumber { get; set; } = string.Empty;
        
        // TransactionType: Expense, Sales Payment, Customer Payment, Supplier Refund, Owner Investment, Owner Withdrawal, Opening Balance, etc.
        public string TransactionType { get; set; } = string.Empty;
        
        public string Description { get; set; } = string.Empty;
        
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        
        public decimal RunningBalance { get; set; }
        
        // Navigation to related entity (e.g., ExpenseId, SalesPaymentId)
        public Guid? RelatedEntityId { get; set; }
        public string? RelatedEntityType { get; set; } // "Expense", "SalesPayment", "OwnerInvestment"

        public int LedgerSequence { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
