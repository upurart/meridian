using Microsoft.EntityFrameworkCore;

namespace TaskManagerApp.Models
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<MainGoal> MainGoals { get; set; }
        public DbSet<SubGoal> SubGoals { get; set; }
        public DbSet<TaskItem> TaskItems { get; set; }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Project>().HasQueryFilter(p => !p.IsDeleted);
            modelBuilder.Entity<MainGoal>().HasQueryFilter(m => !m.IsDeleted);
            modelBuilder.Entity<SubGoal>().HasQueryFilter(s => !s.IsDeleted);
            modelBuilder.Entity<TaskItem>().HasQueryFilter(t => !t.IsDeleted);

            modelBuilder.Entity<Project>()
                 .HasOne(p => p.User)
                 .WithMany(u => u.Projects)
                 .HasForeignKey(p => p.UserId)
                 .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MainGoal>()
                 .HasOne(m => m.Project)
                 .WithMany(p => p.MainGoal)
                 .HasForeignKey(m => m.ProjectId)
                 .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SubGoal>()
                 .HasOne(s => s.MainGoal)
                 .WithMany(m => m.SubGoals)
                 .HasForeignKey(s => s.MainGoalId)
                 .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TaskItem>()
                 .HasOne(t => t.SubGoal)
                 .WithMany(s => s.Tasks)
                 .HasForeignKey(t => t.SubGoalId)
                 .OnDelete(DeleteBehavior.Cascade);
        }

        public override int SaveChanges()
        {
            UpdateTimestamps();
            return base.SaveChanges();
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            UpdateTimestamps();
            return base.SaveChangesAsync(cancellationToken);
        }

        private void UpdateTimestamps()
        {
            var entries = ChangeTracker.Entries()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified)
                .ToList();

            var now = DateTime.Now;

            foreach (var entry in entries)
            {
                var entityType = entry.Entity.GetType();

                var createdAtProp = entityType.GetProperty("CreatedAt");
                if (createdAtProp != null && entry.State == EntityState.Added)
                {
                    if (createdAtProp.PropertyType == typeof(DateTime) && (DateTime)createdAtProp.GetValue(entry.Entity)! == default)
                    {
                        createdAtProp.SetValue(entry.Entity, now);
                    }
                }

                var changedAtProp = entityType.GetProperty("ChangedAt");
                if (changedAtProp != null)
                {
                    changedAtProp.SetValue(entry.Entity, now);
                }

                if (entry.Entity is TaskItem task)
                {
                    if (task.IsCompleted && !task.CompletedAt.HasValue)
                    {
                        task.CompletedAt = now;
                    }
                    else if (!task.IsCompleted && task.CompletedAt.HasValue)
                    {
                        task.CompletedAt = null;
                    }
                }
            }

            var projectsToTouch = new HashSet<int>();
            var mainGoalsToTouch = new HashSet<int>();
            var subGoalsToTouch = new HashSet<int>();

            foreach (var entry in entries)
            {
                if (entry.Entity is TaskItem task)
                {
                    var sgId = (task.SubGoalId ?? 0) != 0 ? (task.SubGoalId ?? 0) : (task.SubGoal?.Id ?? 0);
                    if (sgId != 0)
                    {
                        subGoalsToTouch.Add(sgId);
                    }
                    else
                    {
                        var mgId = (task.MainGoalId ?? 0) != 0 ? (task.MainGoalId ?? 0) : (task.MainGoal?.Id ?? 0);
                        if (mgId != 0)
                        {
                            mainGoalsToTouch.Add(mgId);
                        }
                        else
                        {
                            var pId = (task.ProjectId ?? 0) != 0 ? (task.ProjectId ?? 0) : (task.Project?.Id ?? 0);
                            if (pId != 0)
                            {
                                projectsToTouch.Add(pId);
                            }
                        }
                    }
                }
                else if (entry.Entity is SubGoal sg)
                {
                    var mgId = sg.MainGoalId != 0 ? sg.MainGoalId : (sg.MainGoal?.Id ?? 0);
                    if (mgId != 0) mainGoalsToTouch.Add(mgId);
                }
                else if (entry.Entity is MainGoal mg)
                {
                    var pId = mg.ProjectId != 0 ? mg.ProjectId : (mg.Project?.Id ?? 0);
                    if (pId != 0) projectsToTouch.Add(pId);
                }
            }

            if (subGoalsToTouch.Any())
            {
                var subGoals = SubGoals.IgnoreQueryFilters().Where(sg => subGoalsToTouch.Contains(sg.Id)).ToList();
                foreach (var sg in subGoals)
                {
                    sg.ChangedAt = now;
                    Entry(sg).State = EntityState.Modified;

                    var mgId = sg.MainGoalId != 0 ? sg.MainGoalId : (sg.MainGoal?.Id ?? 0);
                    if (mgId != 0) mainGoalsToTouch.Add(mgId);
                }
            }

            if (mainGoalsToTouch.Any())
            {
                var mainGoals = MainGoals.IgnoreQueryFilters().Where(mg => mainGoalsToTouch.Contains(mg.Id)).ToList();
                foreach (var mg in mainGoals)
                {
                    mg.ChangedAt = now;
                    Entry(mg).State = EntityState.Modified;

                    var pId = mg.ProjectId != 0 ? mg.ProjectId : (mg.Project?.Id ?? 0);
                    if (pId != 0) projectsToTouch.Add(pId);
                }
            }

            if (projectsToTouch.Any())
            {
                var projects = Projects.IgnoreQueryFilters().Where(p => projectsToTouch.Contains(p.Id)).ToList();
                foreach (var p in projects)
                {
                    p.ChangedAt = now;
                    Entry(p).State = EntityState.Modified;
                }
            }
        }

    }


}
