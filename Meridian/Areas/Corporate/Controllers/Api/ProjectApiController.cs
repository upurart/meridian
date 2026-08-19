using Microsoft.AspNetCore.Mvc;
using Meridian.Models;
using Meridian.Services;

namespace Meridian.Controllers
{
    [Route("api/dashboard")]
    public class ProjectApiController : BaseApiController
    {
        private readonly IProjectService _projectService;

        public ProjectApiController(AppDbContext context, IProjectService projectService) : base(context) 
        {
            _projectService = projectService;
        }

        [HttpGet("tree")]
        public async Task<IActionResult> GetTree()
        {
            var result = await _projectService.GetTreeAsync(CurrentUserId);
            return Ok(result);
        }

        [HttpGet("recent-projects")]
        public async Task<IActionResult> GetRecentProjects()
        {
            var result = await _projectService.GetRecentProjectsAsync(CurrentUserId);
            return Ok(result);
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchProjects([FromQuery] string q, [FromQuery] string filter = "all")
        {
            var result = await _projectService.SearchProjectsAsync(CurrentUserId, q, filter);
            return Ok(result);
        }

        [HttpGet("project/{id}")]
        public async Task<IActionResult> GetProjectDetails(int id)
        {
            var result = await _projectService.GetProjectDetailsAsync(CurrentUserId, id);
            if (result == null) return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });
            return Ok(result);
        }

        [HttpPost("project")]
        public async Task<IActionResult> CreateProject([FromBody] ProjectUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var result = await _projectService.CreateProjectAsync(CurrentUserId, req);
            if (!result.Success) return Forbid();

            return Ok(new { success = true, id = result.ProjectId });
        }

        [HttpPut("project/{id}")]
        public async Task<IActionResult> UpdateProject(int id, [FromBody] ProjectUpsertRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var success = await _projectService.UpdateProjectAsync(CurrentUserId, id, req);
            if (!success) return BadRequest(new { message = "Proje bulunamadı veya yetkiniz yok." });

            return Ok(new { success = true });
        }

        [HttpDelete("project/{id}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var success = await _projectService.DeleteProjectAsync(CurrentUserId, id);
            if (!success) return NotFound();
            return Ok(new { success = true });
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedProjects()
        {
            var result = await _projectService.GetDeletedProjectsAsync(CurrentUserId);
            return Ok(result);
        }

        [HttpPost("project/{id}/restore")]
        public async Task<IActionResult> RestoreProject(int id)
        {
            var success = await _projectService.RestoreProjectAsync(CurrentUserId, id);
            if (!success) return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });
            return Ok(new { success = true });
        }

        [HttpPost("project/bulk-restore")]
        public async Task<IActionResult> BulkRestoreProjects([FromBody] List<int> ids)
        {
            if (ids == null || !ids.Any()) return BadRequest(new { message = "Kimlik bilgisi gönderilmedi." });
            
            var success = await _projectService.BulkRestoreProjectsAsync(CurrentUserId, ids);
            return Ok(new { success = true });
        }

        [HttpPost("project/restore-all")]
        public async Task<IActionResult> RestoreAllProjects()
        {
            var success = await _projectService.RestoreAllProjectsAsync(CurrentUserId);
            return Ok(new { success = true });
        }

        [HttpPost("project/bulk-permanent")]
        public async Task<IActionResult> BulkPermanentlyDeleteProjects([FromBody] List<int> ids)
        {
            if (ids == null || !ids.Any()) return BadRequest(new { message = "Kimlik bilgisi gönderilmedi." });
            
            var success = await _projectService.BulkPermanentlyDeleteProjectsAsync(CurrentUserId, ids);
            return Ok(new { success = true });
        }

        [HttpPost("project/permanent-all")]
        public async Task<IActionResult> PermanentAllProjects()
        {
            var success = await _projectService.PermanentAllProjectsAsync(CurrentUserId);
            return Ok(new { success = true });
        }

        [HttpDelete("project/{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteProject(int id)
        {
            var success = await _projectService.PermanentlyDeleteProjectAsync(CurrentUserId, id);
            if (!success) return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });
            
            return Ok(new { success = true });
        }

        [HttpGet("project/{id}/deleted-items")]
        public async Task<IActionResult> GetDeletedProjectItems(int id)
        {
            var result = await _projectService.GetDeletedProjectItemsAsync(CurrentUserId, id);
            if (result == null) return NotFound(new { message = "Proje bulunamadı veya yetkiniz yok." });
            
            return Ok(result);
        }
    }
}


