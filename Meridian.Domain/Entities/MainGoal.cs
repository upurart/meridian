namespace Meridian.Domain.Entities
{
    public class MainGoal
    {
        [Key]
        public int Id { get; set; }
        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project Project { get; set; } = null!;

        public int OrganizationId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ChangedAt { get; set; }

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public Guid? DeleteBatchId { get; set; }

        public ICollection<SubGoal> SubGoals { get; set; } 
            = new List<SubGoal>();
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}
