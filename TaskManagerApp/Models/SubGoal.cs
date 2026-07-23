namespace TaskManagerApp.Models
{
    public class SubGoal
    {
        [Key]
        public int Id { get; set; }


        public int? MainGoalId { get; set; }
        [ForeignKey("MainGoalId")]
        public MainGoal? MainGoal { get; set; }

        public int? ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ChangedAt { get; set; }

        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public Guid? DeleteBatchId { get; set; }

        public ICollection<TaskManagerApp.Models.TaskItem> Tasks { get; set; } = new List<TaskManagerApp.Models.TaskItem>();
    }
}
