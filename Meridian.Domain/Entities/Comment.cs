namespace Meridian.Domain.Entities
{
    public class Comment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }

        [Required]
        public string EntityType { get; set; } = string.Empty;

        [Required]
        public int EntityId { get; set; }
        
        public int? ReplyToId { get; set; }
        [ForeignKey("ReplyToId")]
        public Comment? ReplyToComment { get; set; }

        public bool IsForwarded { get; set; } = false;

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        public ICollection<CommentAttachment> Attachments { get; set; } = new List<CommentAttachment>();
    }
}
