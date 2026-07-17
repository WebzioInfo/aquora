using System;
using System.Threading;
using System.Threading.Tasks;
using System.Threading.Channels;
using Aquora.Application.DTOs.Auth;
using Aquora.Application.Interfaces.Services;

namespace Aquora.Infrastructure.Services
{
    public class BackgroundTaskQueue : IBackgroundTaskQueue
    {
        private readonly Channel<Func<CancellationToken, ValueTask>> _workItemsChannel;
        private readonly Channel<EmailJob> _emailJobsChannel;

        public BackgroundTaskQueue()
        {
            // Capacity-bounded or unbounded channels. Standard is bounded to prevent OOM under severe load
            var options = new BoundedChannelOptions(1000)
            {
                FullMode = BoundedChannelFullMode.Wait
            };
            
            _workItemsChannel = Channel.CreateBounded<Func<CancellationToken, ValueTask>>(options);
            _emailJobsChannel = Channel.CreateBounded<EmailJob>(options);
        }

        public async ValueTask QueueBackgroundWorkItemAsync(Func<CancellationToken, ValueTask> workItem)
        {
            if (workItem == null)
            {
                throw new ArgumentNullException(nameof(workItem));
            }

            await _workItemsChannel.Writer.WriteAsync(workItem);
        }

        public async ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(CancellationToken cancellationToken)
        {
            return await _workItemsChannel.Reader.ReadAsync(cancellationToken);
        }

        public void QueueEmailJob(string toEmail, string subject, string body, bool isHtml = true)
        {
            var job = new EmailJob
            {
                ToEmail = toEmail,
                Subject = subject,
                Body = body,
                IsHtml = isHtml,
                IsOtp = false
            };
            
            _ = QueueEmailJobAsync(job);
        }

        public void QueueOtpJob(string toEmail, string otpCode, int expiryMinutes)
        {
            var job = new EmailJob
            {
                ToEmail = toEmail,
                OtpCode = otpCode,
                ExpiryMinutes = expiryMinutes,
                IsOtp = true
            };
            
            _ = QueueEmailJobAsync(job);
        }

        public async ValueTask QueueEmailJobAsync(EmailJob job)
        {
            if (job == null)
            {
                throw new ArgumentNullException(nameof(job));
            }

            await _emailJobsChannel.Writer.WriteAsync(job);
        }

        public async ValueTask<EmailJob> DequeueEmailJobAsync(CancellationToken cancellationToken)
        {
            return await _emailJobsChannel.Reader.ReadAsync(cancellationToken);
        }
    }
}
