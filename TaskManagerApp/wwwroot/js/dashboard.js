
    let activeProjectId = null;
    let activeTeamId = null;
    let treeData = [];
    let currentTeamsData = [];

    const collapsedNodes = new Set();
    const expandedAccordions = new Set();

    function toggleNodeCollapse(nodeId, event) {
        if (event) {
            event.stopPropagation();
        }
        if (collapsedNodes.has(nodeId)) {
            collapsedNodes.delete(nodeId);
        } else {
            collapsedNodes.add(nodeId);
        }
        applySidebarFilters();
    }

    let sidebarSearchQuery = "";
    let sidebarFilterStatus = "all";

    let gridProjectsData = [];
    let gridSearchQuery = "";
    let gridFilterStatus = "all";

    document.addEventListener("DOMContentLoaded", () => {
        loadSidebarTree();
        loadHomeStatsAndGrid();

        document.getElementById('sidebar-search').addEventListener('input', (e) => {
            sidebarSearchQuery = e.target.value.trim().toLowerCase();
            applySidebarFilters();
        });

        document.getElementById('sidebar-filter-status').addEventListener('change', (e) => {
            sidebarFilterStatus = e.target.value;
            applySidebarFilters();
        });

        document.getElementById('grid-search').addEventListener('input', (e) => {
            gridSearchQuery = e.target.value.trim().toLowerCase();
            applyGridFilters();
        });

        document.getElementById('grid-filter-status').addEventListener('change', (e) => {
            gridFilterStatus = e.target.value;
            applyGridFilters();
        });

        document.getElementById('sidebar-new-project-btn').addEventListener('click', () => {
            openProjectModal();
        });


    });

    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : '✕'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("active"), 10);
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove("active");
        setTimeout(() => modal.style.display = "none", 250);
    }

    async function loadSidebarTree() {
        try {
            const res = await fetch("/api/dashboard/tree");
            if (!res.ok) throw new Error("Sidebar yüklenemedi.");
            treeData = await res.json();
            applySidebarFilters();
            
            // Takımları yükle
            try {
                const teamRes = await fetch("/api/teams/teams");
                if (teamRes.ok) {
                    currentTeamsData = await teamRes.json();
                    renderSidebarTeams(currentTeamsData);
                    
                    if (document.getElementById("teams-dashboard-view").style.display === "block") {
                        renderTeamsDashboardGrid(currentTeamsData);
                    }
                }
            } catch (teamErr) {
                console.error("Takımlar yüklenemedi:", teamErr);
            }
        } catch (err) {
            console.error(err);
            showToast("Yan menü ağaç yapısı yüklenirken hata oluştu.", "danger");
        }
    }

    function renderSidebarTeams(data) {
        const container = document.getElementById("sidebar-teams-container");
        if (data.length === 0) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Henüz takım yok.</div>`;
            return;
        }

        let html = '<ul class="tree-list" style="border-left: none; padding-left: 0;">';
        data.forEach(t => {
            html += `
                <li style="font-weight: 500;">
                    <div class="tree-node-row" onclick="loadTeamWorkspace(${t.id}, '${escapeHtml(t.name)}')">
                        <div class="tree-node-title">
                            <span class="tree-caret-spacer"></span>
                            <span>👥</span>
                            <span>${escapeHtml(t.name)}</span>
                        </div>
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    }

    function renderSidebarTree(data) {
        const container = document.getElementById("sidebar-tree-container");
        if (data.length === 0) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Henüz proje yok.</div>`;
            return;
        }

        let html = '<ul class="tree-list" style="border-left: none; padding-left: 0;">';
        data.forEach(p => {
            const isWpActive = activeProjectId === p.id;
            const nodeId = `project-${p.id}`;
            const isCollapsed = collapsedNodes.has(nodeId);
            const pMainGoals = p.mainGoals || [];
            const pSubGoals = p.subGoals || [];
            const pTasks = p.tasks || [];
            const hasChildren = pMainGoals.length > 0 || pSubGoals.length > 0 || pTasks.length > 0;
            const caret = hasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${nodeId}', event)">${isCollapsed ? '▶' : '▼'}</span>` : '<span class="tree-caret-spacer"></span>';

            html += `
                <li style="font-weight: 500;">
                    <div class="tree-node-row ${isWpActive ? 'active' : ''}" onclick="loadProjectWorkspace(${p.id})">
                        <div class="tree-node-title">
                            ${caret}
                            <span>📁</span>
                            <span>${escapeHtml(p.title)}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">(${Math.round(p.progress)}%)</span>
                        </div>
                        <span class="tree-delete-btn" onclick="openDeleteModal('project', ${p.id}, event)">✕</span>
                    </div>
            `;

            if (hasChildren) {
                html += `<ul class="tree-list" style="${isCollapsed ? 'display: none;' : ''}">`;
                if (pMainGoals.length > 0) {
                    pMainGoals.forEach(mg => {
                        const mgTasks = mg.tasks || [];
                        const mgSubGoals = mg.subGoals || [];
                        const mgNodeId = `maingoal-${mg.id}`;
                        const isMgCollapsed = collapsedNodes.has(mgNodeId);
                        const mgHasChildren = mgSubGoals.length > 0 || mgTasks.length > 0;
                        const mgCaret = mgHasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${mgNodeId}', event)">${isMgCollapsed ? '▶' : '▼'}</span>` : '<span class="tree-caret-spacer"></span>';

                        html += `
                            <li>
                                <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'maingoal-${mg.id}')">
                                    <div class="tree-node-title">
                                        ${mgCaret}
                                        <span>🎯</span>
                                        <span>${escapeHtml(mg.title)}</span>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">(${Math.round(mg.progress)}%)</span>
                                    </div>
                                    <span class="tree-delete-btn" onclick="openDeleteModal('maingoal', ${mg.id}, event)">✕</span>
                                </div>
                        `;

                        if (mgHasChildren) {
                            html += `<ul class="tree-list" style="${isMgCollapsed ? 'display: none;' : ''}">`;
                            if (mgSubGoals.length > 0) {
                                mgSubGoals.forEach(sg => {
                                    const sgTasks = sg.tasks || [];
                                    const sgNodeId = `subgoal-${sg.id}`;
                                    const isSgCollapsed = collapsedNodes.has(sgNodeId);
                                    const sgHasChildren = sgTasks.length > 0;
                                    const sgCaret = sgHasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${sgNodeId}', event)">${isSgCollapsed ? '▶' : '▼'}</span>` : '<span class="tree-caret-spacer"></span>';

                                    html += `
                                        <li>
                                            <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}', 'maingoal-${mg.id}')">
                                                <div class="tree-node-title">
                                                    ${sgCaret}
                                                    <span>⚡</span>
                                                    <span>${escapeHtml(sg.title)}</span>
                                                    <span style="font-size: 0.75rem; color: var(--text-muted);">(${Math.round(sg.progress)}%)</span>
                                                </div>
                                                <span class="tree-delete-btn" onclick="openDeleteModal('subgoal', ${sg.id}, event)">✕</span>
                                            </div>
                                    `;
                                    if (sgHasChildren) {
                                        html += `<ul class="tree-list" style="${isSgCollapsed ? 'display: none;' : ''}">`;
                                        sgTasks.forEach(t => {
                                            html += `
                                                <li>
                                                    <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}', 'maingoal-${mg.id}')">
                                                        <div class="tree-node-title">
                                                            <span class="tree-caret-spacer"></span>
                                                            <span>📋</span>
                                                            <span style="text-decoration: ${t.isCompleted ? 'line-through' : 'none'}; color: ${t.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)'}">${escapeHtml(t.title)}</span>
                                                        </div>
                                                        <span class="tree-delete-btn" onclick="openDeleteModal('task', ${t.id}, event)">✕</span>
                                                    </div>
                                                </li>
                                            `;
                                        });
                                        html += '</ul>';
                                    }
                                    html += '</li>';
                                });
                            }
                            if (mgTasks.length > 0) {
                                mgTasks.forEach(t => {
                                    html += `
                                        <li>
                                            <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'maingoal-${mg.id}')">
                                                <div class="tree-node-title">
                                                    <span class="tree-caret-spacer"></span>
                                                    <span>📋</span>
                                                    <span style="text-decoration: ${t.isCompleted ? 'line-through' : 'none'}; color: ${t.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)'}">${escapeHtml(t.title)}</span>
                                                </div>
                                                <span class="tree-delete-btn" onclick="openDeleteModal('task', ${t.id}, event)">✕</span>
                                            </div>
                                        </li>
                                    `;
                                });
                            }
                            html += '</ul>';
                        }
                        html += '</li>';
                    });
                }

                if (pSubGoals.length > 0) {
                    pSubGoals.forEach(sg => {
                        const sgTasks = sg.tasks || [];
                        const sgNodeId = `subgoal-${sg.id}`;
                        const isSgCollapsed = collapsedNodes.has(sgNodeId);
                        const sgHasChildren = sgTasks.length > 0;
                        const sgCaret = sgHasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${sgNodeId}', event)">${isSgCollapsed ? '▶' : '▼'}</span>` : '<span class="tree-caret-spacer"></span>';

                        html += `
                            <li>
                                <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}')">
                                    <div class="tree-node-title">
                                        ${sgCaret}
                                        <span>⚡</span>
                                        <span>${escapeHtml(sg.title)}</span>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">(${Math.round(sg.progress)}%)</span>
                                    </div>
                                    <span class="tree-delete-btn" onclick="openDeleteModal('subgoal', ${sg.id}, event)">✕</span>
                                </div>
                        `;

                        if (sgHasChildren) {
                            html += `<ul class="tree-list" style="${isSgCollapsed ? 'display: none;' : ''}">`;
                            sgTasks.forEach(t => {
                                html += `
                                    <li>
                                        <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}')">
                                            <div class="tree-node-title">
                                                <span class="tree-caret-spacer"></span>
                                                <span>📋</span>
                                                <span style="text-decoration: ${t.isCompleted ? 'line-through' : 'none'}; color: ${t.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)'}">${escapeHtml(t.title)}</span>
                                            </div>
                                            <span class="tree-delete-btn" onclick="openDeleteModal('task', ${t.id}, event)">✕</span>
                                        </div>
                                    </li>
                                `;
                            });
                            html += '</ul>';
                        }
                        html += '</li>';
                    });
                }

                if (pTasks.length > 0) {
                    pTasks.forEach(t => {
                        html += `
                            <li>
                                <div class="tree-node-row" onclick="loadProjectWorkspace(${p.id})">
                                    <div class="tree-node-title">
                                        <span class="tree-caret-spacer"></span>
                                        <span>📋</span>
                                        <span style="text-decoration: ${t.isCompleted ? 'line-through' : 'none'}; color: ${t.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)'}">${escapeHtml(t.title)}</span>
                                    </div>
                                    <span class="tree-delete-btn" onclick="openDeleteModal('task', ${t.id}, event)">✕</span>
                                </div>
                            </li>
                        `;
                    });
                }
                html += '</ul>';
            }
            html += '</li>';
        });
        html += '</ul>';
        container.innerHTML = html;
    }

    function applySidebarFilters() {
        if (!treeData) return;

        let filtered = treeData.filter(p => !p.teamGroupId);

        // 1. Filter projects based on status selection
        if (sidebarFilterStatus === 'active') {
            filtered = filtered.filter(p => Math.round(p.progress) < 100);
        } else if (sidebarFilterStatus === 'completed') {
            filtered = filtered.filter(p => Math.round(p.progress) === 100);
        }

        // 2. Filter by search query if present
        if (sidebarSearchQuery) {
            filtered = filtered.filter(p => {
                const projectMatches = p.title.toLowerCase().includes(sidebarSearchQuery);
                const matchingTasks = p.tasks ? p.tasks.filter(t => t.title.toLowerCase().includes(sidebarSearchQuery)) : [];

                // Check main goals
                const matchingGoals = p.mainGoals ? p.mainGoals.filter(mg => {
                    const goalMatches = mg.title.toLowerCase().includes(sidebarSearchQuery);
                    const matchingSubs = mg.subGoals ? mg.subGoals.filter(sg => {
                        const sgMatches = sg.title.toLowerCase().includes(sidebarSearchQuery);
                        const matchingSgTasks = sg.tasks ? sg.tasks.filter(t => t.title.toLowerCase().includes(sidebarSearchQuery)) : [];
                        if (matchingSgTasks.length > 0) {
                            sg.filteredTasks = matchingSgTasks;
                            return true;
                        }
                        sg.filteredTasks = sg.tasks;
                        return sgMatches;
                    }) : [];

                    const matchingMgTasks = mg.tasks ? mg.tasks.filter(t => t.title.toLowerCase().includes(sidebarSearchQuery)) : [];

                    if (matchingSubs.length > 0 || matchingMgTasks.length > 0) {
                        mg.filteredSubs = matchingSubs;
                        mg.filteredTasks = matchingMgTasks.length > 0 ? matchingMgTasks : mg.tasks;
                        return true;
                    }
                    mg.filteredSubs = mg.subGoals;
                    mg.filteredTasks = mg.tasks;
                    return goalMatches;
                }) : [];

                const matchingDirectSubs = p.subGoals ? p.subGoals.filter(sg => {
                    const sgMatches = sg.title.toLowerCase().includes(sidebarSearchQuery);
                    const matchingSgTasks = sg.tasks ? sg.tasks.filter(t => t.title.toLowerCase().includes(sidebarSearchQuery)) : [];
                    if (matchingSgTasks.length > 0) {
                        sg.filteredTasks = matchingSgTasks;
                        return true;
                    }
                    sg.filteredTasks = sg.tasks;
                    return sgMatches;
                }) : [];

                if (matchingGoals.length > 0 || matchingDirectSubs.length > 0 || matchingTasks.length > 0) {
                    p.filteredGoals = matchingGoals;
                    p.filteredDirectSubs = matchingDirectSubs;
                    p.filteredTasks = matchingTasks.length > 0 ? matchingTasks : p.tasks;
                    return true;
                }
                
                p.filteredGoals = p.mainGoals;
                p.filteredDirectSubs = p.subGoals;
                p.filteredTasks = p.tasks;
                return projectMatches;
            });
        } else {
            // Reset filter fields
            filtered.forEach(p => {
                p.filteredGoals = p.mainGoals;
                p.filteredDirectSubs = p.subGoals;
                p.filteredTasks = p.tasks;
                if (p.mainGoals) {
                    p.mainGoals.forEach(mg => {
                        mg.filteredSubs = mg.subGoals;
                        mg.filteredTasks = mg.tasks;
                        if (mg.subGoals) {
                            mg.subGoals.forEach(sg => { sg.filteredTasks = sg.tasks; });
                        }
                    });
                }
                if (p.subGoals) {
                    p.subGoals.forEach(sg => { sg.filteredTasks = sg.tasks; });
                }
            });
        }

        const renderData = filtered.map(p => ({
            id: p.id,
            title: p.title,
            progress: p.progress,
            tasks: (p.filteredTasks || p.tasks || []).map(t => ({
                id: t.id, title: t.title, isCompleted: t.isCompleted
            })),
            mainGoals: (p.filteredGoals || p.mainGoals || []).map(mg => ({
                id: mg.id,
                projectId: mg.projectId,
                title: mg.title,
                progress: mg.progress,
                tasks: (mg.filteredTasks || mg.tasks || []).map(t => ({
                    id: t.id, title: t.title, isCompleted: t.isCompleted
                })),
                subGoals: (mg.filteredSubs || mg.subGoals || []).map(sg => ({
                    id: sg.id, mainGoalId: sg.mainGoalId, title: sg.title, progress: sg.progress,
                    tasks: (sg.filteredTasks || sg.tasks || []).map(t => ({ id: t.id, title: t.title, isCompleted: t.isCompleted }))
                }))
            })),
            subGoals: (p.filteredDirectSubs || p.subGoals || []).map(sg => ({
                id: sg.id,
                projectId: sg.projectId,
                title: sg.title,
                progress: sg.progress,
                tasks: (sg.filteredTasks || sg.tasks || []).map(t => ({ id: t.id, title: t.title, isCompleted: t.isCompleted }))
            }))
        }));

        renderSidebarTree(renderData);
    }

    function applyGridFilters() {
        if (!gridProjectsData) return;

        let filtered = gridProjectsData;

        // 1. Filter projects based on status selection
        if (gridFilterStatus === 'active') {
            filtered = filtered.filter(p => Math.round(p.progress) < 100);
        } else if (gridFilterStatus === 'completed') {
            filtered = filtered.filter(p => Math.round(p.progress) === 100);
        }

        // 2. Filter by search query if present
        if (gridSearchQuery) {
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(gridSearchQuery) ||
                (p.description && p.description.toLowerCase().includes(gridSearchQuery))
            );
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

        grid.innerHTML = filtered.map(p => {
            const roundProgress = Math.round(p.progress);
            return `
                <div class="tm-card" onclick="loadProjectWorkspace(${p.id})">
                    <div class="tm-card-title">${escapeHtml(p.title)}</div>
                    <div class="tm-card-desc">${escapeHtml(truncateString(p.description || '', 100))}</div>
                    <div class="progress-container">
                        <div class="progress-header">
                            <span>Proje İlerlemesi</span>
                            <span>%${roundProgress}</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill ${roundProgress === 100 ? 'progress-bar-fill-success' : ''}" style="width: ${roundProgress}%"></div>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${p.mainGoals.length} Ana Hedef</span>
                        <span>Açmak için tıklayın →</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 8px; display: flex; flex-direction: column; gap: 2px;">
                        <span>📅 Oluşturulma: ${new Date(p.createdAt).toLocaleString("tr-TR")}</span>
                        ${p.changedAt ? `<span>🔄 Değişiklik: ${new Date(p.changedAt).toLocaleString("tr-TR")}</span>` : ''}
                    </div>
                </div>
            `;
        }).join("");
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

            projects.forEach(p => {
                const roundProgress = Math.round(p.progress);
                if (roundProgress === 100) {
                    completedProjects++;
                }
                p.mainGoals.forEach(mg => {
                    totalGoals++; // Main goals count only
                });
            });

            document.getElementById("stat-projects-count").innerText = totalProjects;
            document.getElementById("stat-goals-count").innerText = totalGoals;
            document.getElementById("stat-completed-projects-count").innerText = `${completedProjects} / ${totalProjects}`;

            gridProjectsData = projects;
            applyGridFilters();

        } catch (err) {
            console.error(err);
            showToast("Dashboard verileri yüklenirken hata oluştu.", "danger");
        }
    }

    function showDashboardHome() {
        activeProjectId = null;
        activeTeamId = null;

        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = "";
        document.querySelector(".breadcrumb-separator").style.display = "none";

        document.getElementById("home-view").style.display = "block";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";

        document.getElementById("home-view-title").innerText = "Çalışma Alanları";

        loadSidebarTree();
        loadHomeStatsAndGrid();
    }

    function loadTeamWorkspace(teamId, teamName) {
        activeProjectId = null;
        activeTeamId = teamId;
        
        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = teamName;
        document.querySelector(".breadcrumb-separator").style.display = "inline";

        document.getElementById("home-view").style.display = "block";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";

        document.getElementById("home-view-title").innerText = teamName + " Projeleri";

        // Filter grid
        gridProjectsData = treeData.filter(p => p.teamGroupId === teamId);
        
        // Re-calculate stats for this team
        let totalProjects = gridProjectsData.length;
        let completedProjects = 0;
        let totalGoals = 0;

        gridProjectsData.forEach(p => {
            const roundProgress = Math.round(p.progress);
            if (roundProgress === 100) {
                completedProjects++;
            }
            p.mainGoals.forEach(mg => {
                totalGoals++;
            });
        });

        document.getElementById("stat-projects-count").innerText = totalProjects;
        document.getElementById("stat-goals-count").innerText = totalGoals;
        document.getElementById("stat-completed-projects-count").innerText = `${completedProjects} / ${totalProjects}`;

        applyGridFilters();
    }

    async function triggerGlobalRefresh() {
        loadSidebarTree();
        loadHomeStatsAndGrid();
        if (activeProjectId) {
            await refreshWorkspaceData();
        }
        if (document.getElementById("deleted-view").style.display === "block") {
            await loadDeletedProjects();
        }
        // Eğer aktiviteler sekmesi açıksa orayı da yenile
        if (document.getElementById("activities-view").style.display === "block") {
            await loadFullActivitiesView();
        }
    }

    function showTeamsDashboard() {
        activeProjectId = null;
        activeTeamId = null;
        
        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = "Takımlar";
        document.querySelector(".breadcrumb-separator").style.display = "inline";

        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "block";

        renderTeamsDashboardGrid(currentTeamsData);
    }

    function renderTeamsDashboardGrid(teams) {
        const grid = document.getElementById("teams-dashboard-grid");
        
        if (!teams || teams.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">Henüz bir takımınız yok. Takım kurabilir veya mevcut bir takıma ID ile katılabilirsiniz.</p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="tm-btn tm-btn-secondary" onclick="openJoinTeamModal()">+ Takıma Katıl</button>
                        <button class="tm-btn tm-btn-primary" onclick="openCreateTeamModal()">+ Yeni Takım Kur</button>
                    </div>
                </div>
            `;
            return;
        }

        grid.innerHTML = teams.map(t => {
            const isManager = t.myRole === 'Owner' || t.myRole === 'Admin';
            const manageBtn = isManager ? 
                `<button class="tm-btn tm-btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); openManageTeamModal(${t.id})">⚙️ Yönet${t.pendingRequestsCount > 0 ? ` <span style="color:var(--color-danger);font-weight:bold;">(${t.pendingRequestsCount})</span>` : ''}</button>` : '';

            return `
                <div class="tm-card" onclick="loadTeamWorkspace(${t.id}, '${escapeHtml(t.name)}')">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div class="tm-card-title" style="margin-bottom: 0;">${escapeHtml(t.name)}</div>
                        <span style="font-size: 0.75rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 12px; color: var(--text-secondary);">ID: ${t.id}</span>
                    </div>
                    <div class="tm-card-desc" style="min-height: 40px;">${escapeHtml(truncateString(t.description || '', 100))}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 16px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
                        <div style="display: flex; gap: 8px;">
                            <span>👥 ${t.memberCount || 1} Üye</span>
                            <span>📁 ${t.projectCount || 0} Proje</span>
                        </div>
                        ${manageBtn}
                    </div>
                </div>
            `;
        }).join("");
    }

    function openCreateTeamModal() {
        document.getElementById('create-team-form').reset();
        openModal('create-team-modal');
    }

    function openJoinTeamModal() {
        document.getElementById('join-team-form').reset();
        openModal('join-team-modal');
    }

    async function handleCreateTeamSubmit(event) {
        event.preventDefault();
        const name = document.getElementById('team-name').value.trim();
        const desc = document.getElementById('team-desc').value.trim();
        const isOpen = document.getElementById('team-is-open').checked;

        try {
            const res = await fetch("/api/teams/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name, description: desc, isOpenToJoin: isOpen })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Takım kurulamadı.");
            }

            showToast("Takım başarıyla kuruldu.", "success");
            closeModal('create-team-modal');
            await loadSidebarTree(); 
        } catch (error) {
            showToast(error.message, "danger");
        }
    }

    async function handleJoinTeamSubmit(event) {
        event.preventDefault();
        const teamId = document.getElementById('join-team-id').value.trim();

        try {
            const res = await fetch("/api/teams/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId: parseInt(teamId) })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Takıma katılım başarısız.");
            }

            const data = await res.json();
            if (data.status === "Requested") {
                showToast("Katılım isteğiniz takım yöneticisine iletildi.", "success");
            } else {
                showToast("Takıma başarıyla katıldınız.", "success");
            }
            closeModal('join-team-modal');
            await loadSidebarTree(); 
        } catch (error) {
            showToast(error.message, "danger");
        }
    }

    // --- TEAM MANAGEMENT ---
    function switchManageTab(tab) {
        document.getElementById('manage-content-members').style.display = tab === 'members' ? 'block' : 'none';
        document.getElementById('manage-content-requests').style.display = tab === 'requests' ? 'block' : 'none';
        
        document.getElementById('tab-members').classList.toggle('tm-btn-primary', tab === 'members');
        document.getElementById('tab-members').classList.toggle('tm-btn-secondary', tab !== 'members');
        document.getElementById('tab-requests').classList.toggle('tm-btn-primary', tab === 'requests');
        document.getElementById('tab-requests').classList.toggle('tm-btn-secondary', tab !== 'requests');
    }

    async function openManageTeamModal(teamId) {
        document.getElementById('manage-team-id').value = teamId;
        switchManageTab('members');
        openModal('manage-team-modal');
        await loadTeamMembers(teamId);
        await loadTeamRequests(teamId);
    }

    async function loadTeamMembers(teamId) {
        const list = document.getElementById('members-list');
        list.innerHTML = 'Yükleniyor...';
        try {
            const res = await fetch(`/api/teams/${teamId}/members`);
            if (!res.ok) throw new Error();
            const members = await res.json();
            
            list.innerHTML = members.map(m => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:var(--radius-md);">
                    <div>
                        <div style="font-weight:600;">${escapeHtml(m.name)}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(m.email)}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <select class="form-control" style="width:120px; font-size:0.85rem;" onchange="updateTeamRole(${teamId}, ${m.userId}, this.value)" ${m.role === 'Owner' ? 'disabled' : ''}>
                            <option value="Member" ${m.role === 'Member' ? 'selected' : ''}>Üye</option>
                            <option value="Admin" ${m.role === 'Admin' ? 'selected' : ''}>Yönetici</option>
                            <option value="Owner" ${m.role === 'Owner' ? 'selected' : ''}>Kurucu (Devret)</option>
                        </select>
                        ${m.role !== 'Owner' ? `<button class="tm-btn-icon-only" style="color:var(--color-danger);" onclick="kickTeamMember(${teamId}, ${m.userId})" title="Üyeyi Çıkar">✕</button>` : ''}
                    </div>
                </div>
            `).join("");
        } catch (e) {
            list.innerHTML = 'Üyeler yüklenemedi.';
        }
    }

    async function loadTeamRequests(teamId) {
        const list = document.getElementById('requests-list');
        const badge = document.getElementById('requests-badge');
        list.innerHTML = 'Yükleniyor...';
        try {
            const res = await fetch(`/api/teams/${teamId}/requests`);
            if (!res.ok) throw new Error();
            const requests = await res.json();
            
            if (requests.length > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = requests.length;
            } else {
                badge.style.display = 'none';
            }

            if (requests.length === 0) {
                list.innerHTML = '<div style="color:var(--text-muted); padding:12px;">Bekleyen katılım isteği bulunmuyor.</div>';
                return;
            }

            list.innerHTML = requests.map(r => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:var(--radius-md);">
                    <div>
                        <div style="font-weight:600;">${escapeHtml(r.name)}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(r.email)}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="tm-btn tm-btn-primary" style="padding:4px 12px; font-size:0.8rem;" onclick="respondTeamRequest(${teamId}, ${r.id}, 'Approve')">Onayla</button>
                        <button class="tm-btn tm-btn-danger" style="padding:4px 12px; font-size:0.8rem;" onclick="respondTeamRequest(${teamId}, ${r.id}, 'Reject')">Reddet</button>
                    </div>
                </div>
            `).join("");
        } catch (e) {
            list.innerHTML = 'İstekler yüklenemedi.';
        }
    }

    async function updateTeamRole(teamId, userId, role) {
        if (role === 'Owner') {
            if (!confirm("Takım sahipliğini devretmek istediğinizden emin misiniz? Bu işlemi geri alamazsınız.")) {
                loadTeamMembers(teamId);
                return;
            }
        }
        try {
            const res = await fetch(`/api/teams/${teamId}/members/${userId}/role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: role })
            });
            if (!res.ok) throw new Error();
            showToast("Üye rolü güncellendi.", "success");
            await loadTeamMembers(teamId);
            if (role === 'Owner') {
                closeModal('manage-team-modal');
                await loadSidebarTree();
            }
        } catch (e) {
            showToast("Rol güncellenirken hata oluştu veya yetkiniz yok.", "danger");
            loadTeamMembers(teamId);
        }
    }

    async function kickTeamMember(teamId, userId) {
        if (!confirm("Bu üyeyi takımdan çıkarmak istediğinizden emin misiniz?")) return;
        try {
            const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            showToast("Üye takımdan çıkarıldı.", "success");
            await loadTeamMembers(teamId);
            await loadSidebarTree();
        } catch (e) {
            showToast("Üye çıkarılırken hata oluştu.", "danger");
        }
    }

    async function respondTeamRequest(teamId, requestId, action) {
        try {
            const res = await fetch(`/api/teams/${teamId}/requests/${requestId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: action })
            });
            if (!res.ok) throw new Error();
            showToast(action === 'Approve' ? "İstek onaylandı." : "İstek reddedildi.", "success");
            await loadTeamRequests(teamId);
            if (action === 'Approve') {
                await loadTeamMembers(teamId);
                await loadSidebarTree();
            }
        } catch (e) {
            showToast("İşlem sırasında hata oluştu.", "danger");
        }
    }

    async function loadProjectWorkspace(projectId) {
        activeProjectId = projectId;

        collapsedNodes.delete(`project-${projectId}`);

        expandedAccordions.clear();

        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "block";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";

        switchWorkspaceTab('active');
        await refreshWorkspaceData();
        loadSidebarTree();
    }

    async function loadProjectWorkspaceAndExpandGoal(projectId, expandNodeId, parentExpandNodeId = null) {
        collapsedNodes.delete(`project-${projectId}`);

        if (expandNodeId.startsWith('maingoal-')) {
            collapsedNodes.delete(expandNodeId);
        }
        
        if (parentExpandNodeId) {
            expandedAccordions.add(parentExpandNodeId);
            if (parentExpandNodeId.startsWith('maingoal-')) {
                collapsedNodes.delete(parentExpandNodeId);
            }
        }
        
        expandedAccordions.add(expandNodeId);

        await loadProjectWorkspace(projectId);

        setTimeout(() => {
            if (parentExpandNodeId) {
                const parentElement = document.getElementById(parentExpandNodeId);
                if (parentElement) {
                    parentElement.classList.add("expanded");
                }
            }
            const element = document.getElementById(expandNodeId);
            if (element) {
                element.classList.add("expanded");
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }

    async function refreshWorkspaceData() {
        if (!activeProjectId) return;

        try {
            const res = await fetch(`/api/dashboard/project/${activeProjectId}`);
            if (!res.ok) throw new Error("Proje detayı alınamadı.");
            const project = await res.json();

            document.getElementById("breadcrumb-project").innerText = project.title;
            document.querySelector(".breadcrumb-separator").style.display = "inline";

            const badge = document.getElementById("project-progress-badge");
            badge.style.display = "block";
            const roundedProjectProgress = Math.round(project.progress);
            document.getElementById("project-progress-val").innerText = `%${roundedProjectProgress}`;

            document.getElementById("wp-title").innerText = project.title;
            document.getElementById("wp-desc").innerText = project.description;

            const createdStr = new Date(project.createdAt).toLocaleString("tr-TR");
            const changedStr = project.changedAt ? new Date(project.changedAt).toLocaleString("tr-TR") : "-";
            document.getElementById("wp-dates").innerHTML = `<span>📅 <b>Oluşturulma:</b> ${createdStr}</span> <span>🔄 <b>Değişiklik:</b> ${changedStr}</span>`;

            const barFill = document.getElementById("wp-progress-bar");
            const barText = document.getElementById("wp-progress-text");
            barFill.style.width = `${roundedProjectProgress}%`;
            barText.innerText = `%${roundedProjectProgress}`;

            if (roundedProjectProgress === 100) {
                barFill.classList.add("progress-bar-fill-success");
            } else {
                barFill.classList.remove("progress-bar-fill-success");
            }

            document.getElementById("wp-edit-btn").onclick = () => openProjectModal(project);
            document.getElementById("wp-delete-btn").onclick = () => openDeleteModal('project', project.id);
            document.getElementById("wp-add-maingoal-btn").onclick = () => openMainGoalModal(project.id);
            document.getElementById("wp-add-project-subgoal-btn").onclick = () => openSubGoalModal(null, null, project.id);
            document.getElementById("wp-add-project-task-btn").onclick = () => openTaskModal(null, null, project.id, null);

            if (currentWorkspaceTab === 'deleted') {
                loadDeletedProjectItems();
            } else {
                renderWorkspaceGoals(project.mainGoals, project.subGoals, project.tasks);
            }

        } catch (err) {
            console.error(err);
            showToast("Proje çalışma alanı yüklenirken hata oluştu.", "danger");
            showDashboardHome();
        }
    }

    function renderWorkspaceGoals(mainGoals, subGoals, projectTasks) {
        const container = document.getElementById("maingoals-list");

        if (mainGoals.length === 0 && (!projectTasks || projectTasks.length === 0) && (!subGoals || subGoals.length === 0)) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">Bu projede henüz herhangi bir ana hedef veya görev tanımlanmamış.</p>
                    <button class="tm-btn tm-btn-success" onclick="openMainGoalModal(${activeProjectId})">+ İlk Ana Hedefi Ekle</button>
                </div>
            `;
            return;
        }

        let html = "";

        if (mainGoals && mainGoals.length > 0) {
            html += `
                <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    📌 Ana Hedefler
                </h3>
            `;
            html += mainGoals.map(mg => {
                const mgProgress = Math.round(mg.progress);
                const mgId = `maingoal-${mg.id}`;
                const isExpanded = expandedAccordions.has(mgId);

                const hasSubGoals = mg.subGoals && mg.subGoals.length > 0;
                const hasTasks = mg.tasks && mg.tasks.length > 0;
                const showToggleCompletion = !hasSubGoals && !hasTasks;

                return `
                    <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${mgId}">
                        <div class="goal-card-header" onclick="toggleAccordion('${mgId}')">
                            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span style="font-size: 1.1rem;">🎯</span>
                                        <span style="font-weight: 600; font-size: 1.05rem;">${escapeHtml(mg.title)}</span>
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 12px;">
                                        <span>📅 ${new Date(mg.createdAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                                        ${mg.changedAt ? `<span>🔄 ${new Date(mg.changedAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>` : ''}
                                    </div>
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <div class="progress-bar-bg" style="width: 120px; height: 6px;">
                                        <div class="progress-bar-fill ${mgProgress === 100 ? 'progress-bar-fill-success' : ''}" style="width: ${mgProgress}%"></div>
                                    </div>
                                    <span style="font-size: 0.85rem; font-weight: 600; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${mgProgress}</span>
                                </div>
                            </div>
                            
                            <span class="accordion-caret" style="color: var(--text-muted);">▼</span>
                        </div>

                        <div class="goal-card-content-wrapper">
                            <div class="goal-card-content">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; flex-wrap: wrap; gap: 16px;">
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.95rem; line-height: 1.5; flex: 1;">${escapeHtml(mg.description)}</p>
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                        <button class="tm-btn tm-btn-success" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openSubGoalModal(${mg.id})">+ Alt Hedef Ekle</button>
                                        <button class="tm-btn tm-btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openTaskModal(null, null, null, ${mg.id})">+ Görev Ekle</button>
                                        <button class="tm-btn tm-btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openMainGoalModal(${mg.projectId}, ${JSON.stringify(mg).replace(/"/g, '&quot;')})">Düzenle</button>
                                        <button class="tm-btn tm-btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openDeleteModal('maingoal', ${mg.id})">Sil</button>
                                        ${showToggleCompletion ? `
                                            <button class="tm-btn tm-btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; border-color: ${mg.isCompleted ? 'var(--color-success)' : 'var(--border-color)'}" onclick="toggleMainGoalCompletion(${mg.id})">
                                                ${mg.isCompleted ? '✓ Tamamlandı' : '⏳ Tamamla'}
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                <div style="display: flex; flex-direction: column; gap: 16px;">
                                    ${renderSubGoals(mg.subGoals)}
                                    ${mg.tasks && mg.tasks.length > 0 ? `
                                        <div class="tm-card" style="border: 1px solid var(--border-color); padding: 12px; background-color: var(--bg-surface-elevated);">
                                            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">📋 Ana Hedef Görevleri</h4>
                                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                                ${renderTasks(mg.tasks)}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }

        // Render project-level subgoals
        if (subGoals && subGoals.length > 0) {
            const containerId = 'project-subgoals-container';
            const isExpanded = expandedAccordions.has(containerId) ? 'expanded' : '';
            html += `
                <div class="goal-card ${isExpanded}" id="${containerId}">
                    <div class="goal-card-header" onclick="toggleAccordion('${containerId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.1rem;">📌</span>
                                <span style="font-weight: 600; font-size: 1.05rem;">Proje Alt Hedefleri</span>
                            </div>
                        </div>
                        <span class="accordion-caret" style="color: var(--text-muted);">▼</span>
                    </div>
                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content">
                            <div style="display: flex; flex-direction: column; gap: 16px;">
                                ${renderSubGoals(subGoals)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Render project-level direct tasks
        if (projectTasks && projectTasks.length > 0) {
            const containerId = 'project-tasks-container';
            const isExpanded = expandedAccordions.has(containerId) ? 'expanded' : '';
            html += `
                <div class="goal-card ${isExpanded}" id="${containerId}">
                    <div class="goal-card-header" onclick="toggleAccordion('${containerId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.1rem;">📌</span>
                                <span style="font-weight: 600; font-size: 1.05rem;">Proje Görevleri</span>
                            </div>
                        </div>
                        <span class="accordion-caret" style="color: var(--text-muted);">▼</span>
                    </div>
                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content">
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${renderTasks(projectTasks)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    function renderSubGoals(subGoals) {
        if (subGoals.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">Bu hedefe ait herhangi bir alt hedef bulunmuyor.</div>`;
        }

        return subGoals.map(sg => {
            const sgProgress = Math.round(sg.progress);
            const sgId = `subgoal-${sg.id}`;
            const isExpanded = expandedAccordions.has(sgId);
            return `
                <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${sgId}" style="border-color: var(--border-color); background-color: var(--bg-base);">
                    <div class="goal-card-header" style="background-color: rgba(40, 40, 40, 0.2);" onclick="toggleAccordion('${sgId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 0.95rem;">⚡</span>
                                    <span style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(sg.title)}</span>
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 12px;">
                                    <span>📅 ${new Date(sg.createdAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                                    ${sg.changedAt ? `<span>🔄 ${new Date(sg.changedAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>` : ''}
                                </div>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 100px; height: 6px;">
                                    <div class="progress-bar-fill ${sgProgress === 100 ? 'progress-bar-fill-success' : ''}" style="width: ${sgProgress}%"></div>
                                </div>
                                <span style="font-size: 0.8rem; font-weight: 600; color: ${sgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${sgProgress}</span>
                            </div>
                        </div>
                        <span class="accordion-caret" style="color: var(--text-muted); font-size: 0.8rem;">▼</span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content subgoal-content" style="background-color: var(--bg-surface-elevated);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; flex-wrap: wrap; gap: 16px;">
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem; line-height: 1.5; flex: 1;">${escapeHtml(sg.description)}</p>
                                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                    <button class="tm-btn tm-btn-success" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openTaskModal(${sg.id})">+ Görev Ekle</button>
                                    <button class="tm-btn tm-btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openSubGoalModal(${sg.mainGoalId}, ${JSON.stringify(sg).replace(/"/g, '&quot;')})">Düzenle</button>
                                    <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openDeleteModal('subgoal', ${sg.id})">Sil</button>
                                    ${sg.tasks.length === 0 ? `
                                        <button class="tm-btn tm-btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; border-color: ${sg.isCompleted ? 'var(--color-success)' : 'var(--border-color)'}" onclick="toggleSubGoalCompletion(${sg.id})">
                                            ${sg.isCompleted ? '✓ Tamamlandı' : '⏳ Tamamla'}
                                        </button>
                                    ` : ''}
                                </div>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${renderTasks(sg.tasks)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderTasks(tasks) {
        if (tasks.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 0.8rem; padding: 5px 0;">Henüz görev tanımlanmamış.</div>`;
        }

        return tasks.map(t => {
            return `
                <div class="task-item-row ${t.isCompleted ? 'completed' : ''}" id="task-row-${t.id}">
                    <div class="task-item-left">
                        <div class="custom-checkbox ${t.isCompleted ? 'checked' : ''}" onclick="toggleTaskCompletion(${t.id})"></div>
                        <div style="display: flex; flex-direction: column;">
                            <span class="task-title" style="font-size: 0.9rem;">${escapeHtml(t.title)}</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(t.description)}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
                                📅 Oluşturulma: ${new Date(t.createdAt).toLocaleString("tr-TR")} 
                                ${t.completedAt ? `&nbsp;|&nbsp; ✅ Tamamlanma: ${new Date(t.completedAt).toLocaleString("tr-TR")}` : ''}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="tm-btn-icon-only" style="padding: 4px;" title="Düzenle" onclick="openTaskModal(null, ${JSON.stringify(t).replace(/"/g, '&quot;')})">✏️</button>
                        <button class="tm-btn-icon-only" style="padding: 4px;" title="Sil" onclick="openDeleteModal('task', ${t.id})">🗑️</button>
                    </div>
                </div>
            `;
        }).join("");
    }

    function toggleAccordion(id) {
        const card = document.getElementById(id);
        if (card) {
            card.classList.toggle("expanded");
            if (card.classList.contains("expanded")) {
                expandedAccordions.add(id);
            } else {
                expandedAccordions.delete(id);
            }
        }
    }

    async function toggleTaskCompletion(taskId) {
        try {
            const res = await fetch(`/api/dashboard/task/${taskId}/toggle`, { method: 'POST' });
            if (!res.ok) throw new Error();

            showToast("Görev durumu güncellendi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Görev durumu değiştirilirken hata oluştu.", "danger");
        }
    }

    async function toggleSubGoalCompletion(subGoalId) {
        try {
            const res = await fetch(`/api/dashboard/subgoal/${subGoalId}/toggle`, { method: 'POST' });
            if (!res.ok) throw new Error();

            showToast("Alt hedef durumu güncellendi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Alt hedef durumu değiştirilirken hata oluştu.", "danger");
        }
    }

    async function toggleMainGoalCompletion(mainGoalId) {
        try {
            const res = await fetch(`/api/dashboard/maingoal/${mainGoalId}/toggle`, { method: 'POST' });
            if (!res.ok) throw new Error();

            showToast("Ana hedef durumu güncellendi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Ana hedef durumu değiştirilirken hata oluştu.", "danger");
        }
    }


    function openProjectModal(project = null) {
        const form = document.getElementById("project-form");
        form.reset();

        if (project) {
            document.getElementById("project-modal-title").innerText = "Proje Düzenle";
            document.getElementById("project-modal-id").value = project.id;
            document.getElementById("project-title").value = project.title;
            document.getElementById("project-desc").value = project.description;
        } else {
            document.getElementById("project-modal-title").innerText = "Yeni Proje Ekle";
            document.getElementById("project-modal-id").value = "";
        }
        openModal("project-modal");
    }

    async function handleProjectSubmit(e) {
        e.preventDefault();

        // BUTONU KİLİTLE (Çift Tıklamayı Engelle)
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Kaydediliyor...";

        const id = document.getElementById("project-modal-id").value;
        const title = document.getElementById("project-title").value.trim();
        const description = document.getElementById("project-desc").value.trim();

        const payload = { title, description };
        if (!id && activeTeamId) {
            payload.teamGroupId = activeTeamId;
        }
        
        const url = id ? `/api/dashboard/project/${id}` : "/api/dashboard/project";
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            closeModal("project-modal");
            showToast("Proje başarıyla kaydedildi.");

            if (id) {
                await triggerGlobalRefresh();
            } else {
                const data = await res.json();
                if (activeTeamId) {
                    await triggerGlobalRefresh();
                    loadTeamWorkspace(activeTeamId, document.getElementById("breadcrumb-project").innerText);
                } else {
                    await loadProjectWorkspace(data.id);
                    await triggerGlobalRefresh();
                }
            }
        } catch (err) {
            showToast("Proje kaydedilirken hata oluştu.", "danger");
        } finally {
            // İŞLEM BİTİNCE BUTONU GERİ AÇ
            submitBtn.disabled = false;
            submitBtn.innerText = "Kaydet";
        }
    }

    function openMainGoalModal(projectId, mainGoal = null) {
        const form = document.getElementById("maingoal-form");
        form.reset();

        document.getElementById("maingoal-project-id").value = projectId;

        if (mainGoal) {
            document.getElementById("maingoal-modal-title").innerText = "Ana Hedefi Düzenle";
            document.getElementById("maingoal-modal-id").value = mainGoal.id;
            document.getElementById("maingoal-title").value = mainGoal.title;
            document.getElementById("maingoal-desc").value = mainGoal.description;
            document.getElementById("maingoal-completed").checked = mainGoal.isCompleted;
            document.getElementById("maingoal-completed").parentElement.style.display = "flex";
        } else {
            document.getElementById("maingoal-modal-title").innerText = "Yeni Ana Hedef Ekle";
            document.getElementById("maingoal-modal-id").value = "";
            document.getElementById("maingoal-completed").checked = false;
            document.getElementById("maingoal-completed").parentElement.style.display = "none";
        }
        openModal("maingoal-modal");
    }

    async function handleMainGoalSubmit(e) {
        e.preventDefault();
        const id = document.getElementById("maingoal-modal-id").value;
        const projectId = parseInt(document.getElementById("maingoal-project-id").value);
        const title = document.getElementById("maingoal-title").value.trim();
        const description = document.getElementById("maingoal-desc").value.trim();
        const isCompleted = document.getElementById("maingoal-completed").checked;

        const payload = { projectId, title, description, isCompleted };
        const url = id ? `/api/dashboard/maingoal/${id}` : "/api/dashboard/maingoal";
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            closeModal("maingoal-modal");
            showToast("Ana hedef başarıyla kaydedildi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Ana hedef kaydedilirken hata oluştu.", "danger");
        }
    }

    function openSubGoalModal(mainGoalId, subGoal = null, projectId = null) {
        const form = document.getElementById("subgoal-form");
        form.reset();

        document.getElementById("subgoal-maingoal-id").value = mainGoalId || "";
        document.getElementById("subgoal-project-id").value = projectId || "";

        if (subGoal) {
            document.getElementById("subgoal-modal-title").innerText = "Alt Hedefi Düzenle";
            document.getElementById("subgoal-modal-id").value = subGoal.id;
            document.getElementById("subgoal-title").value = subGoal.title;
            document.getElementById("subgoal-desc").value = subGoal.description;
            document.getElementById("subgoal-completed").checked = subGoal.isCompleted;
            document.getElementById("subgoal-completed").parentElement.style.display = "flex";
        } else {
            document.getElementById("subgoal-modal-title").innerText = "Yeni Alt Hedef Ekle";
            document.getElementById("subgoal-modal-id").value = "";
            document.getElementById("subgoal-completed").checked = false;
            document.getElementById("subgoal-completed").parentElement.style.display = "none";
        }
        openModal("subgoal-modal");
    }

    async function handleSubGoalSubmit(e) {
        e.preventDefault();
        const id = document.getElementById("subgoal-modal-id").value;
        const mainGoalIdVal = document.getElementById("subgoal-maingoal-id").value;
        const projectIdVal = document.getElementById("subgoal-project-id").value;
        const mainGoalId = mainGoalIdVal ? parseInt(mainGoalIdVal) : null;
        const projectId = projectIdVal ? parseInt(projectIdVal) : null;
        const title = document.getElementById("subgoal-title").value.trim();
        const description = document.getElementById("subgoal-desc").value.trim();
        const isCompleted = document.getElementById("subgoal-completed").checked;

        const payload = { mainGoalId, projectId, title, description, isCompleted };
        const url = id ? `/api/dashboard/subgoal/${id}` : "/api/dashboard/subgoal";
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            closeModal("subgoal-modal");
            showToast("Alt hedef başarıyla kaydedildi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Alt hedef kaydedilirken hata oluştu.", "danger");
        }
    }

    function openTaskModal(subGoalId, task = null, projectId = null, mainGoalId = null) {
        const form = document.getElementById("task-form");
        form.reset();

        document.getElementById("task-subgoal-id").value = subGoalId || "";
        document.getElementById("task-maingoal-id").value = mainGoalId || "";
        document.getElementById("task-project-id").value = projectId || "";

        if (task) {
            document.getElementById("task-modal-title").innerText = "Görevi Düzenle";
            document.getElementById("task-modal-id").value = task.id;
            document.getElementById("task-title").value = task.title;
            document.getElementById("task-desc").value = task.description;
            document.getElementById("task-completed").checked = task.isCompleted;
            document.getElementById("task-completed").parentElement.style.display = "flex";

            document.getElementById("task-subgoal-id").value = task.subGoalId || "";
            document.getElementById("task-maingoal-id").value = task.mainGoalId || "";
            document.getElementById("task-project-id").value = task.projectId || "";
        } else {
            document.getElementById("task-modal-title").innerText = "Yeni Görev Ekle";
            document.getElementById("task-modal-id").value = "";
            document.getElementById("task-completed").checked = false;
            document.getElementById("task-completed").parentElement.style.display = "none";
        }
        openModal("task-modal");
    }

    async function handleTaskSubmit(e) {
        e.preventDefault();
        const id = document.getElementById("task-modal-id").value;
        const subGoalVal = document.getElementById("task-subgoal-id").value;
        const mainGoalVal = document.getElementById("task-maingoal-id").value;
        const projectVal = document.getElementById("task-project-id").value;

        const subGoalId = subGoalVal ? parseInt(subGoalVal) : null;
        const mainGoalId = mainGoalVal ? parseInt(mainGoalVal) : null;
        const projectId = projectVal ? parseInt(projectVal) : null;

        const title = document.getElementById("task-title").value.trim();
        const description = document.getElementById("task-desc").value.trim();
        const isCompleted = document.getElementById("task-completed").checked;

        const payload = { subGoalId, mainGoalId, projectId, title, description, isCompleted };
        const url = id ? `/api/dashboard/task/${id}` : "/api/dashboard/task";
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            closeModal("task-modal");
            showToast("Görev başarıyla kaydedildi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Görev kaydedilirken hata oluştu.", "danger");
        }
    }

    function openDeleteModal(type, id, event = null) {
        if (event) {
            event.stopPropagation(); // Stop sidebar click navigation
        }

        const confirmBtn = document.getElementById("delete-confirm-btn");
        let itemLabel = "ögeyi";
        if (type === 'project') itemLabel = "projeyi";
        else if (type === 'maingoal') itemLabel = "ana hedefi";
        else if (type === 'subgoal') itemLabel = "alt hedefi";
        else if (type === 'task') itemLabel = "görevi";

        document.getElementById("delete-message").innerText = `Bu ${itemLabel} ve altındaki tüm alt ögeleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`;

        confirmBtn.onclick = async () => {
            try {
                const res = await fetch(`/api/dashboard/${type}/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error();

                closeModal("delete-modal");
                showToast("Silme işlemi başarıyla tamamlandı.");

                if (type === 'project' && activeProjectId === id) {
                    showDashboardHome();
                }
                await triggerGlobalRefresh();
            } catch (err) {
                showToast("Silme işlemi gerçekleştirilirken hata oluştu.", "danger");
            }
        };

        openModal("delete-modal");
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function truncateString(str, num) {
        if (!str) return "";
        if (str.length <= num) return str;
        return str.slice(0, num) + "...";
    }

    // --- ÇÖP KUTUSU JS LOGİC'LERİ ---

    async function showDeletedView() {
        activeProjectId = null;
        activeTeamId = null;

        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = "Çöp Kutusu";
        document.querySelector(".breadcrumb-separator").style.display = "inline";

        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "block";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";

        await loadDeletedProjects();
    }

    async function loadDeletedProjects() {
        try {
            const res = await fetch("/api/dashboard/deleted");
            if (!res.ok) throw new Error();
            const projects = await res.json();

            const grid = document.getElementById("deleted-projects-grid");
            const toolbar = document.getElementById("trash-bulk-toolbar");

            const master = document.getElementById("select-all-deleted-projects");
            if (master) master.checked = false;

            if (projects.length === 0) {
                if (toolbar) toolbar.style.display = "none";
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                        <p style="color: var(--text-secondary); margin-bottom: 0;">Silinmiş bir proje bulunmuyor.</p>
                    </div>
                `;
                return;
            }

            if (toolbar) toolbar.style.display = "flex";

            grid.innerHTML = projects.map(p => {
                const deletedDate = new Date(p.deletedAt).toLocaleDateString("tr-TR");
                return `
                    <div class="tm-card" style="cursor: default; position: relative;">
                        <div style="position: absolute; top: 16px; right: 16px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" class="project-trash-checkbox" data-project-id="${p.id}" onchange="updateTrashSelection()" style="width: 18px; height: 18px; cursor: pointer;" />
                        </div>
                        <div class="tm-card-title" style="padding-right: 32px;">${escapeHtml(p.title)}</div>
                        <div class="tm-card-desc">${escapeHtml(p.description)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 16px;">
                            Silinme Tarihi: ${deletedDate}
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 20px;">
                            <button class="tm-btn tm-btn-success" style="flex: 1; padding: 6px 12px; font-size: 0.85rem;" onclick="restoreProject(${p.id})">Geri Yükle</button>
                            <button class="tm-btn tm-btn-danger" style="flex: 1; padding: 6px 12px; font-size: 0.85rem;" onclick="permanentlyDeleteProject(${p.id})">Kalıcı Sil</button>
                        </div>
                    </div>
                `;
            }).join("");

            updateTrashSelection();
        } catch (err) {
            console.error(err);
            showToast("Silinmiş projeler yüklenirken hata oluştu.", "danger");
        }
    }

    function toggleSelectAllDeletedProjects(masterCheckbox) {
        const checkboxes = document.querySelectorAll(".project-trash-checkbox");
        checkboxes.forEach(cb => {
            cb.checked = masterCheckbox.checked;
        });
        updateTrashSelection();
    }

    function updateTrashSelection() {
        const checkboxes = document.querySelectorAll(".project-trash-checkbox");
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        const totalCount = checkboxes.length;

        const master = document.getElementById("select-all-deleted-projects");
        if (master) {
            master.checked = (checkedCount === totalCount && totalCount > 0);
            master.indeterminate = (checkedCount > 0 && checkedCount < totalCount);
        }

        const selectedCountText = document.getElementById("selected-projects-count");
        const bulkRestoreBtn = document.getElementById("btn-bulk-restore");
        const bulkDeleteBtn = document.getElementById("btn-bulk-delete");
        const allRestoreBtn = document.getElementById("btn-all-restore");
        const allDeleteBtn = document.getElementById("btn-all-delete");

        if (selectedCountText) {
            if (checkedCount > 0) {
                selectedCountText.innerText = `${checkedCount} proje seçildi`;
                selectedCountText.style.display = "inline";
                if (bulkRestoreBtn) bulkRestoreBtn.style.display = "inline-block";
                if (bulkDeleteBtn) bulkDeleteBtn.style.display = "inline-block";
                if (allRestoreBtn) allRestoreBtn.style.display = "none";
                if (allDeleteBtn) allDeleteBtn.style.display = "none";
            } else {
                selectedCountText.style.display = "none";
                if (bulkRestoreBtn) bulkRestoreBtn.style.display = "none";
                if (bulkDeleteBtn) bulkDeleteBtn.style.display = "none";
                if (allRestoreBtn) allRestoreBtn.style.display = "inline-block";
                if (allDeleteBtn) allDeleteBtn.style.display = "inline-block";
            }
        }
    }

    function getSelectedTrashProjectIds() {
        const checkboxes = document.querySelectorAll(".project-trash-checkbox");
        return Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.getAttribute("data-project-id")));
    }

    async function bulkRestoreSelectedProjects() {
        const ids = getSelectedTrashProjectIds();
        if (ids.length === 0) return;

        try {
            const res = await fetch("/api/dashboard/project/bulk-restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ids)
            });
            if (!res.ok) throw new Error();

            showToast("Seçilen projeler başarıyla geri yüklendi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler geri yüklenirken hata oluştu.", "danger");
        }
    }

    async function bulkDeleteSelectedProjects() {
        const ids = getSelectedTrashProjectIds();
        if (ids.length === 0) return;

        if (!confirm(`${ids.length} projeyi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) {
            return;
        }

        try {
            const res = await fetch("/api/dashboard/project/bulk-permanent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ids)
            });
            if (!res.ok) throw new Error();

            showToast("Seçilen projeler kalıcı olarak silindi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler kalıcı silinirken hata oluştu.", "danger");
        }
    }

    async function restoreAllDeletedProjects() {
        if (!confirm("Tüm silinmiş projeleri geri yüklemek istediğinizden emin misiniz?")) {
            return;
        }

        try {
            const res = await fetch("/api/dashboard/project/restore-all", { method: "POST" });
            if (!res.ok) throw new Error();

            showToast("Tüm projeler başarıyla geri yüklendi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler geri yüklenirken hata oluştu.", "danger");
        }
    }

    async function deleteAllDeletedProjects() {
        if (!confirm("Tüm silinmiş projeleri kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            return;
        }

        try {
            const res = await fetch("/api/dashboard/project/permanent-all", { method: "POST" });
            if (!res.ok) throw new Error();

            showToast("Tüm projeler kalıcı olarak silindi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler kalıcı silinirken hata oluştu.", "danger");
        }
    }

    async function restoreProject(id) {
        try {
            const res = await fetch(`/api/dashboard/project/${id}/restore`, { method: 'POST' });
            if (!res.ok) throw new Error();

            showToast("Proje başarıyla geri yüklendi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Proje geri yüklenirken hata oluştu.", "danger");
        }
    }

    async function permanentlyDeleteProject(id) {
        if (!confirm("Bu projeyi ve ilişkili tüm hedefleri kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            return;
        }

        try {
            const res = await fetch(`/api/dashboard/project/${id}/permanent`, { method: 'DELETE' });
            if (!res.ok) throw new Error();

            showToast("Proje kalıcı olarak silindi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Silme işlemi gerçekleştirilirken hata oluştu.", "danger");
        }
    }

    let currentWorkspaceTab = 'active';

    function switchWorkspaceTab(tab) {
        currentWorkspaceTab = tab;
        const activeTabBtn = document.getElementById('tab-active-goals');
        const deletedTabBtn = document.getElementById('tab-deleted-goals');
        const activeContent = document.getElementById('active-tab-content');
        const deletedContent = document.getElementById('deleted-tab-content');

        if (tab === 'active') {
            activeTabBtn.style.color = 'var(--text-primary)';
            activeTabBtn.style.borderBottomColor = 'var(--color-secondary)';
            activeTabBtn.style.fontWeight = '500'; 

            deletedTabBtn.style.color = 'var(--text-secondary)';
            deletedTabBtn.style.borderBottomColor = 'transparent';
            deletedTabBtn.style.fontWeight = '500';

            activeContent.style.display = 'block';
            deletedContent.style.display = 'none';
        } else {
            deletedTabBtn.style.color = 'var(--text-primary)';
            deletedTabBtn.style.borderBottomColor = 'var(--color-primary)';
            deletedTabBtn.style.fontWeight = '500';

            activeTabBtn.style.color = 'var(--text-secondary)';
            activeTabBtn.style.borderBottomColor = 'transparent';
            activeTabBtn.style.fontWeight = '500';

            activeContent.style.display = 'none';
            deletedContent.style.display = 'block';
            loadDeletedProjectItems();
        }
    }

    async function loadDeletedProjectItems() {
        if (!activeProjectId) return;
        const container = document.getElementById("deleted-items-list");
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem; padding: 10px;">Yükleniyor...</div>`;

        try {
            const res = await fetch(`/api/dashboard/project/${activeProjectId}/deleted-items`);
            if (!res.ok) throw new Error();
            const data = await res.json();

            let html = "";
            const { mainGoals, subGoals, tasks } = data;

            if (mainGoals.length === 0 && subGoals.length === 0 && tasks.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                        <p style="color: var(--text-secondary); margin-bottom: 0;">Bu projede silinmiş bir hedef veya görev bulunmuyor.</p>
                    </div>
                `;
                return;
            }

            if (mainGoals.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 16px;">🎯 Silinen Ana Hedefler</h3>`;
                html += renderDeletedMainGoals(mainGoals);
            }

            if (subGoals.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 24px;">⚡ Silinen Alt Hedefler</h3>`;
                html += renderDeletedSubGoals(subGoals, false);
            }

            if (tasks.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 24px;">📋 Silinen Görevler</h3>`;
                html += renderDeletedTasks(tasks, false);
            }

            container.innerHTML = html;

        } catch (err) {
            console.error(err);
            container.innerHTML = `<div style="color: var(--color-danger); font-size: 0.9rem; padding: 10px;">Silinen ögeler yüklenirken hata oluştu.</div>`;
        }
    }

    function renderDeletedMainGoals(mainGoals) {
        if (!mainGoals || mainGoals.length === 0) return "";
        return mainGoals.map(mg => {
            const mgProgress = Math.round(mg.progress);
            const mgId = `deleted-maingoal-${mg.id}`;
            const isExpanded = expandedAccordions.has(mgId);
            return `
                <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${mgId}">
                    <div class="goal-card-header" onclick="toggleAccordion('${mgId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.1rem;">🎯</span>
                                <span style="font-weight: 600; font-size: 1.05rem;">${escapeHtml(mg.title)}</span>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 120px; height: 6px;">
                                    <div class="progress-bar-fill ${mgProgress === 100 ? 'progress-bar-fill-success' : ''}" style="width: ${mgProgress}%"></div>
                                </div>
                                <span style="font-size: 0.85rem; font-weight: 600; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${mgProgress}</span>
                            </div>
                        </div>
                        
                        <span class="accordion-caret" style="color: var(--text-muted);">▼</span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content">
                            <p style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.95rem; line-height: 1.5;">${escapeHtml(mg.description)}</p>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap;">
                                <span>📅 Oluşturulma: ${new Date(mg.createdAt).toLocaleString("tr-TR")}</span>
                                ${mg.changedAt ? `<span>🔄 Değişiklik: ${new Date(mg.changedAt).toLocaleString("tr-TR")}</span>` : ''}
                                <span style="color: var(--color-danger);">🗑️ Silinme: ${new Date(mg.deletedAt).toLocaleString("tr-TR")}</span>
                            </div>
                            
                            <div style="display: flex; gap: 10px; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
                                <button class="tm-btn tm-btn-success" style="padding: 6px 12px; font-size: 0.8rem;" onclick="restoreProjectItem('maingoal', ${mg.id})">Geri Yükle</button>
                                <button class="tm-btn tm-btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="permanentlyDeleteProjectItem('maingoal', ${mg.id})">Kalıcı Sil</button>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 16px;">
                                ${mg.tasks && mg.tasks.length > 0 ? `
                                    <div class="tm-card" style="border: 1px solid var(--border-color); padding: 12px; background-color: var(--bg-surface-elevated);">
                                        <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">📋 Ana Hedef Görevleri</h4>
                                        <div style="display: flex; flex-direction: column; gap: 8px;">
                                            ${renderDeletedTasks(mg.tasks, true)}
                                        </div>
                                    </div>
                                ` : ''}
                                ${renderDeletedSubGoals(mg.subGoals, true)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderDeletedSubGoals(subGoals, isParentDeleted) {
        if (!subGoals || subGoals.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">Bu hedefe ait herhangi bir alt hedef bulunmuyor.</div>`;
        }

        return subGoals.map(sg => {
            const sgProgress = Math.round(sg.progress);
            const sgId = `deleted-subgoal-${sg.id}`;
            const isExpanded = expandedAccordions.has(sgId);
            return `
                <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${sgId}" style="border-color: var(--border-color); background-color: var(--bg-base);">
                    <div class="goal-card-header" style="background-color: rgba(40, 40, 40, 0.2);" onclick="toggleAccordion('${sgId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 0.95rem;">⚡</span>
                                <span style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(sg.title)}</span>
                                ${isParentDeleted ? '<span style="font-size: 0.75rem; color: var(--color-danger);">(Üst Hedefle Silindi)</span>' : ''}
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 100px; height: 6px;">
                                    <div class="progress-bar-fill ${sgProgress === 100 ? 'progress-bar-fill-success' : ''}" style="width: ${sgProgress}%"></div>
                                </div>
                                <span style="font-size: 0.8rem; font-weight: 600; color: ${sgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${sgProgress}</span>
                            </div>
                        </div>
                        <span class="accordion-caret" style="color: var(--text-muted); font-size: 0.8rem;">▼</span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content subgoal-content" style="background-color: var(--bg-surface-elevated);">
                            <p style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem; line-height: 1.5;">${escapeHtml(sg.description)}</p>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px; display: flex; gap: 16px; flex-wrap: wrap;">
                                <span>📅 Oluşturulma: ${new Date(sg.createdAt).toLocaleString("tr-TR")}</span>
                                ${sg.changedAt ? `<span>🔄 Değişiklik: ${new Date(sg.changedAt).toLocaleString("tr-TR")}</span>` : ''}
                                ${!isParentDeleted && sg.deletedAt ? `<span style="color: var(--color-danger);">🗑️ Silinme: ${new Date(sg.deletedAt).toLocaleString("tr-TR")}</span>` : ''}
                            </div>

                            ${!isParentDeleted ? `
                            <div style="display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                                <button class="tm-btn tm-btn-success" style="padding: 4px 10px; font-size: 0.75rem;" onclick="restoreProjectItem('subgoal', ${sg.id})">Geri Yükle</button>
                                <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="permanentlyDeleteProjectItem('subgoal', ${sg.id})">Kalıcı Sil</button>
                            </div>
                            ` : ''}

                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${renderDeletedTasks(sg.tasks, isParentDeleted || sg.isDeleted)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderDeletedTasks(tasks, isParentDeleted) {
        if (!tasks || tasks.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 0.8rem; padding: 5px 0;">Henüz silinmiş görev bulunmuyor.</div>`;
        }

        return tasks.map(t => {
            return `
                <div class="task-item-row" id="deleted-task-row-${t.id}">
                    <div class="task-item-left">
                        <span style="font-size: 1.1rem; margin-right: 8px;">📋</span>
                        <div style="display: flex; flex-direction: column;">
                            <span class="task-title" style="font-size: 0.9rem;">
                                ${escapeHtml(t.title)}
                                ${t.isCompleted ? '<span style="color: var(--color-success); font-size: 0.8rem;"> (Tamamlandı)</span>' : ''}
                                ${isParentDeleted ? '<span style="font-size: 0.75rem; color: var(--color-danger);">(Üst Hedefle Silindi)</span>' : ''}
                            </span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(t.description)}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap;">
                                <span>📅 Oluşturulma: ${new Date(t.createdAt).toLocaleString("tr-TR")}</span>
                                ${t.completedAt ? `<span>✅ Tamamlanma: ${new Date(t.completedAt).toLocaleString("tr-TR")}</span>` : ''}
                                ${!isParentDeleted && t.deletedAt ? `<span style="color: var(--color-danger);">🗑️ Silinme: ${new Date(t.deletedAt).toLocaleString("tr-TR")}</span>` : ''}
                            </span>
                        </div>
                    </div>
                    ${!isParentDeleted ? `
                    <div style="display: flex; gap: 6px;">
                        <button class="tm-btn tm-btn-success" style="padding: 4px 10px; font-size: 0.75rem;" onclick="restoreProjectItem('task', ${t.id})">Geri Yükle</button>
                        <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="permanentlyDeleteProjectItem('task', ${t.id})">Kalıcı Sil</button>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join("");
    }

    async function restoreProjectItem(type, id) {
        try {
            const res = await fetch(`/api/dashboard/${type}/${id}/restore`, { method: 'POST' });
            if (!res.ok) throw new Error();

            showToast("Öge başarıyla geri yüklendi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Geri yükleme sırasında hata oluştu.", "danger");
        }
    }

    async function permanentlyDeleteProjectItem(type, id) {
        if (!confirm("Bu ögeyi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            return;
        }

        try {
            const res = await fetch(`/api/dashboard/${type}/${id}/permanent`, { method: 'DELETE' });
            if (!res.ok) throw new Error();

            showToast("Öge kalıcı olarak silindi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Kalıcı silme sırasında hata oluştu.", "danger");
        }
    }

    // --- SON AKTİVİTELER JS LOGİC'LERİ ---

    async function showActivitiesView() {
        activeProjectId = null;
        activeTeamId = null;

        // Üst Bar (Breadcrumb) Ayarları
        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = "Son Aktiviteler";
        document.querySelector(".breadcrumb-separator").style.display = "inline";

        // Tüm ekranları gizle, sadece Aktiviteler ekranını göster
        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "block";
        document.getElementById("teams-dashboard-view").style.display = "none";

        // Verileri çekmeye başla
        await loadFullActivitiesView();
    }

    async function loadFullActivitiesView() {
        const container = document.getElementById("activities-content-container");
        container.innerHTML = `<div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md); color: var(--text-muted);">Veriler yükleniyor...</div>`;

        try {
            const res = await fetch("/api/dashboard/activities");
            if (!res.ok) throw new Error();

            const data = await res.json();

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                        <p style="color: var(--text-secondary); margin-bottom: 0;">Henüz kaydedilmiş bir aktivite bulunmuyor.</p>
                    </div>
                `;
                return;
            }

            let html = "";
            data.forEach(projectLog => {
                const cardId = `full-activity-proj-${projectLog.projectId}`;

                html += `
                    <div class="tm-card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color);">
                        <!-- Proje Başlığı (Akordiyon Tetikleyici) -->
                        <div onclick="toggleFullActivityCard('${cardId}')" style="cursor: pointer; padding: 16px 20px; background-color: var(--bg-surface-elevated); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 1.2rem;">📂</span>
                                <span style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(projectLog.projectTitle)}</span>
                                <span style="font-size: 0.8rem; padding: 4px 8px; background-color: rgba(255,255,255,0.1); border-radius: 12px; color: var(--text-muted);">${projectLog.activities.length} İşlem</span>
                            </div>
                            <span id="arrow-${cardId}" style="transition: transform 0.3s ease; color: var(--text-secondary); font-size: 0.9rem;">▼</span>
                        </div>
                        
                        <!-- Log İçerikleri -->
                        <div id="${cardId}" style="display: none; flex-direction: column;">
                            ${projectLog.activities.map((log, index) => {
                    let icon = "📝";
                    let iconBg = "rgba(100, 116, 139, 0.2)"; // Gri

                    if(log.action === "Oluşturuldu") { icon = "✨"; iconBg = "rgba(16, 185, 129, 0.2)"; } // Yeşil
                    if(log.action === "Silindi" || log.action === "Kalıcı Olarak Silindi") { icon = "🗑️"; iconBg = "rgba(239, 68, 68, 0.2)"; } // Kırmızı
                    if(log.action === "Güncellendi") { icon = "✏️"; iconBg = "rgba(59, 130, 246, 0.2)"; } // Mavi

                    const timeString = new Date(log.date).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
                    const dateString = new Date(log.date).toLocaleDateString("tr-TR");

                    // Son elemanın alt çizgisini kaldırmak için
                    const borderStyle = index === projectLog.activities.length - 1 ? "" : "border-bottom: 1px solid var(--border-color);";

                    return `
                                    <div style="padding: 16px 20px; display: flex; gap: 16px; align-items: flex-start; ${borderStyle} background-color: var(--bg-base); transition: background-color 0.2s;">
                                        <div style="width: 36px; height: 36px; border-radius: 50%; background-color: ${iconBg}; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
                                            ${icon}
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                                <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">
                                                    ${log.entity === 'Project' ? escapeHtml(projectLog.projectTitle) : (log.entity === 'MainGoal' ? 'Ana Hedef' : (log.entity === 'SubGoal' ? 'Alt Hedef' : 'Görev'))} ${escapeHtml(log.action)}
                                                </span>
                                                <span style="font-size: 0.8rem; color: var(--text-muted);">${dateString} ${timeString}</span>
                                            </div>
                                            <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">
                                                ${escapeHtml(log.details)}
                                            </div>
                                        </div>
                                    </div>
                                `;
                }).join('')}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;

        } catch (err) {
            console.error(err);
            container.innerHTML = `<div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md); color: var(--color-danger);">Aktiviteler yüklenirken bir hata oluştu.</div>`;
        }
    }

    function toggleFullActivityCard(cardId) {
        const contentDiv = document.getElementById(cardId);
        const arrow = document.getElementById(`arrow-${cardId}`);

        if (contentDiv.style.display === "none") {
            contentDiv.style.display = "flex";
            arrow.style.transform = "rotate(180deg)";
        } else {
            contentDiv.style.display = "none";
            arrow.style.transform = "rotate(0deg)";
        }
    }

