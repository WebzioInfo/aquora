using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperationsJarCondition : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid VisitId { get; set; }
        public virtual OperationsVisit Visit { get; set; } = null!;

        public string ConditionType { get; set; } = string.Empty; // Good, Cracked, Broken, Leak, Thread Damage, Oil Smell, etc.
        public int Quantity { get; set; }
        
        public string? DamageLocation { get; set; } // Unloading, Washing, Filling, Loading, Customer, Transport
        public string? Responsibility { get; set; } // Company, Distributor, Transport, Third Party

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

