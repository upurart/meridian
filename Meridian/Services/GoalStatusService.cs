using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Meridian.Models;

namespace Meridian.Services
{
    public interface IGoalStatusService
    {
        Task UpdateGoalCompletionStatusAsync(int? subGoalId, int? mainGoalId);
        Task CascadeCompleteMainGoalAsync(int mainGoalId, bool isCompleted);
        Task CascadeCompleteSubGoalAsync(int subGoalId, bool isCompleted);
    }

    public class GoalStatusService : IGoalStatusService
    {
        private readonly AppDbContext _context;

        public GoalStatusService(AppDbContext context)
        {
            _context = context;
        }

        public async Task UpdateGoalCompletionStatusAsync(int? subGoalId, int? mainGoalId)
        {
            if (subGoalId.HasValue)
            {
                var sg = await _context.SubGoals.FirstOrDefaultAsync(s => s.Id == subGoalId.Value);
                if (sg != null)
                {
                    bool hasActiveTasks = await _context.TaskItems.AnyAsync(t => t.SubGoalId == subGoalId.Value && !t.IsDeleted);
                    if (hasActiveTasks)
                    {
                        bool hasIncompleteTasks = await _context.TaskItems.AnyAsync(t => t.SubGoalId == subGoalId.Value && !t.IsDeleted && !t.IsCompleted);
                        bool allCompleted = !hasIncompleteTasks;
                        
                        if (sg.IsCompleted != allCompleted)
                        {
                            sg.IsCompleted = allCompleted;
                            _context.SubGoals.Update(sg);
                        }
                    }
                    if (mainGoalId == null && sg.MainGoalId != 0)
                    {
                        mainGoalId = sg.MainGoalId;
                    }
                }
            }

            if (mainGoalId.HasValue)
            {
                var mg = await _context.MainGoals.FirstOrDefaultAsync(m => m.Id == mainGoalId.Value);
                
                if (mg != null)
                {
                    bool hasActiveTasks = await _context.TaskItems.AnyAsync(t => t.MainGoalId == mainGoalId.Value && !t.IsDeleted);
                    bool hasActiveSubGoals = await _context.SubGoals.AnyAsync(s => s.MainGoalId == mainGoalId.Value && !s.IsDeleted);

                    if (hasActiveTasks || hasActiveSubGoals)
                    {
                        bool hasIncompleteTasks = await _context.TaskItems.AnyAsync(t => t.MainGoalId == mainGoalId.Value && !t.IsDeleted && !t.IsCompleted);
                        bool hasIncompleteSubGoals = await _context.SubGoals.AnyAsync(s => s.MainGoalId == mainGoalId.Value && !s.IsDeleted && !s.IsCompleted);
                        
                        bool allCompleted = !hasIncompleteTasks && !hasIncompleteSubGoals;

                        if (mg.IsCompleted != allCompleted)
                        {
                            mg.IsCompleted = allCompleted;
                            _context.MainGoals.Update(mg);
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();
        }

        public async Task CascadeCompleteMainGoalAsync(int mainGoalId, bool isCompleted)
        {
            var subGoals = await _context.SubGoals.Include(sg => sg.Tasks).Where(sg => sg.MainGoalId == mainGoalId && !sg.IsDeleted).ToListAsync();
            foreach (var sg in subGoals)
            {
                sg.IsCompleted = isCompleted;
                foreach (var t in sg.Tasks.Where(t => !t.IsDeleted)) { t.IsCompleted = isCompleted; }
            }
            var tasks = await _context.TaskItems.Where(t => t.MainGoalId == mainGoalId && t.SubGoalId == null && !t.IsDeleted).ToListAsync();
            foreach (var t in tasks) { t.IsCompleted = isCompleted; }

            await _context.SaveChangesAsync();
        }

        public async Task CascadeCompleteSubGoalAsync(int subGoalId, bool isCompleted)
        {
            var tasks = await _context.TaskItems.Where(t => t.SubGoalId == subGoalId && !t.IsDeleted).ToListAsync();
            foreach (var t in tasks) { t.IsCompleted = isCompleted; }

            await _context.SaveChangesAsync();
        }
    }
}
