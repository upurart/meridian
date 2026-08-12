using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Meridian.Domain.Entities;

public class ProjectGuest
{
    [Key]
    public int Id { get; set; }

    public int ProjectId { get; set; }
    [ForeignKey("ProjectId")]
    public virtual Project Project { get; set; } = null!;

    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "Viewer"; // Viewer, Editor vb.

    [Required]
    [MaxLength(100)]
    public string InviteToken { get; set; } = Guid.NewGuid().ToString();

    public bool IsAccepted { get; set; } = false;

    // Daveti kabul edip sisteme kayıt olan kullanıcının ID'si (opsiyonel)
    public int? UserId { get; set; }
    [ForeignKey("UserId")]
    public virtual User? User { get; set; }

    // Daveti gönderen kullanıcı
    public int InvitedByUserId { get; set; }
    [ForeignKey("InvitedByUserId")]
    public virtual User InvitedByUser { get; set; } = null!;

    public DateTime InvitedAt { get; set; } = DateTime.Now;
    public DateTime? AcceptedAt { get; set; }
}
