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
    
    // Tüm checkboxları güncelle
    document.querySelectorAll('input[onchange="toggleCompletedTasksGlobal(event)"]').forEach(cb => cb.checked = isChecked);
    
    // tüm görev containerlarını güncelle
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
