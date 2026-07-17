using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperationsQuarantine : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid VisitId { get; set; }
        public virtual OperationsVisit Visit { get; set; } = null!;

        public string Reason { get; set; } = string.Empty; // Oil, Diesel, Chemical, Paint, Pesticide, Other
        public int HoldDurationHours { get; set; } // 24, 48, 72, Custom
        public int Quantity { get; set; }
        
        public string Status { get; set; } = "Quarantined"; // Quarantined, Released, Scrapped

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

