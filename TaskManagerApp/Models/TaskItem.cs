namespace TaskManagerApp.Models
{
    public class TaskItem
    {
        [Key]
        public int Id { get; set; }

        
        public int SubGoalId { get; set; }
        [ForeignKey("SubGoalId")]
        public SubGoal SubGoal { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
