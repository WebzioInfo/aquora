using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class OperationsLoading : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        public Guid CompanyId { get; set; }

        public Guid VisitId { get; set; }
        public virtual OperationsVisit Visit { get; set; } = null!;

        public Guid ProductId { get; set; }
        public virtual Product Product { get; set; } = null!;

        public Guid BrandId { get; set; }
        public virtual Brand Brand { get; set; } = null!;

        public string BatchNumber { get; set; } = string.Empty;
        
        public Guid? CapMaterialId { get; set; }
        public virtual RawMaterial CapMaterial { get; set; }
        
        public Guid? SealMaterialId { get; set; }
        public virtual RawMaterial SealMaterial { get; set; }

        public bool SealRequired { get; set; }
        public int QuantityLoaded { get; set; }
        
        public string LoadedBy { get; set; } = string.Empty;
        public DateTime LoadingTime { get; set; }
        public string VehicleNumber { get; set; } = string.Empty;
        
        public string? Remarks { get; set; }

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

