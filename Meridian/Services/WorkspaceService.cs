using Microsoft.EntityFrameworkCore;
using Meridian.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Meridian.Services
{
    public class WorkspaceService : IWorkspaceService
    {
        private readonly AppDbContext _context;

        public WorkspaceService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<object> GetMyWorkspacesAsync(int userId)
        {
            var workspaces = await _context.Workspaces
                .AsNoTracking()
                .IgnoreQueryFilters()
                .AsSplitQuery()
                .Include(w => w.Projects)
                .Include(w => w.Members)
                .Include(w => w.TeamGroup).ThenInclude(tg => tg.Members)
                .Include(w => w.WorkspaceTeams).ThenInclude(wt => wt.TeamGroup).ThenInclude(tg => tg!.Members)
                .Where(w => w.IsActive && !w.IsDeleted && 
                            (w.Members.Any(m => m.UserId == userId && m.IsActive) ||
                             w.WorkspaceTeams.Any(wt => wt.TeamGroup!.Members.Any(tm => tm.UserId == userId))))
                .Select(w => new {
                    w.Id,
                    w.Name,
                    w.Slug,
                    w.Description,
                    w.OwnerId,
                    TeamGroupId = (w.TeamGroupId != null && w.TeamGroup != null && w.TeamGroup.Members.Any(tm => tm.UserId == userId)) ? w.TeamGroupId : null,
                    TeamIds = w.WorkspaceTeams.Select(wt => wt.TeamGroupId).ToList(),
                    w.CreatedAt,
                    ProjectsCount = w.Projects.Count(p => !p.IsDeleted),
                    RolePreset = w.Members.FirstOrDefault(m => m.UserId == userId) != null 
                                 ? w.Members.FirstOrDefault(m => m.UserId == userId)!.RolePreset 
                                 : "Member"
                })
                .ToListAsync();

            return workspaces;
        }

        public async Task<object?> GetWorkspaceDetailsAsync(int userId, int id)
        {
            var workspace = await _context.Workspaces
                .AsNoTracking()
                .IgnoreQueryFilters()
                .AsSplitQuery()
                .Include(w => w.Members)
                .Include(w => w.TeamGroup).ThenInclude(tg => tg.Members)
                .Include(w => w.WorkspaceTeams).ThenInclude(wt => wt.TeamGroup)
                .Include(w => w.Projects.Where(p => !p.IsDeleted))
                    .ThenInclude(p => p.Tasks)
                .Include(w => w.Projects.Where(p => !p.IsDeleted))
                    .ThenInclude(p => p.MainGoal)
                        .ThenInclude(mg => mg.Tasks)
                .Include(w => w.Projects.Where(p => !p.IsDeleted))
                    .ThenInclude(p => p.MainGoal)
                        .ThenInclude(mg => mg.SubGoals)
                            .ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(w => w.Id == id && w.IsActive && !w.IsDeleted &&
                    (w.Members.Any(m => m.UserId == userId && m.IsActive) ||
                     w.WorkspaceTeams.Any(wt => wt.TeamGroup!.Members.Any(tm => tm.UserId == userId))));

            if (workspace == null) return null;

            var member = await _context.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == id && m.UserId == userId && m.IsActive);
            var rolePreset = member?.RolePreset ?? "Member";

            var result = new
            {
                workspace.Id,
                workspace.Name,
                workspace.Description,
                workspace.TeamGroupId,
                TeamGroupName = workspace.TeamGroup?.Name,
                Teams = workspace.WorkspaceTeams.Select(wt => new { wt.TeamGroupId, wt.TeamGroup?.Name }).ToList(),
                workspace.CreatedAt,
                RolePreset = rolePreset,
                Projects = workspace.Projects.Select(p => {
                    var items = new List<double>();
                    if (p.MainGoal != null && p.MainGoal.Any(mg => !mg.IsDeleted))
                    {
                        foreach(var mg in p.MainGoal.Where(m => !m.IsDeleted))
                        {
                            var mgItems = new List<double>();
                            if (mg.SubGoals != null && mg.SubGoals.Any(sg => !sg.IsDeleted))
                            {
                                foreach(var sg in mg.SubGoals.Where(s => !s.IsDeleted))
                                {
                                    if (sg.Tasks != null && sg.Tasks.Any(t => !t.IsDeleted))
                                    {
                                        var activeTasks = sg.Tasks.Where(t => !t.IsDeleted).ToList();
                                        mgItems.Add((activeTasks.Count(t => t.IsCompleted) / (double)activeTasks.Count) * 100);
                                    }
                                    else
                                    {
                                        mgItems.Add(sg.IsCompleted ? 100 : 0);
                                    }
                                }
                            }
                            if (mg.Tasks != null && mg.Tasks.Any(t => !t.IsDeleted))
                                mgItems.AddRange(mg.Tasks.Where(t => !t.IsDeleted).Select(t => t.IsCompleted ? 100.0 : 0.0));
                            
                            items.Add(mgItems.Any() ? mgItems.Average() : (mg.IsCompleted ? 100 : 0));
                        }
                    }
                    if (p.Tasks != null && p.Tasks.Any(t => !t.IsDeleted))
                        items.AddRange(p.Tasks.Where(t => !t.IsDeleted).Select(t => t.IsCompleted ? 100.0 : 0.0));
                    
                    var progress = items.Any() ? items.Average() : 0;

                    return new
                    {
                        p.Id,
                        p.Title,
                        p.Description,
                        p.CreatedAt,
                        p.Deadline,
                        Progress = progress,
                        MainGoalsCount = p.MainGoal.Count
                    };
                }).ToList()
            };

            return result;
        }

        public async Task<object> CreateWorkspaceAsync(int userId, int organizationId, CreateWorkspaceDto dto)
        {
            var slug = GenerateSlug(dto.Name);
            var existingSlugs = await _context.Workspaces.Where(w => w.Slug.StartsWith(slug)).Select(w => w.Slug).ToListAsync();
            if (existingSlugs.Contains(slug))
            {
                int counter = 1;
                while (existingSlugs.Contains($"{slug}-{counter}"))
                {
                    counter++;
                }
                slug = $"{slug}-{counter}";
            }

            var workspace = new Workspace
            {
                Name = dto.Name,
                Slug = slug,
                Description = dto.Description,
                OwnerId = userId,
                TeamGroupId = dto.TeamGroupId,
                OrganizationId = organizationId,
                CreatedAt = DateTime.Now,
                IsActive = true
            };

            _context.Workspaces.Add(workspace);
            await _context.SaveChangesAsync();

            var teamIds = new List<int>();
            if (dto.TeamIds != null && dto.TeamIds.Any()) teamIds.AddRange(dto.TeamIds);
            else if (dto.TeamGroupId.HasValue) teamIds.Add(dto.TeamGroupId.Value);
            
            foreach(var tId in teamIds.Distinct())
            {
                _context.WorkspaceTeams.Add(new WorkspaceTeam {
                    WorkspaceId = workspace.Id,
                    TeamGroupId = tId,
                    RolePreset = "Editor"
                });
            }

            var member = new WorkspaceMember
            {
                WorkspaceId = workspace.Id,
                UserId = userId,
                RolePreset = "Owner",
                JoinedAt = DateTime.Now,
                IsActive = true
            };

            _context.WorkspaceMembers.Add(member);
            await _context.SaveChangesAsync();

            return new { 
                workspace.Id, 
                workspace.Name, 
                workspace.Slug,
                workspace.TeamGroupId,
                TeamIds = teamIds
            };
        }

        public async Task<bool> DeleteWorkspaceAsync(int userId, int id)
        {
            var workspace = await _context.Workspaces
                .AsSplitQuery()
                .Include(w => w.Projects.Where(p => !p.IsDeleted))
                    .ThenInclude(p => p.Tasks)
                .Include(w => w.Projects.Where(p => !p.IsDeleted))
                    .ThenInclude(p => p.MainGoal)
                        .ThenInclude(mg => mg.Tasks)
                .Include(w => w.Projects.Where(p => !p.IsDeleted))
                    .ThenInclude(p => p.MainGoal)
                        .ThenInclude(mg => mg.SubGoals)
                            .ThenInclude(sg => sg.Tasks)
                .Include(w => w.Members)
                .FirstOrDefaultAsync(w => w.Id == id && !w.IsDeleted);

            if (workspace == null) return false;
                
            var isOwner = workspace.OwnerId == userId || workspace.Members.Any(m => m.UserId == userId && m.RolePreset == "Owner");
            if (!isOwner) return false;
            
            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            var cascadeService = new CascadeOperationService();

            workspace.IsDeleted = true;
            workspace.DeletedAt = deleteTime;
            workspace.DeleteBatchId = batchId;

            foreach (var project in workspace.Projects)
            {
                cascadeService.SoftDeleteProject(project, batchId, deleteTime);
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<object> GetDeletedWorkspacesAsync(int userId)
        {
            return await _context.Workspaces
                .IgnoreQueryFilters()
                .Where(w => w.IsDeleted && (w.OwnerId == userId || w.Members.Any(m => m.UserId == userId && m.RolePreset == "Owner")))
                .OrderByDescending(w => w.DeletedAt)
                .Select(w => new { id = w.Id, name = w.Name, description = w.Description, deletedAt = w.DeletedAt })
                .ToListAsync();
        }

        public async Task<bool> RestoreWorkspaceAsync(int userId, int id)
        {
            var member = await _context.WorkspaceMembers
                .IgnoreQueryFilters()
                .Include(wm => wm.Workspace)
                .FirstOrDefaultAsync(wm => wm.UserId == userId && wm.WorkspaceId == id && wm.IsActive && wm.RolePreset == "Owner" && wm.Workspace != null && wm.Workspace!.IsDeleted);

            if (member == null || member.Workspace == null) return false;

            var workspace = member.Workspace;
            workspace.IsDeleted = false;
            workspace.DeletedAt = null;

            if (workspace.DeleteBatchId.HasValue)
            {
                var batchId = workspace.DeleteBatchId.Value;
                var projects = await _context.Projects.IgnoreQueryFilters().Where(p => p.DeleteBatchId == batchId && p.IsDeleted).ToListAsync();
                foreach (var p in projects) { p.IsDeleted = false; p.DeletedAt = null; p.DeleteBatchId = null; }

                var mainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();
                foreach (var mg in mainGoals) { mg.IsDeleted = false; mg.DeletedAt = null; mg.DeleteBatchId = null; }

                var subGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals) { sg.IsDeleted = false; sg.DeletedAt = null; sg.DeleteBatchId = null; }

                var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsDeleted = false; t.DeletedAt = null; t.DeleteBatchId = null; }

                workspace.DeleteBatchId = null;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> PermanentlyDeleteWorkspaceAsync(int userId, int id)
        {
            var workspace = await _context.Workspaces.IgnoreQueryFilters()
                .AsSplitQuery()
                .Include(w => w.Members)
                .Include(w => w.Projects).ThenInclude(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .Include(w => w.Projects).ThenInclude(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(w => w.Projects).ThenInclude(p => p.Tasks)
                .FirstOrDefaultAsync(w => w.Id == id && w.IsDeleted);

            if (workspace == null) return false;
            if (!workspace.Members.Any(wm => wm.UserId == userId && wm.RolePreset == "Owner")) return false;

            _context.Workspaces.Remove(workspace);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<object?> GetWorkspaceMembersAsync(int userId, int id)
        {
            var workspace = await _context.Workspaces
                .AsNoTracking()
                .IgnoreQueryFilters()
                .AsSplitQuery()
                .Include(w => w.Members).ThenInclude(m => m.User)
                .Include(w => w.WorkspaceTeams).ThenInclude(wt => wt.TeamGroup).ThenInclude(tg => tg.Members).ThenInclude(tm => tm.User)
                .FirstOrDefaultAsync(w => w.Id == id);
            
            if (workspace == null) return null;

            var hasAccess = workspace.Members.Any(m => m.UserId == userId) || 
                            workspace.WorkspaceTeams.Any(wt => wt.TeamGroup != null && wt.TeamGroup.Members.Any(tm => tm.UserId == userId));
                            
            if (!hasAccess && workspace.OwnerId != userId) return null;

            var directMembers = workspace.Members.Select(m => new {
                m.UserId,
                m.User?.Name,
                m.User?.Surname,
                m.User?.Username,
                Source = "Direct",
                TeamName = (string?)null
            });

            var teamMembers = workspace.WorkspaceTeams.Where(wt => wt.TeamGroup != null).SelectMany(wt => wt.TeamGroup!.Members.Select(tm => new {
                tm.UserId,
                tm.User?.Name,
                tm.User?.Surname,
                tm.User?.Username,
                Source = "Team",
                TeamName = wt.TeamGroup.Name
            }));

            var allMembers = directMembers.Concat(teamMembers)
                .GroupBy(m => m.UserId)
                .Select(g => g.OrderBy(m => m.Source == "Direct" ? 0 : 1).First())
                .ToList();

            return allMembers;
        }

        public async Task<bool> AddWorkspaceMemberAsync(int userId, int id, AddMemberDto dto)
        {
            var workspace = await _context.Workspaces.IgnoreQueryFilters().FirstOrDefaultAsync(w => w.Id == id);
            if (workspace == null || workspace.OwnerId != userId) return false;

            var userToAdd = await _context.Users.FirstOrDefaultAsync(u => u.Username == dto.Username);
            if (userToAdd == null) return false;

            if (await _context.WorkspaceMembers.AnyAsync(m => m.WorkspaceId == id && m.UserId == userToAdd.Id))
                return false;

            _context.WorkspaceMembers.Add(new WorkspaceMember {
                WorkspaceId = id,
                UserId = userToAdd.Id,
                RolePreset = "Member",
                JoinedAt = DateTime.Now,
                IsActive = true
            });
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RemoveWorkspaceMemberAsync(int userId, int id, int memberId)
        {
            var workspace = await _context.Workspaces.IgnoreQueryFilters().FirstOrDefaultAsync(w => w.Id == id);
            if (workspace == null) return false;
            if (workspace.OwnerId != userId && userId != memberId) return false;

            var member = await _context.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == id && m.UserId == memberId);
            if (member == null) return false;

            _context.WorkspaceMembers.Remove(member);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AddWorkspaceTeamAsync(int userId, int id, AddTeamDto dto)
        {
            var workspace = await _context.Workspaces.IgnoreQueryFilters().FirstOrDefaultAsync(w => w.Id == id);
            if (workspace == null || workspace.OwnerId != userId) return false;

            var team = await _context.TeamGroups.FirstOrDefaultAsync(t => t.Id == dto.TeamId);
            if (team == null) return false;

            if (await _context.WorkspaceTeams.AnyAsync(wt => wt.WorkspaceId == id && wt.TeamGroupId == dto.TeamId))
                return false;

            _context.WorkspaceTeams.Add(new WorkspaceTeam {
                WorkspaceId = id,
                TeamGroupId = dto.TeamId,
                RolePreset = "Editor"
            });
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RemoveWorkspaceTeamAsync(int userId, int id, int teamId)
        {
            var workspace = await _context.Workspaces.IgnoreQueryFilters().FirstOrDefaultAsync(w => w.Id == id);
            if (workspace == null || workspace.OwnerId != userId) return false;

            var wt = await _context.WorkspaceTeams.FirstOrDefaultAsync(w => w.WorkspaceId == id && w.TeamGroupId == teamId);
            if (wt == null) return false;

            _context.WorkspaceTeams.Remove(wt);
            await _context.SaveChangesAsync();
            return true;
        }

        private string GenerateSlug(string name)
        {
            string str = name.ToLowerInvariant();
            str = str.Replace("ğ", "g").Replace("ü", "u").Replace("ş", "s")
                     .Replace("ı", "i").Replace("ö", "o").Replace("ç", "c");
            str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
            str = Regex.Replace(str, @"\s+", " ").Trim();
            str = str.Substring(0, str.Length <= 45 ? str.Length : 45).Trim();
            str = Regex.Replace(str, @"\s", "-");
            return str;
        }
    }
}
