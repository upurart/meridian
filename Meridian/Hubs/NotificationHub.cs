using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Meridian.Hubs
{
    public class NotificationHub : Hub
    {
        public async Task JoinUserGroup(int userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{userId}");
        }

        public async Task LeaveUserGroup(int userId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"User_{userId}");
        }
    }
}
