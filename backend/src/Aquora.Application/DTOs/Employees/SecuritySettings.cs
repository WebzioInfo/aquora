using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Employees
{
    public class SecuritySettingsRequest
    {
        [Required(ErrorMessage = "PIN is required.")]
        [MinLength(4, ErrorMessage = "PIN must be at least 4 digits.")]
        public string Pin { get; set; }

        [Required(ErrorMessage = "Confirm PIN is required.")]
        public string ConfirmPin { get; set; }
    }

    public class VerifyPinRequest
    {
        [Required(ErrorMessage = "PIN is required.")]
        public string Pin { get; set; }
    }

    public class RevealPasswordRequest
    {
        [Required(ErrorMessage = "Employee ID is required.")]
        public System.Guid EmployeeId { get; set; }

        [Required(ErrorMessage = "PIN is required.")]
        public string Pin { get; set; }
    }
}
