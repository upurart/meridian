using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;

namespace Meridian.Controllers
{
    [Route("api/dashboard")]
    public class ProjectApiController : BaseApiController
    {
        public ProjectApiController(AppDbContext context) : base(context) { }

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

        [HttpGet("tree")]
        public async Task<IActionResult> GetTree()
        {
            var projects = await GetAuthorizedProjects()
                .Where(p => !p.IsDeleted)
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
                teamGroupId = p.TeamGroupId, teamGroupName = p.TeamGroup?.Name,
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

            return Ok(tree);
        }

        [HttpGet("recent-projects")]
        public async Task<IActionResult> GetRecentProjects()
        {
            var projects = await GetAuthorizedProjects()
                .Where(p => !p.IsDeleted)
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

            return Ok(result);
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchProjects([FromQuery] string q, [FromQuery] string filter = "all")
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(new List<object>());

            var query = q.ToLower();
            var results = new List<object>();

            // 1. Projeler (Projects)
            if (filter == "all" || filter == "projects")
            {
                var projects = await GetAuthorizedProjects()
                    .Where(p => !p.IsDeleted)
                    .Include(p => p.TeamGroup)
                    .Include(p => p.Workspace)
                    .Include(p => p.Tasks)
                    .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                    .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                    .Where(p => p.Title.ToLower().Contains(query) || 
                                (p.Description != null && p.Description.ToLower().Contains(query)) ||
                                p.Tasks.Any(t => !t.IsDeleted && t.Title.ToLower().Contains(query)) ||
                                p.MainGoal.Any(mg => !mg.IsDeleted && (
                                    mg.Title.ToLower().Contains(query) ||
                                    mg.Tasks.Any(t => !t.IsDeleted && t.Title.ToLower().Contains(query)) ||
                                    mg.SubGoals.Any(sg => !sg.IsDeleted && (
                                        sg.Title.ToLower().Contains(query) ||
                                        sg.Tasks.Any(t => !t.IsDeleted && t.Title.ToLower().Contains(query))
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

            // 2. Takımlar (Teams)
            if (filter == "all" || filter == "teams")
            {
                var teams = await _context.TeamGroups
                    .Where(t => t.Members.Any(m => m.UserId == CurrentUserId) && 
                                (t.Name.ToLower().Contains(query) || (t.Description != null && t.Description.ToLower().Contains(query))))
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

            // 3. Çalışma Alanları (Workspaces)
            if (filter == "all" || filter == "workspaces")
            {
                var workspaces = await _context.WorkspaceMembers
                    .Include(wm => wm.Workspace)
                    .Where(wm => wm.UserId == CurrentUserId && wm.IsActive && wm.Workspace != null && wm.Workspace!.IsActive && 
                                 (wm.Workspace!.Name.ToLower().Contains(query) || (wm.Workspace.Description != null && wm.Workspace.Description.ToLower().Contains(query))))
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

            return Ok(results);
        }

        [HttpGet("project/{id}")]
        public async Task<IActionResult> GetProjectDetails(int id)
        {
            var project = await GetAuthorizedProjects()
                .Include(p => p.TeamGroup).ThenInclude(tg => tg.Members)
                .Include(p => p.Workspace).ThenInclude(w => w!.TeamGroup)
                .Include(p => p.ProjectMembers)
                .Include(p => p.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (project == null) return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });

            bool isOwner = project.UserId == CurrentUserId;
            bool isTeamManager = project.TeamGroup != null && project.TeamGroup.Members.Any(m => m.UserId == CurrentUserId && m.Role == "Manager");
            bool isProjectManager = project.ProjectMembers.Any(pm => pm.UserId == CurrentUserId && pm.Role == "Manager");
            bool hasManageMembersAccess = isOwner || isTeamManager || isProjectManager;
            
            bool isProjectObserver = project.ProjectMembers.Any(pm => pm.UserId == CurrentUserId && pm.Role == "Observer");
            bool isTeamObserver = project.TeamGroup != null && project.TeamGroup.Members.Any(m => m.UserId == CurrentUserId && m.Role == "Observer");
            bool isObserver = !isOwner && !isTeamManager && !isProjectManager && (isProjectObserver || isTeamObserver);

            var result = new
            {
                id = project.Id, title = project.Title, description = project.Description,
                progress = CalculateProjectProgress(project), createdAt = project.CreatedAt, changedAt = project.ChangedAt, startDate = project.StartDate, deadline = project.Deadline,
                hasManageMembersAccess = hasManageMembersAccess,
                isObserver = isObserver,
                teamGroupName = project.TeamGroup?.Name ?? project.Workspace?.TeamGroup?.Name,
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

            return Ok(result);
        }

        [HttpPost("project")]
        public async Task<IActionResult> CreateProject([FromBody] ProjectUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (!await CanCreateInTeamAsync(req.TeamGroupId)) return Forbid();
            if (!await CanCreateInWorkspaceAsync(req.WorkspaceId)) return Forbid();

            var project = new Project
            {
                UserId = CurrentUserId,
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

            return Ok(new { success = true, id = project.Id });
        }

        [HttpPut("project/{id}")]
        public async Task<IActionResult> UpdateProject(int id, [FromBody] ProjectUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (!await CanWriteToProjectAsync(id)) return Forbid();

            var project = await GetAuthorizedProjects().FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound();

            project.Title = req.Title;
            project.Description = req.Description ?? "";
            project.StartDate = req.StartDate;
            project.Deadline = req.Deadline;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("project/{id}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var project = await GetAuthorizedProjects()
                .Include(p => p.Tasks).Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();

            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            project.IsDeleted = true; project.DeletedAt = deleteTime; project.DeleteBatchId = batchId;

            foreach (var t in project.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }
            foreach (var mg in project.MainGoal.Where(mg => !mg.IsDeleted))
            {
                mg.IsDeleted = true; mg.DeletedAt = deleteTime; mg.DeleteBatchId = batchId;
                foreach (var t in mg.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }
                foreach (var sg in mg.SubGoals.Where(sg => !sg.IsDeleted))
                {
                    sg.IsDeleted = true; sg.DeletedAt = deleteTime; sg.DeleteBatchId = batchId;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedProjects()
        {
            var deletedProjects = await GetAuthorizedProjects(true)
                .Where(p => p.IsDeleted)
                .OrderByDescending(p => p.DeletedAt)
                .Select(p => new { id = p.Id, title = p.Title, description = p.Description, deletedAt = p.DeletedAt })
                .ToListAsync();

            return Ok(deletedProjects);
        }

        [HttpPost("project/{id}/restore")]
        public async Task<IActionResult> RestoreProject(int id)
        {
            if (!await CanWriteToProjectAsync(id)) return Forbid();

            var project = await GetAuthorizedProjects(true).FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);
            if (project == null) return NotFound(new { message = "Silinmiş proje bulunamadı." });

            project.IsDeleted = false; project.DeletedAt = null;

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
            return Ok(new { success = true });
        }

        [HttpPost("project/bulk-restore")]
        public async Task<IActionResult> BulkRestoreProjects([FromBody] List<int> ids)
        {
            if (ids == null || !ids.Any()) return BadRequest(new { message = "Kimlik bilgisi gönderilmedi." });

            var projects = await GetAuthorizedProjects(true).Where(p => ids.Contains(p.Id) && p.IsDeleted).ToListAsync();

            foreach (var project in projects)
            {
                if (!await CanWriteToProjectAsync(project.Id)) continue;
                project.IsDeleted = false; project.DeletedAt = null;
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
            return Ok(new { success = true });
        }

        [HttpPost("project/restore-all")]
        public async Task<IActionResult> RestoreAllProjects()
        {
            var projects = await GetAuthorizedProjects(true).Where(p => p.IsDeleted).ToListAsync();

            foreach (var project in projects)
            {
                if (!await CanWriteToProjectAsync(project.Id)) continue;
                project.IsDeleted = false; project.DeletedAt = null;
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
            return Ok(new { success = true });
        }

        [HttpPost("project/bulk-permanent")]
        public async Task<IActionResult> BulkPermanentlyDeleteProjects([FromBody] List<int> ids)
        {
            if (ids == null || !ids.Any()) return BadRequest(new { message = "Kimlik bilgisi gönderilmedi." });

            var projectList = new List<Project>();
            foreach (var id in ids)
            {
                if (!await CanWriteToProjectAsync(id)) continue;
                var p = await GetAuthorizedProjects(true).FirstOrDefaultAsync(proj => proj.Id == id && proj.IsDeleted);
                if (p != null) projectList.Add(p);
            }
            
            if (!projectList.Any()) return Ok(new { success = true });

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
            return Ok(new { success = true });
        }

        [HttpPost("project/permanent-all")]
        public async Task<IActionResult> PermanentAllProjects()
        {
            var allProjects = await GetAuthorizedProjects(true).Where(p => p.IsDeleted).ToListAsync();
            var projects = new List<Project>();
            foreach(var p in allProjects)
            {
                if (await CanWriteToProjectAsync(p.Id)) projects.Add(p);
            }
            
            if (!projects.Any()) return Ok(new { success = true });

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
            return Ok(new { success = true });
        }

        [HttpDelete("project/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteProject(int id)
        {
            if (!await CanWriteToProjectAsync(id)) return Forbid();

            var project = await GetAuthorizedProjects(true).FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);
            if (project == null) return NotFound(new { message = "Silinmiş proje bulunamadı." });

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
            return Ok(new { success = true });
        }

        [HttpGet("project/{id}/deleted-items")]
        public async Task<IActionResult> GetDeletedProjectItems(int id)
        {
            var project = await GetAuthorizedProjects(true).FirstOrDefaultAsync(p => p.Id == id);
            if (project == null) return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });

            var deletedMainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.ProjectId == id && mg.IsDeleted).Include(mg => mg.Tasks).Include(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks).OrderByDescending(mg => mg.DeletedAt).ToListAsync();
            var mainGoalsResult = deletedMainGoals.Select(mg => new { type = "maingoal", id = mg.Id, projectId = mg.ProjectId, title = mg.Title, description = mg.Description, isCompleted = mg.IsCompleted, progress = CalculateMainGoalProgress(mg), deletedAt = mg.DeletedAt, createdAt = mg.CreatedAt, changedAt = mg.ChangedAt, tasks = mg.Tasks.Select(t => new { id = t.Id, mainGoalId = t.MainGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, isDeleted = t.IsDeleted }).OrderBy(t => t.createdAt).ToList(), subGoals = mg.SubGoals.Select(sg => new { id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), deletedAt = sg.DeletedAt, createdAt = sg.CreatedAt, changedAt = sg.ChangedAt, isDeleted = sg.IsDeleted, tasks = sg.Tasks.Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, isDeleted = t.IsDeleted }).OrderBy(t => t.createdAt).ToList() }).OrderBy(sg => sg.createdAt).ToList() }).ToList();

            var deletedSubGoals = await _context.SubGoals.IgnoreQueryFilters().Include(sg => sg.MainGoal).Include(sg => sg.Tasks).Where(sg => sg.MainGoal!.ProjectId == id && sg.IsDeleted && !sg.MainGoal!.IsDeleted).OrderByDescending(sg => sg.DeletedAt).ToListAsync();
            var subGoalsResult = deletedSubGoals.Select(sg => new { type = "subgoal", id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), deletedAt = sg.DeletedAt, createdAt = sg.CreatedAt, changedAt = sg.ChangedAt, parentTitle = sg.MainGoal?.Title ?? "", isDeleted = sg.IsDeleted, tasks = sg.Tasks.Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, isDeleted = t.IsDeleted }).OrderBy(t => t.createdAt).ToList() }).ToList();

            var deletedTasks = await _context.TaskItems.IgnoreQueryFilters().Include(t => t.SubGoal).ThenInclude(sg => sg.MainGoal).Include(t => t.MainGoal).Include(t => t.Project).Where(t => t.IsDeleted && ((t.SubGoalId != null && t.SubGoal!.MainGoal.ProjectId == id && !t.SubGoal!.IsDeleted && !t.SubGoal!.MainGoal.IsDeleted) || (t.MainGoalId != null && t.MainGoal.ProjectId == id && !t.MainGoal.IsDeleted) || (t.ProjectId != null && t.ProjectId == id))).OrderByDescending(t => t.DeletedAt).ToListAsync();
            var tasksResult = deletedTasks.Select(t => { string parentTitle = ""; if (t.SubGoal != null) parentTitle = $"Alt Hedef: {t.SubGoal!.Title}"; else if (t.MainGoal != null) parentTitle = $"Ana Hedef: {t.MainGoal.Title}"; else if (t.Project != null) parentTitle = $"Proje: {t.Project.Title}"; return new { type = "task", id = t.Id, subGoalId = t.SubGoalId, mainGoalId = t.MainGoalId, projectId = t.ProjectId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, parentTitle = parentTitle, isDeleted = t.IsDeleted }; }).ToList();

            return Ok(new { mainGoals = mainGoalsResult, subGoals = subGoalsResult, tasks = tasksResult });
        }
    }
}
