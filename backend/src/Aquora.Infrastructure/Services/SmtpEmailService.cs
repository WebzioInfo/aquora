using System;
using System.Threading.Tasks;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Aquora.Application.Interfaces.Services;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using Aquora.Infrastructure.Configuration;

namespace Aquora.Infrastructure.Services
{
    public class SmtpEmailService : IEmailService
    {
        private readonly SmtpOptions _options;
        private readonly ILogger<SmtpEmailService> _logger;

        public SmtpEmailService(IOptions<SmtpOptions> options, ILogger<SmtpEmailService> logger)
        {
            _options = options.Value;
            _logger = logger;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true)
        {
            var host = _options.Host;
            var port = _options.Port;
            var user = _options.User;
            var password = _options.Password;
            var fromName = _options.FromName ?? "Aquora ERP";

            var isPasswordPresent = !string.IsNullOrEmpty(password);

            // Log configuration details safely
            _logger.LogInformation("Attempting to send email via SMTP. Host: {Host}, Port: {Port}, User: {User}, Password Present: {PasswordPresent}",
                host, port, user, isPasswordPresent);

            if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(user) || string.IsNullOrEmpty(password))
            {
                throw new InvalidOperationException("SMTP configuration is invalid or missing required properties.");
            }

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, user));
            message.To.Add(new MailboxAddress(toEmail, toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = isHtml ? body : null,
                TextBody = isHtml ? null : body
            };

            message.Body = bodyBuilder.ToMessageBody();

            try
            {
                using var client = new SmtpClient();
                // For demo/dev environments, we may accept all certs
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(user, password);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
                
                _logger.LogInformation("Email sent successfully to {Email}", toEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {Email} via SMTP.", toEmail);
                throw;
            }
        }

        public async Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes)
        {
            var subject = "Aquora ERP - Email Verification";
            
            var body = $@"
            <!DOCTYPE html>
            <html>
            <body style='font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;'>
                <div style='max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);'>
                    <h2 style='color: #0f172a; margin-top: 0;'>Aquora ERP</h2>
                    <h3 style='color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;'>Email Verification</h3>
                    <p style='color: #475569; font-size: 16px;'>Your One-Time Password is:</p>
                    <div style='background-color: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;'>
                        <span style='font-size: 32px; font-weight: bold; color: #0284c7; letter-spacing: 5px;'>{otpCode}</span>
                    </div>
                    <p style='color: #64748b; font-size: 14px;'>Valid for {expiryMinutes} minutes.</p>
                    <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;' />
                    <p style='color: #94a3b8; font-size: 12px; text-align: center;'>If you did not request this, please ignore this email.<br/>Security Notice: Never share your OTP with anyone.</p>
                </div>
            </body>
            </html>";

            await SendEmailAsync(toEmail, subject, body, true);
        }

        public async Task<(bool Success, string ErrorMessage)> VerifySmtpConfigurationAsync()
        {
            var host = _options.Host;
            var port = _options.Port;
            var user = _options.User;
            var password = _options.Password;

            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            {
                return (false, "SMTP configuration is incomplete. Host, User, or Password is missing.");
            }

            try
            {
                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(user, password);
                await client.DisconnectAsync(true);
                return (true, "SMTP connection and authentication successful.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMTP Verification Failed for Host: {Host}, User: {User}", host, user);
                return (false, $"SMTP connection failed: {ex.Message}");
            }
        }
    }
}

