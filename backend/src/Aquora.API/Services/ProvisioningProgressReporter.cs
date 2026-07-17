using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Aquora.API.Hubs;
using Aquora.Application.Interfaces.Services;

namespace Aquora.API.Services
{
    public class ProvisioningProgressReporter : IProvisioningProgressReporter
    {
        private readonly IHubContext<ProvisioningHub> _hubContext;

        public ProvisioningProgressReporter(IHubContext<ProvisioningHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task ReportProgressAsync(string userId, int progress, string stage, string message)
        {
            Console.WriteLine($"[SIGNALR PROGRESS]: User {userId} -> {progress}% | Stage: {stage} | {message}");
            await _hubContext.Clients.User(userId).SendAsync("ProvisionProgressUpdated", new
            {
                progress,
                stage,
                message,
                status = progress >= 100 ? "Ready" : "Provisioning"
            });
        }

        public async Task ReportFailureAsync(string userId, string stage, string reason)
        {
            Console.WriteLine($"[SIGNALR FAILURE]: User {userId} -> Failed at '{stage}' | {reason}");
            await _hubContext.Clients.User(userId).SendAsync("ProvisionProgressUpdated", new
            {
                progress = 0,
                stage,
                message = reason,
                status = "Failed",
                failureReason = reason
            });
        }
    }
}
