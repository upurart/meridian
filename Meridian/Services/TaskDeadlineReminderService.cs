using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Meridian.Models;
using Meridian.Services;

namespace Meridian.Services
{
    public class TaskDeadlineReminderService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TaskDeadlineReminderService> _logger;

        public TaskDeadlineReminderService(IServiceProvider serviceProvider, ILogger<TaskDeadlineReminderService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Task Deadline Reminder Service is starting.");

          
            await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndSendRemindersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred during deadline reminder check.");
                }

              
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
        }

        private async Task CheckAndSendRemindersAsync()
        {
            _logger.LogInformation("Deadline Reminder Job is checking for upcoming deadlines...");

            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var today = DateTime.UtcNow.Date;

          
            var usersWithReminders = await dbContext.Users
                .Where(u => u.UpcomingDeadlineReminderDays != null && u.UpcomingDeadlineReminderDays != "0")
                .ToListAsync();

            foreach (var user in usersWithReminders)
            {
                if (!int.TryParse(user.UpcomingDeadlineReminderDays, out int reminderDays) || reminderDays <= 0)
                    continue;

                DateTime targetDeadlineDate = today.AddDays(reminderDays);

              
                var upcomingProjects = await dbContext.Projects
                    .Where(p => !p.IsDeleted
                        && p.UserId == user.Id
                        && p.Deadline != null
                        && p.Deadline.Value.Date == targetDeadlineDate)
                    .ToListAsync();

                foreach (var project in upcomingProjects)
                {
                    
                    await notificationService.SendNotificationAsync(
                        userId: user.Id,
                        issuerId: null, //
                        type: "deadline_reminder", 
                        title: "Yaklaşan Teslim Tarihi Hatırlatıcısı",
                        message: $"\"{project.Title}\" adlı projenin bitişine {reminderDays} gün kaldı. Lütfen son kontrollerinizi yapmayı unutmayın.",
                        linkUrl: $"/Personal/Project/{project.Id}" 
                    );
                }
            }

            _logger.LogInformation("Deadline Reminder Job completed its daily check.");
        }
    }
}