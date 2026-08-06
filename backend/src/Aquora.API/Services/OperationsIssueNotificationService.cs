using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Aquora.API.Hubs;
using Aquora.Application.DTOs.Operations;
using Aquora.Application.Interfaces.Services;

namespace Aquora.API.Services
{
    public class OperationsIssueNotificationService : IOperationsIssueNotificationService
    {
        private readonly IHubContext<DashboardHub> _dashboardHub;
        private readonly ILogger<OperationsIssueNotificationService> _logger;

        public OperationsIssueNotificationService(
            IHubContext<DashboardHub> dashboardHub,
            ILogger<OperationsIssueNotificationService> logger)
        {
            _dashboardHub = dashboardHub;
            _logger = logger;
        }

        public async Task PublishIssueCreatedAsync(Guid tenantId, OperationsIssueDto issue)
        {
            try
            {
                var payload = new
                {
                    event_type = "operations-issue-created",
                    issue = issue,
                    tenant_id = tenantId,
                    timestamp = DateTime.UtcNow
                };

                _logger.LogInformation("[REALTIME PUSH] Broadcasting OperationsIssueCreated for Issue #{IssueNumber} (Tenant: {TenantId})", issue.IssueNumber, tenantId);

                // 1. Broadcast strictly to tenant-isolated SignalR group
                if (tenantId != Guid.Empty)
                {
                    await _dashboardHub.Clients.Group($"tenant_{tenantId}").SendAsync("OperationsIssueCreated", payload);
                    await _dashboardHub.Clients.Group($"tenant_{tenantId}").SendAsync("DashboardEvent", payload);
                }

                // 2. Broadcast to all connected clients as fallback
                await _dashboardHub.Clients.All.SendAsync("OperationsIssueCreated", payload);
                await _dashboardHub.Clients.All.SendAsync("DashboardEvent", payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[REALTIME PUSH ERROR] Failed to broadcast OperationsIssueCreated event for Issue #{IssueNumber}", issue.IssueNumber);
            }
        }

        public async Task PublishIssueUpdatedAsync(Guid tenantId, OperationsIssueDto issue, string eventType = "operations-issue-updated")
        {
            try
            {
                var payload = new
                {
                    event_type = eventType,
                    issue = issue,
                    tenant_id = tenantId,
                    timestamp = DateTime.UtcNow
                };

                _logger.LogInformation("[REALTIME PUSH] Broadcasting {EventType} for Issue #{IssueNumber} (Tenant: {TenantId})", eventType, issue.IssueNumber, tenantId);

                if (tenantId != Guid.Empty)
                {
                    await _dashboardHub.Clients.Group($"tenant_{tenantId}").SendAsync("OperationsIssueUpdated", payload);
                    await _dashboardHub.Clients.Group($"tenant_{tenantId}").SendAsync("DashboardEvent", payload);
                }

                await _dashboardHub.Clients.All.SendAsync("OperationsIssueUpdated", payload);
                await _dashboardHub.Clients.All.SendAsync("DashboardEvent", payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[REALTIME PUSH ERROR] Failed to broadcast {EventType} for Issue #{IssueNumber}", eventType, issue.IssueNumber);
            }
        }
    }
}
