using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class BankAccount : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string BankName { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string AccountNumber { get; set; } = string.Empty;
        public string AccountType { get; set; } = "Current"; // Current, Savings, OD
        public string? Branch { get; set; }
        public string? IFSC { get; set; }
        public string IfscCode
        {
            get => !string.IsNullOrWhiteSpace(IFSC) ? IFSC : string.Empty;
            set => IFSC = value;
        }

        public decimal OpeningBalance { get; set; }
        public decimal CurrentBalance { get; set; }
        public string? Notes { get; set; }
        public string Status { get; set; } = "Active"; // Active, Inactive

        public Guid? LinkedLedgerAccountId { get; set; }
        public virtual Account? LinkedLedgerAccount { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }

        // Soft Delete
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
