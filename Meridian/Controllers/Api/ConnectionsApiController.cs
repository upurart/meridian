using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Meridian.Domain.Entities;
using Meridian.Infrastructure.Persistence;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Meridian.Controllers.Api
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ConnectionsApiController : BaseApiController
    {
        private readonly Microsoft.AspNetCore.SignalR.IHubContext<Meridian.Hubs.ChatHub> _chatHub;

        public ConnectionsApiController(AppDbContext context, Microsoft.AspNetCore.SignalR.IHubContext<Meridian.Hubs.ChatHub> chatHub) : base(context) 
        { 
            _chatHub = chatHub;
        }

        private async Task NotifyUsers(params int[] userIds)
        {
            var ids = userIds.Select(id => id.ToString()).ToList();
            await _chatHub.Clients.Users(ids).SendAsync("ConnectionUpdated");
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAllConnections()
        {
            var connections = await _context.UserConnections
                .Include(c => c.Requester)
                .Include(c => c.Receiver)
                .Where(c => (c.RequesterId == CurrentUserId || c.ReceiverId == CurrentUserId) && c.Status == ConnectionStatus.Accepted)
                .Select(c => new
                {
                    ConnectionId = c.Id,
                    OtherUser = c.RequesterId == CurrentUserId ? 
                        new { c.Receiver!.Id, c.Receiver.Name, c.Receiver.Surname, c.Receiver.Username, c.Receiver.AvatarUrl, c.Receiver.JobTitle } : 
                        new { c.Requester!.Id, c.Requester.Name, c.Requester.Surname, c.Requester.Username, c.Requester.AvatarUrl, c.Requester.JobTitle },
                    CreatedAt = c.CreatedAt
                })
                .ToListAsync();

            return Ok(connections);
        }

        [HttpGet("incoming")]
        public async Task<IActionResult> GetIncomingRequests()
        {
            var incoming = await _context.UserConnections
                .Include(c => c.Requester)
                .Where(c => c.ReceiverId == CurrentUserId && c.Status == ConnectionStatus.Pending)
                .Select(c => new
                {
                    ConnectionId = c.Id,
                    Requester = new { c.Requester!.Id, c.Requester.Name, c.Requester.Surname, c.Requester.Username, c.Requester.AvatarUrl, c.Requester.JobTitle },
                    CreatedAt = c.CreatedAt
                })
                .ToListAsync();

            return Ok(incoming);
        }

        [HttpGet("outgoing")]
        public async Task<IActionResult> GetOutgoingRequests()
        {
            var outgoing = await _context.UserConnections
                .Include(c => c.Receiver)
                .Where(c => c.RequesterId == CurrentUserId && c.Status == ConnectionStatus.Pending)
                .Select(c => new
                {
                    ConnectionId = c.Id,
                    Receiver = new { c.Receiver!.Id, c.Receiver.Name, c.Receiver.Surname, c.Receiver.Username, c.Receiver.AvatarUrl, c.Receiver.JobTitle },
                    CreatedAt = c.CreatedAt
                })
                .ToListAsync();

            return Ok(outgoing);
        }

        [HttpPost("request/{receiverUsername}")]
        public async Task<IActionResult> SendRequest(string receiverUsername)
        {
            var receiver = await _context.Users.FirstOrDefaultAsync(u => u.Username == receiverUsername || u.Email == receiverUsername);
            if (receiver == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

            if (receiver.Id == CurrentUserId) return BadRequest(new { message = "Kendinize bağlantı isteği gönderemezsiniz." });

            var existingConnection = await _context.UserConnections
                .FirstOrDefaultAsync(c => (c.RequesterId == CurrentUserId && c.ReceiverId == receiver.Id) || 
                                          (c.RequesterId == receiver.Id && c.ReceiverId == CurrentUserId));

            if (existingConnection != null)
            {
                if (existingConnection.Status == ConnectionStatus.Pending) return BadRequest(new { message = "Zaten bekleyen bir istek var." });
                if (existingConnection.Status == ConnectionStatus.Accepted) return BadRequest(new { message = "Bu kullanıcı ile zaten bağlantınız var." });
                if (existingConnection.Status == ConnectionStatus.Blocked) return BadRequest(new { message = "Bu kullanıcıyla bağlantı kuramazsınız." });
                
                // If rejected previously, we could allow sending again, but for now we'll just create a new one or update
                if (existingConnection.Status == ConnectionStatus.Rejected)
                {
                    existingConnection.Status = ConnectionStatus.Pending;
                    existingConnection.RequesterId = CurrentUserId;
                    existingConnection.ReceiverId = receiver.Id;
                    existingConnection.UpdatedAt = System.DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    await NotifyUsers(CurrentUserId, receiver.Id);
                    return Ok(new { message = "İstek başarıyla gönderildi." });
                }
            }

            var newConnection = new UserConnection
            {
                RequesterId = CurrentUserId,
                ReceiverId = receiver.Id,
                Status = ConnectionStatus.Pending
            };

            _context.UserConnections.Add(newConnection);
            await _context.SaveChangesAsync();

            await NotifyUsers(CurrentUserId, receiver.Id);

            return Ok(new { message = "İstek başarıyla gönderildi." });
        }

        [HttpPost("accept/{connectionId}")]
        public async Task<IActionResult> AcceptRequest(int connectionId)
        {
            var connection = await _context.UserConnections.FirstOrDefaultAsync(c => c.Id == connectionId && c.ReceiverId == CurrentUserId);
            if (connection == null) return NotFound(new { message = "İstek bulunamadı veya yetkisiz işlem." });

            if (connection.Status != ConnectionStatus.Pending) return BadRequest(new { message = "Sadece bekleyen istekler onaylanabilir." });

            connection.Status = ConnectionStatus.Accepted;
            connection.UpdatedAt = System.DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await NotifyUsers(connection.RequesterId, connection.ReceiverId);

            return Ok(new { message = "İstek onaylandı." });
        }

        [HttpPost("reject/{connectionId}")]
        public async Task<IActionResult> RejectRequest(int connectionId)
        {
            var connection = await _context.UserConnections.FirstOrDefaultAsync(c => c.Id == connectionId && c.ReceiverId == CurrentUserId);
            if (connection == null) return NotFound(new { message = "İstek bulunamadı veya yetkisiz işlem." });

            if (connection.Status != ConnectionStatus.Pending) return BadRequest(new { message = "Sadece bekleyen istekler reddedilebilir." });

            connection.Status = ConnectionStatus.Rejected;
            connection.UpdatedAt = System.DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await NotifyUsers(connection.RequesterId, connection.ReceiverId);

            return Ok(new { message = "İstek reddedildi." });
        }

        [HttpDelete("remove/{connectionId}")]
        public async Task<IActionResult> RemoveConnection(int connectionId)
        {
            var connection = await _context.UserConnections.FirstOrDefaultAsync(c => c.Id == connectionId && (c.RequesterId == CurrentUserId || c.ReceiverId == CurrentUserId));
            if (connection == null) return NotFound(new { message = "Bağlantı bulunamadı veya yetkisiz işlem." });

            _context.UserConnections.Remove(connection);
            await _context.SaveChangesAsync();
            await NotifyUsers(connection.RequesterId, connection.ReceiverId);

            return Ok(new { message = "Bağlantı kaldırıldı." });
        }
        
        [HttpPost("block/{connectionId}")]
        public async Task<IActionResult> BlockConnection(int connectionId)
        {
            var connection = await _context.UserConnections.FirstOrDefaultAsync(c => c.Id == connectionId && (c.RequesterId == CurrentUserId || c.ReceiverId == CurrentUserId));
            if (connection == null) return NotFound(new { message = "Bağlantı bulunamadı veya yetkisiz işlem." });

            connection.Status = ConnectionStatus.Blocked;
            connection.UpdatedAt = System.DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await NotifyUsers(connection.RequesterId, connection.ReceiverId);

            return Ok(new { message = "Bağlantı engellendi." });
        }
    }
}
