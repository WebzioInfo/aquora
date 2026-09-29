namespace Aquora.Application.DTOs.Auth
{
    public class PasswordResetRequest
    {
        public string Email { get; set; } = string.Empty;
        public string? ResetToken { get; set; }
        public string? Code { get; set; }
        public string NewPassword { get; set; } = string.Empty;
        public string? ConfirmPassword { get; set; }
    }
}
