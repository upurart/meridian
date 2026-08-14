using Microsoft.EntityFrameworkCore;

namespace Meridian.Application.Services
{
    public class ProjectService : IProjectService
    {
        private readonly IAppDbContext _context;

        public ProjectService(IAppDbContext context)
        {
            _context = context;
        }

        private IQueryable<Project> GetAuthorizedProjects(int currentUserId, bool ignoreQueryFilters = false)
        {
            var query = _context.Projects.AsQueryable();
            if (ignoreQueryFilters) query = query.IgnoreQueryFilters();

            return query.Where(p => 
                p.UserId == currentUserId || 
                (p.TeamGroupId != null && p.TeamGroup!.Members.Any(m => m.UserId == currentUserId)) ||
                p.ProjectMembers.Any(m => m.UserId == currentUserId) ||
                (p.WorkspaceId != null && p.Workspace!.Members.Any(m => m.UserId == currentUserId && m.IsActive)) ||
                (p.WorkspaceId != null && p.Workspace!.WorkspaceTeams.Any(wt => wt.TeamGroup!.Members.Any(tm => tm.UserId == currentUserId)))
            );
        }

        private async Task<bool> CanWriteToProjectAsync(int currentUserId, int projectId)
        {
            var project = await _context.Projects.IgnoreQueryFilters()
                .Include(p => p.TeamGroup).ThenInclude(t => t!.Members)
                .Include(p => p.Workspace).ThenInclude(w => w!.Members)
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId);
            
            if (project == null) return false;

            if (project.UserId == currentUserId) return true;
            
            var pm = project.ProjectMembers.FirstOrDefault(m => m.UserId == currentUserId);
            if (pm != null && (pm.Role == "Manager" || pm.Role == "Participant")) return true;

            if (project.Workspace != null) {
                var wm = project.Workspace.Members.FirstOrDefault(m => m.UserId == currentUserId && m.IsActive);
                if (wm != null && (wm.RolePreset == "Admin" || wm.RolePreset == "Member" || wm.RolePreset == "Owner")) return true;
                
                var inMatrixTeam = project.Workspace.WorkspaceTeams?.Any(wt => wt.TeamGroup != null && wt.TeamGroup.Members.Any(m => m.UserId == currentUserId && (m.Role == "Owner" || m.Role == "Admin" || m.Role == "Member"))) ?? false;
                if (inMatrixTeam) return true;
            }

            if (project.TeamGroup != null) {
                var tm = project.TeamGroup.Members.FirstOrDefault(m => m.UserId == currentUserId);
                if (tm != null && (tm.Role == "Owner" || tm.Role == "Admin" || tm.Role == "Member")) return true;
            }
            
            return false;
        }

        private async Task<bool> CanCreateInTeamAsync(int currentUserId, int? teamGroupId)
        {
            if (!teamGroupId.HasValue) return true;
            
            var member = await _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamGroupId == teamGroupId.Value && m.UserId == currentUserId);
            return member != null && (member.Role == "Owner" || member.Role == "Admin");
        }

        private async Task<bool> CanCreateInWorkspaceAsync(int currentUserId, int? workspaceId)
        {
            if (!workspaceId.HasValue) return true;
            
            var member = await _context.WorkspaceMembers.FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId.Value && m.UserId == currentUserId && m.IsActive);
            // "Observer" veya yetkisiz rolleri engelleyip sadece Admin ve Member'lara izin veriyoruz
            if (member != null && (member.RolePreset == "Admin" || member.RolePreset == "Member" || member.RolePreset == "Owner")) return true;
            
            var inMatrixTeam = await _context.WorkspaceTeams
                .Include(wt => wt.TeamGroup)
                .ThenInclude(tg => tg!.Members)
                .AnyAsync(wt => wt.WorkspaceId == workspaceId.Value && wt.TeamGroup!.Members.Any(m => m.UserId == currentUserId && (m.Role == "Owner" || m.Role == "Admin" || m.Role == "Member")));
                
            return inMatrixTeam;
        }

        private static double CalculateSubGoalProgress(SubGoal sg)
        {
            if (sg.Tasks != null && sg.Tasks.Any(t => !t.IsDeleted))
            {
                var activeTasks = sg.Tasks.Where(t => !t.IsDeleted).ToList();
                return (activeTasks.Count(t => t.IsCompleted) / (double)activeTasks.Count) * 100;
            }
            return sg.IsCompleted ? 100 : 0;
        }

        private static double CalculateMainGoalProgress(MainGoal mg)
        {
            var items = new List<double>();
            if (mg.SubGoals != null && mg.SubGoals.Any(sg => !sg.IsDeleted))
                items.AddRange(mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => CalculateSubGoalProgress(sg)));
            if (mg.Tasks != null && mg.Tasks.Any(t => !t.IsDeleted))
                items.AddRange(mg.Tasks.Where(t => !t.IsDeleted).Select(t => t.IsCompleted ? 100.0 : 0.0));

            return items.Any() ? items.Average() : (mg.IsCompleted ? 100 : 0);
        }

        private static double CalculateProjectProgress(Project p)
        {
            var items = new List<double>();
            if (p.MainGoal != null && p.MainGoal.Any(mg => !mg.IsDeleted))
                items.AddRange(p.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => CalculateMainGoalProgress(mg)));
            if (p.Tasks != null && p.Tasks.Any(t => !t.IsDeleted))
                items.AddRange(p.Tasks.Where(t => !t.IsDeleted).Select(t => t.IsCompleted ? 100.0 : 0.0));

            return items.Any() ? items.Average() : 0;
        }

        public async Task<object> GetTreeAsync(int currentUserId)
        {
            var projects = await GetAuthorizedProjects(currentUserId, ignoreQueryFilters: true)
                .Where(p => !p.IsDeleted)
                .AsNoTracking()
                .AsSplitQuery()
                .Include(p => p.TeamGroup)
                .Include(p => p.Workspace)
                .Include(p => p.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .OrderBy(p => p.CreatedAt)
                .ToListAsync();

            var tree = projects.Select(p => new
            { 
                id = p.Id, title = p.Title, description = p.Description,
                teamGroupId = (p.TeamGroupId != null && p.TeamGroup != null && p.TeamGroup.Members.Any(m => m.UserId == currentUserId)) ? p.TeamGroupId : null,
                teamGroupName = (p.TeamGroupId != null && p.TeamGroup != null && p.TeamGroup.Members.Any(m => m.UserId == currentUserId)) ? p.TeamGroup.Name : null,
                workspaceId = p.WorkspaceId, workspaceName = p.Workspace?.Name,
                progress = CalculateProjectProgress(p), createdAt = p.CreatedAt, changedAt = p.ChangedAt,
                startDate = p.StartDate,
                deadline = p.Deadline,
                tasks = p.Tasks.Where(t => !t.IsDeleted && t.MainGoalId == null && t.SubGoalId == null).Select(t => new { id = t.Id, title = t.Title, isCompleted = t.IsCompleted, completedAt = t.CompletedAt }).ToList(),
                mainGoals = p.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => new
                {
                    id = mg.Id, projectId = mg.ProjectId, title = mg.Title,
                    progress = CalculateMainGoalProgress(mg), createdAt = mg.CreatedAt, changedAt = mg.ChangedAt,
                    tasks = mg.Tasks.Where(t => !t.IsDeleted && t.SubGoalId == null).Select(t => new { id = t.Id, title = t.Title, isCompleted = t.IsCompleted, completedAt = t.CompletedAt }).ToList(),
                    subGoals = mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new
                    {
                        id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title,
                        progress = CalculateSubGoalProgress(sg), createdAt = sg.CreatedAt, changedAt = sg.ChangedAt,
                        tasks = sg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, title = t.Title, isCompleted = t.IsCompleted, completedAt = t.CompletedAt }).ToList()
                    }).ToList()
                }).ToList()
            }).ToList();

            return tree;
        }

        public async Task<object> GetRecentProjectsAsync(int currentUserId)
        {
            var projects = await GetAuthorizedProjects(currentUserId, ignoreQueryFilters: true)
                .Where(p => !p.IsDeleted)
                .AsNoTracking()
                .AsSplitQuery()
                .Include(p => p.TeamGroup)
                .Include(p => p.Workspace)
                .Include(p => p.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .OrderByDescending(p => p.LastWorkedAt ?? p.ChangedAt ?? p.CreatedAt)
                .Take(5)
                .ToListAsync();

            var result = projects.Select(p => new
            {
                id = p.Id,
                title = p.Title,
                description = p.Description,
                progress = CalculateProjectProgress(p),
                teamGroupName = p.TeamGroup?.Name ?? "Kişisel",
                workspaceName = p.Workspace?.Name ?? "Genel"
            }).ToList();

            return result;
        }

        public async Task<object> SearchProjectsAsync(int currentUserId, string q, string filter = "all")
        {
            if (string.IsNullOrWhiteSpace(q))
                return new List<object>();

            var query = q.ToLower();
            var results = new List<object>();

            if (filter == "all" || filter == "projects")
            {
                var projects = await GetAuthorizedProjects(currentUserId, ignoreQueryFilters: true)
                    .Where(p => !p.IsDeleted)
                    .AsNoTracking()
                    .AsSplitQuery()
                    .Include(p => p.TeamGroup)
                    .Include(p => p.Workspace)
                    .Include(p => p.Tasks)
                    .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                    .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                    .Where(p => p.Title.Contains(query) || 
                                (p.Description != null && p.Description.Contains(query)) ||
                                p.Tasks.Any(t => !t.IsDeleted && t.Title.Contains(query)) ||
                                p.MainGoal.Any(mg => !mg.IsDeleted && (
                                    mg.Title.Contains(query) ||
                                    mg.Tasks.Any(t => !t.IsDeleted && t.Title.Contains(query)) ||
                                    mg.SubGoals.Any(sg => !sg.IsDeleted && (
                                        sg.Title.Contains(query) ||
                                        sg.Tasks.Any(t => !t.IsDeleted && t.Title.Contains(query))
                                    ))
                                )))
                    .OrderByDescending(p => p.LastWorkedAt ?? p.ChangedAt ?? p.CreatedAt)
                    .Take(15)
                    .ToListAsync();

                results.AddRange(projects.Select(p => new
                {
                    type = "project",
                    id = p.Id,
                    title = p.Title,
                    description = p.Description,
                    progress = CalculateProjectProgress(p),
                    teamGroupName = p.TeamGroup?.Name ?? "Kişisel",
                    workspaceName = p.Workspace?.Name ?? "Genel"
                }));
            }

            if (filter == "all" || filter == "teams")
            {
                var teams = await _context.TeamGroups
                    .Where(t => t.Members.Any(m => m.UserId == currentUserId) && 
                                (t.Name.Contains(query) || (t.Description != null && t.Description.Contains(query))))
                    .Take(15)
                    .ToListAsync();

                results.AddRange(teams.Select(t => new
                {
                    type = "team",
                    id = t.Id,
                    title = t.Name,
                    description = t.Description
                }));
            }

            if (filter == "all" || filter == "workspaces")
            {
                var workspaces = await _context.WorkspaceMembers
                    .Include(wm => wm.Workspace)
                    .Where(wm => wm.UserId == currentUserId && wm.IsActive && wm.Workspace != null && wm.Workspace!.IsActive && 
                                 (wm.Workspace!.Name.Contains(query) || (wm.Workspace.Description != null && wm.Workspace.Description.Contains(query))))
                    .Select(wm => wm.Workspace)
                    .Take(15)
                    .ToListAsync();

                results.AddRange(workspaces.Select(w => new
                {
                    type = "workspace",
                    id = w!.Id,
                    title = w.Name,
                    description = w.Description
                }));
            }

            return results;
        }

        public async Task<object?> GetProjectDetailsAsync(int currentUserId, int id)
        {
            var project = await GetAuthorizedProjects(currentUserId, ignoreQueryFilters: true)
                .AsNoTracking()
                .AsSplitQuery()
                .Include(p => p.TeamGroup).ThenInclude(tg => tg!.Members)
                .Include(p => p.Workspace).ThenInclude(w => w!.WorkspaceTeams).ThenInclude(wt => wt.TeamGroup)
                .Include(p => p.ProjectMembers)
                .Include(p => p.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (project == null) return null;

            bool isOwner = project.UserId == currentUserId;
            bool isTeamManager = project.TeamGroup != null && project.TeamGroup.Members.Any(m => m.UserId == currentUserId && m.Role == "Manager");
            bool isProjectManager = project.ProjectMembers.Any(pm => pm.UserId == currentUserId && pm.Role == "Manager");
            bool hasManageMembersAccess = isOwner || isTeamManager || isProjectManager;
            
            bool isProjectObserver = project.ProjectMembers.Any(pm => pm.UserId == currentUserId && pm.Role == "Observer");
            bool isTeamObserver = project.TeamGroup != null && project.TeamGroup.Members.Any(m => m.UserId == currentUserId && m.Role == "Observer");
            bool isObserver = !isOwner && !isTeamManager && !isProjectManager && (isProjectObserver || isTeamObserver);

            string teamGroupName = "";
            if (project.TeamGroup != null) teamGroupName = project.TeamGroup.Name;
            else if (project.Workspace != null && project.Workspace.WorkspaceTeams.Any())
                teamGroupName = project.Workspace.WorkspaceTeams.First().TeamGroup?.Name ?? "";

            var result = new
            {
                id = project.Id, title = project.Title, description = project.Description,
                progress = CalculateProjectProgress(project), createdAt = project.CreatedAt, changedAt = project.ChangedAt, startDate = project.StartDate, deadline = project.Deadline,
                hasManageMembersAccess = hasManageMembersAccess,
                isObserver = isObserver,
                teamGroupName = teamGroupName,
                workspaceName = project.Workspace?.Name,
                tasks = project.Tasks.Where(t => !t.IsDeleted && t.MainGoalId == null && t.SubGoalId == null).Select(t => new { id = t.Id, projectId = t.ProjectId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, createdAt = t.CreatedAt, completedAt = t.CompletedAt, rowVersion = t.RowVersion != null ? Convert.ToBase64String(t.RowVersion) : null }).OrderBy(t => t.createdAt).ToList(),
                mainGoals = project.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => new
                {
                    id = mg.Id, projectId = mg.ProjectId, title = mg.Title, description = mg.Description, isCompleted = mg.IsCompleted, progress = CalculateMainGoalProgress(mg), createdAt = mg.CreatedAt, changedAt = mg.ChangedAt,
                    tasks = mg.Tasks.Where(t => !t.IsDeleted && t.SubGoalId == null).Select(t => new { id = t.Id, mainGoalId = t.MainGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, createdAt = t.CreatedAt, completedAt = t.CompletedAt, rowVersion = t.RowVersion != null ? Convert.ToBase64String(t.RowVersion) : null }).OrderBy(t => t.createdAt).ToList(),
                    subGoals = mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new
                    {
                        id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), createdAt = sg.CreatedAt, changedAt = sg.ChangedAt,
                        tasks = sg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, createdAt = t.CreatedAt, completedAt = t.CompletedAt, rowVersion = t.RowVersion != null ? Convert.ToBase64String(t.RowVersion) : null }).OrderBy(t => t.createdAt).ToList()
                    }).OrderBy(sg => sg.createdAt).ToList()
                }).OrderBy(mg => mg.createdAt).ToList()
            };

            return result;
        }

        public async Task<(bool Success, int? ProjectId)> CreateProjectAsync(int currentUserId, ProjectUpsertRequest req)
        {
            if (!await CanCreateInTeamAsync(currentUserId, req.TeamGroupId)) return (false, null);
            if (!await CanCreateInWorkspaceAsync(currentUserId, req.WorkspaceId)) return (false, null);

            var project = new Project
            {
                UserId = currentUserId,
                TeamGroupId = req.TeamGroupId,
                WorkspaceId = req.WorkspaceId,
                Title = req.Title,
                Description = req.Description ?? "",
                StartDate = req.StartDate,
                Deadline = req.Deadline,
                CreatedAt = DateTime.Now
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            // Auto-generate Folder Hierarchy: Çalışma Alanları \ WorkspaceAdı \ ProjeAdı
            if (req.WorkspaceId.HasValue)
            {
                var userOrgId = await _context.Users.Where(u => u.Id == currentUserId).Select(u => u.OrganizationId).FirstOrDefaultAsync();
                var workspace = await _context.Workspaces.FirstOrDefaultAsync(w => w.Id == req.WorkspaceId.Value);
                if (workspace != null)
                {
                    var rootFolder = await _context.Folders.FirstOrDefaultAsync(f => f.Name == "Çalışma Alanları" && f.ParentFolderId == null && f.OrganizationId == userOrgId && f.IsSystemFolder);
                    if (rootFolder == null)
                    {
                        rootFolder = new Folder
                        {
                            Name = "Çalışma Alanları",
                            OrganizationId = userOrgId,
                            IsSystemFolder = true,
                            CreatedById = currentUserId,
                            CreatedAt = DateTime.Now
                        };
                        _context.Folders.Add(rootFolder);
                        await _context.SaveChangesAsync();
                    }

                    var wsFolder = await _context.Folders.FirstOrDefaultAsync(f => f.WorkspaceId == workspace.Id && f.ParentFolderId == rootFolder.Id);
                    if (wsFolder == null)
                    {
                        wsFolder = new Folder
                        {
                            Name = workspace.Name,
                            OrganizationId = userOrgId,
                            ParentFolderId = rootFolder.Id,
                            WorkspaceId = workspace.Id,
                            IsSystemFolder = true,
                            CreatedById = currentUserId,
                            CreatedAt = DateTime.Now
                        };
                        _context.Folders.Add(wsFolder);
                        await _context.SaveChangesAsync();
                    }

                    var projFolder = new Folder
                    {
                        Name = project.Title,
                        OrganizationId = userOrgId,
                        ParentFolderId = wsFolder.Id,
                        ProjectId = project.Id,
                        IsSystemFolder = true,
                        CreatedById = currentUserId,
                        CreatedAt = DateTime.Now
                    };
                    _context.Folders.Add(projFolder);
                    await _context.SaveChangesAsync();
                }
            }

            if (req.InitialGoals != null && req.InitialGoals.Count > 0)
            {
                foreach (var g in req.InitialGoals)
                {
                    if (string.IsNullOrWhiteSpace(g.Title)) continue;
                    var mg = new MainGoal
                    {
                        ProjectId = project.Id,
                        Title = g.Title.Trim(),
                        Description = g.Description ?? "",
                        CreatedAt = DateTime.Now,
                        SubGoals = new List<SubGoal>(),
                        Tasks = new List<TaskItem>()
                    };

                    if (g.SubGoals != null && g.SubGoals.Count > 0)
                    {
                        foreach (var sg in g.SubGoals)
                        {
                            if (string.IsNullOrWhiteSpace(sg.Title)) continue;
                            var subGoal = new SubGoal
                            {
                                Title = sg.Title.Trim(),
                                Description = sg.Description ?? "",
                                CreatedAt = DateTime.Now,
                                Tasks = new List<TaskItem>()
                            };

                            if (sg.Tasks != null && sg.Tasks.Count > 0)
                            {
                                foreach (var t in sg.Tasks)
                                {
                                    if (string.IsNullOrWhiteSpace(t.Title)) continue;
                                    subGoal.Tasks.Add(new TaskItem
                                    {
                                        Title = t.Title.Trim(),
                                        Description = t.Description ?? "",
                                        CreatedAt = DateTime.Now
                                    });
                                }
                            }
                            mg.SubGoals.Add(subGoal);
                        }
                    }

                    if (g.Tasks != null && g.Tasks.Count > 0)
                    {
                        foreach (var t in g.Tasks)
                        {
                            if (string.IsNullOrWhiteSpace(t.Title)) continue;
                            mg.Tasks.Add(new TaskItem
                            {
                                Title = t.Title.Trim(),
                                Description = t.Description ?? "",
                                CreatedAt = DateTime.Now
                            });
                        }
                    }
                    _context.MainGoals.Add(mg);
                }
            }
            else if ((req.InitialMainGoalCount ?? 0) > 0 || (req.InitialTaskCountPerProject ?? 0) > 0)
            {
                int mgCount = req.InitialMainGoalCount ?? 0;
                int sgCount = req.InitialSubGoalCountPerMain ?? 0;
                int tSubCount = req.InitialTaskCountPerSub ?? 0;
                int tMainCount = req.InitialTaskCountPerMain ?? 0;
                int tProjCount = req.InitialTaskCountPerProject ?? 0;

                for (int i = 1; i <= mgCount; i++)
                {
                    var mg = new MainGoal { ProjectId = project.Id, Title = $"Ana Hedef {i}", Description = "", CreatedAt = DateTime.Now, SubGoals = new List<SubGoal>(), Tasks = new List<TaskItem>() };

                    for (int j = 1; j <= sgCount; j++)
                    {
                        var sg = new SubGoal { Title = $"Alt Hedef {i}.{j}", Description = "", CreatedAt = DateTime.Now, Tasks = new List<TaskItem>() };

                        for (int k = 1; k <= tSubCount; k++)
                        {
                            sg.Tasks.Add(new TaskItem { Title = $"Görev {i}.{j}.{k}", Description = "", CreatedAt = DateTime.Now });
                        }
                        mg.SubGoals.Add(sg);
                    }

                    for (int k = 1; k <= tMainCount; k++)
                    {
                        mg.Tasks.Add(new TaskItem { Title = $"Ana Hedef {i} - Görev {k}", Description = "", CreatedAt = DateTime.Now });
                    }
                    _context.MainGoals.Add(mg);
                }

                for (int k = 1; k <= tProjCount; k++)
                {
                    _context.TaskItems.Add(new TaskItem { ProjectId = project.Id, Title = $"Proje Görevi {k}", Description = "", CreatedAt = DateTime.Now });
                }
            }

            if (req.InitialTasks != null && req.InitialTasks.Count > 0)
            {
                foreach (var t in req.InitialTasks)
                {
                    if (string.IsNullOrWhiteSpace(t.Title)) continue;
                    _context.TaskItems.Add(new TaskItem
                    {
                        ProjectId = project.Id,
                        Title = t.Title.Trim(),
                        Description = t.Description ?? "",
                        CreatedAt = DateTime.Now
                    });
                }
            }

            await _context.SaveChangesAsync();

            return (true, project.Id);
        }

        public async Task<bool> UpdateProjectAsync(int currentUserId, int id, ProjectUpsertRequest req)
        {
            if (!await CanWriteToProjectAsync(currentUserId, id)) return false;

            var project = await GetAuthorizedProjects(currentUserId, ignoreQueryFilters: true).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return false;

            if (project.Title != req.Title)
            {
                var folder = await _context.Folders.FirstOrDefaultAsync(f => f.ProjectId == id);
                if (folder != null)
                {
                    folder.Name = req.Title;
                }
            }

            project.Title = req.Title;
            project.Description = req.Description ?? "";
            project.StartDate = req.StartDate;
            project.Deadline = req.Deadline;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteProjectAsync(int currentUserId, int id)
        {
            var project = await GetAuthorizedProjects(currentUserId, ignoreQueryFilters: true).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return false;

            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            project.IsDeleted = true; 
            project.DeletedAt = deleteTime; 
            project.DeleteBatchId = batchId;

            await _context.SaveChangesAsync();

            // Bulk soft delete
            await _context.MainGoals.Where(mg => mg.ProjectId == id && !mg.IsDeleted)
                .ExecuteUpdateAsync(s => s.SetProperty(mg => mg.IsDeleted, true).SetProperty(mg => mg.DeletedAt, deleteTime).SetProperty(mg => mg.DeleteBatchId, batchId));

            await _context.Folders.Where(f => f.ProjectId == id && !f.IsDeleted)
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.IsDeleted, true).SetProperty(f => f.DeletedAt, deleteTime));

            var mainGoalIds = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.ProjectId == id).Select(mg => mg.Id).ToListAsync();
            
            if (mainGoalIds.Any())
            {
                await _context.SubGoals.Where(sg => mainGoalIds.Contains(sg.MainGoalId) && !sg.IsDeleted)
                    .ExecuteUpdateAsync(s => s.SetProperty(sg => sg.IsDeleted, true).SetProperty(sg => sg.DeletedAt, deleteTime).SetProperty(sg => sg.DeleteBatchId, batchId));
            }

            var subGoalIds = await _context.SubGoals.IgnoreQueryFilters().Where(sg => mainGoalIds.Contains(sg.MainGoalId)).Select(sg => sg.Id).ToListAsync();

            await _context.TaskItems.Where(t => (t.ProjectId == id || (t.MainGoalId != null && mainGoalIds.Contains(t.MainGoalId.Value)) || (t.SubGoalId != null && subGoalIds.Contains(t.SubGoalId.Value))) && !t.IsDeleted)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsDeleted, true).SetProperty(t => t.DeletedAt, deleteTime).SetProperty(t => t.DeleteBatchId, batchId));

            return true;
        }

        public async Task<IEnumerable<object>> GetDeletedProjectsAsync(int currentUserId)
        {
            return await GetAuthorizedProjects(currentUserId, true)
                .Where(p => p.IsDeleted)
                .OrderByDescending(p => p.DeletedAt)
                .Select(p => new { id = p.Id, title = p.Title, description = p.Description, deletedAt = p.DeletedAt })
                .ToListAsync();
        }

        public async Task<bool> RestoreProjectAsync(int currentUserId, int id)
        {
            if (!await CanWriteToProjectAsync(currentUserId, id)) return false;

            var project = await GetAuthorizedProjects(currentUserId, true).FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);
            if (project == null) return false;

            project.IsDeleted = false; project.DeletedAt = null;
            
            var folder = await _context.Folders.IgnoreQueryFilters().FirstOrDefaultAsync(f => f.ProjectId == id && f.IsDeleted);
            if (folder != null)
            {
                folder.IsDeleted = false;
                folder.DeletedAt = null;
            }

            if (project.DeleteBatchId.HasValue)
            {
                var batchId = project.DeleteBatchId.Value;
                var mainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();
                foreach (var mg in mainGoals) { mg.IsDeleted = false; mg.DeletedAt = null; mg.DeleteBatchId = null; }

                var subGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals) { sg.IsDeleted = false; sg.DeletedAt = null; sg.DeleteBatchId = null; }

                var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsDeleted = false; t.DeletedAt = null; t.DeleteBatchId = null; }

                project.DeleteBatchId = null;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> BulkRestoreProjectsAsync(int currentUserId, List<int> ids)
        {
            if (ids == null || !ids.Any()) return false;

            var projects = await GetAuthorizedProjects(currentUserId, true).Where(p => ids.Contains(p.Id) && p.IsDeleted).ToListAsync();

            foreach (var project in projects)
            {
                if (!await CanWriteToProjectAsync(currentUserId, project.Id)) continue;
                project.IsDeleted = false; project.DeletedAt = null;

                var folder = await _context.Folders.IgnoreQueryFilters().FirstOrDefaultAsync(f => f.ProjectId == project.Id && f.IsDeleted);
                if (folder != null) { folder.IsDeleted = false; folder.DeletedAt = null; }

                if (project.DeleteBatchId.HasValue)
                {
                    var batchId = project.DeleteBatchId.Value;
                    var mainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();
                    foreach (var mg in mainGoals) { mg.IsDeleted = false; mg.DeletedAt = null; mg.DeleteBatchId = null; }
                    var subGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                    foreach (var sg in subGoals) { sg.IsDeleted = false; sg.DeletedAt = null; sg.DeleteBatchId = null; }
                    var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                    foreach (var t in tasks) { t.IsDeleted = false; t.DeletedAt = null; t.DeleteBatchId = null; }
                    project.DeleteBatchId = null;
                }
            }
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RestoreAllProjectsAsync(int currentUserId)
        {
            var projects = await GetAuthorizedProjects(currentUserId, true).Where(p => p.IsDeleted).ToListAsync();

            foreach (var project in projects)
            {
                if (!await CanWriteToProjectAsync(currentUserId, project.Id)) continue;
                project.IsDeleted = false; project.DeletedAt = null;

                var folder = await _context.Folders.IgnoreQueryFilters().FirstOrDefaultAsync(f => f.ProjectId == project.Id && f.IsDeleted);
                if (folder != null) { folder.IsDeleted = false; folder.DeletedAt = null; }

                if (project.DeleteBatchId.HasValue)
                {
                    var batchId = project.DeleteBatchId.Value;
                    var mainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();
                    foreach (var mg in mainGoals) { mg.IsDeleted = false; mg.DeletedAt = null; mg.DeleteBatchId = null; }
                    var subGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                    foreach (var sg in subGoals) { sg.IsDeleted = false; sg.DeletedAt = null; sg.DeleteBatchId = null; }
                    var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                    foreach (var t in tasks) { t.IsDeleted = false; t.DeletedAt = null; t.DeleteBatchId = null; }
                    project.DeleteBatchId = null;
                }
            }
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> BulkPermanentlyDeleteProjectsAsync(int currentUserId, List<int> ids)
        {
            if (ids == null || !ids.Any()) return false;

            var projectList = new List<Project>();
            foreach (var id in ids)
            {
                if (!await CanWriteToProjectAsync(currentUserId, id)) continue;
                var p = await GetAuthorizedProjects(currentUserId, true).FirstOrDefaultAsync(proj => proj.Id == id && proj.IsDeleted);
                if (p != null) projectList.Add(p);
            }
            
            if (!projectList.Any()) return true;

            var projectIds = projectList.Select(p => p.Id).ToList();

            var mainGoalsToDelete = await _context.MainGoals.IgnoreQueryFilters().Where(mg => projectIds.Contains(mg.ProjectId)).ToListAsync();
            var mgIds = mainGoalsToDelete.Select(mg => mg.Id).ToList();

            var subGoalsToDelete = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoalId != 0 && mgIds.Contains(sg.MainGoalId)).ToListAsync();
            var sgIds = subGoalsToDelete.Select(sg => sg.Id).ToList();

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => (t.ProjectId != null && projectIds.Contains(t.ProjectId.Value)) || (t.MainGoalId != null && mgIds.Contains(t.MainGoalId.Value)) || (t.SubGoalId != null && sgIds.Contains(t.SubGoalId.Value))).ToListAsync();

            var activityLogsToDelete = await _context.ActivityLogs.Where(a => projectIds.Contains(a.ProjectId)).ToListAsync();

            _context.TaskItems.RemoveRange(tasksToDelete);
            _context.SubGoals.RemoveRange(subGoalsToDelete);
            _context.MainGoals.RemoveRange(mainGoalsToDelete);
            _context.ActivityLogs.RemoveRange(activityLogsToDelete);

            _context.Projects.RemoveRange(projectList);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> PermanentAllProjectsAsync(int currentUserId)
        {
            var allProjects = await GetAuthorizedProjects(currentUserId, true).Where(p => p.IsDeleted).ToListAsync();
            var projects = new List<Project>();
            foreach(var p in allProjects)
            {
                if (await CanWriteToProjectAsync(currentUserId, p.Id)) projects.Add(p);
            }
            
            if (!projects.Any()) return true;

            var projectIds = projects.Select(p => p.Id).ToList();

            var mainGoalsToDelete = await _context.MainGoals.IgnoreQueryFilters().Where(mg => projectIds.Contains(mg.ProjectId)).ToListAsync();
            var mgIds = mainGoalsToDelete.Select(mg => mg.Id).ToList();

            var subGoalsToDelete = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoalId != 0 && mgIds.Contains(sg.MainGoalId)).ToListAsync();
            var sgIds = subGoalsToDelete.Select(sg => sg.Id).ToList();

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => (t.ProjectId != null && projectIds.Contains(t.ProjectId.Value)) || (t.MainGoalId != null && mgIds.Contains(t.MainGoalId.Value)) || (t.SubGoalId != null && sgIds.Contains(t.SubGoalId.Value))).ToListAsync();

            var activityLogsToDelete = await _context.ActivityLogs.Where(a => projectIds.Contains(a.ProjectId)).ToListAsync();

            _context.TaskItems.RemoveRange(tasksToDelete);
            _context.SubGoals.RemoveRange(subGoalsToDelete);
            _context.MainGoals.RemoveRange(mainGoalsToDelete);
            _context.ActivityLogs.RemoveRange(activityLogsToDelete);

            _context.Projects.RemoveRange(projects);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> PermanentlyDeleteProjectAsync(int currentUserId, int id)
        {
            if (!await CanWriteToProjectAsync(currentUserId, id)) return false;

            var project = await GetAuthorizedProjects(currentUserId, true).FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);
            if (project == null) return false; // In a more advanced implementation we might return an enum indicating Forbidden vs NotFound

            var mainGoalsToDelete = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.ProjectId == id).ToListAsync();
            var mgIds = mainGoalsToDelete.Select(mg => mg.Id).ToList();

            var subGoalsToDelete = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoalId != 0 && mgIds.Contains(sg.MainGoalId)).ToListAsync();
            var sgIds = subGoalsToDelete.Select(sg => sg.Id).ToList();

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.ProjectId == id || (t.MainGoalId != null && mgIds.Contains(t.MainGoalId.Value)) || (t.SubGoalId != null && sgIds.Contains(t.SubGoalId.Value))).ToListAsync();

            var activityLogsToDelete = await _context.ActivityLogs.Where(a => a.ProjectId == id).ToListAsync();

            _context.TaskItems.RemoveRange(tasksToDelete);
            _context.SubGoals.RemoveRange(subGoalsToDelete);
            _context.MainGoals.RemoveRange(mainGoalsToDelete);
            _context.ActivityLogs.RemoveRange(activityLogsToDelete);
            _context.Projects.Remove(project);

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<object?> GetDeletedProjectItemsAsync(int currentUserId, int id)
        {
            var project = await GetAuthorizedProjects(currentUserId, true).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return null;

            var deletedMainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.ProjectId == id && mg.IsDeleted).Include(mg => mg.Tasks).Include(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks).OrderByDescending(mg => mg.DeletedAt).ToListAsync();
            var mainGoalsResult = deletedMainGoals.Select(mg => new { type = "maingoal", id = mg.Id, projectId = mg.ProjectId, title = mg.Title, description = mg.Description, isCompleted = mg.IsCompleted, progress = CalculateMainGoalProgress(mg), deletedAt = mg.DeletedAt, createdAt = mg.CreatedAt, changedAt = mg.ChangedAt, tasks = mg.Tasks.Select(t => new { id = t.Id, mainGoalId = t.MainGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, isDeleted = t.IsDeleted }).OrderBy(t => t.createdAt).ToList(), subGoals = mg.SubGoals.Select(sg => new { id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), deletedAt = sg.DeletedAt, createdAt = sg.CreatedAt, changedAt = sg.ChangedAt, isDeleted = sg.IsDeleted, tasks = sg.Tasks.Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, isDeleted = t.IsDeleted }).OrderBy(t => t.createdAt).ToList() }).OrderBy(sg => sg.createdAt).ToList() }).ToList();

            var deletedSubGoals = await _context.SubGoals.IgnoreQueryFilters().Include(sg => sg.MainGoal).Include(sg => sg.Tasks).Where(sg => sg.MainGoal!.ProjectId == id && sg.IsDeleted && !sg.MainGoal!.IsDeleted).OrderByDescending(sg => sg.DeletedAt).ToListAsync();
            var subGoalsResult = deletedSubGoals.Select(sg => new { type = "subgoal", id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), deletedAt = sg.DeletedAt, createdAt = sg.CreatedAt, changedAt = sg.ChangedAt, parentTitle = sg.MainGoal?.Title ?? "", isDeleted = sg.IsDeleted, tasks = sg.Tasks.Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, isDeleted = t.IsDeleted }).OrderBy(t => t.createdAt).ToList() }).ToList();

            var deletedTasks = await _context.TaskItems.IgnoreQueryFilters().Include(t => t.SubGoal).ThenInclude(sg => sg.MainGoal).Include(t => t.MainGoal).Include(t => t.Project).Where(t => t.IsDeleted && ((t.SubGoalId != null && t.SubGoal!.MainGoal.ProjectId == id && !t.SubGoal!.IsDeleted && !t.SubGoal!.MainGoal.IsDeleted) || (t.MainGoalId != null && t.MainGoal.ProjectId == id && !t.MainGoal.IsDeleted) || (t.ProjectId != null && t.ProjectId == id))).OrderByDescending(t => t.DeletedAt).ToListAsync();
            var tasksResult = deletedTasks.Select(t => { string parentTitle = ""; if (t.SubGoal != null) parentTitle = $"Alt Hedef: {t.SubGoal!.Title}"; else if (t.MainGoal != null) parentTitle = $"Ana Hedef: {t.MainGoal.Title}"; else if (t.Project != null) parentTitle = $"Proje: {t.Project.Title}"; return new { type = "task", id = t.Id, subGoalId = t.SubGoalId, mainGoalId = t.MainGoalId, projectId = t.ProjectId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, parentTitle = parentTitle, isDeleted = t.IsDeleted }; }).ToList();

            return new { mainGoals = mainGoalsResult, subGoals = subGoalsResult, tasks = tasksResult };
        }
    }
}
