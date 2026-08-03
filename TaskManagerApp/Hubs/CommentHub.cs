using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Threading.Tasks;
using TaskManagerApp.Models;
using System.Linq;

namespace TaskManagerApp.Hubs
{
    [Authorize]
    public class CommentHub : Hub
    {
        private readonly AppDbContext _context;

        public CommentHub(AppDbContext context)
        {
            _context = context;
        }

        public async Task JoinProjectGroup(int projectId)
        {
            if (await IsAuthorizedForProjectAsync(projectId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Project_{projectId}");
            }
        }

        public async Task LeaveProjectGroup(int projectId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        }

        private async Task<bool> IsAuthorizedForProjectAsync(int projectId)
        {
            var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int currentUserId))
            {
                return false;
            }

            var project = await _context.Projects
                .Include(p => p.ProjectMembers)
                .Include(p => p.TeamGroup).ThenInclude(tg => tg.Members)
                .Include(p => p.Workspace).ThenInclude(w => w!.Members)
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);

            if (project == null) return false;

            if (project.UserId == currentUserId) return true;
            if (project.ProjectMembers.Any(pm => pm.UserId == currentUserId)) return true;
            if (project.TeamGroup != null && project.TeamGroup.Members.Any(m => m.UserId == currentUserId)) return true;
            if (project.Workspace != null && project.Workspace.Members.Any(wm => wm.UserId == currentUserId)) return true;

            return false;
        }
    }
}
