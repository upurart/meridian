using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;
using System.Text.RegularExpressions;

namespace Meridian.Controllers.Api
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkspaceApiController : BaseApiController
    {
        public WorkspaceApiController(AppDbContext context) : base(context) { }

        // GET: api/WorkspaceApi
        [HttpGet]
        public async Task<IActionResult> GetMyWorkspaces()
        {
            var userId = CurrentUserId;
            if (userId == 0) return Unauthorized();

            var workspaces = await _context.WorkspaceMembers
                .Include(wm => wm.Workspace)
                .ThenInclude(w => w!.Projects)
                .Where(wm => wm.UserId == userId && wm.IsActive && wm.Workspace != null && wm.Workspace!.IsActive)
                .Select(wm => new {
                    wm.Workspace!.Id,
                    wm.Workspace!.Name,
                    wm.Workspace!.Slug,
                    wm.Workspace!.Description,
                    wm.Workspace!.OwnerId,
                    wm.Workspace!.TeamGroupId,
                    wm.Workspace!.CreatedAt,
                    ProjectsCount = wm.Workspace!.Projects.Count(p => !p.IsDeleted),
                    wm.RolePreset
                })
                .ToListAsync();

            return Ok(workspaces);
        }

        // GET: api/WorkspaceApi/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetWorkspaceDetails(int id)
        {
            var userId = CurrentUserId;
            if (userId == 0) return Unauthorized();

            var member = await _context.WorkspaceMembers
                .Include(wm => wm.Workspace)
                    .ThenInclude(w => w!.TeamGroup)
                .Include(wm => wm.Workspace)
                    .ThenInclude(w => w!.Projects.Where(p => !p.IsDeleted))
                        .ThenInclude(p => p.MainGoal)
                            .ThenInclude(mg => mg.SubGoals)
                                .ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(wm => wm.UserId == userId && wm.WorkspaceId == id && wm.IsActive);

            if (member == null || member.Workspace == null || !member.Workspace.IsActive)
                return NotFound(new { message = "Çalışma alanı bulunamadı veya erişim yetkiniz yok." });

            var workspace = member.Workspace;

            var result = new
            {
                workspace.Id,
                workspace.Name,
                workspace.Description,
                workspace.TeamGroupId,
                TeamGroupName = workspace.TeamGroup?.Name,
                workspace.CreatedAt,
                RolePreset = member.RolePreset,
                Projects = workspace.Projects.Select(p => {
                    // İlerleme hesabı
                    var totalTasks = p.MainGoal.SelectMany(mg => mg.SubGoals).SelectMany(sg => sg.Tasks).Count();
                    var completedTasks = p.MainGoal.SelectMany(mg => mg.SubGoals).SelectMany(sg => sg.Tasks).Count(t => t.IsCompleted);
                    var progress = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 0;

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

            return Ok(result);
        }

        // POST: api/WorkspaceApi
        [HttpPost]
        public async Task<IActionResult> CreateWorkspace([FromBody] CreateWorkspaceDto dto)
        {
            var userId = CurrentUserId;
            if (userId == 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Çalışma alanı adı boş olamaz." });

            var slug = GenerateSlug(dto.Name);
            // Ensure unique slug
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
                CreatedAt = DateTime.Now,
                IsActive = true
            };

            _context.Workspaces.Add(workspace);
            await _context.SaveChangesAsync(); // save to get Id

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

            return Ok(new { 
                workspace.Id, 
                workspace.Name, 
                workspace.Slug,
                workspace.TeamGroupId
            });
        }

        // DELETE: api/WorkspaceApi/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkspace(int id)
        {
            var userId = CurrentUserId;
            if (userId == 0) return Unauthorized();

            var member = await _context.WorkspaceMembers
                .Include(wm => wm.Workspace)
                    .ThenInclude(w => w!.Projects.Where(p => !p.IsDeleted))
                        .ThenInclude(p => p.Tasks)
                .Include(wm => wm.Workspace)
                    .ThenInclude(w => w!.Projects.Where(p => !p.IsDeleted))
                        .ThenInclude(p => p.MainGoal)
                            .ThenInclude(mg => mg.Tasks)
                .Include(wm => wm.Workspace)
                    .ThenInclude(w => w!.Projects.Where(p => !p.IsDeleted))
                        .ThenInclude(p => p.MainGoal)
                            .ThenInclude(mg => mg.SubGoals)
                                .ThenInclude(sg => sg.Tasks)
                .FirstOrDefaultAsync(wm => wm.UserId == userId && wm.WorkspaceId == id && wm.IsActive && wm.RolePreset == "Owner");

            if (member == null || member.Workspace == null || member.Workspace.IsDeleted)
                return NotFound(new { message = "Çalışma alanı bulunamadı veya silme yetkiniz yok." });

            var workspace = member.Workspace;
            var batchId = Guid.NewGuid();
            var deleteTime = DateTime.Now;

            workspace.IsDeleted = true;
            workspace.DeletedAt = deleteTime;
            workspace.DeleteBatchId = batchId;

            foreach (var project in workspace.Projects)
            {
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
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedWorkspaces()
        {
            var userId = CurrentUserId;
            if (userId == 0) return Unauthorized();

            var deletedWorkspaces = await _context.WorkspaceMembers
                .IgnoreQueryFilters()
                .Include(wm => wm.Workspace)
                .Where(wm => wm.UserId == userId && wm.IsActive && wm.RolePreset == "Owner" && wm.Workspace != null && wm.Workspace!.IsDeleted)
                .OrderByDescending(wm => wm.Workspace!.DeletedAt)
                .Select(wm => new { id = wm.Workspace!.Id, name = wm.Workspace!.Name, description = wm.Workspace!.Description, deletedAt = wm.Workspace!.DeletedAt })
                .ToListAsync();

            return Ok(deletedWorkspaces);
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreWorkspace(int id)
        {
            var userId = CurrentUserId;
            if (userId == 0) return Unauthorized();

            var member = await _context.WorkspaceMembers
                .IgnoreQueryFilters()
                .Include(wm => wm.Workspace)
                .FirstOrDefaultAsync(wm => wm.UserId == userId && wm.WorkspaceId == id && wm.IsActive && wm.RolePreset == "Owner" && wm.Workspace != null && wm.Workspace!.IsDeleted);

            if (member == null || member.Workspace == null)
                return NotFound(new { message = "Silinmiş çalışma alanı bulunamadı." });

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
            return Ok(new { success = true });
        }

        [HttpDelete("{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteWorkspace(int id)
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim.Value);

            var workspace = await _context.Workspaces.IgnoreQueryFilters()
                .Include(w => w.Members)
                .Include(w => w.Projects).ThenInclude(p => p.MainGoal).ThenInclude(mg => mg.SubGoals).ThenInclude(sg => sg.Tasks)
                .Include(w => w.Projects).ThenInclude(p => p.MainGoal).ThenInclude(mg => mg.Tasks)
                .Include(w => w.Projects).ThenInclude(p => p.Tasks)
                .FirstOrDefaultAsync(w => w.Id == id && w.IsDeleted);

            if (workspace == null) return NotFound();

            if (!workspace.Members.Any(wm => wm.UserId == userId && wm.RolePreset == "Owner"))
                return Forbid();

            _context.Workspaces.Remove(workspace);
            await _context.SaveChangesAsync();
            
            return Ok(new { success = true });
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

    public class CreateWorkspaceDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? TeamGroupId { get; set; }
    }
}

