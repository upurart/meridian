    window.createMainGoalSlotDOM = function(defaultTitle = "") {
        const div = document.createElement("div");
        div.className = "init-slot-mg tm-card";
        div.style.cssText = "padding: 10px; border: 1px solid var(--border-color); background: var(--bg-surface); border-radius: 6px;";
        div.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                <i class="bi bi-clipboard" style="color: var(--text-primary);"></i>
                <input type="text" class="form-control mg-title" value="${defaultTitle}" placeholder="Ana Hedef Başlığı" style="flex: 1; height: 32px; font-size: 0.85rem;" />
                <button type="button" class="tm-btn-icon-only" style="color: var(--color-danger);" onclick="this.closest('.init-slot-mg').remove()" title="Sil"><i class="bi bi-trash3"></i></button>
            </div>
            <textarea class="form-control mg-desc" placeholder="Açıklama (İsteğe bağlı)" style="height: 44px; font-size: 0.8rem; margin-bottom: 8px;"></textarea>
            <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                <button type="button" class="tm-btn tm-btn-secondary" style="font-size: 0.75rem; padding: 2px 8px;" onclick="addInitialSubGoalSlot(this.closest('.init-slot-mg').querySelector('.sg-container'))"><i class="bi bi-plus"></i> Alt Hedef Ekle</button>
                <button type="button" class="tm-btn tm-btn-secondary" style="font-size: 0.75rem; padding: 2px 8px;" onclick="addInitialTaskToMgSlot(this.closest('.init-slot-mg').querySelector('.mg-tasks-container'))"><i class="bi bi-plus"></i> Görev Ekle</button>
            </div>
            <div class="sg-container" style="display: flex; flex-direction: column; gap: 6px; margin-left: 14px; border-left: 2px solid #f59e0b; padding-left: 8px;"></div>
            <div class="mg-tasks-container" style="display: flex; flex-direction: column; gap: 6px; margin-left: 14px; border-left: 2px solid #10b981; padding-left: 8px; margin-top: 4px;"></div>
        `;
        return div;
    };

    window.createSubGoalSlotDOM = function(defaultTitle = "") {
        const div = document.createElement("div");
        div.className = "init-slot-sg";
        div.style.cssText = "padding: 8px; border: 1px dashed var(--border-color); background: var(--bg-surface-elevated); border-radius: 4px;";
        div.innerHTML = `
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
                <i class="bi bi-lightning-charge-fill" style="color: #f59e0b; font-size: 0.8rem;"></i>
                <input type="text" class="form-control sg-title" value="${defaultTitle}" placeholder="Alt Hedef Başlığı" style="flex: 1; height: 28px; font-size: 0.8rem;" />
                <button type="button" class="tm-btn-icon-only" style="color: var(--color-danger); font-size: 0.8rem;" onclick="this.closest('.init-slot-sg').remove()" title="Sil"><i class="bi bi-trash3"></i></button>
            </div>
            <textarea class="form-control sg-desc" placeholder="Açıklama (İsteğe bağlı)" style="height: 38px; font-size: 0.75rem; margin-bottom: 6px;"></textarea>
            <div style="margin-bottom: 4px;">
                <button type="button" class="tm-btn tm-btn-secondary" style="font-size: 0.7rem; padding: 2px 6px;" onclick="addInitialTaskToSgSlot(this.closest('.init-slot-sg').querySelector('.sg-tasks-container'))"><i class="bi bi-plus"></i> Görev Ekle</button>
            </div>
            <div class="sg-tasks-container" style="display: flex; flex-direction: column; gap: 4px; margin-left: 12px; border-left: 2px solid #10b981; padding-left: 6px;"></div>
        `;
        return div;
    };

    window.createTaskSlotDOM = function(defaultTitle = "") {
        const div = document.createElement("div");
        div.className = "init-slot-task";
        div.style.cssText = "display: flex; gap: 6px; align-items: center; background: var(--bg-surface); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border-color);";
        div.innerHTML = `
            <i class="bi bi-check2-square" style="color: var(--text-primary); font-size: 0.8rem;"></i>
            <input type="text" class="form-control task-title" value="${defaultTitle}" placeholder="Görev Başlığı" style="flex: 1; height: 26px; font-size: 0.75rem;" />
            <input type="text" class="form-control task-desc" placeholder="Açıklama (İsteğe bağlı)" style="flex: 1; height: 26px; font-size: 0.75rem;" />
            <button type="button" class="tm-btn-icon-only" style="color: var(--color-danger); font-size: 0.75rem;" onclick="this.closest('.init-slot-task').remove()" title="Sil"><i class="bi bi-trash3"></i></button>
        `;
        return div;
    };

    window.addInitialMainGoalSlot = function() {
        const container = document.getElementById("dynamic-slots-container");
        if (!container) return;
        container.appendChild(createMainGoalSlotDOM());
        const panel = document.getElementById("initial-structure-panel");
        if (panel && panel.style.display === "none") toggleInitialStructurePanel();
    };

    window.addInitialSubGoalSlot = function(container) {
        if (!container) return;
        container.appendChild(createSubGoalSlotDOM());
    };

    window.addInitialTaskToMgSlot = function(container) {
        if (!container) return;
        container.appendChild(createTaskSlotDOM());
    };

    window.addInitialTaskToSgSlot = function(container) {
        if (!container) return;
        container.appendChild(createTaskSlotDOM());
    };

    window.addInitialTaskSlot = function() {
        const container = document.getElementById("dynamic-slots-container");
        if (!container) return;
        container.appendChild(createTaskSlotDOM());
        const panel = document.getElementById("initial-structure-panel");
        if (panel && panel.style.display === "none") toggleInitialStructurePanel();
    };

    window.generateSlotsFromCounts = function() {
        const mgCount = parseInt(document.getElementById("init-mg-count").value, 10) || 0;
        const sgCount = parseInt(document.getElementById("init-sg-count").value, 10) || 0;
        const taskCount = parseInt(document.getElementById("init-task-count").value, 10) || 0;

        const container = document.getElementById("dynamic-slots-container");
        if (!container) return;
        container.innerHTML = "";

        for (let i = 1; i <= mgCount; i++) {
            const mgEl = createMainGoalSlotDOM(`Ana Hedef ${i}`);
            container.appendChild(mgEl);
            const sgContainer = mgEl.querySelector(".sg-container");
            const mgTasksContainer = mgEl.querySelector(".mg-tasks-container");

            for (let j = 1; j <= sgCount; j++) {
                const sgEl = createSubGoalSlotDOM(`Alt Hedef ${i}.${j}`);
                sgContainer.appendChild(sgEl);
                const sgTasksContainer = sgEl.querySelector(".sg-tasks-container");

                for (let k = 1; k <= taskCount; k++) {
                    const tEl = createTaskSlotDOM(`Görev ${i}.${j}.${k}`);
                    sgTasksContainer.appendChild(tEl);
                }
            }

            if (sgCount === 0 && taskCount > 0) {
                for (let k = 1; k <= taskCount; k++) {
                    const tEl = createTaskSlotDOM(`Ana Hedef ${i} - Görev ${k}`);
                    mgTasksContainer.appendChild(tEl);
                }
            }
        }
        showToast("Şablon yuvaları oluşturuldu. Aşağıdan içeriklerini düzenleyebilirsiniz.", "success");
    };


    window.openProjectMembersModal = function() {
        if (!activeProjectId) {
            showToast("Lütfen önce bir proje seçin.", "warning");
            return;
        }
        
        document.getElementById("project-members-modal-title").innerText = activeProjectHasManageAccess ? "Proje Üyeleri" : "Proje Üyeleri";
        document.getElementById("new-project-member-hr").style.display = activeProjectHasManageAccess ? "block" : "none";
        
        document.getElementById("project-invite-section").style.display = activeProjectHasManageAccess ? "block" : "none";
        
        const modal = document.getElementById("project-members-modal");
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("active"), 10);
        loadProjectMembers();
        if (activeProjectHasManageAccess) {
            loadProjectInviteSettings();
        }
    };

    window.loadProjectInviteSettings = async function() {
        if (!activeProjectId) return;
        try {
            const res = await fetch(`/api/ProjectMemberApi/${activeProjectId}/Settings`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            document.getElementById("project-invite-code-input").value = data.inviteCode || "Yok";
            document.getElementById("project-password-input").placeholder = data.hasPassword ? "Şifre ayarlanmış (Değiştirmek için yazın)" : "Yeni şifre...";
            document.getElementById("project-remove-password-btn").style.display = data.hasPassword ? "block" : "none";
        } catch (e) {
            console.error("Proje katılım ayarları yüklenemedi.");
        }
    };

    window.generateProjectInviteCode = async function() {
        if (!activeProjectId) return;
        try {
            const res = await fetch(`/api/ProjectMemberApi/${activeProjectId}/GenerateInviteCode`, { method: "POST" });
            if (!res.ok) throw new Error();
            const data = await res.json();
            document.getElementById("project-invite-code-input").value = data.inviteCode;
            showToast("Yeni davet kodu üretildi.", "success");
        } catch (e) {
            showToast("Davet kodu üretilirken hata oluştu.", "danger");
        }
    };

    window.setProjectPassword = async function() {
        if (!activeProjectId) return;
        const password = document.getElementById("project-password-input").value;
        try {
            const res = await fetch(`/api/ProjectMemberApi/${activeProjectId}/SetPassword`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: password })
            });
            if (!res.ok) throw new Error();
            showToast("Proje şifresi kaydedildi.", "success");
            document.getElementById("project-password-input").value = "";
            loadProjectInviteSettings();
        } catch (e) {
            showToast("Şifre kaydedilirken hata oluştu.", "danger");
        }
    };

    window.removeProjectPassword = async function() {
        if (!activeProjectId) return;
        if (!confirm("Proje şifresini kaldırmak istediğinize emin misiniz?")) return;
        try {
            const res = await fetch(`/api/ProjectMemberApi/${activeProjectId}/SetPassword`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: "" })
            });
            if (!res.ok) throw new Error();
            showToast("Proje şifresi kaldırıldı.", "success");
            document.getElementById("project-password-input").value = "";
            loadProjectInviteSettings();
        } catch (e) {
            showToast("Şifre kaldırılırken hata oluştu.", "danger");
        }
    };

    window.closeProjectMembersModal = function() {
        const modal = document.getElementById("project-members-modal");
        modal.classList.remove("active");
        setTimeout(() => modal.style.display = "none", 250);
    };

    window.loadProjectMembers = async function() {
        if (!activeProjectId) return;
        const listDiv = document.getElementById("project-members-list");
        listDiv.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Üyeler yükleniyor...</div>';
        
        try {
            const res = await fetch(`/api/ProjectMemberApi/${activeProjectId}`);
            if (!res.ok) throw new Error("Üyeler alınamadı.");
            const members = await res.json();
            
            if (members.length === 0) {
                listDiv.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Bu projede henüz başka bir üye yok.</div>';
                return;
            }
            
            listDiv.innerHTML = members.map(m => {
                let controlsHtml = '';
                if (m.role === 'Owner') {
                    controlsHtml = `<span style="font-size: 0.85rem; color: var(--color-primary); padding: 4px 8px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); background: rgba(0, 122, 255, 0.1);">Proje Sahibi</span>`;
                } else if (activeProjectHasManageAccess) {
                    controlsHtml = `
                        <select class="form-control" style="padding: 4px 8px; font-size: 0.85rem; height: auto;" onchange="updateProjectMemberRole(${m.id}, this.value)">
                            <option value="Participant" ${m.role === 'Participant' ? 'selected' : ''}>Katılımcı</option>
                            <option value="Manager" ${m.role === 'Manager' ? 'selected' : ''}>Yönetici</option>
                            <option value="Observer" ${m.role === 'Observer' ? 'selected' : ''}>Gözlemci</option>
                        </select>
                        <button class="tm-btn-icon-only" style="color: var(--color-danger);" onclick="removeProjectMember(${m.id})" title="Üyeyi Çıkar">
                            <i class="bi bi-trash"></i>
                        </button>
                    `;
                } else {
                    let roleStr = m.role === 'Manager' ? 'Yönetici' : (m.role === 'Participant' ? 'Katılımcı' : 'Gözlemci');
                    controlsHtml = `<span style="font-size: 0.85rem; color: var(--text-muted); padding: 4px 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-surface-elevated);">${roleStr}</span>`;
                }
                
                let badgeHtml = m.isCurrentUser ? '<span style="font-size: 0.7rem; background: var(--color-primary); color: white; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">Siz</span>' : '';
                return `
                <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary); display: flex; align-items: center;">${escapeHtml(m.user.name + " " + m.user.surname)}${badgeHtml}</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(m.user.email)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${controlsHtml}
                    </div>
                </div>
            `}).join("");
            
        } catch (err) {
            console.error(err);
            listDiv.innerHTML = '<div style="color: var(--color-danger); font-size: 0.85rem;">Üyeler yüklenirken bir hata oluştu.</div>';
        }
    };



    window.removeProjectMember = async function(id) {
        if (!confirm("Bu üyeyi projeden çıkarmak istediğinize emin misiniz?")) return;
        
        try {
            const res = await fetch(`/api/ProjectMemberApi/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast("Üye çıkarıldı.", "info");
                loadProjectMembers();
            } else {
                showToast("Silme işlemi başarısız.", "danger");
            }
        } catch (err) {
            console.error(err);
            showToast("Bir hata oluştu.", "danger");
        }
    };

    window.updateProjectMemberRole = async function(id, newRole) {
        try {
            const res = await fetch(`/api/ProjectMemberApi/${id}/Role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            
            if (res.ok) {
                showToast("Üye rolü güncellendi.", "success");
            } else {
                showToast("Rol güncellenemedi.", "danger");
                loadProjectMembers();
            }
        } catch (err) {
            console.error(err);
            showToast("Bir hata oluştu.", "danger");
            loadProjectMembers();
        }
    };

    // Unified Add Modal Logic
    window.openUnifiedAddModal = async function() {
        document.getElementById("unified-title").value = "";
        document.getElementById("unified-desc").value = "";
        document.getElementById("unified-item-type").value = "task";
        
        await populateUnifiedMainGoals();
        onUnifiedItemTypeChange();
        
        document.getElementById("unified-add-modal").classList.add("active");
    };

    window.populateUnifiedMainGoals = async function() {
        const mgSelect = document.getElementById("unified-maingoal-select");
        mgSelect.innerHTML = '<option value="">-- Projeye Ekle --</option>';
        try {
            const res = await fetch(`/api/dashboard/workspace/data?projectId=${activeProjectId}`);
            if(res.ok) {
                const data = await res.json();
                if (data.project && data.project.mainGoals) {
                    data.project.mainGoals.forEach(mg => {
                        mgSelect.innerHTML += `<option value="${mg.id}">${escapeHtml(mg.title)}</option>`;
                    });
                }
            }
        } catch(err) { console.error(err); }
    };

    window.onUnifiedItemTypeChange = function() {
        const type = document.getElementById("unified-item-type").value;
        const mgGroup = document.getElementById("unified-maingoal-group");
        const sgGroup = document.getElementById("unified-subgoal-group");
        
        if (type === "maingoal") {
            mgGroup.style.display = "none";
            sgGroup.style.display = "none";
        } else if (type === "subgoal") {
            mgGroup.style.display = "block";
            sgGroup.style.display = "none";
        } else if (type === "task") {
            mgGroup.style.display = "block";
            sgGroup.style.display = "block";
        }
    };

    window.onUnifiedMainGoalChange = async function() {
        const type = document.getElementById("unified-item-type").value;
        if (type !== "task") return;
        
        const sgGroup = document.getElementById("unified-subgoal-group");
        const sgSelect = document.getElementById("unified-subgoal-select");
        const mgId = document.getElementById("unified-maingoal-select").value;
        
        sgSelect.innerHTML = '<option value="">-- Ana Hedefe Ekle --</option>';
        
        if (!mgId) {
            return;
        }
        
        try {
            const res = await fetch(`/api/dashboard/workspace/data?projectId=${activeProjectId}`);
            if(res.ok) {
                const data = await res.json();
                if (data.project && data.project.mainGoals) {
                    const mg = data.project.mainGoals.find(m => m.id == mgId);
                    if (mg && mg.subGoals) {
                        mg.subGoals.forEach(sg => {
                            sgSelect.innerHTML += `<option value="${sg.id}">${escapeHtml(sg.title)}</option>`;
                        });
                    }
                }
            }
        } catch(err) { console.error(err); }
    };

    window.handleUnifiedAddSubmit = async function(e) {
        e.preventDefault();
        const type = document.getElementById("unified-item-type").value;
        const title = document.getElementById("unified-title").value;
        const desc = document.getElementById("unified-desc").value;
        
        let url = "";
        let bodyObj = { title, description: desc };
        
        if (type === "maingoal") {
            url = "/api/dashboard/maingoal";
            bodyObj.projectId = activeProjectId;
        } else if (type === "subgoal") {
            url = "/api/dashboard/subgoal";
            const mgId = document.getElementById("unified-maingoal-select").value;
            if (!mgId) {
                showToast("Lütfen bir ana hedef seçin.", "warning");
                return;
            }
            bodyObj.mainGoalId = mgId;
        } else if (type === "task") {
            url = "/api/dashboard/task";
            const mgId = document.getElementById("unified-maingoal-select").value;
            const sgId = document.getElementById("unified-subgoal-select").value;
            if (sgId) {
                bodyObj.subGoalId = parseInt(sgId);
            } else if (mgId) {
                bodyObj.mainGoalId = parseInt(mgId);
            } else {
                bodyObj.projectId = activeProjectId;
            }
        }
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj)
            });
            
            if (res.ok) {
                closeModal('unified-add-modal');
                showToast("Öge eklendi.", "success");
                await refreshWorkspaceData(activeProjectId);
            } else {
                showToast("Hata oluştu.", "danger");
            }
        } catch (err) {
            console.error(err);
            showToast("Bir hata oluştu.", "danger");
        }
    };

// --- File Upload & Drag/Drop Logic ---
let chatPendingFiles = [];

window.handleChatFileSelect = function(event) {
    const files = event.target.files;
    addChatFiles(files);
    event.target.value = ''; // reset
}

window.addChatFiles = function(files) {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
        chatPendingFiles.push(files[i]);
    }
    renderChatFilePreview();
}

window.removeChatFile = function(index) {
    chatPendingFiles.splice(index, 1);
    renderChatFilePreview();
}

window.renderChatFilePreview = function() {
    const container = document.getElementById('chat-attachments-preview');
    if (chatPendingFiles.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    
    container.style.display = 'flex';
    let html = '';
    
    chatPendingFiles.forEach((f, idx) => {
        const isImage = f.type.startsWith('image/');
        let previewContent = '';
        
        if (isImage) {
            const objUrl = URL.createObjectURL(f);
            previewContent = `<img src="${objUrl}" style="width: 100%; height: 100%; object-fit: cover;" onload="URL.revokeObjectURL(this.src)" />`;
        } else {
            previewContent = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: var(--bg-surface-elevated); font-size: 1.5rem; color: var(--text-secondary);"><i class="bi bi-file-earmark"></i></div>`;
        }
        
        html += `
            <div style="position: relative; width: 48px; height: 48px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-color); flex-shrink: 0;" title="${escapeHtml(f.name)}">
                ${previewContent}
                <button onclick="removeChatFile(${idx})" style="position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.6); color: #fff; border: none; cursor: pointer; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; border-radius: 0 0 0 4px;"><i class="bi bi-x"></i></button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Drag and drop setup for chat
document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('drawer-chat-dropzone');
    if (!dropzone) return;
    
    const drawerComments = document.getElementById('drawer-comments-list');
    
    // Bind to the parent drawer container so we can drag over the whole comments area
    const dz = drawerComments || dropzone;

    dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--color-primary)';
        dropzone.style.backgroundColor = 'var(--bg-surface-elevated)';
    });
    
    dz.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.backgroundColor = 'var(--bg-base)';
    });
    
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.backgroundColor = 'var(--bg-base)';
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addChatFiles(e.dataTransfer.files);
        }
    });
});

let currentChatCtxData = null;

window.showChatContextMenu = function(event, commentId, isMe, entityType, entityId) {
    event.preventDefault();
    
    currentChatCtxData = { commentId, isMe, entityType, entityId };
    
    const menu = document.getElementById('chat-context-menu');
    const deleteBtn = document.getElementById('chat-context-delete');
    
    if (isMe) {
        deleteBtn.style.display = 'flex';
    } else {
        deleteBtn.style.display = 'none';
    }
    
    menu.style.display = 'block';
    
    let x = event.clientX;
    let y = event.clientY;
    
    if (x + menu.offsetWidth > window.innerWidth) x -= menu.offsetWidth;
    if (y + menu.offsetHeight > window.innerHeight) y -= menu.offsetHeight;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('chat-context-menu');
    if (menu && menu.style.display === 'block') {
        menu.style.display = 'none';
    }
});

window.handleChatAction = function(action) {
    const menu = document.getElementById('chat-context-menu');
    if (menu) menu.style.display = 'none';
    
    if (!currentChatCtxData) return;
    
    if (action === 'delete') {
        deleteComment(currentChatCtxData.commentId, currentChatCtxData.entityType, currentChatCtxData.entityId);
    } else if (action === 'reply') {
        startChatReply(currentChatCtxData.commentId);
    } else if (action === 'forward') {
        openChatForwardPanel(currentChatCtxData.commentId);
    }
}

// --- Reply & Forward Logic ---
window.currentLoadedComments = window.currentLoadedComments || [];
window.chatReplyTo = null;
let chatForwardCommentId = null;

window.startChatReply = function(commentId) {
    const comment = window.currentLoadedComments.find(c => c.id === commentId);
    if (!comment) return;
    
    window.chatReplyTo = comment;
    
    const preview = document.getElementById('chat-reply-preview');
    const author = document.getElementById('chat-reply-author');
    const text = document.getElementById('chat-reply-text');
    
    const authorName = comment.isCurrentUser ? 'Siz' : (comment.user ? comment.user.name + ' ' + comment.user.surname : '');
    author.innerText = authorName;
    
    let previewText = comment.content;
    if (!previewText && comment.attachments && comment.attachments.length > 0) {
        previewText = '[Dosya/Resim Eki]';
    }
    text.innerText = previewText;
    
    preview.style.display = 'block';
    
    const input = document.getElementById('drawer-comment-input');
    if (input) input.focus();
}

window.cancelChatReply = function() {
    window.chatReplyTo = null;
    const preview = document.getElementById('chat-reply-preview');
    if (preview) preview.style.display = 'none';
}

window.openChatForwardPanel = async function(commentId) {
    const comment = window.currentLoadedComments.find(c => c.id === commentId);
    if (!comment) return;
    
    chatForwardCommentId = commentId;
    
    let previewText = comment.content;
    if (!previewText && comment.attachments && comment.attachments.length > 0) {
        previewText = '[Dosya/Resim Eki]';
    }
    document.getElementById('forward-message-preview').innerText = previewText;
    
    const select = document.getElementById('forward-task-select');
    select.innerHTML = '<option value="">Görev yükleniyor...</option>';
    
    document.getElementById('drawer-forward-panel').style.display = 'flex';
    
    try {
        const res = await fetch(`/api/dashboard/project/${activeProjectId}/tasks`);
        if (res.ok) {
            const tasks = await res.json();
            select.innerHTML = '';
            
            // Filter out the current task if we are in it
            const filteredTasks = tasks.filter(t => t.id !== currentDrawerEntityId || currentDrawerEntityType !== 'TaskItem');
            
            if (filteredTasks.length === 0) {
                select.innerHTML = '<option value="">İletilebilecek başka görev yok.</option>';
            } else {
                filteredTasks.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.innerText = t.title;
                    select.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error(e);
        select.innerHTML = '<option value="">Görevler yüklenemedi</option>';
    }
}

window.closeChatForwardPanel = function() {
    document.getElementById('drawer-forward-panel').style.display = 'none';
}

window.executeChatForward = async function() {
    const select = document.getElementById('forward-task-select');
    const targetId = select.value;
    
    if (!targetId) {
        showToast('Lütfen hedef görev seçin.', 'warning');
        return;
    }
    
    try {
        const res = await fetch(`/api/CommentApi/Forward/${chatForwardCommentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetEntityType: 'TaskItem', targetEntityId: parseInt(targetId) })
        });
        
        if (res.ok) {
            closeChatForwardPanel();
            showToast('Mesaj başarıyla iletildi!', 'success');
        } else {
            showToast('Mesaj iletilemedi.', 'danger');
        }
    } catch (e) {
        console.error(e);
        showToast('Bir hata oluştu.', 'danger');
    }
}


