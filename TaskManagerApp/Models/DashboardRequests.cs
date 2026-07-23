namespace TaskManagerApp.Models;



    public class ProjectUpsertRequest
    {
        public int? TeamGroupId { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;
    }

    public class MainGoalUpsertRequest
    {
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
    }

    public class SubGoalUpsertRequest
    {
        public int? MainGoalId { get; set; }
        public int? ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
    }

    public class TaskUpsertRequest
    {
        public int? SubGoalId { get; set; }
        public int? MainGoalId { get; set; }
        public int? ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
    }

