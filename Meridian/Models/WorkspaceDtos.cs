using System.Collections.Generic;

namespace Meridian.Models
{
    public class CreateWorkspaceDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? TeamGroupId { get; set; }
        public List<int>? TeamIds { get; set; }
    }

    public class UpdateWorkspaceDto
    {
        public string Name { get; set; } = string.Empty;
    }

    public class AddMemberDto
    {
        public string Username { get; set; } = string.Empty;
    }

    public class UpdateWorkspaceMemberRoleDto
    {
        public string Role { get; set; } = string.Empty;
    }

    public class AddTeamDto
    {
        public int TeamId { get; set; }
    }
}
