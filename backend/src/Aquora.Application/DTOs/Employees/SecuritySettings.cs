using System.ComponentModel.DataAnnotations;

namespace Aquora.Application.DTOs.Employees
{
    public class SecuritySettingsRequest
    {
        public string? AdminPin { get; set; }
        public string? Pin { get; set; }
        public string? ConfirmAdminPin { get; set; }
        public string? ConfirmPin { get; set; }

        public string ResolvedAdminPin => !string.IsNullOrWhiteSpace(AdminPin) ? AdminPin.Trim() : (Pin?.Trim() ?? string.Empty);
        public string ResolvedConfirmPin => !string.IsNullOrWhiteSpace(ConfirmAdminPin) ? ConfirmAdminPin.Trim() : (ConfirmPin?.Trim() ?? string.Empty);
    }

    public class VerifyPinRequest
    {
        public string? AdminPin { get; set; }
        public string? Pin { get; set; }

        public string ResolvedAdminPin => !string.IsNullOrWhiteSpace(AdminPin) ? AdminPin.Trim() : (Pin?.Trim() ?? string.Empty);
    }

    public class RevealPasswordRequest
    {
        [Required(ErrorMessage = "Employee ID is required.")]
        public System.Guid EmployeeId { get; set; }

        public string? AdminPin { get; set; }
        public string? Pin { get; set; }

        public string ResolvedAdminPin => !string.IsNullOrWhiteSpace(AdminPin) ? AdminPin.Trim() : (Pin?.Trim() ?? string.Empty);
    }
}
