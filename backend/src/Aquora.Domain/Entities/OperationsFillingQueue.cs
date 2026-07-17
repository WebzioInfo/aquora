using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperationsFillingQueue : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid DistributorId { get; set; }
        public virtual Customer Distributor { get; set; } = null!;

        public Guid? VisitId { get; set; }
        public virtual OperationsVisit Visit { get; set; }

        public Guid BrandId { get; set; }
        public virtual Brand Brand { get; set; } = null!;

        public string Priority { get; set; } = "Normal"; // Immediate, High, Normal, Scheduled
        public int RequestedQuantity { get; set; }
        public int RemainingQuantity { get; set; }
        public int CompletedQuantity { get; set; }
        
        public string Status { get; set; } = "Pending"; // Pending, InProgress, Completed, Cancelled

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

