using System.ComponentModel.DataAnnotations;

namespace Meridian.Models
{
    public class SettingsProfileViewModel
    {
        [Required(ErrorMessage = "Ad zorunludur.")]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Soyad zorunludur.")]
        [MaxLength(50)]
        public string Surname { get; set; } = string.Empty;

        [Required(ErrorMessage = "Kullanıcı adı zorunludur.")]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? JobTitle { get; set; }
    }

    public class SettingsAccountViewModel
    {
        [Required(ErrorMessage = "E-posta adresi zorunludur.")]
        [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi girin.")]
        public string Email { get; set; } = string.Empty;

        [DataType(DataType.Password)]
        public string? CurrentPassword { get; set; }

        [MinLength(6, ErrorMessage = "Şifre en az 6 karakter olmalıdır.")]
        [RegularExpression(@"^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$", ErrorMessage = "Şifre en az bir büyük harf, bir rakam ve bir özel karakter içermelidir.")]
        [DataType(DataType.Password)]
        public string? NewPassword { get; set; }

        [Compare("NewPassword", ErrorMessage = "Şifreler eşleşmiyor.")]
        [DataType(DataType.Password)]
        public string? ConfirmNewPassword { get; set; }

        public bool IsTwoFactorEnabled { get; set; }
    }
    
    public class SettingsAppearanceViewModel
    {
        [MaxLength(20)]
        public string ThemePreference { get; set; } = "system";

        [MaxLength(20)]
        public string ProjectCardViewPreference { get; set; } = "grid";

        public bool AutoHideMenuPreference { get; set; } = false;
    }

    public class SettingsNotificationsViewModel
    {
        public bool NotifyOnTaskAssignmentEmail { get; set; } = true;
        public bool NotifyOnTaskAssignmentApp { get; set; } = true;
        public bool NotifyOnMentionEmail { get; set; } = true;
        public bool NotifyOnMentionApp { get; set; } = true;
        
        [MaxLength(20)]
        public string UpcomingDeadlineReminderDays { get; set; } = "3";
    }

    public class SettingsAdvancedViewModel
    {
        public bool EnableExperimentalFeatures { get; set; } = false;
    }

    public class SettingsViewModel
    {
        public SettingsProfileViewModel Profile { get; set; } = new();
        public SettingsAccountViewModel Account { get; set; } = new();
        public SettingsAppearanceViewModel Appearance { get; set; } = new();
        public SettingsNotificationsViewModel Notifications { get; set; } = new();
        public SettingsAdvancedViewModel Advanced { get; set; } = new();
        public string? AvatarUrl { get; set; }
    }
}
