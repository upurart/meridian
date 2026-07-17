namespace TaskManagerApp.Models
{
    public class TrashViewModel
    {
        public List<Project> DeletedProjects { get; set; }
        public List<MainGoal> DeletedMainGoals { get; set; }
        public List<SubGoal> DeletedSubGoals { get; set; }
        public List<TaskItem> DeletedTasks { get; set; }
    }
}
