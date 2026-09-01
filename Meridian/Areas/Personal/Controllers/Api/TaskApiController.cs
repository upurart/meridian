using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;
using Meridian.Domain.Entities;
using System;
using System.Linq;
using System.Threading.Tasks;
using Meridian.Application.Interfaces;

namespace Meridian.Controllers
{
    [Route("api/dashboard")]
    public class TaskApiController : BaseApiController
    {
        private readonly Meridian.Services.IGoalStatusService _goalStatusService;
        private readonly IFileStorageService _storageService;

        public TaskApiController(AppDbContext context, Meridian.Services.IGoalStatusService goalStatusService, IFileStorageService storageService) : base(context) 
        { 
            _goalStatusService = goalStatusService;
            _storageService = storageService;
        }

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
                return BadRequest(new { message = "Görevin ekleneceği bir üst öge (Alt Hedef, Ana Hedef veya Proje) belirtilmelidir." });
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

            var orgId = await _context.Users.Where(u => u.Id == CurrentUserId).Select(u => u.OrganizationId).FirstOrDefaultAsync();
            Folder parentFolder = null;
            if (task.SubGoalId.HasValue && task.SubGoalId > 0)
                parentFolder = await _context.Folders.FirstOrDefaultAsync(f => f.SubGoalId == task.SubGoalId.Value && !f.IsDeleted);
            else if (task.MainGoalId.HasValue && task.MainGoalId > 0)
                parentFolder = await _context.Folders.FirstOrDefaultAsync(f => f.MainGoalId == task.MainGoalId.Value && !f.IsDeleted);
            else if (task.ProjectId.HasValue && task.ProjectId > 0)
                parentFolder = await _context.Folders.FirstOrDefaultAsync(f => f.ProjectId == task.ProjectId.Value && f.MainGoalId == null && f.SubGoalId == null && f.TaskItemId == null && !f.IsDeleted);

            if (parentFolder != null)
            {
                var folder = new Folder
                {
                    Name = task.Title,
                    OrganizationId = orgId,
                    ParentFolderId = parentFolder.Id,
                    ProjectId = relatedProjectId,
                    TaskItemId = task.Id,
                    IsSystemFolder = true,
                    CreatedById = CurrentUserId,
                    CreatedAt = DateTime.Now
                };
                _context.Folders.Add(folder);
                await _context.SaveChangesAsync();
            }

            await _goalStatusService.UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
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
            
            var folder = await _context.Folders.FirstOrDefaultAsync(f => f.TaskItemId == id);
            if (folder != null && folder.Name != req.Title) { folder.Name = req.Title; }

            if (!string.IsNullOrEmpty(req.RowVersion))
            {
                _context.Entry(task).OriginalValues["RowVersion"] = Convert.FromBase64String(req.RowVersion);
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "Bu görev sizden önce bir başkası tarafından değiştirilmiş. Lütfen sayfayı yenileyin." });
            }

            await _goalStatusService.UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true, rowVersion = Convert.ToBase64String(task.RowVersion ?? new byte[0]) });
        }

        [HttpDelete("task/{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.TaskItems.Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).Include(t => t.MainGoal).FirstOrDefaultAsync(t => t.Id == id);
            if (task == null) return NotFound();

            int relatedProjectId = task.SubGoal != null ? (task.SubGoal.MainGoal?.ProjectId ?? 0) : (task.MainGoal != null ? task.MainGoal.ProjectId : (task.ProjectId ?? 0));
            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            task.IsDeleted = true; task.DeletedAt = DateTime.Now; task.DeleteBatchId = null;
            
            await _context.Folders.Where(f => f.TaskItemId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.IsDeleted, true).SetProperty(f => f.DeletedAt, task.DeletedAt));

            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
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
            await _goalStatusService.UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
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
            
            await _context.Folders.IgnoreQueryFilters().Where(f => f.TaskItemId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.IsDeleted, false).SetProperty(f => f.DeletedAt, (DateTime?)null));

            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpDelete("task/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteTask(int id)
        {
            var task = await _context.TaskItems.IgnoreQueryFilters().Include(t => t.SubGoal).ThenInclude(s => s.MainGoal).Include(t => t.MainGoal).FirstOrDefaultAsync(t => t.Id == id && t.IsDeleted);
            if (task == null) return NotFound();

            int relatedProjectId = task.SubGoal != null ? (task.SubGoal.MainGoal?.ProjectId ?? 0) : (task.MainGoal != null ? task.MainGoal.ProjectId : (task.ProjectId ?? 0));
            if (relatedProjectId == 0 || !await CanWriteToProjectAsync(relatedProjectId)) return Unauthorized();

            var folder = await _context.Folders.IgnoreQueryFilters().FirstOrDefaultAsync(f => f.TaskItemId == id);
            if (folder != null)
            {
                var filesToDelete = await _context.FileItems.IgnoreQueryFilters().Where(fi => fi.FolderId == folder.Id).ToListAsync();
                foreach(var file in filesToDelete)
                {
                    if (!string.IsNullOrEmpty(file.FileUrl))
                    {
                        await _storageService.DeleteFileAsync(file.FileUrl);
                    }
                }
                if (filesToDelete.Any()) _context.FileItems.RemoveRange(filesToDelete);
                _context.Folders.Remove(folder);
            }

            _context.TaskItems.Remove(task);
            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(task.SubGoalId, task.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpGet("task/{id}/files")]
        public async Task<IActionResult> GetTaskFiles(int id)
        {
            var taskItem = await _context.TaskItems.Include(t => t.Project).Include(t => t.SubGoal).Include(t => t.MainGoal).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
            if (taskItem == null) return NotFound(new { message = "Görev bulunamadı." });

            var folder = await _context.Folders.Include(f => f.Files).FirstOrDefaultAsync(f => f.TaskItemId == id && !f.IsDeleted);
            if (folder == null)
            {
                int? parentFolderId = taskItem.SubGoalId.HasValue ? _context.Folders.FirstOrDefault(f => f.SubGoalId == taskItem.SubGoalId && !f.IsDeleted)?.Id
                    : taskItem.MainGoalId.HasValue ? _context.Folders.FirstOrDefault(f => f.MainGoalId == taskItem.MainGoalId && !f.IsDeleted)?.Id
                    : taskItem.ProjectId.HasValue ? _context.Folders.FirstOrDefault(f => f.ProjectId == taskItem.ProjectId && !f.IsDeleted)?.Id : null;
                    
                folder = new Domain.Entities.Folder {
                    Name = taskItem.Title, TaskItemId = taskItem.Id, OrganizationId = taskItem.OrganizationId,
                    ParentFolderId = parentFolderId, CreatedById = CurrentUserId
                };
                _context.Folders.Add(folder);
                await _context.SaveChangesAsync();
            }

            var files = folder.Files.Where(f => !f.IsDeleted).Select(f => new {
                id = f.Id, fileName = f.Name, fileExtension = f.Extension,
                fileSize = f.SizeInBytes, fileUrl = f.FileUrl, createdAt = f.CreatedAt
            }).OrderByDescending(f => f.createdAt).ToList();

            return Ok(new { folderId = folder.Id, files });
        }

        [HttpGet("project/{projectId}/files-summary")]
        public async Task<IActionResult> GetProjectFilesSummary(int projectId)
        {
            if (!await IsAuthorizedForProjectAsync(projectId)) return Unauthorized();
            var folders = await _context.Folders
                .Include(f => f.Files)
                .Where(f => !f.IsDeleted && f.ProjectId == projectId && (f.TaskItemId != null || f.SubGoalId != null || f.MainGoalId != null))
                .ToListAsync();
                
            var summaries = folders.Select(f => {
                var activeFiles = f.Files.Where(x => !x.IsDeleted).Select(x => x.Name).ToList();
                string itemType = f.TaskItemId.HasValue ? "task" : (f.SubGoalId.HasValue ? "subgoal" : "maingoal");
                int itemId = f.TaskItemId ?? f.SubGoalId ?? f.MainGoalId ?? 0;
                
                return new {
                    itemType,
                    itemId,
                    count = activeFiles.Count,
                    names = activeFiles.Count <= 3 
                        ? string.Join(", ", activeFiles) 
                        : string.Join(", ", activeFiles.Take(3)) + $" (+{activeFiles.Count - 3})"
                };
            }).Where(s => s.count > 0).ToList();

            return Ok(summaries);
        }

        [HttpGet("project/{projectId}/tasks")]
        public async Task<IActionResult> GetProjectTasks(int projectId)
        {
            if (!await IsAuthorizedForProjectAsync(projectId)) return Unauthorized();

            var tasks = await _context.TaskItems
                .Include(t => t.SubGoal).ThenInclude(sg => sg.MainGoal)
                .Include(t => t.MainGoal)
                .Where(t => !t.IsDeleted && (
                    (t.ProjectId == projectId) || 
                    (t.MainGoal != null && t.MainGoal.ProjectId == projectId) || 
                    (t.SubGoal != null && t.SubGoal!.MainGoal != null && t.SubGoal!.MainGoal.ProjectId == projectId)
                ))
                .Select(t => new { id = t.Id, title = t.Title })
                .ToListAsync();

            return Ok(tasks);
        }

        [HttpGet("activities/{projectId}")]
        public async Task<IActionResult> GetProjectActivities(int projectId, [FromQuery] int page = 1)
        {
            try 
            {
                if (!await IsAuthorizedForProjectAsync(projectId)) return Unauthorized();

                int pageSize = 10;
                var query = _context.ActivityLogs
                    .Where(a => a.ProjectId == projectId)
                    .OrderByDescending(a => a.CreatedAt);

                int totalCount = await query.CountAsync();
                int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var logs = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(log => new {
                        Log = log,
                        User = _context.Users.FirstOrDefault(u => u.Id == log.UserID)
                    })
                    .ToListAsync();

                var formattedLogs = logs.Select(l => new {
                    id = l.Log.Id,
                    action = l.Log.ActionType,
                    entity = l.Log.EntityType,
                    details = l.Log.Details,
                    date = l.Log.CreatedAt,
                    authorName = l.User != null ? (string.IsNullOrWhiteSpace(l.User.Name) ? l.User.Username : l.User.Name + " " + l.User.Surname) : "Bilinmeyen Kullanıcı"
                }).ToList();

                return Ok(new {
                    items = formattedLogs,
                    totalPages = totalPages > 0 ? totalPages : 1,
                    currentPage = page,
                    totalCount = totalCount
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
