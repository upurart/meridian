using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Meridian.Domain.Entities
{
    public enum ChatSessionType
    {
        DirectMessage = 1,
        Group = 2
    }

    public class ChatSession
    {
        [Key]
        public int Id { get; set; }

        public ChatSessionType Type { get; set; }

        [MaxLength(100)]
        public string? Title { get; set; } // Sadece grup sohbetleri için

        [MaxLength(256)]
        public string? Description { get; set; } // Grup açıklaması

        [MaxLength(512)]
        public string? ImageUrl { get; set; }

        public int? CreatorId { get; set; }
        public User? Creator { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now; // Son mesaj atıldığında güncellenecek

        public bool IsActive { get; set; } = true; // Kapatılmış/silinmiş gruplar için

        // Navigation properties
        public ICollection<ChatParticipant> Participants { get; set; } = new List<ChatParticipant>();
        public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
    }
}
