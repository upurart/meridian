using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Meridian.Domain.Entities
{
    public enum ConnectionStatus
    {
        Pending = 0,
        Accepted = 1,
        Rejected = 2,
        Blocked = 3
    }

    public class UserConnection
    {
        [Key]
        public int Id { get; set; }

        public int RequesterId { get; set; }
        [ForeignKey("RequesterId")]
        public User? Requester { get; set; }

        public int ReceiverId { get; set; }
        [ForeignKey("ReceiverId")]
        public User? Receiver { get; set; }

        public ConnectionStatus Status { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
