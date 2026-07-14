using Microsoft.AspNetCore.Mvc;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    public class TaskItemController : Controller
    {
        private readonly AppDbContext _context;

        public TaskItemController(AppDbContext context)
        {
            _context = context;
        }

        public IActionResult Index(int subGoalId)
        {
            var tasks = _context.TaskItems.Where(t => t.SubGoalId == subGoalId).ToList();
            ViewBag.SubGoalId = subGoalId;
            return View(tasks);
        }

        public IActionResult Create(int subGoalId)
        {
            return View(new TaskItem { SubGoalId = subGoalId });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Create(TaskItem taskItem)
        {
            ModelState.Remove("SubGoal");

            if (ModelState.IsValid)
            {
                taskItem.CreatedAt = DateTime.UtcNow;
                taskItem.IsCompleted = false; // Yeni görev varsayılan olarak tamamlanmamıştır

                _context.TaskItems.Add(taskItem);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index), new { subGoalId = taskItem.SubGoalId });
            }
            return View(taskItem);
        }

        public IActionResult Edit(int id)
        {
            var task = _context.TaskItems.Find(id);
            if (task == null) return NotFound();
            return View(task);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Edit(int id, TaskItem taskItem)
        {
            if (id != taskItem.Id) return NotFound();

            ModelState.Remove("SubGoal");

            if (ModelState.IsValid)
            {
                _context.TaskItems.Update(taskItem);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index), new { subGoalId = taskItem.SubGoalId });
            }
            return View(taskItem);
        }

        public IActionResult Delete(int id)
        {
            var task = _context.TaskItems.Find(id);
            if (task == null) return NotFound();
            return View(task);
        }

        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public IActionResult DeleteConfirmed(int id)
        {
            var task = _context.TaskItems.Find(id);
            if (task != null)
            {
                int subGoalId = task.SubGoalId;
                _context.TaskItems.Remove(task);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index), new { subGoalId = subGoalId });
            }
            return RedirectToAction("Index", "Project");
        }
    }
}