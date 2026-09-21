using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true, CancellationToken cancellationToken = default);
        Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes, string purpose = "Verification", string? userName = null, CancellationToken cancellationToken = default);
        Task SendPasswordChangedNotificationAsync(string toEmail, string? userName = null, CancellationToken cancellationToken = default);
        Task SendEmailChangedNotificationAsync(string oldEmail, string newEmail, string? userName = null, CancellationToken cancellationToken = default);
        Task<(bool Success, string ErrorMessage)> VerifySmtpConfigurationAsync();
    }
}

