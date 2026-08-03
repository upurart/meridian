async function loadWorkspacesSidebar() {
    const listContainer = document.getElementById('workspaces-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Yükleniyor...</div>';

    try {
        const res = await fetch('/api/WorkspaceApi');
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
        const res = await fetch(`/api/WorkspaceApi/${workspaceId}`);
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
        renderWsProjects();

        // Switch View
        document.getElementById("home-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("workspace-projects-view").style.display = "block";
        
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

    const form = document.getElementById('create-workspace-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('workspace-name').value;
            const description = document.getElementById('workspace-description').value;

            try {
                const payload = { name, description };
                if (typeof activeTeamId !== 'undefined' && activeTeamId) {
                    payload.teamGroupId = activeTeamId;
                }

                const res = await fetch('/api/WorkspaceApi', {
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
        const res = await fetch(`/api/WorkspaceApi/${id}`, { method: "DELETE" });
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
        const res = await fetch(`/api/WorkspaceApi/${id}/restore`, { method: "POST" });
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
