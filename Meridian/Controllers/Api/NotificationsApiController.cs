using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Meridian.Domain.Entities;
using Meridian.Infrastructure.Persistence;

namespace Meridian.Controllers.Api
{
    [Route("api/notifications")]
    public class NotificationsApiController : BaseApiController
    {
        public NotificationsApiController(AppDbContext context) : base(context)
        {
        }

        [HttpGet]
        public async Task<IActionResult> GetMyNotifications()
        {
            int userId = CurrentUserId;
            if (userId <= 0) return Unauthorized();

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .Select(n => new {
                    n.Id,
                    n.Type,
                    n.Title,
                    n.Message,
                    n.LinkUrl,
                    n.ReferenceData,
                    n.IsRead,
                    n.CreatedAt,
                    Issuer = n.IssuerId != null ? new { n.Issuer.Name, n.Issuer.Surname, n.Issuer.AvatarUrl } : null
                })
                .ToListAsync();

            var unreadCount = await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

            return Ok(new { unreadCount, notifications });
        }

        [HttpPost("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = CurrentUserId;
            var notification = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
            if (notification == null) return NotFound();

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true });
        }

        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = CurrentUserId;
            var unreadNotifications = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            if (unreadNotifications.Any())
            {
                unreadNotifications.ForEach(n => n.IsRead = true);
                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = CurrentUserId;
            var notification = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
            if (notification == null) return NotFound();

            _context.Notifications.Remove(notification);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
    }
}
