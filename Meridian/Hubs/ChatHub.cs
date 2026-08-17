using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using Meridian.Application.Interfaces;
using System.Security.Claims;

namespace Meridian.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;

        public ChatHub(IChatService chatService)
        {
            _chatService = chatService;
        }

        private int GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? int.Parse(claim.Value) : 0;
        }

        // İstemci bir sohbete tıklandığında (veya dashboard'a girdiğinde) bu odaya bağlanır
        public async Task JoinChatSession(int chatSessionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{chatSessionId}");
        }

        // İstemci sohbetten çıktığında odadan ayrılır
        public async Task LeaveChatSession(int chatSessionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat_{chatSessionId}");
        }

        // Gerçek zamanlı mesaj gönderme
        public async Task SendMessage(int chatSessionId, string content)
        {
            int userId = GetUserId();
            if (userId == 0) return;

            try
            {
                var message = await _chatService.SendMessageAsync(chatSessionId, userId, content);
                var participantIds = await _chatService.GetChatSessionParticipantIdsAsync(chatSessionId);
                var userIdsString = participantIds.Select(id => id.ToString()).ToList();

                // Tüm katılımcılara (bağlı oldukları tüm cihazlara) anında ilet
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
                    message.IsSystemMessage
                });
            }
            catch (Exception ex)
            {
                // Yetki hatası vb. durumlarda sadece gönderene hata döndür.
                await Clients.Caller.SendAsync("ErrorMessage", ex.Message);
            }
        }
    }
}
