let currentFolderId = null;
let folderHistory = [];
let folderPathNames = [];
let selectedItems = []; // { type: 'folder'|'file', id: 1 }
let fmClipboard = { action: null, items: [] };

async function initFileManager() {
    await fmLoadContents(null);
}

async function fmLoadContents(folderId, folderName = null, fmIsHistoryNav = false) {
    try {
        const url = folderId ? `/api/filemanager/folder/${folderId}` : `/api/filemanager/folder`;
        const response = await fetch(url);
        if(!response.ok) throw new Error("Veri çekilemedi.");
        
        const data = await response.json();
        
        if (folderId !== currentFolderId) {
            if (!fmIsHistoryNav) {
                fmForwardHistory = []; // clear forward history on manual navigation
            }
            if (folderId !== null) {
                const existingIndex = folderHistory.indexOf(folderId);
                if (existingIndex > -1) {
                    folderHistory = folderHistory.slice(0, existingIndex + 1);
                    folderPathNames = folderPathNames.slice(0, existingIndex + 1);
                } else if (folderHistory[folderHistory.length - 1] !== folderId) {
                    folderHistory.push(folderId);
                    folderPathNames.push(folderName || "Klasör");
                }
            } else {
                folderHistory = [];
                folderPathNames = [];
            }
            currentFolderId = folderId;
        }

        fmRenderBreadcrumbs();
        fmRenderGrid(data.folders, data.files, true, false);
        fmUpdateNavButtons();

    } catch (e) {
        console.error(e);
        alert("Klasör içeriği yüklenirken hata oluştu.");
    }
}

function fmUpdateNavButtons() {
    const btnBack = document.getElementById("fm-btn-back");
    if(btnBack) {
        if (folderHistory.length > 0) {
            btnBack.style.opacity = "1";
            btnBack.style.pointerEvents = "auto";
        } else {
            btnBack.style.opacity = "0.3";
            btnBack.style.pointerEvents = "none";
        }
    }
    
    const btnFwd = document.getElementById("fm-btn-forward");
    if(btnFwd) {
        if (fmForwardHistory.length > 0) {
            btnFwd.style.opacity = "1";
            btnFwd.style.pointerEvents = "auto";
        } else {
            btnFwd.style.opacity = "0.3";
            btnFwd.style.pointerEvents = "none";
        }
    }
}

function fmRenderBreadcrumbs() {
    const homeIcon = document.getElementById("fm-home-icon");
    if (homeIcon) {
        if (folderHistory.length === 0) {
            homeIcon.style.pointerEvents = "none";
            homeIcon.style.color = "var(--text-secondary)";
            homeIcon.style.opacity = "0.5";
        } else {
            homeIcon.style.pointerEvents = "auto";
            homeIcon.style.color = "var(--text-secondary)";
            homeIcon.style.opacity = "1";
        }
    }

    const bc = document.getElementById("fm-breadcrumbs");
    if(!bc) return;
    let html = ``;
    
    for (let i = 0; i < folderHistory.length; i++) {
        const isLast = i === folderHistory.length - 1;
        const color = isLast ? 'var(--text-primary)' : 'var(--text-secondary)';
        if (i > 0) html += `<span style="color:var(--text-muted); font-size: 1.0rem; margin: 0 2px;">\\</span>`;
        html += `<span style="cursor:pointer; color:${color}; font-weight: 600; transition: color 0.2s; padding: 2px 2px; border-radius: 4px;" onmouseover="this.style.backgroundColor='var(--bg-surface-hover)'; this.style.color='var(--text-primary)'" onmouseout="this.style.backgroundColor='transparent'; this.style.color='${color}'" onclick="fmLoadContents(${folderHistory[i]}, '${folderPathNames[i]}'); event.stopPropagation();">${folderPathNames[i]}</span>`;
    }
    bc.innerHTML = html;
}

window.fmStartPathEdit = function(e) {
    if(e) e.stopPropagation();
    const bc = document.getElementById("fm-breadcrumbs");
    const inp = document.getElementById("fm-path-input");
    if(bc && inp) {
        if (inp.style.display === "block") return; // Zaten düzenleme modundaysa müdahale etme
        bc.style.display = "none";
        inp.style.display = "block";
        inp.value = folderPathNames.join(' \\ ');
        inp.focus();
        inp.selectionStart = inp.selectionEnd = inp.value.length;
    }
}

window.fmBlurPathEdit = function() {
    const bc = document.getElementById("fm-breadcrumbs");
    const inp = document.getElementById("fm-path-input");
    if(bc && inp) {
        bc.style.display = "flex";
        inp.style.display = "none";
    }
}

window.fmPathInputKeydown = async function(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        const path = e.target.value.trim();
        if(!path) {
            fmLoadContents(null);
            e.target.blur();
            return;
        }
        
        try {
            const res = await fetch('/api/filemanager/resolve-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            });
            if(res.ok) {
                const data = await res.json();
                const folders = data.folders;
                
                folderHistory = folders.map(f => f.id);
                folderPathNames = folders.map(f => f.name);
                
                const targetId = folders.length > 0 ? folders[folders.length - 1].id : null;
                fmLoadContents(targetId, null);
                e.target.blur();
            } else {
                const err = await res.json();
                alert(err.message || "Dizin bulunamadı.");
            }
        } catch(ex) {
            console.error(ex);
        }
    } else if (e.key === "Escape") {
        e.target.blur();
    }
}

let fmCurrentFolders = [];
let fmCurrentFiles = [];
let fmCurrentSortCriteria = 'name';
let fmSortAsc = true;

function fmCloseAllMenus(exceptMenuId = null) {
    const menus = ['fm-sort-menu', 'fm-view-menu', 'fm-more-menu'];
    menus.forEach(id => {
        if (id !== exceptMenuId) {
            const m = document.getElementById(id);
            if (m && m.style.display === 'block') m.style.display = 'none';
        }
    });
    if (exceptMenuId !== 'fm-sort-menu') {
        const sub = document.getElementById('fm-sort-submenu-other');
        if (sub) sub.style.display = 'none';
    }
}

function fmToggleSortDropdown(e) {
    e.stopPropagation();
    fmCloseAllMenus('fm-sort-menu');
    const menu = document.getElementById('fm-sort-menu');
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
}

let fmSubmenuTimeout = null;

function fmShowSubmenu() {
    if (fmSubmenuTimeout) clearTimeout(fmSubmenuTimeout);
    fmSubmenuTimeout = setTimeout(() => {
        const sub = document.getElementById('fm-sort-submenu-other');
        if (sub) sub.style.display = 'block';
    }, 150);
}

function fmHideSubmenu() {
    if (fmSubmenuTimeout) clearTimeout(fmSubmenuTimeout);
    fmSubmenuTimeout = setTimeout(() => {
        const sub = document.getElementById('fm-sort-submenu-other');
        if (sub) sub.style.display = 'none';
    }, 300);
}

document.addEventListener('click', function(e) {
    fmCloseAllMenus();
});

function fmToggleMoreDropdown(e) {
    e.stopPropagation();
    fmCloseAllMenus('fm-more-menu');
    const menu = document.getElementById('fm-more-menu');
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
}

function fmSelectAll() {
    selectedItems = [];
    fmCurrentFolders.forEach(f => selectedItems.push({ type: 'folder', id: f.id }));
    fmCurrentFiles.forEach(f => selectedItems.push({ type: 'file', id: f.id }));
    fmUpdateSelectionUI();
}

function fmSelectNone() {
    fmClearSelection();
}

function fmSelectInvert() {
    const newSelection = [];
    fmCurrentFolders.forEach(f => {
        if (!selectedItems.find(i => i.type === 'folder' && i.id === f.id)) {
            newSelection.push({ type: 'folder', id: f.id });
        }
    });
    fmCurrentFiles.forEach(f => {
        if (!selectedItems.find(i => i.type === 'file' && i.id === f.id)) {
            newSelection.push({ type: 'file', id: f.id });
        }
    });
    selectedItems = newSelection;
    fmUpdateSelectionUI();
}

function fmSortBy(criteria) {
    fmCurrentSortCriteria = criteria;
    
    ['name', 'date', 'type', 'size', 'created', 'author'].forEach(c => {
        const check = document.getElementById(`fm-sort-check-${c}`);
        if(check) check.style.visibility = (c === criteria) ? 'visible' : 'hidden';
    });
    
    const otherGroupCheck = document.getElementById('fm-sort-check-other-group');
    if (otherGroupCheck) {
        otherGroupCheck.style.visibility = ['size', 'created', 'author'].includes(criteria) ? 'visible' : 'hidden';
    }
    
    fmApplySortAndRender();
}

function fmSortOrder(isAsc) {
    fmSortAsc = isAsc;
    
    const ascCheck = document.getElementById('fm-sort-check-asc');
    const descCheck = document.getElementById('fm-sort-check-desc');
    
    if(ascCheck) ascCheck.style.visibility = isAsc ? 'visible' : 'hidden';
    if(descCheck) descCheck.style.visibility = !isAsc ? 'visible' : 'hidden';
    
    fmApplySortAndRender();
}

window.fmToggleSortHeader = function(criteria) {
    if (fmCurrentSortCriteria === criteria) {
        if (fmSortAsc) {
            // Ascending -> Descending
            fmSortOrder(false);
        } else {
            // Descending -> Standard (Name Ascending)
            fmSortBy('name');
            fmSortOrder(true);
        }
    } else {
        // Not sorted by this -> Ascending
        fmSortBy(criteria);
        fmSortOrder(true);
    }
}

function fmApplySortAndRender(preserveSelection = false) {
    let folders = [...fmCurrentFolders];
    let files = [...fmCurrentFiles];
    
    const sortByNameAsc = (a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true });
    const sortByNameDesc = (a, b) => b.name.localeCompare(a.name, 'tr', { numeric: true });
    
    const nameSort = fmSortAsc ? sortByNameAsc : sortByNameDesc;
    
    if (fmCurrentSortCriteria === 'name') {
        folders.sort(nameSort);
        files.sort(nameSort);
    } else if (fmCurrentSortCriteria === 'date' || fmCurrentSortCriteria === 'created') {
        const sortByDate = (a, b) => fmSortAsc 
            ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            : new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        folders.sort(sortByDate);
        files.sort(sortByDate);
    } else if (fmCurrentSortCriteria === 'type') {
        folders.sort(nameSort);
        files.sort((a, b) => {
            const extA = (a.extension || '').toLowerCase();
            const extB = (b.extension || '').toLowerCase();
            if (extA === extB) return nameSort(a, b);
            return fmSortAsc ? extA.localeCompare(extB, 'tr') : extB.localeCompare(extA, 'tr');
        });
    } else if (fmCurrentSortCriteria === 'size') {
        folders.sort(nameSort);
        files.sort((a, b) => {
            const sizeA = a.sizeInBytes || 0;
            const sizeB = b.sizeInBytes || 0;
            if (sizeA === sizeB) return nameSort(a, b);
            return fmSortAsc ? (sizeA - sizeB) : (sizeB - sizeA);
        });
    } else if (fmCurrentSortCriteria === 'author') {
        folders.sort(nameSort);
        files.sort(nameSort);
    }
    
    fmRenderGrid(folders, files, false, preserveSelection);
}

let fmCurrentView = 'wide';

function fmToggleViewDropdown(e) {
    e.stopPropagation();
    fmCloseAllMenus('fm-view-menu');
    const menu = document.getElementById('fm-view-menu');
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
}

function fmChangeView(view) {
    fmCurrentView = view;
    ['wide', 'detailed', 'compact'].forEach(v => {
        const check = document.getElementById(`fm-view-check-${v}`);
        if(check) check.style.visibility = (v === view) ? 'visible' : 'hidden';
    });
    fmRenderGrid(fmCurrentFolders, fmCurrentFiles, false, true);
}

function fmRenderGrid(folders, files, isFreshLoad = true, preserveSelection = false) {
    if (isFreshLoad) {
        fmCurrentFolders = folders || [];
        fmCurrentFiles = files || [];
        fmApplySortAndRender(preserveSelection);
        return;
    }

    const grid = document.getElementById("fm-grid");
    const empty = document.getElementById("fm-empty-state");
    
    if (!preserveSelection) {
        fmClearSelection();
    }
    
    const totalItems = folders.length + files.length;
    const statusTotal = document.getElementById("fm-status-total");
    if (statusTotal) statusTotal.innerText = `${totalItems} öğe`;
    
    if (folders.length === 0 && files.length === 0) {
        grid.style.display = "none";
        empty.style.display = "block";
        grid.innerHTML = "";
        return;
    }
    
    empty.style.display = "none";

    // Configure grid container based on view
    if (fmCurrentView === 'wide') {
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
        grid.style.flexDirection = '';
        grid.style.flexWrap = '';
        grid.style.alignContent = '';
        grid.style.height = '';
        grid.style.gap = '16px';
        grid.parentNode.style.overflowX = 'hidden';
        grid.parentNode.style.overflowY = 'auto';
    } else if (fmCurrentView === 'detailed') {
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gridTemplateColumns = '';
        grid.style.flexWrap = '';
        grid.style.alignContent = '';
        grid.style.height = '';
        grid.style.gap = '0';
        grid.parentNode.style.overflowX = 'hidden';
        grid.parentNode.style.overflowY = 'auto';
    } else if (fmCurrentView === 'compact') {
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gridTemplateColumns = '';
        grid.style.flexWrap = 'wrap';
        grid.style.alignContent = 'flex-start';
        grid.style.height = '100%';
        grid.style.gap = '4px 16px';
        grid.parentNode.style.overflowY = 'hidden';
        grid.parentNode.style.overflowX = 'auto';
    }
    
    let html = '';

    // Add Detailed View Header
    if (fmCurrentView === 'detailed') {
        const getIcon = (c) => {
            if (fmCurrentSortCriteria !== c && (c !== 'date' || fmCurrentSortCriteria !== 'created')) return '';
            return fmSortAsc ? '<i class="bi bi-arrow-up-short" style="font-size:1.1rem; margin-left:2px; margin-top:1px;"></i>' : '<i class="bi bi-arrow-down-short" style="font-size:1.1rem; margin-left:2px; margin-top:1px;"></i>';
        };
        html += `
            <div style="display: flex; align-items: center; padding: 8px 16px; border-bottom: 2px solid var(--border-color); color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                <div style="width: 32px; margin-right: 16px;"></div>
                <div style="flex: 1; cursor: pointer; user-select: none; display: flex; align-items: center;" onclick="fmToggleSortHeader('name')" title="Sırala: Ad">Ad ${getIcon('name')}</div>
                <div style="width: 100px; cursor: pointer; user-select: none; display: flex; align-items: center;" onclick="fmToggleSortHeader('size')" title="Sırala: Boyut">Boyut ${getIcon('size')}</div>
                <div style="width: 180px; cursor: pointer; user-select: none; display: flex; align-items: center;" onclick="fmToggleSortHeader('date')" title="Sırala: Değiştirme Tarihi">Değiştirme Tarihi ${getIcon('date')}</div>
                <div style="width: 120px; cursor: pointer; user-select: none; display: flex; align-items: center;" onclick="fmToggleSortHeader('type')" title="Sırala: Tür">Tür ${getIcon('type')}</div>
            </div>
        `;
    }

    folders.forEach(f => {
        const isSys = f.isSystemFolder;
        const isProtected = f.isProtected || isSys;
        const isTrash = isSys && f.name === 'Çöp Kutusu';
        
        const sysBadge = isProtected ? `<i class="bi bi-shield-fill-check" style="position:absolute; bottom:-6px; right:-12px; color:var(--color-success); font-size:0.85rem; text-shadow: -1.5px -1.5px 0 var(--bg-surface), 1.5px -1.5px 0 var(--bg-surface), -1.5px 1.5px 0 var(--bg-surface), 1.5px 1.5px 0 var(--bg-surface);"></i>` : '';
        const folderIconClass = "bi-folder-fill";
        const dateStr = f.createdAt ? new Date(f.createdAt).toLocaleString('tr-TR') : '-';
        
        if (fmCurrentView === 'wide') {
            const sysIconWide = isProtected ? `<i class="bi bi-shield-fill-check" style="position: absolute; bottom: 0px; right: -4px; color:var(--color-success); font-size: 1.25rem; line-height: 1; text-shadow: -2px -2px 0 var(--bg-surface), 2px -2px 0 var(--bg-surface), -2px 2px 0 var(--bg-surface), 2px 2px 0 var(--bg-surface);"></i>` : '';
            html += `
                <div class="fm-grid-item" data-type="folder" data-id="${f.id}" data-system="${isSys ? 'true' : 'false'}" 
                    ondragover="fmDragOver(event)"
                    ondragenter="fmDragEnter(event)"
                    ondragleave="fmDragLeave(event)"
                    ondrop="fmDrop(event, ${f.id})"
                    style="padding: 12px 8px; text-align: center; cursor: pointer; border-radius: 6px; transition: background-color 0.1s ease;" onmouseover="if(!this.classList.contains('selected')) this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="if(!this.classList.contains('selected')) this.style.backgroundColor='transparent'" onclick="fmSelectItem(event, 'folder', ${f.id})" ondblclick="fmLoadContents(${f.id}, '${f.name}')">
                    <div class="fm-item-content" style="display: inline-block; text-align: center;" draggable="${!isSys ? 'true' : 'false'}" ondragstart="fmDragStart(event, 'folder', ${f.id})">
                        <div style="height: 64px; width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
                            <div style="display: inline-flex; position: relative;">
                                <i class="bi ${folderIconClass}" style="font-size: 4rem; color: var(--color-primary); line-height: 1;"></i>
                                ${sysIconWide}
                            </div>
                        </div>
                        <div style="font-weight: 500; margin-top: 2px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; font-size: 0.95rem; color: var(--text-primary);" title="${f.name}">${f.name}</div>
                    </div>
                </div>
            `;
        } else if (fmCurrentView === 'detailed') {
            html += `
                <div class="fm-grid-item" data-type="folder" data-id="${f.id}" data-system="${isSys ? 'true' : 'false'}" 
                    draggable="${!isSys ? 'true' : 'false'}"
                    ondragstart="fmDragStart(event, 'folder', ${f.id})"
                    ondragover="fmDragOver(event)"
                    ondragenter="fmDragEnter(event)"
                    ondragleave="fmDragLeave(event)"
                    ondrop="fmDrop(event, ${f.id})"
                    style="display: flex; align-items: center; padding: 8px 16px; cursor: pointer; transition: background-color 0.1s ease;" onmouseover="if(!this.classList.contains('selected')) this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="if(!this.classList.contains('selected')) this.style.backgroundColor='transparent'" onclick="fmSelectItem(event, 'folder', ${f.id})" ondblclick="fmLoadContents(${f.id}, '${f.name}')">
                    <div style="position: relative; width: 32px; min-width: 32px; height: 32px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                        <i class="bi ${folderIconClass}" style="font-size: 1.8rem; color: var(--color-primary);"></i>
                        ${sysBadge}
                    </div>
                    <div style="flex: 1; font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; font-size: 0.95rem; color: var(--text-primary);" title="${f.name}">${f.name}</div>
                    <div style="width: 100px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-muted);"></div>
                    <div style="width: 180px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-muted);">${dateStr}</div>
                    <div style="width: 120px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-muted);">Klasör</div>
                </div>
            `;
        } else if (fmCurrentView === 'compact') {
            html += `
                <div class="fm-grid-item" data-type="folder" data-id="${f.id}" data-system="${isSys ? 'true' : 'false'}" 
                    draggable="${!isSys ? 'true' : 'false'}"
                    ondragstart="fmDragStart(event, 'folder', ${f.id})"
                    ondragover="fmDragOver(event)"
                    ondragenter="fmDragEnter(event)"
                    ondragleave="fmDragLeave(event)"
                    ondrop="fmDrop(event, ${f.id})"
                    style="display: flex; align-items: center; padding: 4px 8px; cursor: pointer; border-radius: 4px; width: 220px; transition: background-color 0.1s ease;" onmouseover="if(!this.classList.contains('selected')) this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="if(!this.classList.contains('selected')) this.style.backgroundColor='transparent'" onclick="fmSelectItem(event, 'folder', ${f.id})" ondblclick="fmLoadContents(${f.id}, '${f.name}')">
                    <div style="position: relative; width: 24px; min-width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px;">
                        <i class="bi ${folderIconClass}" style="font-size: 1.4rem; color: var(--color-primary);"></i>
                        ${sysBadge}
                    </div>
                    <div style="flex: 1; font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; font-size: 0.9rem; color: var(--text-primary);" title="${f.name}">${f.name}</div>
                </div>
            `;
        }
    });

    files.forEach(f => {
        let icon = "bi-file-earmark-text"; // Default
        const ext = f.extension ? f.extension.toLowerCase() : "";
        const type = f.contentType || "";
        let isImage = false;
        
        if (type.startsWith("image/")) {
            icon = "bi-file-earmark-image";
            isImage = true;
        }
        else if (type.startsWith("video/")) icon = "bi-file-earmark-play";
        else if (type.startsWith("audio/") || ext === ".mp3" || ext === ".wav") icon = "bi-file-earmark-music";
        else if (type.includes("pdf") || ext === ".pdf") icon = "bi-file-earmark-pdf";
        else if (type.includes("zip") || type.includes("rar") || type.includes("tar") || ext === ".zip" || ext === ".rar" || ext === ".7z") icon = "bi-file-earmark-zip";
        else if (ext === ".doc" || ext === ".docx") icon = "bi-file-earmark-word";
        else if (ext === ".xls" || ext === ".xlsx" || ext === ".csv") icon = "bi-file-earmark-excel";
        else if (ext === ".ppt" || ext === ".pptx") icon = "bi-file-earmark-ppt";
        else if ([".js", ".html", ".css", ".cs", ".json", ".xml", ".py", ".cpp", ".c", ".h"].includes(ext)) icon = "bi-file-earmark-code";
        else if (ext === ".txt" || ext === ".md") icon = "bi-file-earmark-text";

        const typeName = f.extension ? f.extension.toUpperCase().replace('.', '') + " Dosyası" : "Dosya";
        const dateStr = f.createdAt ? new Date(f.createdAt).toLocaleString('tr-TR') : '-';
        
        const isProtectedFile = f.isProtected;
        const fileBadge = isProtectedFile ? `<i class="bi bi-shield-fill-check" style="position:absolute; bottom:-6px; right:-12px; color:var(--color-success); font-size:0.85rem; text-shadow: -1.5px -1.5px 0 var(--bg-surface), 1.5px -1.5px 0 var(--bg-surface), -1.5px 1.5px 0 var(--bg-surface), 1.5px 1.5px 0 var(--bg-surface);"></i>` : '';
        const fileBadgeWide = isProtectedFile ? `<i class="bi bi-shield-fill-check" style="position: absolute; bottom: 0px; right: -4px; color:var(--color-success); font-size: 1.25rem; line-height: 1; text-shadow: -2px -2px 0 var(--bg-surface), 2px -2px 0 var(--bg-surface), -2px 2px 0 var(--bg-surface), 2px 2px 0 var(--bg-surface);"></i>` : '';

        if (fmCurrentView === 'wide') {
            const visualHtmlWide = isImage ? 
                `<div style="height: 64px; width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
                    <div style="display: inline-flex; position: relative; max-width: 100%; max-height: 64px;">
                        <img src="${f.fileUrl}" style="max-width: 100%; max-height: 64px; object-fit: contain; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                        <i class="bi ${icon}" style="font-size: 4rem; color: var(--text-secondary); display: none; line-height: 1;"></i>
                        ${fileBadgeWide}
                    </div>
                </div>` :
                `<div style="height: 64px; width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
                    <div style="display: inline-flex; position: relative;">
                        <i class="bi ${icon}" style="font-size: 4rem; color: var(--text-secondary); line-height: 1;"></i>
                        ${fileBadgeWide}
                    </div>
                </div>`;
                
            html += `
                <div class="fm-grid-item" data-type="file" data-id="${f.id}" 
                    style="padding: 12px 8px; text-align: center; border-radius: 6px; cursor: pointer; transition: background-color 0.1s ease;" onmouseover="if(!this.classList.contains('selected')) this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="if(!this.classList.contains('selected')) this.style.backgroundColor='transparent'" onclick="fmSelectItem(event, 'file', ${f.id})" ondblclick="${isImage ? `fmPreviewImage('${f.fileUrl}')` : `window.open('${f.fileUrl}', '_blank')`}">
                    <div class="fm-item-content" style="display: inline-block; text-align: center; max-width: 100%;" draggable="true" ondragstart="fmDragStart(event, 'file', ${f.id})">
                        ${visualHtmlWide}
                        <div style="font-weight: 500; margin-top: 2px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; font-size: 0.95rem; color: var(--text-primary);" title="${f.name}">${f.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${(f.sizeInBytes / 1024).toFixed(1)} KB</div>
                    </div>
                </div>
            `;
        } else if (fmCurrentView === 'detailed') {
            const visualHtmlDetailed = isImage ?
                `<img src="${f.fileUrl}" style="max-width: 28px; max-height: 28px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                 <i class="bi ${icon}" style="font-size: 1.8rem; color: var(--text-secondary); display: none;"></i>` :
                `<i class="bi ${icon}" style="font-size: 1.8rem; color: var(--text-secondary);"></i>`;
                
            html += `
                <div class="fm-grid-item" data-type="file" data-id="${f.id}" 
                    style="display: flex; align-items: center; padding: 8px 16px; cursor: pointer; transition: background-color 0.1s ease;" onmouseover="if(!this.classList.contains('selected')) this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="if(!this.classList.contains('selected')) this.style.backgroundColor='transparent'" onclick="fmSelectItem(event, 'file', ${f.id})" ondblclick="${isImage ? `fmPreviewImage('${f.fileUrl}')` : `window.open('${f.fileUrl}', '_blank')`}">
                    <div class="fm-item-content" draggable="true" ondragstart="fmDragStart(event, 'file', ${f.id})" style="display: flex; align-items: center; width: 100%; overflow: hidden;">
                        <div style="position: relative; width: 32px; min-width: 32px; height: 32px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 16px;">
                            ${visualHtmlDetailed}
                            ${fileBadge}
                        </div>
                        <div style="flex: 1; font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; font-size: 0.95rem; color: var(--text-primary);" title="${f.name}">${f.name}</div>
                        <div style="width: 100px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-muted);">${(f.sizeInBytes / 1024).toFixed(1)} KB</div>
                        <div style="width: 180px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-muted);">${dateStr}</div>
                        <div style="width: 120px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${typeName}">${typeName}</div>
                    </div>
                </div>
            `;
        } else if (fmCurrentView === 'compact') {
            const visualHtmlCompact = isImage ?
                `<img src="${f.fileUrl}" style="max-width: 20px; max-height: 20px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                 <i class="bi ${icon}" style="font-size: 1.4rem; color: var(--text-secondary); display: none;"></i>` :
                `<i class="bi ${icon}" style="font-size: 1.4rem; color: var(--text-secondary);"></i>`;
                
            html += `
                <div class="fm-grid-item" data-type="file" data-id="${f.id}" 
                    style="display: flex; align-items: center; padding: 4px 8px; cursor: pointer; border-radius: 4px; width: 220px; transition: background-color 0.1s ease;" onmouseover="if(!this.classList.contains('selected')) this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="if(!this.classList.contains('selected')) this.style.backgroundColor='transparent'" onclick="fmSelectItem(event, 'file', ${f.id})" ondblclick="${isImage ? `fmPreviewImage('${f.fileUrl}')` : `window.open('${f.fileUrl}', '_blank')`}">
                    <div class="fm-item-content" draggable="true" ondragstart="fmDragStart(event, 'file', ${f.id})" style="display: flex; align-items: center; width: 100%; overflow: hidden;">
                        <div style="position: relative; width: 24px; min-width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px;">
                            ${visualHtmlCompact}
                            ${fileBadge}
                        </div>
                        <div style="flex: 1; font-weight: 500; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; font-size: 0.9rem; color: var(--text-primary);" title="${f.name}">${f.name}</div>
                    </div>
                </div>
            `;
        }
    });
    
    grid.innerHTML = html;
    fmUpdateSelectionUI();
}

let fmLastSelectedIndex = -1;

function fmSelectItem(e, type, id) {
    if (window.fmHasDragged) return; // Prevent selection trigger immediately after lasso drag
    
    if (e) e.stopPropagation();
    
    const items = Array.from(document.querySelectorAll('.fm-grid-item'));
    const currentIndex = items.findIndex(el => el.getAttribute('data-type') === type && parseInt(el.getAttribute('data-id')) === id);
    
    if (e && e.shiftKey && fmLastSelectedIndex !== -1) {
        // Shift Click Range Selection
        const start = Math.min(fmLastSelectedIndex, currentIndex);
        const end = Math.max(fmLastSelectedIndex, currentIndex);
        
        // If ctrl is not pressed during shift-click, clear previous independent selection
        if (!e.ctrlKey) {
            selectedItems = [];
        }
        
        for (let i = start; i <= end; i++) {
            const el = items[i];
            const iType = el.getAttribute('data-type');
            const iId = parseInt(el.getAttribute('data-id'));
            
            if (!selectedItems.find(item => item.type === iType && item.id === iId)) {
                selectedItems.push({ type: iType, id: iId });
            }
        }
    } else {
        // Normal or Ctrl Click
        const existsIndex = selectedItems.findIndex(i => i.type === type && i.id === id);
        
        if (e && e.ctrlKey) {
            if (existsIndex > -1) {
                selectedItems.splice(existsIndex, 1);
            } else {
                selectedItems.push({ type, id });
                fmLastSelectedIndex = currentIndex;
            }
        } else {
            // Normal click
            selectedItems = [{ type, id }];
            fmLastSelectedIndex = currentIndex;
        }
    }
    
    fmUpdateSelectionUI();
}

function fmDropZoneClick(e) {
    if (window.fmHasDragged) return; // Prevent clearing selection if a lasso drag just finished
    fmClearSelection();
}

function fmClearSelection() {
    selectedItems = [];
    fmLastSelectedIndex = -1;
    fmUpdateSelectionUI();
}

function fmUpdateSelectionUI() {
    const hasSel = selectedItems.length > 0;
    const hasSingleSel = selectedItems.length === 1;
    
    let hasSystemFolder = false;
    let hasProtectedItem = false;
    
    if (hasSel) {
        selectedItems.forEach(i => {
            let item = i.type === 'folder' ? fmCurrentFolders.find(f => f.id === i.id) : fmCurrentFiles.find(f => f.id === i.id);
            if (item) {
                if (item.isSystemFolder) hasSystemFolder = true;
                if (item.isProtected) hasProtectedItem = true;
            }
        });
    }

    document.querySelectorAll('.fm-grid-item').forEach(el => {
        const type = el.getAttribute('data-type');
        const id = parseInt(el.getAttribute('data-id'));
        if (selectedItems.find(i => i.type === type && i.id === id)) {
            el.classList.add('selected');
            el.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
        } else {
            el.classList.remove('selected');
            el.style.backgroundColor = 'transparent';
        }
        
        const isCut = fmClipboard && fmClipboard.action === 'cut' && fmClipboard.items.find(i => i.type === type && i.id === id);
        el.style.opacity = isCut ? '0.5' : '1';
    });
    
    const statusSelected = document.getElementById("fm-status-selected");
    const statusDivider = document.getElementById("fm-status-divider");
    if (statusSelected && statusDivider) {
        if (hasSel) {
            statusSelected.innerText = `${selectedItems.length} öğe seçildi`;
            statusSelected.style.display = 'inline';
            statusDivider.style.display = 'block';
        } else {
            statusSelected.style.display = 'none';
            statusDivider.style.display = 'none';
        }
    }
    
    const cut = document.getElementById("fm-btn-cut");
    const copy = document.getElementById("fm-btn-copy");
    const del = document.getElementById("fm-btn-delete");
    const ren = document.getElementById("fm-btn-rename");
    const restoreBtn = document.getElementById("fm-btn-restore");
    const downloadBtn = document.getElementById("fm-btn-download");
    
    if (downloadBtn) {
        downloadBtn.style.opacity = hasSel ? "1" : "0.3";
        downloadBtn.style.pointerEvents = hasSel ? "auto" : "none";
    }
    
    if(copy) {
        const canCopy = hasSel && !hasSystemFolder;
        copy.style.opacity = canCopy ? "1" : "0.3";
        copy.style.pointerEvents = canCopy ? "auto" : "none";
    }
    
    [cut, del].forEach(btn => {
        if(btn) {
            const canAction = hasSel && !hasSystemFolder && !hasProtectedItem;
            btn.style.opacity = canAction ? "1" : "0.3";
            btn.style.pointerEvents = canAction ? "auto" : "none";
        }
    });
    
    if(restoreBtn) {
        // Çöp kutusu klasöründeysek aktif olacak. Şimdilik hep pasif.
        const isTrash = folderPathNames.length > 0 && folderPathNames[0] === 'Çöp Kutusu'; 
        const canRestore = hasSel && isTrash;
        restoreBtn.style.opacity = canRestore ? "1" : "0.3";
        restoreBtn.style.pointerEvents = canRestore ? "auto" : "none";
    }
    
    if(ren) {
        const canRen = hasSingleSel && !hasSystemFolder;
        ren.style.opacity = canRen ? "1" : "0.3";
        ren.style.pointerEvents = canRen ? "auto" : "none";
    }
    
    const pasteBtn = document.getElementById("fm-btn-paste");
    if(pasteBtn) {
        const canPaste = fmClipboard.items.length > 0;
        pasteBtn.style.opacity = canPaste ? "1" : "0.3";
        pasteBtn.style.pointerEvents = canPaste ? "auto" : "none";
    }
    
    const protectBtn = document.getElementById("fm-btn-protect");
    if (protectBtn) {
        let allProtected = true;
        let anySelected = selectedItems.length > 0;
        let containsSystemFolder = false;
        
        if (anySelected) {
            selectedItems.forEach(i => {
                let item = i.type === 'folder' ? fmCurrentFolders.find(f => f.id === i.id) : fmCurrentFiles.find(f => f.id === i.id);
                if (item) {
                    if (item.isSystemFolder) containsSystemFolder = true;
                    if (!item.isProtected && !item.isSystemFolder) {
                        allProtected = false;
                    }
                }
            });
        }
        
        const canProtect = anySelected && !containsSystemFolder;
        
        if (canProtect) {
            protectBtn.style.opacity = "1";
            protectBtn.style.pointerEvents = "auto";
            protectBtn.removeAttribute("disabled");
        } else {
            protectBtn.style.opacity = "0.3";
            protectBtn.style.pointerEvents = "none";
            protectBtn.setAttribute("disabled", "true");
        }
        
        const protectIcon = document.getElementById("fm-btn-protect-icon");
        if (protectIcon) {
            protectIcon.className = (anySelected && allProtected) ? "bi bi-shield-fill-check" : "bi bi-shield";
        }
    }
    
    if (typeof fmUpdateDetailsDrawer === 'function') {
        fmUpdateDetailsDrawer();
    }
}

window.fmToggleProtect = async function() {
    if (selectedItems.length === 0) return;
    
    let allProtected = true;
    selectedItems.forEach(i => {
        let item = i.type === 'folder' ? fmCurrentFolders.find(f => f.id === i.id) : fmCurrentFiles.find(f => f.id === i.id);
        if (item && !item.isProtected && !item.isSystemFolder) {
            allProtected = false;
        }
    });

    const targetProtected = !allProtected;
    if (!targetProtected) {
        if (!confirm("Seçili öğelerin korumasını kaldırmak istediğinize emin misiniz?")) return;
    }

    try {
        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
        const res = await fetch('/api/filemanager/protect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': token },
            body: JSON.stringify({ items: selectedItems, isProtected: targetProtected })
        });
        if(res.ok) {
            selectedItems.forEach(i => {
                let item = i.type === 'folder' ? fmCurrentFolders.find(f => f.id === i.id) : fmCurrentFiles.find(f => f.id === i.id);
                if (item && !item.isSystemFolder) {
                    item.isProtected = targetProtected;
                }
            });
            fmApplySortAndRender(true);
        } else {
            alert("Koruma durumu güncellenirken bir hata oluştu.");
        }
    } catch(e) {
        console.error(e);
        alert("Bir ağ hatası oluştu.");
    }
}

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
