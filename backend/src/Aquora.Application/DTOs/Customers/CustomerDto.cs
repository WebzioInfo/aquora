using System;

namespace Aquora.Application.DTOs.Customers
{
    public class CustomerDto
    {
        public Guid Id { get; set; }
        public Guid CompanyId { get; set; }
        public string CustomerCode { get; set; } = string.Empty;
        public string CustomerType { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? BusinessName { get; set; }
        public string? ContactPerson { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string? AlternatePhone { get; set; }
        public string? Email { get; set; }

        public string? GSTNumber { get; set; }
        public string? PANNumber { get; set; }
        public string? BusinessType { get; set; }
        public string? GSTState { get; set; }

        public string AddressLine1 { get; set; } = string.Empty;
        public string? AddressLine2 { get; set; }
        public string City { get; set; } = string.Empty;
        public string District { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string PinCode { get; set; } = string.Empty;

        public decimal OpeningBalance { get; set; }
        public string BalanceType { get; set; } = "Zero";
        public decimal CreditLimit { get; set; }
        public string PaymentTerms { get; set; } = string.Empty;

        public string Status { get; set; } = "Active";
        public bool IsActive { get; set; }
        public string? Remarks { get; set; }

        // Expanded Business Partner Profiles
        public string? WhatsApp { get; set; }
        public string? Website { get; set; }
        public string? PhotoUrl { get; set; }

        public string? BusinessRegistration { get; set; }
        public string? BusinessCategory { get; set; }
        public string? Industry { get; set; }
        public string? TradeLicense { get; set; }
        public bool TaxExempt { get; set; }

        public string? AddressesJson { get; set; }

        // Financial Settings
        public string? PriceList { get; set; }
        public string? DiscountGroup { get; set; }
        public string? TaxCategory { get; set; }
        public decimal OutstandingPlaceholder { get; set; }
        public string? LedgerPlaceholder { get; set; }
        public string? AccountingPlaceholder { get; set; }

        // Logistics/Distributor Profile details
        public string? DistributorType { get; set; }
        public decimal CommissionPercentage { get; set; }
        public decimal MonthlySalary { get; set; }
        public decimal SecurityDeposit { get; set; }
        
        public string? AssignedRoute { get; set; }
        public string? AssignedVehicle { get; set; }
        public string? AssignedDriver { get; set; }
        public string? AssignedSalesExecutive { get; set; }
        public string? DefaultDeliveryPriority { get; set; }
        public string? WorkingArea { get; set; }
        public string? WorkingDays { get; set; }

        // 20L Water Plant operations settings
        public decimal JarDeposit { get; set; }
        public int OutstandingJars { get; set; }
        public int MaxJarLimit { get; set; }
        public string? PreferredJarBrand { get; set; }
        public string? PreferredCapMaterial { get; set; }
        public bool SealRequired { get; set; }
        public string? PreferredDeliveryWindow { get; set; }
        public bool EmergencyDelivery { get; set; }
        public bool PriorityCustomer { get; set; }

        public string? PreferredProductsJson { get; set; }
        public string? PreferredDeliveryTime { get; set; }
        public string? DeliveryFrequency { get; set; }

        public string? ContactsJson { get; set; }
        public string? DocumentsJson { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
