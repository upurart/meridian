
// DRAG AND DROP
let fmDragSourceItems = [];

window.fmDragStart = function(e, type, id) {
    if (!selectedItems.find(i => i.type === type && i.id === id)) {
        fmClearSelection();
        selectedItems = [{ type, id }];
        fmUpdateSelectionUI();
    }
    
    fmDragSourceItems = [...selectedItems];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(fmDragSourceItems));
}

window.fmDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

window.fmDragEnter = function(e) {
    e.preventDefault();
    const item = e.currentTarget;
    if (item.getAttribute('data-type') === 'folder') {
        item.style.outline = '2px dashed var(--color-primary)';
        item.style.outlineOffset = '-2px';
        item.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    }
}

window.fmDragLeave = function(e) {
    const item = e.currentTarget;
    if (e.relatedTarget && item.contains(e.relatedTarget)) return;

    item.style.outline = 'none';
    if (!item.classList.contains('selected')) {
        item.style.backgroundColor = 'transparent';
    } else {
        item.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
    }
}

window.fmDrop = async function(e, targetFolderId) {
    e.preventDefault();
    e.stopPropagation();
    
    const item = e.currentTarget;
    item.style.outline = 'none';
    if (!item.classList.contains('selected')) {
        item.style.backgroundColor = 'transparent';
    } else {
        item.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
    }
    
    if (fmDragSourceItems.length === 0) return;
    
    if (fmDragSourceItems.find(i => i.type === 'folder' && i.id === targetFolderId)) {
        return;
    }
    
    const targetFolder = fmCurrentFolders.find(f => f.id === targetFolderId);
    const isTrashBin = targetFolder && targetFolder.isSystemFolder && targetFolder.name === 'Çöp Kutusu';
    
    if (isTrashBin) {
        // Handle dropping into trash bin as a deletion
        const msg = "Seçili öğeleri çöp kutusuna taşımak istediğinize emin misiniz?";
        if(!confirm(msg)) return;
        
        let hasError = false;
        
        for (const draggedItem of fmDragSourceItems) {
            try {
                const endpoint = draggedItem.type === 'folder' ? `/api/filemanager/folder/${draggedItem.id}` : `/api/filemanager/file/${draggedItem.id}`;
                const res = await fetch(endpoint, { method: "DELETE" });
                if (!res.ok) {
                    hasError = true;
                }
            } catch (err) {
                console.error(err);
                hasError = true;
            }
        }
        
        if (hasError) {
            alert("Bazı öğeler silinemedi (korumalı veya sistem klasörü olabilir).");
        }
        fmRefresh();
        return;
    }
    
    try {
        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
        const res = await fetch('/api/filemanager/paste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': token },
            body: JSON.stringify({
                action: 'cut',
                targetFolderId: targetFolderId,
                items: fmDragSourceItems
            })
        });
        
        if (res.ok) {
            fmRefresh();
        } else {
            const err = await res.json();
            alert(err.message || "Taşıma işlemi başarısız oldu.");
        }
    } catch (err) {
        console.error(err);
        alert("Bir ağ hatası oluştu.");
    }
}
