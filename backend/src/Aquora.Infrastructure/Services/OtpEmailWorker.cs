using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Infrastructure.Services
{
    public class OtpEmailWorker : BackgroundService
    {
        private readonly IBackgroundTaskQueue _taskQueue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OtpEmailWorker> _logger;

        public OtpEmailWorker(
            IBackgroundTaskQueue taskQueue,
            IServiceScopeFactory scopeFactory,
            ILogger<OtpEmailWorker> logger)
        {
            _taskQueue = taskQueue;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Otp Email Worker is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var job = await _taskQueue.DequeueEmailJobAsync(stoppingToken);
                    _ = ProcessJobWithRetryAsync(job, stoppingToken); // Process job concurrently
                }
                catch (OperationCanceledException)
                {
                    // Ignore cancellation exception
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred dequeuing or starting email background task.");
                }
            }

            _logger.LogInformation("Otp Email Worker is stopping.");
        }

        private async Task ProcessJobWithRetryAsync(EmailJob job, CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
            var platformContext = scope.ServiceProvider.GetRequiredService<IPlatformDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<OtpEmailWorker>>();

            int maxRetries = 3;
            int delayMs = 2000;

            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    if (job.IsOtp)
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
                                    <span style='font-size: 32px; font-weight: bold; color: #0284c7; letter-spacing: 5px;'>{job.OtpCode}</span>
                                </div>
                                <p style='color: #64748b; font-size: 14px;'>Valid for {job.ExpiryMinutes} minutes.</p>
                                <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;' />
                                <p style='color: #94a3b8; font-size: 12px; text-align: center;'>If you did not request this, please ignore this email.<br/>Security Notice: Never share your OTP with anyone.</p>
                            </div>
                        </body>
                        </html>";

                        await emailService.SendEmailAsync(job.ToEmail, subject, body, true);

                        // Mark OTP sent in DB
                        var otpRecord = await platformContext.OTPVerifications
                            .FirstOrDefaultAsync(o => o.Email.ToLower() == job.ToEmail.ToLower() && !o.IsVerified, cancellationToken);
                        if (otpRecord != null)
                        {
                            otpRecord.LastSentAt = DateTime.UtcNow;
                            await platformContext.SaveChangesAsync(cancellationToken);
                        }
                    }
                    else
                    {
                        await emailService.SendEmailAsync(job.ToEmail, job.Subject, job.Body, job.IsHtml);
                    }

                    logger.LogInformation("Background email job completed successfully for {Email}.", job.ToEmail);
                    return; // Job successfully completed!
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to send email to {Email} on attempt {Attempt}/{MaxRetries}", job.ToEmail, attempt, maxRetries);
                    if (attempt == maxRetries)
                    {
                        logger.LogError("Email job for {Email} permanently failed.", job.ToEmail);
                    }
                    else
                    {
                        try
                        {
                            await Task.Delay(delayMs * attempt, cancellationToken); // Backoff delay
                        }
                        catch (TaskCanceledException)
                        {
                            return; // App is stopping
                        }
                    }
                }
            }
        }
    }
}
