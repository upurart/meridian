namespace Meridian.Domain.Entities;

public class TeamMember
{
    public int Id { get; set; }
    
    public int TeamGroupId { get; set; }
    public virtual TeamGroup? TeamGroup { get; set; }
    
    public int UserId { get; set; }
    public virtual User? User { get; set; }
    
    public string Role { get; set; } = "Member";
    
    public DateTime JoinedAt { get; set; } = DateTime.Now;
    
}
