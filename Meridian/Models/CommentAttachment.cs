using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Meridian.Models
{
    public class CommentAttachment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CommentId { get; set; }

        [JsonIgnore]
        [ForeignKey("CommentId")]
        public Comment? Comment { get; set; }

        [Required]
        public string FileUrl { get; set; } = string.Empty;

        [Required]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string FileType { get; set; } = string.Empty; // e.g., "image" or "file"

        public long FileSize { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.Now;
    }
}
