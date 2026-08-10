using Meridian.Models;

namespace Meridian.Services
{
    public interface IProjectService
    {
        Task<object> GetTreeAsync(int currentUserId);
        Task<object> GetRecentProjectsAsync(int currentUserId);
        Task<object> SearchProjectsAsync(int currentUserId, string q, string filter = "all");
        Task<object?> GetProjectDetailsAsync(int currentUserId, int id);
        Task<(bool Success, int? ProjectId)> CreateProjectAsync(int currentUserId, ProjectUpsertRequest req);
        Task<bool> UpdateProjectAsync(int currentUserId, int id, ProjectUpsertRequest req);
        Task<bool> DeleteProjectAsync(int currentUserId, int id);
        Task<IEnumerable<object>> GetDeletedProjectsAsync(int currentUserId);
        Task<bool> RestoreProjectAsync(int currentUserId, int id);
        Task<bool> BulkRestoreProjectsAsync(int currentUserId, List<int> ids);
        Task<bool> RestoreAllProjectsAsync(int currentUserId);
        Task<bool> BulkPermanentlyDeleteProjectsAsync(int currentUserId, List<int> ids);
        Task<bool> PermanentAllProjectsAsync(int currentUserId);
        Task<bool> PermanentlyDeleteProjectAsync(int currentUserId, int id);
        Task<object?> GetDeletedProjectItemsAsync(int currentUserId, int id);
    }
}
