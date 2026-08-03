namespace Meridian.Models
{
    public class User
    {

        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Surname { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        [MaxLength(256)]
        public string? AvatarUrl { get; set; }
        
        [MaxLength(256)]
        public string? ResetPasswordToken { get; set; }
        
        public DateTime? ResetPasswordTokenExpiry { get; set; }

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public ICollection<Project> Projects { get; set; } = new List<Project>();
    }
}
