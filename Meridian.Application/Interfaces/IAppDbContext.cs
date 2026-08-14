using Microsoft.EntityFrameworkCore;
using Meridian.Domain.Entities;

namespace Meridian.Application.Interfaces
{
    public interface IAppDbContext
    {
        DbSet<User> Users { get; set; }
        DbSet<Project> Projects { get; set; }
        DbSet<MainGoal> MainGoals { get; set; }
        DbSet<SubGoal> SubGoals { get; set; }
        DbSet<TaskItem> TaskItems { get; set; }
        DbSet<ActivityLog> ActivityLogs { get; set; }
        DbSet<CalendarEvent> CalendarEvents { get; set; }
        DbSet<TeamGroup> TeamGroups { get; set; } 
        DbSet<TeamMember> TeamMembers { get; set; }
        DbSet<TeamJoinRequest> TeamJoinRequests { get; set; }
        DbSet<ProjectMember> ProjectMembers { get; set; }
        DbSet<Comment> Comments { get; set; }
        DbSet<CommentAttachment> CommentAttachments { get; set; }
        DbSet<Workspace> Workspaces { get; set; }
        DbSet<WorkspaceMember> WorkspaceMembers { get; set; }
        DbSet<Organization> Organizations { get; set; }
        DbSet<Department> Departments { get; set; }
        DbSet<WorkspaceTeam> WorkspaceTeams { get; set; }
        DbSet<Folder> Folders { get; set; }
        DbSet<FileItem> FileItems { get; set; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
        int SaveChanges();
    }
}
