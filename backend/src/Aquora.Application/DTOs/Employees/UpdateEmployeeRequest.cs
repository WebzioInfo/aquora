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

        [Required(ErrorMessage = "Current Salary is required.")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Current Salary must be greater than zero.")]
        public decimal CurrentSalary { get; set; }
    }
}
