using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagerApp.Models;


namespace TaskManagerApp.Controllers;

[Route("api/teams")]
public class TeamApiController : BaseApiController
{
    public TeamApiController(AppDbContext context) : base(context) { }

    [HttpGet("teams")]
    public async Task<IActionResult> GetMyTeams()
    {
        var teams = await _context.TeamGroups
            .Where(t => t.Members.Any(m => m.UserId == CurrentUserId))
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Description,
                t.CreatedAt,
                MemberCount = t.Members.Count,
                ProjectCount = t.Projects.Count(p => !p.IsDeleted),
                MyRole = t.Members.FirstOrDefault(m => m.UserId == CurrentUserId) != null ? t.Members.FirstOrDefault(m => m.UserId == CurrentUserId).Role : null,
                PendingRequestsCount = t.Members.Any(m => m.UserId == CurrentUserId && (m.Role == "Owner" || m.Role == "Admin")) 
                    ? _context.TeamJoinRequests.Count(r => r.TeamGroupId == t.Id && r.Status == "Pending") 
                    : 0
            })
            .ToListAsync();

        return Ok(teams);
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateTeam([FromBody] CreateTeamRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Takım adı boş olamaz." });

        var team = new TeamGroup
        {
            Name = req.Name,
            Description = req.Description,
            IsOpenToJoin = req.IsOpenToJoin,
            CreatedAt = DateTime.Now,
            Members = new List<TeamMember>()
        };

        team.Members.Add(new TeamMember
        {
            UserId = CurrentUserId,
            Role = "Owner",
            JoinedAt = DateTime.Now
        });

        _context.TeamGroups.Add(team);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, id = team.Id });
    }

    [HttpPost("join")]
    public async Task<IActionResult> JoinTeam([FromBody] JoinTeamRequest req)
    {
        var team = await _context.TeamGroups.Include(t => t.Members).FirstOrDefaultAsync(t => t.Id == req.TeamId);
        if (team == null) return NotFound(new { message = "Takım bulunamadı." });

        if (team.Members.Any(m => m.UserId == CurrentUserId))
        {
            return BadRequest(new { message = "Zaten bu takımın üyesisiniz." });
        }

        if (team.IsOpenToJoin)
        {
            team.Members.Add(new TeamMember
            {
                UserId = CurrentUserId,
                Role = "Member",
                JoinedAt = DateTime.Now
            });
            await _context.SaveChangesAsync();
            return Ok(new { success = true, status = "Joined" });
        }
        else
        {
            var existingReq = await _context.TeamJoinRequests.FirstOrDefaultAsync(r => r.TeamGroupId == req.TeamId && r.UserId == CurrentUserId && r.Status == "Pending");
            if (existingReq != null) return BadRequest(new { message = "Zaten bekleyen bir katılım isteğiniz var." });

            _context.TeamJoinRequests.Add(new TeamJoinRequest
            {
                TeamGroupId = req.TeamId,
                UserId = CurrentUserId,
                Status = "Pending",
                CreatedAt = DateTime.Now
            });
            await _context.SaveChangesAsync();
            return Ok(new { success = true, status = "Requested" });
        }
    }

    // --- MEMBER MANAGEMENT ---

    private async Task<TeamMember> GetMyMemberRecord(int teamId)
    {
        return await _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamGroupId == teamId && m.UserId == CurrentUserId);
    }

    [HttpGet("{teamId}/members")]
    public async Task<IActionResult> GetMembers(int teamId)
    {
        var myRecord = await GetMyMemberRecord(teamId);
        if (myRecord == null) return Forbid();

        var members = await _context.TeamMembers
            .Include(m => m.User)
            .Where(m => m.TeamGroupId == teamId)
            .Select(m => new
            {
                m.UserId,
                m.User.Name,
                m.User.Email,
                m.Role,
                m.JoinedAt
            })
            .ToListAsync();
        
        return Ok(members);
    }

    [HttpPost("{teamId}/members/{userId}/role")]
    public async Task<IActionResult> UpdateRole(int teamId, int userId, [FromBody] UpdateRoleRequest req)
    {
        var myRecord = await GetMyMemberRecord(teamId);
        if (myRecord == null || (myRecord.Role != "Owner" && myRecord.Role != "Admin")) return Forbid();

        var targetMember = await _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamGroupId == teamId && m.UserId == userId);
        if (targetMember == null) return NotFound();

        if (targetMember.Role == "Owner" && myRecord.Role == "Admin") return Forbid(); // Admin cannot edit Owner
        if (targetMember.Role == "Admin" && myRecord.Role == "Admin") return Forbid(); // Admin cannot edit Admin

        if (req.Role == "Owner")
        {
            if (myRecord.Role != "Owner") return Forbid(); // Only owner can transfer ownership
            // Transfer ownership
            myRecord.Role = "Admin";
            targetMember.Role = "Owner";
        }
        else
        {
            if (targetMember.Role == "Owner") return Forbid(); // Cannot change role from owner without transferring
            targetMember.Role = req.Role;
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{teamId}/members/{userId}")]
    public async Task<IActionResult> KickMember(int teamId, int userId)
    {
        var myRecord = await GetMyMemberRecord(teamId);
        if (myRecord == null || (myRecord.Role != "Owner" && myRecord.Role != "Admin")) return Forbid();

        var targetMember = await _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamGroupId == teamId && m.UserId == userId);
        if (targetMember == null) return NotFound();

        if (targetMember.Role == "Owner") return Forbid(); // Cannot kick owner
        if (targetMember.Role == "Admin" && myRecord.Role == "Admin") return Forbid(); // Admin cannot kick Admin

        _context.TeamMembers.Remove(targetMember);
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("{teamId}/requests")]
    public async Task<IActionResult> GetJoinRequests(int teamId)
    {
        var myRecord = await GetMyMemberRecord(teamId);
        if (myRecord == null || (myRecord.Role != "Owner" && myRecord.Role != "Admin")) return Forbid();

        var requests = await _context.TeamJoinRequests
            .Include(r => r.User)
            .Where(r => r.TeamGroupId == teamId && r.Status == "Pending")
            .Select(r => new
            {
                r.Id,
                r.UserId,
                r.User.Name,
                r.User.Email,
                r.CreatedAt
            })
            .ToListAsync();
        
        return Ok(requests);
    }

    [HttpPost("{teamId}/requests/{requestId}/respond")]
    public async Task<IActionResult> RespondToJoinRequest(int teamId, int requestId, [FromBody] RespondRequest req)
    {
        var myRecord = await GetMyMemberRecord(teamId);
        if (myRecord == null || (myRecord.Role != "Owner" && myRecord.Role != "Admin")) return Forbid();

        var joinReq = await _context.TeamJoinRequests.FirstOrDefaultAsync(r => r.Id == requestId && r.TeamGroupId == teamId && r.Status == "Pending");
        if (joinReq == null) return NotFound();

        if (req.Action == "Approve")
        {
            joinReq.Status = "Approved";
            // Check if user is already a member somehow
            if (!await _context.TeamMembers.AnyAsync(m => m.TeamGroupId == teamId && m.UserId == joinReq.UserId))
            {
                _context.TeamMembers.Add(new TeamMember
                {
                    TeamGroupId = teamId,
                    UserId = joinReq.UserId,
                    Role = "Member",
                    JoinedAt = DateTime.Now
                });
            }
        }
        else
        {
            joinReq.Status = "Rejected";
        }

        await _context.SaveChangesAsync();
        return Ok();
    }
}

public class CreateTeamRequest
{
    public string Name { get; set; }
    public string Description { get; set; }
    public bool IsOpenToJoin { get; set; } = true;
}

public class JoinTeamRequest
{
    public int TeamId { get; set; }
}

public class UpdateRoleRequest
{
    public string Role { get; set; }
}

public class RespondRequest
{
    public string Action { get; set; } // Approve or Reject
}