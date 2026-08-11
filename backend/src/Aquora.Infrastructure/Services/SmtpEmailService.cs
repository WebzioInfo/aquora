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

        public async Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true, CancellationToken cancellationToken = default)
        {
            var totalSw = System.Diagnostics.Stopwatch.StartNew();
            var host = _options.Host;
            var port = _options.Port;
            var user = _options.User;
            var password = _options.Password;
            var fromName = string.IsNullOrWhiteSpace(_options.FromName) ? "Aquzio ERP" : _options.FromName;
            var fromEmail = string.IsNullOrWhiteSpace(_options.FromEmail) ? user : _options.FromEmail;

            var isHostPresent = !string.IsNullOrWhiteSpace(host);
            var isUserPresent = !string.IsNullOrWhiteSpace(user);
            var isPasswordPresent = !string.IsNullOrEmpty(password);
            var isFromEmailPresent = !string.IsNullOrWhiteSpace(fromEmail);

            _logger.LogInformation("[SMTP DIAGNOSTIC] Host Present: {HostPresent} ({Host}), Port: {Port}, Username Present: {UserPresent} ({User}), FromEmail Present: {FromEmailPresent}, Password Present: {PasswordPresent}, EnableSsl: {EnableSsl}",
                isHostPresent, isHostPresent ? host : "MISSING", port, isUserPresent, isUserPresent ? user : "MISSING", isFromEmailPresent, isPasswordPresent, _options.EnableSsl);

            if (!isHostPresent || !isUserPresent || !isPasswordPresent)
            {
                var missingFields = new System.Collections.Generic.List<string>();
                if (!isHostPresent) missingFields.Add("SMTP_HOST");
                if (!isUserPresent) missingFields.Add("SMTP_USERNAME");
                if (!isPasswordPresent) missingFields.Add("SMTP_PASSWORD");

                var missingStr = string.Join(", ", missingFields);
                _logger.LogError("[SMTP ERROR] Missing required SMTP configuration variables: {MissingFields}", missingStr);
                throw new InvalidOperationException($"SMTP configuration is incomplete on server. Missing required environment variables: {missingStr}. Please configure these in Railway Service Variables and restart the service.");
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

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(12)); // 12-second hard timeout for complete SMTP operation

            try
            {
                using var client = new SmtpClient();
                client.Timeout = 12000; // 12-second socket timeout
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                var socketOption = DetermineSocketOptions(port, _options.UseSsl);
                _logger.LogInformation("[SMTP CONNECTING] Connecting to {Host}:{Port} with {SocketOption}...", host, port, socketOption);

                var swStep = System.Diagnostics.Stopwatch.StartNew();
                try
                {
                    await client.ConnectAsync(host, port, socketOption, cts.Token);
                }
                catch (Exception connEx) when (socketOption != SecureSocketOptions.Auto && !cts.Token.IsCancellationRequested)
                {
                    _logger.LogWarning(connEx, "[SMTP CONNECT FALLBACK] Connection using {SocketOption} failed. Retrying with SecureSocketOptions.Auto...", socketOption);
                    client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                    await client.ConnectAsync(host, port, SecureSocketOptions.Auto, cts.Token);
                }
                var connectMs = swStep.ElapsedMilliseconds;

                _logger.LogInformation("[SMTP AUTHENTICATING] Authenticating with user: {User}...", user);
                swStep.Restart();
                await client.AuthenticateAsync(user, password, cts.Token);
                var authMs = swStep.ElapsedMilliseconds;

                _logger.LogInformation("[SMTP SENDING] Delivering message to SMTP server for recipient: {Recipient}...", toEmail);
                swStep.Restart();
                var response = await client.SendAsync(message, cts.Token);
                var sendMs = swStep.ElapsedMilliseconds;

                await client.DisconnectAsync(true, cts.Token);
                totalSw.Stop();

                _logger.LogInformation("[SMTP TIMINGS SUCCESS] Delivered to {Recipient} in {TotalMs}ms (Connect: {ConnectMs}ms, Auth: {AuthMs}ms, Send: {SendMs}ms). Provider Response: {Response}",
                    toEmail, totalSw.ElapsedMilliseconds, connectMs, authMs, sendMs, response);
            }
            catch (OperationCanceledException)
            {
                totalSw.Stop();
                _logger.LogError("[SMTP TIMEOUT] Connection or send timed out after {ElapsedMs}ms for recipient {Recipient} at {Host}:{Port}.", totalSw.ElapsedMilliseconds, toEmail, host, port);
                throw new TimeoutException($"SMTP operation timed out after 12 seconds while contacting {host}:{port}.");
            }
            catch (Exception ex)
            {
                totalSw.Stop();
                _logger.LogError(ex, "[SMTP FAILURE] Failed to deliver email to {Recipient} via SMTP ({Host}:{Port}) after {ElapsedMs}ms. Error: {Message}", toEmail, host, port, totalSw.ElapsedMilliseconds, ex.Message);
                throw;
            }
        }

        public async Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes, CancellationToken cancellationToken = default)
        {
            var subject = "Aquzio ERP - Email Verification Code";
            
            var body = $@"
            <!DOCTYPE html>
            <html>
            <body style='font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f5;'>
                <div style='max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);'>
                    <h2 style='color: #0f172a; margin-top: 0;'>Aquzio ERP</h2>
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

            await SendEmailAsync(toEmail, subject, body, true, cancellationToken);
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

