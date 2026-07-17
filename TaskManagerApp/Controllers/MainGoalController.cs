using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    public class MainGoalController : Controller
    {
        public readonly AppDbContext _context;

        public MainGoalController(AppDbContext context)
        {
            _context = context;
        }

        public IActionResult Index (int projectID)
        {
            var goals = _context.MainGoals.Where(g => g.ProjectId == projectID).ToList();

            ViewBag.ProjectId = projectID;

            return View(goals);
        }

        public IActionResult Create(int projectID)
        {
            ViewBag.ProjectId = projectID;
            return View(new MainGoal { ProjectId = projectID });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]

        public IActionResult Create(MainGoal mainGoal)
        {
            ModelState.Remove("Project");
            ModelState.Remove("SubGoals");

            if (ModelState.IsValid)
            {
                mainGoal.CreatedAt = DateTime.Now;
                _context.MainGoals.Add(mainGoal);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index), new { projectID = mainGoal.ProjectId });
            }
            return View(mainGoal);
        }

        public IActionResult Edit (int id)
        {
            var goal = _context.MainGoals.Find(id);
            if (goal == null) return NotFound();

            return View(goal);
        }


        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Edit (int id, MainGoal mainGoal)
        {
            if (id != mainGoal.Id) return NotFound();

            ModelState.Remove("Project");
            ModelState.Remove("SubGoals");

            if (ModelState.IsValid)
            {
                _context.MainGoals.Update(mainGoal);
                _context.SaveChanges();

                return RedirectToAction(nameof(Index), new { projectId = mainGoal.ProjectId });
            }

            return View(mainGoal);
        }


        public IActionResult Delete(int id)
        {

            var goal = _context.MainGoals.Find(id);
            if (goal == null) return NotFound();


            return View(goal);
        }

        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public IActionResult DeleteConfirmed(int id)
        {
            var goal = _context.MainGoals
                .Include(mg => mg.SubGoals)
                    .ThenInclude(sg => sg.Tasks)
                .FirstOrDefault(mg => mg.Id == id);

            if (goal != null)
            {
                int projectId = goal.ProjectId;

                var batchId = Guid.NewGuid();
                var deleteTime = DateTime.Now;

                goal.IsDeleted = true;
                goal.DeletedAt = deleteTime;
                goal.DeleteBatchId = batchId;

                foreach (var sg in goal.SubGoals.Where(sg => !sg.IsDeleted))
                {
                    sg.IsDeleted = true;
                    sg.DeletedAt = deleteTime;
                    sg.DeleteBatchId = batchId;

                    foreach (var t in sg.Tasks.Where(t => !t.IsDeleted))
                    {
                        t.IsDeleted = true;
                        t.DeletedAt = deleteTime;
                        t.DeleteBatchId = batchId;
                    }
                }

                _context.SaveChanges();

                return RedirectToAction(nameof(Index), new { projectId = projectId });
            }
            return RedirectToAction("Index", "Project");
        }
    }
}
