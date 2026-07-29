using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class JournalEntryLine : BaseEntity, IMultiTenant, ICompanySpecific
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid JournalEntryId { get; set; }
        public virtual JournalEntry JournalEntry { get; set; } = null!;

        public Guid AccountId { get; set; }
        public virtual Account Account { get; set; } = null!;

        public string Description { get; set; } = string.Empty;

        public decimal DebitAmount { get; set; }
        public decimal CreditAmount { get; set; }
    }
}
