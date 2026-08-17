using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Meridian.Application.Interfaces;
using Meridian.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Meridian.Controllers.Api
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ChatApiController : ControllerBase
    {
        private readonly IChatService _chatService;

        public ChatApiController(IChatService chatService)
        {
            _chatService = chatService;
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
                LastMessageDate = s.Messages.FirstOrDefault()?.CreatedAt
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
                
                var result = messages.Select(m => new
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
                    m.CreatedAt,
                    m.IsSystemMessage
                });

                return Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
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
    }
}
