using System.Collections.Generic;
using System.Threading.Tasks;
using Meridian.Domain.Entities;

namespace Meridian.Application.Interfaces
{
    public interface IChatService
    {
        Task<List<ChatSession>> GetUserChatSessionsAsync(int userId);
        Task<List<ChatMessage>> GetChatMessagesAsync(int chatSessionId, int userId, int skip = 0, int take = 50);
        Task<List<int>> GetChatSessionParticipantIdsAsync(int chatSessionId);
        Task<ChatSession> GetOrCreateDirectMessageSessionAsync(int currentUserId, int targetUserId);
        Task<ChatSession> CreateGroupChatAsync(int creatorId, string title, string description, List<int> participantIds);
        Task<ChatMessage> SendMessageAsync(int chatSessionId, int senderId, string content, bool isSystemMessage = false);
        Task MarkSessionAsReadAsync(int chatSessionId, int userId);
        Task AddUserToGroupAsync(int chatSessionId, int adminId, int newUserId);
        Task RemoveUserFromGroupAsync(int chatSessionId, int adminId, int targetUserId);
    }
}
