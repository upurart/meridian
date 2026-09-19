function openTaskModal(subGoalId, task = null, projectId = null, mainGoalId = null) {
    const form = document.getElementById("task-form");
    form.reset();

    document.getElementById("task-subgoal-id").value = subGoalId || "";
    document.getElementById("task-maingoal-id").value = mainGoalId || "";
    document.getElementById("task-project-id").value = projectId || "";

    if (task) {
        document.getElementById("task-modal-title").innerText = "Görevi Düzenle";
        document.getElementById("task-modal-id").value = task.id;
        document.getElementById("task-row-version").value = task.rowVersion || "";
        document.getElementById("task-title").value = task.title;
        document.getElementById("task-desc").value = task.description;
        document.getElementById("task-completed").checked = task.isCompleted;
        document.getElementById("task-completed").parentElement.style.display = "flex";

        document.getElementById("task-subgoal-id").value = task.subGoalId || "";
        document.getElementById("task-maingoal-id").value = task.mainGoalId || "";
        document.getElementById("task-project-id").value = task.projectId || "";
    } else {
        document.getElementById("task-modal-title").innerText = "Yeni Görev Ekle";
        document.getElementById("task-modal-id").value = "";
        document.getElementById("task-row-version").value = "";
        document.getElementById("task-completed").checked = false;
        document.getElementById("task-completed").parentElement.style.display = "none";
    }
    
    openModal("task-modal");
}

window.currentTaskFolderId = null;

async function loadTaskFiles(taskId) {
    const listEl = document.getElementById("task-files-list");
    listEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Yükleniyor...</span>`;
    
    try {
        const res = await fetch(`/api/dashboard/task/${taskId}/files`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        window.currentTaskFolderId = data.folderId;
        renderTaskFiles(data.files, 'task');
    } catch {
        listEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--color-danger);">Dosyalar yüklenirken hata oluştu.</span>`;
    }
}

function renderTaskFiles(files, itemType) {
    let listEl;
    if (itemType === 'task') listEl = document.getElementById("task-files-list");
    else if (itemType === 'maingoal') listEl = document.getElementById("maingoal-files-list");
    else if (itemType === 'subgoal') listEl = document.getElementById("subgoal-files-list");
    else return;

    if (!files || files.length === 0) {
        listEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Henüz dosya eklenmemiş.</span>`;
        return;
    }
    
    listEl.innerHTML = files.map(f => `
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
                <button type="button" class="tm-btn-icon-only" style="padding: 4px; font-size: 1rem; color: var(--color-danger);" onclick="deleteItemFile(${f.id}, '${itemType}')"><i class="bi bi-trash3"></i></button>
            </div>
        </div>
    `).join('');
}

async function deleteItemFile(fileId, itemType) {
    if (!confirm("Bu dosyayı silmek istediğinize emin misiniz?")) return;
    
    try {
        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
        const res = await fetch(`/api/filemanager/file/${fileId}`, { 
            method: 'DELETE',
            headers: { 'RequestVerificationToken': token }
        });
        if (!res.ok) throw new Error();
        
        showToast("Dosya klasörden silindi.");
        if (itemType === 'task') {
            const taskId = document.getElementById("task-modal-id").value;
            if (taskId) loadTaskFiles(taskId);
        } else if (itemType === 'maingoal') {
            const mgId = document.getElementById("maingoal-modal-id").value;
            if (mgId) loadMainGoalFiles(mgId);
        } else if (itemType === 'subgoal') {
            const sgId = document.getElementById("subgoal-modal-id").value;
            if (sgId) loadSubGoalFiles(sgId);
        }
    } catch {
        showToast("Dosya silinirken hata oluştu.", "danger");
    }
}

// Drag & Drop Init
document.addEventListener("DOMContentLoaded", () => {
    setupDropzone("task-files-dropzone", "task-files-input", uploadTaskFiles);
});

function setupDropzone(dropzoneId, inputId, uploadCallback) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(inputId);
    
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
            dropzone.style.background = "var(--bg-secondary)";
        });
        
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--border-color)";
            dropzone.style.background = "var(--bg-secondary)";
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                uploadCallback(e.dataTransfer.files);
            }
        });
        
        fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                uploadCallback(e.target.files);
            }
        });
    }
}

async function uploadFilesBase(files, folderId, onSuccess) {
    if (!folderId) {
        showToast("Klasör kimliği bulunamadı.", "danger");
        return;
    }
    
    showToast(`${files.length} dosya yükleniyor...`);
    const fileArr = Array.from(files);
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    
    const uploadPromises = fileArr.map(file => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", folderId);
        
        return fetch("/api/filemanager/upload", {
            method: "POST",
            headers: { 'RequestVerificationToken': token },
            body: formData
        }).then(res => res.ok);
    });
    
    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(r => r).length;
    
    if (successCount === results.length) {
        showToast("Tüm dosyalar başarıyla yüklendi.");
    } else {
        showToast(`${successCount} dosya yüklendi, ${results.length - successCount} dosyada hata oluştu.`, "warning");
    }
    
    if (onSuccess) onSuccess();
}

async function uploadTaskFiles(files) {
    uploadFilesBase(files, window.currentTaskFolderId, () => {
        const taskId = document.getElementById("task-modal-id").value;
        if (taskId) loadTaskFiles(taskId);
    });
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("task-modal-id").value;
    const subGoalVal = document.getElementById("task-subgoal-id").value;
    const mainGoalVal = document.getElementById("task-maingoal-id").value;
    const projectVal = document.getElementById("task-project-id").value;

    const subGoalId = subGoalVal ? parseInt(subGoalVal) : null;
    const mainGoalId = mainGoalVal ? parseInt(mainGoalVal) : null;
    const projectId = projectVal ? parseInt(projectVal) : null;

    const title = document.getElementById("task-title").value.trim();
    const description = document.getElementById("task-desc").value.trim();
    const isCompleted = document.getElementById("task-completed").checked;
    const rowVersion = document.getElementById("task-row-version").value;

    const payload = { subGoalId, mainGoalId, projectId, title, description, isCompleted, rowVersion };
    const url = id ? `/api/dashboard/task/${id}` : "/api/dashboard/task";
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.status === 409) {
            const errData = await res.json();
            showToast(errData.message || "Bu görev sizden önce başkası tarafından değiştirilmiş. Lütfen sayfayı yenileyin.", "danger");
            return;
        }

        if (!res.ok) throw new Error();

        closeModal("task-modal");
        showToast("Görev başarıyla kaydedildi.");
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Görev kaydedilirken hata oluştu.", "danger");
    }
}

window.hideCompletedTasks = false;
window.expandedTaskContainers = new Set();

window.toggleCompletedTasksGlobal = function(event) {
    const isChecked = event ? event.target.checked : !window.hideCompletedTasks;
    window.hideCompletedTasks = isChecked;
    
    document.querySelectorAll('input[onchange="toggleCompletedTasksGlobal(event)"]').forEach(cb => cb.checked = isChecked);
    
    document.querySelectorAll('.task-list-container').forEach(container => {
        if (isChecked) {
            container.classList.add('hide-completed');
        } else {
            container.classList.remove('hide-completed');
        }
    });
}

window.toggleTaskContainerExpand = function(containerId, btnElement) {
    window.expandedTaskContainers = window.expandedTaskContainers || new Set();
    const container = document.getElementById(containerId);
    if (!container) return;

    if (window.expandedTaskContainers.has(containerId)) {
        window.expandedTaskContainers.delete(containerId);
        container.style.maxHeight = "280px";
        if (btnElement) btnElement.innerText = "Tümünü Göster";
    } else {
        window.expandedTaskContainers.add(containerId);
        container.style.maxHeight = "none";
        if (btnElement) btnElement.innerText = "Gizle";
    }
}