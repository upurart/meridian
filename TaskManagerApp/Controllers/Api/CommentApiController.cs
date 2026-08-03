using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagerApp.Models;

using Microsoft.AspNetCore.SignalR;
using TaskManagerApp.Hubs;

namespace TaskManagerApp.Controllers.Api
{
    [Route("api/[controller]")]
    [ApiController]
    public class CommentApiController : BaseApiController
    {
        private readonly IHubContext<CommentHub> _hubContext;

        public CommentApiController(AppDbContext context, IHubContext<CommentHub> hubContext) : base(context)
        {
            _hubContext = hubContext;
        }

        public class AttachmentDto
        {
            public string FileUrl { get; set; } = string.Empty;
            public string FileName { get; set; } = string.Empty;
            public string FileType { get; set; } = string.Empty;
            public long FileSize { get; set; }
        }

        public class CommentDto
        {
            public string EntityType { get; set; } = string.Empty;
            public int EntityId { get; set; }
            public string Content { get; set; } = string.Empty;
            public List<AttachmentDto>? Attachments { get; set; }
            public int? ReplyToId { get; set; }
            public bool IsForwarded { get; set; } = false;
        }

        [HttpGet("{entityType}/{entityId}")]
        public async Task<IActionResult> GetComments(string entityType, int entityId)
        {
            if (!await IsAuthorizedForEntityAsync(entityType, entityId)) return Forbid();

            int currentUserId = CurrentUserId;

            var comments = await _context.Comments
                .Where(c => c.EntityType == entityType && c.EntityId == entityId)
                .Include(c => c.User)
                .Include(c => c.Attachments)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Content,
                    c.CreatedAt,
                    c.UpdatedAt,
                    c.UserId,
                    c.ReplyToId,
                    c.IsForwarded,
                    ReplyToContent = c.ReplyToComment != null ? c.ReplyToComment.Content : null,
                    ReplyToUser = c.ReplyToComment != null ? c.ReplyToComment.User!.Name + " " + c.ReplyToComment.User.Surname : null,
                    ReplyToAttachments = c.ReplyToComment != null ? c.ReplyToComment.Attachments.Select(a => new {
                        a.FileUrl,
                        a.FileType
                    }).ToList() : null,
                    User = new
                    {
                        c.User!.Id,
                        c.User.Name,
                        c.User.Surname,
                        c.User.Email,
                        c.User.Username
                    },
                    Attachments = c.Attachments.Select(a => new {
                        a.Id,
                        a.FileUrl,
                        a.FileName,
                        a.FileType,
                        a.FileSize
                    }),
                    IsCurrentUser = c.UserId == currentUserId
                })
                .ToListAsync();

            return Ok(comments);
        }

        [HttpPost]
        public async Task<IActionResult> PostComment([FromBody] CommentDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content) && (dto.Attachments == null || !dto.Attachments.Any())) 
                return BadRequest("Yorum boş olamaz.");

            if (!await IsAuthorizedForEntityAsync(dto.EntityType, dto.EntityId)) return Forbid();
            
            int currentUserId = CurrentUserId;

            var comment = new Comment
            {
                EntityType = dto.EntityType,
                EntityId = dto.EntityId,
                Content = dto.Content ?? string.Empty,
                UserId = currentUserId,
                CreatedAt = DateTime.Now,
                ReplyToId = dto.ReplyToId,
                IsForwarded = dto.IsForwarded
            };

            if (dto.Attachments != null && dto.Attachments.Any())
            {
                foreach (var att in dto.Attachments)
                {
                    comment.Attachments.Add(new CommentAttachment
                    {
                        FileUrl = att.FileUrl,
                        FileName = att.FileName,
                        FileType = att.FileType,
                        FileSize = att.FileSize,
                        UploadedAt = DateTime.Now
                    });
                }
            }

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();
            
            // Reload with ReplyToComment for SignalR
            if (comment.ReplyToId.HasValue)
            {
                await _context.Entry(comment).Reference(c => c.ReplyToComment).Query()
                    .Include(c => c.User)
                    .Include(c => c.Attachments)
                    .LoadAsync();
            }

            // Fetch the user to return the full object
            var user = await _context.Users.FindAsync(currentUserId);

            var result = new
            {
                comment.Id,
                comment.Content,
                comment.CreatedAt,
                comment.UpdatedAt,
                comment.UserId,
                User = new
                {
                    Id = user!.Id,
                    Name = user.Name,
                    Surname = user.Surname,
                    Email = user.Email,
                    Username = user.Username
                },
                comment.ReplyToId,
                comment.IsForwarded,
                ReplyToContent = comment.ReplyToComment?.Content,
                ReplyToUser = comment.ReplyToComment != null ? comment.ReplyToComment.User!.Name + " " + comment.ReplyToComment.User.Surname : null,
                ReplyToAttachments = comment.ReplyToComment != null ? comment.ReplyToComment.Attachments.Select(a => new {
                    a.FileUrl,
                    a.FileType
                }).ToList() : null,
                Attachments = comment.Attachments.Select(a => new {
                    a.Id,
                    a.FileUrl,
                    a.FileName,
                    a.FileType,
                    a.FileSize
                }).ToList(),
                IsCurrentUser = true
            };

            // SignalR broadcast
            int projectId = await GetProjectIdForEntity(dto.EntityType, dto.EntityId);
            if (projectId > 0)
            {
                var broadcastResult = new
                {
                    comment.Id,
                    comment.Content,
                    comment.CreatedAt,
                    comment.UpdatedAt,
                    comment.UserId,
                    User = new
                    {
                        Id = user.Id,
                        Name = user.Name,
                        Surname = user.Surname,
                        Email = user.Email,
                        Username = user.Username
                    },
                    Attachments = comment.Attachments.Select(a => new {
                        a.Id,
                        a.FileUrl,
                        a.FileName,
                        a.FileType,
                        a.FileSize
                    }).ToList(),
                    IsCurrentUser = false
                };
                await _hubContext.Clients.Group($"Project_{projectId}").SendAsync("ReceiveComment", dto.EntityType, dto.EntityId, broadcastResult);
            }

            return Ok(result);
        }

        private async Task<bool> IsAuthorizedForEntityAsync(string entityType, int entityId)
        {
            int projectId = await GetProjectIdForEntity(entityType, entityId);
            if (projectId > 0)
            {
                return await IsAuthorizedForProjectAsync(projectId);
            }
            return false;
        }

        private async Task<int> GetProjectIdForEntity(string entityType, int entityId)
        {
            if (entityType == "Project") return entityId;
            if (entityType == "MainGoal")
            {
                var mg = await _context.MainGoals.FindAsync(entityId);
                return mg?.ProjectId ?? 0;
            }
            if (entityType == "SubGoal")
            {
                var sg = await _context.SubGoals.Include(s => s.MainGoal).FirstOrDefaultAsync(s => s.Id == entityId);
                return sg?.MainGoal?.ProjectId ?? 0;
            }
            if (entityType == "TaskItem")
            {
                var task = await _context.TaskItems
                    .Include(t => t.MainGoal)
                    .Include(t => t.SubGoal).ThenInclude(s => s.MainGoal)
                    .FirstOrDefaultAsync(t => t.Id == entityId);
                
                if (task != null)
                {
                    if (task.ProjectId.HasValue && task.ProjectId.Value > 0) return task.ProjectId.Value;
                    return task.MainGoal?.ProjectId ?? task.SubGoal?.MainGoal?.ProjectId ?? 0;
                }
            }
            return 0;
        }

        [HttpPost("Upload")]
        public async Task<IActionResult> UploadFiles([FromForm] List<IFormFile> files)
        {
            if (files == null || files.Count == 0) return BadRequest("Dosya seçilmedi.");
            
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "chat");
            if (!Directory.Exists(uploadsDir)) Directory.CreateDirectory(uploadsDir);

            var uploadedFiles = new List<AttachmentDto>();

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".zip", ".rar" };

            foreach (var file in files)
            {
                if (file.Length == 0) continue;
                if (file.Length > 10 * 1024 * 1024) return BadRequest("Dosya boyutu 10MB'dan büyük olamaz."); // 10 MB limit

                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (string.IsNullOrEmpty(ext) || !allowedExtensions.Contains(ext))
                {
                    return BadRequest($"Desteklenmeyen dosya türü: {ext}");
                }

                var newName = Guid.NewGuid().ToString() + ext;
                var filePath = Path.Combine(uploadsDir, newName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var isImage = file.ContentType.StartsWith("image/");

                uploadedFiles.Add(new AttachmentDto
                {
                    FileName = file.FileName,
                    FileUrl = $"/uploads/chat/{newName}",
                    FileType = isImage ? "image" : "file",
                    FileSize = file.Length
                });
            }

            return Ok(uploadedFiles);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteComment(int id)
        {
            var comment = await _context.Comments.FindAsync(id);
            if (comment == null) return NotFound("Yorum bulunamadı.");

            if (comment.UserId != CurrentUserId)
            {
                return Forbid();
            }

            var entityType = comment.EntityType;
            var entityId = comment.EntityId;

            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();

            int projectId = await GetProjectIdForEntity(entityType, entityId);
            if (projectId > 0)
            {
                await _hubContext.Clients.Group($"Project_{projectId}").SendAsync("CommentDeleted", entityType, entityId, id);
            }

            return Ok(new { message = "Yorum silindi." });
        }

        public class ForwardDto
        {
            public string TargetEntityType { get; set; } = string.Empty;
            public int TargetEntityId { get; set; }
        }

        [HttpPost("Forward/{id}")]
        public async Task<IActionResult> ForwardComment(int id, [FromBody] ForwardDto forwardDto)
        {
            var original = await _context.Comments
                .Include(c => c.Attachments)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (original == null) return NotFound("Yorum bulunamadı.");
            if (!await IsAuthorizedForEntityAsync(forwardDto.TargetEntityType, forwardDto.TargetEntityId)) return Forbid();

            int currentUserId = CurrentUserId;

            var newComment = new Comment
            {
                EntityType = forwardDto.TargetEntityType,
                EntityId = forwardDto.TargetEntityId,
                Content = original.Content,
                UserId = currentUserId,
                CreatedAt = DateTime.Now,
                IsForwarded = true
            };

            foreach (var att in original.Attachments)
            {
                newComment.Attachments.Add(new CommentAttachment
                {
                    FileUrl = att.FileUrl,
                    FileName = att.FileName,
                    FileType = att.FileType,
                    FileSize = att.FileSize,
                    UploadedAt = DateTime.Now
                });
            }

            _context.Comments.Add(newComment);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(currentUserId);
            var result = new
            {
                newComment.Id,
                newComment.Content,
                newComment.CreatedAt,
                newComment.UpdatedAt,
                newComment.UserId,
                User = new
                {
                    Id = user!.Id,
                    Name = user.Name,
                    Surname = user.Surname,
                    Email = user.Email,
                    Username = user.Username
                },
                newComment.ReplyToId,
                newComment.IsForwarded,
                ReplyToContent = (string?)null,
                ReplyToUser = (string?)null,
                ReplyToAttachments = (object?)null,
                Attachments = newComment.Attachments.Select(a => new {
                    a.Id,
                    a.FileUrl,
                    a.FileName,
                    a.FileType,
                    a.FileSize
                }).ToList(),
                IsCurrentUser = true
            };

            int projectId = await GetProjectIdForEntity(forwardDto.TargetEntityType, forwardDto.TargetEntityId);
            if (projectId > 0)
            {
                await _hubContext.Clients.Group($"Project_{projectId}").SendAsync("ReceiveComment", forwardDto.TargetEntityType, forwardDto.TargetEntityId, result);
            }

            return Ok(result);
        }
    }
}
