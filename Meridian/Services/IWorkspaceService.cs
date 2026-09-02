using Meridian.Models;

namespace Meridian.Services
{
    public interface IWorkspaceService
    {
        Task<object> GetMyWorkspacesAsync(int userId);
        Task<object?> GetWorkspaceDetailsAsync(int userId, int id);
        Task<object> CreateWorkspaceAsync(int userId, int organizationId, CreateWorkspaceDto dto);
        Task<bool> UpdateWorkspaceAsync(int userId, int id, UpdateWorkspaceDto dto);
        Task<bool> DeleteWorkspaceAsync(int userId, int id);
        Task<object> GetDeletedWorkspacesAsync(int userId);
        Task<bool> RestoreWorkspaceAsync(int userId, int id);
        Task<bool> PermanentlyDeleteWorkspaceAsync(int userId, int id);
        Task<object?> GetWorkspaceMembersAsync(int userId, int id);
        Task<bool> AddWorkspaceMemberAsync(int userId, int id, AddMemberDto dto);
        Task<bool> UpdateWorkspaceMemberRoleAsync(int userId, int id, int memberId, string newRole);
        Task<bool> RemoveWorkspaceMemberAsync(int userId, int id, int memberId);
        Task<bool> AddWorkspaceTeamAsync(int userId, int id, AddTeamDto dto);
        Task<bool> RemoveWorkspaceTeamAsync(int userId, int id, int teamId);
    }
}
