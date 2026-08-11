let spotlightTimeout = null;
let spotlightSelectedIndex = -1;
let spotlightItems = [];
let spotlightIsCmdDataFetched = false;
let spotlightAllTeams = [];
let spotlightAllWorkspaces = [];

document.addEventListener("keydown", function(e) {
    // Tarayıcının kendi arama çubuğunu açmasını engellemeye çalış
    const isCtrlK = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK');
    const isAltK = e.altKey && (e.key.toLowerCase() === 'k' || e.code === 'KeyK');
    const isCtrlSpace = (e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space');
    
    if (isCtrlK || isAltK || isCtrlSpace) {
        e.preventDefault();
        openSpotlight();
    }
    
    // Esc ile kapat
    if (e.key === 'Escape') {
        closeSpotlight();
    }
});

function openSpotlight() {
    const modal = document.getElementById("spotlight-modal");
    if (modal) {
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("active"), 10);
        
        const input = document.getElementById("spotlight-input");
        if (input) {
            input.value = "";
            setTimeout(() => input.focus(), 20); // modal açılırken odaklanması için kısa gecikme
        }
        document.getElementById("spotlight-results-container").style.display = "none";
        document.getElementById("spotlight-results").innerHTML = '';
        spotlightSelectedIndex = -1;
        spotlightItems = [];
    }
}

function closeSpotlight() {
    const modal = document.getElementById("spotlight-modal");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => modal.style.display = "none", 250);
    }
}

async function prefetchSpotlightCommandData() {
    if (spotlightIsCmdDataFetched) return;
    try {
        const [teamRes, wsRes] = await Promise.all([
            fetch('/api/teams/teams'),
            fetch('/api/WorkspaceApi')
        ]);
        if (teamRes.ok) spotlightAllTeams = await teamRes.json();
        if (wsRes.ok) spotlightAllWorkspaces = await wsRes.json();
        spotlightIsCmdDataFetched = true;
    } catch (e) { console.error("Spotlight verileri alınamadı", e); }
}

async function handleSpotlightInput(e) {
    const query = e.target.value;
    clearTimeout(spotlightTimeout);
    const container = document.getElementById("spotlight-results-container");
    
    if (!query || query.trim() === '') {
        container.style.display = "none";
        document.getElementById("spotlight-results").innerHTML = '';
        spotlightSelectedIndex = -1;
        spotlightItems = [];
        return;
    }

    container.style.display = "flex";

    if (query.startsWith('/')) {
        await prefetchSpotlightCommandData();
        renderSpotlightCommands(query.trim().toLowerCase());
        return;
    }

    spotlightTimeout = setTimeout(async () => {
        try {
            document.getElementById("spotlight-results").innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.9rem;"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="margin-right: 8px;"></span>Aranıyor...</div>';
            
            const filterVal = document.getElementById("spotlight-search-filter").value;
            const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query.trim())}&filter=${encodeURIComponent(filterVal)}`);
            if (!res.ok) throw new Error("Arama hatası");
            const data = await res.json();
            
            renderSpotlightResults(data);
        } catch (err) {
            console.error(err);
            document.getElementById("spotlight-results").innerHTML = '<div style="padding: 16px; text-align: center; color: var(--color-danger); font-size: 0.9rem;">Arama sırasında bir hata oluştu.</div>';
        }
    }, 300);
}

function renderSpotlightCommands(q) {
    let html = '';
    const resultsContainer = document.getElementById("spotlight-results");
    
    if (q === '/' || q === '/t' || q === '/g' || q === '/th' || q === '/go') {
        if ('/theme'.startsWith(q)) html += createSpotlightItemHtml('/theme', 'bi-palette', '/theme', 'Temayı değiştirir', "document.getElementById('spotlight-input').value = '/theme '; document.getElementById('spotlight-input').focus(); window.handleSpotlightInput({target: document.getElementById('spotlight-input')});");
        if ('/goto'.startsWith(q)) html += createSpotlightItemHtml('/goto', 'bi-box-arrow-in-right', '/goto', 'Bir sekmeye hızlı geçiş yapar', "document.getElementById('spotlight-input').value = '/goto '; document.getElementById('spotlight-input').focus(); window.handleSpotlightInput({target: document.getElementById('spotlight-input')});");
    } else if (q.startsWith('/theme')) {
        const arg = q.split(' ')[1] || '';
        if ('light'.startsWith(arg)) html += createSpotlightItemHtml('/theme light', 'bi-sun', 'light', 'Açık tema', "executeSpotlightCommand('/theme light')");
        if ('dark'.startsWith(arg)) html += createSpotlightItemHtml('/theme dark', 'bi-moon-stars', 'dark', 'Koyu tema', "executeSpotlightCommand('/theme dark')");
        if ('system'.startsWith(arg)) html += createSpotlightItemHtml('/theme system', 'bi-display', 'system', 'Sistem teması', "executeSpotlightCommand('/theme system')");
    } else if (q.startsWith('/goto teams ')) {
        const arg = q.substring('/goto teams '.length).toLowerCase();
        spotlightAllTeams.filter(t => t.name.toLowerCase().includes(arg)).forEach(t => {
            html += createSpotlightItemHtml(`/goto teams ${t.name}`, 'bi-people', t.name, 'Takım Görünümüne Git', `executeSpotlightCommand('/goto teams ${t.name}')`);
        });
    } else if (q.startsWith('/goto workspaces ')) {
        const arg = q.substring('/goto workspaces '.length).toLowerCase();
        spotlightAllWorkspaces.forEach(w => {
            const tName = w.teamGroupId ? (spotlightAllTeams.find(t => t.id === w.teamGroupId)?.name || 'Bilinmeyen') : 'Kişisel';
            const fullStr = tName + ' ' + w.name;
            if (fullStr.toLowerCase().includes(arg)) {
                html += createSpotlightItemHtml(`/goto workspaces ${fullStr}`, 'bi-folder2-open', fullStr, 'Çalışma Alanına Git', `executeSpotlightCommand('/goto workspaces ${fullStr}')`);
            }
        });
    } else if (q.startsWith('/goto')) {
        const arg = q.split(' ')[1] || '';
        const views = [
            { name: 'home', icon: 'bi-house', desc: 'Ana Sayfa' },
            { name: 'calendar', icon: 'bi-calendar4-week', desc: 'Takvim' },
            { name: 'workspaces', icon: 'bi-folder2-open', desc: 'Çalışma Alanları' },
            { name: 'teams', icon: 'bi-people', desc: 'Takımlar' },
            { name: 'trash', icon: 'bi-trash', desc: 'Çöp Kutusu' },
            { name: 'profile', icon: 'bi-person', desc: 'Profil' }
        ];
        views.forEach(v => {
            if (v.name.startsWith(arg)) {
                html += createSpotlightItemHtml(`/goto ${v.name}`, v.icon, v.name, v.desc, `executeSpotlightCommand('/goto ${v.name}')`);
            }
        });
    }

    if (html === '') html = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Eşleşen komut bulunamadı.</div>';
    
    resultsContainer.innerHTML = html;
    bindSpotlightNavigation();
}

function renderSpotlightResults(data) {
    const resultsContainer = document.getElementById("spotlight-results");
    if (data.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Kriterlere uygun sonuç bulunamadı.</div>';
        return;
    }

    let html = '';
    data.forEach(p => {
        if (p.type === 'workspace') {
            html += createSpotlightItemHtml(`ws-${p.id}`, 'bi-grid', p.title, p.description || 'Çalışma Alanı', `closeSpotlight(); if(typeof switchSidebarPanel==='function') switchSidebarPanel('workspaces'); if(typeof loadWorkspaceView === 'function') loadWorkspaceView(${p.id}, '${escapeHtml(p.title)}')`);
        } else if (p.type === 'team') {
            html += createSpotlightItemHtml(`team-${p.id}`, 'bi-diagram-3', p.title, p.description || 'Takım', `closeSpotlight(); if(typeof switchSidebarPanel==='function') switchSidebarPanel('teams'); if(typeof loadTeamWorkspace === 'function') loadTeamWorkspace(${p.id}, '${escapeHtml(p.title)}')`);
        } else {
            const subTitle = (p.teamGroupName || 'Kişisel') + " / " + (p.workspaceName || 'Genel');
            html += createSpotlightItemHtml(`proj-${p.id}`, 'bi-folder2', p.title, `${subTitle} — ${p.description || 'Proje'}`, `closeSpotlight(); if(typeof loadProjectWorkspace === 'function') loadProjectWorkspace(${p.id})`);
        }
    });

    resultsContainer.innerHTML = html;
    bindSpotlightNavigation();
}

// Simple escapeHTML function (since utils.js escapeHtml might not be guaranteed available in scope, though it usually is)
function _spEscapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function createSpotlightItemHtml(id, icon, title, desc, onclick) {
    const escapedOnclick = onclick.replace(/"/g, '&quot;');
    return `
        <div class="spotlight-item" data-action="${escapedOnclick}" onclick="${onclick}" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-radius: var(--radius-md); transition: background 0.1s; margin-bottom: 4px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--bg-surface-elevated); display: flex; align-items: center; justify-content: center; color: var(--text-primary); font-size: 1.1rem; flex-shrink: 0;">
                <i class="bi ${icon}"></i>
            </div>
            <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${_spEscapeHtml(title)}</div>
                <div style="color: var(--text-secondary); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${_spEscapeHtml(desc)}</div>
            </div>
        </div>
    `;
}

function bindSpotlightNavigation() {
    spotlightItems = Array.from(document.querySelectorAll("#spotlight-results .spotlight-item"));
    spotlightSelectedIndex = -1;
    updateSpotlightSelection();
}

function updateSpotlightSelection() {
    spotlightItems.forEach((el, index) => {
        if (index === spotlightSelectedIndex) {
            el.classList.add("active");
            el.style.background = "var(--bg-surface-hover)";
            el.scrollIntoView({ block: 'nearest' });
        } else {
            el.classList.remove("active");
            el.style.background = "transparent";
        }
    });
}

function executeSpotlightCommand(cmd) {
    if (typeof window.executeSlashCommand === 'function') {
        window.executeSlashCommand(cmd);
    }
    closeSpotlight();
}

// Global modal background click to close
document.addEventListener('click', function(e) {
    const modal = document.getElementById("spotlight-modal");
    if (modal && e.target === modal) {
        closeSpotlight();
    }
});

function initSpotlightEvents() {
    const input = document.getElementById("spotlight-input");
    const filterSelect = document.getElementById("spotlight-search-filter");
    if (!input) return;
    
    input.addEventListener('input', handleSpotlightInput);
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            handleSpotlightInput({ target: input });
        });
    }
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (spotlightItems.length > 0) {
                spotlightSelectedIndex = (spotlightSelectedIndex + 1) % spotlightItems.length;
                updateSpotlightSelection();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (spotlightItems.length > 0) {
                if (spotlightSelectedIndex <= 0) spotlightSelectedIndex = spotlightItems.length - 1;
                else spotlightSelectedIndex--;
                updateSpotlightSelection();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (spotlightSelectedIndex >= 0 && spotlightSelectedIndex < spotlightItems.length) {
                const action = spotlightItems[spotlightSelectedIndex].getAttribute('data-action');
                if (action) {
                    new Function(action)();
                }
            } else if (spotlightItems.length > 0) {
                // Hiçbiri seçili değilse ilkini çalıştır
                const action = spotlightItems[0].getAttribute('data-action');
                if (action) new Function(action)();
            }
        }
    });
}

// Key navigation for spotlight input - handle DOMContentLoaded correctly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpotlightEvents);
} else {
    initSpotlightEvents();
}
