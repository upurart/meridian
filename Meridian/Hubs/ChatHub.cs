using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using Meridian.Application.Interfaces;
using Meridian.Services;
using System.Security.Claims;

namespace Meridian.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;
        private readonly INotificationService _notificationService;

        public ChatHub(IChatService chatService, INotificationService notificationService)
        {
            _chatService = chatService;
            _notificationService = notificationService;
        }

        private int GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? int.Parse(claim.Value) : 0;
        }
        
        public async Task JoinChatSession(int chatSessionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{chatSessionId}");
        }
        
        public async Task LeaveChatSession(int chatSessionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat_{chatSessionId}");
        }
        
        public async Task MarkAsRead(int chatSessionId)
        {
            int userId = GetUserId();
            if (userId == 0) return;

            try
            {
                await _chatService.MarkSessionAsReadAsync(chatSessionId, userId);
                
               
                var participantIds = await _chatService.GetChatSessionParticipantIdsAsync(chatSessionId);
                var otherIds = participantIds.Where(id => id != userId).Select(id => id.ToString()).ToList();
                
                await Clients.Users(otherIds).SendAsync("MessagesRead", chatSessionId, userId, DateTime.Now);
            }
            catch (Exception ex)
            {
               
                Console.WriteLine("MarkAsRead Error: " + ex.Message);
            }
        }
        
        public async Task SendMessage(int chatSessionId, string content, int? replyToId = null)
        {
            int userId = GetUserId();
            if (userId == 0) return;

            try
            {
                var message = await _chatService.SendMessageAsync(chatSessionId, userId, content, false, replyToId);
                var participantIds = await _chatService.GetChatSessionParticipantIdsAsync(chatSessionId);
                var userIdsString = participantIds.Select(id => id.ToString()).ToList();
                
                
                await Clients.Users(userIdsString).SendAsync("ReceiveMessage", new
                {
                    message.Id,
                    message.ChatSessionId,
                    message.SenderId,
                    SenderName = message.Sender != null 
                        ? (string.IsNullOrWhiteSpace(message.Sender.Name) && string.IsNullOrWhiteSpace(message.Sender.Surname) 
                            ? message.Sender.Username 
                            : $"{message.Sender.Name} {message.Sender.Surname}".Trim()) 
                        : "Bilinmiyor",
                    AvatarUrl = message.Sender?.AvatarUrl,
                    message.Content,
                    message.CreatedAt,
                    message.IsSystemMessage,
                    message.ReplyToId,
                    ReplyToContent = message.ReplyToMessage?.Content,
                    ReplyToUser = message.ReplyToMessage?.Sender != null ? $"{message.ReplyToMessage.Sender.Name} {message.ReplyToMessage.Sender.Surname}".Trim() : null
                });
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("ErrorMessage", ex.Message);
            }
        }
    }
}

