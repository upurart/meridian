using System;
using System.Linq;
using Meridian.Models;

namespace Meridian.Services
{
    public interface ICascadeOperationService
    {
        void SoftDeleteProject(Project project, Guid batchId, DateTime deleteTime);
        void RestoreProject(Project project, Guid batchId);
        void SoftDeleteMainGoal(MainGoal mainGoal, Guid batchId, DateTime deleteTime);
        void RestoreMainGoal(MainGoal mainGoal, Guid batchId);
        void SoftDeleteSubGoal(SubGoal subGoal, Guid batchId, DateTime deleteTime);
        void RestoreSubGoal(SubGoal subGoal, Guid batchId);
    }

    public class CascadeOperationService : ICascadeOperationService
    {
        public void SoftDeleteProject(Project project, Guid batchId, DateTime deleteTime)
        {
            project.IsDeleted = true; 
            project.DeletedAt = deleteTime; 
            project.DeleteBatchId = batchId;

            if (project.Tasks != null)
            {
                foreach (var t in project.Tasks.Where(t => !t.IsDeleted)) 
                { 
                    t.IsDeleted = true; 
                    t.DeletedAt = deleteTime; 
                    t.DeleteBatchId = batchId; 
                }
            }

            if (project.MainGoal != null)
            {
                foreach (var mg in project.MainGoal.Where(mg => !mg.IsDeleted))
                {
                    SoftDeleteMainGoal(mg, batchId, deleteTime);
                }
            }
        }

        public void RestoreProject(Project project, Guid batchId)
        {
            project.IsDeleted = false; 
            project.DeletedAt = null; 
            project.DeleteBatchId = null;

            if (project.Tasks != null)
            {
                foreach (var t in project.Tasks.Where(t => t.DeleteBatchId == batchId && t.IsDeleted)) 
                { 
                    t.IsDeleted = false; 
                    t.DeletedAt = null; 
                    t.DeleteBatchId = null; 
                }
            }

            if (project.MainGoal != null)
            {
                foreach (var mg in project.MainGoal.Where(mg => mg.DeleteBatchId == batchId && mg.IsDeleted))
                {
                    RestoreMainGoal(mg, batchId);
                }
            }
        }

        public void SoftDeleteMainGoal(MainGoal mainGoal, Guid batchId, DateTime deleteTime)
        {
            mainGoal.IsDeleted = true; 
            mainGoal.DeletedAt = deleteTime; 
            mainGoal.DeleteBatchId = batchId;

            if (mainGoal.Tasks != null)
            {
                foreach (var t in mainGoal.Tasks.Where(t => !t.IsDeleted)) 
                { 
                    t.IsDeleted = true; 
                    t.DeletedAt = deleteTime; 
                    t.DeleteBatchId = batchId; 
                }
            }

            if (mainGoal.SubGoals != null)
            {
                foreach (var sg in mainGoal.SubGoals.Where(sg => !sg.IsDeleted))
                {
                    SoftDeleteSubGoal(sg, batchId, deleteTime);
                }
            }
        }

        public void RestoreMainGoal(MainGoal mainGoal, Guid batchId)
        {
            mainGoal.IsDeleted = false; 
            mainGoal.DeletedAt = null; 
            mainGoal.DeleteBatchId = null;

            if (mainGoal.Tasks != null)
            {
                foreach (var t in mainGoal.Tasks.Where(t => t.DeleteBatchId == batchId && t.IsDeleted)) 
                { 
                    t.IsDeleted = false; 
                    t.DeletedAt = null; 
                    t.DeleteBatchId = null; 
                }
            }

            if (mainGoal.SubGoals != null)
            {
                foreach (var sg in mainGoal.SubGoals.Where(sg => sg.DeleteBatchId == batchId && sg.IsDeleted))
                {
                    RestoreSubGoal(sg, batchId);
                }
            }
        }

        public void SoftDeleteSubGoal(SubGoal subGoal, Guid batchId, DateTime deleteTime)
        {
            subGoal.IsDeleted = true; 
            subGoal.DeletedAt = deleteTime; 
            subGoal.DeleteBatchId = batchId;

            if (subGoal.Tasks != null)
            {
                foreach (var t in subGoal.Tasks.Where(t => !t.IsDeleted)) 
                { 
                    t.IsDeleted = true; 
                    t.DeletedAt = deleteTime; 
                    t.DeleteBatchId = batchId; 
                }
            }
        }

        public void RestoreSubGoal(SubGoal subGoal, Guid batchId)
        {
            subGoal.IsDeleted = false; 
            subGoal.DeletedAt = null; 
            subGoal.DeleteBatchId = null;

            if (subGoal.Tasks != null)
            {
                foreach (var t in subGoal.Tasks.Where(t => t.DeleteBatchId == batchId && t.IsDeleted)) 
                { 
                    t.IsDeleted = false; 
                    t.DeletedAt = null; 
                    t.DeleteBatchId = null; 
                }
            }
        }
    }
}
