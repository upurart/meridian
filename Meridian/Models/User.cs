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

        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        
        [MaxLength(100)]
        public string? JobTitle { get; set; }

        [MaxLength(256)]
        public string? AvatarUrl { get; set; }

        [MaxLength(20)]
        public string ThemePreference { get; set; } = "system";

        [MaxLength(20)]
        public string ProjectCardViewPreference { get; set; } = "grid";

        public bool AutoHideMenuPreference { get; set; } = false;

        public bool NotifyOnTaskAssignmentEmail { get; set; } = true;
        public bool NotifyOnTaskAssignmentApp { get; set; } = true;
        public bool NotifyOnMentionEmail { get; set; } = true;
        public bool NotifyOnMentionApp { get; set; } = true;
        
        [MaxLength(20)]
        public string UpcomingDeadlineReminderDays { get; set; } = "3";
        
        public bool EnableExperimentalFeatures { get; set; } = false;
        
        [MaxLength(256)]
        public string? ResetPasswordToken { get; set; }
        
        public DateTime? ResetPasswordTokenExpiry { get; set; }

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        // Organization Matrix
        [Required]
        public int OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public ICollection<Project> Projects { get; set; } = new List<Project>();
    }
}
