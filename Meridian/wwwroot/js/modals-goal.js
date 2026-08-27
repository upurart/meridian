function openMainGoalModal(projectId, mainGoal = null) {
    const form = document.getElementById("maingoal-form");
    form.reset();

    document.getElementById("maingoal-project-id").value = projectId;

    switchMainGoalTab('general');
    const tabFilesBtn = document.getElementById("tab-btn-maingoal-files");

    if (mainGoal) {
        document.getElementById("maingoal-modal-title").innerText = "Ana Hedefi Düzenle";
        document.getElementById("maingoal-modal-id").value = mainGoal.id;
        document.getElementById("maingoal-title").value = mainGoal.title;
        document.getElementById("maingoal-desc").value = mainGoal.description;
        document.getElementById("maingoal-completed").checked = mainGoal.isCompleted;
        document.getElementById("maingoal-completed").parentElement.style.display = "flex";
        
        if (tabFilesBtn) tabFilesBtn.style.display = "block";
    } else {
        document.getElementById("maingoal-modal-title").innerText = "Yeni Ana Hedef Ekle";
        document.getElementById("maingoal-modal-id").value = "";
        document.getElementById("maingoal-completed").checked = false;
        document.getElementById("maingoal-completed").parentElement.style.display = "none";
        
        if (tabFilesBtn) tabFilesBtn.style.display = "none";
    }
    openModal("maingoal-modal");
}

function switchMainGoalTab(tab) {
    const tabGen = document.getElementById("tab-btn-maingoal-general");
    const tabFil = document.getElementById("tab-btn-maingoal-files");
    const contentGen = document.getElementById("maingoal-tab-general");
    const contentFil = document.getElementById("maingoal-tab-files");
    const footerBtn = document.querySelector("#maingoal-modal .tm-modal-footer button[type='submit']");
    
    if (!tabGen || !contentGen) return;

    if (tab === 'general') {
        tabGen.classList.add("active");
        tabGen.style.borderColor = "var(--primary-color)";
        tabGen.style.color = "var(--primary-color)";
        tabFil.classList.remove("active");
        tabFil.style.borderColor = "transparent";
        tabFil.style.color = "var(--text-secondary)";
        
        contentGen.style.display = "block";
        contentFil.style.display = "none";
        if (footerBtn) footerBtn.style.display = "block"; 
    } else {
        tabFil.classList.add("active");
        tabFil.style.borderColor = "var(--primary-color)";
        tabFil.style.color = "var(--primary-color)";
        tabGen.classList.remove("active");
        tabGen.style.borderColor = "transparent";
        tabGen.style.color = "var(--text-secondary)";
        
        contentGen.style.display = "none";
        contentFil.style.display = "block";
        if (footerBtn) footerBtn.style.display = "none"; 
        
        const mgId = document.getElementById("maingoal-modal-id").value;
        if (mgId) {
            loadMainGoalFiles(mgId);
        }
    }
}

window.currentMainGoalFolderId = null;

async function loadMainGoalFiles(id) {
    const listEl = document.getElementById("maingoal-files-list");
    listEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Yükleniyor...</span>`;
    
    try {
        const res = await fetch(`/api/dashboard/maingoal/${id}/files`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        window.currentMainGoalFolderId = data.folderId;
        renderTaskFiles(data.files, 'maingoal'); 
    } catch {
        listEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--color-danger);">Dosyalar yüklenirken hata oluştu.</span>`;
    }
}

async function handleMainGoalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("maingoal-modal-id").value;
    const projectId = parseInt(document.getElementById("maingoal-project-id").value);
    const title = document.getElementById("maingoal-title").value.trim();
    const description = document.getElementById("maingoal-desc").value.trim();
    const isCompleted = document.getElementById("maingoal-completed").checked;

    const payload = { projectId, title, description, isCompleted };
    const url = id ? `/api/dashboard/maingoal/${id}` : "/api/dashboard/maingoal";
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error();

        closeModal("maingoal-modal");
        showToast("Ana hedef başarıyla kaydedildi.");
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Ana hedef kaydedilirken hata oluştu.", "danger");
    }
}


function openSubGoalModal(mainGoalId, subGoal = null, projectId = null) {
    const form = document.getElementById("subgoal-form");
    form.reset();

    document.getElementById("subgoal-maingoal-id").value = mainGoalId || "";
    document.getElementById("subgoal-project-id").value = projectId || "";

    switchSubGoalTab('general');
    const tabFilesBtn = document.getElementById("tab-btn-subgoal-files");

    if (subGoal) {
        document.getElementById("subgoal-modal-title").innerText = "Alt Hedefi Düzenle";
        document.getElementById("subgoal-modal-id").value = subGoal.id;
        document.getElementById("subgoal-title").value = subGoal.title;
        document.getElementById("subgoal-desc").value = subGoal.description;
        document.getElementById("subgoal-completed").checked = subGoal.isCompleted;
        document.getElementById("subgoal-completed").parentElement.style.display = "flex";
        
        if (tabFilesBtn) tabFilesBtn.style.display = "block";
    } else {
        document.getElementById("subgoal-modal-title").innerText = "Yeni Alt Hedef Ekle";
        document.getElementById("subgoal-modal-id").value = "";
        document.getElementById("subgoal-completed").checked = false;
        document.getElementById("subgoal-completed").parentElement.style.display = "none";
        
        if (tabFilesBtn) tabFilesBtn.style.display = "none";
    }
    openModal("subgoal-modal");
}

function switchSubGoalTab(tab) {
    const tabGen = document.getElementById("tab-btn-subgoal-general");
    const tabFil = document.getElementById("tab-btn-subgoal-files");
    const contentGen = document.getElementById("subgoal-tab-general");
    const contentFil = document.getElementById("subgoal-tab-files");
    const footerBtn = document.querySelector("#subgoal-modal .tm-modal-footer button[type='submit']");
    
    if (!tabGen || !contentGen) return;

    if (tab === 'general') {
        tabGen.classList.add("active");
        tabGen.style.borderColor = "var(--primary-color)";
        tabGen.style.color = "var(--primary-color)";
        tabFil.classList.remove("active");
        tabFil.style.borderColor = "transparent";
        tabFil.style.color = "var(--text-secondary)";
        
        contentGen.style.display = "block";
        contentFil.style.display = "none";
        if (footerBtn) footerBtn.style.display = "block"; 
    } else {
        tabFil.classList.add("active");
        tabFil.style.borderColor = "var(--primary-color)";
        tabFil.style.color = "var(--primary-color)";
        tabGen.classList.remove("active");
        tabGen.style.borderColor = "transparent";
        tabGen.style.color = "var(--text-secondary)";
        
        contentGen.style.display = "none";
        contentFil.style.display = "block";
        if (footerBtn) footerBtn.style.display = "none"; 
        
        const sgId = document.getElementById("subgoal-modal-id").value;
        if (sgId) {
            loadSubGoalFiles(sgId);
        }
    }
}

window.currentSubGoalFolderId = null;

async function loadSubGoalFiles(id) {
    const listEl = document.getElementById("subgoal-files-list");
    listEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Yükleniyor...</span>`;
    
    try {
        const res = await fetch(`/api/dashboard/subgoal/${id}/files`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        window.currentSubGoalFolderId = data.folderId;
        renderTaskFiles(data.files, 'subgoal'); 
    } catch {
        listEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--color-danger);">Dosyalar yüklenirken hata oluştu.</span>`;
    }
}

async function handleSubGoalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("subgoal-modal-id").value;
    const mainGoalIdVal = document.getElementById("subgoal-maingoal-id").value;
    const projectIdVal = document.getElementById("subgoal-project-id").value;
    const mainGoalId = mainGoalIdVal ? parseInt(mainGoalIdVal) : null;
    const projectId = projectIdVal ? parseInt(projectIdVal) : null;
    const title = document.getElementById("subgoal-title").value.trim();
    const description = document.getElementById("subgoal-desc").value.trim();
    const isCompleted = document.getElementById("subgoal-completed").checked;

    const payload = { mainGoalId, projectId, title, description, isCompleted };
    const url = id ? `/api/dashboard/subgoal/${id}` : "/api/dashboard/subgoal";
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error();

        closeModal("subgoal-modal");
        showToast("Alt hedef başarıyla kaydedildi.");
        await triggerGlobalRefresh();
    } catch (err) {
        showToast("Alt hedef kaydedilirken hata oluştu.", "danger");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Dropzones setup
    if (typeof setupDropzone === 'function') {
        setupDropzone("maingoal-files-dropzone", "maingoal-files-input", (files) => {
            if (typeof uploadFilesBase === 'function') {
                uploadFilesBase(files, window.currentMainGoalFolderId, () => {
                    const id = document.getElementById("maingoal-modal-id").value;
                    if (id) loadMainGoalFiles(id);
                });
            }
        });
        
        setupDropzone("subgoal-files-dropzone", "subgoal-files-input", (files) => {
            if (typeof uploadFilesBase === 'function') {
                uploadFilesBase(files, window.currentSubGoalFolderId, () => {
                    const id = document.getElementById("subgoal-modal-id").value;
                    if (id) loadSubGoalFiles(id);
                });
            }
        });
    }
});