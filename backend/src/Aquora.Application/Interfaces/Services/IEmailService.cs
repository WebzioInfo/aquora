using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true, CancellationToken cancellationToken = default);
        Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes, CancellationToken cancellationToken = default);
        Task<(bool Success, string ErrorMessage)> VerifySmtpConfigurationAsync();
    }
}

