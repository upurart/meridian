namespace Meridian.Models;

public class TeamGroup
{
    public int Id { get; set; }
    
    public string Name { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } =  DateTime.Now;
    
    public bool IsOpenToJoin { get; set; } = true;
    
    public string? InviteCode { get; set; }
    
    public string? PasswordHash { get; set; }
    
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
    
    public ICollection<Project> Projects { get; set; } = new List<Project>();
    
}
