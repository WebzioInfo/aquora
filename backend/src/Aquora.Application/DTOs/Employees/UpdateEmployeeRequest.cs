using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Employees
{
    public class UpdateEmployeeRequest
    {
        [Required(ErrorMessage = "Full Name is required.")]
        public string FullName { get; set; }

        [Required(ErrorMessage = "Username is required.")]
        [MinLength(3, ErrorMessage = "Username must be at least 3 characters.")]
        public string Username { get; set; }

        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email address.")]
        public string Email { get; set; }

        public string? Pin { get; set; }

        [Required(ErrorMessage = "Role is required.")]
        public string RoleCode { get; set; }

        public string? Department { get; set; }
        public bool IsActive { get; set; }

        [Required(ErrorMessage = "Current Salary is required.")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Current Salary must be greater than zero.")]
        public decimal CurrentSalary { get; set; }

        public string? Phone { get; set; }

        [Range(0, 100, ErrorMessage = "Ownership percentage must be between 0 and 100.")]
        public decimal? OwnershipPercentage { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Initial investment cannot be negative.")]
        public decimal? InitialInvestment { get; set; }
    }
}

