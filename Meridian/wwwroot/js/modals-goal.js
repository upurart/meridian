function openMainGoalModal(projectId, mainGoal = null) {
    const form = document.getElementById("maingoal-form");
    form.reset();

    document.getElementById("maingoal-project-id").value = projectId;

    if (mainGoal) {
        document.getElementById("maingoal-modal-title").innerText = "Ana Hedefi Düzenle";
        document.getElementById("maingoal-modal-id").value = mainGoal.id;
        document.getElementById("maingoal-title").value = mainGoal.title;
        document.getElementById("maingoal-desc").value = mainGoal.description;
        document.getElementById("maingoal-completed").checked = mainGoal.isCompleted;
        document.getElementById("maingoal-completed").parentElement.style.display = "flex";
    } else {
        document.getElementById("maingoal-modal-title").innerText = "Yeni Ana Hedef Ekle";
        document.getElementById("maingoal-modal-id").value = "";
        document.getElementById("maingoal-completed").checked = false;
        document.getElementById("maingoal-completed").parentElement.style.display = "none";
    }
    openModal("maingoal-modal");
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

    if (subGoal) {
        document.getElementById("subgoal-modal-title").innerText = "Alt Hedefi Düzenle";
        document.getElementById("subgoal-modal-id").value = subGoal.id;
        document.getElementById("subgoal-title").value = subGoal.title;
        document.getElementById("subgoal-desc").value = subGoal.description;
        document.getElementById("subgoal-completed").checked = subGoal.isCompleted;
        document.getElementById("subgoal-completed").parentElement.style.display = "flex";
    } else {
        document.getElementById("subgoal-modal-title").innerText = "Yeni Alt Hedef Ekle";
        document.getElementById("subgoal-modal-id").value = "";
        document.getElementById("subgoal-completed").checked = false;
        document.getElementById("subgoal-completed").parentElement.style.display = "none";
    }
    openModal("subgoal-modal");
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
