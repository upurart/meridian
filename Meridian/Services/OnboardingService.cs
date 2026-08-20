using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;

namespace Meridian.Services
{
    public interface IOnboardingService
    {
        Task<bool> RegisterUserAsync(RegisterViewModel model);
    }

    public class OnboardingService : IOnboardingService
    {
        private readonly AppDbContext _context;

        public OnboardingService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> RegisterUserAsync(RegisterViewModel model)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var org = new Organization
                {
                    Name = model.Name + " Kişisel Alan",
                    CreatedAt = DateTime.Now
                };
                _context.Organizations.Add(org);
                await _context.SaveChangesAsync();

                var hasher = new PasswordHasher<User>();
                var user = new User
                {
                    Name = model.Name,
                    Surname = model.Surname,
                    Username = model.Username,
                    Email = model.Email,
                    CreatedAt = DateTime.Now,
                    OrganizationId = org.Id
                };
                user.PasswordHash = hasher.HashPassword(user, model.Password);

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                // Varsayılan Workspace
                var defaultWorkspace = new Workspace
                {
                    Name = "Varsayılan Alan",
                    Slug = "varsayilan-alan-" + user.Id,
                    Description = "Varsayılan kişisel çalışma alanınız",
                    OwnerId = user.Id,
                    CreatedAt = DateTime.Now,
                    IsActive = true,
                    OrganizationId = org.Id
                };
                _context.Workspaces.Add(defaultWorkspace);
                await _context.SaveChangesAsync();

                var workspaceMember = new WorkspaceMember
                {
                    WorkspaceId = defaultWorkspace.Id,
                    UserId = user.Id,
                    RolePreset = "Owner",
                    JoinedAt = DateTime.Now,
                    IsActive = true
                };
                _context.WorkspaceMembers.Add(workspaceMember);
                await _context.SaveChangesAsync();
                
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return false;
            }
        }
    }
}
