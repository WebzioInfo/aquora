using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Customers
{
    public class QuickCreateCustomerRequest
    {
        [Required(ErrorMessage = "Customer Name is required.")]
        [StringLength(150, ErrorMessage = "Customer name cannot exceed 150 characters.")]
        public string CustomerName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Phone number is required.")]
        [StringLength(20, ErrorMessage = "Phone number cannot exceed 20 characters.")]
        public string Phone { get; set; } = string.Empty;

        public string CustomerType { get; set; } = "Distributor"; // Distributor / B2B / B2C

        [StringLength(50, ErrorMessage = "Vehicle number cannot exceed 50 characters.")]
        public string? AssignedVehicle { get; set; }

        [StringLength(100, ErrorMessage = "Assigned route cannot exceed 100 characters.")]
        public string? AssignedRoute { get; set; }

        [StringLength(200, ErrorMessage = "Address Line 1 cannot exceed 200 characters.")]
        public string? AddressLine1 { get; set; }

        [StringLength(100, ErrorMessage = "City cannot exceed 100 characters.")]
        public string? City { get; set; }

        [StringLength(50, ErrorMessage = "Payment terms cannot exceed 50 characters.")]
        public string? PaymentTerms { get; set; } = "COD";
    }
}
