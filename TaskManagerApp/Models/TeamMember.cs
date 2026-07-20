namespace TaskManagerApp.Models;

public class TeamMember
{
    public int Id { get; set; }
    
    public int TeamGroupId { get; set; }
    public TeamGroup TeamGroup { get; set; }
    
    public int UserID { get; set; }
    
    public string Role { get; set; }
    
    public DateTime JoinedAt { get; set; } = DateTime.Now;
    
}