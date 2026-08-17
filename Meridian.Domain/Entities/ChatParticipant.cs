using System;
using System.ComponentModel.DataAnnotations;

namespace Meridian.Domain.Entities
{
    public class ChatParticipant
    {
        [Key]
        public int Id { get; set; }

        public int ChatSessionId { get; set; }
        public ChatSession? ChatSession { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public DateTime JoinedAt { get; set; } = DateTime.Now;

        // Kullanıcının bu sohbette mesajları en son okuduğu zaman.
        // Unread message count hesaplaması için kullanılacak.
        public DateTime? LastReadAt { get; set; }

        // Grup yöneticisi mi? (Üye ekleme/çıkarma yetkisi vs.)
        public bool IsAdmin { get; set; } = false;
    }
}
