using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Employees
{
    public class CreateEmployeeRequest
    {
        [Required(ErrorMessage = "Full Name is required.")]
        public string FullName { get; set; }

        [Required(ErrorMessage = "Username is required.")]
        [MinLength(3, ErrorMessage = "Username must be at least 3 characters.")]
        public string Username { get; set; }

        [Required(ErrorMessage = "Role is required.")]
        public string RoleCode { get; set; }

        [Required(ErrorMessage = "Password or PIN is required.")]
        [MinLength(4, ErrorMessage = "Password or PIN must be at least 4 characters.")]
        public string PasswordOrPin { get; set; }

        public string? Department { get; set; }
    }
}
