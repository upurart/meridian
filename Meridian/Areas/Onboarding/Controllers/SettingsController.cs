using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Meridian.Models;
using Microsoft.AspNetCore.Identity;

namespace Meridian.Areas.Onboarding.Controllers
{
    [Area("Onboarding")]
    [Authorize]
    public class SettingsController : Controller
    {
        private readonly AppDbContext _context;

        public SettingsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Settings()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return RedirectToAction("Login", "Account");
            
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return RedirectToAction("Login", "Account");
            
            var model = new SettingsViewModel
            {
                Profile = new SettingsProfileViewModel
                {
                    Name = user.Name,
                    Surname = user.Surname,
                    Username = user.Username,
                    JobTitle = user.JobTitle
                },
                Account = new SettingsAccountViewModel
                {
                    Email = user.Email
                },
                Appearance = new SettingsAppearanceViewModel
                {
                    ThemePreference = user.ThemePreference,
                    ProjectCardViewPreference = user.ProjectCardViewPreference,
                    AutoHideMenuPreference = user.AutoHideMenuPreference
                },
                Notifications = new SettingsNotificationsViewModel
                {
                    NotifyOnTaskAssignmentEmail = user.NotifyOnTaskAssignmentEmail,
                    NotifyOnTaskAssignmentApp = user.NotifyOnTaskAssignmentApp,
                    NotifyOnMentionEmail = user.NotifyOnMentionEmail,
                    NotifyOnMentionApp = user.NotifyOnMentionApp,
                    UpcomingDeadlineReminderDays = user.UpcomingDeadlineReminderDays
                },
                Advanced = new SettingsAdvancedViewModel
                {
                    EnableExperimentalFeatures = user.EnableExperimentalFeatures
                },
                AvatarUrl = user.AvatarUrl
            };

            return View(model);
        }

        [HttpPost]
        public async Task<IActionResult> UpdateProfileSettings([FromForm] SettingsProfileViewModel model)
        {
            if (!ModelState.IsValid) return BadRequest("Girdiğiniz veriler geçersiz.");
            
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (user.Username != model.Username && await _context.Users.AnyAsync(u => u.Username == model.Username && u.Id != userId))
            {
                return BadRequest("Bu kullanıcı adı zaten alınmış.");
            }

            user.Name = model.Name;
            user.Surname = model.Surname;
            user.Username = model.Username;
            user.JobTitle = model.JobTitle;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> UpdateAccountSettings([FromForm] SettingsAccountViewModel model)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (user.Email != model.Email && await _context.Users.AnyAsync(u => u.Email == model.Email && u.Id != userId))
            {
                return BadRequest("Bu e-posta adresi zaten kullanımda.");
            }
            
            user.Email = model.Email;
            
            if (!string.IsNullOrEmpty(model.NewPassword))
            {
                if (string.IsNullOrEmpty(model.CurrentPassword))
                    return BadRequest("Şifre değiştirmek için mevcut şifrenizi girmelisiniz.");
                    
                var hasher = new PasswordHasher<User>();
                var verify = hasher.VerifyHashedPassword(user, user.PasswordHash, model.CurrentPassword);
                if (verify != PasswordVerificationResult.Success)
                    return BadRequest("Mevcut şifreniz yanlış.");
                    
                if (model.NewPassword != model.ConfirmNewPassword)
                    return BadRequest("Yeni şifreler eşleşmiyor.");
                    
                user.PasswordHash = hasher.HashPassword(user, model.NewPassword);
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> UpdateAppearanceSettings([FromForm] SettingsAppearanceViewModel model)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.ThemePreference = model.ThemePreference;
            user.ProjectCardViewPreference = model.ProjectCardViewPreference;
            user.AutoHideMenuPreference = model.AutoHideMenuPreference;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> UpdateNotificationsSettings([FromForm] SettingsNotificationsViewModel model)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.NotifyOnTaskAssignmentEmail = model.NotifyOnTaskAssignmentEmail;
            user.NotifyOnTaskAssignmentApp = model.NotifyOnTaskAssignmentApp;
            user.NotifyOnMentionEmail = model.NotifyOnMentionEmail;
            user.NotifyOnMentionApp = model.NotifyOnMentionApp;
            user.UpcomingDeadlineReminderDays = model.UpcomingDeadlineReminderDays ?? "3";

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> UpdateAdvancedSettings([FromForm] SettingsAdvancedViewModel model)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.EnableExperimentalFeatures = model.EnableExperimentalFeatures;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
