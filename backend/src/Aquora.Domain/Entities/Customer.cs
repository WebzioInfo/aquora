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
        public string? PaymentTerms { get; set; } = "COD";

        // Expanded Business Partner Profiles
        public string? WhatsApp { get; set; }
        public string? Website { get; set; }
        public string? PhotoUrl { get; set; }

        public string? BusinessRegistration { get; set; }
        public string? BusinessCategory { get; set; }
        public string? Industry { get; set; }
        public string? TradeLicense { get; set; }
        public bool TaxExempt { get; set; } = false;

        public string? AddressesJson { get; set; } // JSON list of Billing, Shipping, Warehouse

        // Financial Settings
        public string? PriceList { get; set; }
        public string? DiscountGroup { get; set; }
        public decimal Price { get; set; } = 0;
        public decimal Discount { get; set; } = 0;
        public string? TaxCategory { get; set; }
        public decimal OutstandingPlaceholder { get; set; } = 0;
        public string? LedgerPlaceholder { get; set; }
        public string? AccountingPlaceholder { get; set; }

        // Logistics/Distributor Profile details
        public string? DistributorType { get; set; } // Company Owned, Commission, Salary, Independent
        public decimal CommissionPercentage { get; set; } = 0;
        public decimal MonthlySalary { get; set; } = 0;
        public decimal SecurityDeposit { get; set; } = 0;
        
        public string? AssignedRoute { get; set; }
        public string? AssignedVehicle { get; set; }
        public string? AssignedDriver { get; set; }
        public string? AssignedSalesExecutive { get; set; }
        public string? DefaultDeliveryPriority { get; set; } = "Normal";
        public string? WorkingArea { get; set; }
        public string? WorkingDays { get; set; } // e.g. Mon,Tue,Wed

        // 20L Water Plant operations settings
        public decimal JarDeposit { get; set; } = 0;
        public int OutstandingJars { get; set; } = 0;
        public int MaxJarLimit { get; set; } = 0;
        public int ReservedEmptyJars { get; set; } = 0;
        public string? PreferredJarBrand { get; set; }
        public string? PreferredCapMaterial { get; set; }
        public bool SealRequired { get; set; } = false;
        public string? PreferredDeliveryWindow { get; set; }
        public bool EmergencyDelivery { get; set; } = false;
        public bool PriorityCustomer { get; set; } = false;

        public string? PreferredProductsJson { get; set; } // JSON of product mappings
        public string? PreferredDeliveryTime { get; set; } // Morning, Afternoon, Evening
        public string? DeliveryFrequency { get; set; } // Daily, Alternate Day

        public string? ContactsJson { get; set; } // JSON list of multiple stakeholders
        public string? DocumentsJson { get; set; } // JSON files mapping placeholders

        // Operations status
        public string Status { get; set; } = "Active"; // Active, Inactive
        public bool IsActive { get; set; } = true;
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

