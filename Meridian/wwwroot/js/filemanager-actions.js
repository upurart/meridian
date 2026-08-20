// ----------------
// Toolbar Actions
// ----------------

document.getElementById("fm-btn-delete").onclick = async function() {
    if (selectedItems.length === 0) return;
    if (!confirm(`${selectedItems.length} öğeyi silmek istediğinize emin misiniz?`)) return;
    
    for (const item of selectedItems) {
        const url = item.type === 'folder' ? `/api/filemanager/folder/${item.id}` : `/api/filemanager/file/${item.id}`;
        try { await fetch(url, { method: "DELETE" }); } catch(e) { console.error(e); }
    }
    fmLoadContents(currentFolderId);
};

document.getElementById("fm-btn-rename").onclick = async function() {
    if (selectedItems.length !== 1) return;
    const item = selectedItems[0];
    
    const el = document.querySelector(`.fm-grid-item[data-type="${item.type}"][data-id="${item.id}"]`);
    if (!el) return;
    
    const nameDiv = el.querySelector('div[title]');
    const currentNameFull = nameDiv.innerText;
    
    let currentNameBase = currentNameFull;
    let extension = "";
    
    if (item.type === 'file') {
        const lastDot = currentNameFull.lastIndexOf('.');
        if (lastDot > 0) {
            extension = currentNameFull.substring(lastDot);
            currentNameBase = currentNameFull.substring(0, lastDot);
        }
    }
    
    const renameContainer = document.createElement("div");
    renameContainer.style.display = "flex";
    renameContainer.style.alignItems = "flex-start";
    renameContainer.style.justifyContent = fmCurrentView === 'wide' ? "center" : "flex-start";
    renameContainer.style.marginTop = fmCurrentView === 'wide' ? "2px" : "0";
    renameContainer.style.width = "100%";
    renameContainer.style.flex = "1";
    
    const ta = document.createElement("span");
    ta.contentEditable = "true";
    ta.innerText = currentNameBase;
    ta.style.display = "inline-block";
    ta.style.minWidth = "20px";
    ta.style.maxWidth = fmCurrentView === 'wide' ? "100%" : "350px";
    ta.style.lineHeight = "1.2";
    ta.style.textAlign = fmCurrentView === 'wide' ? "center" : "left";
    ta.style.fontSize = "0.95rem";
    ta.style.fontWeight = "500";
    ta.style.color = "var(--text-primary)";
    ta.style.backgroundColor = "var(--bg-surface)";
    ta.style.border = "1px solid var(--color-primary)";
    ta.style.borderRadius = "4px";
    ta.style.outline = "none";
    ta.style.padding = "0px 4px";
    ta.style.boxSizing = "border-box";
    ta.style.wordBreak = "break-word";
    ta.style.whiteSpace = "pre-wrap";
    
    renameContainer.appendChild(ta);
    
    if (extension) {
        const extSpan = document.createElement("span");
        extSpan.innerText = extension;
        extSpan.style.color = "var(--text-muted)";
        extSpan.style.fontSize = "0.95rem";
        extSpan.style.marginLeft = "2px";
        extSpan.style.userSelect = "none";
        extSpan.style.flexShrink = "0";
        extSpan.style.lineHeight = "1.2";
        extSpan.style.paddingTop = "1px"; // align slightly with textarea text
        renameContainer.appendChild(extSpan);
    }
    
    nameDiv.style.display = "none";
    nameDiv.parentNode.insertBefore(renameContainer, nameDiv.nextSibling);
    
    ta.focus();
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    let isSubmitting = false;
    
    const finishRename = async () => {
        if (isSubmitting) return;
        isSubmitting = true;
        
        const newNameBase = ta.innerText.trim();
        const newName = newNameBase + extension;
        
        if (!newNameBase || newName === currentNameFull) {
            renameContainer.remove();
            nameDiv.style.display = ""; 
            return;
        }
        
        ta.contentEditable = "false";
        ta.style.opacity = "0.5";
        try {
            const res = await fetch("/api/filemanager/rename", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: item.type, id: item.id, newName: newName })
            });
            if (res.ok) {
                fmLoadContents(currentFolderId);
            } else {
                const err = await res.json();
                alert(err.message || "Yeniden adlandırılamadı.");
                renameContainer.remove();
                nameDiv.style.display = ""; 
            }
        } catch(e) { 
            console.error(e); 
            renameContainer.remove();
            nameDiv.style.display = ""; 
        }
    };
    
    ta.addEventListener("blur", finishRename);
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ta.blur();
        }
        if (e.key === "Escape") {
            isSubmitting = true; 
            renameContainer.remove();
            nameDiv.style.display = ""; 
        }
    });
    
    ta.addEventListener("click", e => e.stopPropagation());
    ta.addEventListener("dblclick", e => e.stopPropagation());
};

document.getElementById("fm-btn-cut").onclick = function() {
    if (selectedItems.length === 0) return;
    fmClipboard = { action: 'cut', items: [...selectedItems] };
    fmClearSelection();
};

document.getElementById("fm-btn-copy").onclick = function() {
    if (selectedItems.length === 0) return;
    fmClipboard = { action: 'copy', items: [...selectedItems] };
    fmClearSelection();
};

document.getElementById("fm-btn-paste").onclick = async function() {
    if (fmClipboard.items.length === 0) return;
    
    try {
        const res = await fetch("/api/filemanager/paste", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: fmClipboard.action,
                targetFolderId: currentFolderId,
                items: fmClipboard.items
            })
        });
        if(res.ok) {
            if (fmClipboard.action === 'cut') {
                fmClipboard = { action: null, items: [] }; // clear after cut
            }
            fmLoadContents(currentFolderId);
        } else {
            const err = await res.json();
            alert(err.message || "Yapıştırılamadı.");
        }
    } catch(e) { console.error(e); }
};

document.getElementById("fm-btn-delete").onclick = async function() {
    if (selectedItems.length === 0) return;
    
    const isTrash = folderPathNames.length > 0 && folderPathNames[0] === 'Çöp Kutusu';
    const forceStr = isTrash ? "?force=true" : "";
    
    const msg = isTrash 
        ? `${selectedItems.length} öğeyi kalıcı olarak silmek istediğinize emin misiniz? (Bu işlem geri alınamaz)` 
        : `${selectedItems.length} öğeyi çöp kutusuna taşımak istediğinize emin misiniz?`;
        
    if (!confirm(msg)) return;
    
    for (const item of selectedItems) {
        const url = item.type === 'folder' ? `/api/filemanager/folder/${item.id}${forceStr}` : `/api/filemanager/file/${item.id}${forceStr}`;
        try { 
            const res = await fetch(url, { method: "DELETE" }); 
            if (!res.ok) console.error("Silinemedi:", item);
        } catch(e) { console.error(e); }
    }
    
    fmClearSelection();
    fmLoadContents(currentFolderId);
};

document.getElementById("fm-btn-restore").onclick = async function() {
    if (selectedItems.length === 0) return;
    
    try {
        const res = await fetch("/api/filemanager/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: selectedItems })
        });
        if(res.ok) {
            fmClearSelection();
            fmLoadContents(currentFolderId);
        } else {
            const err = await res.json();
            alert(err.message || "Geri yüklenemedi.");
        }
    } catch(e) { console.error(e); }
};

let fmForwardHistory = [];

function fmGoBack() {
    if (folderHistory.length > 0) {
        const poppedId = folderHistory.pop();
        const poppedName = folderPathNames.pop();
        
        fmForwardHistory.push({ id: poppedId, name: poppedName });
        
        const prevId = folderHistory.length > 0 ? folderHistory[folderHistory.length - 1] : null;
        const prevName = folderPathNames.length > 0 ? folderPathNames[folderPathNames.length - 1] : null;
        
        fmLoadContents(prevId, prevName, true);
    }
}

function fmGoForward() {
    if (fmForwardHistory.length > 0) {
        const target = fmForwardHistory.pop();
        fmLoadContents(target.id, target.name, true);
    }
}

async function fmRefresh() {
    if (typeof currentFolderId === 'undefined') return;
    
    const btn = document.getElementById("fm-btn-refresh");
    const dropZone = document.getElementById("fm-drop-zone");
    
    if (btn) {
        btn.style.transform = "rotate(360deg)";
        btn.style.pointerEvents = "none";
        btn.style.opacity = "0.5";
    }
    
    if (dropZone) {
        dropZone.style.transition = "opacity 0.2s ease";
        dropZone.style.opacity = "0.4";
        dropZone.style.pointerEvents = "none";
    }
    
    // Yükleme çok hızlı bittiği için geçiş animasyonunu kullanıcının görebilmesi adına 
    // minimum 300ms yapay bir gecikme ekliyoruz (özellikle yerel sunucularda test ederken).
    await new Promise(r => setTimeout(r, 300));
    
    await fmLoadContents(currentFolderId);
    
    if (dropZone) {
        dropZone.style.opacity = "";
        dropZone.style.pointerEvents = "";
    }
    
    if (btn) {
        setTimeout(() => {
            btn.style.transition = "none";
            btn.style.transform = "rotate(0deg)";
            btn.style.pointerEvents = "auto";
            btn.style.opacity = "1";
            
            // Restore smooth transition after reset
            setTimeout(() => {
                btn.style.transition = "color 0.2s ease, transform 0.4s ease";
            }, 50);
        }, 100); // Because we already waited 300ms, we only wait 100ms more for the 400ms transition to finish
    }
}

let fmIsDetailsDrawerOpen = false;

function fmToggleDetailsDrawer() {
    console.log("Ayrıntılar butonuna tıklandı!");
    fmIsDetailsDrawerOpen = !fmIsDetailsDrawerOpen;
    
    const drawer = document.getElementById("fm-details-drawer");
    const btn = document.getElementById("fm-btn-details");
    
    console.log("Drawer bulundu mu?:", drawer);
    console.log("Buton bulundu mu?:", btn);
    
    if (drawer) {
        drawer.style.display = fmIsDetailsDrawerOpen ? "flex" : "none";
    } else {
        alert("Çekmece HTML elementi bulunamadı!");
    }
    
    if (btn) {
        if (fmIsDetailsDrawerOpen) {
            btn.classList.add("active");
            btn.style.backgroundColor = "var(--bg-surface-hover)";
            btn.style.color = "#ffffff";
        } else {
            btn.classList.remove("active");
            btn.style.backgroundColor = "transparent";
            btn.style.color = "var(--text-secondary)";
        }
    }
    
    if (fmIsDetailsDrawerOpen) {
        fmUpdateDetailsDrawer();
    }
}

function fmUpdateDetailsDrawer() {
    if (!fmIsDetailsDrawerOpen) return;
    
    const content = document.getElementById("fm-details-content");
    if (!content) return;
    
    if (selectedItems.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding-top: 40px;">
                <i class="bi bi-info-circle" style="font-size: 2.5rem; opacity: 0.5;"></i>
                <p style="margin-top: 12px; font-size: 0.85rem;">Ayrıntılarını görmek için bir öğe seçin.</p>
            </div>
        `;
        return;
    }
    
    if (selectedItems.length > 1) {
        content.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding-top: 40px;">
                <i class="bi bi-collection" style="font-size: 2.5rem; opacity: 0.5;"></i>
                <p style="margin-top: 12px; font-size: 0.85rem; font-weight: 500;">${selectedItems.length} öğe seçildi</p>
            </div>
        `;
        return;
    }
    
    const item = selectedItems[0];
    let dataObj = null;
    let iconHtml = '';
    let typeName = '';
    
    if (item.type === 'folder') {
        dataObj = fmCurrentFolders.find(f => f.id === item.id);
        iconHtml = `<i class="bi bi-folder-fill" style="font-size: 4rem; color: var(--color-primary);"></i>`;
        typeName = "Klasör";
    } else {
        dataObj = fmCurrentFiles.find(f => f.id === item.id);
        const ext = dataObj.name.includes('.') ? dataObj.name.split('.').pop().toLowerCase() : '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
        
        if (isImage && dataObj.fileUrl) {
            iconHtml = `<div style="width:100%; height:120px; display:flex; align-items:center; justify-content:center; background:var(--bg-surface); border-radius:8px; overflow:hidden;"><img src="${dataObj.fileUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><i class="bi bi-file-earmark-image" style="font-size: 4rem; color: var(--text-secondary); display: none;"></i></div>`;
        } else {
            let iconClass = "bi-file-earmark";
            if (['pdf'].includes(ext)) iconClass = "bi-file-earmark-pdf";
            else if (['doc', 'docx'].includes(ext)) iconClass = "bi-file-earmark-word";
            else if (['xls', 'xlsx'].includes(ext)) iconClass = "bi-file-earmark-excel";
            else if (['ppt', 'pptx'].includes(ext)) iconClass = "bi-file-earmark-ppt";
            else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) iconClass = "bi-file-earmark-zip";
            else if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) iconClass = "bi-file-earmark-play";
            else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) iconClass = "bi-file-earmark-music";
            else if (['txt', 'csv', 'md'].includes(ext)) iconClass = "bi-file-earmark-text";
            else if (['html', 'css', 'js', 'json', 'xml'].includes(ext)) iconClass = "bi-file-earmark-code";
            
            iconHtml = `<div style="width:100%; height:120px; display:flex; align-items:center; justify-content:center; background:var(--bg-surface); border-radius:8px;"><i class="bi ${iconClass}" style="font-size: 4rem; color: var(--text-secondary);"></i></div>`;
        }
        
        typeName = ext ? `${ext.toUpperCase()} Dosyası` : "Dosya";
    }
    
    if (!dataObj) return;
    
    const createdStr = dataObj.createdAt ? new Date(dataObj.createdAt).toLocaleString('tr-TR') : '-';
    const updatedStr = dataObj.updatedAt ? new Date(dataObj.updatedAt).toLocaleString('tr-TR') : createdStr;
    const sizeStr = item.type === 'folder' ? '-' : `${(dataObj.sizeInBytes / 1024).toFixed(1)} KB`;
    
    let pathLabel = "Ana Dizin";
    if (folderPathNames.length > 0) {
        pathLabel = folderPathNames.join(' / ');
    }
    
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            ${iconHtml}
        </div>
        
        <h5 style="margin-bottom: 24px; font-size: 1.05rem; font-weight: 600; color: var(--text-primary); word-break: break-word;">${dataObj.name}</h5>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Tür</div>
                <div style="font-size: 0.85rem; color: var(--text-primary);">${typeName}</div>
            </div>
            
            ${item.type === 'folder' ? '' : `
            <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Boyut</div>
                <div style="font-size: 0.85rem; color: var(--text-primary);">${sizeStr}</div>
            </div>
            `}
            
            <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Oluşturulma Tarihi</div>
                <div style="font-size: 0.85rem; color: var(--text-primary);">${createdStr}</div>
            </div>
            
            <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Değiştirilme Tarihi</div>
                <div style="font-size: 0.85rem; color: var(--text-primary);">${updatedStr}</div>
            </div>
            
            <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Konum</div>
                <div style="font-size: 0.85rem; color: var(--text-primary); word-break: break-word;">${pathLabel}</div>
            </div>
        </div>
    `;
}

function fmPreviewImage(url) {
    const modal = document.getElementById('fm-image-modal');
    const img = document.getElementById('fm-image-modal-img');
    if (modal && img) {
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        img.src = url;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

async function fmUploadFile(eventOrFiles) {
    let files = [];
    if (eventOrFiles.target && eventOrFiles.target.files) {
        files = Array.from(eventOrFiles.target.files);
    } else if (eventOrFiles instanceof FileList || Array.isArray(eventOrFiles)) {
        files = Array.from(eventOrFiles);
    }
    
    if (files.length === 0) return;
    
    const uploadOverlay = document.getElementById("fm-upload-overlay");
    const uploadText = document.getElementById("fm-upload-overlay-text");
    if (uploadOverlay) {
        uploadOverlay.style.display = 'flex';
        if (uploadText) {
            uploadText.innerText = files.length > 1 ? `${files.length} Dosya Yükleniyor...` : `Dosya Yükleniyor...`;
        }
    }
    
    // Paralel Yükleme: Tek tek beklemek yerine hepsi aynı anda başlar
    const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append("file", file);
        if(currentFolderId) formData.append("folderId", currentFolderId);

        return fetch("/api/filemanager/upload", {
            method: "POST",
            body: formData
        }).then(async res => {
            if(res.ok) {
                return true;
            } else {
                const err = await res.json();
                console.error("Yükleme hatası:", err.message);
                return false;
            }
        }).catch(e => {
            console.error(e);
            return false;
        });
    });
    
    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(r => r === true).length;
    
    if (uploadOverlay) {
        uploadOverlay.style.display = 'none';
    }
    
    if (successCount > 0) {
        fmLoadContents(currentFolderId);
    }
    if (successCount < files.length) {
        alert(`${files.length - successCount} dosya yüklenemedi.`);
    }
    
    const fileInput = document.getElementById("fm-file-upload");
    if (fileInput) fileInput.value = "";
}

const fmDropZone = document.getElementById("fm-drop-zone");
const fmDragOverlay = document.getElementById("fm-drag-overlay");

if (fmDropZone && fmDragOverlay) {
    fmDropZone.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        fmDragOverlay.style.display = 'flex';
    });

    fmDropZone.addEventListener('dragleave', (e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        if (!fmDropZone.contains(e.relatedTarget)) {
            fmDragOverlay.style.display = 'none';
        }
    });

    fmDropZone.addEventListener('drop', (e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        fmDragOverlay.style.display = 'none';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fmUploadFile(e.dataTransfer.files);
        }
    });
}

async function fmOpenCreateFolderModal() {
    const name = await fmPromptModal("Yeni Klasör Adı");
    if (name) {
        fmCreateFolder(name);
    }
}

function fmPromptModal(title, defaultValue = "") {
    return new Promise((resolve) => {
        const modal = document.getElementById("fm-input-modal");
        const titleEl = document.getElementById("fm-input-modal-title");
        const inputEl = document.getElementById("fm-input-modal-value");
        const submitBtn = document.getElementById("fm-input-modal-submit");
        const closeBtn = document.getElementById("fm-input-modal-close");
        const cancelBtn = document.getElementById("fm-input-modal-cancel");
        
        if (!modal || !titleEl || !inputEl || !submitBtn) {
            resolve(prompt(title, defaultValue));
            return;
        }
        
        titleEl.innerText = title;
        inputEl.value = defaultValue;
        openModal("fm-input-modal");
        
        setTimeout(() => {
            inputEl.focus();
            inputEl.select();
        }, 50);
        
        const cleanup = () => {
            closeModal("fm-input-modal");
            submitBtn.removeEventListener("click", onSubmit);
            closeBtn.removeEventListener("click", onCancel);
            cancelBtn.removeEventListener("click", onCancel);
            inputEl.removeEventListener("keydown", onKeydown);
        };
        
        const onSubmit = () => {
            const val = inputEl.value.trim();
            cleanup();
            resolve(val || null);
        };
        
        const onCancel = () => {
            cleanup();
            resolve(null);
        };
        
        const onKeydown = (e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
        };
        
        submitBtn.addEventListener("click", onSubmit);
        closeBtn.addEventListener("click", onCancel);
        cancelBtn.addEventListener("click", onCancel);
        inputEl.addEventListener("keydown", onKeydown);
    });
}

async function fmCreateFolder(name) {
    try {
        const res = await fetch("/api/filemanager/folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, parentFolderId: currentFolderId })
        });
        if(res.ok) {
            fmLoadContents(currentFolderId);
        } else {
            const err = await res.json();
            alert(err.message || "Klasör oluşturulamadı.");
        }
    } catch(e) {
        console.error("Yükleme hatası", e);
    }
}

let fmSearchTimeout = null;
async function fmHandleSearch(query) {
    if (fmSearchTimeout) clearTimeout(fmSearchTimeout);
    fmSearchTimeout = setTimeout(async () => {
        const val = query.trim();
        const emptyState = document.getElementById("fm-empty-state");
        const emptyText = emptyState.querySelector('p');
        
        if (!val) {
            emptyText.innerText = "Bu klasör boş.";
            await fmLoadContents(currentFolderId);
            return;
        }
        
        const url = currentFolderId 
            ? `/api/filemanager/search?folderId=${currentFolderId}&query=${encodeURIComponent(val)}`
            : `/api/filemanager/search?query=${encodeURIComponent(val)}`;
            
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                fmRenderGrid(data.folders, data.files);
                if (data.folders.length === 0 && data.files.length === 0) {
                    emptyText.innerText = `"${val}" için arama sonucu bulunamadı.`;
                }
            }
        } catch(e) {
            console.error("Arama hatası", e);
        }
    }, 300);
}

async function fmDeleteFolder(id) {
    const isTrash = folderPathNames.length > 0 && folderPathNames[0] === 'Çöp Kutusu';
    const forceStr = isTrash ? "?force=true" : "";
    
    const msg = isTrash 
        ? `Bu klasörü kalıcı olarak silmek istediğinize emin misiniz? (Bu işlem geri alınamaz)` 
        : `Bu klasörü çöp kutusuna taşımak istediğinize emin misiniz? Altındaki tüm klasör ve dosyalar da taşınacak.`;
        
    if(!confirm(msg)) return;
    
    // Optimistic UI Update
    const originalFolders = [...fmCurrentFolders];
    fmCurrentFolders = fmCurrentFolders.filter(f => f.id !== id);
    fmRenderGrid(fmCurrentFolders, fmCurrentFiles, false);
    
    try {
        const res = await fetch(`/api/filemanager/folder/${id}${forceStr}`, { method: "DELETE" });
        if(!res.ok) {
            throw new Error("Silinemedi");
        }
    } catch(e) { 
        console.error(e);
        // Revert UI on failure
        fmCurrentFolders = originalFolders;
        fmRenderGrid(fmCurrentFolders, fmCurrentFiles, false);
        alert("Silme işlemi başarısız oldu.");
    }
}

async function fmDeleteFile(id) {
    const isTrash = folderPathNames.length > 0 && folderPathNames[0] === 'Çöp Kutusu';
    const forceStr = isTrash ? "?force=true" : "";
    
    const msg = isTrash 
        ? `Bu dosyayı kalıcı olarak silmek istediğinize emin misiniz? (Bu işlem geri alınamaz)` 
        : `Bu dosyayı çöp kutusuna taşımak istediğinize emin misiniz?`;
        
    if(!confirm(msg)) return;
    
    // Optimistic UI Update
    const originalFiles = [...fmCurrentFiles];
    fmCurrentFiles = fmCurrentFiles.filter(f => f.id !== id);
    fmRenderGrid(fmCurrentFolders, fmCurrentFiles, false);
    
    try {
        const res = await fetch(`/api/filemanager/file/${id}${forceStr}`, { method: "DELETE" });
        if(!res.ok) {
            throw new Error("Silinemedi");
        }
    } catch(e) { 
        console.error(e);
        // Revert UI on failure
        fmCurrentFiles = originalFiles;
        fmRenderGrid(fmCurrentFolders, fmCurrentFiles, false);
        alert("Silme işlemi başarısız oldu.");
    }
}

async function fmDownloadSelected() {
    if (!selectedItems || selectedItems.length === 0) return;
    
    // Yükleme animasyonu
    const overlay = document.getElementById("fm-upload-overlay");
    const overlayText = document.getElementById("fm-upload-overlay-text");
    if (overlay && overlayText) {
        overlayText.innerText = "İndiriliyor...";
        overlay.style.display = "flex";
    }

    try {
        const res = await fetch("/api/filemanager/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: selectedItems })
        });
        
        if (!res.ok) {
            throw new Error("İndirme başarısız.");
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        
        let fileName = "meridian_download.zip";
        const disposition = res.headers.get('Content-Disposition');
        if (disposition && disposition.indexOf('filename=') !== -1) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
            if (matches != null && matches[1]) { 
                let rawName = matches[1].replace(/['"]/g, '');
                try {
                    fileName = decodeURIComponent(rawName);
                } catch(e) {
                    fileName = rawName;
                }
            }
        }
        
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = fileName;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch(e) {
        console.error(e);
        alert("İndirme işlemi sırasında bir hata oluştu.");
    } finally {
        if (overlay) overlay.style.display = "none";
    }
}

// Global window function hook for the sidebar menu click
window.showFileManagerView = function() {
    const views = ["home-view", "calendar-view", "workspaces-dashboard-view", "workspace-projects-view", "teams-dashboard-view", "workspace-view", "deleted-view", "activities-view", "profile-page-view", "files-view"];
    views.forEach(v => {
        const el = document.getElementById(v);
        if(el) el.style.display = "none";
    });
    const fv = document.getElementById("files-view");
    if(fv) fv.style.display = "flex";
    initFileManager();
}

function fmInitContextMenu() {
    const dropZone = document.getElementById('fm-drop-zone');
    const menu = document.getElementById('fm-context-menu');
    const ctxEmpty = document.getElementById('fm-ctx-empty');
    const ctxItem = document.getElementById('fm-ctx-item');
    
    if (!dropZone || !menu) return;
    
    // Hide menu on click outside
    document.addEventListener('click', () => {
        fmCloseContextMenu();
    });
    
    // Disable default context menu globally inside files-view
    const container = document.getElementById('files-view');
    if (container) {
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    dropZone.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        let target = e.target.closest('.fm-grid-item');
        
        if (target) {
            // Clicked on an item
            const type = target.getAttribute('data-type');
            const id = parseInt(target.getAttribute('data-id'));
            
            // If the item is not currently selected, select only it
            if (!selectedItems.find(i => i.type === type && i.id === id)) {
                fmSelectItem(null, type, id);
            }
            
            ctxEmpty.style.display = 'none';
            ctxItem.style.display = 'block';
            
            // Sync disabled states from toolbar
            const btnCut = document.getElementById('fm-btn-cut');
            const ctxCut = document.getElementById('fm-ctx-cut');
            if (btnCut && ctxCut) {
                ctxCut.style.opacity = btnCut.style.opacity;
                ctxCut.style.pointerEvents = btnCut.style.pointerEvents;
            }
            
            const btnCopy = document.getElementById('fm-btn-copy');
            const ctxCopy = document.getElementById('fm-ctx-copy');
            if (btnCopy && ctxCopy) {
                ctxCopy.style.opacity = btnCopy.style.opacity;
                ctxCopy.style.pointerEvents = btnCopy.style.pointerEvents;
            }
            
            const btnRename = document.getElementById('fm-btn-rename');
            const ctxRename = document.getElementById('fm-ctx-rename');
            if (btnRename && ctxRename) {
                ctxRename.style.opacity = btnRename.style.opacity;
                ctxRename.style.pointerEvents = btnRename.style.pointerEvents;
            }
            
            const btnProtect = document.getElementById('fm-btn-protect');
            const ctxProtect = document.getElementById('fm-ctx-protect');
            if (btnProtect && ctxProtect) {
                ctxProtect.style.opacity = btnProtect.style.opacity;
                ctxProtect.style.pointerEvents = btnProtect.style.pointerEvents;
            }
            
            const btnDelete = document.getElementById('fm-btn-delete');
            const ctxDelete = document.getElementById('fm-ctx-delete');
            if (btnDelete && ctxDelete) {
                ctxDelete.style.opacity = btnDelete.style.opacity;
                ctxDelete.style.pointerEvents = btnDelete.style.pointerEvents;
            }
            
            const btnDownload = document.getElementById('fm-btn-download');
            const ctxDownload = document.getElementById('fm-ctx-download');
            if (btnDownload && ctxDownload) {
                ctxDownload.style.opacity = btnDownload.style.opacity;
                ctxDownload.style.pointerEvents = btnDownload.style.pointerEvents;
            }
            
        } else {
            // Clicked on empty space
            fmClearSelection();
            
            ctxItem.style.display = 'none';
            ctxEmpty.style.display = 'block';
            
            // Check if paste is available
            const ctxPaste = document.getElementById('fm-ctx-paste');
            const ctxPasteSep = document.getElementById('fm-ctx-paste-separator');
            if (ctxPaste && fmClipboard && fmClipboard.items.length > 0) {
                ctxPaste.style.display = 'flex';
                if (ctxPasteSep) ctxPasteSep.style.display = 'block';
            } else {
                ctxPaste.style.display = 'none';
                if (ctxPasteSep) ctxPasteSep.style.display = 'none';
            }
        }
        
        // Calculate position (prevent going off-screen)
        menu.style.display = 'block';
        let x = e.clientX;
        let y = e.clientY;
        
        const menuRect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (x + menuRect.width > windowWidth) {
            x = windowWidth - menuRect.width - 5;
        }
        
        if (y + menuRect.height > windowHeight) {
            y = windowHeight - menuRect.height - 5;
        }
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    });
}

function fmCloseContextMenu() {
    const menu = document.getElementById('fm-context-menu');
    if (menu) menu.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    fmInitContextMenu();
});
