using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Meridian.Models
{
    public partial class AppDbContext
    {
        private class PendingActivityLog
        {
            public object Entity { get; set; } = null!;
            public string ActionType { get; set; } = string.Empty;
            public string Details { get; set; } = string.Empty;
        }

        private List<PendingActivityLog> PreLogActivities()
        {
            var pendingLogs = new List<PendingActivityLog>();

            var projectStatusChangedIds = ChangeTracker.Entries<Project>()
                .Where(e => e.State == EntityState.Modified)
                .Where(e => {
                    var prop = e.Property("IsDeleted");
                    return (bool)prop.CurrentValue! != (bool)prop.OriginalValue!;
                })
                .Select(e => e.Entity.Id)
                .ToList();

            var entries = ChangeTracker.Entries()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified)
                .ToList();

            foreach (var entry in entries)
            {
                if (entry.Entity is ActivityLog) continue;

                if (entry.Entity is not Project)
                {
                    int projId = ResolveProjectId(entry.Entity);
                    if (projId != 0 && projectStatusChangedIds.Contains(projId))
                    {
                        continue;
                    }
                }

                string actionType = "";
                string entityType = GetCleanTypeName(entry.Entity);
                string entityName = entityType switch
                {
                    "Project" => "Proje",
                    "MainGoal" => "Ana Hedef",
                    "SubGoal" => "Alt Hedef",
                    "TaskItem" => "Görev",
                    _ => entityType
                };
                string details = "";
                var title = GetEntityTitle(entry.Entity);

                if (entry.State == EntityState.Added)
                {
                    actionType = "Oluşturuldu";
                    details = $"Yeni bir {entityName.ToLower()} oluşturuldu: '{title}'";
                }
                else if (entry.State == EntityState.Modified)
                {
                    var hasIsDeleted = entry.Properties.Any(p => p.Metadata.Name == "IsDeleted");
                    var hasIsCompleted = entry.Properties.Any(p => p.Metadata.Name == "IsCompleted");

                    bool isDeletedChanged = false;
                    bool isCompletedChanged = false;

                    if (hasIsDeleted)
                    {
                        var prop = entry.Property("IsDeleted");
                        if ((bool)prop.CurrentValue! != (bool)prop.OriginalValue!)
                        {
                            isDeletedChanged = true;
                            if ((bool)prop.CurrentValue!)
                            {
                                actionType = "Silindi";
                                details = $"'{title}' isimli {entityName.ToLower()} çöp kutusuna taşındı.";
                            }
                            else
                            {
                                actionType = "Geri Yüklendi";
                                details = $"'{title}' isimli {entityName.ToLower()} çöp kutusundan geri yüklendi.";
                            }
                        }
                    }

                    if (!isDeletedChanged && hasIsCompleted)
                    {
                        var prop = entry.Property("IsCompleted");
                        if ((bool)prop.CurrentValue! != (bool)prop.OriginalValue!)
                        {
                            isCompletedChanged = true;
                            if ((bool)prop.CurrentValue!)
                            {
                                actionType = "Tamamlandı";
                                details = $"'{title}' isimli {entityName.ToLower()} tamamlandı.";
                            }
                            else
                            {
                                actionType = "Geri Alındı";
                                details = $"'{title}' isimli {entityName.ToLower()} tamamlanma durumu geri alındı.";
                            }
                        }
                    }

                    if (!isDeletedChanged && !isCompletedChanged)
                    {
                        actionType = "Güncellendi";
                        details = $"'{title}' isimli {entityName.ToLower()} güncellendi.";
                    }
                }

                if (!string.IsNullOrWhiteSpace(actionType))
                {
                    pendingLogs.Add(new PendingActivityLog
                    {
                        Entity = entry.Entity,
                        ActionType = actionType,
                        Details = details
                    });
                }
            }
            return pendingLogs;
        }

        private void PostLogActivities(List<PendingActivityLog> pendingLogs)
        {
            if (pendingLogs == null || !pendingLogs.Any()) return;

            var logsToAdd = new List<ActivityLog>();

            foreach (var pending in pendingLogs)
            {
                int projectId = ResolveProjectId(pending.Entity);
                if (projectId != 0)
                {
                    logsToAdd.Add(new ActivityLog
                    {
                        ProjectId = projectId,
                        ActionType = pending.ActionType,
                        EntityType = GetCleanTypeName(pending.Entity),
                        EntityId = GetEntityId(pending.Entity),
                        Details = pending.Details,
                        UserID = GetCurrentUserId(),
                        CreatedAt = DateTime.Now
                    });
                }
            }

            if (logsToAdd.Any())
            {
                ActivityLogs.AddRange(logsToAdd);
                base.SaveChanges();
            }
        }

        private async Task PostLogActivitiesAsync(List<PendingActivityLog> pendingLogs)
        {
            if (pendingLogs == null || !pendingLogs.Any()) return;

            var logsToAdd = new List<ActivityLog>();

            foreach (var pending in pendingLogs)
            {
                int projectId = ResolveProjectId(pending.Entity);
                if (projectId != 0)
                {
                    logsToAdd.Add(new ActivityLog
                    {
                        ProjectId = projectId,
                        ActionType = pending.ActionType,
                        EntityType = GetCleanTypeName(pending.Entity),
                        EntityId = GetEntityId(pending.Entity),
                        Details = pending.Details,
                        UserID = GetCurrentUserId(),
                        CreatedAt = DateTime.Now
                    });
                }
            }

            if (logsToAdd.Any())
            {
                ActivityLogs.AddRange(logsToAdd);
                await base.SaveChangesAsync();
            }
        }

        private int GetCurrentUserId()
        {
            if (_httpContextAccessor?.HttpContext?.User != null)
            {
                var userIdString = _httpContextAccessor.HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdString, out int userId))
                {
                    return userId;
                }
            }
            return 1; 
        }

        private string GetCleanTypeName(object entity)
        {
            var type = entity.GetType();
            if (type.Namespace == "Castle.Proxies" || type.Name.Contains("Proxy"))
            {
                return type.BaseType?.Name ?? type.Name;
            }
            return type.Name;
        }

        private string GetEntityTitle(object entity)
        {
            var titleProp = entity.GetType().GetProperty("Title");
            if (titleProp != null)
            {
                return titleProp.GetValue(entity) as string ?? string.Empty;
            }
            return string.Empty;
        }

        private int GetEntityId(object entity)
        {
            var idProp = entity.GetType().GetProperty("Id");
            if (idProp != null)
            {
                return (int)idProp.GetValue(entity)!;
            }
            return 0;
        }

        private int ResolveProjectId(object entity)
        {
            if (entity is Project p) return p.Id;
            if (entity is MainGoal mg)
            {
                if (mg.ProjectId != 0) return mg.ProjectId;
                if (mg.Project != null) return mg.Project.Id;
                return 0;
            }
            if (entity is SubGoal sg)
            {
                if (sg.MainGoalId != 0)
                {
                    var dbMg = MainGoals.IgnoreQueryFilters().FirstOrDefault(m => m.Id == sg.MainGoalId);
                    return dbMg?.ProjectId ?? 0;
                }
                if (sg.MainGoal != null)
                {
                    if (sg.MainGoal.ProjectId != 0) return sg.MainGoal.ProjectId;
                    if (sg.MainGoal.Project != null) return sg.MainGoal.Project.Id;
                }
                return 0;
            }
            if (entity is TaskItem task)
            {
                if (task.ProjectId.HasValue && task.ProjectId.Value != 0) return task.ProjectId.Value;
                if (task.MainGoalId.HasValue && task.MainGoalId.Value != 0)
                {
                    var dbMg = MainGoals.IgnoreQueryFilters().FirstOrDefault(m => m.Id == task.MainGoalId.Value);
                    return dbMg?.ProjectId ?? 0;
                }
                if (task.SubGoalId.HasValue && task.SubGoalId.Value != 0)
                {
                    var dbSg = SubGoals.IgnoreQueryFilters().FirstOrDefault(s => s.Id == task.SubGoalId.Value);
                    if (dbSg != null)
                    {
                        var dbMg = MainGoals.IgnoreQueryFilters().FirstOrDefault(m => m.Id == dbSg.MainGoalId);
                        return dbMg?.ProjectId ?? 0;
                    }
                }
            }
            return 0;
        }

        private void UpdateTimestamps()
        {
            var entries = ChangeTracker.Entries()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified)
                .ToList();

            var now = DateTime.Now;

            foreach (var entry in entries)
            {
                var entityType = entry.Entity.GetType();

                var createdAtProp = entityType.GetProperty("CreatedAt");
                if (createdAtProp != null && entry.State == EntityState.Added)
                {
                    if (createdAtProp.PropertyType == typeof(DateTime) && (DateTime)createdAtProp.GetValue(entry.Entity)! == default)
                    {
                        createdAtProp.SetValue(entry.Entity, now);
                    }
                }

                var changedAtProp = entityType.GetProperty("ChangedAt");
                if (changedAtProp != null)
                {
                    changedAtProp.SetValue(entry.Entity, now);
                }

                if (entry.Entity is TaskItem task)
                {
                    if (task.IsCompleted && !task.CompletedAt.HasValue)
                    {
                        task.CompletedAt = now;
                    }
                    else if (!task.IsCompleted && task.CompletedAt.HasValue)
                    {
                        task.CompletedAt = null;
                    }
                }
            }

            var projectsToTouch = new HashSet<int>();
            var mainGoalsToTouch = new HashSet<int>();
            var subGoalsToTouch = new HashSet<int>();

            foreach (var entry in entries)
            {
                if (entry.Entity is TaskItem task)
                {
                    var sgId = (task.SubGoalId ?? 0) != 0 ? (task.SubGoalId ?? 0) : (task.SubGoal?.Id ?? 0);
                    if (sgId != 0)
                    {
                        subGoalsToTouch.Add(sgId);
                    }
                    else
                    {
                        var mgId = (task.MainGoalId ?? 0) != 0 ? (task.MainGoalId ?? 0) : (task.MainGoal?.Id ?? 0);
                        if (mgId != 0)
                        {
                            mainGoalsToTouch.Add(mgId);
                        }
                        else
                        {
                            var pId = (task.ProjectId ?? 0) != 0 ? (task.ProjectId ?? 0) : (task.Project?.Id ?? 0);
                            if (pId != 0)
                            {
                                projectsToTouch.Add(pId);
                            }
                        }
                    }
                }
                else if (entry.Entity is SubGoal sg)
                {
                    var mgId = sg.MainGoalId != 0 ? sg.MainGoalId : (sg.MainGoal?.Id ?? 0);
                    if (mgId != 0) mainGoalsToTouch.Add(mgId);
                }
                else if (entry.Entity is MainGoal mg)
                {
                    var pId = mg.ProjectId != 0 ? mg.ProjectId : (mg.Project?.Id ?? 0);
                    if (pId != 0) projectsToTouch.Add(pId);
                }
            }

            if (subGoalsToTouch.Any())
            {
                var subGoals = SubGoals.IgnoreQueryFilters().Where(sg => subGoalsToTouch.Contains(sg.Id)).ToList();
                foreach (var sg in subGoals)
                {
                    sg.ChangedAt = now;
                    Entry(sg).State = EntityState.Modified;

                    var mgId = sg.MainGoalId != 0 ? sg.MainGoalId : (sg.MainGoal?.Id ?? 0);
                    if (mgId != 0) mainGoalsToTouch.Add(mgId);
                }
            }

            if (mainGoalsToTouch.Any())
            {
                var mainGoals = MainGoals.IgnoreQueryFilters().Where(mg => mainGoalsToTouch.Contains(mg.Id)).ToList();
                foreach (var mg in mainGoals)
                {
                    mg.ChangedAt = now;
                    Entry(mg).State = EntityState.Modified;

                    var pId = mg.ProjectId != 0 ? mg.ProjectId : (mg.Project?.Id ?? 0);
                    if (pId != 0) projectsToTouch.Add(pId);
                }
            }

            if (projectsToTouch.Any())
            {
                var projects = Projects.IgnoreQueryFilters().Where(p => projectsToTouch.Contains(p.Id)).ToList();
                foreach (var p in projects)
                {
                    p.ChangedAt = now;
                    Entry(p).State = EntityState.Modified;
                }
            }
        }
    }
}
