    function applyGridFilters() {
        if (!gridProjectsData) return;

        const btnClear = document.getElementById("btn-clear-filters");
        if (btnClear) {
            btnClear.disabled = (gridSearchQuery === "" && gridFilterStatus === "all" && gridSortStatus === "none");
        }

        let filtered = [...gridProjectsData];

        // 1. Filter projects based on status selection
        if (gridFilterStatus === 'active') {
            filtered = filtered.filter(p => Math.round(p.progress) < 100);
        } else if (gridFilterStatus === 'completed') {
            filtered = filtered.filter(p => Math.round(p.progress) === 100);
        } else if (gridFilterStatus === 'approaching') {
            const oneWeekFromNow = new Date();
            oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
            const now = new Date();
            filtered = filtered.filter(p => {
                if (Math.round(p.progress) === 100 || !p.deadline) return false;
                const deadlineDate = new Date(p.deadline);
                return deadlineDate >= now && deadlineDate <= oneWeekFromNow;
            });
        } else if (gridFilterStatus === 'overdue') {
            const now = new Date();
            filtered = filtered.filter(p => {
                if (Math.round(p.progress) === 100 || !p.deadline) return false;
                const deadlineDate = new Date(p.deadline);
                return deadlineDate < now;
            });
        }

        // 2. Filter by search query if present
        if (gridSearchQuery) {
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(gridSearchQuery) ||
                (p.description && p.description.toLowerCase().includes(gridSearchQuery))
            );
        }

        if (gridSortStatus === 'none') {
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
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
                    return b.progress - a.progress;
                } else if (gridSortStatus === 'lowest-completion') {
                    return a.progress - b.progress;
                }
                return 0;
            });
        }

        const grid = document.getElementById("projects-grid");
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Kriterlere uygun çalışma alanı bulunamadı.</p>
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

        grid.innerHTML = filtered.map(p => {
            const roundProgress = Math.round(p.progress);
            let changeText = "";
            if (p.changedAt) {
                const diffDays = Math.floor((new Date() - new Date(p.changedAt)) / (1000 * 60 * 60 * 24));
                changeText = diffDays === 0 ? "<span>🔄 Son Değişiklik: Bugün</span>" : `<span>🔄 Son Değişiklik: ${diffDays} gün önce</span>`;
            }
            
            if (currentProjectViewMode === 'list') {
                return `
                    <div class="tm-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; border-radius: var(--radius-md); gap: 16px; margin: 0;" onclick="loadProjectWorkspace(${p.id})">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex: 2; min-width: 0;">
                            <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.title)}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0;">${p.mainGoals.length} Ana Hedef</div>
                        </div>
                        
                        <div style="flex: 4; padding: 0 24px; color: var(--text-secondary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
                            ${escapeHtml(p.description || '')}
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 150px; justify-content: flex-end;">
                            <div class="progress-bar-bg" style="width: 100px; height: 6px; margin: 0;">
                                <div class="progress-bar-fill" style="width: ${roundProgress}%; background-color: ${getSmoothProgressColor(roundProgress)};"></div>
                            </div>
                            <span style="font-size: 0.85rem; font-weight: 600; color: ${getSmoothProgressColor(roundProgress)}; width: 45px; text-align: right;">%${roundProgress}</span>
                        </div>
                    </div>
                `;
            }

            if (currentProjectViewMode === 'compact') {
                return `
                    <div class="tm-card" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0;" onclick="loadProjectWorkspace(${p.id})">
                        <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(p.title)}</div>
                        <div style="font-size: 0.9rem; font-weight: 700; color: ${getSmoothProgressColor(roundProgress)}; flex-shrink: 0;">%${roundProgress}</div>
                    </div>
                `;
            }

            return `
                <div class="tm-card" onclick="loadProjectWorkspace(${p.id})">
                    <div class="tm-card-title">${escapeHtml(p.title)}</div>
                    <div class="tm-card-desc">${escapeHtml(truncateString(p.description || '', 100))}</div>
                    <div class="progress-container">
                        <div class="progress-header">
                            <span>Proje İlerlemesi</span>
                            <span style="color: ${getSmoothProgressColor(roundProgress)};">%${roundProgress}</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${roundProgress}%; background-color: ${getSmoothProgressColor(roundProgress)};"></div>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 12px;">
                        <span>${p.mainGoals.length} Ana Hedef</span>
                    </div>
                    ${changeText ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                        ${changeText}
                    </div>` : ''}
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
            const res = await fetch("/api/dashboard/tree");
            let projects = await res.json();
            
            projects = projects.filter(p => !p.teamGroupId);

            // Compute statistics
            let totalProjects = projects.length;
            let completedProjects = 0;
            let totalGoals = 0;
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
                if (roundProgress === 100) {
                    completedProjects++;
                } else if (p.deadline) {
                    const deadlineDate = new Date(p.deadline);
                    if (deadlineDate < now) {
                        overdueProjects.push({ title: p.title, progress: p.progress, deadline: deadlineDate });
                    } else if (deadlineDate <= oneWeekFromNow) {
                        approachingProjects.push({ title: p.title, progress: p.progress, deadline: deadlineDate });
                    }
                }
                p.mainGoals.forEach(mg => {
                    totalGoals++; // Main goals count only
                });
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

            gridProjectsData = projects;
            applyGridFilters();

        } catch (err) {
            console.error(err);
            showToast("Dashboard verileri yüklenirken hata oluştu.", "danger");
        }
    }

    function showDashboardHome(skipRailUpdate = false) {
        activeProjectId = null;
        activeTeamId = null;

        document.getElementById("btn-project-share").style.display = "none";
        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = "";
        document.querySelector(".breadcrumb-separator").style.display = "none";

        document.getElementById("home-view").style.display = "block";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";

        document.getElementById("home-view-title").innerText = "Çalışma Alanları";
        const subEl = document.getElementById("home-view-subtitle");
        if (subEl) subEl.innerText = "Tüm projelerinizi ve teslim tarihlerinizi buradan takip edin.";

        loadSidebarTree();
        loadHomeStatsAndGrid();
        if (!skipRailUpdate) {
            updateRailActive('rail-btn-home');
            collapseSidebar();
        }
    }

