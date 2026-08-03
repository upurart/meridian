    function applyGridFilters() {
        if (!gridProjectsData) return;

        const btnClear = document.getElementById("btn-clear-filters");
        if (btnClear) {
            btnClear.disabled = (gridSearchQuery === "" && gridFilterStatus === "all" && gridSortStatus === "none");
        }

        let filtered = [...gridProjectsData];

        // 1. No project-specific filtering needed for workspaces

        // 2. Filter by search query if present
        if (gridSearchQuery) {
            filtered = filtered.filter(p =>
                (p.title && p.title.toLowerCase().includes(gridSearchQuery)) ||
                (p.name && p.name.toLowerCase().includes(gridSearchQuery)) ||
                (p.description && p.description.toLowerCase().includes(gridSearchQuery))
            );
        }

        if (gridSortStatus === 'none') {
            filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || a.id - b.id);
        } else {
            filtered.sort((a, b) => {
                if (gridSortStatus === 'closest-deadline') {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                } else if (gridSortStatus === 'farthest-deadline') {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(b.deadline) - new Date(a.deadline);
                } else if (gridSortStatus === 'highest-completion') {
                    return (b.progress || 0) - (a.progress || 0);
                } else if (gridSortStatus === 'lowest-completion') {
                    return (a.progress || 0) - (b.progress || 0);
                }
                return 0;
            });
        }

        const grid = document.getElementById("projects-grid");
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Sonuç bulunamadı.</p>
                </div>
            `;
            return;
        }

        if (currentProjectViewMode === 'list') {
            grid.style.display = "flex";
            grid.style.flexDirection = "column";
            grid.style.gap = "8px";
        } else if (currentProjectViewMode === 'compact') {
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(250px, 1fr))";
            grid.style.gap = "20px";
        } else {
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";
            grid.style.gap = "24px";
        }

        grid.innerHTML = filtered.map(item => {
            // Render Workspace Card
            const w = item;
            if (currentProjectViewMode === 'list') {
                return `
                    <div class="tm-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; border-radius: var(--radius-md); gap: 16px; margin: 0;" onclick="loadWorkspaceView(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}')">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex: 2; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="bi bi-briefcase text-primary"></i>
                                <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(w.name)}</div>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0;">${w.projectsCount} Proje</div>
                        </div>
                        
                        <div style="flex: 4; padding: 0 24px; color: var(--text-secondary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
                            ${escapeHtml(w.description || 'Açıklama yok')}
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 150px; justify-content: flex-end;">
                            <span class="badge" style="background-color: var(--bg-surface-hover); color: var(--text-secondary); font-size: 0.75rem;">${w.rolePreset}</span>
                            ${w.rolePreset === 'Owner' ? `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); deleteWorkspace(${w.id})" title="Sil"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                `;
            }

            if (currentProjectViewMode === 'compact') {
                return `
                    <div class="tm-card" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0;" onclick="loadWorkspaceView(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}')">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                            <i class="bi bi-briefcase text-primary"></i>
                            <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(w.name)}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                            <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">${w.projectsCount} Proje</div>
                            ${w.rolePreset === 'Owner' ? `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); deleteWorkspace(${w.id})" title="Sil" style="padding: 2px 6px;"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="tm-card" onclick="loadWorkspaceView(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}')" style="cursor: pointer; display: flex; flex-direction: column; height: 100%;">
                    <div class="tm-card-title" style="display: flex; align-items: center; gap: 8px;">
                        <i class="bi bi-briefcase text-primary"></i> ${escapeHtml(w.name)}
                    </div>
                    <div class="tm-card-desc" style="flex: 1; min-height: 40px; margin-bottom: 12px;">${escapeHtml(truncateString(w.description || 'Açıklama yok', 100))}</div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: auto;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                            <i class="bi bi-kanban"></i> ${w.projectsCount} Proje
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="badge" style="background-color: var(--bg-surface-hover); color: var(--text-secondary); font-size: 0.75rem;">
                                ${w.rolePreset}
                            </span>
                            ${w.rolePreset === 'Owner' ? `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); deleteWorkspace(${w.id})" title="Sil"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function countWeeklyCompletedTasks(project, startOfWeek) {
        let count = 0;
        
        (project.tasks || []).forEach(t => {
            if (t.isCompleted && t.completedAt && new Date(t.completedAt) >= startOfWeek) count++;
        });

        (project.mainGoals || []).forEach(mg => {
            (mg.tasks || []).forEach(t => {
                if (t.isCompleted && t.completedAt && new Date(t.completedAt) >= startOfWeek) count++;
            });

            (mg.subGoals || []).forEach(sg => {
                (sg.tasks || []).forEach(t => {
                    if (t.isCompleted && t.completedAt && new Date(t.completedAt) >= startOfWeek) count++;
                });
            });
        });
        
        return count;
    }

    async function loadHomeStatsAndGrid() {
        try {
            // Keep fetching stats from dashboard tree for stats cards
            const statsRes = await fetch("/api/dashboard/tree");
            let projects = await statsRes.json();
            
            if (typeof activeTeamId !== 'undefined' && activeTeamId) {
                projects = projects.filter(p => p.teamGroupId === activeTeamId);
            } else {
                projects = projects.filter(p => !p.teamGroupId);
            }

            // Compute statistics
            let totalProjects = projects.length;
            let approachingProjects = [];
            let overdueProjects = [];
            const oneWeekFromNow = new Date();
            oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
            const now = new Date();

            let weeklyCompletedTasks = 0;
            const currentDay = now.getDay();
            const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() + diffToMonday);
            startOfWeek.setHours(0, 0, 0, 0);

            projects.forEach(p => {
                weeklyCompletedTasks += countWeeklyCompletedTasks(p, startOfWeek);

                const roundProgress = Math.round(p.progress);
                if (roundProgress < 100 && p.deadline) {
                    const deadlineDate = new Date(p.deadline);
                    if (deadlineDate < now) {
                        overdueProjects.push({ title: p.title, progress: p.progress, deadline: deadlineDate });
                    } else if (deadlineDate <= oneWeekFromNow) {
                        approachingProjects.push({ title: p.title, progress: p.progress, deadline: deadlineDate });
                    }
                }
            });

            const statAppr = document.getElementById("stat-approaching-deadlines");
            const cardAppr = document.getElementById("stat-card-approaching");
            if (approachingProjects.length === 0) {
                statAppr.innerHTML = "Yaklaşan Teslim Yok";
                statAppr.style.fontSize = "1.2rem";
                cardAppr.classList.remove("stat-danger");
                cardAppr.classList.add("stat-success");
            } else {
                cardAppr.classList.add("stat-danger");
                cardAppr.classList.remove("stat-success");
                approachingProjects.sort((a, b) => a.deadline - b.deadline);
                const proj = approachingProjects[0];
                const daysLeft = Math.ceil((proj.deadline - now) / (1000 * 60 * 60 * 24));
                let extraText = "";
                if (approachingProjects.length > 1) {
                    extraText = `<div style="position: absolute; right: 20px; top: 20px; font-size: 0.85rem; color: var(--color-danger); font-weight: 600;">+${approachingProjects.length - 1} tane daha</div>`;
                }
                statAppr.innerHTML = `<div style="font-size: 1.5rem; line-height: 1.2;">${proj.title}</div><div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;">%${Math.round(proj.progress)} &bull; ${daysLeft} gün kaldı</div>${extraText}`;
                statAppr.style.fontSize = "1.5rem";
            }
            
            const statOverdue = document.getElementById("stat-overdue-projects");
            const cardOverdue = document.getElementById("stat-card-overdue");
            if (overdueProjects.length === 0) {
                statOverdue.innerHTML = "Geciken Proje Yok";
                statOverdue.style.fontSize = "1.2rem";
                cardOverdue.classList.remove("stat-error");
                cardOverdue.classList.add("stat-success");
            } else {
                cardOverdue.classList.add("stat-error");
                cardOverdue.classList.remove("stat-success");
                overdueProjects.sort((a, b) => a.deadline - b.deadline);
                const proj = overdueProjects[0];
                const daysOverdue = Math.floor((now - proj.deadline) / (1000 * 60 * 60 * 24));
                let extraText = "";
                if (overdueProjects.length > 1) {
                    extraText = `<div style="position: absolute; right: 20px; top: 20px; font-size: 0.85rem; color: var(--color-danger); font-weight: 600;">+${overdueProjects.length - 1} tane daha</div>`;
                }
                statOverdue.innerHTML = `<div style="font-size: 1.5rem; line-height: 1.2;">${proj.title}</div><div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;">%${Math.round(proj.progress)} &bull; ${daysOverdue} gün gecikti</div>${extraText}`;
                statOverdue.style.fontSize = "1.5rem";
            }
            
            document.getElementById("stat-weekly-productivity").innerText = weeklyCompletedTasks;

            // Fetch workspaces for grid
            const wsRes = await fetch("/api/WorkspaceApi");
            const workspaces = await wsRes.json();
            
            if (typeof activeTeamId !== 'undefined' && activeTeamId) {
                gridProjectsData = workspaces.filter(w => w.teamGroupId === activeTeamId);
            } else {
                gridProjectsData = workspaces.filter(w => !w.teamGroupId);
            }
            
            applyGridFilters();

        } catch (err) {
            console.error(err);
            showToast("Dashboard verileri yüklenirken hata oluştu.", "danger");
        }
    }

    function showDashboardHome(skipRailUpdate = false) {
        activeProjectId = null;
        activeTeamId = null;
        activeTeamName = null;
        activeWorkspaceId = null;
        activeWorkspaceName = null;

        document.getElementById("btn-project-share").style.display = "none";
        document.getElementById("project-progress-badge").style.display = "none";
        updateBreadcrumb(null, null, null);

        document.getElementById("home-view").style.display = "block";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";

        document.getElementById("home-view-title").innerText = "Kişisel Çalışma Alanları";
        const subEl = document.getElementById("home-view-subtitle");
        if (subEl) subEl.innerText = "Kişisel çalışma alanlarınızı ve projelerinizi buradan yönetin.";
        
        document.getElementById('btn-create-workspace-home').style.display = 'inline-block';
        document.getElementById('btn-create-project-home').style.display = 'none';
        document.getElementById('btn-join-project-home').style.display = 'none';
        
        document.getElementById('project-filters-group').style.display = 'none';
        document.getElementById('grid-search').placeholder = 'Çalışma alanı ara...';

        loadSidebarTree();
        loadHomeStatsAndGrid();
        if (!skipRailUpdate) {
            updateRailActive('rail-btn-home');
            collapseSidebar();
        }
    }

