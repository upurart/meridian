/*
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/dashboard")]
    public class DashboardApiController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardApiController(AppDbContext context)
        {
            _context = context;
        }

        private int CurrentUserId
        {
            get
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                return userIdClaim != null ? int.Parse(userIdClaim.Value) : 0;
            }
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
            {
                items.AddRange(mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => CalculateSubGoalProgress(sg)));
            }
            if (mg.Tasks != null && mg.Tasks.Any(t => !t.IsDeleted))
            {
                items.AddRange(mg.Tasks.Where(t => !t.IsDeleted).Select(t => t.IsCompleted ? 100.0 : 0.0));
            }

            if (items.Any())
            {
                return items.Average();
            }
            return mg.IsCompleted ? 100 : 0;
        }

        private static double CalculateProjectProgress(Project p)
        {
            var items = new List<double>();
            if (p.MainGoal != null && p.MainGoal.Any(mg => !mg.IsDeleted))
            {
                items.AddRange(p.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => CalculateMainGoalProgress(mg)));
            }
            if (p.Tasks != null && p.Tasks.Any(t => !t.IsDeleted))
            {
                items.AddRange(p.Tasks.Where(t => !t.IsDeleted).Select(t => t.IsCompleted ? 100.0 : 0.0));
            }

            if (items.Any())
            {
                return items.Average();
            }
            return 0;
        }

        [HttpGet("tree")]
        public async Task<IActionResult> GetTree()
        {
            var projects = await _context.Projects
                .Where(p => p.UserId == CurrentUserId && !p.IsDeleted)
                .Include(p => p.Tasks)
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.SubGoals)
                        .ThenInclude(sg => sg.Tasks)
                .OrderBy(p => p.CreatedAt)
                .ToListAsync();

            var tree = projects.Select(p => new
            { 
                id = p.Id,
                title = p.Title,
                description = p.Description,
                progress = CalculateProjectProgress(p),
                createdAt = p.CreatedAt,
                changedAt = p.ChangedAt,
                mainGoals = p.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => new
                {
                    id = mg.Id,
                    projectId = mg.ProjectId,
                    title = mg.Title,
                    progress = CalculateMainGoalProgress(mg),
                    createdAt = mg.CreatedAt,
                    changedAt = mg.ChangedAt,
                    subGoals = mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new
                    {
                        id = sg.Id,
                        mainGoalId = sg.MainGoalId,
                        title = sg.Title,
                        progress = CalculateSubGoalProgress(sg),
                        createdAt = sg.CreatedAt,
                        changedAt = sg.ChangedAt
                    }).ToList()
                }).ToList()
            }).ToList();

            return Ok(tree);
        }

        [HttpGet("project/{id}")]
        public async Task<IActionResult> GetProjectDetails(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.SubGoals)
                        .ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId && !p.IsDeleted);

            if (project == null)
            {
                return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });
            }

            var projectProgress = CalculateProjectProgress(project);

            var result = new
            {
                id = project.Id,
                title = project.Title,
                description = project.Description,
                progress = projectProgress,
                createdAt = project.CreatedAt,
                changedAt = project.ChangedAt,
                tasks = project.Tasks.Where(t => !t.IsDeleted).Select(t => new
                {
                    id = t.Id,
                    projectId = t.ProjectId,
                    title = t.Title,
                    description = t.Description,
                    isCompleted = t.IsCompleted,
                    createdAt = t.CreatedAt,
                    completedAt = t.CompletedAt
                }).OrderBy(t => t.createdAt).ToList(),
                mainGoals = project.MainGoal.Where(mg => !mg.IsDeleted).Select(mg => new
                {
                    id = mg.Id,
                    projectId = mg.ProjectId,
                    title = mg.Title,
                    description = mg.Description,
                    isCompleted = mg.IsCompleted,
                    progress = CalculateMainGoalProgress(mg),
                    createdAt = mg.CreatedAt,
                    changedAt = mg.ChangedAt,
                    tasks = mg.Tasks.Where(t => !t.IsDeleted).Select(t => new
                    {
                        id = t.Id,
                        mainGoalId = t.MainGoalId,
                        title = t.Title,
                        description = t.Description,
                        isCompleted = t.IsCompleted,
                        createdAt = t.CreatedAt,
                        completedAt = t.CompletedAt
                    }).OrderBy(t => t.createdAt).ToList(),
                    subGoals = mg.SubGoals.Where(sg => !sg.IsDeleted).Select(sg => new
                    {
                        id = sg.Id,
                        mainGoalId = sg.MainGoalId,
                        title = sg.Title,
                        description = sg.Description,
                        isCompleted = sg.IsCompleted,
                        progress = CalculateSubGoalProgress(sg),
                        createdAt = sg.CreatedAt,
                        changedAt = sg.ChangedAt,
                        tasks = sg.Tasks.Where(t => !t.IsDeleted).Select(t => new
                        {
                            id = t.Id,
                            subGoalId = t.SubGoalId,
                            title = t.Title,
                            description = t.Description,
                            isCompleted = t.IsCompleted,
                            createdAt = t.CreatedAt,
                            completedAt = t.CompletedAt
                        }).OrderBy(t => t.createdAt).ToList()
                    }).OrderBy(sg => sg.createdAt).ToList()
                }).OrderBy(mg => mg.createdAt).ToList()
            };

            return Ok(result);
        }

        [HttpPost("project")]
        public async Task<IActionResult> CreateProject([FromBody] ProjectUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var project = new Project
            {
                UserId = CurrentUserId,
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

            var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId);
            if (project == null) return NotFound();

            project.Title = req.Title;
            project.Description = req.Description;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("project/{id}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.Tasks)
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.SubGoals)
                        .ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId);

            if (project == null) return NotFound();

            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            project.IsDeleted = true;
            project.DeletedAt = deleteTime;
            project.DeleteBatchId = batchId;

            foreach (var t in project.Tasks.Where(t => !t.IsDeleted))
            {
                t.IsDeleted = true;
                t.DeletedAt = deleteTime;
                t.DeleteBatchId = batchId;
            }

            foreach (var mg in project.MainGoal.Where(mg => !mg.IsDeleted))
            {
                mg.IsDeleted = true;
                mg.DeletedAt = deleteTime;
                mg.DeleteBatchId = batchId;

                foreach (var t in mg.Tasks.Where(t => !t.IsDeleted))
                {
                    t.IsDeleted = true;
                    t.DeletedAt = deleteTime;
                    t.DeleteBatchId = batchId;
                }

                foreach (var sg in mg.SubGoals.Where(sg => !sg.IsDeleted))
                {
                    sg.IsDeleted = true;
                    sg.DeletedAt = deleteTime;
                    sg.DeleteBatchId = batchId;

                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted))
                    {
                        t.IsDeleted = true;
                        t.DeletedAt = deleteTime;
                        t.DeleteBatchId = batchId;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }


        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedProjects()
        {
            var deletedProjects = await _context.Projects
                .IgnoreQueryFilters()
                .Where(p => p.UserId == CurrentUserId && p.IsDeleted)
                .OrderByDescending(p => p.DeletedAt)
                .Select(p => new
                {
                    id = p.Id,
                    title = p.Title,
                    description = p.Description,
                    deletedAt = p.DeletedAt
                })
                .ToListAsync();

            return Ok(deletedProjects);
        }

        [HttpPost("project/{id}/restore")]
        public async Task<IActionResult> RestoreProject(int id)
        {
            var project = await _context.Projects
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId && p.IsDeleted);

            if (project == null) return NotFound(new { message = "Silinmiş proje bulunamadı." });

            project.IsDeleted = false;
            project.DeletedAt = null;

            if (project.DeleteBatchId.HasValue)
            {
                var batchId = project.DeleteBatchId.Value;

                var mainGoals = await _context.MainGoals.IgnoreQueryFilters()
                    .Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();
                foreach (var mg in mainGoals)
                {
                    mg.IsDeleted = false;
                    mg.DeletedAt = null;
                    mg.DeleteBatchId = null;
                }

                var subGoals = await _context.SubGoals.IgnoreQueryFilters()
                    .Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals)
                {
                    sg.IsDeleted = false;
                    sg.DeletedAt = null;
                    sg.DeleteBatchId = null;
                }

                var tasks = await _context.TaskItems.IgnoreQueryFilters()
                    .Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                foreach (var t in tasks)
                {
                    t.IsDeleted = false;
                    t.DeletedAt = null;
                    t.DeleteBatchId = null;
                }

                project.DeleteBatchId = null;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("project/bulk-restore")]
        public async Task<IActionResult> BulkRestoreProjects([FromBody] List<int> ids)
        {
            if (ids == null || !ids.Any()) return BadRequest(new { message = "Kimlik bilgisi gönderilmedi." });

            var projects = await _context.Projects
                .IgnoreQueryFilters()
                .Where(p => ids.Contains(p.Id) && p.UserId == CurrentUserId && p.IsDeleted)
                .ToListAsync();

            foreach (var project in projects)
            {
                project.IsDeleted = false;
                project.DeletedAt = null;

                if (project.DeleteBatchId.HasValue)
                {
                    var batchId = project.DeleteBatchId.Value;
                    
                    var mainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();
                    foreach (var mg in mainGoals)
                    {
                        mg.IsDeleted = false;
                        mg.DeletedAt = null;
                        mg.DeleteBatchId = null;
                    }

                    var subGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                    foreach (var sg in subGoals)
                    {
                        sg.IsDeleted = false;
                        sg.DeletedAt = null;
                        sg.DeleteBatchId = null;
                    }

                    var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                    foreach (var t in tasks)
                    {
                        t.IsDeleted = false;
                        t.DeletedAt = null;
                        t.DeleteBatchId = null;
                    }

                    project.DeleteBatchId = null;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("project/restore-all")]
        public async Task<IActionResult> RestoreAllProjects()
        {
            var projects = await _context.Projects
                .IgnoreQueryFilters()
                .Where(p => p.UserId == CurrentUserId && p.IsDeleted)
                .ToListAsync();

            foreach (var project in projects)
            {
                project.IsDeleted = false;
                project.DeletedAt = null;

                if (project.DeleteBatchId.HasValue)
                {
                    var batchId = project.DeleteBatchId.Value;
                    
                    var mainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();
                    foreach (var mg in mainGoals)
                    {
                        mg.IsDeleted = false;
                        mg.DeletedAt = null;
                        mg.DeleteBatchId = null;
                    }

                    var subGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                    foreach (var sg in subGoals)
                    {
                        sg.IsDeleted = false;
                        sg.DeletedAt = null;
                        sg.DeleteBatchId = null;
                    }

                    var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                    foreach (var t in tasks)
                    {
                        t.IsDeleted = false;
                        t.DeletedAt = null;
                        t.DeleteBatchId = null;
                    }

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

            var projects = await _context.Projects
                .IgnoreQueryFilters()
                .Where(p => ids.Contains(p.Id) && p.UserId == CurrentUserId && p.IsDeleted)
                .ToListAsync();

            if (!projects.Any()) return Ok(new { success = true });

            var projectIds = projects.Select(p => p.Id).ToList();

            var tasksToDelete = await _context.TaskItems
                .IgnoreQueryFilters()
                .Where(t => (t.ProjectId != null && projectIds.Contains(t.ProjectId.Value)) || 
                            (t.MainGoalId != null && t.MainGoal != null && projectIds.Contains(t.MainGoal.ProjectId)) || 
                            (t.SubGoalId != null && t.SubGoal != null && t.SubGoal.MainGoal != null && projectIds.Contains(t.SubGoal.MainGoal.ProjectId)))
                .ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);

            var subGoalsToDelete = await _context.SubGoals
                .IgnoreQueryFilters()
                .Where(sg => sg.MainGoal != null && projectIds.Contains(sg.MainGoal.ProjectId))
                .ToListAsync();
            _context.SubGoals.RemoveRange(subGoalsToDelete);

            var mainGoalsToDelete = await _context.MainGoals
                .IgnoreQueryFilters()
                .Where(mg => projectIds.Contains(mg.ProjectId))
                .ToListAsync();
            _context.MainGoals.RemoveRange(mainGoalsToDelete);

            _context.Projects.RemoveRange(projects);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("project/permanent-all")]
        public async Task<IActionResult> PermanentAllProjects()
        {
            var projects = await _context.Projects
                .IgnoreQueryFilters()
                .Where(p => p.UserId == CurrentUserId && p.IsDeleted)
                .ToListAsync();

            if (!projects.Any()) return Ok(new { success = true });

            var projectIds = projects.Select(p => p.Id).ToList();

            var tasksToDelete = await _context.TaskItems
                .IgnoreQueryFilters()
                .Where(t => (t.ProjectId != null && projectIds.Contains(t.ProjectId.Value)) || 
                            (t.MainGoalId != null && t.MainGoal != null && projectIds.Contains(t.MainGoal.ProjectId)) || 
                            (t.SubGoalId != null && t.SubGoal != null && t.SubGoal.MainGoal != null && projectIds.Contains(t.SubGoal.MainGoal.ProjectId)))
                .ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);

            var subGoalsToDelete = await _context.SubGoals
                .IgnoreQueryFilters()
                .Where(sg => sg.MainGoal != null && projectIds.Contains(sg.MainGoal.ProjectId))
                .ToListAsync();
            _context.SubGoals.RemoveRange(subGoalsToDelete);

            var mainGoalsToDelete = await _context.MainGoals
                .IgnoreQueryFilters()
                .Where(mg => projectIds.Contains(mg.ProjectId))
                .ToListAsync();
            _context.MainGoals.RemoveRange(mainGoalsToDelete);

            _context.Projects.RemoveRange(projects);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("project/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteProject(int id)
        {
            var project = await _context.Projects
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId && p.IsDeleted);

            if (project == null) return NotFound(new { message = "Silinmiş proje bulunamadı." });

            var tasksToDelete = await _context.TaskItems
                .IgnoreQueryFilters()
                .Where(t => t.ProjectId == id || 
                            (t.MainGoalId != null && t.MainGoal != null && t.MainGoal.ProjectId == id) || 
                            (t.SubGoalId != null && t.SubGoal != null && t.SubGoal.MainGoal != null && t.SubGoal.MainGoal.ProjectId == id))
                .ToListAsync();

            var subGoalsToDelete = await _context.SubGoals
                .IgnoreQueryFilters()
                .Where(sg => sg.MainGoal != null && sg.MainGoal.ProjectId == id)
                .ToListAsync();

            var mainGoalsToDelete = await _context.MainGoals
                .IgnoreQueryFilters()
                .Where(mg => mg.ProjectId == id)
                .ToListAsync();

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
            var project = await _context.Projects.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId);
            if (project == null) return NotFound(new { message = "Proje bulunamadı." });

            var deletedMainGoals = await _context.MainGoals
                .IgnoreQueryFilters()
                .Where(mg => mg.ProjectId == id && mg.IsDeleted)
                .Include(mg => mg.Tasks)
                .Include(mg => mg.SubGoals)
                    .ThenInclude(sg => sg.Tasks)
                .OrderByDescending(mg => mg.DeletedAt)
                .ToListAsync();

            var mainGoalsResult = deletedMainGoals.Select(mg => new {
                type = "maingoal",
                id = mg.Id,
                projectId = mg.ProjectId,
                title = mg.Title,
                description = mg.Description,
                isCompleted = mg.IsCompleted,
                progress = CalculateMainGoalProgress(mg),
                deletedAt = mg.DeletedAt,
                createdAt = mg.CreatedAt,
                changedAt = mg.ChangedAt,
                tasks = mg.Tasks.Select(t => new {
                    id = t.Id,
                    mainGoalId = t.MainGoalId,
                    title = t.Title,
                    description = t.Description,
                    isCompleted = t.IsCompleted,
                    deletedAt = t.DeletedAt,
                    createdAt = t.CreatedAt,
                    completedAt = t.CompletedAt,
                    isDeleted = t.IsDeleted
                }).OrderBy(t => t.createdAt).ToList(),
                subGoals = mg.SubGoals.Select(sg => new {
                    id = sg.Id,
                    mainGoalId = sg.MainGoalId,
                    title = sg.Title,
                    description = sg.Description,
                    isCompleted = sg.IsCompleted,
                    progress = CalculateSubGoalProgress(sg),
                    deletedAt = sg.DeletedAt,
                    createdAt = sg.CreatedAt,
                    changedAt = sg.ChangedAt,
                    isDeleted = sg.IsDeleted,
                    tasks = sg.Tasks.Select(t => new {
                        id = t.Id,
                        subGoalId = t.SubGoalId,
                        title = t.Title,
                        description = t.Description,
                        isCompleted = t.IsCompleted,
                        deletedAt = t.DeletedAt,
                        createdAt = t.CreatedAt,
                        completedAt = t.CompletedAt,
                        isDeleted = t.IsDeleted
                    }).OrderBy(t => t.createdAt).ToList()
                }).OrderBy(sg => sg.createdAt).ToList()
            }).ToList();

            var deletedSubGoals = await _context.SubGoals
                .IgnoreQueryFilters()
                .Include(sg => sg.MainGoal)
                .Include(sg => sg.Tasks)
                .Where(sg => sg.MainGoal.ProjectId == id && sg.IsDeleted && !sg.MainGoal.IsDeleted)
                .OrderByDescending(sg => sg.DeletedAt)
                .ToListAsync();

            var subGoalsResult = deletedSubGoals.Select(sg => new {
                type = "subgoal",
                id = sg.Id,
                mainGoalId = sg.MainGoalId,
                title = sg.Title,
                description = sg.Description,
                isCompleted = sg.IsCompleted,
                progress = CalculateSubGoalProgress(sg),
                deletedAt = sg.DeletedAt,
                createdAt = sg.CreatedAt,
                changedAt = sg.ChangedAt,
                parentTitle = sg.MainGoal?.Title ?? "",
                isDeleted = sg.IsDeleted,
                tasks = sg.Tasks.Select(t => new {
                    id = t.Id,
                    subGoalId = t.SubGoalId,
                    title = t.Title,
                    description = t.Description,
                    isCompleted = t.IsCompleted,
                    deletedAt = t.DeletedAt,
                    createdAt = t.CreatedAt,
                    completedAt = t.CompletedAt,
                    isDeleted = t.IsDeleted
                }).OrderBy(t => t.createdAt).ToList()
            }).ToList();

            var deletedTasks = await _context.TaskItems
                .IgnoreQueryFilters()
                .Include(t => t.SubGoal)
                    .ThenInclude(sg => sg.MainGoal)
                .Include(t => t.MainGoal)
                .Include(t => t.Project)
                .Where(t => t.IsDeleted &&
                    (
                        (t.SubGoalId != null && t.SubGoal.MainGoal.ProjectId == id && !t.SubGoal.IsDeleted && !t.SubGoal.MainGoal.IsDeleted) ||
                        (t.MainGoalId != null && t.MainGoal.ProjectId == id && !t.MainGoal.IsDeleted) ||
                        (t.ProjectId != null && t.ProjectId == id)
                    )
                )
                .OrderByDescending(t => t.DeletedAt)
                .ToListAsync();

            var tasksResult = deletedTasks.Select(t => {
                string parentTitle = "";
                if (t.SubGoal != null) parentTitle = $"Alt Hedef: {t.SubGoal.Title}";
                else if (t.MainGoal != null) parentTitle = $"Ana Hedef: {t.MainGoal.Title}";
                else if (t.Project != null) parentTitle = $"Proje: {t.Project.Title}";

                return new {
                    type = "task",
                    id = t.Id,
                    subGoalId = t.SubGoalId,
                    mainGoalId = t.MainGoalId,
                    projectId = t.ProjectId,
                    title = t.Title,
                    description = t.Description,
                    isCompleted = t.IsCompleted,
                    deletedAt = t.DeletedAt,
                    createdAt = t.CreatedAt,
                    completedAt = t.CompletedAt,
                    parentTitle = parentTitle,
                    isDeleted = t.IsDeleted
                };
            }).ToList();

            return Ok(new {
                mainGoals = mainGoalsResult,
                subGoals = subGoalsResult,
                tasks = tasksResult
            });
        }

        [HttpPost("maingoal/{id}/restore")]
        public async Task<IActionResult> RestoreMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals
                .IgnoreQueryFilters()
                .Include(mg => mg.Project)
                .FirstOrDefaultAsync(mg => mg.Id == id && mg.Project.UserId == CurrentUserId && mg.IsDeleted);

            if (mainGoal == null) return NotFound();

            if (mainGoal.Project.IsDeleted)
            {
                mainGoal.Project.IsDeleted = false;
                mainGoal.Project.DeletedAt = null;
                mainGoal.Project.DeleteBatchId = null;
            }

            mainGoal.IsDeleted = false;
            mainGoal.DeletedAt = null;

            if (mainGoal.DeleteBatchId.HasValue)
            {
                var batchId = mainGoal.DeleteBatchId.Value;

                var subGoals = await _context.SubGoals
                    .IgnoreQueryFilters()
                    .Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted)
                    .ToListAsync();

                foreach (var sg in subGoals)
                {
                    sg.IsDeleted = false;
                    sg.DeletedAt = null;
                    sg.DeleteBatchId = null;
                }

                var tasks = await _context.TaskItems
                    .IgnoreQueryFilters()
                    .Where(t => t.DeleteBatchId == batchId && t.IsDeleted)
                    .ToListAsync();

                foreach (var t in tasks)
                {
                    t.IsDeleted = false;
                    t.DeletedAt = null;
                    t.DeleteBatchId = null;
                }

                mainGoal.DeleteBatchId = null;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("maingoal/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals
                .IgnoreQueryFilters()
                .Include(m => m.Project)
                .FirstOrDefaultAsync(m => m.Id == id && m.Project.UserId == CurrentUserId && m.IsDeleted);

            if (mainGoal == null) return NotFound();

            var tasksToDelete = await _context.TaskItems
                .IgnoreQueryFilters()
                .Where(t => t.MainGoalId == id || 
                            (t.SubGoalId != null && t.SubGoal != null && t.SubGoal.MainGoalId == id))
                .ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);

            _context.MainGoals.Remove(mainGoal);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("subgoal/{id}/restore")]
        public async Task<IActionResult> RestoreSubGoal(int id)
        {
            var subGoal = await _context.SubGoals
                .IgnoreQueryFilters()
                .Include(sg => sg.MainGoal)
                    .ThenInclude(m => m.Project)
                .FirstOrDefaultAsync(sg => sg.Id == id && sg.MainGoal.Project.UserId == CurrentUserId && sg.IsDeleted);

            if (subGoal == null) return NotFound();

            if (subGoal.MainGoal.IsDeleted)
            {
                subGoal.MainGoal.IsDeleted = false;
                subGoal.MainGoal.DeletedAt = null;
                subGoal.MainGoal.DeleteBatchId = null;
            }
            if (subGoal.MainGoal.Project.IsDeleted)
            {
                subGoal.MainGoal.Project.IsDeleted = false;
                subGoal.MainGoal.Project.DeletedAt = null;
                subGoal.MainGoal.Project.DeleteBatchId = null;
            }

            subGoal.IsDeleted = false;
            subGoal.DeletedAt = null;

            if (subGoal.DeleteBatchId.HasValue)
            {
                var batchId = subGoal.DeleteBatchId.Value;

                var tasks = await _context.TaskItems
                    .IgnoreQueryFilters()
                    .Where(t => t.DeleteBatchId == batchId && t.IsDeleted)
                    .ToListAsync();

                foreach (var t in tasks)
                {
                    t.IsDeleted = false;
                    t.DeletedAt = null;
                    t.DeleteBatchId = null;
                }

                subGoal.DeleteBatchId = null;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("subgoal/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteSubGoal(int id)
        {
            var subGoal = await _context.SubGoals
                .IgnoreQueryFilters()
                .Include(s => s.MainGoal)
                    .ThenInclude(m => m.Project)
                .FirstOrDefaultAsync(s => s.Id == id && s.MainGoal.Project.UserId == CurrentUserId && s.IsDeleted);

            if (subGoal == null) return NotFound();

            var tasksToDelete = await _context.TaskItems
                .IgnoreQueryFilters()
                .Where(t => t.SubGoalId == id)
                .ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);

            _context.SubGoals.Remove(subGoal);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("task/{id}/restore")]
        public async Task<IActionResult> RestoreTask(int id)
        {
            var task = await _context.TaskItems
                .IgnoreQueryFilters()
                .Include(t => t.SubGoal)
                    .ThenInclude(s => s.MainGoal)
                        .ThenInclude(m => m.Project)
                .FirstOrDefaultAsync(t => t.Id == id && t.SubGoal.MainGoal.Project.UserId == CurrentUserId && t.IsDeleted);

            if (task == null) return NotFound();

            if (task.SubGoal.IsDeleted)
            {
                task.SubGoal.IsDeleted = false;
                task.SubGoal.DeletedAt = null;
                task.SubGoal.DeleteBatchId = null;
            }
            if (task.SubGoal.MainGoal.IsDeleted)
            {
                task.SubGoal.MainGoal.IsDeleted = false;
                task.SubGoal.MainGoal.DeletedAt = null;
                task.SubGoal.MainGoal.DeleteBatchId = null;
            }
            if (task.SubGoal.MainGoal.Project.IsDeleted)
            {
                task.SubGoal.MainGoal.Project.IsDeleted = false;
                task.SubGoal.MainGoal.Project.DeletedAt = null;
                task.SubGoal.MainGoal.Project.DeleteBatchId = null;
            }

            task.IsDeleted = false;
            task.DeletedAt = null;
            task.DeleteBatchId = null;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("task/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteTask(int id)
        {
            var task = await _context.TaskItems
                .IgnoreQueryFilters()
                .Include(t => t.SubGoal)
                    .ThenInclude(s => s.MainGoal)
                        .ThenInclude(m => m.Project)
                .FirstOrDefaultAsync(t => t.Id == id && t.SubGoal.MainGoal.Project.UserId == CurrentUserId && t.IsDeleted);

            if (task == null) return NotFound();

            _context.TaskItems.Remove(task);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("maingoal")]
        public async Task<IActionResult> CreateMainGoal([FromBody] MainGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var projectExists = await _context.Projects.AnyAsync(p => p.Id == req.ProjectId && p.UserId == CurrentUserId);
            if (!projectExists) return Unauthorized();

            var mainGoal = new MainGoal
            {
                ProjectId = req.ProjectId,
                Title = req.Title,
                Description = req.Description,
                IsCompleted = req.IsCompleted,
                CreatedAt = DateTime.Now
            };

            _context.MainGoals.Add(mainGoal);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, id = mainGoal.Id });
        }

        [HttpPut("maingoal/{id}")]
        public async Task<IActionResult> UpdateMainGoal(int id, [FromBody] MainGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var mainGoal = await _context.MainGoals.Include(m => m.Project).FirstOrDefaultAsync(m => m.Id == id && m.Project.UserId == CurrentUserId);
            if (mainGoal == null) return NotFound();

            mainGoal.Title = req.Title;
            mainGoal.Description = req.Description;
            mainGoal.IsCompleted = req.IsCompleted;

            if (mainGoal.IsCompleted)
            {
                var subGoals = await _context.SubGoals.Include(sg => sg.Tasks).Where(sg => sg.MainGoalId == id && !sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals)
                {
                    sg.IsCompleted = true;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted))
                    {
                        t.IsCompleted = true;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("maingoal/{id}")]
        public async Task<IActionResult> DeleteMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals
                .Include(m => m.Project)
                .Include(m => m.Tasks)
                .Include(m => m.SubGoals)
                    .ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(m => m.Id == id && m.Project.UserId == CurrentUserId);

            if (mainGoal == null) return NotFound();

            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            mainGoal.IsDeleted = true;
            mainGoal.DeletedAt = deleteTime;
            mainGoal.DeleteBatchId = batchId;

            foreach (var t in mainGoal.Tasks.Where(t => !t.IsDeleted))
            {
                t.IsDeleted = true;
                t.DeletedAt = deleteTime;
                t.DeleteBatchId = batchId;
            }

            foreach (var sg in mainGoal.SubGoals.Where(sg => !sg.IsDeleted))
            {
                sg.IsDeleted = true;
                sg.DeletedAt = deleteTime;
                sg.DeleteBatchId = batchId;

                foreach (var t in sg.Tasks.Where(t => !t.IsDeleted))
                {
                    t.IsDeleted = true;
                    t.DeletedAt = deleteTime;
                    t.DeleteBatchId = batchId;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("maingoal/{id}/toggle")]
        public async Task<IActionResult> ToggleMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.Include(m => m.Project).FirstOrDefaultAsync(m => m.Id == id && m.Project.UserId == CurrentUserId);
            if (mainGoal == null) return NotFound();

            mainGoal.IsCompleted = !mainGoal.IsCompleted;

            if (mainGoal.IsCompleted)
            {
                var subGoals = await _context.SubGoals.Include(sg => sg.Tasks).Where(sg => sg.MainGoalId == id && !sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals)
                {
                    sg.IsCompleted = true;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted))
                    {
                        t.IsCompleted = true;
                    }
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { success = true, isCompleted = mainGoal.IsCompleted });
        }

        [HttpPost("subgoal")]
        public async Task<IActionResult> CreateSubGoal([FromBody] SubGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var mainGoal = await _context.MainGoals.Include(m => m.Project).FirstOrDefaultAsync(m => m.Id == req.MainGoalId && m.Project.UserId == CurrentUserId);
            if (mainGoal == null) return Unauthorized();

            var subGoal = new SubGoal
            {
                MainGoalId = req.MainGoalId,
                Title = req.Title,
                Description = req.Description,
                IsCompleted = req.IsCompleted,
                CreatedAt = DateTime.Now
            };

            _context.SubGoals.Add(subGoal);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, id = subGoal.Id });
        }

        [HttpPut("subgoal/{id}")]
        public async Task<IActionResult> UpdateSubGoal(int id, [FromBody] SubGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(s => s.Id == id && s.MainGoal.Project.UserId == CurrentUserId);
            if (subGoal == null) return NotFound();

            subGoal.Title = req.Title;
            subGoal.Description = req.Description;
            subGoal.IsCompleted = req.IsCompleted;

            if (subGoal.IsCompleted)
            {
                var tasks = await _context.TaskItems.Where(t => t.SubGoalId == id && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks)
                {
                    t.IsCompleted = true;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("subgoal/{id}")]
        public async Task<IActionResult> DeleteSubGoal(int id)
        {
            var subGoal = await _context.SubGoals
                .Include(s => s.MainGoal)
                    .ThenInclude(m => m.Project)
                .Include(s => s.Tasks)
                .FirstOrDefaultAsync(s => s.Id == id && s.MainGoal.Project.UserId == CurrentUserId);

            if (subGoal == null) return NotFound();

            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            subGoal.IsDeleted = true;
            subGoal.DeletedAt = deleteTime;
            subGoal.DeleteBatchId = batchId;

            foreach (var t in subGoal.Tasks.Where(t => !t.IsDeleted))
            {
                t.IsDeleted = true;
                t.DeletedAt = deleteTime;
                t.DeleteBatchId = batchId;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("subgoal/{id}/toggle")]
        public async Task<IActionResult> ToggleSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(s => s.Id == id && s.MainGoal.Project.UserId == CurrentUserId);
            if (subGoal == null) return NotFound();

            subGoal.IsCompleted = !subGoal.IsCompleted;

            if (subGoal.IsCompleted)
            {
                var tasks = await _context.TaskItems.Where(t => t.SubGoalId == id && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks)
                {
                    t.IsCompleted = true;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { success = true, isCompleted = subGoal.IsCompleted });
        }

        [HttpPost("task")]
        public async Task<IActionResult> CreateTask([FromBody] TaskUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            int? subGoalId = null;
            int? mainGoalId = null;
            int? projectId = null;

            if (req.SubGoalId.HasValue && req.SubGoalId.Value > 0)
            {
                var subGoal = await _context.SubGoals.Include(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(s => s.Id == req.SubGoalId.Value && s.MainGoal.Project.UserId == CurrentUserId);
                if (subGoal == null) return Unauthorized();
                subGoalId = req.SubGoalId.Value;
            }
            else if (req.MainGoalId.HasValue && req.MainGoalId.Value > 0)
            {
                var mainGoal = await _context.MainGoals.Include(m => m.Project).FirstOrDefaultAsync(m => m.Id == req.MainGoalId.Value && m.Project.UserId == CurrentUserId);
                if (mainGoal == null) return Unauthorized();
                mainGoalId = req.MainGoalId.Value;
            }
            else if (req.ProjectId.HasValue && req.ProjectId.Value > 0)
            {
                var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId.Value && p.UserId == CurrentUserId);
                if (project == null) return Unauthorized();
                projectId = req.ProjectId.Value;
            }
            else
            {
                return BadRequest(new { message = "Görevin ekleneceği bir üst öge (Alt Hedef, Ana Hedef veya Proje) belirtilmelidir." });
            }

            var task = new TaskItem
            {
                SubGoalId = subGoalId,
                MainGoalId = mainGoalId,
                ProjectId = projectId,
                Title = req.Title,
                Description = req.Description,
                IsCompleted = req.IsCompleted,
                CreatedAt = DateTime.Now
            };

            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, id = task.Id });
        }

        [HttpPut("task/{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var task = await _context.TaskItems
                .Include(t => t.SubGoal)
                    .ThenInclude(s => s.MainGoal)
                        .ThenInclude(m => m.Project)
                .Include(t => t.MainGoal)
                    .ThenInclude(mg => mg.Project)
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            int ownerUserId = 0;
            if (task.SubGoal != null) ownerUserId = task.SubGoal.MainGoal.Project.UserId;
            else if (task.MainGoal != null) ownerUserId = task.MainGoal.Project.UserId;
            else if (task.Project != null) ownerUserId = task.Project.UserId;

            if (ownerUserId != CurrentUserId) return Unauthorized();

            task.Title = req.Title;
            task.Description = req.Description;
            task.IsCompleted = req.IsCompleted;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("task/{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.TaskItems
                .Include(t => t.SubGoal)
                    .ThenInclude(s => s.MainGoal)
                        .ThenInclude(m => m.Project)
                .Include(t => t.MainGoal)
                    .ThenInclude(mg => mg.Project)
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            int ownerUserId = 0;
            if (task.SubGoal != null) ownerUserId = task.SubGoal.MainGoal.Project.UserId;
            else if (task.MainGoal != null) ownerUserId = task.MainGoal.Project.UserId;
            else if (task.Project != null) ownerUserId = task.Project.UserId;

            if (ownerUserId != CurrentUserId) return Unauthorized();

            task.IsDeleted = true;
            task.DeletedAt = DateTime.Now;
            task.DeleteBatchId = null;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("task/{id}/toggle")]
        public async Task<IActionResult> ToggleTask(int id)
        {
            var task = await _context.TaskItems
                .Include(t => t.SubGoal)
                    .ThenInclude(s => s.MainGoal)
                        .ThenInclude(m => m.Project)
                .Include(t => t.MainGoal)
                    .ThenInclude(mg => mg.Project)
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            int ownerUserId = 0;
            if (task.SubGoal != null) ownerUserId = task.SubGoal.MainGoal.Project.UserId;
            else if (task.MainGoal != null) ownerUserId = task.MainGoal.Project.UserId;
            else if (task.Project != null) ownerUserId = task.Project.UserId;

            if (ownerUserId != CurrentUserId) return Unauthorized();

            task.IsCompleted = !task.IsCompleted;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, isCompleted = task.IsCompleted });
        }

        [HttpGet("activities")]
        public async Task<IActionResult> GetRecentActivities()
        {
            try 
            {
                var logs = await _context.ActivityLogs
                    .OrderByDescending(a => a.CreatedAt)
                    .Take(50)
                    .ToListAsync();

                var groupedLogs = logs.GroupBy(a => a.ProjectId)
                    .Select(g => {
                        var project = _context.Projects.IgnoreQueryFilters().FirstOrDefault(p => p.Id == g.Key);
                        var projTitle = project != null ? project.Title : "🗑️ Silinmiş Proje";

                        return new {
                            projectId = g.Key,
                            projectTitle = projTitle,
                            activities = g.Select(l => new {
                                id = l.Id,
                                action = l.ActionType,
                                entity = l.EntityType,
                                details = l.Details,
                                date = l.CreatedAt
                            }).ToList()
                        };
                    }).ToList();

                return Ok(groupedLogs);
            }
            catch (Exception ex)
            {
                // Eğer bir hata varsa, tarayıcı konsolunda 500 dönmek yerine hatanın ne olduğunu görebiliriz
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
*/