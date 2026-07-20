namespace TaskManagerApp.Models;

public class TeamGroup
{
    public int Id { get; set; }
    
    public string Name { get; set; }
    
    public string Description { get; set; }
    
    public DateTime CreatedAt { get; set; } =  DateTime.Now;
    
    public ICollection<TeamMember> Members { get; set; }
    
    public ICollection<Project> Projects { get; set; }
    
}