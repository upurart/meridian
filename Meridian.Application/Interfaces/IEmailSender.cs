using System.Threading.Tasks;

namespace Meridian.Application.Interfaces
{
    public interface IEmailSender
    {
        Task SendEmailAsync(string email, string subject, string message);
    }
}
