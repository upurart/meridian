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
    public class GoalApiController : BaseApiController
    {
        private readonly Meridian.Services.IGoalStatusService _goalStatusService;
        private readonly IFileStorageService _storageService;
        public GoalApiController(AppDbContext context, Meridian.Services.IGoalStatusService goalStatusService, IFileStorageService storageService) : base(context) 
        { 
            _goalStatusService = goalStatusService;
            _storageService = storageService;
        }

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

            var orgId = await _context.Users.Where(u => u.Id == CurrentUserId).Select(u => u.OrganizationId).FirstOrDefaultAsync();
            var projectFolder = await _context.Folders.FirstOrDefaultAsync(f => f.ProjectId == req.ProjectId && f.MainGoalId == null && f.SubGoalId == null && f.TaskItemId == null && !f.IsDeleted);
            if (projectFolder != null)
            {
                var folder = new Folder
                {
                    Name = mainGoal.Title,
                    OrganizationId = orgId,
                    ParentFolderId = projectFolder.Id,
                    ProjectId = req.ProjectId,
                    MainGoalId = mainGoal.Id,
                    IsSystemFolder = true,
                    CreatedById = CurrentUserId,
                    CreatedAt = DateTime.Now
                };
                _context.Folders.Add(folder);
                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true, id = mainGoal.Id });
        }

        [HttpPut("maingoal/{id}")]
        public async Task<IActionResult> UpdateMainGoal(int id, [FromBody] MainGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var mainGoal = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == id);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            mainGoal.Title = req.Title; mainGoal.Description = req.Description ?? ""; mainGoal.IsCompleted = req.IsCompleted;
            
            var folder = await _context.Folders.FirstOrDefaultAsync(f => f.MainGoalId == id);
            if (folder != null && folder.Name != req.Title) { folder.Name = req.Title; }

            await _goalStatusService.CascadeCompleteMainGoalAsync(id, req.IsCompleted);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpGet("maingoal/{id}/files")]
        public async Task<IActionResult> GetMainGoalFiles(int id)
        {
            var mainGoal = await _context.MainGoals.Include(g => g.Project).FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);
            if (mainGoal == null) return NotFound(new { message = "Hedef bulunamadı." });

            var folder = await _context.Folders.Include(f => f.Files).FirstOrDefaultAsync(f => f.MainGoalId == id && !f.IsDeleted);
            if (folder == null)
            {
                int? parentFolderId = mainGoal.ProjectId != null && mainGoal.ProjectId != 0 ? _context.Folders.FirstOrDefault(f => f.ProjectId == mainGoal.ProjectId && !f.IsDeleted)?.Id : null;
                
                folder = new Domain.Entities.Folder {
                    Name = mainGoal.Title, MainGoalId = mainGoal.Id, OrganizationId = mainGoal.OrganizationId,
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

        [HttpDelete("maingoal/{id}")]
        public async Task<IActionResult> DeleteMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.Include(m => m.Tasks).Include(m => m.SubGoals).ThenInclude(sg => sg.Tasks).FirstOrDefaultAsync(m => m.Id == id);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            var batchId = Guid.NewGuid(); var deleteTime = DateTime.Now;
            var cascadeService = new Meridian.Services.CascadeOperationService();
            cascadeService.SoftDeleteMainGoal(mainGoal, batchId, deleteTime);

            var subGoalIds = await _context.SubGoals.Where(sg => sg.MainGoalId == id).Select(s => s.Id).ToListAsync();
            var taskIds = await _context.TaskItems.Where(t => t.MainGoalId == id || (t.SubGoalId != null && subGoalIds.Contains(t.SubGoalId.Value))).Select(t => t.Id).ToListAsync();
            
            await _context.Folders.Where(f => f.MainGoalId == id || (f.SubGoalId != null && subGoalIds.Contains(f.SubGoalId.Value)) || (f.TaskItemId != null && taskIds.Contains(f.TaskItemId.Value)))
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.IsDeleted, true).SetProperty(f => f.DeletedAt, deleteTime));

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("maingoal/{id}/toggle")]
        public async Task<IActionResult> ToggleMainGoal(int id)
        {
            var mainGoal = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == id);
            if (mainGoal == null || !await CanWriteToProjectAsync(mainGoal.ProjectId)) return NotFound();

            mainGoal.IsCompleted = !mainGoal.IsCompleted;

            await _goalStatusService.CascadeCompleteMainGoalAsync(id, mainGoal.IsCompleted);
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

            var subGoalIds2 = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoalId == id).Select(s => s.Id).ToListAsync();
            var taskIds2 = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.MainGoalId == id || (t.SubGoalId != null && subGoalIds2.Contains(t.SubGoalId.Value))).Select(t => t.Id).ToListAsync();
            
            await _context.Folders.IgnoreQueryFilters().Where(f => f.MainGoalId == id || (f.SubGoalId != null && subGoalIds2.Contains(f.SubGoalId.Value)) || (f.TaskItemId != null && taskIds2.Contains(f.TaskItemId.Value)))
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.IsDeleted, false).SetProperty(f => f.DeletedAt, (DateTime?)null));

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

            var subGoalIds = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.MainGoalId == id).Select(s => s.Id).ToListAsync();
            var taskIds = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.MainGoalId == id || (t.SubGoalId != null && subGoalIds.Contains(t.SubGoalId.Value))).Select(t => t.Id).ToListAsync();
            var foldersToDelete = await _context.Folders.IgnoreQueryFilters().Where(f => f.MainGoalId == id || (f.SubGoalId != null && subGoalIds.Contains(f.SubGoalId.Value)) || (f.TaskItemId != null && taskIds.Contains(f.TaskItemId.Value))).ToListAsync();
            var folderIds = foldersToDelete.Select(f => f.Id).ToList();
            var filesToDelete = await _context.FileItems.IgnoreQueryFilters().Where(fi => fi.FolderId != null && folderIds.Contains(fi.FolderId.Value)).ToListAsync();
            foreach(var file in filesToDelete)
            {
                if (!string.IsNullOrEmpty(file.FileUrl)) await _storageService.DeleteFileAsync(file.FileUrl);
            }
            if (filesToDelete.Any()) _context.FileItems.RemoveRange(filesToDelete);

            _context.Folders.RemoveRange(foldersToDelete);

            _context.MainGoals.Remove(mainGoal);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("subgoal")]
        public async Task<IActionResult> CreateSubGoal([FromBody] SubGoalUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (req.MainGoalId == 0) return BadRequest(new { message = "Bir alt hedef oluşturmak için ana hedef belirtilmelidir." });

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

            var orgId = await _context.Users.Where(u => u.Id == CurrentUserId).Select(u => u.OrganizationId).FirstOrDefaultAsync();
            var parentFolder = await _context.Folders.FirstOrDefaultAsync(f => f.MainGoalId == mainGoal.Id && !f.IsDeleted);
            if (parentFolder != null)
            {
                var folder = new Folder
                {
                    Name = subGoal.Title,
                    OrganizationId = orgId,
                    ParentFolderId = parentFolder.Id,
                    ProjectId = projectId,
                    SubGoalId = subGoal.Id,
                    IsSystemFolder = true,
                    CreatedById = CurrentUserId,
                    CreatedAt = DateTime.Now
                };
                _context.Folders.Add(folder);
                await _context.SaveChangesAsync();
            }

            await _goalStatusService.UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
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
            
            var folder = await _context.Folders.FirstOrDefaultAsync(f => f.SubGoalId == id);
            if (folder != null && folder.Name != req.Title) { folder.Name = req.Title; }

            if (subGoal.IsCompleted)
            {
                await _goalStatusService.CascadeCompleteSubGoalAsync(id, true);
            }

            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true });
        }

        [HttpGet("subgoal/{id}/files")]
        public async Task<IActionResult> GetSubGoalFiles(int id)
        {
            var subGoal = await _context.SubGoals.Include(g => g.MainGoal).FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);
            if (subGoal == null) return NotFound(new { message = "Alt hedef bulunamadı." });

            var folder = await _context.Folders.Include(f => f.Files).FirstOrDefaultAsync(f => f.SubGoalId == id && !f.IsDeleted);
            if (folder == null)
            {
                int? parentFolderId = subGoal.MainGoalId != null && subGoal.MainGoalId != 0 ? _context.Folders.FirstOrDefault(f => f.MainGoalId == subGoal.MainGoalId && !f.IsDeleted)?.Id : null;
                
                folder = new Domain.Entities.Folder {
                    Name = subGoal.Title, SubGoalId = subGoal.Id, OrganizationId = subGoal.OrganizationId,
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

        [HttpDelete("subgoal/{id}")]
        public async Task<IActionResult> DeleteSubGoal(int id)
        {
            var subGoal = await _context.SubGoals.Include(s => s.MainGoal).Include(s => s.Tasks).FirstOrDefaultAsync(s => s.Id == id);
            if (subGoal == null) return NotFound();
            
            int pId = subGoal.MainGoal?.ProjectId ?? 0;
            if (pId == 0 || !await CanWriteToProjectAsync(pId)) return Unauthorized();

            var batchId = Guid.NewGuid(); var deleteTime = DateTime.Now;
            var cascadeService = new Meridian.Services.CascadeOperationService();
            cascadeService.SoftDeleteSubGoal(subGoal, batchId, deleteTime);

            var taskIds = await _context.TaskItems.Where(t => t.SubGoalId == id).Select(t => t.Id).ToListAsync();
            await _context.Folders.Where(f => f.SubGoalId == id || (f.TaskItemId != null && taskIds.Contains(f.TaskItemId.Value)))
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.IsDeleted, true).SetProperty(f => f.DeletedAt, deleteTime));

            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
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

            await _goalStatusService.CascadeCompleteSubGoalAsync(id, subGoal.IsCompleted);
            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
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

            var taskIds2 = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.SubGoalId == id).Select(t => t.Id).ToListAsync();
            await _context.Folders.IgnoreQueryFilters().Where(f => f.SubGoalId == id || (f.TaskItemId != null && taskIds2.Contains(f.TaskItemId.Value)))
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.IsDeleted, false).SetProperty(f => f.DeletedAt, (DateTime?)null));

            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
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
            
            var taskIds = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.SubGoalId == id).Select(t => t.Id).ToListAsync();
            var foldersToDelete = await _context.Folders.IgnoreQueryFilters().Where(f => f.SubGoalId == id || (f.TaskItemId != null && taskIds.Contains(f.TaskItemId.Value))).ToListAsync();
            
            var folderIds = foldersToDelete.Select(f => f.Id).ToList();
            var filesToDelete = await _context.FileItems.IgnoreQueryFilters().Where(fi => fi.FolderId != null && folderIds.Contains(fi.FolderId.Value)).ToListAsync();
            foreach(var file in filesToDelete)
            {
                if (!string.IsNullOrEmpty(file.FileUrl)) await _storageService.DeleteFileAsync(file.FileUrl);
            }
            if (filesToDelete.Any()) _context.FileItems.RemoveRange(filesToDelete);
            _context.Folders.RemoveRange(foldersToDelete);

            _context.SubGoals.Remove(subGoal);
            await _context.SaveChangesAsync();
            await _goalStatusService.UpdateGoalCompletionStatusAsync(null, subGoal.MainGoalId);
            return Ok(new { success = true });
        }
    }
}
