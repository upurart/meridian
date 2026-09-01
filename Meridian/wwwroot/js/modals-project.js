function openProjectModal(project = null) {
    const form = document.getElementById("project-form");
    form.reset();

    const structSection = document.getElementById("project-initial-structure-section");
    const wsGroup = document.getElementById("project-workspace-group");

    if (project) {
        document.getElementById("project-modal-title").innerText = "Proje Düzenle";
        document.getElementById("project-modal-id").value = project.id;
        document.getElementById("project-title").value = project.title;
        document.getElementById("project-desc").value = project.description;
        document.getElementById("project-start-date").value = project.startDate ? project.startDate.substring(0, 16) : "";
        document.getElementById("project-deadline").value = project.deadline ? project.deadline.substring(0, 16) : "";
        if (structSection) structSection.style.display = "none";
        if (wsGroup) wsGroup.style.display = "none";
    } else {
        document.getElementById("project-modal-title").innerText = "Yeni Proje Ekle";
        document.getElementById("project-modal-id").value = "";
        document.getElementById("project-start-date").value = "";
        document.getElementById("project-deadline").value = "";
        if (structSection) structSection.style.display = "block";
        
        if (wsGroup) {
            wsGroup.style.display = "block";
            const wsSelect = document.getElementById("project-workspace");
            wsSelect.innerHTML = '<option value="">Yükleniyor...</option>';
            
            fetch(window.WORKSPACE_API)
                .then(res => res.json())
                .then(data => {
                    let html = '<option value="">Varsayılan Alan</option>';
                    // Sadece kişisel workspaceleri listele (TeamGroupId'si olmayanlar)
                    const personalWorkspaces = data.filter(w => !w.teamGroupId);
                    personalWorkspaces.forEach(w => {
                        html += `<option value="${w.id}">${escapeHtml(w.name)}</option>`;
                    });
                    wsSelect.innerHTML = html;
                    
                    // Eğer zaten bir workspace içindeyken bu butona basılmışsa
                    if (typeof activeWorkspaceId !== 'undefined' && activeWorkspaceId) {
                        // Liste içinde var mı kontrol et
                        const exists = personalWorkspaces.some(w => w.id == activeWorkspaceId);
                        if (exists) {
                            wsSelect.value = activeWorkspaceId;
                        }
                    }
                })
                .catch(() => {
                    wsSelect.innerHTML = '<option value="">Varsayılan Alan</option>';
                });
        }

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
    const startDate = document.getElementById("project-start-date").value;
    const deadline = document.getElementById("project-deadline").value;

    const payload = { title, description, startDate: startDate || null, deadline: deadline || null };
    if (!id) {
        if (typeof activeTeamId !== 'undefined' && activeTeamId) {
            payload.teamGroupId = activeTeamId;
        }
        
        const wsSelect = document.getElementById("project-workspace");
        if (wsSelect && wsSelect.value) {
            payload.workspaceId = parseInt(wsSelect.value);
        } else if (typeof activeWorkspaceId !== 'undefined' && activeWorkspaceId) {
            payload.workspaceId = activeWorkspaceId;
        } else {
            payload.workspaceId = null;
        }
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
            await loadProjectWorkspace(data.id);
            await triggerGlobalRefresh();
        }
        
        if (typeof window.loadBacklogTasks === 'function') {
            window.loadBacklogTasks();
        }
    } catch (err) {
        showToast("Proje kaydedilirken hata oluştu.", "danger");
    } finally {
        // İŞLEM BİTİNCE BUTONU GERİ AÇ
        submitBtn.disabled = false;
        submitBtn.innerText = "Kaydet";
    }
}
