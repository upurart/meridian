namespace TaskManagerApp.Models;

public class TeamJoinRequest
{
    public int Id { get; set; }
    
    public int TeamGroupId { get; set; }
    public TeamGroup TeamGroup { get; set; }
    
    public int UserId { get; set; }
    public User User { get; set; }
    
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
    
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
