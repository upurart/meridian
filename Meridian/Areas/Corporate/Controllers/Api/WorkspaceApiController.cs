using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Meridian.Models;
using Meridian.Services;

namespace Meridian.Areas.Corporate.Controllers.Api
{
    [Area("Corporate")]
    [Authorize(Policy = "CorporateOnly")]
    [ApiController]
    [Route("api/CorporateWorkspace")]
    public class WorkspaceApiController : BaseApiController
    {
        private readonly IWorkspaceService _workspaceService;

        public WorkspaceApiController(AppDbContext context, IWorkspaceService workspaceService) : base(context)
        {
            _workspaceService = workspaceService;
        }

        [HttpGet]
        public async Task<IActionResult> GetMyWorkspaces()
        {
            if (CurrentUserId == 0) return Unauthorized();
            var result = await _workspaceService.GetMyWorkspacesAsync(CurrentUserId);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetWorkspaceDetails(int id)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var result = await _workspaceService.GetWorkspaceDetailsAsync(CurrentUserId, id);
            if (result == null) return NotFound(new { message = "Çalışma alanı bulunamadı veya erişim yetkiniz yok." });
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateWorkspace([FromBody] CreateWorkspaceDto dto)
        {
            if (CurrentUserId == 0) return Unauthorized();
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Çalışma alanı adı boş olamaz." });

            var user = await _context.Users.FindAsync(CurrentUserId);
            if (user == null) return Unauthorized();

            var result = await _workspaceService.CreateWorkspaceAsync(CurrentUserId, user.OrganizationId, dto);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWorkspace(int id)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var success = await _workspaceService.DeleteWorkspaceAsync(CurrentUserId, id);
            if (!success) return NotFound(new { message = "Çalışma alanı bulunamadı veya silme yetkiniz yok." });
            return Ok(new { success = true });
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedWorkspaces()
        {
            if (CurrentUserId == 0) return Unauthorized();
            var result = await _workspaceService.GetDeletedWorkspacesAsync(CurrentUserId);
            return Ok(result);
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreWorkspace(int id)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var success = await _workspaceService.RestoreWorkspaceAsync(CurrentUserId, id);
            if (!success) return NotFound(new { message = "Silinmiş çalışma alanı bulunamadı." });
            return Ok(new { success = true });
        }

        [HttpDelete("{id}/permanent")]
        public async Task<IActionResult> PermanentlyDeleteWorkspace(int id)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var success = await _workspaceService.PermanentlyDeleteWorkspaceAsync(CurrentUserId, id);
            if (!success) return Forbid();
            return Ok(new { success = true });
        }

        [HttpGet("{id}/members")]
        public async Task<IActionResult> GetWorkspaceMembers(int id)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var result = await _workspaceService.GetWorkspaceMembersAsync(CurrentUserId, id);
            if (result == null) return Forbid();
            return Ok(result);
        }

        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddWorkspaceMember(int id, [FromBody] AddMemberDto dto)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var success = await _workspaceService.AddWorkspaceMemberAsync(CurrentUserId, id, dto);
            if (!success) return BadRequest(new { message = "İşlem başarısız veya yetkisiz." });
            return Ok();
        }

        [HttpDelete("{id}/members/{memberId}")]
        public async Task<IActionResult> RemoveWorkspaceMember(int id, int memberId)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var success = await _workspaceService.RemoveWorkspaceMemberAsync(CurrentUserId, id, memberId);
            if (!success) return BadRequest(new { message = "İşlem başarısız veya yetkisiz." });
            return Ok();
        }

        [HttpPost("{id}/teams")]
        public async Task<IActionResult> AddWorkspaceTeam(int id, [FromBody] AddTeamDto dto)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var success = await _workspaceService.AddWorkspaceTeamAsync(CurrentUserId, id, dto);
            if (!success) return BadRequest(new { message = "İşlem başarısız veya yetkisiz." });
            return Ok();
        }

        [HttpDelete("{id}/teams/{teamId}")]
        public async Task<IActionResult> RemoveWorkspaceTeam(int id, int teamId)
        {
            if (CurrentUserId == 0) return Unauthorized();
            var success = await _workspaceService.RemoveWorkspaceTeamAsync(CurrentUserId, id, teamId);
            if (!success) return BadRequest(new { message = "İşlem başarısız veya yetkisiz." });
            return Ok();
        }
    }
}
