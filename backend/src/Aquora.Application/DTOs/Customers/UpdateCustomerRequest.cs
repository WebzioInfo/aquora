using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Customers
{
    public class UpdateCustomerRequest
    {
        [Required(ErrorMessage = "Customer type is required.")]
        public string CustomerType { get; set; } = string.Empty; // B2B / B2C

        [Required(ErrorMessage = "Customer name is required.")]
        [StringLength(150, ErrorMessage = "Customer name cannot exceed 150 characters.")]
        public string CustomerName { get; set; } = string.Empty;

        [StringLength(150, ErrorMessage = "Business name cannot exceed 150 characters.")]
        public string? BusinessName { get; set; }

        [StringLength(100, ErrorMessage = "Contact person name cannot exceed 100 characters.")]
        public string? ContactPerson { get; set; }

        [Required(ErrorMessage = "Phone number is required.")]
        [StringLength(20, ErrorMessage = "Phone number cannot exceed 20 characters.")]
        public string Phone { get; set; } = string.Empty;

        [StringLength(20, ErrorMessage = "Alternate phone number cannot exceed 20 characters.")]
        public string? AlternatePhone { get; set; }

        [EmailAddress(ErrorMessage = "Invalid email address format.")]
        [StringLength(100, ErrorMessage = "Email cannot exceed 100 characters.")]
        public string? Email { get; set; }

        // B2B specific
        [StringLength(15, ErrorMessage = "GST number cannot exceed 15 characters.")]
        public string? GSTNumber { get; set; }

        [StringLength(10, ErrorMessage = "PAN number cannot exceed 10 characters.")]
        public string? PANNumber { get; set; }

        [StringLength(50, ErrorMessage = "Business type cannot exceed 50 characters.")]
        public string? BusinessType { get; set; }

        [StringLength(50, ErrorMessage = "GST state cannot exceed 50 characters.")]
        public string? GSTState { get; set; }

        // Address
        [Required(ErrorMessage = "Address Line 1 is required.")]
        [StringLength(200, ErrorMessage = "Address Line 1 cannot exceed 200 characters.")]
        public string AddressLine1 { get; set; } = string.Empty;

        [StringLength(200, ErrorMessage = "Address Line 2 cannot exceed 200 characters.")]
        public string? AddressLine2 { get; set; }

        [StringLength(100, ErrorMessage = "City cannot exceed 100 characters.")]
        public string? City { get; set; }

        [Required(ErrorMessage = "District is required.")]
        [StringLength(100, ErrorMessage = "District cannot exceed 100 characters.")]
        public string District { get; set; } = string.Empty;

        [Required(ErrorMessage = "State is required.")]
        [StringLength(100, ErrorMessage = "State cannot exceed 100 characters.")]
        public string State { get; set; } = string.Empty;

        [Required(ErrorMessage = "Country is required.")]
        [StringLength(100, ErrorMessage = "Country cannot exceed 100 characters.")]
        public string Country { get; set; } = string.Empty;

        [Required(ErrorMessage = "Pin Code is required.")]
        [StringLength(20, ErrorMessage = "Pin Code cannot exceed 20 characters.")]
        public string PinCode { get; set; } = string.Empty;

        // Financials
        [Range(0, double.MaxValue, ErrorMessage = "Opening balance cannot be negative.")]
        public decimal OpeningBalance { get; set; }

        [Required(ErrorMessage = "Balance type is required.")]
        public string BalanceType { get; set; } = "Zero"; // Receivable / Payable / Zero

        [Range(0, double.MaxValue, ErrorMessage = "Credit limit cannot be negative.")]
        public decimal CreditLimit { get; set; }

        [StringLength(50, ErrorMessage = "Payment terms cannot exceed 50 characters.")]
        public string? PaymentTerms { get; set; }

        public string Status { get; set; } = "Active";
        public bool IsActive { get; set; } = true;
        public string? Remarks { get; set; }

        // Expanded Business Partner Profiles
        public string? WhatsApp { get; set; }
        public string? Website { get; set; }
        public string? PhotoUrl { get; set; }

        public string? BusinessRegistration { get; set; }
        public string? BusinessCategory { get; set; }
        public string? Industry { get; set; }
        public string? TradeLicense { get; set; }
        public bool TaxExempt { get; set; } = false;

        public string? AddressesJson { get; set; }

        // Financial Settings
        public string? PriceList { get; set; }
        public string? DiscountGroup { get; set; }
        public string? TaxCategory { get; set; }
        public decimal OutstandingPlaceholder { get; set; } = 0;
        public string? LedgerPlaceholder { get; set; }
        public string? AccountingPlaceholder { get; set; }

        // Logistics/Distributor Profile details
        public string? DistributorType { get; set; }
        public decimal CommissionPercentage { get; set; } = 0;
        public decimal MonthlySalary { get; set; } = 0;
        public decimal SecurityDeposit { get; set; } = 0;
        
        public string? AssignedRoute { get; set; }
        public string? AssignedVehicle { get; set; }
        public string? AssignedDriver { get; set; }
        public string? AssignedSalesExecutive { get; set; }
        public string? DefaultDeliveryPriority { get; set; } = "Normal";
        public string? WorkingArea { get; set; }
        public string? WorkingDays { get; set; }

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

        public string? PreferredProductsJson { get; set; }
        public string? PreferredDeliveryTime { get; set; }
        public string? DeliveryFrequency { get; set; }

        public string? ContactsJson { get; set; }
        public string? DocumentsJson { get; set; }
    }
}
