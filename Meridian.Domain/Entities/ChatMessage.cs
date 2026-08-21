using System;
using System.ComponentModel.DataAnnotations;

namespace Meridian.Domain.Entities
{
    public class ChatMessage
    {
        [Key]
        public int Id { get; set; }

        public int ChatSessionId { get; set; }
        public ChatSession? ChatSession { get; set; }

        public int SenderId { get; set; }
        public User? Sender { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; } // Mesaj düzenlenirse
        public string? OriginalContent { get; set; } // Düzenlenmeden önceki hali

        public bool IsDeleted { get; set; } = false;
        
        // System message flag (e.g., "Ahmet gruba katıldı", "Veli gruptan ayrıldı")
        public bool IsSystemMessage { get; set; } = false;

        public bool IsPinned { get; set; } = false;

        public int? ReplyToId { get; set; }
        public ChatMessage? ReplyToMessage { get; set; }
    }
}
