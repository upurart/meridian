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

        protected async Task<bool> CanCreateInWorkspaceAsync(int? workspaceId)
        {
            if (!workspaceId.HasValue) return true;
            
            var member = await _context.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId.Value && m.UserId == CurrentUserId && m.IsActive);
            return member != null; // Assume any active member can create projects for now
        }

        protected async Task UpdateGoalCompletionStatusAsync(int? subGoalId, int? mainGoalId)
        {
            if (subGoalId.HasValue)
            {
                var sg = await _context.SubGoals.Include(s => s.Tasks).FirstOrDefaultAsync(s => s.Id == subGoalId.Value);
                if (sg != null)
                {
                    var activeTasks = sg.Tasks.Where(t => !t.IsDeleted).ToList();
                    if (activeTasks.Any())
                    {
                        bool allCompleted = activeTasks.All(t => t.IsCompleted);
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
                var mg = await _context.MainGoals
                    .Include(m => m.Tasks)
                    .Include(m => m.SubGoals).ThenInclude(s => s.Tasks)
                    .FirstOrDefaultAsync(m => m.Id == mainGoalId.Value);
                
                if (mg != null)
                {
                    bool hasItems = false;
                    bool allCompleted = true;

                    var activeTasks = mg.Tasks.Where(t => !t.IsDeleted).ToList();
                    if (activeTasks.Any())
                    {
                        hasItems = true;
                        if (!activeTasks.All(t => t.IsCompleted)) allCompleted = false;
                    }

                    var activeSubGoals = mg.SubGoals.Where(s => !s.IsDeleted).ToList();
                    if (activeSubGoals.Any())
                    {
                        hasItems = true;
                        // For a subgoal to be considered completed towards the main goal, it must be IsCompleted
                        // or its calculated progress is 100%. Since we just synced IsCompleted above, checking IsCompleted is usually enough.
                        // However, let's strictly check IsCompleted.
                        if (!activeSubGoals.All(s => s.IsCompleted)) allCompleted = false;
                    }

                    if (hasItems)
                    {
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