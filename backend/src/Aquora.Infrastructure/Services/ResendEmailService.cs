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
