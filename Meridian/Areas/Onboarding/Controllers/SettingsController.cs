using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Meridian.Models;
using Microsoft.AspNetCore.Identity;
using System.Linq;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Meridian.Domain.Entities;
using Meridian.Helpers;

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

        private async Task RefreshSignInAsync(User user)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.GivenName, user.Name),
                new Claim(ClaimTypes.Surname, user.Surname),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim("OrganizationId", user.OrganizationId.ToString())
            };

            var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var authenticateResult = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            var authProperties = authenticateResult?.Properties ?? new AuthenticationProperties();

            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity), authProperties);
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
                    Email = user.Email,
                    IsTwoFactorEnabled = user.IsTwoFactorEnabled
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
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateProfileSettings([FromForm] SettingsProfileViewModel model)
        {
            if (!ModelState.IsValid)
            {
                var errors = string.Join(" ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
                return BadRequest(string.IsNullOrWhiteSpace(errors) ? "Girdiğiniz veriler geçersiz." : errors);
            }
            
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
            await RefreshSignInAsync(user);
            return Ok(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteAccount([FromForm] string password)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            var hasher = new PasswordHasher<User>();
            var verify = hasher.VerifyHashedPassword(user, user.PasswordHash, password);
            if (verify != PasswordVerificationResult.Success)
                return BadRequest("Şifreniz yanlış.");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateAccountSettings([FromForm] SettingsAccountViewModel model)
        {
            if (!ModelState.IsValid)
            {
                var errors = string.Join(" ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
                return BadRequest(string.IsNullOrWhiteSpace(errors) ? "Girdiğiniz veriler geçersiz." : errors);
            }

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            bool emailChanged = user.Email != model.Email;
            bool passwordChanged = !string.IsNullOrEmpty(model.NewPassword);

            if (emailChanged || passwordChanged)
            {
                if (string.IsNullOrEmpty(model.CurrentPassword))
                {
                    return BadRequest(emailChanged 
                        ? "Güvenliğiniz için e-posta adresinizi değiştirirken mevcut şifrenizi de girmelisiniz." 
                        : "Şifre değiştirmek için mevcut şifrenizi girmelisiniz.");
                }

                var hasher = new PasswordHasher<User>();
                var verify = hasher.VerifyHashedPassword(user, user.PasswordHash, model.CurrentPassword);
                
                if (verify != PasswordVerificationResult.Success)
                    return BadRequest("Mevcut şifreniz yanlış.");
            }

            if (emailChanged)
            {
                if (await _context.Users.AnyAsync(u => u.Email == model.Email && u.Id != userId))
                    return BadRequest("Bu e-posta adresi zaten kullanımda.");
                    
                user.Email = model.Email;
            }

            if (passwordChanged)
            {
                if (model.NewPassword != model.ConfirmNewPassword)
                    return BadRequest("Yeni şifreler eşleşmiyor.");
                    
                var hasher = new PasswordHasher<User>();
                user.PasswordHash = hasher.HashPassword(user, model.NewPassword);
            }

            await _context.SaveChangesAsync();
            
            if (emailChanged || passwordChanged)
            {
                await RefreshSignInAsync(user);
            }

            return Ok(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateAppearanceSettings([FromForm] SettingsAppearanceViewModel model)
        {
            if (!ModelState.IsValid) return BadRequest("Geçersiz görünüm ayarları.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.ThemePreference = model.ThemePreference;
            // user.ProjectCardViewPreference removed from settings
            // user.AutoHideMenuPreference removed from settings

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateNotificationsSettings([FromForm] SettingsNotificationsViewModel model)
        {
            if (!ModelState.IsValid) return BadRequest("Geçersiz bildirim ayarları.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // removed
            user.NotifyOnTaskAssignmentApp = model.NotifyOnTaskAssignmentApp;
            // removed
            user.NotifyOnMentionApp = model.NotifyOnMentionApp;
            user.UpcomingDeadlineReminderDays = model.UpcomingDeadlineReminderDays ?? "3";

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateAdvancedSettings([FromForm] SettingsAdvancedViewModel model)
        {
            if (!ModelState.IsValid) return BadRequest("Geçersiz gelişmiş ayarlar.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.EnableExperimentalFeatures = model.EnableExperimentalFeatures;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpGet]
        public async Task<IActionResult> Get2FASecret()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (string.IsNullOrEmpty(user.TwoFactorSecret) || user.TwoFactorSecret.Length < 32 || user.TwoFactorSecret.Contains("="))
            {
                user.TwoFactorSecret = TotpHelper.GenerateSecret();
                await _context.SaveChangesAsync();
            }

            string issuer = Uri.EscapeDataString("MeridianApp");
            string email = string.IsNullOrWhiteSpace(user.Email) ? user.Username : user.Email;
            string encodedUser = Uri.EscapeDataString(email);
            
            string qrcodeUrl = $"otpauth://totp/MeridianApp:{encodedUser}?secret={user.TwoFactorSecret}&issuer={issuer}";
            return Ok(new { success = true, secret = user.TwoFactorSecret, qrcodeUrl });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Enable2FA([FromForm] string code)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();
            var user = await _context.Users.FindAsync(userId);
            if (user == null || string.IsNullOrEmpty(user.TwoFactorSecret)) return NotFound();

            bool isCodeValid = TotpHelper.ValidateCode(user.TwoFactorSecret, code);
            if (!isCodeValid) return BadRequest("Kod yanlış veya süresi dolmuş.");

            user.IsTwoFactorEnabled = true;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Disable2FA()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.IsTwoFactorEnabled = false;
            user.TwoFactorSecret = null;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
