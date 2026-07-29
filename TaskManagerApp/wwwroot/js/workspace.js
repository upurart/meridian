    async function loadProjectWorkspace(projectId, skipRailUpdate = false) {
        activeProjectId = projectId;
        joinCommentProject(projectId);

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
                <div style="display: flex; flex-direction: column; width: 100%;">
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
                        <div style="display: flex; gap: 6px;">
                            <button class="tm-btn-icon-only" style="padding: 4px; color: var(--text-secondary);" title="Yorumlar" onclick="openCommentsDrawer('TaskItem', ${t.id}, '${escapeHtml(t.title).replace(/'/g, "\\'")}')"><i class="bi bi-chat-dots"></i></button>
                            ${activeProjectIsObserver ? '' : `
                            <button class="tm-btn-icon-only" style="padding: 4px;" title="Düzenle" onclick="openTaskModal(null, ${JSON.stringify(t).replace(/"/g, '&quot;')})"><i class="bi bi-pencil-square"></i></button>
                            <button class="tm-btn-icon-only" style="padding: 4px;" title="Sil" onclick="openDeleteModal('task', ${t.id})"><i class="bi bi-trash3"></i></button>
                            `}
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


