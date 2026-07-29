using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class BankAccount : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
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
        
        public Guid LinkedLedgerAccountId { get; set; }
        public virtual Account LinkedLedgerAccount { get; set; } = null!;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
