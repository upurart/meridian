using System.ComponentModel.DataAnnotations;

namespace Meridian.Models;

public class Organization
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    // Navigations
    public ICollection<Department> Departments { get; set; } = new List<Department>();
    public ICollection<TeamGroup> Teams { get; set; } = new List<TeamGroup>();
    public ICollection<Workspace> Workspaces { get; set; } = new List<Workspace>();
    public ICollection<User> Users { get; set; } = new List<User>();
}
