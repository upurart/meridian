using Microsoft.AspNetCore.Mvc;
using TaskManagerApp.Models;

namespace TaskManagerApp.Controllers
{
    public class ProjectController : Controller
    {

        private readonly AppDbContext _context;

        public ProjectController(AppDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            var projects = _context.Projects.ToList();
            return View(projects);
        }

        public IActionResult Create()
        {
            return View(new Project());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Create(Project project)
        {

            ModelState.Remove("User");
            ModelState.Remove("MainGoals");

            if (ModelState.IsValid)
            {
                project.UserId = 1; // Replace with the actual user ID
                project.CreatedAt = DateTime.Now;

                _context.Projects.Add(project);
                _context.SaveChanges();

                return RedirectToAction(nameof(Index));
            }

            var errors = ModelState.Values.SelectMany(v => v.Errors);

            return View(project);

        }

        public IActionResult Edit (int id)
        {
            var project = _context.Projects.Find(id);
            if (project == null)
            {
                return NotFound();
            }
            return View(project);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Edit(int id, Project project)
        {
            if (id != project.Id)
            {
                return NotFound();
            }

            ModelState.Remove("User");
            ModelState.Remove("MainGoals");

            if (ModelState.IsValid)
            {
                _context.Update(project);
                _context.SaveChanges();
                return RedirectToAction(nameof(Index));
            }

            return View(project);
        }

        public IActionResult Delete(int id)
        {
            var project = _context.Projects.Find(id);
            if (project == null) return NotFound();

            return View(project);
        }

        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public IActionResult DeleteConfirmed(int id)
        {
            var project = _context.Projects.Find(id);
            if (project != null)
            {
                _context.Projects.Remove(project);
                _context.SaveChanges();
            }
            return RedirectToAction(nameof(Index));
        }
    }
}
