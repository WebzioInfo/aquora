using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class Account : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string AccountName { get; set; } = string.Empty;
        public string AccountCode { get; set; } = string.Empty; // e.g. 1001

        public Guid AccountGroupId { get; set; }
        public virtual AccountGroup AccountGroup { get; set; } = null!;

        public decimal OpeningBalance { get; set; }
        public string BalanceType { get; set; } = "Dr"; // Dr (Debit) or Cr (Credit)
        
        public decimal CurrentBalance { get; set; } // Maintained by Journal entries for fast read
        
        public bool IsActive { get; set; } = true;
        
        // Link to other entities if it's a specific ledger
        public Guid? LinkedCustomerId { get; set; }
        public virtual Customer? LinkedCustomer { get; set; }
        
        public Guid? LinkedSupplierId { get; set; }
        
        public virtual ICollection<JournalEntryLine> JournalLines { get; set; } = new List<JournalEntryLine>();

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
        
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
