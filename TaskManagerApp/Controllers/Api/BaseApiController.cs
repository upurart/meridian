using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    [Authorize]
    [ApiController]
    public abstract class BaseApiController : ControllerBase
    {
        protected readonly AppDbContext _context;

        public BaseApiController(AppDbContext context)
        {
            _context = context;
        }

        protected int CurrentUserId
        {
            get
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                return userIdClaim != null ? int.Parse(userIdClaim.Value) : 0;
            }
        }

        // Bireysel projelerimi VEYA grubumun projelerini getiren ana sorgu
        protected IQueryable<Project> GetAuthorizedProjects(bool ignoreQueryFilters = false)
        {
            var query = _context.Projects.AsQueryable();
            
            if (ignoreQueryFilters) query = query.IgnoreQueryFilters();

            return query.Where(p => 
                (p.TeamGroupId == null && p.UserId == CurrentUserId) || 
                (p.TeamGroupId != null && p.TeamGroup.Members.Any(m => m.UserId == CurrentUserId))
            );
        }

        // Belirli bir projeye yetkim var mı sorgusu
        protected async Task<bool> IsAuthorizedForProjectAsync(int projectId)
        {
            return await _context.Projects.IgnoreQueryFilters().AnyAsync(p => 
                p.Id == projectId && 
                (
                    (p.TeamGroupId == null && p.UserId == CurrentUserId) ||
                    (p.TeamGroupId != null && p.TeamGroup.Members.Any(m => m.UserId == CurrentUserId))
                )
            );
        }

        protected async Task<bool> CanWriteToProjectAsync(int projectId)
        {
            var project = await _context.Projects.IgnoreQueryFilters()
                .Include(p => p.TeamGroup).ThenInclude(t => t.Members)
                .FirstOrDefaultAsync(p => p.Id == projectId);
            
            if (project == null) return false;

            if (project.TeamGroupId == null) return project.UserId == CurrentUserId;
            
            var member = project.TeamGroup.Members.FirstOrDefault(m => m.UserId == CurrentUserId);
            return member != null && (member.Role == "Owner" || member.Role == "Admin");
        }

        protected async Task<bool> CanCreateInTeamAsync(int? teamGroupId)
        {
            if (!teamGroupId.HasValue) return true;
            
            var member = await _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamGroupId == teamGroupId.Value && m.UserId == CurrentUserId);
            return member != null && (member.Role == "Owner" || member.Role == "Admin");
        }
    }
}