using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Meridian.Models;

namespace Meridian.Services
{
    public class TrashCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TrashCleanupService> _logger;

        public TrashCleanupService(IServiceProvider serviceProvider, ILogger<TrashCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Trash Cleanup Service is starting.");

            // Initial delay before starting the loop (e.g., to let the app start up completely)
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupTrashAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred during trash cleanup.");
                }

                // Wait for 24 hours before running again
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
        }

        private async Task CleanupTrashAsync()
        {
            _logger.LogInformation("Trash Cleanup Job is running...");

            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var fileStorageService = scope.ServiceProvider.GetRequiredService<Meridian.Application.Interfaces.IFileStorageService>();

            var thirtyDaysAgo = DateTime.Now.AddDays(-30);

            // Clean up Workspaces
            var oldWorkspaces = await dbContext.Workspaces
                .IgnoreQueryFilters()
                .Where(w => w.IsDeleted && w.DeletedAt != null && w.DeletedAt < thirtyDaysAgo)
                .ToListAsync();
            
            // Clean up Projects
            var oldProjects = await dbContext.Projects
                .IgnoreQueryFilters()
                .Where(p => p.IsDeleted && p.DeletedAt != null && p.DeletedAt < thirtyDaysAgo)
                .ToListAsync();

            // Clean up MainGoals
            var oldMainGoals = await dbContext.MainGoals
                .IgnoreQueryFilters()
                .Where(m => m.IsDeleted && m.DeletedAt != null && m.DeletedAt < thirtyDaysAgo)
                .ToListAsync();

            // Clean up SubGoals
            var oldSubGoals = await dbContext.SubGoals
                .IgnoreQueryFilters()
                .Where(s => s.IsDeleted && s.DeletedAt != null && s.DeletedAt < thirtyDaysAgo)
                .ToListAsync();

            // Clean up TaskItems
            var oldTasks = await dbContext.TaskItems
                .IgnoreQueryFilters()
                .Where(t => t.IsDeleted && t.DeletedAt != null && t.DeletedAt < thirtyDaysAgo)
                .ToListAsync();
                
            // Clean up Folders
            var oldFolders = await dbContext.Folders
                .IgnoreQueryFilters()
                .Where(f => f.IsDeleted && f.DeletedAt != null && f.DeletedAt < thirtyDaysAgo)
                .ToListAsync();
                
            // Clean up FileItems
            var oldFiles = await dbContext.FileItems
                .IgnoreQueryFilters()
                .Where(f => f.IsDeleted && f.DeletedAt != null && f.DeletedAt < thirtyDaysAgo)
                .ToListAsync();

            // Physically delete files from cloud storage
            foreach (var file in oldFiles)
            {
                if (!string.IsNullOrEmpty(file.FileUrl))
                {
                    try
                    {
                        await fileStorageService.DeleteFileAsync(file.FileUrl);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to delete physical file {file.FileUrl} from cloud storage.");
                    }
                }
            }

            int totalDeleted = oldWorkspaces.Count + oldProjects.Count + oldMainGoals.Count + oldSubGoals.Count + oldTasks.Count + oldFolders.Count + oldFiles.Count;

            if (totalDeleted > 0)
            {
                dbContext.Workspaces.RemoveRange(oldWorkspaces);
                dbContext.Projects.RemoveRange(oldProjects);
                dbContext.MainGoals.RemoveRange(oldMainGoals);
                dbContext.SubGoals.RemoveRange(oldSubGoals);
                dbContext.TaskItems.RemoveRange(oldTasks);
                dbContext.Folders.RemoveRange(oldFolders);
                dbContext.FileItems.RemoveRange(oldFiles);

                await dbContext.SaveChangesAsync();
                _logger.LogInformation($"Trash Cleanup Job completed. Deleted {totalDeleted} old items.");
            }
            else
            {
                _logger.LogInformation("Trash Cleanup Job completed. No items to delete.");
            }
        }
    }
}
