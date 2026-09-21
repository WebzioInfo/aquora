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

        public async Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes, string purpose = "Verification", string? userName = null, CancellationToken cancellationToken = default)
        {
            string subject;
            string title;
            string description;
            string iconColor = "#2563eb"; // Blue

            if (purpose.Equals("PasswordReset", StringComparison.OrdinalIgnoreCase))
            {
                subject = "Your Aquzio password reset verification code";
                title = "Password Reset Request";
                description = $"We received a request to reset your Aquzio ERP account password. Use the single-use 6-digit confirmation PIN below to complete your password reset:";
                iconColor = "#dc2626"; // Red
            }
            else if (purpose.Equals("PasswordChange", StringComparison.OrdinalIgnoreCase))
            {
                subject = "Your Aquzio password change verification code";
                title = "Password Change Verification";
                description = $"We received a request to change the password for your Aquzio ERP account. Enter the single-use 6-digit confirmation PIN below to authorize this password change:";
                iconColor = "#2563eb"; // Blue
            }
            else if (purpose.Equals("EmailChange", StringComparison.OrdinalIgnoreCase))
            {
                subject = "Verify your new Aquzio email address";
                title = "Email Change Confirmation";
                description = $"We received a request to associate this email address with your Aquzio ERP account. Enter the verification PIN below to confirm:";
                iconColor = "#059669"; // Emerald
            }
            else
            {
                subject = "Verify your Aquzio account";
                title = "Email Verification";
                description = $"Welcome to Aquzio ERP! Please verify your email address to complete your account activation and access your workspace:";
                iconColor = "#2563eb";
            }

            var greeting = !string.IsNullOrWhiteSpace(userName) ? $"Hello {userName}," : "Hello,";

            var body = $@"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <title>{subject}</title>
            </head>
            <body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 30px 15px; background-color: #f8fafc; color: #1e293b;'>
                <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);'>
                    <tr>
                        <td style='padding: 32px 36px; background-color: #ffffff;'>
                            <div style='display: flex; align-items: center; margin-bottom: 24px;'>
                                <div style='font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;'>
                                    Aquzio <span style='color: #2563eb;'>ERP</span>
                                </div>
                            </div>
                            
                            <h2 style='margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a;'>{title}</h2>
                            <p style='margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;'>{greeting}</p>
                            <p style='margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;'>{description}</p>
                            
                            <!-- OTP Box -->
                            <div style='background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;'>
                                <div style='font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;'>Single-Use Verification PIN</div>
                                <div style='font-family: monospace, Courier; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: {iconColor};'>{otpCode}</div>
                                <div style='font-size: 12px; font-weight: 600; color: #64748b; margin-top: 8px;'>Valid for {expiryMinutes} minutes</div>
                            </div>

                            <p style='margin: 24px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.6;'>
                                If you did not request this verification code, please ignore this email. Your account remains secure.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 20px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;'>
                            <p style='margin: 0; font-size: 12px; color: #94a3b8;'>
                                &copy; {DateTime.UtcNow.Year} Aquzio ERP. Enterprise Manufacturing & Quality Platform.
                            </p>
                            <p style='margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;'>
                                Security Notice: Never share this OTP or your password with anyone.
                            </p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>";

            await SendEmailAsync(toEmail, subject, body, true, cancellationToken);
        }

        public async Task SendPasswordChangedNotificationAsync(string toEmail, string? userName = null, CancellationToken cancellationToken = default)
        {
            var subject = "Security Alert: Aquzio ERP Password Changed";
            var greeting = !string.IsNullOrWhiteSpace(userName) ? $"Hello {userName}," : "Hello,";

            var body = $@"
            <!DOCTYPE html>
            <html lang='en'>
            <body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 30px 15px; background-color: #f8fafc; color: #1e293b;'>
                <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);'>
                    <tr>
                        <td style='padding: 32px 36px; background-color: #ffffff;'>
                            <div style='font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 24px;'>
                                Aquzio <span style='color: #2563eb;'>ERP</span>
                            </div>
                            <h2 style='margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a;'>Password Successfully Updated</h2>
                            <p style='margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;'>{greeting}</p>
                            <p style='margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;'>
                                The password for your Aquzio ERP account was changed on <strong>{DateTime.UtcNow:MMMM dd, yyyy 'at' HH:mm 'UTC'}</strong>.
                            </p>
                            <div style='background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 14px; border-radius: 6px; margin: 20px 0;'>
                                <p style='margin: 0; font-size: 13px; color: #1e40af;'>
                                    All other active sessions have been automatically invalidated to protect your account.
                                </p>
                            </div>
                            <p style='margin: 16px 0 0 0; font-size: 13px; color: #dc2626; line-height: 1.6;'>
                                If you did NOT initiate this change, please contact your company administrator immediately to lock your account.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 20px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;'>
                            <p style='margin: 0; font-size: 12px; color: #94a3b8;'>
                                &copy; {DateTime.UtcNow.Year} Aquzio ERP. Enterprise Security Management.
                            </p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>";

            await SendEmailAsync(toEmail, subject, body, true, cancellationToken);
        }

        public async Task SendEmailChangedNotificationAsync(string oldEmail, string newEmail, string? userName = null, CancellationToken cancellationToken = default)
        {
            var subject = "Security Alert: Aquzio ERP Account Email Changed";
            var greeting = !string.IsNullOrWhiteSpace(userName) ? $"Hello {userName}," : "Hello,";

            var body = $@"
            <!DOCTYPE html>
            <html lang='en'>
            <body style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 30px 15px; background-color: #f8fafc; color: #1e293b;'>
                <table align='center' border='0' cellpadding='0' cellspacing='0' width='100%' style='max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);'>
                    <tr>
                        <td style='padding: 32px 36px; background-color: #ffffff;'>
                            <div style='font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 24px;'>
                                Aquzio <span style='color: #2563eb;'>ERP</span>
                            </div>
                            <h2 style='margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a;'>Primary Email Updated</h2>
                            <p style='margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;'>{greeting}</p>
                            <p style='margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;'>
                                The primary email address for your Aquzio ERP account was changed from <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>.
                            </p>
                            <p style='margin: 16px 0 0 0; font-size: 13px; color: #dc2626; line-height: 1.6;'>
                                If you did NOT authorize this email change, please reach out to your system administrator immediately.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style='padding: 20px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;'>
                            <p style='margin: 0; font-size: 12px; color: #94a3b8;'>
                                &copy; {DateTime.UtcNow.Year} Aquzio ERP. Enterprise Security Management.
                            </p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>";

            await SendEmailAsync(oldEmail, subject, body, true, cancellationToken);
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

