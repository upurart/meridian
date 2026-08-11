using Microsoft.EntityFrameworkCore;

namespace Meridian.Models
{
    public partial class AppDbContext : DbContext
    {
        private readonly Microsoft.AspNetCore.Http.IHttpContextAccessor? _httpContextAccessor;

        public AppDbContext(DbContextOptions<AppDbContext> options, Microsoft.AspNetCore.Http.IHttpContextAccessor? httpContextAccessor = null) : base(options) 
        { 
            _httpContextAccessor = httpContextAccessor;
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<MainGoal> MainGoals { get; set; }
        public DbSet<SubGoal> SubGoals { get; set; }
        public DbSet<TaskItem> TaskItems { get; set; }
        public DbSet<ActivityLog> ActivityLogs { get; set; }
        public DbSet<CalendarEvent> CalendarEvents { get; set; }
        public DbSet<TeamGroup> TeamGroups { get; set; } 
        public DbSet<TeamMember> TeamMembers { get; set; }
        public DbSet<TeamJoinRequest> TeamJoinRequests { get; set; }
        public DbSet<ProjectMember> ProjectMembers { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<CommentAttachment> CommentAttachments { get; set; }
        public DbSet<Workspace> Workspaces { get; set; }
        public DbSet<WorkspaceMember> WorkspaceMembers { get; set; }
        
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Project>().HasQueryFilter(p => !p.IsDeleted).HasIndex(p => p.IsDeleted);
            modelBuilder.Entity<MainGoal>().HasQueryFilter(m => !m.IsDeleted).HasIndex(m => m.IsDeleted);
            modelBuilder.Entity<SubGoal>().HasQueryFilter(s => !s.IsDeleted).HasIndex(s => s.IsDeleted);
            modelBuilder.Entity<TaskItem>().HasQueryFilter(t => !t.IsDeleted).HasIndex(t => t.IsDeleted);
            modelBuilder.Entity<Workspace>().HasQueryFilter(w => !w.IsDeleted).HasIndex(w => w.IsDeleted);
            
            modelBuilder.Entity<ProjectMember>().HasQueryFilter(pm => !pm.Project.IsDeleted);
            modelBuilder.Entity<WorkspaceMember>().HasQueryFilter(wm => !wm.Workspace.IsDeleted);

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
            
            modelBuilder.Entity<ActivityLog>()
                .HasOne<Project>()
                .WithMany()
                .HasForeignKey(a => a.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            
            modelBuilder.Entity<TeamMember>()
                .HasOne(tm => tm.TeamGroup)
                .WithMany(tg => tg.Members)
                .HasForeignKey(tm => tm.TeamGroupId)
                .OnDelete(DeleteBehavior.Cascade);
            
            modelBuilder.Entity<Project>()
                .HasOne(p => p.TeamGroup)
                .WithMany(tg => tg.Projects)
                .HasForeignKey(p => p.TeamGroupId)
                .OnDelete(DeleteBehavior.Cascade);
                
            modelBuilder.Entity<ProjectMember>()
                .HasOne(pm => pm.Project)
                .WithMany(p => p.ProjectMembers)
                .HasForeignKey(pm => pm.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
                
            modelBuilder.Entity<ProjectMember>()
                .HasOne(pm => pm.User)
                .WithMany()
                .HasForeignKey(pm => pm.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            
            modelBuilder.Entity<WorkspaceMember>()
                .HasIndex(wm => new { wm.WorkspaceId, wm.UserId })
                .IsUnique();

            // Workspace -> WorkspaceMember İlişkisi
            modelBuilder.Entity<WorkspaceMember>()
                .HasOne(wm => wm.Workspace)
                .WithMany(w => w.Members)
                .HasForeignKey(wm => wm.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);

            // User -> WorkspaceMember İlişkisi
            modelBuilder.Entity<WorkspaceMember>()
                .HasOne(wm => wm.User)
                .WithMany()
                .HasForeignKey(wm => wm.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Project -> Workspace İlişkisi
            modelBuilder.Entity<Project>()
                .HasOne(p => p.Workspace)
                .WithMany(w => w.Projects)
                .HasForeignKey(p => p.WorkspaceId)
                .OnDelete(DeleteBehavior.NoAction);
        }

        public override int SaveChanges()
        {
            UpdateTimestamps();
            var logsToSave = PreLogActivities();
            var result = base.SaveChanges();
            PostLogActivities(logsToSave);
            return result;
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            UpdateTimestamps();
            var logsToSave = PreLogActivities();
            var result = await base.SaveChangesAsync(cancellationToken);
            await PostLogActivitiesAsync(logsToSave);
            return result;
        }



    }


}
