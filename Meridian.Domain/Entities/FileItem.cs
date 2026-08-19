namespace Meridian.Domain.Entities;

public class FileItem
{
    public int Id { get; set; }

    [Required]
    public int OrganizationId { get; set; }
    public virtual Organization? Organization { get; set; }

    public int? FolderId { get; set; }
    public virtual Folder? Folder { get; set; }

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string? Extension { get; set; }
    
    public long SizeInBytes { get; set; }

    [Required]
    [MaxLength(2000)]
    public string FileUrl { get; set; } = string.Empty; // Cloudflare R2 Public URL
    
    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty; // "application/pdf"

    public int UploadedById { get; set; }
    public virtual User? UploadedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    
    public bool IsProtected { get; set; } = false;
}
