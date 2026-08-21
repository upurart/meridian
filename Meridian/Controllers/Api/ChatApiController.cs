using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Meridian.Application.Interfaces;
using Meridian.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

using Meridian.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Meridian.Controllers.Api
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ChatApiController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatApiController(IChatService chatService, IHubContext<ChatHub> hubContext)
        {
            _chatService = chatService;
            _hubContext = hubContext;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? int.Parse(claim.Value) : 0;
        }

        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions()
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var sessions = await _chatService.GetUserChatSessionsAsync(userId);
            
            var result = sessions.Select(s => new
            {
                s.Id,
                s.Type,
                s.Title,
                s.Description,
                s.UpdatedAt,
                IsPinned = s.Participants.FirstOrDefault(p => p.UserId == userId)?.IsPinned ?? false,
                IsMuted = s.Participants.FirstOrDefault(p => p.UserId == userId)?.IsMuted ?? false,
                UnreadCount = 0, // TODO: İleride eklenebilir (Message Date > Participant.LastReadAt)
                Participants = s.Participants.Select(p => new
                {
                    p.UserId,
                    Name = p.User != null 
                        ? (string.IsNullOrWhiteSpace(p.User.Name) && string.IsNullOrWhiteSpace(p.User.Surname) 
                            ? p.User.Username 
                            : $"{p.User.Name} {p.User.Surname}".Trim()) 
                        : "Bilinmiyor",
                    RawName = p.User?.Name,
                    RawSurname = p.User?.Surname,
                    Username = p.User?.Username,
                    Email = p.User?.Email,
                    AvatarUrl = p.User?.AvatarUrl,
                    p.IsAdmin
                }).ToList(),
                LastMessage = s.Messages.FirstOrDefault()?.Content,
                LastMessageDate = s.Messages.FirstOrDefault()?.CreatedAt,
                LastMessageSenderId = s.Messages.FirstOrDefault()?.SenderId
            });

            return Ok(result);
        }

        [HttpGet("messages/{sessionId}")]
        public async Task<IActionResult> GetMessages(int sessionId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                var messages = await _chatService.GetChatMessagesAsync(sessionId, userId, skip, take);
                
                // Mesajları çektiğimizde oturumu "okundu" olarak işaretliyoruz
                await _chatService.MarkSessionAsReadAsync(sessionId, userId);
                
                var dbContext = HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var otherParticipants = dbContext.ChatParticipants
                    .Where(p => p.ChatSessionId == sessionId && p.UserId != userId)
                    .Select(p => p.LastReadAt)
                    .ToList();
                
                var result = messages.Select(m => {
                    bool isRead = false;
                    if (otherParticipants.Any()) {
                        // Bir grupta herkes okuduysa (veya en az 1 kişi okuduysa - WhatsApp gibi herkes okuyunca mavi tik yapalım)
                        isRead = otherParticipants.All(lastRead => lastRead.HasValue && lastRead.Value >= m.CreatedAt);
                    }

                    return new
                    {
                        m.Id,
                        m.SenderId,
                        SenderName = m.Sender != null 
                            ? (string.IsNullOrWhiteSpace(m.Sender.Name) && string.IsNullOrWhiteSpace(m.Sender.Surname) 
                                ? m.Sender.Username 
                                : $"{m.Sender.Name} {m.Sender.Surname}".Trim()) 
                            : "Bilinmiyor",
                        SenderUsername = m.Sender?.Username,
                        AvatarUrl = m.Sender?.AvatarUrl,
                        m.Content,
                        m.OriginalContent,
                        m.UpdatedAt,
                        m.IsDeleted,
                        m.CreatedAt,
                        m.IsSystemMessage,
                        m.ReplyToId,
                        ReplyToContent = m.ReplyToMessage?.Content,
                        ReplyToUser = m.ReplyToMessage?.Sender != null ? $"{m.ReplyToMessage.Sender.Name} {m.ReplyToMessage.Sender.Surname}".Trim() : null,
                        IsRead = isRead,
                        m.IsPinned
                    };
                });

                return Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
        }

        [HttpPost("messages/{messageId}/pin")]
        public async Task<IActionResult> PinMessage(int messageId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            
            var dbContext = HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            var message = await dbContext.ChatMessages.FindAsync(messageId);
            if (message == null) return NotFound("Mesaj bulunamadı.");
            
            // Check if user has access to this chat session
            var participant = dbContext.ChatParticipants.FirstOrDefault(p => p.ChatSessionId == message.ChatSessionId && p.UserId == userId);
            if (participant == null) return Forbid();
            
            message.IsPinned = !message.IsPinned;
            await dbContext.SaveChangesAsync();
            
            // SignalR ile istemcilere bildirim gönderilebilir (İsteğe bağlı)
            await _hubContext.Clients.Group($"chat_{message.ChatSessionId}").SendAsync("MessagePinnedToggled", messageId, message.IsPinned);
            
            return Ok(new { isPinned = message.IsPinned });
        }

        [HttpPost("sessions/dm")]
        public async Task<IActionResult> GetOrCreateDMByUsername([FromBody] string usernameOrEmail)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(usernameOrEmail))
                return BadRequest(new { error = "Kullanıcı adı veya e-posta boş olamaz." });

            try
            {
                var dbContext = HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                
                // Find user by username or email
                var targetUser = dbContext.Users.FirstOrDefault(u => 
                    u.Username.ToLower() == usernameOrEmail.ToLower() || 
                    u.Email.ToLower() == usernameOrEmail.ToLower());
                
                if (targetUser == null)
                    return NotFound("Kullanıcı bulunamadı.");

                if (targetUser.Id == userId)
                    return BadRequest("Kendinizle sohbet başlatamazsınız.");

                var session = await _chatService.GetOrCreateDirectMessageSessionAsync(userId, targetUser.Id);
                return Ok(new { id = session.Id });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        
        public class CreateGroupRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Description { get; set; } = string.Empty;
            public List<int> ParticipantIds { get; set; } = new List<int>();
        }

        [HttpPost("group")]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest req)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                var session = await _chatService.CreateGroupChatAsync(userId, req.Title, req.Description, req.ParticipantIds);
                return Ok(new { sessionId = session.Id });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("{sessionId}/mute")]
        public async Task<IActionResult> ToggleMute(int sessionId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            await _chatService.ToggleMuteAsync(sessionId, userId);
            return Ok();
        }

        [HttpPost("{sessionId}/pin")]
        public async Task<IActionResult> TogglePin(int sessionId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            await _chatService.TogglePinAsync(sessionId, userId);
            return Ok();
        }

        [HttpPost("{sessionId}/hide")]
        public async Task<IActionResult> HideSession(int sessionId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            await _chatService.HideChatSessionAsync(sessionId, userId);
            return Ok();
        }

        [HttpPost("{sessionId}/leave")]
        public async Task<IActionResult> LeaveGroup(int sessionId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            await _chatService.RemoveUserFromGroupAsync(sessionId, userId, userId); // Admin = self, means leaving voluntarily
            return Ok();
        }

        public class EditMessageRequest
        {
            public string Content { get; set; } = string.Empty;
        }

        [HttpPut("messages/{messageId}")]
        public async Task<IActionResult> EditMessage(int messageId, [FromBody] EditMessageRequest req)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Content))
                return BadRequest("Mesaj içeriği boş olamaz.");

            try
            {
                var msg = await _chatService.EditMessageAsync(messageId, userId, req.Content);
                
                // SignalR update
                var dto = new
                {
                    msg.Id,
                    msg.ChatSessionId,
                    msg.Content,
                    msg.OriginalContent,
                    msg.UpdatedAt,
                    msg.IsDeleted
                };
                await _hubContext.Clients.Group($"chat_{msg.ChatSessionId}").SendAsync("MessageEdited", dto);
                
                return Ok(dto);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpDelete("messages/{messageId}")]
        public async Task<IActionResult> DeleteMessage(int messageId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                int sessionId = await _chatService.DeleteMessageAsync(messageId, userId);
                if (sessionId > 0)
                {
                    await _hubContext.Clients.Group($"chat_{sessionId}").SendAsync("MessageDeleted", messageId);
                    return Ok();
                }
                return BadRequest("Mesaj silinemedi.");
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}
