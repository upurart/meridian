namespace TaskManagerApp.Models
{
    public class Project
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ChangedAt { get; set; }

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public Guid? DeleteBatchId { get; set; }
        public DateTime? Deadline { get; set; }
        
        public string? InviteCode { get; set; }
        public string? PasswordHash { get; set; }
        
        public int? TeamGroupId { get; set; }
        public TeamGroup TeamGroup { get; set; }

        public ICollection<MainGoal> MainGoal { get; set; } = new List<MainGoal>();
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
        public ICollection<ProjectMember> ProjectMembers { get; set; } = new List<ProjectMember>();
    }
}
