using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;

namespace Meridian.Controllers
{
    [Route("api/dashboard")]
    public class GoalApiController : BaseApiController
    {
        public GoalApiController(AppDbContext context) : base(context) { }

        [HttpPost("maingoal")]
        public async Task<IActionResult> CreateMainGoal([FromBody] MainGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (!await CanWriteToProjectAsync(req.ProjectId)) return Unauthorized();

            var mainGoal = new MainGoal
            {
                ProjectId = req.ProjectId, Title = req.Title, Description = req.Description ?? "",
                IsCompleted = req.IsCompleted, CreatedAt = DateTime.Now
            };

            _context.MainGoals.Add(mainGoal);
            await _context.SaveChangesAsync();
            return Ok(new { success = true, id = mainGoal.Id });
        }

        [HttpPut("maingoal/{id}")]
        public async Task<IActionResult> UpdateMainGoal(int id, [FromBody] MainGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var mainGoal = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == id);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            mainGoal.Title = req.Title; mainGoal.Description = req.Description ?? ""; mainGoal.IsCompleted = req.IsCompleted;

            if (mainGoal.IsCompleted)
            {
                var subGoals = await _context.SubGoals.Include(sg => sg.Tasks).Where(sg => sg.MainGoalId == id && !sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals)
                {
                    sg.IsCompleted = true;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsCompleted = true; }
                }
                var tasks = await _context.TaskItems.Where(t => t.MainGoalId == id && t.SubGoalId == null && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsCompleted = true; }
            }
            else
            {
                var subGoals = await _context.SubGoals.Include(sg => sg.Tasks).Where(sg => sg.MainGoalId == id && !sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals)
                {
                    sg.IsCompleted = false;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsCompleted = false; }
                }
                var tasks = await _context.TaskItems.Where(t => t.MainGoalId == id && t.SubGoalId == null && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsCompleted = false; }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("maingoal/{id}")]
        public async Task<IActionResult> DeleteMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.Include(m => m.Tasks).Include(m => m.SubGoals).ThenInclude(sg => sg.Tasks).FirstOrDefaultAsync(m => m.Id == id);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            var batchId = Guid.NewGuid(); var deleteTime = DateTime.Now;
            mainGoal.IsDeleted = true; mainGoal.DeletedAt = deleteTime; mainGoal.DeleteBatchId = batchId;

            foreach (var t in mainGoal.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }
            foreach (var sg in mainGoal.SubGoals.Where(sg => !sg.IsDeleted))
            {
                sg.IsDeleted = true; sg.DeletedAt = deleteTime; sg.DeleteBatchId = batchId;
                foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("maingoal/{id}/toggle")]
        public async Task<IActionResult> ToggleMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == id);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            mainGoal.IsCompleted = !mainGoal.IsCompleted;

            if (mainGoal.IsCompleted)
            {
                var subGoals = await _context.SubGoals.Include(sg => sg.Tasks).Where(sg => sg.MainGoalId == id && !sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals)
                {
                    sg.IsCompleted = true;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsCompleted = true; }
                }
                var tasks = await _context.TaskItems.Where(t => t.MainGoalId == id && t.SubGoalId == null && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsCompleted = true; }
            }
            else
            {
                var subGoals = await _context.SubGoals.Include(sg => sg.Tasks).Where(sg => sg.MainGoalId == id && !sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals)
                {
                    sg.IsCompleted = false;
                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsCompleted = false; }
                }
                var tasks = await _context.TaskItems.Where(t => t.MainGoalId == id && t.SubGoalId == null && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsCompleted = false; }
            }
            await _context.SaveChangesAsync();
            return Ok(new { success = true, isCompleted = mainGoal.IsCompleted });
        }

        [HttpPost("maingoal/{id}/restore")]
        public async Task<IActionResult> RestoreMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.IgnoreQueryFilters().Include(mg => mg.Project).FirstOrDefaultAsync(mg => mg.Id == id && mg.IsDeleted);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            if (mainGoal.Project.IsDeleted) { mainGoal.Project.IsDeleted = false; mainGoal.Project.DeletedAt = null; mainGoal.Project.DeleteBatchId = null; }
            mainGoal.IsDeleted = false; mainGoal.DeletedAt = null;

            if (mainGoal.DeleteBatchId.HasValue)
            {
                var batchId = mainGoal.DeleteBatchId.Value;
                var subGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                foreach (var sg in subGoals) { sg.IsDeleted = false; sg.DeletedAt = null; sg.DeleteBatchId = null; }
                var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsDeleted = false; t.DeletedAt = null; t.DeleteBatchId = null; }
                mainGoal.DeleteBatchId = null;
            }
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("maingoal/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.IgnoreQueryFilters().FirstOrDefaultAsync(m => m.Id == id && m.IsDeleted);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.MainGoalId == id || (t.SubGoalId != null && t.SubGoal != null && t.SubGoal!.MainGoalId == id)).ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);
            
            var subGoalsToDelete = await _context.SubGoals.IgnoreQueryFilters().Where(s => s.MainGoalId == id).ToListAsync();
            _context.SubGoals.RemoveRange(subGoalsToDelete);

            _context.MainGoals.Remove(mainGoal);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("subgoal")]
        public async Task<IActionResult> CreateSubGoal([FromBody] SubGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (req.MainGoalId == 0)
            {
                return BadRequest(new { message = "Bir alt hedef oluşturmak için ana hedef belirtilmelidir." });
            }

            var mainGoal = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == req.MainGoalId);
            if (mainGoal == null) return NotFound();

            int projectId = mainGoal.ProjectId;
            if (!await CanWriteToProjectAsync(projectId)) return Unauthorized();

            var subGoal = new SubGoal
            {
                MainGoalId = req.MainGoalId.Value,
                Title = req.Title, Description = req.Description ?? "",
                IsCompleted = req.IsCompleted, CreatedAt = DateTime.Now
            };

            _context.SubGoals.Add(subGoal);
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true, id = subGoal.Id });
        }

        [HttpPut("subgoal/{id}")]
        public async Task<IActionResult> UpdateSubGoal(int id, [FromBody] SubGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).FirstOrDefaultAsync(s => s.Id == id);
            if (subGoal == null) return NotFound();
            
            int pId = subGoal.MainGoal?.ProjectId ?? 0;
            if (pId == 0 || !await CanWriteToProjectAsync(pId)) return Unauthorized();

            subGoal.Title = req.Title; subGoal.Description = req.Description ?? ""; subGoal.IsCompleted = req.IsCompleted;

            if (subGoal.IsCompleted)
            {
                var tasks = await _context.TaskItems.Where(t => t.SubGoalId == id && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsCompleted = true; }
            }

            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpDelete("subgoal/{id}")]
        public async Task<IActionResult> DeleteSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).Include(s => s.Tasks).FirstOrDefaultAsync(s => s.Id == id);
            if (subGoal == null) return NotFound();
            
            int pId = subGoal.MainGoal?.ProjectId ?? 0;
            if (pId == 0 || !await CanWriteToProjectAsync(pId)) return Unauthorized();

            var batchId = Guid.NewGuid(); var deleteTime = DateTime.Now;
            subGoal.IsDeleted = true; subGoal.DeletedAt = deleteTime; subGoal.DeleteBatchId = batchId;

            foreach (var t in subGoal.Tasks.Where(t => !t.IsDeleted)) { t.IsDeleted = true; t.DeletedAt = deleteTime; t.DeleteBatchId = batchId; }

            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpPost("subgoal/{id}/toggle")]
        public async Task<IActionResult> ToggleSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).FirstOrDefaultAsync(s => s.Id == id);
            if (subGoal == null) return NotFound();
            
            int pId = subGoal.MainGoal?.ProjectId ?? 0;
            if (pId == 0 || !await CanWriteToProjectAsync(pId)) return Unauthorized();

            subGoal.IsCompleted = !subGoal.IsCompleted;

            if (subGoal.IsCompleted)
            {
                var tasks = await _context.TaskItems.Where(t => t.SubGoalId == id && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsCompleted = true; }
            }
            else
            {
                var tasks = await _context.TaskItems.Where(t => t.SubGoalId == id && !t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsCompleted = false; }
            }
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true, isCompleted = subGoal.IsCompleted });
        }

        [HttpPost("subgoal/{id}/restore")]
        public async Task<IActionResult> RestoreSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.IgnoreQueryFilters().Include(sg => sg.MainGoal).ThenInclude(m => m.Project).FirstOrDefaultAsync(sg => sg.Id == id && sg.IsDeleted);
            if (subGoal == null) return NotFound();

            int pId = subGoal.MainGoal?.ProjectId ?? 0;
            if (pId == 0 || !await CanWriteToProjectAsync(pId)) return Unauthorized();

            if (subGoal.MainGoal != null && subGoal.MainGoal.IsDeleted) { subGoal.MainGoal.IsDeleted = false; subGoal.MainGoal.DeletedAt = null; subGoal.MainGoal.DeleteBatchId = null; }
            if (subGoal.MainGoal != null && subGoal.MainGoal.Project != null && subGoal.MainGoal.Project.IsDeleted) { subGoal.MainGoal.Project.IsDeleted = false; subGoal.MainGoal.Project.DeletedAt = null; subGoal.MainGoal.Project.DeleteBatchId = null; }

            subGoal.IsDeleted = false; subGoal.DeletedAt = null;

            if (subGoal.DeleteBatchId.HasValue)
            {
                var batchId = subGoal.DeleteBatchId.Value;
                var tasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();
                foreach (var t in tasks) { t.IsDeleted = false; t.DeletedAt = null; t.DeleteBatchId = null; }
                subGoal.DeleteBatchId = null;
            }
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpDelete("subgoal/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.IgnoreQueryFilters().Include(s => s.MainGoal).FirstOrDefaultAsync(s => s.Id == id && s.IsDeleted);
            if (subGoal == null) return NotFound();
            
            int pId = subGoal.MainGoal?.ProjectId ?? 0;
            if (pId == 0 || !await CanWriteToProjectAsync(pId)) return Unauthorized();

            var tasksToDelete = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.SubGoalId == id).ToListAsync();
            _context.TaskItems.RemoveRange(tasksToDelete);
            _context.SubGoals.Remove(subGoal);
            await _context.SaveChangesAsync();
            await UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true });
        }
    }
}


