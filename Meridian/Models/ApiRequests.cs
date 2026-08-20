using System.ComponentModel.DataAnnotations;

namespace Meridian.Models
{
    // TeamApiController Requests
    public class CreateTeamRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsOpenToJoin { get; set; } = true;
        public string? Password { get; set; }
        public int? DepartmentId { get; set; }
    }

    public class JoinTeamRequest
    {
        public int TeamId { get; set; }
        public string? Password { get; set; }
        public string? InviteCode { get; set; }
    }

    public class UpdateRoleRequest
    {
        public string Role { get; set; } = string.Empty;
    }

    public class RespondRequest
    {
        public string Action { get; set; } = string.Empty; // Onayla / Reddet
    }

    // UserApiController Requests
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

    // FileManagerApiController Requests
    public class CreateFolderRequest
    {
        public string Name { get; set; } = string.Empty;
        public int? ParentFolderId { get; set; }
    }

    public class RenameRequest { 
        public string Type { get; set; } = string.Empty;
        public int Id { get; set; } 
        public string NewName { get; set; } = string.Empty;
    }

    public class PasteRequest {
        public string Action { get; set; } = string.Empty;
        public int? TargetFolderId { get; set; }
        public List<PasteItem> Items { get; set; } = new();
    }

    public class PasteItem { 
        public string Type { get; set; } = string.Empty;
        public int Id { get; set; } 
    }

    public class DownloadRequest {
        public List<PasteItem> Items { get; set; } = new();
    }

    public class RestoreRequest {
        public List<PasteItem> Items { get; set; } = new();
    }
    
    public class ProtectRequest {
        public List<PasteItem> Items { get; set; } = new();
        public bool IsProtected { get; set; }
    }
}
