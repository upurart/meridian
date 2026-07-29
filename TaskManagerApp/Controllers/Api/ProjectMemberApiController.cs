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

        [HttpGet("{projectId}")]
        public async Task<IActionResult> GetProjectMembers(int projectId)
        {
            if (!await IsAuthorizedForProjectAsync(projectId)) return Forbid();

            var project = await _context.Projects.Include(p => p.User).FirstOrDefaultAsync(p => p.Id == projectId);
            if (project == null) return NotFound("Proje bulunamadı.");

            var members = await _context.ProjectMembers
                .Where(pm => pm.ProjectId == projectId)
                .Include(pm => pm.User)
                .Select(pm => new
                {
                    Id = pm.Id,
                    ProjectId = pm.ProjectId,
                    UserId = pm.UserId,
                    Role = pm.Role,
                    AddedAt = pm.AddedAt,
                    IsCurrentUser = pm.UserId == CurrentUserId,
                    User = new
                    {
                        pm.User.Id,
                        pm.User.Name,
                        pm.User.Surname,
                        pm.User.Email,
                        pm.User.Username
                    }
                })
                .ToListAsync();

            var ownerMember = new
            {
                Id = 0,
                ProjectId = project.Id,
                UserId = project.UserId,
                Role = "Owner",
                AddedAt = project.CreatedAt,
                IsCurrentUser = project.UserId == CurrentUserId,
                User = new
                {
                    project.User.Id,
                    project.User.Name,
                    project.User.Surname,
                    project.User.Email,
                    project.User.Username
                }
            };

            var allMembers = new List<object> { ownerMember };
            allMembers.AddRange(members);

            return Ok(allMembers);
        }

        [HttpGet("{projectId}/Settings")]
        public async Task<IActionResult> GetProjectSettings(int projectId)
        {
            if (!await HasManageAccessAsync(projectId)) return Forbid();

            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return NotFound("Proje bulunamadı.");

            return Ok(new { inviteCode = project.InviteCode, hasPassword = !string.IsNullOrEmpty(project.PasswordHash) });
        }

        [HttpPost("{projectId}/GenerateInviteCode")]
        public async Task<IActionResult> GenerateInviteCode(int projectId)
        {
            if (!await HasManageAccessAsync(projectId)) return Forbid();

            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return NotFound("Proje bulunamadı.");

            project.InviteCode = Guid.NewGuid().ToString("N").Substring(0, 10).ToUpper();
            await _context.SaveChangesAsync();

            return Ok(new { inviteCode = project.InviteCode });
        }

        public class SetPasswordDto { public string Password { get; set; } = string.Empty; }

        [HttpPost("{projectId}/SetPassword")]
        public async Task<IActionResult> SetPassword(int projectId, [FromBody] SetPasswordDto dto)
        {
            if (!await HasManageAccessAsync(projectId)) return Forbid();

            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return NotFound("Proje bulunamadı.");

            if (string.IsNullOrEmpty(dto.Password))
            {
                project.PasswordHash = null;
            }
            else
            {
                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Project>();
                project.PasswordHash = hasher.HashPassword(project, dto.Password);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Şifre güncellendi." });
        }

        public class JoinProjectDto
        {
            public string InviteCode { get; set; } = string.Empty;
            public string? Password { get; set; }
        }

        [HttpGet("CheckInviteCode")]
        public async Task<IActionResult> CheckInviteCode([FromQuery] string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return BadRequest("Davet kodu gereklidir.");

            var project = await _context.Projects.Include(p => p.ProjectMembers).FirstOrDefaultAsync(p => p.InviteCode == code && !p.IsDeleted);
            if (project == null) return NotFound(new { message = "Geçersiz davet kodu." });

            bool isMember = project.UserId == CurrentUserId || project.ProjectMembers.Any(pm => pm.UserId == CurrentUserId);
            bool hasPassword = !string.IsNullOrEmpty(project.PasswordHash);
            
            return Ok(new { valid = true, hasPassword = hasPassword, isMember = isMember });
        }

        [HttpPost("Join")]
        public async Task<IActionResult> JoinProject([FromBody] JoinProjectDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.InviteCode)) return BadRequest("Davet kodu gereklidir.");

            var project = await _context.Projects.Include(p => p.ProjectMembers).FirstOrDefaultAsync(p => p.InviteCode == dto.InviteCode && !p.IsDeleted);
            if (project == null) return NotFound(new { message = "Geçersiz davet kodu veya proje bulunamadı." });

            if (project.UserId == CurrentUserId || project.ProjectMembers.Any(pm => pm.UserId == CurrentUserId))
            {
                return BadRequest(new { message = "Zaten bu projenin üyesisiniz." });
            }

            if (!string.IsNullOrEmpty(project.PasswordHash))
            {
                if (string.IsNullOrEmpty(dto.Password))
                {
                    return BadRequest(new { message = "Bu proje parola ile korunmaktadır. Lütfen parola girin." });
                }
                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Project>();
                var result = hasher.VerifyHashedPassword(project, project.PasswordHash, dto.Password);
                if (result != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success)
                {
                    return BadRequest(new { message = "Hatalı parola." });
                }
            }

            var member = new ProjectMember
            {
                ProjectId = project.Id,
                UserId = CurrentUserId,
                Role = "Participant"
            };

            _context.ProjectMembers.Add(member);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Projeye başarıyla katıldınız.", projectId = project.Id });
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
