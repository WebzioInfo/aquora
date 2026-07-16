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
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
