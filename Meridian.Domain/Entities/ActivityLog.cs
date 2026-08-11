namespace Meridian.Domain.Entities;

public class ActivityLog
{
    [Key]
    public int Id { get; set; }
    
    public int ProjectId { get; set; }
    
    public int UserID { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string ActionType { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string EntityType { get; set; } = string.Empty;
    
    public int EntityId { get; set; }
    
    [Required]
    [MaxLength(250)]
    public string Details { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    
}
