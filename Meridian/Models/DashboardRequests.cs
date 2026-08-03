namespace Meridian.Models;



    public class ProjectUpsertRequest
    {
        public int? TeamGroupId { get; set; }
        public int? WorkspaceId { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; } = string.Empty;

        public DateTime? Deadline { get; set; }

        public int? InitialMainGoalCount { get; set; }
        public int? InitialSubGoalCountPerMain { get; set; }
        public int? InitialTaskCountPerSub { get; set; }
        public int? InitialTaskCountPerMain { get; set; }
        public int? InitialTaskCountPerProject { get; set; }

        public List<InitialGoalSlot>? InitialGoals { get; set; }
        public List<InitialTaskSlot>? InitialTasks { get; set; }
    }

    public class InitialGoalSlot
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; } = string.Empty;
        public List<InitialSubGoalSlot>? SubGoals { get; set; }
        public List<InitialTaskSlot>? Tasks { get; set; }
    }

    public class InitialSubGoalSlot
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; } = string.Empty;
        public List<InitialTaskSlot>? Tasks { get; set; }
    }

    public class InitialTaskSlot
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; } = string.Empty;
    }

    public class MainGoalUpsertRequest
    {
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
    }

    public class SubGoalUpsertRequest
    {
        public int? MainGoalId { get; set; }
        public int? ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; } = string.Empty;

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

        [MaxLength(1000)]
        public string? Description { get; set; } = string.Empty;

        public bool IsCompleted { get; set; }
        
        public string? RowVersion { get; set; }
    }

