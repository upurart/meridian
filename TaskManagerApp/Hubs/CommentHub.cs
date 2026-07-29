using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace TaskManagerApp.Hubs
{
    public class CommentHub : Hub
    {
        public async Task JoinProjectGroup(int projectId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        }

        public async Task LeaveProjectGroup(int projectId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        }
    }
}
