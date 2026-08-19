using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Meridian.Application.Interfaces;
using Meridian.Domain.Entities;
using Meridian.Models;
using Meridian.Infrastructure.Persistence;

namespace Meridian.Controllers.Api
{
    [Route("api/filemanager")]
    public class FileManagerApiController : BaseApiController
    {
        private readonly IFileStorageService _storageService;

        public FileManagerApiController(AppDbContext context, IFileStorageService storageService) : base(context)
        {
            _storageService = storageService;
        }

        private async Task<int> GetCurrentOrganizationIdAsync()
        {
            return await _context.Users.Where(u => u.Id == CurrentUserId).Select(u => u.OrganizationId).FirstOrDefaultAsync();
        }

        [HttpGet("folder/{folderId?}")]
        public async Task<IActionResult> GetFolderContents(int? folderId)
        {
            var orgId = await GetCurrentOrganizationIdAsync();

            if (folderId == null)
            {
                var trashBin = await _context.Folders.FirstOrDefaultAsync(f => f.OrganizationId == orgId && f.Name == "Çöp Kutusu" && f.IsSystemFolder && f.ParentFolderId == null);
                if (trashBin == null)
                {
                    trashBin = new Folder
                    {
                        Name = "Çöp Kutusu",
                        OrganizationId = orgId,
                        IsSystemFolder = true,
                        ParentFolderId = null,
                        CreatedById = CurrentUserId,
                        CreatedAt = DateTime.Now
                    };
                    _context.Folders.Add(trashBin);
                    await _context.SaveChangesAsync();
                }
            }

            bool isTrashBinRequest = false;
            if (folderId != null)
            {
                var folderReq = await _context.Folders.FirstOrDefaultAsync(f => f.Id == folderId && f.OrganizationId == orgId);
                if (folderReq != null && folderReq.IsSystemFolder && folderReq.Name == "Çöp Kutusu")
                {
                    isTrashBinRequest = true;
                }
            }

            if (isTrashBinRequest)
            {
                var deletedFolders = await _context.Folders.IgnoreQueryFilters()
                    .Where(f => f.OrganizationId == orgId && f.IsDeleted)
                    .Select(f => new { f.Id, f.Name, f.IsSystemFolder, f.CreatedAt })
                    .OrderBy(f => f.Name)
                    .ToListAsync();

                var deletedFiles = await _context.FileItems.IgnoreQueryFilters()
                    .Where(fi => fi.OrganizationId == orgId && fi.IsDeleted)
                    .Select(fi => new { fi.Id, fi.Name, fi.FileUrl, fi.SizeInBytes, fi.Extension, fi.ContentType, fi.CreatedAt })
                    .OrderBy(fi => fi.Name)
                    .ToListAsync();

                return Ok(new { folders = deletedFolders, files = deletedFiles });
            }

            var folders = await _context.Folders.IgnoreQueryFilters()
                .Where(f => f.ParentFolderId == folderId && f.OrganizationId == orgId && !f.IsDeleted)
                .Select(f => new { f.Id, f.Name, f.IsSystemFolder, f.IsProtected, f.CreatedAt })
                .OrderBy(f => f.Name)
                .ToListAsync();

            var files = await _context.FileItems.IgnoreQueryFilters()
                .Where(fi => fi.FolderId == folderId && fi.OrganizationId == orgId && !fi.IsDeleted)
                .Select(fi => new { fi.Id, fi.Name, fi.FileUrl, fi.SizeInBytes, fi.Extension, fi.ContentType, fi.IsProtected, fi.CreatedAt })
                .OrderBy(fi => fi.Name)
                .ToListAsync();

            return Ok(new { folders, files });
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search(int? folderId, string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return BadRequest();
            var orgId = await GetCurrentOrganizationIdAsync();
            
            var allFolders = await _context.Folders
                .Where(f => f.OrganizationId == orgId && !f.IsDeleted)
                .Select(f => new { f.Id, f.ParentFolderId })
                .ToListAsync();

            var targetFolderIds = new HashSet<int?>();
            
            if (folderId.HasValue) 
            {
                targetFolderIds.Add(folderId.Value);
                
                void AddDescendants(int pId) {
                    var children = allFolders.Where(x => x.ParentFolderId == pId).ToList();
                    foreach (var c in children) {
                        targetFolderIds.Add(c.Id);
                        AddDescendants(c.Id);
                    }
                }
                AddDescendants(folderId.Value);
            }
            else 
            {
                targetFolderIds.Add(null);
                foreach (var f in allFolders) targetFolderIds.Add(f.Id);
            }

            var matchingFolders = await _context.Folders
                .Where(f => f.OrganizationId == orgId && !f.IsDeleted && targetFolderIds.Contains(f.ParentFolderId) && f.Name.Contains(query))
                .Select(f => new { f.Id, f.Name, f.IsSystemFolder, f.CreatedAt })
                .OrderBy(f => f.Name)
                .ToListAsync();

            var matchingFiles = await _context.FileItems
                .Where(fi => fi.OrganizationId == orgId && !fi.IsDeleted && targetFolderIds.Contains(fi.FolderId) && fi.Name.Contains(query))
                .Select(fi => new { fi.Id, fi.Name, fi.FileUrl, fi.SizeInBytes, fi.Extension, fi.ContentType, fi.CreatedAt })
                .OrderBy(fi => fi.Name)
                .ToListAsync();

            return Ok(new { folders = matchingFolders, files = matchingFiles });
        }

        [HttpPost("folder")]
        public async Task<IActionResult> CreateFolder([FromBody] CreateFolderRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Klasör adı boş olamaz." });

            var orgId = await GetCurrentOrganizationIdAsync();
            var newFolder = new Folder
            {
                Name = req.Name,
                ParentFolderId = req.ParentFolderId,
                OrganizationId = orgId,
                CreatedById = CurrentUserId,
                CreatedAt = DateTime.Now
            };

            _context.Folders.Add(newFolder);
            await _context.SaveChangesAsync();

            return Ok(new { newFolder.Id, newFolder.Name, newFolder.IsSystemFolder, newFolder.CreatedAt });
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile([FromForm] IFormFile file, [FromForm] int? folderId)
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "Geçersiz dosya." });

            var orgId = await GetCurrentOrganizationIdAsync();
            var url = await _storageService.UploadFileAsync(file, "filemanager");

            var fileItem = new FileItem
            {
                OrganizationId = orgId,
                FolderId = folderId,
                Name = file.FileName,
                Extension = Path.GetExtension(file.FileName),
                SizeInBytes = file.Length,
                FileUrl = url,
                ContentType = file.ContentType,
                UploadedById = CurrentUserId,
                CreatedAt = DateTime.Now
            };

            _context.FileItems.Add(fileItem);
            await _context.SaveChangesAsync();

            return Ok(new { fileItem.Id, fileItem.Name, fileItem.FileUrl, fileItem.SizeInBytes, fileItem.Extension, fileItem.CreatedAt });
        }
        public class ResolvePathRequest {
            public string Path { get; set; }
        }

        [HttpPost("resolve-path")]
        public async Task<IActionResult> ResolvePath([FromBody] ResolvePathRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Path)) return Ok(new { folders = new object[0] });

            var parts = req.Path.Split(new[] { '\\', '/' }, StringSplitOptions.RemoveEmptyEntries)
                                .Select(p => p.Trim())
                                .ToList();

            var orgId = await GetCurrentOrganizationIdAsync();
            var result = new List<object>();
            int? currentParentId = null;

            foreach (var part in parts)
            {
                var folder = await _context.Folders
                    .FirstOrDefaultAsync(f => f.OrganizationId == orgId && f.ParentFolderId == currentParentId && f.Name.ToLower() == part.ToLower() && !f.IsDeleted);
                    
                if (folder == null)
                    return NotFound(new { message = "Dizin bulunamadı." });
                    
                result.Add(new { id = folder.Id, name = folder.Name });
                currentParentId = folder.Id;
            }

            return Ok(new { folders = result });
        }
        
        [HttpDelete("folder/{id}")]
        public async Task<IActionResult> DeleteFolder(int id, [FromQuery] bool force = false)
        {
            var orgId = await GetCurrentOrganizationIdAsync();
            var folder = await _context.Folders.IgnoreQueryFilters().FirstOrDefaultAsync(f => f.Id == id && f.OrganizationId == orgId);
            
            if (folder == null) return NotFound(new { message = "Klasör bulunamadı." });
            if (folder.IsSystemFolder) return BadRequest(new { message = "Sistem klasörleri (Çalışma Alanları, Projeler, Çöp Kutusu) silinemez." });
            if (folder.IsProtected) return BadRequest(new { message = "Korumaya alınmış klasörler silinemez." });

            if (force) {
                _context.Folders.Remove(folder);
            } else {
                folder.IsDeleted = true;
                folder.DeletedAt = DateTime.Now;
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Klasör silindi" });
        }

        [HttpDelete("file/{id}")]
        public async Task<IActionResult> DeleteFile(int id, [FromQuery] bool force = false)
        {
            var orgId = await GetCurrentOrganizationIdAsync();
            var file = await _context.FileItems.IgnoreQueryFilters().FirstOrDefaultAsync(f => f.Id == id && f.OrganizationId == orgId);
            
            if (file == null) return NotFound(new { message = "Dosya bulunamadı." });
            if (file.IsProtected) return BadRequest(new { message = "Korumaya alınmış dosyalar silinemez." });

            if (force) {
                if (!string.IsNullOrEmpty(file.FileUrl))
                {
                    await _storageService.DeleteFileAsync(file.FileUrl);
                }
                _context.FileItems.Remove(file);
            } else {
                file.IsDeleted = true;
                file.DeletedAt = DateTime.Now;
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Dosya silindi" });
        }
        
        [HttpPost("restore")]
        public async Task<IActionResult> Restore([FromBody] RestoreRequest req)
        {
            var orgId = await GetCurrentOrganizationIdAsync();
            foreach (var item in req.Items) {
                if (item.Type == "folder") {
                    var f = await _context.Folders.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == item.Id && x.OrganizationId == orgId);
                    if (f != null) { f.IsDeleted = false; f.DeletedAt = null; }
                } else {
                    var f = await _context.FileItems.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == item.Id && x.OrganizationId == orgId);
                    if (f != null) { f.IsDeleted = false; f.DeletedAt = null; }
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Geri yüklendi" });
        }

        [HttpPost("protect")]
        public async Task<IActionResult> Protect([FromBody] ProtectRequest req)
        {
            var orgId = await GetCurrentOrganizationIdAsync();
            foreach (var item in req.Items) {
                if (item.Type == "folder") {
                    var f = await _context.Folders.FirstOrDefaultAsync(x => x.Id == item.Id && x.OrganizationId == orgId);
                    if (f != null && !f.IsSystemFolder) { f.IsProtected = req.IsProtected; }
                } else {
                    var f = await _context.FileItems.FirstOrDefaultAsync(x => x.Id == item.Id && x.OrganizationId == orgId);
                    if (f != null) { f.IsProtected = req.IsProtected; }
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Koruma durumu güncellendi" });
        }

        [HttpPost("rename")]
        public async Task<IActionResult> Rename([FromBody] RenameRequest req)
        {
            var orgId = await GetCurrentOrganizationIdAsync();
            if (string.IsNullOrWhiteSpace(req.NewName)) return BadRequest(new { message = "Geçersiz isim." });

            if (req.Type == "folder") {
                var folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == req.Id && f.OrganizationId == orgId);
                if (folder == null) return NotFound(new { message = "Bulunamadı." });
                if (folder.IsSystemFolder) return BadRequest(new { message = "Sistem klasörleri yeniden adlandırılamaz." });
                folder.Name = req.NewName;
            } else {
                var file = await _context.FileItems.FirstOrDefaultAsync(f => f.Id == req.Id && f.OrganizationId == orgId);
                if (file == null) return NotFound(new { message = "Bulunamadı." });
                file.Name = req.NewName;
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Başarılı" });
        }

        [HttpPost("paste")]
        public async Task<IActionResult> Paste([FromBody] PasteRequest req)
        {
            var orgId = await GetCurrentOrganizationIdAsync();
            foreach (var item in req.Items) {
                if (item.Type == "folder") {
                    var folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == item.Id && f.OrganizationId == orgId);
                    if (folder == null || folder.IsSystemFolder) continue;
                    
                    if (req.Action == "cut") {
                        if (folder.Id == req.TargetFolderId) continue; // prevent moving into itself
                        folder.ParentFolderId = req.TargetFolderId;
                    } else if (req.Action == "copy") {
                        await CopyFolderRecursive(folder, req.TargetFolderId, orgId, CurrentUserId);
                    }
                } else {
                    var file = await _context.FileItems.FirstOrDefaultAsync(f => f.Id == item.Id && f.OrganizationId == orgId);
                    if (file == null) continue;
                    
                    if (req.Action == "cut") {
                        file.FolderId = req.TargetFolderId;
                    } else if (req.Action == "copy") {
                        var newFile = new FileItem {
                            OrganizationId = orgId,
                            FolderId = req.TargetFolderId,
                            Name = "Kopya - " + file.Name,
                            Extension = file.Extension,
                            SizeInBytes = file.SizeInBytes,
                            FileUrl = file.FileUrl,
                            ContentType = file.ContentType,
                            UploadedById = CurrentUserId,
                            CreatedAt = DateTime.Now
                        };
                        _context.FileItems.Add(newFile);
                    }
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Yapıştırıldı" });
        }

        private async Task CopyFolderRecursive(Folder sourceFolder, int? targetParentId, int orgId, int userId) {
            var newFolder = new Folder {
                OrganizationId = orgId,
                ParentFolderId = targetParentId,
                Name = sourceFolder.ParentFolderId == targetParentId ? "Kopya - " + sourceFolder.Name : sourceFolder.Name,
                CreatedById = userId,
                CreatedAt = DateTime.Now
            };
            _context.Folders.Add(newFolder);
            await _context.SaveChangesAsync();

            var childFiles = await _context.FileItems.Where(fi => fi.FolderId == sourceFolder.Id && !fi.IsDeleted).ToListAsync();
            foreach(var f in childFiles) {
                var newFile = new FileItem {
                    OrganizationId = orgId,
                    FolderId = newFolder.Id,
                    Name = f.Name,
                    Extension = f.Extension,
                    SizeInBytes = f.SizeInBytes,
                    FileUrl = f.FileUrl,
                    ContentType = f.ContentType,
                    UploadedById = userId,
                    CreatedAt = DateTime.Now
                };
                _context.FileItems.Add(newFile);
            }
            
            var childFolders = await _context.Folders.Where(f => f.ParentFolderId == sourceFolder.Id && !f.IsDeleted).ToListAsync();
            foreach(var cf in childFolders) {
                await CopyFolderRecursive(cf, newFolder.Id, orgId, userId);
            }
        }
        [HttpPost("download")]
        public async Task<IActionResult> Download([FromBody] DownloadRequest req)
        {
            if (req.Items == null || !req.Items.Any())
            {
                return BadRequest();
            }

            var orgId = await GetCurrentOrganizationIdAsync();
            var allFiles = new List<FileItem>();

            var folderIds = new HashSet<int>();
            
            foreach (var item in req.Items)
            {
                if (item.Type == "file")
                {
                    var f = await _context.FileItems.FirstOrDefaultAsync(x => x.Id == item.Id && x.OrganizationId == orgId);
                    if (f != null && !f.IsDeleted) allFiles.Add(f);
                }
                else if (item.Type == "folder")
                {
                    folderIds.Add(item.Id);
                }
            }

            if (folderIds.Count > 0)
            {
                var allFolders = await _context.Folders.Where(x => x.OrganizationId == orgId && !x.IsDeleted).ToListAsync();
                var targets = new HashSet<int>(folderIds);

                void AddDescendants(int pid)
                {
                    var children = allFolders.Where(x => x.ParentFolderId == pid).ToList();
                    foreach (var c in children)
                    {
                        if (targets.Add(c.Id))
                        {
                            AddDescendants(c.Id);
                        }
                    }
                }

                foreach (var fid in folderIds.ToList())
                {
                    AddDescendants(fid);
                }

                var filesInFolders = await _context.FileItems
                    .Where(x => x.OrganizationId == orgId && !x.IsDeleted && x.FolderId.HasValue && targets.Contains(x.FolderId.Value))
                    .ToListAsync();
                    
                allFiles.AddRange(filesInFolders);
            }

            // Remove duplicates just in case
            allFiles = allFiles.GroupBy(x => x.Id).Select(g => g.First()).ToList();

            if (allFiles.Count == 0)
            {
                return NotFound();
            }

            if (req.Items.Count == 1 && req.Items[0].Type == "file" && allFiles.Count == 1 && allFiles[0].SizeInBytes <= 10 * 1024 * 1024)
            {
                var file = allFiles[0];
                var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
                
                // .Add() yerine indexer kullanıyoruz çünkü önceden eklenmiş olabilir
                Response.Headers["Access-Control-Expose-Headers"] = "Content-Disposition";
                
                try 
                {
                    var responseStream = await _storageService.GetFileStreamAsync(file.FileUrl);
                    return File(responseStream, contentType, file.Name);
                } 
                catch (Exception ex)
                {
                    return StatusCode(500, ex.Message);
                }
            }

            string downloadName = "İndirilenler.zip";
            if (req.Items.Count == 1)
            {
                if (req.Items[0].Type == "file" && allFiles.Count > 0)
                {
                    downloadName = System.IO.Path.GetFileNameWithoutExtension(allFiles[0].Name) + ".zip";
                }
                else if (req.Items[0].Type == "folder")
                {
                    var folderIdToFind = req.Items[0].Id;
                    var folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == folderIdToFind && f.OrganizationId == orgId);
                    if (folder != null) downloadName = folder.Name + ".zip";
                }
            }

            var syncIoFeature = HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpBodyControlFeature>();
            if (syncIoFeature != null)
            {
                syncIoFeature.AllowSynchronousIO = true;
            }

            Response.ContentType = "application/zip";
            Response.Headers["Content-Disposition"] = $"attachment; filename=\"{Uri.EscapeDataString(downloadName)}\"";
            Response.Headers["Access-Control-Expose-Headers"] = "Content-Disposition";

            using (var zipArchive = new System.IO.Compression.ZipArchive(Response.Body, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true))
            {
                var addedNames = new HashSet<string>();

                foreach (var file in allFiles)
                {
                    var entryName = file.Name;
                    int counter = 1;
                    while (addedNames.Contains(entryName))
                    {
                        var ext = System.IO.Path.GetExtension(file.Name);
                        var name = System.IO.Path.GetFileNameWithoutExtension(file.Name);
                        entryName = $"{name} ({counter}){ext}";
                        counter++;
                    }
                    addedNames.Add(entryName);

                    var entry = zipArchive.CreateEntry(entryName, System.IO.Compression.CompressionLevel.Fastest);
                    using var entryStream = entry.Open();
                    
                    try
                    {
                        using var responseStream = await _storageService.GetFileStreamAsync(file.FileUrl);
                        await responseStream.CopyToAsync(entryStream);
                    }
                    catch
                    {
                        // Ignore individual file failures
                    }
                }
            }

            return new EmptyResult();
        }
    }

    public class CreateFolderRequest
    {
        public string Name { get; set; } = string.Empty;
        public int? ParentFolderId { get; set; }
    }

    public class RenameRequest { 
        public string Type { get; set; } 
        public int Id { get; set; } 
        public string NewName { get; set; } 
    }

    public class PasteRequest {
        public string Action { get; set; }
        public int? TargetFolderId { get; set; }
        public List<PasteItem> Items { get; set; }
    }

    public class PasteItem { 
        public string Type { get; set; } 
        public int Id { get; set; } 
    }

    public class DownloadRequest {
        public List<PasteItem> Items { get; set; }
    }

    public class RestoreRequest {
        public List<PasteItem> Items { get; set; }
    }
    public class ProtectRequest {
        public List<PasteItem> Items { get; set; }
        public bool IsProtected { get; set; }
    }
}
