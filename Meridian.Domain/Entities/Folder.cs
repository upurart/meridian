namespace Meridian.Domain.Entities;

public class Folder
{
    public int Id { get; set; }

    [Required]
    public int OrganizationId { get; set; }
    public virtual Organization? Organization { get; set; }

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    public int? ParentFolderId { get; set; }
    public virtual Folder? ParentFolder { get; set; }
    public virtual ICollection<Folder> SubFolders { get; set; } = new List<Folder>();

    // These link the folder to the specific workspace or project if auto-generated
    public int? WorkspaceId { get; set; }
    public virtual Workspace? Workspace { get; set; }

    public int? ProjectId { get; set; }
    public virtual Project? Project { get; set; }

    // Differentiates system-generated folders (like the root "Çalışma Alanları" or Workspace folders) 
    // from user-created manual folders.
    public bool IsSystemFolder { get; set; } = false;

    public int CreatedById { get; set; }
    public virtual User? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    
    public bool IsProtected { get; set; } = false;

    public virtual ICollection<FileItem> Files { get; set; } = new List<FileItem>();
}
