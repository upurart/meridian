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

            var thirtyDaysAgo = DateTime.Now.AddDays(-30);

            // Clean up Workspaces
            var oldWorkspaces = await dbContext.Workspaces
                .IgnoreQueryFilters()
                .Where(w => w.IsDeleted && w.CreatedAt < thirtyDaysAgo) // Assuming CreatedAt is used for simplicity. Alternatively, a DeletedAt field would be better, but we don't have it.
                .ToListAsync();
            
            // Clean up Projects
            var oldProjects = await dbContext.Projects
                .IgnoreQueryFilters()
                .Where(p => p.IsDeleted && p.CreatedAt < thirtyDaysAgo)
                .ToListAsync();

            // Clean up MainGoals
            var oldMainGoals = await dbContext.MainGoals
                .IgnoreQueryFilters()
                .Where(m => m.IsDeleted && m.CreatedAt < thirtyDaysAgo)
                .ToListAsync();

            // Clean up SubGoals
            var oldSubGoals = await dbContext.SubGoals
                .IgnoreQueryFilters()
                .Where(s => s.IsDeleted && s.CreatedAt < thirtyDaysAgo)
                .ToListAsync();

            // Clean up TaskItems
            var oldTasks = await dbContext.TaskItems
                .IgnoreQueryFilters()
                .Where(t => t.IsDeleted && t.CreatedAt < thirtyDaysAgo)
                .ToListAsync();

            int totalDeleted = oldWorkspaces.Count + oldProjects.Count + oldMainGoals.Count + oldSubGoals.Count + oldTasks.Count;

            if (totalDeleted > 0)
            {
                dbContext.Workspaces.RemoveRange(oldWorkspaces);
                dbContext.Projects.RemoveRange(oldProjects);
                dbContext.MainGoals.RemoveRange(oldMainGoals);
                dbContext.SubGoals.RemoveRange(oldSubGoals);
                dbContext.TaskItems.RemoveRange(oldTasks);

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
