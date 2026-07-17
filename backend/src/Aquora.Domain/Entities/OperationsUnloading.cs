using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperationsUnloading : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid VisitId { get; set; }
        public virtual OperationsVisit Visit { get; set; } = null!;

        public Guid BrandId { get; set; }
        public virtual Brand Brand { get; set; } = null!;

        public int ReturnedEmptyCount { get; set; }
        
        // Requirements logic
        public int ImmediateRequirement { get; set; }
        public int LaterRequirement { get; set; }
        public int ScheduledRequirement { get; set; }
        public DateTime? ScheduledDate { get; set; }

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

