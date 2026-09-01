let currentActivityPage = 1;

async function loadProjectActivities(page = 1) {
    if (!activeProjectId) return;
    
    const container = document.getElementById("project-activities-list");
    if (!container) return;
    
    container.innerHTML = `<div style="text-align: center; padding: 32px; color: var(--text-muted);">Loglar yükleniyor...</div>`;

    try {
        currentActivityPage = page;
        const res = await fetch(`/api/dashboard/activities/${activeProjectId}?page=${page}`);
        if (!res.ok) throw new Error();

        const data = await res.json();
        const items = data.items || [];

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 32px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Bu sayfada/projede henüz kaydedilmiş bir eylem bulunmuyor.</p>
                </div>
            `;
            return;
        }

        let html = "";
        
        items.forEach((log, index) => {
            let icon = '<i class="bi bi-file-earmark-text" style="color: #64748b;"></i>';
            let iconBg = "rgba(100, 116, 139, 0.2)"; // Gri

            if(log.action === "Oluşturuldu") { icon = '<i class="bi bi-stars" style="color: #10b981;"></i>'; iconBg = "rgba(16, 185, 129, 0.2)"; } // Yeşil
            if(log.action === "Silindi" || log.action === "Kalıcı Olarak Silindi") { icon = '<i class="bi bi-trash3" style="color: #ef4444;"></i>'; iconBg = "rgba(239, 68, 68, 0.2)"; } // Kırmızı
            if(log.action === "Güncellendi") { icon = '<i class="bi bi-pencil-square" style="color: #3b82f6;"></i>'; iconBg = "rgba(59, 130, 246, 0.2)"; } // Mavi

            const timeString = new Date(log.date).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
            const dateString = new Date(log.date).toLocaleDateString("tr-TR");
            
            let entityName = "Görev/Öge";
            if (log.entity === 'Project') entityName = "Proje";
            else if (log.entity === 'MainGoal') entityName = "Ana Hedef";
            else if (log.entity === 'SubGoal') entityName = "Alt Hedef";
            else if (log.entity === 'Task') entityName = "Görev";
            
            html += `
                <div style="display: flex; gap: 12px; align-items: flex-start; padding: 6px 0;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${iconBg}; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; margin-top: 2px;">
                        ${icon}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">
                                    ${entityName} ${escapeHtml(log.action)}
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4; margin-top: 2px;">
                                    ${escapeHtml(log.details)}
                                </div>
                            </div>
                            <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end;">
                                <div style="font-size: 0.8rem; color: var(--color-primary); font-weight: 500; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                                    <i class="bi bi-person"></i> ${escapeHtml(log.authorName || 'Bilinmeyen Kullanıcı')}
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${dateString} ${timeString}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Pagination controls
        if (data.totalPages > 1) {
            html += `<div style="display: flex; justify-content: center; gap: 8px; margin-top: 24px; margin-bottom: 16px;">`;
            
            if (data.currentPage > 1) {
                html += `<button class="tm-btn tm-btn-secondary tm-btn-sm" onclick="loadProjectActivities(${data.currentPage - 1})"><i class="bi bi-chevron-left"></i> Önceki</button>`;
            }
            
            html += `<span style="display: flex; align-items: center; justify-content: center; padding: 0 12px; font-size: 0.9rem; color: var(--text-secondary); background: var(--bg-surface-elevated); border-radius: 4px;">
                        Sayfa ${data.currentPage} / ${data.totalPages}
                     </span>`;
            
            if (data.currentPage < data.totalPages) {
                html += `<button class="tm-btn tm-btn-secondary tm-btn-sm" onclick="loadProjectActivities(${data.currentPage + 1})">Sonraki <i class="bi bi-chevron-right"></i></button>`;
            }
            
            html += `</div>`;
        }

        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="text-align: center; padding: 32px; border: 1px dashed var(--border-color); border-radius: var(--radius-md); color: var(--color-danger);">Loglar yüklenirken hata oluştu.</div>`;
    }
}
