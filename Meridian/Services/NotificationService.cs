﻿using System.Threading.Tasks;
using Meridian.Domain.Entities;
using Meridian.Infrastructure.Persistence;
using Microsoft.AspNetCore.SignalR;
using Meridian.Hubs;
using System;
using Meridian.Application.Interfaces;

namespace Meridian.Services
{
    public interface INotificationService
    {
        Task SendNotificationAsync(int userId, int? issuerId, string type, string title, string message, string linkUrl, string referenceData = null);
    }

    public class NotificationService : INotificationService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly IEmailSender _emailSender;

        public NotificationService(AppDbContext context, IHubContext<NotificationHub> hubContext, IEmailSender emailSender)
        {
            _context = context;
            _hubContext = hubContext;
            _emailSender = emailSender;
        }

        public async Task SendNotificationAsync(int userId, int? issuerId, string type, string title, string message, string linkUrl, string referenceData = null)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return;

            bool shouldSendAppNotification = true;
            bool shouldSendEmailNotification = false;

            if (type == "task_assignment")
            {
                shouldSendAppNotification = user.NotifyOnTaskAssignmentApp;
                shouldSendEmailNotification = user.NotifyOnTaskAssignmentEmail;
            }
            else if (type == "mention")
            {
                shouldSendAppNotification = user.NotifyOnMentionApp;
                shouldSendEmailNotification = user.NotifyOnMentionEmail;
            }

            if (shouldSendAppNotification)
            {
                var notification = new Notification
                {
                    UserId = userId,
                    IssuerId = issuerId,
                    Type = type,
                    Title = title,
                    Message = message,
                    LinkUrl = linkUrl,
                    ReferenceData = referenceData,
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Notifications.Add(notification);
                await _context.SaveChangesAsync();
                
                await _hubContext.Clients.Group($"User_{userId}").SendAsync("ReceiveNotification");
            }

            if (shouldSendEmailNotification && !string.IsNullOrEmpty(user.Email))
            {
                string baseUrl = "https://meridian-app.localhost"; 
                string emailBody = $@"
                    <div style='font-family: Arial, sans-serif; padding: 20px;'>
                        <h2>{title}</h2>
                        <p>{message}</p>
                        <br/>
                        <a href='{baseUrl}{linkUrl}' style='display:inline-block; padding:10px 15px; background-color:#3b82f6; color:#ffffff; text-decoration:none; border-radius:5px;'>Detayları Görüntüle</a>
                    </div>";

                await _emailSender.SendEmailAsync(user.Email, title, emailBody);
            }
        }
    }
}