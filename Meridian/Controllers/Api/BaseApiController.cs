using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Meridian.Models;

namespace Meridian.Controllers
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
                p.UserId == CurrentUserId || 
                (p.TeamGroupId != null && p.TeamGroup.Members.Any(m => m.UserId == CurrentUserId)) ||
                p.ProjectMembers.Any(m => m.UserId == CurrentUserId)
            );
        }

        // Belirli bir projeye yetkim var mı sorgusu
        protected async Task<bool> IsAuthorizedForProjectAsync(int projectId)
        {
            return await _context.Projects.IgnoreQueryFilters().AnyAsync(p => 
                p.Id == projectId && 
                (
                    p.UserId == CurrentUserId ||
                    (p.TeamGroupId != null && p.TeamGroup.Members.Any(m => m.UserId == CurrentUserId)) ||
                    p.ProjectMembers.Any(m => m.UserId == CurrentUserId)
                )
            );
        }

        protected async Task<bool> CanWriteToProjectAsync(int projectId)
        {
            var project = await _context.Projects.IgnoreQueryFilters()
                .Include(p => p.TeamGroup).ThenInclude(t => t!.Members)
                .Include(p => p.Workspace).ThenInclude(w => w!.Members)
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);
            
            if (project == null) return false;

            if (project.UserId == CurrentUserId) return true;
            
            var pm = project.ProjectMembers.FirstOrDefault(m => m.UserId == CurrentUserId);
            if (pm != null && (pm.Role == "Manager" || pm.Role == "Participant")) return true;

            if (project.Workspace != null) {
                var wm = project.Workspace.Members.FirstOrDefault(m => m.UserId == CurrentUserId && m.IsActive);
                if (wm != null && (wm.RolePreset == "Admin" || wm.RolePreset == "Member")) return true;
            }

            if (project.TeamGroup != null) {
                var tm = project.TeamGroup.Members.FirstOrDefault(m => m.UserId == CurrentUserId);
                if (tm != null && (tm.Role == "Owner" || tm.Role == "Admin" || tm.Role == "Member")) return true;
            }
            
            return false;
        }

        protected async Task<bool> CanCreateInTeamAsync(int? teamGroupId)
        {
            if (!teamGroupId.HasValue) return true;
            
            var member = await _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamGroupId == teamGroupId.Value && m.UserId == CurrentUserId);
            return member != null && (member.Role == "Owner" || member.Role == "Admin");
        }

        protected async Task<bool> CanCreateInWorkspaceAsync(int? workspaceId)
        {
            if (!workspaceId.HasValue) return true;
            
            var member = await _context.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId.Value && m.UserId == CurrentUserId && m.IsActive);
            return member != null; // Geçici: Herhangi bir üye proje açabilir
        }

        protected async Task UpdateGoalCompletionStatusAsync(int? subGoalId, int? mainGoalId)
        {
            if (subGoalId.HasValue)
            {
                var sg = await _context.SubGoals.FirstOrDefaultAsync(s => s.Id == subGoalId.Value);
                if (sg != null)
                {
                    bool hasActiveTasks = await _context.TaskItems.AnyAsync(t => t.SubGoalId == subGoalId.Value && !t.IsDeleted);
                    if (hasActiveTasks)
                    {
                        bool hasIncompleteTasks = await _context.TaskItems.AnyAsync(t => t.SubGoalId == subGoalId.Value && !t.IsDeleted && !t.IsCompleted);
                        bool allCompleted = !hasIncompleteTasks;
                        
                        if (sg.IsCompleted != allCompleted)
                        {
                            sg.IsCompleted = allCompleted;
                            _context.SubGoals.Update(sg);
                        }
                    }
                    if (mainGoalId == null && sg.MainGoalId != 0)
                    {
                        mainGoalId = sg.MainGoalId;
                    }
                }
            }

            if (mainGoalId.HasValue)
            {
                var mg = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == mainGoalId.Value);
                
                if (mg != null)
                {
                    bool hasActiveTasks = await _context.TaskItems.AnyAsync(t => t.MainGoalId == mainGoalId.Value && !t.IsDeleted);
                    bool hasActiveSubGoals = await _context.SubGoals.AnyAsync(s => s.MainGoalId == mainGoalId.Value && !s.IsDeleted);

                    if (hasActiveTasks || hasActiveSubGoals)
                    {
                        bool hasIncompleteTasks = await _context.TaskItems.AnyAsync(t => t.MainGoalId == mainGoalId.Value && !t.IsDeleted && !t.IsCompleted);
                        bool hasIncompleteSubGoals = await _context.SubGoals.AnyAsync(s => s.MainGoalId == mainGoalId.Value && !s.IsDeleted && !s.IsCompleted);
                        
                        bool allCompleted = !hasIncompleteTasks && !hasIncompleteSubGoals;

                        if (mg.IsCompleted != allCompleted)
                        {
                            mg.IsCompleted = allCompleted;
                            _context.MainGoals.Update(mg);
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();
        }
    }
}
