namespace Meridian.Models
{
    public class SubGoal
    {
        [Key]
        public int Id { get; set; }


        [Required]
        public int MainGoalId { get; set; }
        [ForeignKey("MainGoalId")]
        public MainGoal? MainGoal { get; set; }

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

        public ICollection<Meridian.Models.TaskItem> Tasks { get; set; } = new List<Meridian.Models.TaskItem>();
    }
}
