using System;
using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Employees
{
    public class ResetEmployeePasswordRequest
    {
        [Required]
        public Guid EmployeeId { get; set; }

        [Required(ErrorMessage = "Password or PIN is required.")]
        [MinLength(4, ErrorMessage = "Password or PIN must be at least 4 characters.")]
        public string PasswordOrPin { get; set; } = string.Empty;

        public string? AdminPin { get; set; }
        public string? Pin { get; set; }

        public string ResolvedAdminPin => !string.IsNullOrWhiteSpace(AdminPin)
            ? AdminPin.Trim()
            : (!string.IsNullOrWhiteSpace(Pin) ? Pin.Trim() : string.Empty);
    }
}
