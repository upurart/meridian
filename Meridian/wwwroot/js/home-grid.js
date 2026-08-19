    function applyGridFilters() {
        if (!gridProjectsData) return;

        const btnClear = document.getElementById("btn-clear-filters");
        if (btnClear) {
            btnClear.disabled = (gridSearchQuery === "" && gridFilterStatus === "all" && gridSortStatus === "none");
        }

        let filtered = [...gridProjectsData];
        

        // 1. Arama sorgusuna göre filtrele
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
            // Workspace Card Render
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

