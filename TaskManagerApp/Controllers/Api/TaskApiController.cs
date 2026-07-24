using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    [Route("api/dashboard")]
    public class TaskApiController : BaseApiController
    {
        public TaskApiController(AppDbContext context) : base(context) { }

        [HttpPost("task")]
        public async Task<IActionResult> CreateTask([FromBody] TaskUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            int relatedProjectId = 0;

            if (req.SubGoalId.HasValue && req.SubGoalId.Value > 0)
            {
                var subGoal = await _context.SubGoals.Include(s => s.MainGoal).FirstOrDefaultAsync(s => s.Id == req.SubGoalId.Value);
                if (subGoal != null) relatedProjectId = subGoal.MainGoal?.ProjectId ?? 0;
            }
            else if (req.MainGoalId.HasValue && req.MainGoalId.Value > 0)
            {
                var mainGoal = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == req.MainGoalId.Value);
                if (mainGoal != null) relatedProjectId = mainGoal.ProjectId;
            }
            else if (req.ProjectId.HasValue && req.ProjectId.Value > 0)
            {
                relatedProjectId = req.ProjectId.Value;
            }
            else
            {
                return BadRequest(new { message = "G�revin eklenece�i bir �st �ge (Alt Hedef, Ana Hedef veya Proje) belirtilmelidir." });
            }

            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            var task = new TaskItem
            {
                SubGoalId = req.SubGoalId > 0 ? req.SubGoalId : null,
                MainGoalId = req.MainGoalId > 0 ? req.MainGoalId : null,
                ProjectId = req.ProjectId > 0 ? req.ProjectId : null,
                Title = req.Title, Description = req.Description ?? "", IsCompleted = req.IsCompleted, CreatedAt = DateTime.Now
            };

            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true, id = task.Id });
        }

        [HttpPut("task/{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var task = await _context.TaskItems.Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).Include(t => t.MainGoal).FirstOrDefaultAsync(t => t.Id == id);
            if (task == null) return NotFound();

            int relatedProjectId = task.SubGoal != null ? (task.SubGoal.MainGoal?.ProjectId ?? 0) : (task.MainGoal != null ? task.MainGoal.ProjectId : (task.ProjectId ?? 0));
            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            task.Title = req.Title; task.Description = req.Description ?? ""; task.IsCompleted = req.IsCompleted;
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpDelete("task/{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.TaskItems.Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).Include(t => t.MainGoal).FirstOrDefaultAsync(t => t.Id == id);
            if (task == null) return NotFound();

            int relatedProjectId = task.SubGoal != null ? (task.SubGoal.MainGoal?.ProjectId ?? 0) : (task.MainGoal != null ? task.MainGoal.ProjectId : (task.ProjectId ?? 0));
            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            task.IsDeleted = true; task.DeletedAt = DateTime.Now; task.DeleteBatchId = null;
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpPost("task/{id}/toggle")]
        public async Task<IActionResult> ToggleTask(int id)
        {
            var task = await _context.TaskItems.Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).Include(t => t.MainGoal).FirstOrDefaultAsync(t => t.Id == id);
            if (task == null) return NotFound();

            int relatedProjectId = task.SubGoal != null ? (task.SubGoal.MainGoal?.ProjectId ?? 0) : (task.MainGoal != null ? task.MainGoal.ProjectId : (task.ProjectId ?? 0));
            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            task.IsCompleted = !task.IsCompleted;
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true, isCompleted = task.IsCompleted });
        }

        [HttpPost("task/{id}/restore")]
        public async Task<IActionResult> RestoreTask(int id)
        {
            var task = await _context.TaskItems.IgnoreQueryFilters().Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).ThenInclude(m => m.Project).Include(t => t.MainGoal).ThenInclude(mg => mg.Project).FirstOrDefaultAsync(t => t.Id == id && t.IsDeleted);
            if (task == null) return NotFound();

            int relatedProjectId = task.SubGoal != null ? (task.SubGoal.MainGoal?.ProjectId ?? 0) : (task.MainGoal != null ? task.MainGoal.ProjectId : (task.ProjectId ?? 0));
            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            if (task.SubGoal != null && task.SubGoal.IsDeleted) { task.SubGoal.IsDeleted = false; task.SubGoal.DeletedAt = null; task.SubGoal.DeleteBatchId = null; }
            if (task.SubGoal != null && task.SubGoal.MainGoal != null && task.SubGoal.MainGoal.IsDeleted) { task.SubGoal.MainGoal.IsDeleted = false; task.SubGoal.MainGoal.DeletedAt = null; task.SubGoal.MainGoal.DeleteBatchId = null; }
            if (task.SubGoal != null && task.SubGoal.MainGoal != null && task.SubGoal.MainGoal.Project.IsDeleted) { task.SubGoal.MainGoal.Project.IsDeleted = false; task.SubGoal.MainGoal.Project.DeletedAt = null; task.SubGoal.MainGoal.Project.DeleteBatchId = null; }

            task.IsDeleted = false; task.DeletedAt = null; task.DeleteBatchId = null;
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpDelete("task/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteTask(int id)
        {
            var task = await _context.TaskItems.IgnoreQueryFilters().Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).Include(t => t.MainGoal).FirstOrDefaultAsync(t => t.Id == id && t.IsDeleted);
            if (task == null) return NotFound();

            int relatedProjectId = task.SubGoal != null ? (task.SubGoal.MainGoal?.ProjectId ?? 0) : (task.MainGoal != null ? task.MainGoal.ProjectId : (task.ProjectId ?? 0));
            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            _context.TaskItems.Remove(task);
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpGet("activities")]
        public async Task<IActionResult> GetRecentActivities()
        {
            try 
            {
                var authorizedProjectIds = await GetAuthorizedProjects(true).Select(p => p.Id).ToListAsync();

                var logs = await _context.ActivityLogs
                    .Where(a => authorizedProjectIds.Contains(a.ProjectId))
                    .OrderByDescending(a => a.CreatedAt)
                    .Take(50)
                    .ToListAsync();

                var groupedLogs = logs.GroupBy(a => a.ProjectId)
                    .Select(g => {
                        var project = _context.Projects.IgnoreQueryFilters().FirstOrDefault(p => p.Id == g.Key);
                        var projTitle = project != null ? project.Title : "??? Silinmi� Proje";

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
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
