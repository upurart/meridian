    let activeProjectId = null;
    let activeProjectHasManageAccess = false;
    let activeProjectIsObserver = false;
    let activeTeamId = null;
    let currentProjectViewMode = 'grid';

    window.setProjectViewMode = function(mode) {
        currentProjectViewMode = mode;
        ['grid', 'list', 'compact'].forEach(m => {
            const btn = document.getElementById(`btn-view-${m}`);
            if (btn) btn.classList.remove("active");
        });
        const activeBtn = document.getElementById(`btn-view-${mode}`);
        if (activeBtn) activeBtn.classList.add("active");
        applyGridFilters();
    };
    let treeData = [];
    let currentTeamsData = [];

    const expandedNodes = new Set();
    const searchExpandedNodes = new Set();
    const expandedAccordions = new Set();

    function updateRailActive(btnId) {
        document.querySelectorAll('.activity-bar-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) activeBtn.classList.add('active');
    }

    function collapseSidebar() {
        const sidebar = document.getElementById('sidebar');
        const openBtn = document.getElementById('open-sidebar-btn');
        if (sidebar && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            const activityBar = document.getElementById('activity-bar');
            if (activityBar) activityBar.classList.add('sidebar-closed');
            if (openBtn) openBtn.style.display = 'block';
        }
    }

    function toggleNodeCollapse(nodeId, event, isSearch = false) {
        if (event) {
            event.stopPropagation();
        }
        if (isSearch) {
            if (searchExpandedNodes.has(nodeId)) {
                searchExpandedNodes.delete(nodeId);
            } else {
                searchExpandedNodes.add(nodeId);
            }
            applySidebarFilters();
        } else {
            if (expandedNodes.has(nodeId)) {
                expandedNodes.delete(nodeId);
            } else {
                expandedNodes.add(nodeId);
            }
            renderExplorerTree();
        }
    }

    let sidebarSearchQuery = "";
    let sidebarFilterStatus = "all";
    let sidebarSortStatus = "none";

    let gridProjectsData = [];
    let gridSearchQuery = "";
    let gridFilterStatus = "all";
    let gridSortStatus = "none";

    function getSmoothProgressColor(progress) {
        if (progress === 0) return "var(--text-muted)";
        // --color-danger: #ef4444 -> rgb(239, 68, 68)
        // --color-progress: #ffa33a -> rgb(255, 163, 58)
        // --color-success: #10b981 -> rgb(16, 185, 129)
        let r, g, b;
        
        if (progress <= 50) {
            const p = progress / 50;
            r = Math.round(239 + (255 - 239) * p);
            g = Math.round(68 + (163 - 68) * p);
            b = Math.round(68 + (58 - 68) * p);
        } else {
            const p = (progress - 50) / 50;
            r = Math.round(255 + (16 - 255) * p);
            g = Math.round(163 + (185 - 163) * p);
            b = Math.round(58 + (129 - 58) * p);
        }
        
        return `rgb(${r}, ${g}, ${b})`;
    }

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

        document.getElementById('sidebar-sort')?.addEventListener('change', (e) => {
            sidebarSortStatus = e.target.value;
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

        document.getElementById('grid-sort')?.addEventListener('change', (e) => {
            gridSortStatus = e.target.value;
            applyGridFilters();
        });

        const cardApproaching = document.getElementById('stat-card-approaching');
        cardApproaching.style.cursor = 'pointer';
        cardApproaching.addEventListener('click', () => {
            const filterEl = document.getElementById('grid-filter-status');
            filterEl.value = 'approaching';
            gridFilterStatus = 'approaching';
            applyGridFilters();
        });

        const cardOverdue = document.getElementById('stat-card-overdue');
        cardOverdue.style.cursor = 'pointer';
        cardOverdue.addEventListener('click', () => {
            const filterEl = document.getElementById('grid-filter-status');
            filterEl.value = 'overdue';
            gridFilterStatus = 'overdue';
            applyGridFilters();
        });

        document.getElementById('btn-clear-filters').addEventListener('click', () => {
            document.getElementById('grid-search').value = "";
            gridSearchQuery = "";
            
            document.getElementById('grid-filter-status').value = "all";
            gridFilterStatus = "all";
            
            const gridSort = document.getElementById('grid-sort');
            if (gridSort) {
                gridSort.value = "none";
                gridSortStatus = "none";
            }
            
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
            renderExplorerTree();
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
                            <span>${escapeHtml(t.name)}</span>
                        </div>
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    }

    function renderExplorerTree() {
        if (!treeData) return;
        const personalProjects = treeData.filter(p => !p.teamGroupId);
        renderSidebarTree(personalProjects, "sidebar-tree-container", false);
    }

    function renderSidebarTree(data, targetElId = "sidebar-tree-container", isSearch = false) {
        const targetEl = document.getElementById(targetElId);
        if (!targetEl) return;
        if (data.length === 0) {
            if (isSearch) {
                targetEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Kriterlere uygun sonuç bulunamadı.</div>`;
            } else {
                targetEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Henüz proje yok.</div>`;
            }
            return;
        }

        let html = '<ul class="tree-list" style="border-left: none; padding-left: 0;">';
        data.forEach(p => {
            const isWpActive = activeProjectId === p.id;
            const nodeId = `project-${p.id}`;
            const isCollapsed = isSearch ? !searchExpandedNodes.has(nodeId) : !expandedNodes.has(nodeId);
            const pMainGoals = p.mainGoals || [];
            const pSubGoals = p.subGoals || [];
            const pTasks = p.tasks || [];
            const hasChildren = pMainGoals.length > 0 || pSubGoals.length > 0 || pTasks.length > 0;
            const caret = hasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${nodeId}', event, ${isSearch})">${isCollapsed ? '<i class="bi bi-caret-right-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>'}</span>` : '<span class="tree-caret-spacer"></span>';

            html += `
                <li style="font-weight: 500;">
                    <div class="tree-node-row ${isWpActive ? 'active' : ''}" onclick="loadProjectWorkspace(${p.id})">
                        <div class="tree-node-title">
                            ${caret}
                            <i class="bi bi-folder2 text-primary" style="margin-right: 4px;"></i>
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
                        const isMgCollapsed = isSearch ? !searchExpandedNodes.has(mgNodeId) : !expandedNodes.has(mgNodeId);
                        const mgHasChildren = mgSubGoals.length > 0 || mgTasks.length > 0;
                        const mgCaret = mgHasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${mgNodeId}', event, ${isSearch})">${isMgCollapsed ? '<i class="bi bi-caret-right-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>'}</span>` : '<span class="tree-caret-spacer"></span>';

                        html += `
                            <li>
                                <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'maingoal-${mg.id}')">
                                    <div class="tree-node-title">
                                        ${mgCaret}
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
                                    const isSgCollapsed = isSearch ? !searchExpandedNodes.has(sgNodeId) : !expandedNodes.has(sgNodeId);
                                    const sgHasChildren = sgTasks.length > 0;
                                    const sgCaret = sgHasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${sgNodeId}', event, ${isSearch})">${isSgCollapsed ? '<i class="bi bi-caret-right-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>'}</span>` : '<span class="tree-caret-spacer"></span>';

                                    html += `
                                        <li>
                                            <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}', 'maingoal-${mg.id}')">
                                                <div class="tree-node-title">
                                                    ${sgCaret}
                                                    <span>${escapeHtml(sg.title)}</span>
                                                    <span style="font-size: 0.75rem; color: var(--text-muted);">(${Math.round(sg.progress)}%)</span>
                                                </div>
                                                <span class="tree-delete-btn" onclick="openDeleteModal('subgoal', ${sg.id}, event)">✕</span>
                                            </div>
                                    `;
                                    if (sgHasChildren) {
                                        html += `<ul class="tree-list" style="${isSgCollapsed ? 'display: none;' : ''}">`;
                                        html += `
                                            <li>
                                                <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}', 'maingoal-${mg.id}')" style="color: var(--text-muted); font-style: italic;">
                                                    <div class="tree-node-title">
                                                        <span class="tree-caret-spacer"></span>
                                                        <i class="bi bi-check2-square" style="color: var(--text-primary); margin-right: 4px;"></i>
                                                        <span>...</span>
                                                    </div>
                                                </div>
                                            </li>
                                        `;
                                        html += '</ul>';
                                    }
                                    html += '</li>';
                                });
                            }
                            if (mgTasks.length > 0) {
                                html += `
                                    <li>
                                        <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'maingoal-${mg.id}')" style="color: var(--text-muted); font-style: italic;">
                                            <div class="tree-node-title">
                                                <span class="tree-caret-spacer"></span>
                                                <i class="bi bi-check2-square" style="color: var(--text-primary); margin-right: 4px;"></i>
                                                <span>...</span>
                                            </div>
                                        </div>
                                    </li>
                                `;
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
                        const isSgCollapsed = isSearch ? !searchExpandedNodes.has(sgNodeId) : !expandedNodes.has(sgNodeId);
                        const sgHasChildren = sgTasks.length > 0;
                        const sgCaret = sgHasChildren ? `<span class="tree-caret" onclick="toggleNodeCollapse('${sgNodeId}', event, ${isSearch})">${isSgCollapsed ? '<i class="bi bi-caret-right-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>'}</span>` : '<span class="tree-caret-spacer"></span>';

                        html += `
                            <li>
                                <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}')">
                                    <div class="tree-node-title">
                                        ${sgCaret}
                                        <span>${escapeHtml(sg.title)}</span>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">(${Math.round(sg.progress)}%)</span>
                                    </div>
                                    <span class="tree-delete-btn" onclick="openDeleteModal('subgoal', ${sg.id}, event)">✕</span>
                                </div>
                        `;

                        if (sgHasChildren) {
                            html += `<ul class="tree-list" style="${isSgCollapsed ? 'display: none;' : ''}">`;
                            html += `
                                <li>
                                    <div class="tree-node-row" onclick="loadProjectWorkspaceAndExpandGoal(${p.id}, 'subgoal-${sg.id}')" style="color: var(--text-muted); font-style: italic;">
                                        <div class="tree-node-title">
                                            <span class="tree-caret-spacer"></span>
                                            <i class="bi bi-check2-square" style="color: var(--text-primary); margin-right: 4px;"></i>
                                            <span>...</span>
                                        </div>
                                    </div>
                                </li>
                            `;
                            html += '</ul>';
                        }
                        html += '</li>';
                    });
                }

                if (pTasks.length > 0) {
                    html += `
                        <li>
                            <div class="tree-node-row" onclick="loadProjectWorkspace(${p.id})" style="color: var(--text-muted); font-style: italic;">
                                <div class="tree-node-title">
                                    <span class="tree-caret-spacer"></span>
                                    <i class="bi bi-check2-square" style="color: var(--text-primary); margin-right: 4px;"></i>
                                    <span>...</span>
                                </div>
                            </div>
                        </li>
                    `;
                }
                html += '</ul>';
            }
            html += '</li>';
        });
        html += '</ul>';
        targetEl.innerHTML = html;
    }

    function projectMatchesSearch(p, query) {
        if (!query) return true;
        const q = query.toLowerCase();
        if ((p.title && p.title.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q))) return true;
        if (p.tasks && p.tasks.some(t => t.title && t.title.toLowerCase().includes(q))) return true;
        if (p.mainGoals && p.mainGoals.some(mg => {
            if (mg.title && mg.title.toLowerCase().includes(q)) return true;
            if (mg.tasks && mg.tasks.some(t => t.title && t.title.toLowerCase().includes(q))) return true;
            if (mg.subGoals && mg.subGoals.some(sg => {
                if (sg.title && sg.title.toLowerCase().includes(q)) return true;
                if (sg.tasks && sg.tasks.some(t => t.title && t.title.toLowerCase().includes(q))) return true;
                return false;
            })) return true;
            return false;
        })) return true;
        if (p.subGoals && p.subGoals.some(sg => {
            if (sg.title && sg.title.toLowerCase().includes(q)) return true;
            if (sg.tasks && sg.tasks.some(t => t.title && t.title.toLowerCase().includes(q))) return true;
            return false;
        })) return true;
        return false;
    }

    function applySidebarFilters() {
        const searchRes = document.getElementById("sidebar-search-results");
        const searchTitle = document.getElementById("sidebar-search-results-title");
        if (!treeData) return;

        // If no search query and status/sort filters are default, do not show the tree or title in search panel
        if (!sidebarSearchQuery && sidebarFilterStatus === 'all' && sidebarSortStatus === 'none') {
            if (searchTitle) searchTitle.style.display = 'none';
            if (searchRes) {
                searchRes.innerHTML = '';
            }
            return;
        }

        if (searchTitle) searchTitle.style.display = 'block';

        let filtered = [...treeData];

        // 1. Filter projects based on status selection
        if (sidebarFilterStatus === 'active') {
            filtered = filtered.filter(p => Math.round(p.progress) < 100);
        } else if (sidebarFilterStatus === 'completed') {
            filtered = filtered.filter(p => Math.round(p.progress) === 100);
        }

        // 2. Filter by search query if present (Universal Search across projects)
        if (sidebarSearchQuery) {
            filtered = filtered.filter(p => projectMatchesSearch(p, sidebarSearchQuery));
        }

        if (sidebarSortStatus === 'none') {
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
        } else {
            filtered.sort((a, b) => {
                if (sidebarSortStatus === 'closest-deadline') {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                } else if (sidebarSortStatus === 'farthest-deadline') {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(b.deadline) - new Date(a.deadline);
                } else if (sidebarSortStatus === 'highest-completion') {
                    return b.progress - a.progress;
                } else if (sidebarSortStatus === 'lowest-completion') {
                    return a.progress - b.progress;
                }
                return 0;
            });
        }

        renderSidebarTree(filtered, "sidebar-search-results", true);
    }

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
        const subEl = document.getElementById("home-view-subtitle");
        if (subEl) subEl.innerText = `${teamName} takımına ait projeler ve teslim tarihleri.`;
        updateRailActive('rail-btn-home');
        collapseSidebar();

        // Filter grid
        gridProjectsData = treeData.filter(p => p.teamGroupId === teamId);
        
        // Re-calculate stats for this team
        let totalProjects = gridProjectsData.length;
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

        gridProjectsData.forEach(p => {
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
                totalGoals++;
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

        applyGridFilters();
    }

    async function triggerGlobalRefresh() {
        const scrollPositions = new Map();
        document.querySelectorAll('.task-list-container').forEach(container => {
            if (container.id) {
                scrollPositions.set(container.id, container.scrollTop);
            }
        });
        const windowScrollY = window.scrollY;

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

        requestAnimationFrame(() => {
            scrollPositions.forEach((scrollTop, id) => {
                const el = document.getElementById(id);
                if (el) el.scrollTop = scrollTop;
            });
            window.scrollTo(0, windowScrollY);
        });
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
        updateRailActive('rail-btn-teams');
        collapseSidebar();

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
                `<button class="tm-btn tm-btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); openManageTeamModal(${t.id})"><i class="bi bi-gear"></i> Yönet${t.pendingRequestsCount > 0 ? ` <span style="color:var(--color-danger);font-weight:bold;">(${t.pendingRequestsCount})</span>` : ''}</button>` : '';

            return `
                <div class="tm-card" onclick="loadTeamWorkspace(${t.id}, '${escapeHtml(t.name)}')">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div class="tm-card-title" style="margin-bottom: 0;">${escapeHtml(t.name)}</div>
                        <span style="font-size: 0.75rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 12px; color: var(--text-secondary);">ID: ${t.id}</span>
                    </div>
                    <div class="tm-card-desc" style="min-height: 40px;">${escapeHtml(truncateString(t.description || '', 100))}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 16px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
                        <div style="display: flex; gap: 8px;">
                            <span><i class="bi bi-people"></i> ${t.memberCount || 1} Üye</span>
                            <span><i class="bi bi-folder2"></i> ${t.projectCount || 0} Proje</span>
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

    async function loadProjectWorkspace(projectId, skipRailUpdate = false) {
        activeProjectId = projectId;

        expandedNodes.add(`project-${projectId}`);

        expandedAccordions.clear();

        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "block";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";

        switchWorkspaceTab('active');
        await refreshWorkspaceData();
        loadSidebarTree();
        if (!skipRailUpdate) {
            updateRailActive('rail-btn-home');
            collapseSidebar();
        }
    }

    async function loadProjectWorkspaceAndExpandGoal(projectId, expandNodeId, parentExpandNodeId = null) {
        expandedNodes.add(`project-${projectId}`);

        if (expandNodeId.startsWith('maingoal-')) {
            expandedNodes.add(expandNodeId);
        }
        
        if (parentExpandNodeId) {
            expandedAccordions.add(parentExpandNodeId);
            if (parentExpandNodeId.startsWith('maingoal-')) {
                expandedNodes.add(parentExpandNodeId);
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
            activeProjectHasManageAccess = project.hasManageMembersAccess === true;
            activeProjectIsObserver = project.isObserver === true;
            
            const btnShare = document.getElementById("btn-project-share");
            btnShare.style.display = "flex";
            btnShare.innerHTML = activeProjectHasManageAccess ? '<i class="bi bi-people"></i> Üyeleri Yönet' : '<i class="bi bi-people"></i> Üyeler';
            
            const btnAddItem = document.getElementById("wp-add-new-item-btn");
            if (btnAddItem) btnAddItem.style.display = activeProjectIsObserver ? "none" : "inline-block";
            
            const roundedProjectProgress = Math.round(project.progress);
            document.getElementById("project-progress-val").innerText = `%${roundedProjectProgress}`;

            document.getElementById("wp-title").innerText = project.title;
            document.getElementById("wp-desc").innerText = project.description;

            const createdStr = new Date(project.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const changedStr = project.changedAt ? new Date(project.changedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";
            const deadlineStr = project.deadline ? new Date(project.deadline).toLocaleDateString("tr-TR") : "Belirtilmedi";
            document.getElementById("wp-dates").innerHTML = `<span><i class="bi bi-calendar-event"></i> <b>Oluşturulma:</b> ${createdStr}</span> <span><i class="bi bi-arrow-repeat"></i> <b>Değişiklik:</b> ${changedStr}</span> <span><i class="bi bi-clock"></i> <b>Teslim:</b> ${deadlineStr}</span>`;

            const barFill = document.getElementById("wp-progress-bar");
            const barText = document.getElementById("wp-progress-text");
            barFill.style.width = `${roundedProjectProgress}%`;
            barText.innerText = `%${roundedProjectProgress}`;

            barFill.className = "progress-bar-fill";
            barFill.style.backgroundColor = getSmoothProgressColor(roundedProjectProgress);

            document.getElementById("wp-edit-btn").onclick = () => openProjectModal(project);
            document.getElementById("wp-delete-btn").onclick = () => openDeleteModal('project', project.id);

            if (currentWorkspaceTab === 'deleted') {
                loadDeletedProjectItems();
            } else {
                renderWorkspaceGoals(project.mainGoals, project.tasks);
            }

        } catch (err) {
            console.error(err);
            showToast("Proje çalışma alanı yüklenirken hata oluştu.", "danger");
            showDashboardHome();
        }
    }

    function renderWorkspaceGoals(mainGoals, projectTasks) {
        const container = document.getElementById("maingoals-list");

        if (mainGoals.length === 0 && (!projectTasks || projectTasks.length === 0)) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">Bu projede henüz herhangi bir içerik bulunmuyor.</p>
                </div>
            `;
            return;
        }

        let html = "";

        // Render project-level direct tasks
        if (projectTasks && projectTasks.length > 0) {
            html += renderTaskSection(
                `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">📌 Proje Görevleri</h3>`,
                projectTasks,
                'project-tasks-list-container'
            );
        }

        if (mainGoals && mainGoals.length > 0) {
            html += `
                <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: ${html ? '24px' : '0'}; display: flex; align-items: center; gap: 8px;">
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
                                        <i class="bi ${mgProgress === 100 ? 'bi-clipboard-check' : 'bi-clipboard'}" style="font-size: 1.1rem; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-primary)'};"></i>
                                        <span style="font-weight: 600; font-size: 1.05rem;">${escapeHtml(mg.title)}</span>
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 12px;">
                                        <span><i class="bi bi-calendar-event"></i> ${new Date(mg.createdAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                                        ${mg.changedAt ? `<span><i class="bi bi-arrow-repeat"></i> ${new Date(mg.changedAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>` : ''}
                                    </div>
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <div class="progress-bar-bg" style="width: 120px; height: 6px;">
                                        <div class="progress-bar-fill" style="width: ${mgProgress}%; background-color: ${getSmoothProgressColor(mgProgress)};"></div>
                                    </div>
                                    <span style="font-size: 0.85rem; font-weight: 600; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${mgProgress}</span>
                                </div>
                            </div>
                            
                            <span class="accordion-caret" style="color: var(--text-muted);"><i class="bi bi-caret-down-fill"></i></span>
                        </div>

                        <div class="goal-card-content-wrapper">
                            <div class="goal-card-content">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; flex-wrap: wrap; gap: 16px;">
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.95rem; line-height: 1.5; flex: 1;">${escapeHtml(mg.description)}</p>
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                        ${activeProjectIsObserver ? '' : `
                                        <button class="tm-btn tm-btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openMainGoalModal(${mg.projectId}, ${JSON.stringify(mg).replace(/"/g, '&quot;')})">Düzenle</button>
                                        <button class="tm-btn tm-btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openDeleteModal('maingoal', ${mg.id})">Sil</button>
                                        `}
                                        ${showToggleCompletion ? `
                                            <button class="tm-btn tm-btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; border-color: ${mg.isCompleted ? 'var(--color-success)' : 'var(--border-color)'}; ${activeProjectIsObserver ? 'opacity: 0.7; cursor: not-allowed;' : ''}" ${activeProjectIsObserver ? 'disabled' : `onclick="toggleMainGoalCompletion(${mg.id})"`}>
                                                ${mg.isCompleted ? '<i class="bi bi-check-circle-fill text-success"></i> Tamamlandı' : '<i class="bi bi-hourglass-split text-warning"></i> Tamamla'}
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                <div style="display: flex; flex-direction: column; gap: 16px;">
                                    ${renderTaskSection(
                                        `<h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 6px;"><i class="bi bi-check2-square" style="color: var(--text-primary);"></i> Görevler</h4>`,
                                        mg.tasks,
                                        `mg-tasks-list-${mg.id}`
                                    )}
                                    ${renderSubGoals(mg.subGoals)}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
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
                <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${sgId}">
                    <div class="goal-card-header" onclick="toggleAccordion('${sgId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <i class="bi bi-lightning-charge-fill" style="font-size: 0.95rem; color: #f59e0b;"></i>
                                    <span style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(sg.title)}</span>
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 12px;">
                                    <span><i class="bi bi-calendar-event"></i> ${new Date(sg.createdAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                                    ${sg.changedAt ? `<span><i class="bi bi-arrow-repeat"></i> ${new Date(sg.changedAt).toLocaleString("tr-TR", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>` : ''}
                                </div>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 100px; height: 6px;">
                                    <div class="progress-bar-fill" style="width: ${sgProgress}%; background-color: ${getSmoothProgressColor(sgProgress)};"></div>
                                </div>
                                <span style="font-size: 0.8rem; font-weight: 600; color: ${sgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${sgProgress}</span>
                            </div>
                        </div>
                        <span class="accordion-caret" style="color: var(--text-muted); font-size: 0.8rem;"><i class="bi bi-caret-down-fill"></i></span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content subgoal-content">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; flex-wrap: wrap; gap: 16px;">
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem; line-height: 1.5; flex: 1;">${escapeHtml(sg.description)}</p>
                                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                    ${activeProjectIsObserver ? '' : `
                                    <button class="tm-btn tm-btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openSubGoalModal(${sg.mainGoalId}, ${JSON.stringify(sg).replace(/"/g, '&quot;')})">Düzenle</button>
                                    <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openDeleteModal('subgoal', ${sg.id})">Sil</button>
                                    `}
                                    ${sg.tasks.length === 0 ? `
                                        <button class="tm-btn tm-btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; border-color: ${sg.isCompleted ? 'var(--color-success)' : 'var(--border-color)'}; ${activeProjectIsObserver ? 'opacity: 0.7; cursor: not-allowed;' : ''}" ${activeProjectIsObserver ? 'disabled' : `onclick="toggleSubGoalCompletion(${sg.id})"`}>
                                            ${sg.isCompleted ? '<i class="bi bi-check-circle-fill text-success"></i> Tamamlandı' : '<i class="bi bi-hourglass-split text-warning"></i> Tamamla'}
                                        </button>
                                    ` : ''}
                                </div>
                            </div>

                            ${renderTaskSection(
                                `<h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 6px;"><i class="bi bi-check2-square" style="color: var(--text-primary);"></i> Görevler</h4>`,
                                sg.tasks,
                                `sg-tasks-list-${sg.id}`
                            )}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderTaskSection(titleHtml, tasks, containerId) {
        if (!tasks || tasks.length === 0) return '';
        
        window.expandedTaskContainers = window.expandedTaskContainers || new Set();
        const isExpanded = window.expandedTaskContainers.has(containerId);
        const hideCompletedClass = window.hideCompletedTasks ? "hide-completed" : "";
        const isChecked = window.hideCompletedTasks ? "checked" : "";
        
        const maxHeightStyle = isExpanded ? "none" : "280px";
        const expandText = isExpanded ? "Kapat" : "Tümünü Göster";

        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    ${titleHtml}
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; margin: 0; user-select: none;">
                            <input type="checkbox" onchange="toggleCompletedTasksGlobal(event)" ${isChecked} />
                            Tamamlananları Gizle
                        </label>
                        <button class="tm-btn tm-btn-primary" style="padding: 4px 10px; font-size: 0.75rem; width: 105px; text-align: center; transition: none;" onclick="toggleTaskContainerExpand('${containerId}', this)">${expandText}</button>
                    </div>
                </div>
                <div id="${containerId}" class="task-list-container ${hideCompletedClass}" style="display: flex; flex-direction: column; gap: 8px; max-height: ${maxHeightStyle}; overflow-y: auto; padding-right: 8px; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); padding-top: 12px; padding-bottom: 12px; transition: max-height 0.3s ease;">
                    ${renderTasks(tasks)}
                </div>
            </div>
        `;
    }

    function renderTasks(tasks) {
        if (tasks.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 0.8rem; padding: 5px 0;">Henüz görev tanımlanmamış.</div>`;
        }

        return tasks.map(t => {
            return `
                <div class="task-item-row ${t.isCompleted ? 'completed' : ''}" id="task-row-${t.id}">
                    <div class="task-item-left">
                        <div class="custom-checkbox ${t.isCompleted ? 'checked' : ''}" ${activeProjectIsObserver ? 'style="cursor: not-allowed; opacity: 0.7;"' : `onclick="toggleTaskCompletion(${t.id})"`}></div>
                        <div style="display: flex; flex-direction: column;">
                            <span class="task-title" style="font-size: 0.9rem;">${escapeHtml(t.title)}</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(t.description)}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
                                <i class="bi bi-calendar-event"></i> Oluşturulma: ${new Date(t.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                                ${t.completedAt ? `&nbsp;|&nbsp; <i class="bi bi-check-circle-fill text-success"></i> Tamamlanma: ${new Date(t.completedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                            </span>
                        </div>
                    </div>
                    ${activeProjectIsObserver ? '' : `
                    <div style="display: flex; gap: 6px;">
                        <button class="tm-btn-icon-only" style="padding: 4px;" title="Düzenle" onclick="openTaskModal(null, ${JSON.stringify(t).replace(/"/g, '&quot;')})"><i class="bi bi-pencil-square"></i></button>
                        <button class="tm-btn-icon-only" style="padding: 4px;" title="Sil" onclick="openDeleteModal('task', ${t.id})"><i class="bi bi-trash3"></i></button>
                    </div>
                    `}
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

        const structSection = document.getElementById("project-initial-structure-section");
        if (project) {
            document.getElementById("project-modal-title").innerText = "Proje Düzenle";
            document.getElementById("project-modal-id").value = project.id;
            document.getElementById("project-title").value = project.title;
            document.getElementById("project-desc").value = project.description;
            document.getElementById("project-deadline").value = project.deadline ? project.deadline.substring(0, 10) : "";
            if (structSection) structSection.style.display = "none";
        } else {
            document.getElementById("project-modal-title").innerText = "Yeni Proje Ekle";
            document.getElementById("project-modal-id").value = "";
            document.getElementById("project-deadline").value = "";
            if (structSection) structSection.style.display = "block";
            const panel = document.getElementById("initial-structure-panel");
            if (panel) panel.style.display = "none";
            const caret = document.getElementById("initial-structure-caret");
            if (caret) caret.innerHTML = '<i class="bi bi-caret-down-fill"></i>';
            const initMg = document.getElementById("init-mg-count"); if (initMg) initMg.value = "0";
            const initSg = document.getElementById("init-sg-count"); if (initSg) initSg.value = "0";
            const initTask = document.getElementById("init-task-count"); if (initTask) initTask.value = "0";
            const slotsContainer = document.getElementById("dynamic-slots-container"); if (slotsContainer) slotsContainer.innerHTML = "";
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
        const deadline = document.getElementById("project-deadline").value;

        const payload = { title, description, deadline: deadline || null };
        if (!id && activeTeamId) {
            payload.teamGroupId = activeTeamId;
        }

        if (!id) {
            const mgElements = document.querySelectorAll('#dynamic-slots-container .init-slot-mg');
            const initialGoals = [];
            mgElements.forEach(mgEl => {
                const mgTitle = mgEl.querySelector('.mg-title')?.value.trim();
                if (!mgTitle) return;
                const mgDesc = mgEl.querySelector('.mg-desc')?.value.trim() || "";
                
                const subGoals = [];
                mgEl.querySelectorAll('.sg-container .init-slot-sg').forEach(sgEl => {
                    const sgTitle = sgEl.querySelector('.sg-title')?.value.trim();
                    if (!sgTitle) return;
                    const sgDesc = sgEl.querySelector('.sg-desc')?.value.trim() || "";
                    
                    const sgTasks = [];
                    sgEl.querySelectorAll('.sg-tasks-container .init-slot-task').forEach(tEl => {
                        const tTitle = tEl.querySelector('.task-title')?.value.trim();
                        if (!tTitle) return;
                        const tDesc = tEl.querySelector('.task-desc')?.value.trim() || "";
                        sgTasks.push({ title: tTitle, description: tDesc });
                    });
                    subGoals.push({ title: sgTitle, description: sgDesc, tasks: sgTasks });
                });

                const mgTasks = [];
                mgEl.querySelectorAll('.mg-tasks-container > .init-slot-task').forEach(tEl => {
                    const tTitle = tEl.querySelector('.task-title')?.value.trim();
                    if (!tTitle) return;
                    const tDesc = tEl.querySelector('.task-desc')?.value.trim() || "";
                    mgTasks.push({ title: tTitle, description: tDesc });
                });

                initialGoals.push({ title: mgTitle, description: mgDesc, subGoals: subGoals, tasks: mgTasks });
            });

            const initialTasks = [];
            document.querySelectorAll('#dynamic-slots-container > .init-slot-task').forEach(tEl => {
                const tTitle = tEl.querySelector('.task-title')?.value.trim();
                if (!tTitle) return;
                const tDesc = tEl.querySelector('.task-desc')?.value.trim() || "";
                initialTasks.push({ title: tTitle, description: tDesc });
            });

            if (initialGoals.length > 0) payload.initialGoals = initialGoals;
            if (initialTasks.length > 0) payload.initialTasks = initialTasks;

            const mgCount = parseInt(document.getElementById("init-mg-count")?.value, 10) || 0;
            const sgCount = parseInt(document.getElementById("init-sg-count")?.value, 10) || 0;
            const taskCount = parseInt(document.getElementById("init-task-count")?.value, 10) || 0;
            if (mgCount > 0 && initialGoals.length === 0) {
                payload.initialMainGoalCount = mgCount;
                payload.initialSubGoalCountPerMain = sgCount;
                payload.initialTaskCountPerSub = taskCount;
            }
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
        updateRailActive('rail-btn-trash');
        collapseSidebar();

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
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 16px;"><i class="bi bi-clipboard" style="color: var(--text-primary);"></i> Silinen Ana Hedefler</h3>`;
                html += renderDeletedMainGoals(mainGoals);
            }

            if (subGoals.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 24px;"><i class="bi bi-lightning-charge-fill" style="color: #f59e0b;"></i> Silinen Alt Hedefler</h3>`;
                html += renderDeletedSubGoals(subGoals, false);
            }

            if (tasks.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 24px;"><i class="bi bi-check2-square" style="color: var(--text-primary);"></i> Silinen Görevler</h3>`;
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
                                <i class="bi ${mgProgress === 100 ? 'bi-clipboard-check' : 'bi-clipboard'}" style="font-size: 1.1rem; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-primary)'};"></i>
                                <span style="font-weight: 600; font-size: 1.05rem;">${escapeHtml(mg.title)}</span>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 120px; height: 6px;">
                                    <div class="progress-bar-fill" style="width: ${mgProgress}%; background-color: ${getSmoothProgressColor(mgProgress)};"></div>
                                </div>
                                <span style="font-size: 0.85rem; font-weight: 600; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${mgProgress}</span>
                            </div>
                        </div>
                        
                        <span class="accordion-caret" style="color: var(--text-muted);"><i class="bi bi-caret-down-fill"></i></span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content">
                            <p style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.95rem; line-height: 1.5;">${escapeHtml(mg.description)}</p>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap;">
                                <span><i class="bi bi-calendar-event"></i> Oluşturulma: ${new Date(mg.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                ${mg.changedAt ? `<span><i class="bi bi-arrow-repeat"></i> Değişiklik: ${new Date(mg.changedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                                <span style="color: var(--color-danger);"><i class="bi bi-trash3"></i> Silinme: ${new Date(mg.deletedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            
                            <div style="display: flex; gap: 10px; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
                                ${activeProjectIsObserver ? '' : `
                                <button class="tm-btn tm-btn-success" style="padding: 6px 12px; font-size: 0.8rem;" onclick="restoreProjectItem('maingoal', ${mg.id})">Geri Yükle</button>
                                <button class="tm-btn tm-btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="permanentlyDeleteProjectItem('maingoal', ${mg.id})">Kalıcı Sil</button>
                                `}
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 16px;">
                                ${mg.tasks && mg.tasks.length > 0 ? `
                                    <div class="tm-card" style="border: 1px solid var(--border-color); padding: 12px; background-color: var(--bg-surface-elevated);">
                                        <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;"><i class="bi bi-check2-square" style="color: var(--text-primary);"></i> Ana Hedef Görevleri</h4>
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
                <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${sgId}">
                    <div class="goal-card-header" onclick="toggleAccordion('${sgId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="bi bi-lightning-charge-fill" style="font-size: 0.95rem; color: #f59e0b;"></i>
                                <span style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(sg.title)}</span>
                                ${isParentDeleted ? '<span style="font-size: 0.75rem; color: var(--color-danger);">(Üst Hedefle Silindi)</span>' : ''}
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 100px; height: 6px;">
                                    <div class="progress-bar-fill" style="width: ${sgProgress}%; background-color: ${getSmoothProgressColor(sgProgress)};"></div>
                                </div>
                                <span style="font-size: 0.8rem; font-weight: 600; color: ${sgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${sgProgress}</span>
                            </div>
                        </div>
                        <span class="accordion-caret" style="color: var(--text-muted); font-size: 0.8rem;"><i class="bi bi-caret-down-fill"></i></span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content subgoal-content">
                            <p style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem; line-height: 1.5;">${escapeHtml(sg.description)}</p>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px; display: flex; gap: 16px; flex-wrap: wrap;">
                                <span><i class="bi bi-calendar-event"></i> Oluşturulma: ${new Date(sg.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                ${sg.changedAt ? `<span><i class="bi bi-arrow-repeat"></i> Değişiklik: ${new Date(sg.changedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                                ${!isParentDeleted && sg.deletedAt ? `<span style="color: var(--color-danger);"><i class="bi bi-trash3"></i> Silinme: ${new Date(sg.deletedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                            </div>

                            <div style="display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                                ${(isParentDeleted || activeProjectIsObserver) ? '' : `
                                <button class="tm-btn tm-btn-success" style="padding: 4px 10px; font-size: 0.75rem;" onclick="restoreProjectItem('subgoal', ${sg.id})">Geri Yükle</button>
                                <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="permanentlyDeleteProjectItem('subgoal', ${sg.id})">Kalıcı Sil</button>
                                `}
                            </div>

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
                        <i class="bi bi-check2-square" style="color: var(--text-primary); font-size: 1.1rem; margin-right: 8px;"></i>
                        <div style="display: flex; flex-direction: column;">
                            <span class="task-title" style="font-size: 0.9rem;">
                                ${escapeHtml(t.title)}
                                ${t.isCompleted ? '<span style="color: var(--color-success); font-size: 0.8rem;"> (Tamamlandı)</span>' : ''}
                                ${isParentDeleted ? '<span style="font-size: 0.75rem; color: var(--color-danger);">(Üst Hedefle Silindi)</span>' : ''}
                            </span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(t.description)}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap;">
                                <span><i class="bi bi-calendar-event"></i> Oluşturulma: ${new Date(t.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                ${t.completedAt ? `<span><i class="bi bi-check-circle-fill text-success"></i> Tamamlanma: ${new Date(t.completedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                                ${!isParentDeleted && t.deletedAt ? `<span style="color: var(--color-danger);"><i class="bi bi-trash3"></i> Silinme: ${new Date(t.deletedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        ${(isParentDeleted || activeProjectIsObserver) ? '' : `
                        <button class="tm-btn tm-btn-success" style="padding: 4px 10px; font-size: 0.75rem;" onclick="restoreProjectItem('task', ${t.id})">Geri Yükle</button>
                        <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="permanentlyDeleteProjectItem('task', ${t.id})">Kalıcı Sil</button>
                        `}
                    </div>
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
        updateRailActive('rail-btn-activities');
        collapseSidebar();

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
                            <span id="arrow-${cardId}" style="transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: var(--text-secondary); font-size: 0.9rem; display: flex; align-items: center; justify-content: center;"><i class="bi bi-caret-down-fill"></i></span>
                        </div>
                        
                        <!-- Log İçerikleri -->
                        <div id="${cardId}" style="display: none; flex-direction: column;">
                            ${projectLog.activities.map((log, index) => {
                    let icon = '<i class="bi bi-file-earmark-text" style="color: #64748b;"></i>';
                    let iconBg = "rgba(100, 116, 139, 0.2)"; // Gri

                    if(log.action === "Oluşturuldu") { icon = '<i class="bi bi-stars" style="color: #10b981;"></i>'; iconBg = "rgba(16, 185, 129, 0.2)"; } // Yeşil
                    if(log.action === "Silindi" || log.action === "Kalıcı Olarak Silindi") { icon = '<i class="bi bi-trash3" style="color: #ef4444;"></i>'; iconBg = "rgba(239, 68, 68, 0.2)"; } // Kırmızı
                    if(log.action === "Güncellendi") { icon = '<i class="bi bi-pencil-square" style="color: #3b82f6;"></i>'; iconBg = "rgba(59, 130, 246, 0.2)"; } // Mavi

                    const timeString = new Date(log.date).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

    window.hideCompletedTasks = false;
    window.expandedTaskContainers = new Set();

    window.toggleCompletedTasksGlobal = function(event) {
        const isChecked = event ? event.target.checked : !window.hideCompletedTasks;
        window.hideCompletedTasks = isChecked;
        
        // Update all checkboxes
        document.querySelectorAll('input[onchange="toggleCompletedTasksGlobal(event)"]').forEach(cb => cb.checked = isChecked);
        
        // Update all task containers
        document.querySelectorAll('.task-list-container').forEach(container => {
            if (isChecked) {
                container.classList.add('hide-completed');
            } else {
                container.classList.remove('hide-completed');
            }
        });
    }

    window.toggleTaskContainerExpand = function(containerId, btnElement) {
        window.expandedTaskContainers = window.expandedTaskContainers || new Set();
        const container = document.getElementById(containerId);
        if (!container) return;

        if (window.expandedTaskContainers.has(containerId)) {
            window.expandedTaskContainers.delete(containerId);
            container.style.maxHeight = "280px";
            if (btnElement) btnElement.innerText = "Tümünü Göster";
        } else {
            window.expandedTaskContainers.add(containerId);
            container.style.maxHeight = "none";
            if (btnElement) btnElement.innerText = "Kapat";
        }
    }

    window.toggleInitialStructurePanel = function() {
        const panel = document.getElementById("initial-structure-panel");
        const caret = document.getElementById("initial-structure-caret");
        if (!panel) return;
        if (panel.style.display === "none") {
            panel.style.display = "flex";
            if (caret) caret.innerHTML = '<i class="bi bi-caret-up-fill"></i>';
        } else {
            panel.style.display = "none";
            if (caret) caret.innerHTML = '<i class="bi bi-caret-down-fill"></i>';
        }
    };

    window.createMainGoalSlotDOM = function(defaultTitle = "") {
        const div = document.createElement("div");
        div.className = "init-slot-mg tm-card";
        div.style.cssText = "padding: 10px; border: 1px solid var(--border-color); background: var(--bg-surface); border-radius: 6px;";
        div.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                <i class="bi bi-clipboard" style="color: var(--text-primary);"></i>
                <input type="text" class="form-control mg-title" value="${defaultTitle}" placeholder="Ana Hedef Başlığı" style="flex: 1; height: 32px; font-size: 0.85rem;" />
                <button type="button" class="tm-btn-icon-only" style="color: var(--color-danger);" onclick="this.closest('.init-slot-mg').remove()" title="Sil"><i class="bi bi-trash3"></i></button>
            </div>
            <textarea class="form-control mg-desc" placeholder="Açıklama (İsteğe bağlı)" style="height: 44px; font-size: 0.8rem; margin-bottom: 8px;"></textarea>
            <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                <button type="button" class="tm-btn tm-btn-secondary" style="font-size: 0.75rem; padding: 2px 8px;" onclick="addInitialSubGoalSlot(this.closest('.init-slot-mg').querySelector('.sg-container'))"><i class="bi bi-plus"></i> Alt Hedef Ekle</button>
                <button type="button" class="tm-btn tm-btn-secondary" style="font-size: 0.75rem; padding: 2px 8px;" onclick="addInitialTaskToMgSlot(this.closest('.init-slot-mg').querySelector('.mg-tasks-container'))"><i class="bi bi-plus"></i> Görev Ekle</button>
            </div>
            <div class="sg-container" style="display: flex; flex-direction: column; gap: 6px; margin-left: 14px; border-left: 2px solid #f59e0b; padding-left: 8px;"></div>
            <div class="mg-tasks-container" style="display: flex; flex-direction: column; gap: 6px; margin-left: 14px; border-left: 2px solid #10b981; padding-left: 8px; margin-top: 4px;"></div>
        `;
        return div;
    };

    window.createSubGoalSlotDOM = function(defaultTitle = "") {
        const div = document.createElement("div");
        div.className = "init-slot-sg";
        div.style.cssText = "padding: 8px; border: 1px dashed var(--border-color); background: var(--bg-surface-elevated); border-radius: 4px;";
        div.innerHTML = `
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
                <i class="bi bi-lightning-charge-fill" style="color: #f59e0b; font-size: 0.8rem;"></i>
                <input type="text" class="form-control sg-title" value="${defaultTitle}" placeholder="Alt Hedef Başlığı" style="flex: 1; height: 28px; font-size: 0.8rem;" />
                <button type="button" class="tm-btn-icon-only" style="color: var(--color-danger); font-size: 0.8rem;" onclick="this.closest('.init-slot-sg').remove()" title="Sil"><i class="bi bi-trash3"></i></button>
            </div>
            <textarea class="form-control sg-desc" placeholder="Açıklama (İsteğe bağlı)" style="height: 38px; font-size: 0.75rem; margin-bottom: 6px;"></textarea>
            <div style="margin-bottom: 4px;">
                <button type="button" class="tm-btn tm-btn-secondary" style="font-size: 0.7rem; padding: 2px 6px;" onclick="addInitialTaskToSgSlot(this.closest('.init-slot-sg').querySelector('.sg-tasks-container'))"><i class="bi bi-plus"></i> Görev Ekle</button>
            </div>
            <div class="sg-tasks-container" style="display: flex; flex-direction: column; gap: 4px; margin-left: 12px; border-left: 2px solid #10b981; padding-left: 6px;"></div>
        `;
        return div;
    };

    window.createTaskSlotDOM = function(defaultTitle = "") {
        const div = document.createElement("div");
        div.className = "init-slot-task";
        div.style.cssText = "display: flex; gap: 6px; align-items: center; background: var(--bg-surface); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border-color);";
        div.innerHTML = `
            <i class="bi bi-check2-square" style="color: var(--text-primary); font-size: 0.8rem;"></i>
            <input type="text" class="form-control task-title" value="${defaultTitle}" placeholder="Görev Başlığı" style="flex: 1; height: 26px; font-size: 0.75rem;" />
            <input type="text" class="form-control task-desc" placeholder="Açıklama (İsteğe bağlı)" style="flex: 1; height: 26px; font-size: 0.75rem;" />
            <button type="button" class="tm-btn-icon-only" style="color: var(--color-danger); font-size: 0.75rem;" onclick="this.closest('.init-slot-task').remove()" title="Sil"><i class="bi bi-trash3"></i></button>
        `;
        return div;
    };

    window.addInitialMainGoalSlot = function() {
        const container = document.getElementById("dynamic-slots-container");
        if (!container) return;
        container.appendChild(createMainGoalSlotDOM());
        const panel = document.getElementById("initial-structure-panel");
        if (panel && panel.style.display === "none") toggleInitialStructurePanel();
    };

    window.addInitialSubGoalSlot = function(container) {
        if (!container) return;
        container.appendChild(createSubGoalSlotDOM());
    };

    window.addInitialTaskToMgSlot = function(container) {
        if (!container) return;
        container.appendChild(createTaskSlotDOM());
    };

    window.addInitialTaskToSgSlot = function(container) {
        if (!container) return;
        container.appendChild(createTaskSlotDOM());
    };

    window.addInitialTaskSlot = function() {
        const container = document.getElementById("dynamic-slots-container");
        if (!container) return;
        container.appendChild(createTaskSlotDOM());
        const panel = document.getElementById("initial-structure-panel");
        if (panel && panel.style.display === "none") toggleInitialStructurePanel();
    };

    window.generateSlotsFromCounts = function() {
        const mgCount = parseInt(document.getElementById("init-mg-count").value, 10) || 0;
        const sgCount = parseInt(document.getElementById("init-sg-count").value, 10) || 0;
        const taskCount = parseInt(document.getElementById("init-task-count").value, 10) || 0;

        const container = document.getElementById("dynamic-slots-container");
        if (!container) return;
        container.innerHTML = "";

        for (let i = 1; i <= mgCount; i++) {
            const mgEl = createMainGoalSlotDOM(`Ana Hedef ${i}`);
            container.appendChild(mgEl);
            const sgContainer = mgEl.querySelector(".sg-container");
            const mgTasksContainer = mgEl.querySelector(".mg-tasks-container");

            for (let j = 1; j <= sgCount; j++) {
                const sgEl = createSubGoalSlotDOM(`Alt Hedef ${i}.${j}`);
                sgContainer.appendChild(sgEl);
                const sgTasksContainer = sgEl.querySelector(".sg-tasks-container");

                for (let k = 1; k <= taskCount; k++) {
                    const tEl = createTaskSlotDOM(`Görev ${i}.${j}.${k}`);
                    sgTasksContainer.appendChild(tEl);
                }
            }

            if (sgCount === 0 && taskCount > 0) {
                for (let k = 1; k <= taskCount; k++) {
                    const tEl = createTaskSlotDOM(`Ana Hedef ${i} - Görev ${k}`);
                    mgTasksContainer.appendChild(tEl);
                }
            }
        }
        showToast("Şablon yuvaları oluşturuldu. Aşağıdan içeriklerini düzenleyebilirsiniz.", "success");
    };


    window.openProjectMembersModal = function() {
        if (!activeProjectId) {
            showToast("Lütfen önce bir proje seçin.", "warning");
            return;
        }
        
        document.getElementById("project-members-modal-title").innerText = activeProjectHasManageAccess ? "Proje Üyeleri" : "Proje Üyeleri";
        document.getElementById("new-project-member-section").style.display = activeProjectHasManageAccess ? "block" : "none";
        document.getElementById("new-project-member-hr").style.display = activeProjectHasManageAccess ? "block" : "none";
        
        const modal = document.getElementById("project-members-modal");
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("active"), 10);
        loadProjectMembers();
    };

    window.closeProjectMembersModal = function() {
        const modal = document.getElementById("project-members-modal");
        modal.classList.remove("active");
        setTimeout(() => modal.style.display = "none", 250);
        document.getElementById("new-project-member-email").value = "";
    };

    window.loadProjectMembers = async function() {
        if (!activeProjectId) return;
        const listDiv = document.getElementById("project-members-list");
        listDiv.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Üyeler yükleniyor...</div>';
        
        try {
            const res = await fetch(`/api/ProjectMemberApi/${activeProjectId}`);
            if (!res.ok) throw new Error("Üyeler alınamadı.");
            const members = await res.json();
            
            if (members.length === 0) {
                listDiv.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Bu projede henüz başka bir üye yok.</div>';
                return;
            }
            
            listDiv.innerHTML = members.map(m => {
                let controlsHtml = '';
                if (activeProjectHasManageAccess) {
                    controlsHtml = `
                        <select class="form-control" style="padding: 4px 8px; font-size: 0.85rem; height: auto;" onchange="updateProjectMemberRole(${m.id}, this.value)">
                            <option value="Participant" ${m.role === 'Participant' ? 'selected' : ''}>Katılımcı</option>
                            <option value="Manager" ${m.role === 'Manager' ? 'selected' : ''}>Yönetici</option>
                            <option value="Observer" ${m.role === 'Observer' ? 'selected' : ''}>Gözlemci</option>
                        </select>
                        <button class="tm-btn-icon-only" style="color: var(--color-danger);" onclick="removeProjectMember(${m.id})" title="Üyeyi Çıkar">
                            <i class="bi bi-trash"></i>
                        </button>
                    `;
                } else {
                    let roleStr = m.role === 'Manager' ? 'Yönetici' : (m.role === 'Participant' ? 'Katılımcı' : 'Gözlemci');
                    controlsHtml = `<span style="font-size: 0.85rem; color: var(--text-muted); padding: 4px 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-surface-elevated);">${roleStr}</span>`;
                }
                
                return `
                <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary);">${escapeHtml(m.user.name + " " + m.user.surname)}</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(m.user.email)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${controlsHtml}
                    </div>
                </div>
            `}).join("");
            
        } catch (err) {
            console.error(err);
            listDiv.innerHTML = '<div style="color: var(--color-danger); font-size: 0.85rem;">Üyeler yüklenirken bir hata oluştu.</div>';
        }
    };

    window.addProjectMember = async function() {
        const email = document.getElementById("new-project-member-email").value.trim();
        const role = document.getElementById("new-project-member-role").value;
        if (!email || !activeProjectId) return;
        
        try {
            const res = await fetch('/api/ProjectMemberApi/Add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: activeProjectId, email, role })
            });
            
            if (res.ok) {
                showToast("Üye başarıyla eklendi.", "success");
                document.getElementById("new-project-member-email").value = "";
                loadProjectMembers();
            } else {
                const text = await res.text();
                showToast(text || "Üye eklenemedi.", "danger");
            }
        } catch (err) {
            console.error(err);
            showToast("Bir hata oluştu.", "danger");
        }
    };

    window.removeProjectMember = async function(id) {
        if (!confirm("Bu üyeyi projeden çıkarmak istediğinize emin misiniz?")) return;
        
        try {
            const res = await fetch(`/api/ProjectMemberApi/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast("Üye çıkarıldı.", "info");
                loadProjectMembers();
            } else {
                showToast("Silme işlemi başarısız.", "danger");
            }
        } catch (err) {
            console.error(err);
            showToast("Bir hata oluştu.", "danger");
        }
    };

    window.updateProjectMemberRole = async function(id, newRole) {
        try {
            const res = await fetch(`/api/ProjectMemberApi/${id}/Role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            
            if (res.ok) {
                showToast("Üye rolü güncellendi.", "success");
            } else {
                showToast("Rol güncellenemedi.", "danger");
                loadProjectMembers();
            }
        } catch (err) {
            console.error(err);
            showToast("Bir hata oluştu.", "danger");
            loadProjectMembers();
        }
    };

    // Unified Add Modal Logic
    window.openUnifiedAddModal = async function() {
        document.getElementById("unified-title").value = "";
        document.getElementById("unified-desc").value = "";
        document.getElementById("unified-item-type").value = "task";
        
        await populateUnifiedMainGoals();
        onUnifiedItemTypeChange();
        
        document.getElementById("unified-add-modal").classList.add("active");
    };

    window.populateUnifiedMainGoals = async function() {
        const mgSelect = document.getElementById("unified-maingoal-select");
        mgSelect.innerHTML = '<option value="">-- Projeye Ekle --</option>';
        try {
            const res = await fetch(`/api/dashboard/workspace/data?projectId=${activeProjectId}`);
            if(res.ok) {
                const data = await res.json();
                if (data.project && data.project.mainGoals) {
                    data.project.mainGoals.forEach(mg => {
                        mgSelect.innerHTML += `<option value="${mg.id}">${escapeHtml(mg.title)}</option>`;
                    });
                }
            }
        } catch(err) { console.error(err); }
    };

    window.onUnifiedItemTypeChange = function() {
        const type = document.getElementById("unified-item-type").value;
        const mgGroup = document.getElementById("unified-maingoal-group");
        const sgGroup = document.getElementById("unified-subgoal-group");
        
        if (type === "maingoal") {
            mgGroup.style.display = "none";
            sgGroup.style.display = "none";
        } else if (type === "subgoal") {
            mgGroup.style.display = "block";
            sgGroup.style.display = "none";
        } else if (type === "task") {
            mgGroup.style.display = "block";
            sgGroup.style.display = "block";
        }
    };

    window.onUnifiedMainGoalChange = async function() {
        const type = document.getElementById("unified-item-type").value;
        if (type !== "task") return;
        
        const sgGroup = document.getElementById("unified-subgoal-group");
        const sgSelect = document.getElementById("unified-subgoal-select");
        const mgId = document.getElementById("unified-maingoal-select").value;
        
        sgSelect.innerHTML = '<option value="">-- Ana Hedefe Ekle --</option>';
        
        if (!mgId) {
            return;
        }
        
        try {
            const res = await fetch(`/api/dashboard/workspace/data?projectId=${activeProjectId}`);
            if(res.ok) {
                const data = await res.json();
                if (data.project && data.project.mainGoals) {
                    const mg = data.project.mainGoals.find(m => m.id == mgId);
                    if (mg && mg.subGoals) {
                        mg.subGoals.forEach(sg => {
                            sgSelect.innerHTML += `<option value="${sg.id}">${escapeHtml(sg.title)}</option>`;
                        });
                    }
                }
            }
        } catch(err) { console.error(err); }
    };

    window.handleUnifiedAddSubmit = async function(e) {
        e.preventDefault();
        const type = document.getElementById("unified-item-type").value;
        const title = document.getElementById("unified-title").value;
        const desc = document.getElementById("unified-desc").value;
        
        let url = "";
        let bodyObj = { title, description: desc };
        
        if (type === "maingoal") {
            url = "/api/dashboard/maingoal";
            bodyObj.projectId = activeProjectId;
        } else if (type === "subgoal") {
            url = "/api/dashboard/subgoal";
            const mgId = document.getElementById("unified-maingoal-select").value;
            if (!mgId) {
                showToast("Lütfen bir ana hedef seçin.", "warning");
                return;
            }
            bodyObj.mainGoalId = mgId;
        } else if (type === "task") {
            url = "/api/dashboard/task";
            const mgId = document.getElementById("unified-maingoal-select").value;
            const sgId = document.getElementById("unified-subgoal-select").value;
            if (sgId) {
                bodyObj.subGoalId = parseInt(sgId);
            } else if (mgId) {
                bodyObj.mainGoalId = parseInt(mgId);
            } else {
                bodyObj.projectId = activeProjectId;
            }
        }
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj)
            });
            
            if (res.ok) {
                closeModal('unified-add-modal');
                showToast("Öge eklendi.", "success");
                await refreshWorkspaceData(activeProjectId);
            } else {
                showToast("Hata oluştu.", "danger");
            }
        } catch (err) {
            console.error(err);
            showToast("Bir hata oluştu.", "danger");
        }
    };
