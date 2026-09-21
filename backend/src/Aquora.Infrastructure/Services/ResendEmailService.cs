using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Aquora.Application.Interfaces.Services;
using Aquora.Infrastructure.Configuration;

namespace Aquora.Infrastructure.Services
{
    public class ResendEmailService : IEmailService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ResendOptions _options;
        private readonly ILogger<ResendEmailService> _logger;

        public ResendEmailService(
            IHttpClientFactory httpClientFactory,
            IOptions<ResendOptions> options,
            ILogger<ResendEmailService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
            _logger = logger;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true, CancellationToken cancellationToken = default)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var apiKey = _options.ApiKey;
            var fromEmail = string.IsNullOrWhiteSpace(_options.FromEmail) ? "onboarding@resend.dev" : _options.FromEmail;
            var fromName = string.IsNullOrWhiteSpace(_options.FromName) ? "Aquzio" : _options.FromName;

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogError("[RESEND ERROR] RESEND_API_KEY is not configured.");
                throw new InvalidOperationException("Resend API key is missing. Please configure RESEND_API_KEY in server environment variables.");
            }

            var sender = !fromEmail.Contains("@") ? "onboarding@resend.dev" : fromEmail;
            var formattedFrom = $"{fromName} <{sender}>";

            var payload = new
            {
                from = formattedFrom,
                to = new[] { toEmail },
                subject = subject,
                html = isHtml ? body : null,
                text = isHtml ? null : body
            };

            var jsonContent = JsonSerializer.Serialize(payload);
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            httpRequest.Content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var client = _httpClientFactory.CreateClient("ResendClient");

            try
            {
                _logger.LogInformation("[RESEND DISPATCH] Sending email via Resend HTTPS API to recipient: {Recipient}...", toEmail);
                
                var response = await client.SendAsync(httpRequest, cancellationToken);
                sw.Stop();

                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogInformation("[RESEND SUCCESS] Email delivered to {Recipient} in {ElapsedMs}ms. Resend Response: {Response}", toEmail, sw.ElapsedMilliseconds, responseBody);
                    return;
                }

                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("[RESEND API ERROR] Resend returned HTTP {StatusCode} after {ElapsedMs}ms: {Error}", response.StatusCode, sw.ElapsedMilliseconds, errorBody);
                throw new InvalidOperationException($"Resend HTTPS email delivery failed ({response.StatusCode}). Details: {errorBody}");
            }
            catch (OperationCanceledException)
            {
                sw.Stop();
                _logger.LogError("[RESEND TIMEOUT] Request to https://api.resend.com timed out after {ElapsedMs}ms for recipient {Recipient}.", sw.ElapsedMilliseconds, toEmail);
                throw new TimeoutException($"Resend HTTPS email service timed out for {toEmail}.");
            }
            catch (Exception ex) when (!(ex is InvalidOperationException || ex is TimeoutException))
            {
                sw.Stop();
                _logger.LogError(ex, "[RESEND FAILURE] Failed to deliver email to {Recipient} via Resend HTTPS API after {ElapsedMs}ms.", toEmail, sw.ElapsedMilliseconds);
                throw;
            }
        }

        public async Task SendOtpEmailAsync(string toEmail, string otpCode, int expiryMinutes, string purpose = "Verification", string? userName = null, CancellationToken cancellationToken = default)
        {
            string subject;
            string title;
            string description;
            string iconColor = "#2563eb";

            if (purpose.Equals("PasswordReset", StringComparison.OrdinalIgnoreCase))
            {
                subject = "Reset your Aquzio password";
                title = "Password Reset Request";
                description = $"We received a request to reset your Aquzio ERP account password. Use the single-use 6-digit confirmation PIN below to complete your password reset:";
                iconColor = "#dc2626";
            }
            else if (purpose.Equals("EmailChange", StringComparison.OrdinalIgnoreCase))
            {
                subject = "Verify your new Aquzio email address";
                title = "Email Change Confirmation";
                description = $"We received a request to associate this email address with your Aquzio ERP account. Enter the verification PIN below to confirm:";
                iconColor = "#059669";
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
                            <div style='font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 24px;'>
                                Aquzio <span style='color: #2563eb;'>ERP</span>
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

        public Task<(bool Success, string ErrorMessage)> VerifySmtpConfigurationAsync()
        {
            var apiKey = _options.ApiKey;
            var fromEmail = _options.FromEmail;
            var isApiKeyPresent = !string.IsNullOrWhiteSpace(apiKey);
            var isFromEmailPresent = !string.IsNullOrWhiteSpace(fromEmail);

            if (!isApiKeyPresent)
            {
                return Task.FromResult((false, "Resend configuration is incomplete. Missing RESEND_API_KEY environment variable."));
            }

            _logger.LogInformation("[EMAIL CONFIG] Email Provider: Resend (HTTPS API). ApiKey Present: true, FromEmail: {FromEmail}", isFromEmailPresent ? fromEmail : "onboarding@resend.dev (default)");
            return Task.FromResult((true, "Resend HTTPS API configuration is valid."));
        }
    }
}
