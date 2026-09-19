using System;
using System.ComponentModel.DataAnnotations;

namespace Meridian.Domain.Entities
{
    public class ChatMessageReaction
    {
        [Key]
        public int Id { get; set; }

        public int ChatMessageId { get; set; }
        public ChatMessage? ChatMessage { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        [Required]
        [MaxLength(50)]
        public string Emoji { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
