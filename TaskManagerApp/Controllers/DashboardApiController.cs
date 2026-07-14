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

        // Helper method to compute progress
        private static double CalculateSubGoalProgress(SubGoal sg)
        {
            if (sg.Tasks != null && sg.Tasks.Any())
            {
                return (sg.Tasks.Count(t => t.IsCompleted) / (double)sg.Tasks.Count) * 100;
            }
            return sg.IsCompleted ? 100 : 0;
        }

        private static double CalculateMainGoalProgress(MainGoal mg)
        {
            if (mg.SubGoals != null && mg.SubGoals.Any())
            {
                return mg.SubGoals.Average(sg => CalculateSubGoalProgress(sg));
            }
            return mg.IsCompleted ? 100 : 0;
        }

        private static double CalculateProjectProgress(Project p)
        {
            if (p.MainGoal != null && p.MainGoal.Any())
            {
                return p.MainGoal.Average(mg => CalculateMainGoalProgress(mg));
            }
            return 0;
        }

        // --- GET FULL TREE FOR SIDEBAR ---
        [HttpGet("tree")]
        public async Task<IActionResult> GetTree()
        {
            var projects = await _context.Projects
                .Where(p => p.UserId == CurrentUserId)
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.SubGoals)
                        .ThenInclude(sg => sg.Tasks)
                .OrderBy(p => p.CreatedAt)
                .ToListAsync();

            var tree = projects.Select(p => new
            {
                id = p.Id,
                title = p.Title,
                progress = CalculateProjectProgress(p),
                mainGoals = p.MainGoal.Select(mg => new
                {
                    id = mg.Id,
                    projectId = mg.ProjectId,
                    title = mg.Title,
                    progress = CalculateMainGoalProgress(mg),
                    subGoals = mg.SubGoals.Select(sg => new
                    {
                        id = sg.Id,
                        mainGoalId = sg.MainGoalId,
                        title = sg.Title,
                        progress = CalculateSubGoalProgress(sg)
                    }).ToList()
                }).ToList()
            }).ToList();

            return Ok(tree);
        }

        // --- GET SINGLE PROJECT DETAILS ---
        [HttpGet("project/{id}")]
        public async Task<IActionResult> GetProjectDetails(int id)
        {
            var project = await _context.Projects
                .Include(p => p.MainGoal)
                    .ThenInclude(mg => mg.SubGoals)
                        .ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId);

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
                mainGoals = project.MainGoal.Select(mg => new
                {
                    id = mg.Id,
                    projectId = mg.ProjectId,
                    title = mg.Title,
                    description = mg.Description,
                    isCompleted = mg.IsCompleted,
                    progress = CalculateMainGoalProgress(mg),
                    createdAt = mg.CreatedAt,
                    subGoals = mg.SubGoals.Select(sg => new
                    {
                        id = sg.Id,
                        mainGoalId = sg.MainGoalId,
                        title = sg.Title,
                        description = sg.Description,
                        isCompleted = sg.IsCompleted,
                        progress = CalculateSubGoalProgress(sg),
                        createdAt = sg.CreatedAt,
                        tasks = sg.Tasks.Select(t => new
                        {
                            id = t.Id,
                            subGoalId = t.SubGoalId,
                            title = t.Title,
                            description = t.Description,
                            isCompleted = t.IsCompleted,
                            createdAt = t.CreatedAt
                        }).OrderBy(t => t.createdAt).ToList()
                    }).OrderBy(sg => sg.createdAt).ToList()
                }).OrderBy(mg => mg.createdAt).ToList()
            };

            return Ok(result);
        }

        // --- PROJECT CRUD ---
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
            var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == id && p.UserId == CurrentUserId);
            if (project == null) return NotFound();

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        // --- MAIN GOAL CRUD ---
        [HttpPost("maingoal")]
        public async Task<IActionResult> CreateMainGoal([FromBody] MainGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            // Ensure project belongs to current user
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

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("maingoal/{id}")]
        public async Task<IActionResult> DeleteMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.Include(m => m.Project).FirstOrDefaultAsync(m => m.Id == id && m.Project.UserId == CurrentUserId);
            if (mainGoal == null) return NotFound();

            _context.MainGoals.Remove(mainGoal);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpPost("maingoal/{id}/toggle")]
        public async Task<IActionResult> ToggleMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.Include(m => m.Project).FirstOrDefaultAsync(m => m.Id == id && m.Project.UserId == CurrentUserId);
            if (mainGoal == null) return NotFound();

            mainGoal.IsCompleted = !mainGoal.IsCompleted;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, isCompleted = mainGoal.IsCompleted });
        }

        // --- SUB GOAL CRUD ---
        [HttpPost("subgoal")]
        public async Task<IActionResult> CreateSubGoal([FromBody] SubGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            // Ensure parent main goal's project belongs to current user
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

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("subgoal/{id}")]
        public async Task<IActionResult> DeleteSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(s => s.Id == id && s.MainGoal.Project.UserId == CurrentUserId);
            if (subGoal == null) return NotFound();

            _context.SubGoals.Remove(subGoal);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpPost("subgoal/{id}/toggle")]
        public async Task<IActionResult> ToggleSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(s => s.Id == id && s.MainGoal.Project.UserId == CurrentUserId);
            if (subGoal == null) return NotFound();

            subGoal.IsCompleted = !subGoal.IsCompleted;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, isCompleted = subGoal.IsCompleted });
        }

        // --- TASK CRUD ---
        [HttpPost("task")]
        public async Task<IActionResult> CreateTask([FromBody] TaskUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            // Ensure parent subgoal belongs to current user
            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(s => s.Id == req.SubGoalId && s.MainGoal.Project.UserId == CurrentUserId);
            if (subGoal == null) return Unauthorized();

            var task = new TaskItem
            {
                SubGoalId = req.SubGoalId,
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

            var task = await _context.TaskItems.Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(t => t.Id == id && t.SubGoal.MainGoal.Project.UserId == CurrentUserId);
            if (task == null) return NotFound();

            task.Title = req.Title;
            task.Description = req.Description;
            task.IsCompleted = req.IsCompleted;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("task/{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.TaskItems.Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(t => t.Id == id && t.SubGoal.MainGoal.Project.UserId == CurrentUserId);
            if (task == null) return NotFound();

            _context.TaskItems.Remove(task);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpPost("task/{id}/toggle")]
        public async Task<IActionResult> ToggleTask(int id)
        {
            var task = await _context.TaskItems.Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(t => t.Id == id && t.SubGoal.MainGoal.Project.UserId == CurrentUserId);
            if (task == null) return NotFound();

            task.IsCompleted = !task.IsCompleted;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, isCompleted = task.IsCompleted });
        }
    }

    // --- REQUEST PAYLOADS ---
    public class ProjectUpsertRequest
    {
        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;
    }

    public class MainGoalUpsertRequest
    {
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
    }

    public class SubGoalUpsertRequest
    {
        public int MainGoalId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
    }

    public class TaskUpsertRequest
    {
        public int SubGoalId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
    }
}
