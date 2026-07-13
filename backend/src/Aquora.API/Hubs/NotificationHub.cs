using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace Aquora.API.Hubs
{
    public class NotificationHub : Hub
    {
        public async Task SendNotification(string message)
        {
            await Clients.All.SendAsync("ReceiveNotification", message);
        }
    }
}
