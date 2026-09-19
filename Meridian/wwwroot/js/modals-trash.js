async function showDeletedView() {
    activeProjectId = null;
    activeTeamId = null;

    updateBreadcrumb(null, "Çöp Kutusu", null);

    document.getElementById("home-view").style.display = "none";
    const calView = document.getElementById("calendar-view");
    if (calView) calView.style.display = "none";
    if(document.getElementById("files-view")) document.getElementById("files-view").style.display = "none";
    const wdView = document.getElementById("workspaces-dashboard-view");
    if (wdView) wdView.style.display = "none";
    document.getElementById("workspace-view").style.display = "none";
    document.getElementById("deleted-view").style.display = "block";
    if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
    document.getElementById("activities-view").style.display = "none";
    document.getElementById("teams-dashboard-view").style.display = "none";
    if(document.getElementById("chat-dashboard-view")) document.getElementById("chat-dashboard-view").style.display = "none";
    updateRailActive('rail-btn-trash');
    collapseSidebar();

    await loadDeletedWorkspaces();
    await loadDeletedProjects();
}

function createWorkspaceTrashToolbar() {
    let tb = document.getElementById('workspace-trash-bulk-toolbar');
    if (tb) return tb;
    
    // Proje toolbar'ının hemen sonrasına ekle
    const projectsToolbar = document.getElementById('trash-bulk-toolbar');
    if (!projectsToolbar || !projectsToolbar.parentNode) return null;
    
    tb = document.createElement('div');
    tb.id = 'workspace-trash-bulk-toolbar';
    tb.style.display = 'none';
    tb.style.justifyContent = 'space-between';
    tb.style.alignItems = 'center';
    tb.style.backgroundColor = 'var(--bg-surface-elevated)';
    tb.style.padding = '12px 20px';
    tb.style.borderRadius = 'var(--radius-md)';
    tb.style.marginBottom = '20px';
    tb.style.border = '1px solid var(--border-color)';
    tb.style.flexWrap = 'wrap';
    tb.style.gap = '12px';
    
    tb.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <input type="checkbox" id="select-all-deleted-workspaces" onchange="toggleSelectAllDeletedWorkspaces(this)" style="width: 18px; height: 18px; cursor: pointer;" />
            <label for="select-all-deleted-workspaces" style="font-size: 0.9rem; font-weight: 500; cursor: pointer; user-select: none; color: var(--text-primary);">Tümünü Seç</label>
            <span id="selected-workspaces-count" style="font-size: 0.85rem; color: var(--text-muted); margin-left: 12px; display: none;">0 çalışma alanı seçildi</span>
        </div>
        <div style="display: flex; gap: 8px;">
            <button class="tm-btn tm-btn-success" id="btn-workspace-bulk-restore" onclick="bulkRestoreSelectedWorkspaces()" style="display: none; padding: 6px 14px; font-size: 0.85rem;">Seçilenleri Geri Yükle</button>
            <button class="tm-btn tm-btn-danger" id="btn-workspace-bulk-delete" onclick="bulkDeleteSelectedWorkspaces()" style="display: none; padding: 6px 14px; font-size: 0.85rem;">Seçilenleri Kalıcı Sil</button>

            <button class="tm-btn tm-btn-success" id="btn-workspace-all-restore" onclick="restoreAllDeletedWorkspaces()" style="padding: 6px 14px; font-size: 0.85rem;">Tümünü Geri Yükle</button>
            <button class="tm-btn tm-btn-danger" id="btn-workspace-all-delete" onclick="deleteAllDeletedWorkspaces()" style="padding: 6px 14px; font-size: 0.85rem;">Tümünü Kalıcı Sil</button>
        </div>
    `;
    
    projectsToolbar.parentNode.insertBefore(tb, projectsToolbar.nextSibling);
    return tb;
}

async function loadDeletedWorkspaces() {
    try {
        const res = await fetch(`${window.WORKSPACE_API}/deleted`);
        if (!res.ok) throw new Error();
        const workspaces = await res.json();

        const grid = document.getElementById("deleted-workspaces-grid");
        const toolbar = createWorkspaceTrashToolbar();
        
        const master = document.getElementById("select-all-deleted-workspaces");
        if (master) master.checked = false;

        if (workspaces.length === 0) {
            if (toolbar && currentWorkspaceTabInTrash === 'workspaces') toolbar.style.display = "none";
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Silinmiş bir çalışma alanı bulunmuyor.</p>
                </div>
            `;
            return;
        }

        if (toolbar && currentWorkspaceTabInTrash === 'workspaces') toolbar.style.display = "flex";

        grid.innerHTML = workspaces.map(w => {
            const deletedDate = new Date(w.deletedAt).toLocaleDateString("tr-TR");
            return `
                <div class="tm-card" style="cursor: default; position: relative;">
                    <div style="position: absolute; top: 16px; right: 16px; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="workspace-trash-checkbox" data-workspace-id="${w.id}" onchange="updateWorkspaceTrashSelection()" style="width: 18px; height: 18px; cursor: pointer;" />
                    </div>
                    <div class="tm-card-title" style="padding-right: 32px;">${escapeHtml(w.name)}</div>
                    <div class="tm-card-desc">${escapeHtml(w.description || '')}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 16px;">
                        Silinme Tarihi: ${deletedDate}
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 20px;">
                        <button class="tm-btn tm-btn-success" style="flex: 1; padding: 6px 12px; font-size: 0.85rem;" onclick="restoreWorkspace(${w.id})">Geri Yükle</button>
                        <button class="tm-btn tm-btn-danger" style="flex: 1; padding: 6px 12px; font-size: 0.85rem;" onclick="permanentlyDeleteWorkspace(${w.id})">Kalıcı Sil</button>
                    </div>
                </div>
            `;
        }).join("");
        
        updateWorkspaceTrashSelection();
    } catch (err) {
        console.error(err);
        const grid = document.getElementById("deleted-workspaces-grid");
        if (grid) grid.innerHTML = `<div style="color:var(--color-danger); padding:10px;">Çalışma alanları yüklenemedi.</div>`;
    }
}

function toggleSelectAllDeletedWorkspaces(masterCheckbox) {
    const checkboxes = document.querySelectorAll(".workspace-trash-checkbox");
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
    });
    updateWorkspaceTrashSelection();
}

function updateWorkspaceTrashSelection() {
    const checkboxes = document.querySelectorAll(".workspace-trash-checkbox");
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const totalCount = checkboxes.length;

    const master = document.getElementById("select-all-deleted-workspaces");
    if (master) {
        master.checked = (checkedCount === totalCount && totalCount > 0);
        master.indeterminate = (checkedCount > 0 && checkedCount < totalCount);
    }

    const selectedCountText = document.getElementById("selected-workspaces-count");
    const bulkRestoreBtn = document.getElementById("btn-workspace-bulk-restore");
    const bulkDeleteBtn = document.getElementById("btn-workspace-bulk-delete");
    const allRestoreBtn = document.getElementById("btn-workspace-all-restore");
    const allDeleteBtn = document.getElementById("btn-workspace-all-delete");

    if (selectedCountText) {
        if (checkedCount > 0) {
            selectedCountText.innerText = `${checkedCount} çalışma alanı seçildi`;
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

function getSelectedTrashWorkspaceIds() {
    const checkboxes = document.querySelectorAll(".workspace-trash-checkbox");
    return Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.getAttribute("data-workspace-id")));
}

async function bulkRestoreSelectedWorkspaces() {
    const ids = getSelectedTrashWorkspaceIds();
    if (ids.length === 0) return;

    try {
        await Promise.all(ids.map(id => 
            fetch(`${window.WORKSPACE_API}/${id}/restore`, { method: 'POST' })
        ));

        showToast("Seçilen çalışma alanları başarıyla geri yüklendi.");
        await loadDeletedWorkspaces();
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Çalışma alanları geri yüklenirken hata oluştu.", "danger");
    }
}

async function bulkDeleteSelectedWorkspaces() {
    const ids = getSelectedTrashWorkspaceIds();
    if (ids.length === 0) return;

    if (!confirm(`${ids.length} çalışma alanını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) {
        return;
    }

    try {
        await Promise.all(ids.map(id => 
            fetch(`${window.WORKSPACE_API}/${id}/permanent`, { method: 'DELETE' })
        ));

        showToast("Seçilen çalışma alanları kalıcı olarak silindi.");
        await loadDeletedWorkspaces();
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Çalışma alanları kalıcı silinirken hata oluştu.", "danger");
    }
}

async function restoreAllDeletedWorkspaces() {
    if (!confirm("Tüm silinmiş çalışma alanlarını geri yüklemek istediğinizden emin misiniz?")) {
        return;
    }

    try {
        const checkboxes = document.querySelectorAll(".workspace-trash-checkbox");
        const allIds = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute("data-workspace-id")));
        
        await Promise.all(allIds.map(id => 
            fetch(`${window.WORKSPACE_API}/${id}/restore`, { method: 'POST' })
        ));

        showToast("Tüm çalışma alanları başarıyla geri yüklendi.");
        await loadDeletedWorkspaces();
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Çalışma alanları geri yüklenirken hata oluştu.", "danger");
    }
}

async function deleteAllDeletedWorkspaces() {
    if (!confirm("Tüm silinmiş çalışma alanlarını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
        return;
    }

    try {
        const checkboxes = document.querySelectorAll(".workspace-trash-checkbox");
        const allIds = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute("data-workspace-id")));
        
        await Promise.all(allIds.map(id => 
            fetch(`${window.WORKSPACE_API}/${id}/permanent`, { method: 'DELETE' })
        ));

        showToast("Tüm çalışma alanları kalıcı olarak silindi.");
        await loadDeletedWorkspaces();
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Çalışma alanları kalıcı silinirken hata oluştu.", "danger");
    }
}


window.permanentlyDeleteWorkspace = async function(id) {
    if (!confirm("Bu çalışma alanını ve içindeki her şeyi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
        return;
    }

    try {
        const res = await fetch(`${window.WORKSPACE_API}/${id}/permanent`, { method: 'DELETE' });
        if (!res.ok) throw new Error();

        showToast("Çalışma alanı kalıcı olarak silindi.");
        await loadDeletedWorkspaces();
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Silme işlemi gerçekleştirilirken hata oluştu.", "danger");
    }
};

window.restoreWorkspace = async function(id) {
    try {
        const res = await fetch(`${window.WORKSPACE_API}/${id}/restore`, { method: 'POST' });
        if (!res.ok) throw new Error();

        showToast("Çalışma alanı geri yüklendi.");
        await loadDeletedWorkspaces();
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Geri yükleme işlemi sırasında hata oluştu.", "danger");
    }
};

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
            if (toolbar && currentWorkspaceTabInTrash === 'projects') toolbar.style.display = "none";
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Silinmiş bir proje bulunmuyor.</p>
                </div>
            `;
            return;
        }

        if (toolbar && currentWorkspaceTabInTrash === 'projects') toolbar.style.display = "flex";

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
    const tabs = ['active', 'deleted', 'activities'];
    
    tabs.forEach(t => {
        const btn = document.getElementById('tab-' + t + (t === 'active' ? '-goals' : (t === 'deleted' ? '-goals' : '')));
        const content = document.getElementById(t + '-tab-content');
        if (!btn || !content) return;
        
        if (t === tab) {
            btn.style.color = 'var(--text-primary)';
            btn.style.borderBottomColor = 'var(--color-primary)';
            btn.style.fontWeight = '600';
            content.style.display = 'block';
            
            if (t === 'deleted') loadDeletedProjectItems();
            if (t === 'activities' && typeof loadProjectActivities === 'function') loadProjectActivities();
        } else {
            btn.style.color = 'var(--text-secondary)';
            btn.style.borderBottomColor = 'transparent';
            btn.style.fontWeight = '500';
            content.style.display = 'none';
        }
    });
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


let currentWorkspaceTabInTrash = 'projects';

window.switchTrashTab = function(type) {
    currentWorkspaceTabInTrash = type;
    const tabs = ['projects', 'workspaces'];
    
    // Yüklenmiş olup olmadığını kontrol edip toolbarı oluştur
    createWorkspaceTrashToolbar();
    
    tabs.forEach(t => {
        const btn = document.getElementById('tab-trash-' + t);
        const content = document.getElementById('trash-' + t + '-tab-content');
        if(!btn || !content) return;
        
        if (t === type) {
            btn.style.color = 'var(--text-primary)';
            btn.style.borderBottomColor = 'var(--color-primary)';
            btn.style.fontWeight = '600';
            btn.classList.add('active-tab');
            content.style.display = 'block';
        } else {
            btn.style.color = 'var(--text-secondary)';
            btn.style.borderBottomColor = 'transparent';
            btn.style.fontWeight = '500';
            btn.classList.remove('active-tab');
            content.style.display = 'none';
        }
    });

    const projectToolbar = document.getElementById('trash-bulk-toolbar');
    const workspaceToolbar = document.getElementById('workspace-trash-bulk-toolbar');
    
    if (type === 'workspaces') {
        if (projectToolbar) projectToolbar.style.display = 'none';
        // Hide workspace toolbar if no workspaces exist, handled in update selection
        const worksapcesGrid = document.getElementById('deleted-workspaces-grid');
        if (workspaceToolbar && worksapcesGrid && worksapcesGrid.querySelectorAll('.tm-card').length > 0) {
            workspaceToolbar.style.display = 'flex';
        } else if (workspaceToolbar) {
            workspaceToolbar.style.display = 'none';
        }
    } else {
        if (workspaceToolbar) workspaceToolbar.style.display = 'none';
        // Same logic for projects
        const projectsGrid = document.getElementById('deleted-projects-grid');
        if (projectToolbar && projectsGrid && projectsGrid.querySelectorAll('.tm-card').length > 0) {
            projectToolbar.style.display = 'flex';
        } else if (projectToolbar) {
            projectToolbar.style.display = 'none';
        }
    }
};