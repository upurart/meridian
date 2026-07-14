using Microsoft.AspNetCore.Mvc;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    public class SubGoalController : Controller
    {
        private readonly AppDbContext _context;


        public SubGoalController(AppDbContext context)
        {
            _context = context;
        }

        public IActionResult Index(int mainGoalID)
        {
            var subGoals = _context.SubGoals.Where(sg => sg.MainGoalId == mainGoalID).ToList();
            ViewBag.MainGoalId = mainGoalID;
            return View(subGoals);
        }

        public IActionResult Create(int mainGoalID)
        {
            ViewBag.MainGoalId = mainGoalID;
            return View(new SubGoal { MainGoalId = mainGoalID });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Create(SubGoal subGoal)
        {
            ModelState.Remove("MainGoal");
            ModelState.Remove("TaskItems");

            if (ModelState.IsValid)
            {
                subGoal.CreatedAt = DateTime.Now;
                _context.SubGoals.Add(subGoal);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index), new { mainGoalID = subGoal.MainGoalId });
            }
            return View(subGoal);
        }

        public IActionResult Edit(int id)
        {
            var subGoal = _context.SubGoals.Find(id);
            if (subGoal == null) return NotFound();
            return View(subGoal);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Edit(int id, SubGoal subGoal)
        {
            if (id != subGoal.Id) return NotFound();

            ModelState.Remove("MainGoal");
            ModelState.Remove("TaskItems");

            if (ModelState.IsValid)
            {
                _context.SubGoals.Update(subGoal);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index), new { mainGoalId = subGoal.MainGoalId });
            }
            return View(subGoal);
        }


        public IActionResult Delete(int id)
        {
            var subGoal = _context.SubGoals.Find(id);
            if (subGoal == null) return NotFound();
            return View(subGoal);
        }

        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public IActionResult DeleteConfirmed(int id)
        {
            var subGoal = _context.SubGoals.Find(id);
            if (subGoal != null)
            {
                int mainGoalId = subGoal.MainGoalId;
                _context.SubGoals.Remove(subGoal);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index), new { mainGoalId = mainGoalId });
            }
            return RedirectToAction("Index", "Project");
        }
    }
}
