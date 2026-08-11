namespace Meridian.Domain.Entities
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
        public DateTime? LastWorkedAt { get; set; }

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public Guid? DeleteBatchId { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? Deadline { get; set; }
        
        public string? InviteCode { get; set; }
        public string? PasswordHash { get; set; }
        
        public int? TeamGroupId { get; set; }
        public virtual TeamGroup TeamGroup { get; set; } = null!;

        public ICollection<MainGoal> MainGoal { get; set; } = new List<MainGoal>();
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
        public ICollection<ProjectMember> ProjectMembers { get; set; } = new List<ProjectMember>();
        
        public int? WorkspaceId { get; set; }
        public Workspace? Workspace { get; set; }
    }
}
