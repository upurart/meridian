using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Meridian.Domain.Entities;

public class Department
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int OrganizationId { get; set; }
    [ForeignKey("OrganizationId")]
    public Organization? Organization { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    public string? Description { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    // Navigations
    public ICollection<TeamGroup> Teams { get; set; } = new List<TeamGroup>();
}
