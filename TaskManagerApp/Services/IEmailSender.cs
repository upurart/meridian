using System.Threading.Tasks;

namespace TaskManagerApp.Services
{
    public interface IEmailSender
    {
        Task SendEmailAsync(string email, string subject, string message);
    }
}
