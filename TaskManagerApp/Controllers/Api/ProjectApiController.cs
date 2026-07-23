using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
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
                .Include(p => p.Tasks)
                .Include(p => p.SubGoals).ThenInclude(sg => sg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .OrderBy(p => p.CreatedAt)
                .ToListAsync();

            var tree = projects.Select(p => new
            { 
                id = p.Id, title = p.Title, description = p.Description,
                teamGroupId = p.TeamGroupId, teamGroupName = p.TeamGroup?.Name,
                progress = CalculateProjectProgress(p), createdAt = p.CreatedAt, changedAt = p.ChangedAt,
                tasks = p.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, title = t.Title, isCompleted = t.IsCompleted }).ToList(),
                subGoals = p.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new { id = sg.Id, projectId = sg.ProjectId, title = sg.Title, progress = CalculateSubGoalProgress(sg), createdAt = sg.CreatedAt, changedAt = sg.ChangedAt, tasks = sg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, title = t.Title, isCompleted = t.IsCompleted }).ToList() }).ToList(),
                mainGoals = p.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => new
                {
                    id = mg.Id, projectId = mg.ProjectId, title = mg.Title,
                    progress = CalculateMainGoalProgress(mg), createdAt = mg.CreatedAt, changedAt = mg.ChangedAt,
                    tasks = mg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, title = t.Title, isCompleted = t.IsCompleted }).ToList(),
                    subGoals = mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new
                    {
                        id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title,
                        progress = CalculateSubGoalProgress(sg), createdAt = sg.CreatedAt, changedAt = sg.ChangedAt,
                        tasks = sg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, title = t.Title, isCompleted = t.IsCompleted }).ToList()
                    }).ToList()
                }).ToList()
            }).ToList();

            return Ok(tree);
        }

        [HttpGet("project/{id}")]
        public async Task<IActionResult> GetProjectDetails(int id)
        {
            var project = await GetAuthorizedProjects()
                .Include(p => p.Tasks)
                .Include(p => p.SubGoals).ThenInclude(sg => sg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (project == null) return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });

            var result = new
            {
                id = project.Id, title = project.Title, description = project.Description,
                progress = CalculateProjectProgress(project), createdAt = project.CreatedAt, changedAt = project.ChangedAt,
                tasks = project.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, projectId = t.ProjectId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, createdAt = t.CreatedAt, completedAt = t.CompletedAt }).OrderBy(t => t.createdAt).ToList(),
                subGoals = project.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new { id = sg.Id, projectId = sg.ProjectId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), createdAt = sg.CreatedAt, changedAt = sg.ChangedAt, tasks = sg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, createdAt = t.CreatedAt, completedAt = t.CompletedAt }).OrderBy(t => t.createdAt).ToList() }).OrderBy(sg => sg.createdAt).ToList(),
                mainGoals = project.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => new
                {
                    id = mg.Id, projectId = mg.ProjectId, title = mg.Title, description = mg.Description, isCompleted = mg.IsCompleted, progress = CalculateMainGoalProgress(mg), createdAt = mg.CreatedAt, changedAt = mg.ChangedAt,
                    tasks = mg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, mainGoalId = t.MainGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, createdAt = t.CreatedAt, completedAt = t.CompletedAt }).OrderBy(t => t.createdAt).ToList(),
                    subGoals = mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new
                    {
                        id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), createdAt = sg.CreatedAt, changedAt = sg.ChangedAt,
                        tasks = sg.Tasks.Where(t => !t.IsDeleted).Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, createdAt = t.CreatedAt, completedAt = t.CompletedAt }).OrderBy(t => t.createdAt).ToList()
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

            var project = new Project
            {
                UserId = CurrentUserId,
                TeamGroupId = req.TeamGroupId,
                Title = req.Title,
                Description = req.Description,
                CreatedAt = DateTime.Now
            };

            _context.Projects.Add(project);
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
            project.Description = req.Description;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("project/{id}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var project = await GetAuthorizedProjects()
                .Include(p => p.Tasks).Include(p => p.SubGoals).ThenInclude(sg => sg.Tasks).Include(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();

            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            project.IsDeleted = true; project.DeletedAt = deleteTime; project.DeleteBatchId = batchId;

            foreach (var t in project.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }
            if (project.SubGoals != null)
            {
                foreach (var sg in project.SubGoals.Where(sg => !sg.IsDeleted))
                {
                    sg.IsDeleted = true; sg.DeletedAt = deleteTime; sg.DeleteBatchId = batchId;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }
                }
            }
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

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => (t.ProjectId != null && projectIds.Contains(t.ProjectId.Value)) || (t.MainGoalId != null && t.MainGoal != null && projectIds.Contains(t.MainGoal.ProjectId)) || (t.SubGoalId != null && t.SubGoal != null && t.SubGoal.MainGoal != null && projectIds.Contains(t.SubGoal.MainGoal.ProjectId))).ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);

            var subGoalsToDelete = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoal != null && projectIds.Contains(sg.MainGoal.ProjectId)).ToListAsync();
            _context.SubGoals.RemoveRange(subGoalsToDelete);

            var mainGoalsToDelete = await _context.MainGoals.IgnoreQueryFilters().Where(mg => projectIds.Contains(mg.ProjectId)).ToListAsync();
            _context.MainGoals.RemoveRange(mainGoalsToDelete);

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

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => (t.ProjectId != null && projectIds.Contains(t.ProjectId.Value)) || (t.MainGoalId != null && t.MainGoal != null && projectIds.Contains(t.MainGoal.ProjectId)) || (t.SubGoalId != null && t.SubGoal != null && t.SubGoal.MainGoal != null && projectIds.Contains(t.SubGoal.MainGoal.ProjectId))).ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);

            var subGoalsToDelete = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoal != null && projectIds.Contains(sg.MainGoal.ProjectId)).ToListAsync();
            _context.SubGoals.RemoveRange(subGoalsToDelete);

            var mainGoalsToDelete = await _context.MainGoals.IgnoreQueryFilters().Where(mg => projectIds.Contains(mg.ProjectId)).ToListAsync();
            _context.MainGoals.RemoveRange(mainGoalsToDelete);

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

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.ProjectId == id || (t.MainGoalId != null && t.MainGoal != null && t.MainGoal.ProjectId == id) || (t.SubGoalId != null && t.SubGoal != null && t.SubGoal.MainGoal != null && t.SubGoal.MainGoal.ProjectId == id)).ToListAsync();
            var subGoalsToDelete = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoal != null && sg.MainGoal.ProjectId == id).ToListAsync();
            var mainGoalsToDelete = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.ProjectId == id).ToListAsync();

            _context.TaskItems.RemoveRange(tasksToDelete);
            _context.SubGoals.RemoveRange(subGoalsToDelete);
            _context.MainGoals.RemoveRange(mainGoalsToDelete);
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

            var deletedSubGoals = await _context.SubGoals.IgnoreQueryFilters().Include(sg => sg.MainGoal).Include(sg => sg.Tasks).Where(sg => sg.MainGoal.ProjectId == id && sg.IsDeleted && !sg.MainGoal.IsDeleted).OrderByDescending(sg => sg.DeletedAt).ToListAsync();
            var subGoalsResult = deletedSubGoals.Select(sg => new { type = "subgoal", id = sg.Id, mainGoalId = sg.MainGoalId, title = sg.Title, description = sg.Description, isCompleted = sg.IsCompleted, progress = CalculateSubGoalProgress(sg), deletedAt = sg.DeletedAt, createdAt = sg.CreatedAt, changedAt = sg.ChangedAt, parentTitle = sg.MainGoal?.Title ?? "", isDeleted = sg.IsDeleted, tasks = sg.Tasks.Select(t => new { id = t.Id, subGoalId = t.SubGoalId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, isDeleted = t.IsDeleted }).OrderBy(t => t.createdAt).ToList() }).ToList();

            var deletedTasks = await _context.TaskItems.IgnoreQueryFilters().Include(t => t.SubGoal).ThenInclude(sg => sg.MainGoal).Include(t => t.MainGoal).Include(t => t.Project).Where(t => t.IsDeleted && ((t.SubGoalId != null && t.SubGoal.MainGoal.ProjectId == id && !t.SubGoal.IsDeleted && !t.SubGoal.MainGoal.IsDeleted) || (t.MainGoalId != null && t.MainGoal.ProjectId == id && !t.MainGoal.IsDeleted) || (t.ProjectId != null && t.ProjectId == id))).OrderByDescending(t => t.DeletedAt).ToListAsync();
            var tasksResult = deletedTasks.Select(t => { string parentTitle = ""; if (t.SubGoal != null) parentTitle = $"Alt Hedef: {t.SubGoal.Title}"; else if (t.MainGoal != null) parentTitle = $"Ana Hedef: {t.MainGoal.Title}"; else if (t.Project != null) parentTitle = $"Proje: {t.Project.Title}"; return new { type = "task", id = t.Id, subGoalId = t.SubGoalId, mainGoalId = t.MainGoalId, projectId = t.ProjectId, title = t.Title, description = t.Description, isCompleted = t.IsCompleted, deletedAt = t.DeletedAt, createdAt = t.CreatedAt, completedAt = t.CompletedAt, parentTitle = parentTitle, isDeleted = t.IsDeleted }; }).ToList();

            return Ok(new { mainGoals = mainGoalsResult, subGoals = subGoalsResult, tasks = tasksResult });
        }
    }
}