using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Meridian.Models;
using Microsoft.AspNetCore.SignalR;
using Meridian.Hubs;

namespace Meridian.Areas.Personal.Controllers.Api
{
    [Route("api/[controller]")]
    [Area("Personal")]
    [ApiController]
    [Authorize]
    public class UserApiController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IFileStorageService _storageService;
        private readonly IHubContext<ChatHub> _chatHubContext;

        public UserApiController(AppDbContext context, IFileStorageService storageService, IHubContext<ChatHub> chatHubContext)
        {
            _context = context;
            _storageService = storageService;
            _chatHubContext = chatHubContext;
        }

        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim.Value);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            return Ok(new
            {
                user.Name,
                user.Surname,
                user.Username,
                user.Email,
                user.AvatarUrl
            });
        }

        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim.Value);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // Check uniqueness of username and email
            if (user.Username != request.Username && await _context.Users.AnyAsync(u => u.Username == request.Username))
                return BadRequest("Bu kullanıcı adı zaten alınmış.");

            if (user.Email != request.Email && await _context.Users.AnyAsync(u => u.Email == request.Email))
                return BadRequest("Bu e-posta adresi zaten kullanımda.");

            user.Name = request.Name;
            user.Surname = request.Surname;
            user.Username = request.Username;
            user.Email = request.Email;

            await _context.SaveChangesAsync();
            
            // Broadcast profile update to all connected clients
            var profileData = new {
                userId = userId,
                name = user.Name,
                surname = user.Surname,
                username = user.Username,
                email = user.Email
            };
            await _chatHubContext.Clients.All.SendAsync("UserProfileUpdated", profileData);

            return Ok(new { success = true });
        }

        [HttpPut("password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim.Value);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            var hasher = new PasswordHasher<User>();

            // Verify current password
            var verificationResult = hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
            if (verificationResult == PasswordVerificationResult.Failed)
                return BadRequest("Mevcut şifreniz yanlış.");

            user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpPost("avatar")]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Lütfen bir resim seçin.");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            int userId = int.Parse(userIdClaim.Value);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            try
            {
                // Eski avatar varsa buluttan sil
                if (!string.IsNullOrEmpty(user.AvatarUrl))
                {
                    await _storageService.DeleteFileAsync(user.AvatarUrl);
                }

                // Yenisini yükle
                var url = await _storageService.UploadFileAsync(file, "avatars");
                
                user.AvatarUrl = url;
                await _context.SaveChangesAsync();

                // Broadcast avatar update to all connected clients
                await _chatHubContext.Clients.All.SendAsync("UserAvatarUpdated", userId, url);

                return Ok(new { success = true, url });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Dosya yüklenirken bir hata oluştu.", error = ex.Message });
            }
        }
        [AllowAnonymous]
        [HttpGet("avatar-proxy")]
        public async Task<IActionResult> GetAvatarProxy([FromQuery] string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return NotFound();

            try
            {
                var stream = await _storageService.GetFileStreamAsync(url);
                
                // Determine content type
                var contentType = "image/jpeg";
                var ext = Path.GetExtension(url).ToLowerInvariant();
                if (ext == ".png") contentType = "image/png";
                else if (ext == ".gif") contentType = "image/gif";
                else if (ext == ".webp") contentType = "image/webp";

                return File(stream, contentType);
            }
            catch (Exception ex)
            {
                return NotFound();
            }
        }

        [AllowAnonymous]
        [HttpGet("file-proxy")]
        public async Task<IActionResult> GetFileProxy([FromQuery] string url, [FromQuery] string filename = "")
        {
            if (string.IsNullOrWhiteSpace(url)) return NotFound();

            try
            {
                var stream = await _storageService.GetFileStreamAsync(url);
                
                var contentType = "application/octet-stream";
                var ext = Path.GetExtension(url).ToLowerInvariant();
                
                if (ext == ".pdf") contentType = "application/pdf";
                else if (ext == ".png") contentType = "image/png";
                else if (ext == ".jpg" || ext == ".jpeg") contentType = "image/jpeg";
                else if (ext == ".gif") contentType = "image/gif";
                else if (ext == ".zip") contentType = "application/zip";
                else if (ext == ".doc" || ext == ".docx" || url.Contains(".doc")) contentType = "application/msword";

                var finalName = string.IsNullOrWhiteSpace(filename) ? Path.GetFileName(url) : filename;
                
                return File(stream, contentType, finalName);
            }
            catch (Exception)
            {
                return NotFound();
            }
        }
    }

    public class UpdateProfileRequest
    {
        [Required, MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string Surname { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required, MaxLength(100), EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public class ChangePasswordRequest
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required, MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }
}

