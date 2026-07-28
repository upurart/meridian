using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers.Api
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectMemberApiController : BaseApiController
    {
        public ProjectMemberApiController(AppDbContext context) : base(context)
        {
        }

        private async Task<bool> HasManageAccessAsync(int projectId)
        {
            var project = await _context.Projects
                .Include(p => p.TeamGroup).ThenInclude(tg => tg.Members)
                .Include(p => p.ProjectMembers)
                .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);

            if (project == null) return false;

            bool isOwner = project.UserId == CurrentUserId;
            bool isTeamManager = project.TeamGroup != null && project.TeamGroup.Members.Any(m => m.UserId == CurrentUserId && m.Role == "Manager");
            bool isProjectManager = project.ProjectMembers.Any(pm => pm.UserId == CurrentUserId && pm.Role == "Manager");
            
            return isOwner || isTeamManager || isProjectManager;
        }

        // GET: api/ProjectMemberApi/5
        [HttpGet("{projectId}")]
        public async Task<IActionResult> GetProjectMembers(int projectId)
        {
            if (!await IsAuthorizedForProjectAsync(projectId)) return Forbid();

            var members = await _context.ProjectMembers
                .Where(pm => pm.ProjectId == projectId)
                .Include(pm => pm.User)
                .Select(pm => new
                {
                    pm.Id,
                    pm.ProjectId,
                    pm.UserId,
                    pm.Role,
                    pm.AddedAt,
                    User = new
                    {
                        pm.User.Id,
                        pm.User.Name,
                        pm.User.Surname,
                        pm.User.Email
                    }
                })
                .ToListAsync();

            return Ok(members);
        }

        public class AddMemberDto
        {
            public int ProjectId { get; set; }
            public string Email { get; set; } = string.Empty;
            public string Role { get; set; } = "Participant";
        }

        // POST: api/ProjectMemberApi/Add
        [HttpPost("Add")]
        public async Task<IActionResult> AddMember([FromBody] AddMemberDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email)) return BadRequest("Email adresi gereklidir.");
            
            if (!await HasManageAccessAsync(dto.ProjectId)) return Forbid();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null) return NotFound("Proje bulunamadı.");

            var existingMember = await _context.ProjectMembers
                .FirstOrDefaultAsync(pm => pm.ProjectId == dto.ProjectId && pm.UserId == user.Id);
                
            if (existingMember != null) return BadRequest("Bu kullanıcı zaten bu projede yer alıyor.");

            if (project.UserId == user.Id) return BadRequest("Proje sahibi zaten tüm yetkilere sahiptir.");

            var member = new ProjectMember
            {
                ProjectId = dto.ProjectId,
                UserId = user.Id,
                Role = dto.Role
            };

            _context.ProjectMembers.Add(member);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Kullanıcı başarıyla eklendi." });
        }

        // DELETE: api/ProjectMemberApi/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> RemoveMember(int id)
        {
            var member = await _context.ProjectMembers.FindAsync(id);
            if (member == null) return NotFound("Üye bulunamadı.");

            if (!await HasManageAccessAsync(member.ProjectId)) return Forbid();

            _context.ProjectMembers.Remove(member);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Kullanıcı projeden çıkarıldı." });
        }
        
        public class UpdateRoleDto
        {
            public string Role { get; set; } = string.Empty;
        }

        // PUT: api/ProjectMemberApi/5/Role
        [HttpPut("{id}/Role")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateRoleDto dto)
        {
            var member = await _context.ProjectMembers.FindAsync(id);
            if (member == null) return NotFound("Üye bulunamadı.");

            if (!await HasManageAccessAsync(member.ProjectId)) return Forbid();

            member.Role = dto.Role;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Kullanıcı rolü güncellendi." });
        }
    }
}
