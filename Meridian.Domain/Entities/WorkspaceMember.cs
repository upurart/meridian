namespace Meridian.Domain.Entities;

public class WorkspaceMember
{
    public int Id { get; set; }
    
    public int WorkspaceId { get; set; }
    public Workspace? Workspace { get; set; }
    
    public int  UserId { get; set; }
    public User? User { get; set; }

    [MaxLength(50)] public string RolePreset { get; set; } = "Member";

    public List<string> Permissions { get; set; } = new List<string>();
    
    public DateTime JoinedAt { get; set; }
    public bool IsActive { get; set; }
}
