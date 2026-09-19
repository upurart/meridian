using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Meridian.Models;
using Microsoft.Extensions.Caching.Memory;
using Meridian.Domain.Entities;
using Meridian.Helpers;

namespace Meridian.Areas.Onboarding.Controllers
{
    [Area("Onboarding")]
    public class AccountController : Controller
    {
        private readonly AppDbContext _context;
        private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
        private readonly Meridian.Services.IOnboardingService _onboardingService;
        private readonly IEmailSender _emailSender;

        public AccountController(AppDbContext context, Microsoft.Extensions.Caching.Memory.IMemoryCache cache, IEmailSender emailSender, Meridian.Services.IOnboardingService onboardingService)
        {
            _context = context;
            _cache = cache;
            _emailSender = emailSender;
            _onboardingService = onboardingService;
        }

        // GET: Account/Login
        [HttpGet]
        public IActionResult Login()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Index", "Home", new { area = "Personal" });
            }
            return View();
        }

        // POST: Account/Login
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (!ModelState.IsValid) return View(model);

            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var cacheKey = $"login_attempts_{ipAddress}";

            if (_cache.TryGetValue(cacheKey, out int attempts) && attempts >= 5)
            {
                ModelState.AddModelError(string.Empty, "Çok fazla hatalı giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.");
                return View(model);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == model.Username || u.Email == model.Username);
            if (user != null)
            {
                var hasher = new PasswordHasher<User>();
                var verificationResult = hasher.VerifyHashedPassword(user, user.PasswordHash, model.Password);

                if (verificationResult == PasswordVerificationResult.Success)
                {
                    _cache.Remove(cacheKey);

                    if (user.IsTwoFactorEnabled)
                    {
                        TempData["2FA_UserId"] = user.Id.ToString();
                        TempData["2FA_RememberMe"] = model.RememberMe.ToString();
                        return RedirectToAction("Verify2FA");
                    }
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

                    var authProperties = new AuthenticationProperties
                    {
                        IsPersistent = model.RememberMe
                    };

                    await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity), authProperties);

                    return RedirectToAction("Index", "Home", new { area = "Personal" });
                }
            }

            attempts = _cache.TryGetValue(cacheKey, out int currentAttempts) ? currentAttempts + 1 : 1;
            _cache.Set(cacheKey, attempts, TimeSpan.FromMinutes(15));

            ModelState.AddModelError(string.Empty, "Geçersiz kullanıcı adı veya şifre.");
            return View(model);
        }

        // GET: Account/Register
        [HttpGet]
        public IActionResult Register()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Index", "Home", new { area = "Personal" });
            }
            return View();
        }

        // POST: Account/Register
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register(RegisterViewModel model)
        {
            if (!ModelState.IsValid) return View(model);

            // Kullanıcı adı/Email kullanımda mı?
            if (await _context.Users.AnyAsync(u => u.Username == model.Username))
            {
                ModelState.AddModelError("Username", "Bu kullanıcı adı zaten alınmış.");
                return View(model);
            }

            if (await _context.Users.AnyAsync(u => u.Email == model.Email))
            {
                ModelState.AddModelError("Email", "Bu e-posta adresi zaten kullanımda.");
                return View(model);
            }

            var success = await _onboardingService.RegisterUserAsync(model);
            if (!success)
            {
                ModelState.AddModelError("", "Kayıt işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.");
                return View(model);
            }

            return RedirectToAction("Login");
        }

        [HttpGet]
        public IActionResult ForgotPassword()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordViewModel model)
        {
            if (!ModelState.IsValid) return View(model);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email);
            if (user == null)
            {
                // Kullanıcı olmadığını belli etme
                return RedirectToAction("ForgotPasswordConfirmation");
            }

            var token = Guid.NewGuid().ToString();
            user.ResetPasswordToken = token;
            user.ResetPasswordTokenExpiry = DateTime.UtcNow.AddHours(2);
            await _context.SaveChangesAsync();

            var resetLink = Url.Action("ResetPassword", "Account", new { token, email = user.Email }, Request.Scheme);
            var message = $"Şifrenizi sıfırlamak için lütfen bu bağlantıya tıklayın: <a href=\"{resetLink}\">Şifremi Sıfırla</a>";

            await _emailSender.SendEmailAsync(model.Email, "Şifre Sıfırlama Talebi", message);

            return RedirectToAction("ForgotPasswordConfirmation");
        }

        [HttpGet]
        public IActionResult ForgotPasswordConfirmation()
        {
            return View();
        }

        [HttpGet]
        public IActionResult ResetPassword(string token, string email)
        {
            if (token == null || email == null)
            {
                return BadRequest("Geçersiz şifre sıfırlama isteği.");
            }
            return View(new ResetPasswordViewModel { Token = token, Email = email });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetPassword(ResetPasswordViewModel model)
        {
            if (!ModelState.IsValid) return View(model);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email && u.ResetPasswordToken == model.Token);
            if (user == null || user.ResetPasswordTokenExpiry < DateTime.UtcNow)
            {
                ModelState.AddModelError(string.Empty, "Geçersiz veya süresi dolmuş bir şifre sıfırlama bağlantısı.");
                return View(model);
            }

            var hasher = new PasswordHasher<User>();
            user.PasswordHash = hasher.HashPassword(user, model.NewPassword);
            user.ResetPasswordToken = null;
            user.ResetPasswordTokenExpiry = null;

            await _context.SaveChangesAsync();

            return RedirectToAction("ResetPasswordConfirmation");
        }

        [HttpGet]
        public IActionResult ResetPasswordConfirmation()
        {
            return View();
        }

        // GET: Account/Logout
        [HttpGet]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction("Login");
        }



        [HttpGet]
        [AllowAnonymous]
        public IActionResult Verify2FA()
        {
            if (TempData["2FA_UserId"] == null) return RedirectToAction("Login");
            TempData.Keep("2FA_UserId");
            TempData.Keep("2FA_RememberMe");
            return View();
        }

        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Verify2FA(string code)
        {
            var userIdStr = TempData["2FA_UserId"]?.ToString();
            if (userIdStr == null || !int.TryParse(userIdStr, out int userId)) return RedirectToAction("Login");

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return RedirectToAction("Login");

            if (!TotpHelper.ValidateCode(user.TwoFactorSecret ?? "", code))
            {
                ModelState.AddModelError(string.Empty, "Geçersiz veya süresi dolmuş kod.");
                TempData.Keep("2FA_UserId");
                TempData.Keep("2FA_RememberMe");
                return View();
            }

            bool rememberMe = TempData["2FA_RememberMe"]?.ToString() == "True";

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.GivenName, user.Name ?? ""),
                new Claim(ClaimTypes.Surname, user.Surname ?? ""),
                new Claim(ClaimTypes.Email, user.Email ?? ""),
                new Claim("OrganizationId", user.OrganizationId.ToString())
            };
            var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var authProperties = new AuthenticationProperties { IsPersistent = rememberMe };
            
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(claimsIdentity), authProperties);

            return RedirectToAction("Index", "Home", new { area = "Personal" });
        }
    }

}
