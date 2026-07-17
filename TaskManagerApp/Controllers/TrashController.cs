using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    public class TrashController : Controller
    {
        private readonly AppDbContext _context;

        public TrashController (AppDbContext context)
        {
            _context = context;
        }

        public async Task<IActionResult> Index()
        {
            var model = new TrashViewModel
            {
                DeletedProjects = await _context.Projects.IgnoreQueryFilters().Where(p => p.IsDeleted).ToListAsync(),
                DeletedMainGoals = await _context.MainGoals.IgnoreQueryFilters().Where(mg => mg.IsDeleted).ToListAsync(),
                DeletedSubGoals = await _context.SubGoals.IgnoreQueryFilters().Where(sg => sg.IsDeleted).ToListAsync(),
                DeletedTasks = await _context.TaskItems.IgnoreQueryFilters().Where(t => t.IsDeleted).ToListAsync()
            };
            return View(model);
        }

        [HttpPost]
        public async Task<IActionResult> RestoreProject(int id)
        {
            var project = await _context.Projects.IgnoreQueryFilters().
                FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);

            if (project == null)
            {
                return NotFound();
            }

            project.IsDeleted = false;

            if (project.DeleteBatchId.HasValue)
            {
                var batchId = project.DeleteBatchId.Value;
                var relatedMainGoals = await _context.MainGoals.IgnoreQueryFilters()
                    .Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted).ToListAsync();

                foreach (var mg in relatedMainGoals)
                {
                    mg.IsDeleted = false;
                    mg.DeleteBatchId = null;
                }

                var relatedSubGoals = await _context.SubGoals.IgnoreQueryFilters()
                    .Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted).ToListAsync();
                foreach (var sg in relatedSubGoals)
                {
                    sg.IsDeleted = false;
                    sg.DeleteBatchId = null;
                }

                var relatedTasks = await _context.TaskItems.IgnoreQueryFilters()
                    .Where(t => t.DeleteBatchId == batchId && t.IsDeleted).ToListAsync();

                foreach (var t in relatedTasks)
                {
                    t.IsDeleted = false;
                    t.DeleteBatchId = null;
                }

                project.DeleteBatchId = null;


            }

            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));

        }
    }
}
