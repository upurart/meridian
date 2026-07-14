namespace TaskManagerApp.Models
{
    public class SubGoal
    {
        [Key]
        public int Id { get; set; }


        public int MainGoalId { get; set; }
        [ForeignKey("MainGoalId")]
        public MainGoal MainGoal { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public ICollection<TaskManagerApp.Models.TaskItem> Tasks { get; set; } = new List<TaskManagerApp.Models.TaskItem>();
    }
}
