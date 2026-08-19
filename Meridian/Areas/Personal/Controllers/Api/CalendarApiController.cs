using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;

namespace Meridian.Controllers
{
    [Route("api/calendar")]
    public class CalendarApiController : BaseApiController
    {
        public CalendarApiController(AppDbContext context) : base(context) { }

        [HttpGet]
        public async Task<IActionResult> GetEvents()
        {
            var events = await _context.CalendarEvents
                .Where(e => e.UserId == CurrentUserId)
                .Select(e => new
                {
                    id = e.Id,
                    title = e.Title,
                    description = e.Description,
                    startDate = e.StartDate,
                    endDate = e.EndDate,
                    color = e.Color
                })
                .ToListAsync();

            return Ok(events);
        }

        public class CalendarEventUpsertReq
        {
            public string Title { get; set; } = string.Empty;
            public string? Description { get; set; }
            public DateTime StartDate { get; set; }
            public DateTime EndDate { get; set; }
            public string? Color { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> CreateEvent([FromBody] CalendarEventUpsertReq req)
        {
            if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Başlık zorunludur.");

            var ev = new CalendarEvent
            {
                UserId = CurrentUserId,
                Title = req.Title.Trim(),
                Description = req.Description?.Trim(),
                StartDate = req.StartDate,
                EndDate = req.EndDate,
                Color = req.Color,
                CreatedAt = DateTime.Now
            };

            _context.CalendarEvents.Add(ev);
            await _context.SaveChangesAsync();
            
            return Ok(new { success = true, id = ev.Id });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateEvent(int id, [FromBody] CalendarEventUpsertReq req)
        {
            if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Başlık zorunludur.");

            var ev = await _context.CalendarEvents.FirstOrDefaultAsync(e => e.Id == id && e.UserId == CurrentUserId);
            if (ev == null) return NotFound();

            ev.Title = req.Title.Trim();
            ev.Description = req.Description?.Trim();
            ev.StartDate = req.StartDate;
            ev.EndDate = req.EndDate;
            ev.Color = req.Color;

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEvent(int id)
        {
            var ev = await _context.CalendarEvents.FirstOrDefaultAsync(e => e.Id == id && e.UserId == CurrentUserId);
            if (ev == null) return NotFound();

            _context.CalendarEvents.Remove(ev);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}

