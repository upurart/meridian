namespace Meridian.Domain.Entities;    

public class Workspace
{
    public int Id { get; set; }
    
    [Required]
    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string Slug  { get; set; } = string.Empty;
    
    public string? Description { get; set; }
    
    public int OwnerId { get; set; }
    public virtual User? Owner { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; } = true;
    
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public Guid? DeleteBatchId { get; set; }
    
    // Eski ilişki (Geriye dönük uyumluluk için, şimdilik kalacak)
    public int? TeamGroupId { get; set; }
    public virtual TeamGroup? TeamGroup { get; set; }
    
    public virtual ICollection<WorkspaceMember> Members { get; set; } = new List<WorkspaceMember>();
    
    public virtual ICollection<WorkspaceTeam> WorkspaceTeams { get; set; } = new List<WorkspaceTeam>();
    
    public virtual ICollection<Project> Projects { get; set; } = new List<Project>();
}
