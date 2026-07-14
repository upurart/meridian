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

    }


}
