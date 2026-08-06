using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace Aquora.API.Hubs
{
    public class DashboardHub : Hub
    {
        public async Task SubscribeToTenant(string tenantId)
        {
            if (!string.IsNullOrWhiteSpace(tenantId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
            }
        }

        public async Task UnsubscribeFromTenant(string tenantId)
        {
            if (!string.IsNullOrWhiteSpace(tenantId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
            }
        }

        public override async Task OnConnectedAsync()
        {
            var tenantClaim = Context.User?.FindFirst("tenant_id")?.Value
                ?? Context.User?.FindFirst("TenantId")?.Value;

            if (!string.IsNullOrWhiteSpace(tenantClaim))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantClaim}");
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}
