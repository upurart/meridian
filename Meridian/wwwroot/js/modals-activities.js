async function showActivitiesView() {
    activeProjectId = null;
    activeTeamId = null;

    updateBreadcrumb(null, "Son Aktiviteler", null);

    document.getElementById("home-view").style.display = "none";
    const calView = document.getElementById("calendar-view");
    if (calView) calView.style.display = "none";
    const wdView = document.getElementById("workspaces-dashboard-view");
    if (wdView) wdView.style.display = "none";
    document.getElementById("workspace-view").style.display = "none";
    document.getElementById("deleted-view").style.display = "none";
    if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
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
