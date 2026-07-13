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
        public string PasswordOrPin { get; set; }
    }
}
