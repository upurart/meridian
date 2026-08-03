using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;

namespace TaskManagerApp.Services
{
    public class SmtpEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;

        public SmtpEmailSender(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendEmailAsync(string email, string subject, string message)
        {
            var host = _configuration["Smtp:Host"];
            var port = int.Parse(_configuration["Smtp:Port"] ?? "587");
            var username = _configuration["Smtp:Username"];
            var password = _configuration["Smtp:Password"];
            var enableSsl = bool.Parse(_configuration["Smtp:EnableSsl"] ?? "true");
            var fromEmail = _configuration["Smtp:FromEmail"] ?? username;
            
            // If SMTP is not configured, we can just return or log it.
            if (string.IsNullOrEmpty(host))
            {
                // Optionally throw or log
                return;
            }

            var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = enableSsl
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(fromEmail ?? "noreply@example.com", "Task Manager"),
                Subject = subject,
                Body = message,
                IsBodyHtml = true
            };
            mailMessage.To.Add(email);

            await client.SendMailAsync(mailMessage);
        }
    }
}
