async function loadWorkspacesSidebar() {
    const listContainer = document.getElementById('workspaces-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Yükleniyor...</div>';

    try {
        const res = await fetch(window.WORKSPACE_API);
        if (!res.ok) throw new Error("Çalışma alanları alınamadı.");
        const workspaces = await res.json();
        const personalWorkspaces = workspaces.filter(w => !w.teamGroupId);

        if (personalWorkspaces.length === 0) {
            listContainer.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Henüz bir çalışma alanınız yok.</div>';
            return;
        }

        let html = '';
        personalWorkspaces.forEach(ws => {
            html += `
                <div class="tm-card" style="padding: 12px; margin-bottom: 8px; cursor: pointer; border: 1px solid var(--border-color); border-radius: var(--radius-md); transition: all 0.2s;" onclick="loadWorkspaceView(${ws.id}, '${ws.name}')">
                    <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <i class="bi bi-briefcase text-primary"></i> ${ws.name}
                    </div>
                    ${ws.description ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">${ws.description}</div>` : ''}
                    <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
                        <span>Rol: <span style="font-weight: 500;">${ws.rolePreset}</span></span>
                        ${ws.rolePreset === 'Owner' ? `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); deleteWorkspace(${ws.id})" title="Sil" style="padding: 2px 6px;"><i class="bi bi-trash"></i></button>` : ''}
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<div style="padding: 10px; color: var(--color-danger); font-size: 0.85rem; text-align: center;">Çalışma alanları yüklenirken bir hata oluştu.</div>';
    }
}

let currentWsProjectViewMode = 'grid';
let loadedWorkspaceProjects = [];

async function loadWorkspaceView(workspaceId, workspaceName) {
    activeWorkspaceId = workspaceId;
    if (workspaceName) {
        activeWorkspaceName = workspaceName;
    }
    try {
        const res = await fetch(`${window.WORKSPACE_API}/${workspaceId}`);
        if (!res.ok) throw new Error("Çalışma alanı bilgileri alınamadı.");
        const data = await res.json();
        
        // Ensure activeTeamId is set if this workspace belongs to a team
        activeTeamId = data.teamGroupId || null;
        activeTeamName = data.teamGroupName || null;

        // Populate header
        document.getElementById("ws-detail-title").innerText = data.name;
        document.getElementById("ws-detail-desc").innerText = data.description || "Açıklama yok.";
        document.getElementById("ws-detail-role").innerText = data.rolePreset || "Üye";
        
        loadedWorkspaceProjects = data.projects || [];
        
        // Calculate Workspace Stats
        try {
            const treeRes = await fetch("/api/dashboard/tree");
            const allTreeProjects = await treeRes.json();
            const wsTreeProjects = allTreeProjects.filter(p => p.workspaceId === workspaceId);
            
            let approachingProjects = [];
            let overdueProjects = [];
            let weeklyCompletedTasks = 0;
            const now = new Date();
            const oneWeekFromNow = new Date();
            oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
            
            const currentDay = now.getDay();
            const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() + diffToMonday);
            startOfWeek.setHours(0, 0, 0, 0);

            wsTreeProjects.forEach(p => {
                if (typeof countWeeklyCompletedTasks === 'function') {
                    weeklyCompletedTasks += countWeeklyCompletedTasks(p, startOfWeek);
                }
                
                const roundProgress = Math.round(p.progress || 0);
                if (roundProgress < 100 && p.deadline) {
                    const deadlineDate = new Date(p.deadline);
                    if (deadlineDate < now) {
                        overdueProjects.push({ title: p.title, progress: p.progress, deadline: deadlineDate });
                    } else if (deadlineDate <= oneWeekFromNow) {
                        approachingProjects.push({ title: p.title, progress: p.progress, deadline: deadlineDate });
                    }
                }
            });

            // Update DOM Stats
            document.getElementById("stat-weekly-productivity").innerText = weeklyCompletedTasks;
            
            const statAppr = document.getElementById("stat-approaching-deadlines");
            const cardAppr = document.getElementById("stat-card-approaching");
            if (approachingProjects.length === 0) {
                if(statAppr) statAppr.innerHTML = "Yaklaşan Teslim Yok";
                if(statAppr) statAppr.style.fontSize = "1.2rem";
                if(cardAppr) cardAppr.classList.remove("stat-danger");
                if(cardAppr) cardAppr.classList.add("stat-success");
            } else {
                if(cardAppr) cardAppr.classList.add("stat-danger");
                if(cardAppr) cardAppr.classList.remove("stat-success");
                approachingProjects.sort((a, b) => a.deadline - b.deadline);
                const proj = approachingProjects[0];
                const daysLeft = Math.ceil((proj.deadline - now) / (1000 * 60 * 60 * 24));
                let extraText = "";
                if (approachingProjects.length > 1) {
                    extraText = `<div style="position: absolute; right: 20px; top: 20px; font-size: 0.85rem; color: var(--color-danger); font-weight: 600;">+${approachingProjects.length - 1} tane daha</div>`;
                }
                if(statAppr) {
                    statAppr.innerHTML = `<div style="font-size: 1.5rem; line-height: 1.2;">${proj.title}</div><div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;">%${Math.round(proj.progress)} &bull; ${daysLeft} gün kaldı</div>${extraText}`;
                    statAppr.style.fontSize = "1.5rem";
                }
            }
            
            const statOverdue = document.getElementById("stat-overdue-projects");
            const cardOverdue = document.getElementById("stat-card-overdue");
            if (overdueProjects.length === 0) {
                if(statOverdue) statOverdue.innerHTML = "Geciken Proje Yok";
                if(statOverdue) statOverdue.style.fontSize = "1.2rem";
                if(cardOverdue) cardOverdue.classList.remove("stat-error");
                if(cardOverdue) cardOverdue.classList.add("stat-success");
            } else {
                if(cardOverdue) cardOverdue.classList.add("stat-error");
                if(cardOverdue) cardOverdue.classList.remove("stat-success");
                overdueProjects.sort((a, b) => a.deadline - b.deadline);
                const proj = overdueProjects[0];
                const daysOverdue = Math.floor((now - proj.deadline) / (1000 * 60 * 60 * 24));
                let extraText = "";
                if (overdueProjects.length > 1) {
                    extraText = `<div style="position: absolute; right: 20px; top: 20px; font-size: 0.85rem; color: var(--color-danger); font-weight: 600;">+${overdueProjects.length - 1} tane daha</div>`;
                }
                if(statOverdue) {
                    statOverdue.innerHTML = `<div style="font-size: 1.5rem; line-height: 1.2;">${proj.title}</div><div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;">%${Math.round(proj.progress)} &bull; ${daysOverdue} gün gecikti</div>${extraText}`;
                    statOverdue.style.fontSize = "1.5rem";
                }
            }
        } catch(e) {
            console.error("Stats calculation failed", e);
        }

        renderWsProjects();

        // Switch View
        document.getElementById("home-view").style.display = "none";
        const calView = document.getElementById("calendar-view");
        if (calView) calView.style.display = "none";
        if(document.getElementById("files-view")) document.getElementById("files-view").style.display = "none";
        document.getElementById("workspaces-dashboard-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("workspace-projects-view").style.display = "block";
        if(document.getElementById("deleted-view")) document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        
        updateBreadcrumb(activeTeamName, data.name, null);
        
        // Ensure sidebar is updated visually if needed
        document.querySelectorAll('.activity-bar-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('rail-btn-workspaces').classList.add('active');

    } catch (err) {
        console.error(err);
        showToast("Çalışma alanı yüklenirken hata oluştu.", "danger");
    }
}

function setWsProjectViewMode(mode) {
    currentWsProjectViewMode = mode;
    document.getElementById("ws-btn-view-grid").classList.remove("active");
    document.getElementById("ws-btn-view-list").classList.remove("active");
    document.getElementById("ws-btn-view-compact").classList.remove("active");
    
    if (mode === 'grid') document.getElementById("ws-btn-view-grid").classList.add("active");
    if (mode === 'list') document.getElementById("ws-btn-view-list").classList.add("active");
    if (mode === 'compact') document.getElementById("ws-btn-view-compact").classList.add("active");
    
    renderWsProjects();
}

function renderWsProjects() {
    const grid = document.getElementById("ws-projects-grid");
    const searchQuery = (document.getElementById("ws-project-search")?.value || "").toLowerCase();
    const sortStatus = document.getElementById("ws-grid-sort-status")?.value || "none";
    const filterStatus = document.getElementById("ws-grid-filter-status")?.value || "all";
    const btnClear = document.getElementById("ws-btn-clear-filters");

    if (btnClear) {
        btnClear.disabled = (searchQuery === "" && filterStatus === "all" && sortStatus === "none");
    }
    
    let filtered = [...loadedWorkspaceProjects];

    // Filter by status
    if (filterStatus === 'active') {
        filtered = filtered.filter(p => Math.round(p.progress || 0) < 100);
    } else if (filterStatus === 'completed') {
        filtered = filtered.filter(p => Math.round(p.progress || 0) === 100);
    } else if (filterStatus === 'approaching') {
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        const now = new Date();
        filtered = filtered.filter(p => {
            if (Math.round(p.progress || 0) === 100 || !p.deadline) return false;
            const deadlineDate = new Date(p.deadline);
            return deadlineDate >= now && deadlineDate <= oneWeekFromNow;
        });
    } else if (filterStatus === 'overdue') {
        const now = new Date();
        filtered = filtered.filter(p => {
            if (Math.round(p.progress || 0) === 100 || !p.deadline) return false;
            const deadlineDate = new Date(p.deadline);
            return deadlineDate < now;
        });
    }

    // Filter by search query
    if (searchQuery) {
        filtered = filtered.filter(p => 
            (p.title && p.title.toLowerCase().includes(searchQuery)) ||
            (p.description && p.description.toLowerCase().includes(searchQuery))
        );
    }

    // Sort
    if (sortStatus === 'none') {
        filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || a.id - b.id);
    } else {
        filtered.sort((a, b) => {
            if (sortStatus === 'closest-deadline') {
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            } else if (sortStatus === 'farthest-deadline') {
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(b.deadline) - new Date(a.deadline);
            } else if (sortStatus === 'highest-completion') {
                return (b.progress || 0) - (a.progress || 0);
            } else if (sortStatus === 'lowest-completion') {
                return (a.progress || 0) - (b.progress || 0);
            }
            return 0;
        });
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                <p style="color: var(--text-secondary); margin-bottom: 0;">Bu çalışma alanında henüz proje yok veya aramaya uygun sonuç bulunamadı.</p>
            </div>
        `;
        return;
    }
    
    if (currentWsProjectViewMode === 'grid') {
        grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";
        grid.style.gap = "24px";
    } else if (currentWsProjectViewMode === 'compact') {
        grid.style.gridTemplateColumns = "repeat(auto-fill, 250px)";
        grid.style.gap = "16px";
    } else {
        grid.style.gridTemplateColumns = "1fr";
        grid.style.gap = "12px";
    }
    
    grid.innerHTML = filtered.map(p => {
        const roundProgress = Math.round(p.progress || 0);
        
        if (currentWsProjectViewMode === 'list') {
            return `
                <div class="tm-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; border-radius: var(--radius-md); gap: 16px; margin: 0;" onclick="loadProjectWorkspace(${p.id})">
                    <div style="display: flex; align-items: center; gap: 16px; flex: 2; min-width: 0;">
                        <i class="bi bi-folder2 text-primary"></i>
                        <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.title)}</div>
                    </div>
                    
                    <div style="flex: 4; padding: 0 24px; color: var(--text-secondary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
                        ${escapeHtml(p.description || 'Açıklama yok')}
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

        if (currentWsProjectViewMode === 'compact') {
            return `
                <div class="tm-card" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0;" onclick="loadProjectWorkspace(${p.id})">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                        <i class="bi bi-folder2 text-primary"></i>
                        <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(p.title)}</div>
                    </div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: ${getSmoothProgressColor(roundProgress)}; flex-shrink: 0;">%${roundProgress}</div>
                </div>
            `;
        }

        return `
            <div class="tm-card" onclick="loadProjectWorkspace(${p.id})" style="cursor: pointer;">
                <div class="tm-card-title" style="display: flex; align-items: center; gap: 8px;">
                    <i class="bi bi-folder2 text-primary"></i> ${escapeHtml(p.title)}
                </div>
                <div class="tm-card-desc" style="min-height: 40px;">${escapeHtml(truncateString(p.description || 'Açıklama yok', 100))}</div>
                
                <div class="progress-container" style="margin-top: 16px;">
                    <div class="progress-header">
                        <span>Proje İlerlemesi</span>
                        <span style="color: ${getSmoothProgressColor(roundProgress)};">%${roundProgress}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${roundProgress}%; background-color: ${getSmoothProgressColor(roundProgress)};"></div>
                    </div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 12px;">
                    <span>${p.mainGoalsCount || 0} Ana Hedef</span>
                </div>
            </div>
        `;
    }).join("");
}

document.addEventListener('DOMContentLoaded', () => {
    // Arama ve Filtre dinleyicileri
    document.getElementById("ws-project-search")?.addEventListener("input", renderWsProjects);
    document.getElementById("ws-grid-sort-status")?.addEventListener("change", renderWsProjects);
    document.getElementById("ws-grid-filter-status")?.addEventListener("change", renderWsProjects);
    
    document.getElementById("ws-btn-clear-filters")?.addEventListener("click", () => {
        const searchInput = document.getElementById("ws-project-search");
        const sortSelect = document.getElementById("ws-grid-sort-status");
        const filterSelect = document.getElementById("ws-grid-filter-status");
        
        if(searchInput) searchInput.value = "";
        if(sortSelect) sortSelect.value = "none";
        if(filterSelect) filterSelect.value = "all";
        
        renderWsProjects();
    });

    // Populate team checkboxes for Create Workspace modal
    async function loadWorkspaceTeamsCheckboxes() {
        const container = document.getElementById('workspace-teams-container');
        if (!container) return;
        try {
            const res = await fetch('/api/TeamGroupApi');
            if (!res.ok) throw new Error();
            const teams = await res.json();
            if (teams.length === 0) {
                container.innerHTML = '<span class="text-muted" style="font-size: 0.85rem;">Mevcut bir takımınız bulunmuyor.</span>';
                return;
            }
            let html = '';
            teams.forEach(t => {
                html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px; cursor: pointer;">
                            <input type="checkbox" name="teamIds" value="${t.id}"> 
                            <span style="font-size: 0.9rem;">${t.name}</span>
                         </label>`;
            });
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<span class="text-danger" style="font-size: 0.85rem;">Takımlar yüklenemedi.</span>';
        }
    }
    
    // Call on load
    loadWorkspaceTeamsCheckboxes();

    const form = document.getElementById('create-workspace-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('workspace-name').value;
            const description = document.getElementById('workspace-description').value;
            const selectedTeamIds = Array.from(document.querySelectorAll('input[name="teamIds"]:checked')).map(cb => parseInt(cb.value));

            try {
                const payload = { 
                    name, 
                    description,
                    teamIds: selectedTeamIds.length > 0 ? selectedTeamIds : null
                };

                // Backward compatibility (we can send activeTeamId if needed, but TeamIds is primary now)
                if (typeof activeTeamId !== 'undefined' && activeTeamId && selectedTeamIds.length === 0) {
                    payload.teamGroupId = activeTeamId;
                }

                const res = await fetch(window.WORKSPACE_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || "Çalışma alanı oluşturulamadı.");
                }

                closeModal('create-workspace-modal');
                showToast('Çalışma alanı başarıyla oluşturuldu.', 'success');
                form.reset();
                if (typeof triggerGlobalRefresh === "function") {
                    await triggerGlobalRefresh();
                }
                loadWorkspacesSidebar(); // Refresh the list
            } catch (err) {
                console.error(err);
                showToast(err.message, 'danger');
            }
        });
    }
});

window.deleteWorkspace = async function(id) {
    if (!confirm("Bu çalışma alanını ve içindeki tüm projeleri, hedefleri ve görevleri silmek istediğinize emin misiniz? (Daha sonra Çöp Kutusundan geri getirebilirsiniz)")) return;

    try {
        const res = await fetch(`${window.WORKSPACE_API}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Silme başarısız.");
        showToast("Çalışma alanı çöp kutusuna taşındı.", "success");
        
        // Refresh views
        if (typeof triggerGlobalRefresh === "function") {
            await triggerGlobalRefresh();
        } else {
            if (typeof loadHomeStatsAndGrid === "function") loadHomeStatsAndGrid();
            if (typeof loadWorkspacesSidebar === "function") loadWorkspacesSidebar();
        }
        
        // If we are currently inside this workspace, go back
        if (typeof activeWorkspaceId !== "undefined" && activeWorkspaceId === id) {
            navigateBack();
        }
    } catch (err) {
        console.error(err);
        showToast("Çalışma alanı silinirken bir hata oluştu.", "danger");
    }
};

window.restoreWorkspace = async function(id) {
    try {
        const res = await fetch(`${window.WORKSPACE_API}/${id}/restore`, { method: "POST" });
        if (!res.ok) throw new Error("Geri getirme başarısız.");
        showToast("Çalışma alanı ve içindeki ögeler başarıyla geri getirildi.", "success");
        
        if (typeof showDeletedView === "function") showDeletedView(); 
        if (typeof triggerGlobalRefresh === "function") {
            await triggerGlobalRefresh();
        } else {
            if (typeof loadHomeStatsAndGrid === "function") loadHomeStatsAndGrid();
            if (typeof loadWorkspacesSidebar === "function") loadWorkspacesSidebar();
        }
    } catch (err) {
        console.error(err);
        showToast("Çalışma alanı geri getirilirken bir hata oluştu.", "danger");
    }
};

// Workspace Settings Modal Logic
window.openWorkspaceSettingsModal = function() {
    if (!activeWorkspaceId) return;
    openModal('workspace-settings-modal');
    loadWorkspaceSettingsData();
};

window.switchWsSettingsTab = function(tab) {
    document.querySelectorAll('.ws-settings-tab').forEach(el => {
        el.classList.remove('active');
        el.style.borderBottomColor = 'transparent';
        el.style.color = 'var(--text-secondary)';
    });
    const activeTabBtn = document.getElementById('tab-btn-' + tab);
    if (activeTabBtn) {
        activeTabBtn.classList.add('active');
        activeTabBtn.style.borderBottomColor = 'var(--primary-color)';
        activeTabBtn.style.color = 'var(--primary-color)';
    }

    document.getElementById('ws-settings-members').style.display = tab === 'members' ? 'block' : 'none';
    document.getElementById('ws-settings-teams').style.display = tab === 'teams' ? 'block' : 'none';
};

window.loadWorkspaceSettingsData = async function() {
    if (!activeWorkspaceId) return;
    
    // Load Members
    try {
        const res = await fetch(`${window.WORKSPACE_API}/${activeWorkspaceId}/members`);
        if (res.ok) {
            const members = await res.json();
            const list = document.getElementById('ws-members-list');
            list.innerHTML = '';
            if (members.length === 0) {
                list.innerHTML = '<div class="text-muted" style="padding: 10px 0; font-size: 0.9rem;">Hiç üye bulunamadı.</div>';
            } else {
                members.forEach(m => {
                    const badge = m.source === 'Direct' ? 
                        '<span class="badge" style="background: var(--bg-hover); color: var(--text-primary); font-size: 0.75rem;">Direkt Üye</span>' : 
                        `<span class="badge" style="background: var(--primary-color); color: white; font-size: 0.75rem;"><i class="bi bi-people"></i> Takım Üyesi (${m.teamName})</span>`;
                    
                    const deleteBtn = m.source === 'Direct' ? 
                        `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="removeWorkspaceMember(${m.userId})" title="Çıkar"><i class="bi bi-trash"></i></button>` : '';
                        
                    list.innerHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                    ${m.name ? m.name.charAt(0) : '?'}
                                </div>
                                <div>
                                    <div style="font-weight: 500; font-size: 0.95rem;">${m.name} ${m.surname} <span style="font-size: 0.8rem; color: var(--text-secondary);">@${m.username}</span></div>
                                    <div style="margin-top: 4px;">${badge}</div>
                                </div>
                            </div>
                            <div>${deleteBtn}</div>
                        </div>
                    `;
                });
            }
        }
    } catch (e) { console.error(e); }

    // Load Teams
    try {
        const wsRes = await fetch(`${window.WORKSPACE_API}/${activeWorkspaceId}`);
        if (wsRes.ok) {
            const wsData = await wsRes.json();
            const list = document.getElementById('ws-teams-list');
            list.innerHTML = '';
            
            const linkedTeamIds = wsData.teams ? wsData.teams.map(t => t.teamGroupId) : [];
            
            if (linkedTeamIds.length === 0) {
                list.innerHTML = '<div class="text-muted" style="padding: 10px 0; font-size: 0.9rem;">Bağlı takım bulunmuyor.</div>';
            } else {
                wsData.teams.forEach(t => {
                    list.innerHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
                            <div style="font-weight: 500;"><i class="bi bi-people" style="margin-right: 8px;"></i> ${t.teamGroupName}</div>
                            <button class="btn btn-icon btn-danger-soft btn-sm" onclick="removeWorkspaceTeam(${t.teamGroupId})" title="Bağlantıyı Kaldır"><i class="bi bi-trash"></i></button>
                        </div>
                    `;
                });
            }

            const allTeamsRes = await fetch('/api/TeamGroupApi');
            if (allTeamsRes.ok) {
                const allTeams = await allTeamsRes.json();
                const select = document.getElementById('ws-add-team-select');
                select.innerHTML = '<option value="">Takım Seçin...</option>';
                allTeams.forEach(t => {
                    if (!linkedTeamIds.includes(t.id)) {
                        select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
                    }
                });
            }
        }
    } catch (e) { console.error(e); }
};

window.addWorkspaceMember = async function() {
    if (!activeWorkspaceId) return;
    const usernameInput = document.getElementById('ws-add-member-username');
    const username = usernameInput.value.trim();
    if (!username) return;

    try {
        const res = await fetch(`${window.WORKSPACE_API}/${activeWorkspaceId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Üye eklenemedi.');
        }
        showToast("Üye başarıyla eklendi.", "success");
        usernameInput.value = '';
        loadWorkspaceSettingsData();
    } catch (e) {
        showToast(e.message, "danger");
    }
};

window.removeWorkspaceMember = async function(userId) {
    if (!activeWorkspaceId) return;
    if (!confirm("Bu üyeyi çalışma alanından çıkarmak istediğinize emin misiniz?")) return;

    try {
        const res = await fetch(`${window.WORKSPACE_API}/${activeWorkspaceId}/members/${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast("Üye çıkarıldı.", "success");
        loadWorkspaceSettingsData();
    } catch (e) {
        showToast("Üye çıkarılırken hata oluştu.", "danger");
    }
};

window.addWorkspaceTeam = async function() {
    if (!activeWorkspaceId) return;
    const teamId = document.getElementById('ws-add-team-select').value;
    if (!teamId) return;

    try {
        const res = await fetch(`${window.WORKSPACE_API}/${activeWorkspaceId}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId: parseInt(teamId) })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Takım bağlanamadı.');
        }
        showToast("Takım başarıyla bağlandı.", "success");
        loadWorkspaceSettingsData();
        if (typeof triggerGlobalRefresh === "function") triggerGlobalRefresh();
    } catch (e) {
        showToast(e.message, "danger");
    }
};

window.removeWorkspaceTeam = async function(teamId) {
    if (!activeWorkspaceId) return;
    if (!confirm("Bu takımın çalışma alanı ile bağlantısını kesmek istediğinize emin misiniz?")) return;

    try {
        const res = await fetch(`${window.WORKSPACE_API}/${activeWorkspaceId}/teams/${teamId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast("Takım bağlantısı kesildi.", "success");
        loadWorkspaceSettingsData();
        if (typeof triggerGlobalRefresh === "function") triggerGlobalRefresh();
    } catch (e) {
        showToast("Takım bağlantısı kesilirken hata oluştu.", "danger");
    }
};

