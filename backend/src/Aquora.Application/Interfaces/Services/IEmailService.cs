using System.Threading.Tasks;

namespace Aquora.Application.Interfaces.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true);
        Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes);
    }
}
