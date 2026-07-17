using System;
using System.Threading;
using System.Threading.Tasks;
using Aquora.Application.DTOs.Auth;

namespace Aquora.Application.Interfaces.Services
{
    public interface IBackgroundTaskQueue
    {
        ValueTask QueueBackgroundWorkItemAsync(Func<CancellationToken, ValueTask> workItem);
        ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(CancellationToken cancellationToken);
        
        void QueueEmailJob(string toEmail, string subject, string body, bool isHtml = true);
        void QueueOtpJob(string toEmail, string otpCode, int expiryMinutes);
        
        ValueTask QueueEmailJobAsync(EmailJob job);
        ValueTask<EmailJob> DequeueEmailJobAsync(CancellationToken cancellationToken);
    }
}
