using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities.Finance
{
    public class PettyCashSession : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public DateTime SessionDate { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal CashReceived { get; set; }
        public decimal CashSpent { get; set; }
        public decimal ClosingBalance { get; set; }
        
        public string Status { get; set; } = "Open"; // Open, Closed, Verified
        public Guid? VerifiedById { get; set; }
        
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        public string? CreatedByIP { get; set; }
        public string? UpdatedByIP { get; set; }
    }
}
