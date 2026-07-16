using System;
using Aquora.Domain.Common;

namespace Aquora.Domain.Entities
{
    public class Customer : BaseEntity, IMultiTenant, ICompanySpecific, IAuditable, ISoftDelete
    {
        public Guid TenantId { get; set; }
        
        public Guid CompanyId { get; set; }
        public virtual Company Company { get; set; } = null!;

        public string CustomerCode { get; set; } = string.Empty;
        public string CustomerType { get; set; } = string.Empty; // B2B / B2C
        public string CustomerName { get; set; } = string.Empty;
        public string? BusinessName { get; set; }
        public string? ContactPerson { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string? AlternatePhone { get; set; }
        public string? Email { get; set; }

        // B2B business details
        public string? GSTNumber { get; set; }
        public string? PANNumber { get; set; }
        public string? BusinessType { get; set; }
        public string? GSTState { get; set; }

        // Address info
        public string AddressLine1 { get; set; } = string.Empty;
        public string? AddressLine2 { get; set; }
        public string City { get; set; } = string.Empty;
        public string District { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string PinCode { get; set; } = string.Empty;

        // Financial info
        public decimal OpeningBalance { get; set; } = 0;
        public string BalanceType { get; set; } = "Zero"; // Receivable, Payable, Zero
        public decimal CreditLimit { get; set; } = 0;
        public string PaymentTerms { get; set; } = string.Empty;

        // Operations status
        public string Status { get; set; } = "Active"; // Active, Inactive
        public bool IsActive { get; set; } = true;
        public string? Remarks { get; set; }

        // Auditable fields
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }

        // Soft Delete fields
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public string? DeletedBy { get; set; }
    }
}
