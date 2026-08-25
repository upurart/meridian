using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Meridian.Application.Interfaces;
using Meridian.Domain.Entities;

namespace Meridian.Application.Services
{
    public class ChatService : IChatService
    {
        private readonly IAppDbContext _context;

        public ChatService(IAppDbContext context)
        {
            _context = context;
        }

        public async Task<List<ChatSession>> GetUserChatSessionsAsync(int userId)
        {
            // Kullanıcının katılımcı olduğu chat session'ları getirir.
            var sessions = await _context.ChatSessions
                .Include(cs => cs.Participants)
                    .ThenInclude(p => p.User)
                .Include(cs => cs.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
                .Where(cs => cs.IsActive && cs.Participants.Any(p => p.UserId == userId && !p.IsHidden))
                .OrderByDescending(cs => cs.UpdatedAt)
                .ToListAsync();

            return sessions;
        }

        public async Task<List<ChatMessage>> GetChatMessagesAsync(int chatSessionId, int userId, int skip = 0, int take = 50)
        {
            // Kullanıcı bu sohbete ait mi kontrolü
            var isParticipant = await _context.ChatParticipants
                .AnyAsync(p => p.ChatSessionId == chatSessionId && p.UserId == userId);

            if (!isParticipant)
                throw new UnauthorizedAccessException("Bu sohbete erişim yetkiniz yok.");

            var messages = await _context.ChatMessages
                .Include(m => m.Sender)
                .Include(m => m.ReplyToMessage).ThenInclude(r => r.Sender)
                .Include(m => m.Reactions)
                .Where(m => m.ChatSessionId == chatSessionId && !m.IsDeleted)
                .OrderByDescending(m => m.CreatedAt)
                .Skip(skip)
                .Take(take)
                .ToListAsync();

            // Ekrandan okurken kronolojik olmalı, ters çeviriyoruz
            messages.Reverse();
            return messages;
        }

        public async Task<List<int>> GetChatSessionParticipantIdsAsync(int chatSessionId)
        {
            return await _context.ChatParticipants
                .Where(p => p.ChatSessionId == chatSessionId)
                .Select(p => p.UserId)
                .ToListAsync();
        }

        public async Task<ChatSession> GetOrCreateDirectMessageSessionAsync(int currentUserId, int targetUserId)
        {
            if (currentUserId == targetUserId)
                throw new InvalidOperationException("Kendinizle sohbet oluşturamazsınız.");

            // İki kullanıcının da bulunduğu DirectMessage türündeki bir sohbeti bulalım
            var existingSession = await _context.ChatSessions
                .Include(cs => cs.Participants)
                    .ThenInclude(p => p.User)
                .Where(cs => cs.Type == ChatSessionType.DirectMessage && cs.IsActive)
                .FirstOrDefaultAsync(cs => 
                    cs.Participants.Any(p => p.UserId == currentUserId) && 
                    cs.Participants.Any(p => p.UserId == targetUserId));

            if (existingSession != null)
                return existingSession;

            // Yoksa yeni oluştur
            var newSession = new ChatSession
            {
                Type = ChatSessionType.DirectMessage,
                CreatorId = currentUserId,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now,
                Participants = new List<ChatParticipant>
                {
                    new ChatParticipant { UserId = currentUserId, JoinedAt = DateTime.Now, IsAdmin = true },
                    new ChatParticipant { UserId = targetUserId, JoinedAt = DateTime.Now, IsAdmin = true }
                }
            };

            _context.ChatSessions.Add(newSession);
            await _context.SaveChangesAsync();

            return newSession;
        }

        public async Task<ChatSession> CreateGroupChatAsync(int creatorId, string title, string description, List<int> participantIds)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Grup adı boş olamaz.");

            // Kendisini de ekliyor
            if (!participantIds.Contains(creatorId))
                participantIds.Add(creatorId);

            var participants = participantIds.Select(id => new ChatParticipant
            {
                UserId = id,
                JoinedAt = DateTime.Now,
                IsAdmin = (id == creatorId) // Sadece kurucu admin
            }).ToList();

            var newSession = new ChatSession
            {
                Type = ChatSessionType.Group,
                Title = title,
                Description = description,
                CreatorId = creatorId,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now,
                Participants = participants
            };

            _context.ChatSessions.Add(newSession);
            await _context.SaveChangesAsync();

            // İlk mesaj olarak sistem mesajı at
            var systemMessage = new ChatMessage
            {
                ChatSessionId = newSession.Id,
                SenderId = creatorId,
                Content = "Grup oluşturuldu.",
                IsSystemMessage = true,
                CreatedAt = DateTime.Now
            };

            _context.ChatMessages.Add(systemMessage);
            await _context.SaveChangesAsync();

            return newSession;
        }

        public async Task<ChatSession> UpdateGroupChatAsync(int chatSessionId, int userId, string? title, string? imageUrl)
        {
            var session = await _context.ChatSessions
                .Include(cs => cs.Participants)
                .FirstOrDefaultAsync(cs => cs.Id == chatSessionId && cs.IsActive);

            if (session == null)
                throw new KeyNotFoundException("Sohbet bulunamadı.");

            if (!session.Participants.Any(p => p.UserId == userId))
                throw new UnauthorizedAccessException("Bu sohbette değilsiniz.");

            if (!string.IsNullOrWhiteSpace(title))
                session.Title = title;

            if (imageUrl != null)
                session.ImageUrl = imageUrl;

            session.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // Create system message
            var systemMessage = new ChatMessage
            {
                ChatSessionId = chatSessionId,
                SenderId = userId,
                Content = "Grup bilgileri güncellendi.",
                IsSystemMessage = true,
                CreatedAt = DateTime.Now
            };
            _context.ChatMessages.Add(systemMessage);
            await _context.SaveChangesAsync();

            return session;
        }

        public async Task<ChatMessage> SendMessageAsync(int chatSessionId, int senderId, string content, bool isSystemMessage = false, int? replyToId = null)
        {
            if (string.IsNullOrWhiteSpace(content))
                throw new ArgumentException("Mesaj içeriği boş olamaz.");

            var session = await _context.ChatSessions
                .Include(cs => cs.Participants)
                .FirstOrDefaultAsync(cs => cs.Id == chatSessionId && cs.IsActive);

            if (session == null)
                throw new KeyNotFoundException("Sohbet bulunamadı veya kapatılmış.");

            if (!session.Participants.Any(p => p.UserId == senderId))
                throw new UnauthorizedAccessException("Bu gruba mesaj gönderme yetkiniz yok.");

            // Eğer birisi sohbeti gizlediyse ve yeni mesaj gelirse (veya kendisi atarsa) görünür olsun
            foreach(var p in session.Participants)
            {
                if (p.IsHidden)
                    p.IsHidden = false;
            }

            var message = new ChatMessage
            {
                ChatSessionId = chatSessionId,
                SenderId = senderId,
                Content = content,
                IsSystemMessage = isSystemMessage,
                ReplyToId = replyToId,
                CreatedAt = DateTime.Now
            };

            _context.ChatMessages.Add(message);
            
            // Sohbetin son güncellenme tarihini de mesajın tarihi yap
            session.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            
            // Return message with loaded Sender for real-time broadcasting
            message.Sender = await _context.Users.FindAsync(senderId);
            
            if (replyToId.HasValue)
            {
                message.ReplyToMessage = await _context.ChatMessages
                    .Include(m => m.Sender)
                    .FirstOrDefaultAsync(m => m.Id == replyToId.Value);
            }
            
            return message;
        }

        public async Task MarkSessionAsReadAsync(int chatSessionId, int userId)
        {
            var participant = await _context.ChatParticipants
                .FirstOrDefaultAsync(p => p.ChatSessionId == chatSessionId && p.UserId == userId);

            if (participant != null)
            {
                participant.LastReadAt = DateTime.Now;
                await _context.SaveChangesAsync();
            }
        }

        public async Task AddUserToGroupAsync(int chatSessionId, int adminId, int newUserId)
        {
            var session = await _context.ChatSessions
                .Include(cs => cs.Participants)
                .FirstOrDefaultAsync(cs => cs.Id == chatSessionId && cs.Type == ChatSessionType.Group);

            if (session == null)
                throw new KeyNotFoundException("Grup sohbeti bulunamadı.");

            var adminParticipant = session.Participants.FirstOrDefault(p => p.UserId == adminId);
            if (adminParticipant == null || !adminParticipant.IsAdmin)
                throw new UnauthorizedAccessException("Kullanıcı eklemek için yönetici olmalısınız.");

            if (session.Participants.Any(p => p.UserId == newUserId))
                return; // Zaten grupta

            session.Participants.Add(new ChatParticipant
            {
                UserId = newUserId,
                JoinedAt = DateTime.Now,
                IsAdmin = false
            });

            await _context.SaveChangesAsync();

            // Sistem mesajı gönderilebilir
            await SendMessageAsync(chatSessionId, adminId, "Yeni bir katılımcı gruba eklendi.", true);
        }

        public async Task RemoveUserFromGroupAsync(int chatSessionId, int adminId, int targetUserId)
        {
            var session = await _context.ChatSessions
                .Include(cs => cs.Participants)
                .FirstOrDefaultAsync(cs => cs.Id == chatSessionId && cs.Type == ChatSessionType.Group);

            if (session == null)
                throw new KeyNotFoundException("Grup sohbeti bulunamadı.");

            // Kendi kendine mi çıkıyor yoksa admin mi atıyor?
            if (adminId != targetUserId)
            {
                var adminParticipant = session.Participants.FirstOrDefault(p => p.UserId == adminId);
                if (adminParticipant == null || !adminParticipant.IsAdmin)
                    throw new UnauthorizedAccessException("Kullanıcı çıkarmak için yönetici olmalısınız.");
            }

            var targetParticipant = session.Participants.FirstOrDefault(p => p.UserId == targetUserId);
            if (targetParticipant != null)
            {
                _context.ChatParticipants.Remove(targetParticipant);
                await _context.SaveChangesAsync();
                
                string sysMsg = adminId == targetUserId ? "Kullanıcı gruptan ayrıldı." : "Kullanıcı gruptan çıkarıldı.";
                await SendMessageAsync(chatSessionId, adminId, sysMsg, true);
            }
        }

        public async Task ToggleMuteAsync(int chatSessionId, int userId)
        {
            var participant = await _context.ChatParticipants
                .FirstOrDefaultAsync(p => p.ChatSessionId == chatSessionId && p.UserId == userId);
            if (participant != null)
            {
                participant.IsMuted = !participant.IsMuted;
                await _context.SaveChangesAsync();
            }
        }

        public async Task TogglePinAsync(int chatSessionId, int userId)
        {
            var participant = await _context.ChatParticipants
                .FirstOrDefaultAsync(p => p.ChatSessionId == chatSessionId && p.UserId == userId);
            if (participant != null)
            {
                participant.IsPinned = !participant.IsPinned;
                await _context.SaveChangesAsync();
            }
        }

        public async Task HideChatSessionAsync(int chatSessionId, int userId)
        {
            var participant = await _context.ChatParticipants
                .FirstOrDefaultAsync(p => p.ChatSessionId == chatSessionId && p.UserId == userId);
            if (participant != null)
            {
                participant.IsHidden = true;
                await _context.SaveChangesAsync();
            }
        }

        public async Task<ChatMessage> EditMessageAsync(int messageId, int userId, string newContent)
        {
            var msg = await _context.ChatMessages
                .Include(m => m.Sender)
                .Include(m => m.ReplyToMessage)
                .FirstOrDefaultAsync(m => m.Id == messageId && m.SenderId == userId);
                
            if (msg == null)
                throw new KeyNotFoundException("Mesaj bulunamadı veya düzenleme yetkiniz yok.");
                
            if (msg.IsDeleted)
                throw new InvalidOperationException("Silinmiş mesaj düzenlenemez.");

            if (msg.Content == newContent)
                return msg;

            if (msg.OriginalContent == null)
            {
                msg.OriginalContent = msg.Content;
            }
            
            msg.Content = newContent;
            msg.UpdatedAt = DateTime.Now;
            
            await _context.SaveChangesAsync();
            return msg;
        }

        public async Task<int> DeleteMessageAsync(int messageId, int userId)
        {
            var msg = await _context.ChatMessages
                .FirstOrDefaultAsync(m => m.Id == messageId && m.SenderId == userId);
                
            if (msg == null)
                throw new KeyNotFoundException("Mesaj bulunamadı veya silme yetkiniz yok.");

            if (msg.IsDeleted)
                return 0;

            int sessionId = msg.ChatSessionId;

            // Hard delete
            _context.ChatMessages.Remove(msg);
            
            await _context.SaveChangesAsync();
            return sessionId;
        }
    }
}
