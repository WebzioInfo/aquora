using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class AccountGroup : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string Name { get; set; } = string.Empty; // e.g. Current Assets, Current Liabilities, Revenue
        public string Type { get; set; } = string.Empty; // Asset, Liability, Equity, Revenue, Expense
        public string Code { get; set; } = string.Empty; // e.g. 1000
        
        public Guid? ParentGroupId { get; set; }
        public virtual AccountGroup? ParentGroup { get; set; }
        public virtual ICollection<AccountGroup> SubGroups { get; set; } = new List<AccountGroup>();
        
        public virtual ICollection<Account> Accounts { get; set; } = new List<Account>();

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
