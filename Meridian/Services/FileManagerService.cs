using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;

namespace Meridian.Services
{
    public interface IFileManagerService
    {
        Task EnsureTrashBinExistsAsync(int orgId, int userId);
        Task<object> GetTrashBinContentsAsync(int orgId);
        Task<object> GetFolderContentsAsync(int? folderId, int orgId);
        Task<object> SearchAsync(int orgId, int? folderId, string query);
        Task CopyFolderRecursiveAsync(int sourceFolderId, int? targetParentId, int orgId, int userId);
    }

    public class FileManagerService : IFileManagerService
    {
        private readonly AppDbContext _context;

        public FileManagerService(AppDbContext context)
        {
            _context = context;
        }

        public async Task EnsureTrashBinExistsAsync(int orgId, int userId)
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
                    CreatedById = userId,
                    CreatedAt = DateTime.Now
                };
                _context.Folders.Add(trashBin);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<object> GetTrashBinContentsAsync(int orgId)
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

            return new { folders = deletedFolders, files = deletedFiles };
        }

        public async Task<object> GetFolderContentsAsync(int? folderId, int orgId)
        {
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

            return new { folders, files };
        }

        public async Task<object> SearchAsync(int orgId, int? folderId, string query)
        {
            var allFolders = await _context.Folders
                .Where(f => f.OrganizationId == orgId && !f.IsDeleted)
                .Select(f => new { f.Id, f.ParentFolderId })
                .ToListAsync();

            var searchableFolderIds = new HashSet<int>();
            if (folderId.HasValue)
            {
                searchableFolderIds.Add(folderId.Value);
                void AddChildren(int pid)
                {
                    var children = allFolders.Where(x => x.ParentFolderId == pid).ToList();
                    foreach (var c in children)
                    {
                        if (searchableFolderIds.Add(c.Id))
                            AddChildren(c.Id);
                    }
                }
                AddChildren(folderId.Value);
            }

            var fQuery = _context.Folders.Where(f => f.OrganizationId == orgId && !f.IsDeleted && EF.Functions.Like(f.Name, $"%{query}%"));
            var fiQuery = _context.FileItems.Where(fi => fi.OrganizationId == orgId && !fi.IsDeleted && EF.Functions.Like(fi.Name, $"%{query}%"));

            if (folderId.HasValue)
            {
                fQuery = fQuery.Where(f => f.ParentFolderId.HasValue && searchableFolderIds.Contains(f.ParentFolderId.Value));
                fiQuery = fiQuery.Where(fi => fi.FolderId.HasValue && searchableFolderIds.Contains(fi.FolderId.Value));
            }

            var folders = await fQuery.Select(f => new { f.Id, f.Name, f.IsSystemFolder, f.CreatedAt }).ToListAsync();
            var files = await fiQuery.Select(fi => new { fi.Id, fi.Name, fi.FileUrl, fi.SizeInBytes, fi.Extension, fi.ContentType, fi.CreatedAt }).ToListAsync();

            return new { folders, files };
        }

        public async Task CopyFolderRecursiveAsync(int sourceFolderId, int? targetParentId, int orgId, int userId)
        {
            var sourceFolder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == sourceFolderId && f.OrganizationId == orgId);
            if (sourceFolder == null) return;

            var newFolder = new Folder
            {
                OrganizationId = orgId,
                ParentFolderId = targetParentId,
                Name = sourceFolder.ParentFolderId == targetParentId ? "Kopya - " + sourceFolder.Name : sourceFolder.Name,
                CreatedById = userId,
                CreatedAt = DateTime.Now
            };
            _context.Folders.Add(newFolder);
            await _context.SaveChangesAsync();

            var childFiles = await _context.FileItems.Where(fi => fi.FolderId == sourceFolder.Id && !fi.IsDeleted).ToListAsync();
            foreach (var f in childFiles)
            {
                var newFile = new FileItem
                {
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
            foreach (var cf in childFolders)
            {
                await CopyFolderRecursiveAsync(cf.Id, newFolder.Id, orgId, userId);
            }
        }
    }
}
