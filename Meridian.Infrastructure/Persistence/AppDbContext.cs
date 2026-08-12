using Microsoft.EntityFrameworkCore;
using Meridian.Domain.Entities;

using Meridian.Application.Interfaces;

namespace Meridian.Infrastructure.Persistence
{
    public partial class AppDbContext : DbContext, IAppDbContext
    {
        private readonly Microsoft.AspNetCore.Http.IHttpContextAccessor? _httpContextAccessor;

        public AppDbContext(DbContextOptions<AppDbContext> options, Microsoft.AspNetCore.Http.IHttpContextAccessor? httpContextAccessor = null) : base(options) 
        { 
            _httpContextAccessor = httpContextAccessor;
        }

        private int CurrentOrganizationId
        {
            get
            {
                var claim = _httpContextAccessor?.HttpContext?.User?.FindFirst("OrganizationId")?.Value;
                return claim != null ? int.Parse(claim) : 0;
            }
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
        public DbSet<ProjectGuest> ProjectGuests { get; set; }
        public DbSet<WorkspaceGuest> WorkspaceGuests { get; set; }
        
        // Matrix & Organization Additions
        public DbSet<Organization> Organizations { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<WorkspaceTeam> WorkspaceTeams { get; set; }
        
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Project>().HasQueryFilter(p => !p.IsDeleted && p.OrganizationId == CurrentOrganizationId).HasIndex(p => p.IsDeleted);
            modelBuilder.Entity<MainGoal>().HasQueryFilter(m => !m.IsDeleted && m.OrganizationId == CurrentOrganizationId).HasIndex(m => m.IsDeleted);
            modelBuilder.Entity<SubGoal>().HasQueryFilter(s => !s.IsDeleted && s.OrganizationId == CurrentOrganizationId).HasIndex(s => s.IsDeleted);
            modelBuilder.Entity<TaskItem>().HasQueryFilter(t => !t.IsDeleted && t.OrganizationId == CurrentOrganizationId).HasIndex(t => t.IsDeleted);
            modelBuilder.Entity<Workspace>().HasQueryFilter(w => !w.IsDeleted && w.OrganizationId == CurrentOrganizationId).HasIndex(w => w.IsDeleted);
            modelBuilder.Entity<TeamGroup>().HasQueryFilter(t => t.OrganizationId == CurrentOrganizationId);
            
            // Composite key for WorkspaceTeam matrix
            modelBuilder.Entity<WorkspaceTeam>()
                .HasKey(wt => new { wt.WorkspaceId, wt.TeamGroupId });
                
            modelBuilder.Entity<WorkspaceTeam>()
                .HasOne(wt => wt.Workspace)
                .WithMany(w => w.WorkspaceTeams)
                .HasForeignKey(wt => wt.WorkspaceId)
                .OnDelete(DeleteBehavior.Restrict);
                
            modelBuilder.Entity<WorkspaceTeam>().HasQueryFilter(wt => !wt.Workspace!.IsDeleted && wt.Workspace.OrganizationId == CurrentOrganizationId);
            
            modelBuilder.Entity<ProjectMember>().HasQueryFilter(pm => !pm.Project.IsDeleted && pm.Project.OrganizationId == CurrentOrganizationId);
            modelBuilder.Entity<WorkspaceMember>().HasQueryFilter(wm => !wm.Workspace.IsDeleted && wm.Workspace.OrganizationId == CurrentOrganizationId);
            
            modelBuilder.Entity<ProjectGuest>().HasQueryFilter(pg => !pg.Project.IsDeleted && pg.Project.OrganizationId == CurrentOrganizationId);
            modelBuilder.Entity<WorkspaceGuest>().HasQueryFilter(wg => !wg.Workspace.IsDeleted && wg.Workspace.OrganizationId == CurrentOrganizationId);
            
            modelBuilder.Entity<TeamMember>().HasQueryFilter(tm => tm.TeamGroup.OrganizationId == CurrentOrganizationId);
            modelBuilder.Entity<TeamJoinRequest>().HasQueryFilter(tjr => tjr.TeamGroup.OrganizationId == CurrentOrganizationId);

            modelBuilder.Entity<Project>()
                 .HasOne(p => p.User)
                 .WithMany(u => u.Projects)
                 .HasForeignKey(p => p.UserId)
                 .OnDelete(DeleteBehavior.Restrict);

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
                
            modelBuilder.Entity<TeamJoinRequest>()
                .HasOne(tjr => tjr.User)
                .WithMany()
                .HasForeignKey(tjr => tjr.UserId)
                .OnDelete(DeleteBehavior.Restrict);
                
            modelBuilder.Entity<TeamMember>()
                .HasOne(tm => tm.User)
                .WithMany()
                .HasForeignKey(tm => tm.UserId)
                .OnDelete(DeleteBehavior.Restrict);
                
            modelBuilder.Entity<WorkspaceMember>()
                .HasOne(wm => wm.User)
                .WithMany()
                .HasForeignKey(wm => wm.UserId)
                .OnDelete(DeleteBehavior.Restrict);
                
            modelBuilder.Entity<ProjectMember>()
                .HasOne(pm => pm.User)
                .WithMany()
                .HasForeignKey(pm => pm.UserId)
                .OnDelete(DeleteBehavior.Restrict);
                
            modelBuilder.Entity<Workspace>()
                .HasOne(w => w.Owner)
                .WithMany()
                .HasForeignKey(w => w.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
                
            // (Redundant block removed)
            
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

            // Misafir (Guest) İlişkileri (Kaskad silme döngülerini önlemek için Restrict)
            modelBuilder.Entity<ProjectGuest>()
                .HasOne(pg => pg.InvitedByUser)
                .WithMany()
                .HasForeignKey(pg => pg.InvitedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ProjectGuest>()
                .HasOne(pg => pg.User)
                .WithMany()
                .HasForeignKey(pg => pg.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<WorkspaceGuest>()
                .HasOne(wg => wg.InvitedByUser)
                .WithMany()
                .HasForeignKey(wg => wg.InvitedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<WorkspaceGuest>()
                .HasOne(wg => wg.User)
                .WithMany()
                .HasForeignKey(wg => wg.UserId)
                .OnDelete(DeleteBehavior.Restrict);
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
