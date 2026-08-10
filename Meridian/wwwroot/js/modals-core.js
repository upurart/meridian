function openDeleteModal(type, id, event = null) {
    if (event) {
        event.stopPropagation(); // Stop sidebar click navigation
    }

    const confirmBtn = document.getElementById("delete-confirm-btn");
    let itemLabel = "ögeyi";
    if (type === 'project') itemLabel = "projeyi";
    else if (type === 'maingoal') itemLabel = "ana hedefi";
    else if (type === 'subgoal') itemLabel = "alt hedefi";
    else if (type === 'task') itemLabel = "görevi";

    document.getElementById("delete-message").innerText = `Bu ${itemLabel} ve altındaki tüm alt ögeleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`;

    confirmBtn.onclick = async () => {
        try {
            const res = await fetch(`/api/dashboard/${type}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();

            closeModal("delete-modal");
            showToast("Silme işlemi başarıyla tamamlandı.");

            if (type === 'project' && activeProjectId === id) {
                showDashboardHome();
            }
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Silme işlemi gerçekleştirilirken hata oluştu.", "danger");
        }
    };

    openModal("delete-modal");
}

window.toggleInitialStructurePanel = function() {
    const panel = document.getElementById("initial-structure-panel");
    const caret = document.getElementById("initial-structure-caret");
    if (!panel) return;
    if (panel.style.display === "none") {
        panel.style.display = "flex";
        if (caret) caret.innerHTML = '<i class="bi bi-caret-up-fill"></i>';
    } else {
        panel.style.display = "none";
        if (caret) caret.innerHTML = '<i class="bi bi-caret-down-fill"></i>';
    }
};
