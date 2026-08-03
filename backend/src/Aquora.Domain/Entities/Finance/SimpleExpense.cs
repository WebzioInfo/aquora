using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class SimpleExpense : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string ExpenseNumber { get; set; } = string.Empty;
        public DateTime ExpenseDate { get; set; }
        public string Category { get; set; } = string.Empty; // Salary, Electricity, Fuel, Maintenance, Vehicle, Rent, Office, Purchase Related, Miscellaneous
        public string? Vendor { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = "Cash"; // Cash, Bank, etc.
        public Guid? BankAccountId { get; set; }
        public virtual BankAccount? BankAccount { get; set; }
        public Guid? CashBookId { get; set; }
        public virtual CashBook? CashBook { get; set; }
        public string? Notes { get; set; }

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        // Soft Delete fields
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
