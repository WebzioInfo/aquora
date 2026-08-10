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

        private SecureSocketOptions DetermineSocketOptions(int port, bool useSsl)
        {
            if (useSsl || port == 465)
            {
                return SecureSocketOptions.SslOnConnect;
            }
            if (port == 587)
            {
                return SecureSocketOptions.StartTls;
            }
            return SecureSocketOptions.Auto;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true)
        {
            var host = _options.Host;
            var port = _options.Port;
            var user = _options.User;
            var password = _options.Password;
            var fromName = string.IsNullOrWhiteSpace(_options.FromName) ? "Aquora ERP" : _options.FromName;
            var fromEmail = string.IsNullOrWhiteSpace(_options.FromEmail) ? user : _options.FromEmail;

            var isPasswordPresent = !string.IsNullOrEmpty(password);

            _logger.LogInformation("[SMTP INIT] Preparing email for {Recipient}. Host: {Host}, Port: {Port}, User: {User}, From: {FromEmail}, Password Present: {PasswordPresent}",
                toEmail, host, port, user, fromEmail, isPasswordPresent);

            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            {
                _logger.LogError("[SMTP ERROR] Missing required SMTP configuration properties. Host: '{Host}', User: '{User}', Password Present: {PasswordPresent}",
                    host, user, isPasswordPresent);
                throw new InvalidOperationException("SMTP configuration is invalid or missing required credentials.");
            }

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromEmail));
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
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                var socketOption = DetermineSocketOptions(port, _options.UseSsl);
                _logger.LogInformation("[SMTP CONNECTING] Connecting to {Host}:{Port} with {SocketOption}...", host, port, socketOption);

                try
                {
                    await client.ConnectAsync(host, port, socketOption);
                }
                catch (Exception connEx) when (socketOption != SecureSocketOptions.Auto)
                {
                    _logger.LogWarning(connEx, "[SMTP CONNECT FALLBACK] Connection using {SocketOption} failed. Retrying with SecureSocketOptions.Auto...", socketOption);
                    client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                    await client.ConnectAsync(host, port, SecureSocketOptions.Auto);
                }

                _logger.LogInformation("[SMTP AUTHENTICATING] Authenticating with user: {User}...", user);
                await client.AuthenticateAsync(user, password);

                _logger.LogInformation("[SMTP SENDING] Delivering message to SMTP server for recipient: {Recipient}...", toEmail);
                var response = await client.SendAsync(message);

                await client.DisconnectAsync(true);

                _logger.LogInformation("[SMTP SUCCESS] Message accepted by SMTP server for {Recipient}. Provider Response: {Response}", toEmail, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SMTP FAILURE] Failed to deliver email to {Recipient} via SMTP ({Host}:{Port}). Error: {Message}", toEmail, host, port, ex.Message);
                throw;
            }
        }

        public async Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes)
        {
            var subject = "Aquora ERP - Email Verification Code";
            
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

                var socketOption = DetermineSocketOptions(port, _options.UseSsl);
                try
                {
                    await client.ConnectAsync(host, port, socketOption);
                }
                catch (Exception) when (socketOption != SecureSocketOptions.Auto)
                {
                    client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                    await client.ConnectAsync(host, port, SecureSocketOptions.Auto);
                }

                await client.AuthenticateAsync(user, password);
                await client.DisconnectAsync(true);
                return (true, "SMTP connection and authentication successful.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SMTP DIAGNOSTIC FAILED] Host: {Host}, Port: {Port}, User: {User}", host, port, user);
                return (false, $"SMTP connection failed: {ex.Message}");
            }
        }
    }
}

