using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Aquora.API.Hubs
{
    [Authorize]
    public class ProvisioningHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;
            Console.WriteLine($"[SIGNALR CONNECTED]: User {userId} connected to ProvisioningHub.");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.UserIdentifier;
            Console.WriteLine($"[SIGNALR DISCONNECTED]: User {userId} disconnected from ProvisioningHub. Exception: {exception?.Message ?? "None"}");
            await base.OnDisconnectedAsync(exception);
        }
    }
}
