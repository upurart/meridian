    async function loadSidebarTree() {
        try {
            const res = await fetch("/api/dashboard/tree");
            if (!res.ok) throw new Error("Sidebar yüklenemedi.");
            treeData = await res.json();
            renderExplorerTree();
            applySidebarFilters();
            
            // Organizasyonları yükle
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
                console.error("Organizasyonlar yüklenemedi:", teamErr);
            }
        } catch (err) {
            console.error(err);
            showToast("Yan menü ağaç yapısı yüklenirken hata oluştu.", "danger");
        }
    }

    function renderSidebarTeams(data) {
        const container = document.getElementById("sidebar-teams-container");
        if (data.length === 0) {
            container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Henüz Organizasyon yok.</div>`;
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
        renderSidebarTree(treeData, "sidebar-tree-container", false);
    }

    function generateProjectNodeHtml(p, isSearch) {
        let html = '';
        const isWpActive = (typeof activeProjectId !== 'undefined') ? activeProjectId === p.id : false;
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
        
        return html;
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
        
        const workspacesMap = new Map();
        data.forEach(p => {
            if (p.teamGroupId) return; // Takım projelerini kişisel ağaçta gösterme
            
            const wId = p.workspaceId || 'personal';
            const wName = p.workspaceName || 'Kişisel';
            if (!workspacesMap.has(wId)) {
                workspacesMap.set(wId, { id: wId, name: wName, projects: [] });
            }
            workspacesMap.get(wId).projects.push(p);
        });
        
        workspacesMap.forEach(ws => {
            const wsNodeId = `ws-${isSearch ? 'search-' : ''}${ws.id}`;
            const isWsCollapsed = isSearch ? !searchExpandedNodes.has(wsNodeId) : !expandedNodes.has(wsNodeId);
            const wsCaret = `<span class="tree-caret" onclick="toggleNodeCollapse('${wsNodeId}', event, ${isSearch})">${isWsCollapsed ? '<i class="bi bi-caret-right-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>'}</span>`;
            
            html += `
                <li style="font-weight: 600; margin-top: 8px;">
                    <div class="tree-node-row">
                        <div class="tree-node-title">
                            ${wsCaret}
                            <i class="bi bi-briefcase text-primary" style="margin-right: 4px;"></i>
                            <span>${escapeHtml(ws.name)}</span>
                        </div>
                    </div>
                    <ul class="tree-list" style="${isWsCollapsed ? 'display: none;' : ''}">
            `;
            ws.projects.forEach(p => {
                html += generateProjectNodeHtml(p, isSearch);
            });
            html += `
                    </ul>
                </li>
            `;
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



