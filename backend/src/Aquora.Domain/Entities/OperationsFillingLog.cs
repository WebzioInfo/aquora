using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperationsFillingLog : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public Guid ProductId { get; set; }
        public virtual Product Product { get; set; } = null!;

        public Guid BrandId { get; set; }
        public virtual Brand Brand { get; set; } = null!;

        public int FilledCount { get; set; }
        public int RejectedCount { get; set; }
        public int LeakageCount { get; set; }
        public int CapFailureCount { get; set; }
        public int SealFailureCount { get; set; }

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
