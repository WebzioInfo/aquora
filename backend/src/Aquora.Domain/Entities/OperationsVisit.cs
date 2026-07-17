using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperationsVisit : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public DateTime ArrivalTime { get; set; }
        public string VehicleNumber { get; set; } = string.Empty;
        public string DriverName { get; set; } = string.Empty;
        
        public Guid DistributorId { get; set; }
        public virtual Customer Distributor { get; set; } = null!;

        public DateTime? ExpectedCollectionTime { get; set; }
        public string Priority { get; set; } = "Normal";
        public string? Remarks { get; set; }

        public string Status { get; set; } = "Arrival"; // Arrival, Unloading, Queued, Loading, Completed

        // Navigation Properties
        public virtual ICollection<OperationsUnloading> Unloadings { get; set; } = new List<OperationsUnloading>();
        public virtual ICollection<OperationsJarCondition> JarConditions { get; set; } = new List<OperationsJarCondition>();
        public virtual ICollection<OperationsQuarantine> Quarantines { get; set; } = new List<OperationsQuarantine>();
        public virtual ICollection<OperationsLoading> Loadings { get; set; } = new List<OperationsLoading>();

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

