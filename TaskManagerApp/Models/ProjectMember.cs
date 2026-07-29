using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskManagerApp.Models
{
    public class ProjectMember
    {
        [Key]
        public int Id { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project Project { get; set; } = null!;

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [Required]
        public string Role { get; set; } = "Participant"; // "Manager", "Participant", "Observer"
        
        public DateTime AddedAt { get; set; } = DateTime.Now;
    }
}
