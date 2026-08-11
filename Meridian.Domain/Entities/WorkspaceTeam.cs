using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Meridian.Domain.Entities;

public class WorkspaceTeam
{
    [Required]
    public int WorkspaceId { get; set; }
    [ForeignKey("WorkspaceId")]
    public Workspace? Workspace { get; set; }
    
    [Required]
    public int TeamGroupId { get; set; }
    [ForeignKey("TeamGroupId")]
    public TeamGroup? TeamGroup { get; set; }
    
    [MaxLength(50)]
    public string RolePreset { get; set; } = "Editor";
}
