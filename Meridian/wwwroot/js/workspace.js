    async function loadProjectWorkspace(projectId, skipRailUpdate = false) {
        activeProjectId = projectId;
        joinCommentProject(projectId);

        expandedNodes.add(`project-${projectId}`);

        expandedAccordions.clear();

        document.getElementById("home-view").style.display = "none";
        const calView = document.getElementById("calendar-view");
        if (calView) calView.style.display = "none";
        if(document.getElementById("files-view")) document.getElementById("files-view").style.display = "none";
        document.getElementById("workspaces-dashboard-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "block";
        document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        if(document.getElementById("workspace-projects-view")) document.getElementById("workspace-projects-view").style.display = "none";
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";
        if(document.getElementById("chat-dashboard-view")) document.getElementById("chat-dashboard-view").style.display = "none";

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
            
            // Set global variables from project response in case project was loaded directly via sidebar
            activeTeamName = project.teamGroupName || null;
            activeWorkspaceName = project.workspaceName || null;

            updateBreadcrumb(activeTeamName, activeWorkspaceName, project.title);

            
            activeProjectHasManageAccess = project.hasManageMembersAccess === true;
            activeProjectIsObserver = project.isObserver === true;
            
            
            
            const btnAddItem = document.getElementById("wp-add-new-item-btn");
            if (btnAddItem) btnAddItem.style.display = activeProjectIsObserver ? "none" : "inline-block";
            
            const roundedProjectProgress = Math.round(project.progress);
            

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
                loadProjectFilesSummary(project.id);
            }

        } catch (err) {
            console.error(err);
            showToast("Proje çalışma alanı yüklenirken hata oluştu.", "danger");
            showDashboardHome();
        }
    }

    window.asyncLoadItemFiles = async function(itemType, id, overrideContainerId = null) {
        const url = `/api/dashboard/${itemType}/${id}/files`;
        try {
            const res = await fetch(url);
            if(!res.ok) {
                const container = document.getElementById(overrideContainerId || `file-acc-${itemType}-${id}-list`);
                if (container) container.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Henüz dosya eklenmemiş.</span>`;
                return;
            }
            const data = await res.json();
            const container = document.getElementById(overrideContainerId || `file-acc-${itemType}-${id}-list`);
            if (!container) return;
            
            window.itemFolderIds = window.itemFolderIds || {};
            window.itemFolderIds[`${itemType}_${id}`] = data.folderId;
            
            if (!data.files || data.files.length === 0) {
                container.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Henüz dosya eklenmemiş.</span>`;
                return;
            }
            
            container.innerHTML = data.files.map(f => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                        <i class="bi bi-file-earmark" style="font-size: 1.2rem; color: var(--text-secondary);"></i>
                        <div style="display: flex; flex-direction: column; overflow: hidden;">
                            <span style="font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${f.fileName}">${f.fileName}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted);">${(f.fileSize / 1024).toFixed(1)} KB</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <a href="${f.fileUrl}" target="_blank" class="tm-btn-icon-only" style="padding: 4px; font-size: 1rem; color: var(--color-primary);"><i class="bi bi-download"></i></a>
                        ${overrideContainerId === "item-files-list" ? `<button type="button" class="tm-btn-icon-only" style="padding: 4px; font-size: 1rem; color: var(--color-danger);" onclick="deleteItemFileGlobal(${f.id}, '${itemType}', ${id})"><i class="bi bi-trash3"></i></button>` : ''}
                    </div>
                </div>
            `).join('');
        } catch(e) {}
    };

    window.openItemFilesModal = function(itemType, itemId, itemTitle) {
        document.getElementById("item-files-type").value = itemType;
        document.getElementById("item-files-id").value = itemId;
        document.getElementById("item-files-modal-title").innerHTML = `<i class="bi bi-folder2-open"></i> ${escapeHtml(itemTitle)} - Dosyaları Yönet`;
        
        window.asyncLoadItemFiles(itemType, itemId, "item-files-list");
        openModal("item-files-modal");
    };

    window.deleteItemFileGlobal = async function(fileId, itemType, itemId) {
        if (!confirm("Bu dosyayı silmek istediğinize emin misiniz?")) return;
        try {
            const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
            const res = await fetch(`/api/filemanager/file/${fileId}`, { 
                method: 'DELETE',
                headers: { 'RequestVerificationToken': token }
            });
            if (!res.ok) throw new Error();
            
            showToast("Dosya klasörden silindi.");
            
            // Refresh both modal list and the inline accordion if open
            window.asyncLoadItemFiles(itemType, itemId, "item-files-list");
            const wrap = document.getElementById(`file-acc-${itemType}-${itemId}`);
            if (wrap && wrap.style.display !== "none") {
                window.asyncLoadItemFiles(itemType, itemId);
            }
            loadProjectFilesSummary(activeProjectId);
        } catch {
            showToast("Dosya silinirken hata oluştu.", "danger");
        }
    };

    window.toggleFileAccordionOuter = function(e, itemType, itemId) {
        e.stopPropagation();
        const wrap = document.getElementById(`file-acc-${itemType}-${itemId}`);
        if (!wrap) return;
        
        window.expandedFileAccordions = window.expandedFileAccordions || new Set();
        const key = `${itemType}-${itemId}`;
        
        let parentNode = null;
        if (itemType === 'task') {
            parentNode = document.getElementById(`task-row-${itemId}`);
        } else {
            const goalCard = document.getElementById(`${itemType}-${itemId}`);
            if (goalCard) parentNode = goalCard.querySelector('.goal-card-header');
        }
        
        if(wrap.style.display === "none") {
            wrap.style.display = "block";
            window.expandedFileAccordions.add(key);
            if (parentNode) parentNode.classList.add('active-file-accordion');
            window.asyncLoadItemFiles(itemType, itemId);
        } else {
            wrap.style.display = "none";
            window.expandedFileAccordions.delete(key);
            if (parentNode) parentNode.classList.remove('active-file-accordion');
        }
    };

    async function loadProjectFilesSummary(projectId) {
        try {
            const res = await fetch(`/api/dashboard/project/${projectId}/files-summary`);
            if (!res.ok) return;
            const summaries = await res.json();
            summaries.forEach(s => {
                const ind = document.getElementById(`file-ind-${s.itemType}-${s.itemId}`);
                if (ind && s.count > 0) {
                    ind.style.display = "flex";
                    ind.innerHTML = `<i class="bi bi-paperclip"></i> ${escapeHtml(s.count > 3 ? `${s.count} Eklenmiş Dosya` : s.names)}`;
                }
            });
        } catch (e) {}
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
                `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;"><i class="bi bi-pin" style="color: var(--color-primary);"></i> Proje Görevleri</h3>`,
                projectTasks,
                'project-tasks-list-container'
            );
        }

        if (mainGoals && mainGoals.length > 0) {
            html += `
                <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: ${html ? '24px' : '0'}; display: flex; align-items: center; gap: 8px;">
                    <i class="bi bi-pin" style="color: var(--color-primary);"></i> Ana Hedefler
                </h3>
            `;
            html += mainGoals.map(mg => {
                const mgProgress = Math.round(mg.progress);
                const mgId = `maingoal-${mg.id}`;
                const isExpanded = expandedAccordions.has(mgId);
                
                window.expandedFileAccordions = window.expandedFileAccordions || new Set();
                const isFileExpanded = window.expandedFileAccordions.has(mgId);

                const hasSubGoals = mg.subGoals && mg.subGoals.length > 0;
                const hasTasks = mg.tasks && mg.tasks.length > 0;
                const showToggleCompletion = !hasSubGoals && !hasTasks;

                return `
                    <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${mgId}">
                        <div class="goal-card-header ${isFileExpanded ? 'active-file-accordion' : ''}" onclick="toggleAccordion('${mgId}')" style="display: flex; align-items: center; padding: 12px 16px; gap: 16px; user-select: none;">
                            <div style="display: flex; align-items: center; gap: 10px; width: 250px; flex-shrink: 0;">
                                <i class="bi ${mgProgress === 100 ? 'bi-clipboard-check' : 'bi-clipboard'}" style="font-size: 1.1rem; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-primary)'}; flex-shrink: 0;"></i>
                                <span style="font-weight: 600; font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;" title="${escapeHtml(mg.title)}">${escapeHtml(mg.title)}</span>
                            </div>
                            
                            <!-- Tarihler kaldırıldı -->
                            
                            <div style="flex: 1; min-width: 0;">
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(mg.description || '')}">${escapeHtml(mg.description || '')}</p>
                                <div id="file-ind-maingoal-${mg.id}" onclick="toggleFileAccordionOuter(event, 'maingoal', ${mg.id})" style="display: none; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--color-primary); background: rgba(37,99,235,0.1); width: fit-content; padding: 2px 8px; border-radius: 12px; cursor: pointer; border: 1px solid rgba(37,99,235,0.2); margin-top: 4px;"></div>
                            </div>
                            
                            <!-- Ayırıcı kaldırıldı -->
                            <div class="action-buttons-container" style="display: flex; gap: 6px; align-items: center; width: 170px; flex-shrink: 0;" onclick="event.stopPropagation()">
                                ${activeProjectIsObserver ? '' : `
                                <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Hedef / Görev Ekle" onclick="openUnifiedAddModal('task', ${mg.id})"><i class="bi bi-plus-lg"></i></button>
                                <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Düzenle" onclick="openMainGoalModal(${mg.projectId}, ${JSON.stringify(mg).replace(/"/g, '&quot;')})"><i class="bi bi-pencil-square"></i></button>
                                <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Sil" onclick="openDeleteModal('maingoal', ${mg.id})"><i class="bi bi-trash3"></i></button>
                                `}
                                ${showToggleCompletion ? `
                                    <button class="tm-btn-icon-only" style="padding: 6px; color: ${mg.isCompleted ? 'var(--color-success)' : 'var(--text-secondary)'}; ${activeProjectIsObserver ? 'opacity: 0.7; cursor: not-allowed;' : ''}" title="${mg.isCompleted ? 'Tamamlandı' : 'Tamamla'}" ${activeProjectIsObserver ? 'disabled' : `onclick="toggleMainGoalCompletion(${mg.id})"`}>
                                        ${mg.isCompleted ? '<i class="bi bi-check-circle-fill"></i>' : '<i class="bi bi-hourglass-split"></i>'}
                                    </button>
                                ` : ''}
                                <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Dosyalar" onclick="toggleFileAccordionOuter(event, 'maingoal', ${mg.id})"><i class="bi bi-paperclip"></i></button>
                            </div>
                            
                            <!-- Ayırıcı kaldırıldı -->
                            <div style="display: flex; align-items: center; gap: 10px; width: 120px; flex-shrink: 0;">
                                <div class="progress-bar-bg" style="flex: 1; height: 6px;">
                                    <div class="progress-bar-fill" style="width: ${mgProgress}%; background-color: ${getSmoothProgressColor(mgProgress)};"></div>
                                </div>
                                <span style="font-size: 0.85rem; font-weight: 600; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${mgProgress}</span>
                            </div>
                            
                            <span class="accordion-caret" style="color: var(--text-muted); margin-left: 8px;"><i class="bi bi-caret-down-fill"></i></span>
                        </div>

                        <div id="file-acc-maingoal-${mg.id}" class="inline-file-accordion" style="display: none; padding: 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-surface); margin-left: 16px; border-radius: 0 0 8px 8px; position: relative;">
                            <div style="display: flex; gap: 12px; align-items: flex-start;">
                                <div id="file-acc-maingoal-${mg.id}-list" style="flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 250px; overflow-y: auto;">
                                    <span style="font-size: 0.85rem; color: var(--text-muted);">Yükleniyor...</span>
                                </div>
                                <button class="tm-btn-icon-only" style="padding: 4px; font-size: 1.1rem; color: var(--text-secondary); background: transparent; border: none;" title="Dosyaları Yönet" onclick="openItemFilesModal('maingoal', ${mg.id}, '${escapeHtml(mg.title).replace(/'/g, "\\'")}')"><i class="bi bi-sliders"></i></button>
                            </div>
                            <div class="inline-dropzone-overlay" data-item-type="maingoal" data-item-id="${mg.id}" style="display: none; position: absolute; inset: 0; background: rgba(37, 99, 235, 0.05); border: 2px dashed var(--color-primary); border-radius: 8px; z-index: 10; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
                                <span style="font-weight: 600; color: var(--color-primary); font-size: 1.1rem; pointer-events: none;"><i class="bi bi-cloud-arrow-up"></i> Dosyaları Buraya Bırakın</span>
                            </div>
                        </div>

                        <div class="goal-card-content-wrapper">
                            <div class="goal-card-content" style="padding-top: 16px;">
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
            
            window.expandedFileAccordions = window.expandedFileAccordions || new Set();
            const isFileExpanded = window.expandedFileAccordions.has(sgId);

            return `
            <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${sgId}">
                <div class="goal-card-header ${isFileExpanded ? 'active-file-accordion' : ''}" onclick="toggleAccordion('${sgId}')" style="display: flex; align-items: center; padding: 12px 16px; gap: 16px; user-select: none;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 250px; flex-shrink: 0;">
                        <i class="bi bi-lightning-charge-fill" style="font-size: 0.95rem; color: #f59e0b; flex-shrink: 0;"></i>
                        <span style="font-weight: 500; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); flex: 1; min-width: 0;" title="${escapeHtml(sg.title)}">${escapeHtml(sg.title)}</span>
                    </div>
                    
                    <!-- Tarihler kaldırıldı -->
                    
                    <div style="flex: 1; min-width: 0;">
                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(sg.description || '')}">${escapeHtml(sg.description || '')}</p>
                        <div id="file-ind-subgoal-${sg.id}" onclick="toggleFileAccordionOuter(event, 'subgoal', ${sg.id})" style="display: none; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--color-primary); background: rgba(37,99,235,0.1); width: fit-content; padding: 2px 8px; border-radius: 12px; cursor: pointer; border: 1px solid rgba(37,99,235,0.2); margin-top: 4px;"></div>
                    </div>
                    
                    <!-- Ayırıcı kaldırıldı -->
                    <div class="action-buttons-container" style="display: flex; gap: 6px; align-items: center; width: 170px; flex-shrink: 0;" onclick="event.stopPropagation()">
                        ${activeProjectIsObserver ? '' : `
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Görev Ekle" onclick="openUnifiedAddModal('task', ${sg.mainGoalId}, ${sg.id})"><i class="bi bi-plus-lg"></i></button>
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Düzenle" onclick="openSubGoalModal(${sg.mainGoalId}, ${JSON.stringify(sg).replace(/"/g, '&quot;')})"><i class="bi bi-pencil-square"></i></button>
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Sil" onclick="openDeleteModal('subgoal', ${sg.id})"><i class="bi bi-trash3"></i></button>
                        `}
                        ${sg.tasks.length === 0 ? `
                            <button class="tm-btn-icon-only" style="padding: 6px; color: ${sg.isCompleted ? 'var(--color-success)' : 'var(--text-secondary)'}; ${activeProjectIsObserver ? 'opacity: 0.7; cursor: not-allowed;' : ''}" title="${sg.isCompleted ? 'Tamamlandı' : 'Tamamla'}" ${activeProjectIsObserver ? 'disabled' : `onclick="toggleSubGoalCompletion(${sg.id})"`}>
                                ${sg.isCompleted ? '<i class="bi bi-check-circle-fill"></i>' : '<i class="bi bi-hourglass-split"></i>'}
                            </button>
                        ` : ''}
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Dosyalar" onclick="toggleFileAccordionOuter(event, 'subgoal', ${sg.id})"><i class="bi bi-paperclip"></i></button>
                    </div>
                    <!-- Ayırıcı kaldırıldı -->
                    
                    <div style="display: flex; align-items: center; gap: 10px; width: 120px; flex-shrink: 0;">
                        <div class="progress-bar-bg" style="flex: 1; height: 6px;">
                            <div class="progress-bar-fill" style="width: ${sgProgress}%; background-color: ${getSmoothProgressColor(sgProgress)};"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 600; color: ${sgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${sgProgress}</span>
                    </div>
                    
                    <span class="accordion-caret" style="color: var(--text-muted); margin-left: 8px;"><i class="bi bi-caret-down-fill"></i></span>
                </div>

                <div id="file-acc-subgoal-${sg.id}" class="inline-file-accordion" style="display: ${isFileExpanded ? 'block' : 'none'}; padding: 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-surface); margin-left: 16px; border-radius: 0 0 8px 8px; position: relative;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <div id="file-acc-subgoal-${sg.id}-list" style="flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 250px; overflow-y: auto;">
                            <span style="font-size: 0.85rem; color: var(--text-muted);">Yükleniyor...</span>
                        </div>
                        <button class="tm-btn-icon-only" style="padding: 4px; font-size: 1.1rem; color: var(--text-secondary); background: transparent; border: none;" title="Dosyaları Yönet" onclick="openItemFilesModal('subgoal', ${sg.id}, '${escapeHtml(sg.title).replace(/'/g, "\\'")}')"><i class="bi bi-sliders"></i></button>
                    </div>
                    <div class="inline-dropzone-overlay" data-item-type="subgoal" data-item-id="${sg.id}" style="display: none; position: absolute; inset: 0; background: rgba(37, 99, 235, 0.05); border: 2px dashed var(--color-primary); border-radius: 8px; z-index: 10; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
                        <span style="font-weight: 600; color: var(--color-primary); font-size: 1.1rem; pointer-events: none;"><i class="bi bi-cloud-arrow-up"></i> Dosyaları Buraya Bırakın</span>
                    </div>
                </div>

                <div class="goal-card-content-wrapper">
                    <div class="goal-card-content subgoal-content" style="padding-top: 12px;">
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
            <div id="${containerId}" class="task-list-container ${hideCompletedClass}" style="display: flex; flex-direction: column; gap: 8px; max-height: ${maxHeightStyle}; overflow-y: auto; padding-right: 8px; padding-top: 12px; padding-bottom: 12px; transition: max-height 0.3s ease;">
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
            window.expandedFileAccordions = window.expandedFileAccordions || new Set();
            const isFileExpanded = window.expandedFileAccordions.has(`task-${t.id}`);

            return `
            <div style="display: flex; flex-direction: column; width: 100%;">
                <div class="task-item-row ${t.isCompleted ? 'completed' : ''} ${isFileExpanded ? 'active-file-accordion' : ''}" id="task-row-${t.id}" ondblclick="toggleFileAccordionOuter(event, 'task', ${t.id})" style="display: flex; align-items: center; padding: 12px 16px; gap: 16px; cursor: pointer; user-select: none;">
                    <div style="display: flex; align-items: center; gap: 10px; width: 250px; flex-shrink: 0;" onclick="event.stopPropagation()">
                        <div class="custom-checkbox ${t.isCompleted ? 'checked' : ''}" style="margin: 0; flex-shrink: 0; ${activeProjectIsObserver ? 'cursor: not-allowed; opacity: 0.7;' : ''}" ${activeProjectIsObserver ? '' : `onclick="toggleTaskCompletion(${t.id})"`}></div>
                        <span class="task-title" style="font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; cursor: default;" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>
                    </div>
                    
                    <!-- Tarihler kaldırıldı -->
                    
                    <div style="flex: 1; min-width: 0;" onclick="event.stopPropagation()">
                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default;" title="${escapeHtml(t.description || '')}">${escapeHtml(t.description || '')}</p>
                        <div id="file-ind-task-${t.id}" onclick="toggleFileAccordionOuter(event, 'task', ${t.id})" style="display: none; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--color-primary); background: rgba(37,99,235,0.1); width: fit-content; padding: 2px 8px; border-radius: 12px; cursor: pointer; border: 1px solid rgba(37,99,235,0.2); margin-top: 4px;"></div>
                    </div>
                    
                    <!-- Ayırıcı kaldırıldı -->
                    <div class="action-buttons-container" style="display: flex; gap: 6px; align-items: center; width: 170px; flex-shrink: 0;" onclick="event.stopPropagation()">
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Yorumlar" onclick="openCommentsDrawer('TaskItem', ${t.id}, '${escapeHtml(t.title).replace(/'/g, "\\'")}')"><i class="bi bi-chat-left-dots"></i></button>
                        ${activeProjectIsObserver ? '' : `
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Düzenle" onclick="openTaskModal(null, ${JSON.stringify(t).replace(/"/g, '&quot;')})"><i class="bi bi-pencil-square"></i></button>
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Sil" onclick="openDeleteModal('task', ${t.id})"><i class="bi bi-trash3"></i></button>
                        `}
                        <button class="tm-btn-icon-only" style="padding: 6px; color: var(--text-secondary);" title="Dosyalar" onclick="toggleFileAccordionOuter(event, 'task', ${t.id})"><i class="bi bi-paperclip"></i></button>
                    </div>
                    <!-- Ayırıcı kaldırıldı -->
                    
                </div>
                
                <div id="file-acc-task-${t.id}" class="inline-file-accordion" style="display: ${isFileExpanded ? 'block' : 'none'}; padding: 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-surface); margin-left: 16px; border-radius: 0 0 8px 8px; position: relative;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <div id="file-acc-task-${t.id}-list" style="flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 250px; overflow-y: auto;">
                            <span style="font-size: 0.85rem; color: var(--text-muted);">Yükleniyor...</span>
                        </div>
                        <button class="tm-btn-icon-only" style="padding: 4px; font-size: 1.1rem; color: var(--text-secondary); background: transparent; border: none;" title="Dosyaları Yönet" onclick="openItemFilesModal('task', ${t.id}, '${escapeHtml(t.title).replace(/'/g, "\\'")}')"><i class="bi bi-sliders"></i></button>
                    </div>
                    <div class="inline-dropzone-overlay" data-item-type="task" data-item-id="${t.id}" style="display: none; position: absolute; inset: 0; background: rgba(37, 99, 235, 0.05); border: 2px dashed var(--color-primary); border-radius: 8px; z-index: 10; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
                        <span style="font-weight: 600; color: var(--color-primary); font-size: 1.1rem; pointer-events: none;"><i class="bi bi-cloud-arrow-up"></i> Dosyaları Buraya Bırakın</span>
                    </div>
                </div>
            </div>
        `;
        }).join("");
    }

    window.openCommentsDrawer = function(entityType, entityId, entityTitle = '') {
        currentDrawerEntityType = entityType;
        currentDrawerEntityId = entityId;

        let typeName = entityType === 'TaskItem' ? 'Görev' : entityType === 'SubGoal' ? 'Alt Hedef' : entityType === 'MainGoal' ? 'Ana Hedef' : 'Proje';
        document.getElementById('drawer-title-main').innerText = `${typeName} > ${entityTitle}`;

        document.getElementById('comments-drawer-overlay').classList.add('open');
        document.getElementById('comments-drawer').classList.add('open');

        loadComments(entityType, entityId);

        // Focus input after opening
        setTimeout(() => {
            document.getElementById('drawer-comment-input').focus();
        }, 300);
    }

    window.closeCommentsDrawer = function() {
        document.getElementById('comments-drawer-overlay').classList.remove('open');
        document.getElementById('comments-drawer').classList.remove('open');
        currentDrawerEntityId = null;
        currentDrawerEntityType = null;
    };

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

// Item Files Modal Upload Logic
document.addEventListener("DOMContentLoaded", () => {
    const dropzone = document.getElementById("item-files-dropzone");
    const fileInput = document.getElementById("item-files-input");
    
    if (dropzone && fileInput) {
        dropzone.addEventListener("click", () => fileInput.click());
        
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--primary-color)";
            dropzone.style.background = "rgba(37, 99, 235, 0.05)";
        });
        
        dropzone.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--border-color)";
            dropzone.style.background = "var(--bg-surface)";
        });
        
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--border-color)";
            dropzone.style.background = "var(--bg-surface)";
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                uploadGlobalItemFiles(e.dataTransfer.files);
            }
        });
        
        fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                uploadGlobalItemFiles(e.target.files);
            }
        });
    }
    
    // Inline Accordion Drag & Drop
    document.body.addEventListener("dragenter", (e) => {
        const acc = e.target.closest('.inline-file-accordion');
        if (acc) {
            const overlay = acc.querySelector('.inline-dropzone-overlay');
            if (overlay) overlay.style.display = 'flex';
        }
    });
    
    document.body.addEventListener("dragover", (e) => {
        const acc = e.target.closest('.inline-file-accordion');
        if (acc) e.preventDefault(); // allow drop
    });
    
    document.body.addEventListener("dragleave", (e) => {
        if (e.target.classList && e.target.classList.contains('inline-dropzone-overlay')) {
            e.target.style.display = 'none';
        }
    });
    
    document.body.addEventListener("drop", (e) => {
        const overlay = e.target.closest('.inline-dropzone-overlay');
        if (overlay) {
            e.preventDefault();
            overlay.style.display = 'none';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                uploadGlobalItemFiles(e.dataTransfer.files, overlay.dataset.itemType, overlay.dataset.itemId);
            }
        }
    });
});

window.uploadGlobalItemFiles = function(files, forceType = null, forceId = null) {
    const itemType = forceType || document.getElementById("item-files-type").value;
    const itemId = forceId || document.getElementById("item-files-id").value;
    const targetFolderId = window.itemFolderIds && window.itemFolderIds[`${itemType}_${itemId}`] ? window.itemFolderIds[`${itemType}_${itemId}`] : window.currentGlobalFolderId;
    
    if (typeof uploadFilesBase !== 'undefined') {
        uploadFilesBase(files, targetFolderId, () => {
            window.asyncLoadItemFiles(itemType, itemId, "item-files-list");
            
            const wrap = document.getElementById(`file-acc-${itemType}-${itemId}`);
            if (wrap && wrap.style.display !== "none") {
                window.asyncLoadItemFiles(itemType, itemId);
            }
            
            if (typeof loadProjectFilesSummary !== 'undefined' && typeof activeProjectId !== 'undefined') {
                loadProjectFilesSummary(activeProjectId);
            }
        });
    } else {
        showToast("Yükleme modülü bulunamadı.", "danger");
    }
};