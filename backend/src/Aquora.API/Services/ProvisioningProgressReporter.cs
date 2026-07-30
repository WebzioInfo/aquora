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
            
            var payload = new
            {
                progress,
                stage,
                message,
                status = progress >= 100 ? "Completed" : "Provisioning"
            };

            await _hubContext.Clients.All.SendAsync("ProvisionProgressUpdated", payload);
            await _hubContext.Clients.All.SendAsync("ProvisionStepCompleted", payload);
            
            if (progress >= 100)
            {
                await _hubContext.Clients.All.SendAsync("ProvisionFinished", payload);
            }
        }

        public async Task ReportFailureAsync(string userId, string stage, string reason)
        {
            Console.WriteLine($"[SIGNALR FAILURE]: User {userId} -> Failed at '{stage}' | {reason}");
            
            var payload = new
            {
                progress = 0,
                stage,
                message = reason,
                status = "Failed",
                failureReason = reason
            };

            await _hubContext.Clients.All.SendAsync("ProvisionProgressUpdated", payload);
            await _hubContext.Clients.All.SendAsync("ProvisionFailed", payload);
        }
    }
}
