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
using Microsoft.EntityFrameworkCore;

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
            
            var dbContext = HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
            var sessionIds = sessions.Select(s => s.Id).ToList();
            
            var unreadCounts = await dbContext.ChatParticipants
                .Where(p => sessionIds.Contains(p.ChatSessionId) && p.UserId == userId)
                .Select(p => new {
                    p.ChatSessionId,
                    UnreadCount = p.LastReadAt.HasValue 
                        ? dbContext.ChatMessages.Count(m => m.ChatSessionId == p.ChatSessionId && m.CreatedAt > p.LastReadAt.Value)
                        : dbContext.ChatMessages.Count(m => m.ChatSessionId == p.ChatSessionId && m.SenderId != userId)
                })
                .ToDictionaryAsync(x => x.ChatSessionId, x => x.UnreadCount);
            
            var result = sessions.Select(s => {
                var myParticipant = s.Participants.FirstOrDefault(p => p.UserId == userId);
                var unreadCount = unreadCounts.ContainsKey(s.Id) ? unreadCounts[s.Id] : 0;

                return new
                {
                    s.Id,
                    s.Type,
                    s.Title,
                    s.Description,
                    s.UpdatedAt,
                    IsPinned = myParticipant?.IsPinned ?? false,
                    IsMuted = myParticipant?.IsMuted ?? false,
                    UnreadCount = unreadCount,
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
                };
            });

            return Ok(result);
        }

        [HttpGet("messages/{sessionId}")]
        public async Task<IActionResult> GetMessages(int sessionId, [FromQuery] int skip = 0, [FromQuery] int take = 50, [FromQuery] bool markRead = true)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                var dbContext = HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
                
                // Get the current user's LastReadAt before marking as read
                var currentParticipant = dbContext.ChatParticipants
                    .FirstOrDefault(p => p.ChatSessionId == sessionId && p.UserId == userId);
                DateTime? myLastReadAt = currentParticipant?.LastReadAt;

                var messages = await _chatService.GetChatMessagesAsync(sessionId, userId, skip, take);
                
                if (markRead)
                {
                    // Mesajları çektiğimizde oturumu "okundu" olarak işaretliyoruz
                    await _chatService.MarkSessionAsReadAsync(sessionId, userId);
                }
                
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
                    
                    bool isUnreadForMe = false;
                    if (myLastReadAt.HasValue) {
                        isUnreadForMe = m.CreatedAt > myLastReadAt.Value;
                    } else {
                        // If myLastReadAt is null, it means I haven't read anything, so all messages are unread (unless I sent them)
                        isUnreadForMe = m.SenderId != userId;
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
                        IsUnreadForMe = isUnreadForMe,
                        m.IsPinned,
                        Reactions = m.Reactions != null ? m.Reactions.GroupBy(r => r.Emoji).Select(g => (object)new {
                            Emoji = g.Key,
                            Count = g.Count(),
                            UserIds = g.Select(x => x.UserId).ToList()
                        }).ToList() : new List<object>()
                    };
                });

                return Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
        }

        [HttpPost("messages/{messageId}/mark-unread")]
        public async Task<IActionResult> MarkMessageAsUnread(int messageId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            
            var dbContext = HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
            var message = await dbContext.ChatMessages.FindAsync(messageId);
            if (message == null) return NotFound("Mesaj bulunamadı.");
            
            var participant = dbContext.ChatParticipants.FirstOrDefault(p => p.ChatSessionId == message.ChatSessionId && p.UserId == userId);
            if (participant == null) return Forbid();
            
            // Set LastReadAt to just before this message's CreatedAt
            participant.LastReadAt = message.CreatedAt.AddTicks(-1);
            await dbContext.SaveChangesAsync();
            
            return Ok();
        }

        [HttpPost("messages/{messageId}/pin")]
        public async Task<IActionResult> PinMessage(int messageId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            
            var dbContext = HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
            var message = await dbContext.ChatMessages.FindAsync(messageId);
            if (message == null) return NotFound("Mesaj bulunamadı.");
            
            // Check if user has access to this chat session
            var participant = dbContext.ChatParticipants.FirstOrDefault(p => p.ChatSessionId == message.ChatSessionId && p.UserId == userId);
            if (participant == null) return Forbid();
            
            message.IsPinned = !message.IsPinned;
            
            // System message oluştur
            var user = await dbContext.Users.FindAsync(userId);
            string userName = string.IsNullOrWhiteSpace(user?.Name) && string.IsNullOrWhiteSpace(user?.Surname) 
                ? (user?.Username ?? "Biri")
                : $"{user?.Name} {user?.Surname}".Trim();
            
            string contentText = message.IsPinned 
                ? $"{userName}, bir mesaj sabitledi." 
                : $"{userName}, sabitlenen bir mesajı kaldırdı.";
            
            var systemMessage = new ChatMessage
            {
                ChatSessionId = message.ChatSessionId,
                SenderId = userId,
                Content = contentText,
                OriginalContent = contentText,
                CreatedAt = DateTime.Now,
                IsSystemMessage = true
            };
            dbContext.ChatMessages.Add(systemMessage);
            
            await dbContext.SaveChangesAsync();
            
            // Sabitleme durumunu gönder
            await _hubContext.Clients.Group($"chat_{message.ChatSessionId}").SendAsync("MessagePinnedToggled", messageId, message.IsPinned);
            
            // Sistem mesajını gruba gönder (yeni mesaj olarak düşsün)
            var participantIds = dbContext.ChatParticipants
                .Where(p => p.ChatSessionId == message.ChatSessionId)
                .Select(p => p.UserId.ToString())
                .ToList();

            await _hubContext.Clients.Users(participantIds).SendAsync("ReceiveMessage", new
            {
                Id = systemMessage.Id,
                ChatSessionId = systemMessage.ChatSessionId,
                SenderId = systemMessage.SenderId,
                SenderName = userName,
                AvatarUrl = user?.AvatarUrl,
                Content = systemMessage.Content,
                CreatedAt = systemMessage.CreatedAt,
                IsSystemMessage = systemMessage.IsSystemMessage,
                ReplyToId = (int?)null,
                ReplyToContent = (string)null,
                ReplyToUser = (string)null,
                IsPinned = false
            });
            
            return Ok(new { isPinned = message.IsPinned });
        }

        public class ReactionDto { public string Emoji { get; set; } }

        [HttpPost("messages/{messageId}/reactions")]
        public async Task<IActionResult> ToggleReaction(int messageId, [FromBody] ReactionDto req)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();
            if (string.IsNullOrWhiteSpace(req.Emoji)) return BadRequest("Emoji boş olamaz.");

            var dbContext = HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
            var message = await dbContext.ChatMessages.Include(m => m.Reactions).FirstOrDefaultAsync(m => m.Id == messageId);
            if (message == null) return NotFound("Mesaj bulunamadı.");

            var participant = await dbContext.ChatParticipants.FirstOrDefaultAsync(p => p.ChatSessionId == message.ChatSessionId && p.UserId == userId);
            if (participant == null) return Forbid();

            var existingReaction = message.Reactions.FirstOrDefault(r => r.UserId == userId && r.Emoji == req.Emoji);
            bool isAdded = false;

            if (existingReaction != null)
            {
                dbContext.ChatMessageReactions.Remove(existingReaction);
            }
            else
            {
                var newReaction = new ChatMessageReaction
                {
                    ChatMessageId = messageId,
                    UserId = userId,
                    Emoji = req.Emoji,
                    CreatedAt = DateTime.Now
                };
                dbContext.ChatMessageReactions.Add(newReaction);
                isAdded = true;
            }

            await dbContext.SaveChangesAsync();

            await _hubContext.Clients.Group($"chat_{message.ChatSessionId}").SendAsync("MessageReactionToggled", messageId, userId, req.Emoji, isAdded);

            return Ok(new { isAdded });
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
                var dbContext = HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
                
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
        
        [HttpPost("sessions/{sessionId}/add-user")]
        public async Task<IActionResult> AddUserToDM(int sessionId, [FromBody] int targetUserId)
        {
            int userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                var dbContext = HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
                
                var session = await dbContext.ChatSessions
                    .Include(cs => cs.Participants)
                    .FirstOrDefaultAsync(cs => cs.Id == sessionId && cs.IsActive);
                    
                if (session == null) return NotFound("Sohbet bulunamadı.");
                
                if (!session.Participants.Any(p => p.UserId == userId))
                    return Forbid();
                    
                if (session.Participants.Any(p => p.UserId == targetUserId))
                    return BadRequest("Kullanıcı zaten sohbette.");
                    
                if (session.Type == ChatSessionType.DirectMessage)
                {
                    if (session.Participants.Count <= 2)
                    {
                        // 1-1 DM: Create new session
                        var participantIds = session.Participants.Select(p => p.UserId).ToList();
                        participantIds.Add(targetUserId);
                        
                        var newSession = new ChatSession
                        {
                            Type = ChatSessionType.DirectMessage, // Still DM type
                            CreatorId = userId,
                            CreatedAt = DateTime.Now,
                            UpdatedAt = DateTime.Now,
                            Participants = participantIds.Select(id => new ChatParticipant
                            {
                                UserId = id,
                                JoinedAt = DateTime.Now,
                                IsAdmin = true
                            }).ToList()
                        };
                        dbContext.ChatSessions.Add(newSession);
                        await dbContext.SaveChangesAsync();
                        
                        var systemMessage = new ChatMessage
                        {
                            ChatSessionId = newSession.Id,
                            SenderId = userId,
                            Content = "Grup oluşturuldu.",
                            IsSystemMessage = true,
                            CreatedAt = DateTime.Now
                        };
                        dbContext.ChatMessages.Add(systemMessage);
                        await dbContext.SaveChangesAsync();
                        
                        return Ok(new { sessionId = newSession.Id, isNew = true });
                    }
                    else
                    {
                        // Zaten Group DM (> 2 kişi)
                        session.Participants.Add(new ChatParticipant {
                            UserId = targetUserId,
                            JoinedAt = DateTime.Now,
                            IsAdmin = true
                        });
                        await dbContext.SaveChangesAsync();
                        await _chatService.SendMessageAsync(sessionId, userId, "Yeni bir katılımcı gruba eklendi.", true);
                        return Ok(new { sessionId = sessionId, isNew = false });
                    }
                }
                else
                {
                    // Regular Group
                    await _chatService.AddUserToGroupAsync(sessionId, userId, targetUserId);
                    return Ok(new { sessionId = sessionId, isNew = false });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
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
