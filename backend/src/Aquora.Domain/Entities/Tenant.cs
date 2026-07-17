using System;
using System.Collections.Generic;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class Tenant : BaseEntity, IAuditable, ISoftDelete
    {
        public string Name { get; set; }
        public string Code { get; set; }
        public string SchemaName { get; set; }
        public string Subdomain { get; set; }
        public string? CustomDomain { get; set; }
        public bool IsActive { get; set; } = true;

        public bool IsInitialized { get; set; } = false;
        public DateTime? InitializedAt { get; set; }
        public string? InitializedBy { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Initializing, Completed
        public int Progress { get; set; } = 0;
        public string? CurrentStep { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? FailureReason { get; set; }
        public int RetryCount { get; set; } = 0;
        public double Duration { get; set; } = 0;

        public virtual ICollection<TenantDomain> Domains { get; set; } = new List<TenantDomain>();

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; }
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

