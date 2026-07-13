using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Employees
{
    public class UpdateEmployeeRequest
    {
        [Required(ErrorMessage = "Full Name is required.")]
        public string FullName { get; set; }

        [Required(ErrorMessage = "Role is required.")]
        public string RoleCode { get; set; }

        public string? Department { get; set; }
        public bool IsActive { get; set; }
    }
}
