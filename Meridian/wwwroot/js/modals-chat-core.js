// --- CHAT DASHBOARD LOGIC ---
(function() {
    if (document.getElementById('chat-action-bar-style')) return;
    const style = document.createElement('style');
    style.id = 'chat-action-bar-style';
    style.innerHTML = `
        .chat-action-bar {
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.1s ease, visibility 0.1s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        #chat-main-messages:not(.ctx-open) .chat-message-row:hover .chat-action-bar,
        .chat-message-row.force-hover .chat-action-bar {
            opacity: 1;
            visibility: visible;
            transition: opacity 0.1s ease, visibility 0.1s ease;
        }
        #chat-main-messages:not(.ctx-open) .chat-message-row:hover,
        .chat-message-row.force-hover {
            background-color: var(--bg-surface-hover) !important;
        }
        .hover-timestamp {
            opacity: 0;
            transition: opacity 0.1s ease;
        }
        #chat-main-messages:not(.ctx-open) .chat-message-row:hover .hover-timestamp,
        .chat-message-row.force-hover .hover-timestamp {
            opacity: 1;
        }
        .chat-action-bar-btn {
            background: transparent;
            border: none;
            color: var(--text-muted, #6b7280);
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 0.95rem;
            -webkit-text-stroke: 0.4px; /* makes icons bolder */
            transition: color 0.15s ease;
            padding: 0;
            outline: none;
        }
        .chat-action-bar-btn:hover {
            color: #ffffff !important;
        }
    `;
    document.head.appendChild(style);
})();

let currentChatSessions = [];

window.showChatView = function() {
    // Hide other main views
    document.querySelectorAll('#home-view, #calendar-view, #workspaces-dashboard-view, #teams-dashboard-view, #workspace-view, #profile-page-view, #deleted-view, #activities-view').forEach(el => {
        if(el) el.style.display = 'none';
    });
    
    const sv = document.getElementById('settings-view');
    if (sv) sv.style.display = 'none';

    // Show chat dashboard
    const cv = document.getElementById('chat-dashboard-view');
    if (cv) cv.style.display = 'flex';
    
    // Clear unread count for the active session when returning to the chat view
    if (typeof activeChatSessionId !== 'undefined' && activeChatSessionId && window.unreadChatCounts && window.unreadChatCounts[activeChatSessionId]) {
        window.unreadChatCounts[activeChatSessionId] = 0;
        if (typeof updateRailBadge === 'function') updateRailBadge();
        const bndg = document.getElementById('unread-badge-' + activeChatSessionId);
        if (bndg) bndg.style.display = 'none';
        
        const timeEl = document.getElementById('chat-time-' + activeChatSessionId);
        if (timeEl) {
            timeEl.style.color = 'var(--text-muted)';
            timeEl.style.fontWeight = 'normal';
        }
        
        const lastMsgEl = document.getElementById('chat-lastmsg-' + activeChatSessionId);
        if (lastMsgEl) {
            lastMsgEl.style.color = 'var(--text-secondary)';
            lastMsgEl.style.fontWeight = 'normal';
        }
    }
    
    if (typeof updateBreadcrumb === 'function') {
        updateBreadcrumb(null, 'Mesajlar', null);
    }
    
    if (typeof updateRailActive === 'function') {
        updateRailActive('rail-btn-chat');
        collapseSidebar();
    }
    
    // Initialize default tab if empty
    if (!window.currentChatTab) {
        switchChatTab('dm');
    } else {
        loadChatSessions(); // Refresh list on open
    }
};

window.switchChatTab = function(tabName) {
    window.currentChatTab = tabName;
    
    // Update tab styling
    document.querySelectorAll('.chat-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary)';
        btn.style.fontWeight = '500';
    });
    
    const activeBtn = document.getElementById('btn-tab-' + tabName);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'var(--bg-surface-elevated)';
        activeBtn.style.color = 'var(--text-primary)';
        activeBtn.style.fontWeight = '600';
    }
    
    const connDash = document.getElementById('chat-connections-dashboard');
    if (connDash) {
        if (tabName === 'connections') {
            connDash.style.display = 'flex';
            
            // Clear active chat session
            if (typeof activeChatSessionId !== 'undefined') {
                activeChatSessionId = null;
            }
            
            const chatHeader = document.getElementById('chat-main-header-wrapper');
            if (chatHeader) chatHeader.style.display = 'none';
            
            const chatInputArea = document.getElementById('chat-main-input-area');
            if (chatInputArea) chatInputArea.style.display = 'none';
            
            const chatMessages = document.getElementById('chat-main-messages');
            if (chatMessages) {
                chatMessages.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: auto; margin-bottom: auto; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">Sohbeti görüntülemek için sol taraftan bir kişi veya takım seçin.</div>';
            }
            
            // Load the default connection tab
            if (typeof switchConnTab === 'function') {
                switchConnTab('all');
            }
            
        } else {
            connDash.style.display = 'none';
        }
    }
    
    loadChatSessions();
};

window.switchConnTab = function(tabName) {
    // Update tab styling
    document.querySelectorAll('.conn-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--text-secondary)';
        btn.style.fontWeight = '500';
    });
    
    const activeBtn = document.getElementById('btn-conn-tab-' + tabName);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottomColor = 'var(--color-primary)';
        activeBtn.style.color = 'var(--text-primary)';
        activeBtn.style.fontWeight = '600';
    }
    
    // Update contents
    document.querySelectorAll('.conn-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const activeContent = document.getElementById('conn-tab-' + tabName);
    if (activeContent) {
        activeContent.style.display = 'block';
    }
    
    // Load data based on tab
    loadConnections(tabName);
};

window.loadConnections = async function(tabName) {
    const contentDiv = document.getElementById('conn-tab-' + tabName);
    if (!contentDiv) return;
    
    contentDiv.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 60px;"><div class="spinner-border spinner-border-sm text-primary" role="status"></div><p class="mt-2">Yükleniyor...</p></div>';
    
    try {
        let endpoint = '';
        if (tabName === 'all') endpoint = '/api/ConnectionsApi/all';
        else if (tabName === 'incoming') endpoint = '/api/ConnectionsApi/incoming';
        else if (tabName === 'outgoing') endpoint = '/api/ConnectionsApi/outgoing';
        
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Veri çekilemedi');
        
        const data = await res.json();
        
        if (data.length === 0) {
            let icon = tabName === 'all' ? 'bi-people' : (tabName === 'incoming' ? 'bi-box-arrow-in-right' : 'bi-box-arrow-up-right');
            let msg = tabName === 'all' ? 'Henüz bir bağlantınız yok.' : (tabName === 'incoming' ? 'Gelen istek bulunmuyor.' : 'Giden istek bulunmuyor.');
            
            let extraBtn = '';
            if (tabName === 'all') {
                extraBtn = `<button class="tm-btn tm-btn-primary" style="margin-top: 16px;" onclick="openModal('new-dm-modal')"><i class="bi bi-person-plus"></i> Bağlantı Ekle</button>`;
            }
            
            contentDiv.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); margin-top: 60px;">
                    <i class="bi ${icon}" style="font-size: 3rem; margin-bottom: 16px; display: block;"></i>
                    <p>${msg}</p>
                    ${extraBtn}
                </div>
            `;
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; width: 100%;">';
        let labelText = tabName === 'all' ? `${data.length} bağlantı` : `${data.length} istek`;
        let buttonHtml = tabName === 'all' ? `<button onclick="openModal('new-dm-modal')" style="background: none; border: none; color: var(--color-primary); font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 0; transition: color 0.2s; white-space: nowrap;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--color-primary)'">+ Yeni Bağlantı</button>` : '';

        html += `
            <div style="padding: 24px 24px 0 24px;">
                <div style="position: relative;">
                    <i class="bi bi-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.9rem;"></i>
                    <input type="text" placeholder="Kişilerde ara..." oninput="filterConnections(this.value, '${tabName}')" style="width: 100%; padding: 8px 12px 8px 36px; border-radius: 8px; background-color: var(--bg-surface-hover); border: 1px solid transparent; color: var(--text-primary); font-size: 0.9rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-primary)'" onblur="this.style.borderColor='transparent'" autocomplete="off" />
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px 8px 24px; gap: 16px;">
                <span class="conn-count-label" style="color: var(--text-muted); font-size: 0.85rem; font-weight: 500; white-space: nowrap;">${labelText}</span>
                ${buttonHtml}
            </div>
            <div id="conn-no-results-${tabName}" style="display: none; text-align: center; color: var(--text-muted); padding: 40px 24px;">
                <i class="bi bi-search" style="font-size: 2rem; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
                <p style="margin: 0; font-size: 0.9rem;">Arama sonucu bulunamadı.</p>
            </div>
        `;
        data.forEach(item => {
            let user = item.otherUser || item.requester || item.receiver;
            let avatar = user.avatarUrl ? `<img src="${getValidAvatarUrl(user.avatarUrl)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.95rem;">${(user.name.charAt(0) + user.surname.charAt(0)).toUpperCase()}</div>`;
            
            let actions = '';
            if (tabName === 'all') {
                actions = `
                    <button style="background: none; border: none; padding: 4px 8px; font-size: 1.3rem; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" title="Mesaj Gönder" onclick="startDM('${user.username}')" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'"><i class="bi bi-chat-text"></i></button>
                    <button style="background: none; border: none; padding: 4px 8px; font-size: 1.3rem; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" title="Bağlantıyı Kaldır" onclick="removeConnection(${item.connectionId})" onmouseover="this.style.color='var(--color-danger)'" onmouseout="this.style.color='var(--text-muted)'"><i class="bi bi-person-x"></i></button>
                `;
            } else if (tabName === 'incoming') {
                actions = `
                    <button style="background: none; border: none; padding: 4px 8px; font-size: 1.3rem; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" title="Reddet" onclick="rejectConnection(${item.connectionId})" onmouseover="this.style.color='var(--color-danger)'" onmouseout="this.style.color='var(--text-muted)'"><i class="bi bi-x-lg"></i></button>
                    <button style="background: none; border: none; padding: 4px 8px; font-size: 1.3rem; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" title="Kabul Et" onclick="acceptConnection(${item.connectionId})" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'"><i class="bi bi-check-lg"></i></button>
                `;
            } else if (tabName === 'outgoing') {
                actions = `
                    <button style="background: none; border: none; padding: 4px 8px; font-size: 1.3rem; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" title="İptal Et" onclick="removeConnection(${item.connectionId})" onmouseover="this.style.color='var(--color-danger)'" onmouseout="this.style.color='var(--text-muted)'"><i class="bi bi-x-lg"></i></button>
                `;
            }
            
            html += `
                <div class="connection-row" data-search="${(user.name + ' ' + user.surname + ' ' + user.username).toLowerCase()}" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; margin: 0; background: transparent; border: none; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="this.style.backgroundColor='transparent'">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        ${avatar}
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${user.name} ${user.surname}</div>
                            <div style="color: var(--text-secondary); font-size: 0.8rem;">@${user.username} ${user.jobTitle ? '• ' + user.jobTitle : ''}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        ${actions}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        contentDiv.innerHTML = html;
        
    } catch (e) {
        contentDiv.innerHTML = '<div style="color: var(--color-danger); text-align: center; margin-top: 20px;">Bağlantılar yüklenirken bir hata oluştu.</div>';
    }
};

window.acceptConnection = async function(id) {
    if (!confirm('Bu bağlantı isteğini onaylamak istediğinize emin misiniz?')) return;
    try {
        const res = await fetch('/api/ConnectionsApi/accept/' + id, { method: 'POST' });
        if (res.ok) loadConnections('incoming');
    } catch(e) {}
};

window.rejectConnection = async function(id) {
    if (!confirm('Bu bağlantı isteğini reddetmek istediğinize emin misiniz?')) return;
    try {
        const res = await fetch('/api/ConnectionsApi/reject/' + id, { method: 'POST' });
        if (res.ok) loadConnections('incoming');
    } catch(e) {}
};

window.removeConnection = async function(id) {
    if (!confirm('Bu bağlantıyı kaldırmak istediğinize emin misiniz?')) return;
    try {
        const res = await fetch('/api/ConnectionsApi/remove/' + id, { method: 'DELETE' });
        if (res.ok) {
            loadConnections('all');
            loadConnections('outgoing');
        }
    } catch(e) {}
};

window.startDM = async function(username) {
    try {
        const res = await fetch('/api/ChatApi/sessions/dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(username)
        });
        
        if (!res.ok) {
            let errMsg = 'Sohbet başlatılamadı.';
            try {
                const errData = await res.json();
                errMsg = errData.error || errData.message || errMsg;
            } catch(e) {
                const textErr = await res.text();
                if (textErr) errMsg = textErr;
            }
            throw new Error(errMsg);
        }
        
        const data = await res.json();
        const sessionId = data.id;
        
        // Switch to dm tab
        switchChatTab('dm');
        
        // Wait for sessions to reload so we can get the title/subtitle
        await loadChatSessions();
        
        // Find the newly loaded session
        const session = currentChatSessions.find(s => s.id === sessionId);
        if (session) {
            let title = session.title;
            let subtitle = session.description || '';
            const myUserId = window.currentUserId ? window.currentUserId : 0;
            const otherUser = session.participants.find(p => p.userId !== myUserId) || session.participants[0];
            
            if (otherUser) {
                const name = otherUser.rawName || otherUser.name || '';
                const surname = otherUser.rawSurname || '';
                title = (name + ' ' + surname).trim() || otherUser.username;
                subtitle = `@${otherUser.username}`;
            }
            
            openChatSession(sessionId, title, subtitle);
        } else {
            openChatSession(sessionId, username, '');
        }
        
    } catch (e) {
        console.error('startDM error:', e);
        showToast(e.message || 'Sohbet başlatılırken bir hata oluştu.', 'error');
    }
};

async function loadChatSessions() {
    const sidebarList = document.getElementById('chat-sidebar-list');
    if (!sidebarList) return;
    
    // Only show loading if empty to prevent flicker
    if (sidebarList.children.length === 0) {
        sidebarList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; margin-top: 20px;">Yükleniyor...</div>';
    }
    
    try {
        const res = await fetch('/api/ChatApi/sessions');
        if (!res.ok) throw new Error("Oturumlar çekilemedi");
        
        currentChatSessions = await res.json();
        
        let typeFilter = window.lastChatListFilter || 1;
        if (window.currentChatTab === 'dm') typeFilter = 1;
        else if (window.currentChatTab === 'groups') typeFilter = 2;
        
        window.lastChatListFilter = typeFilter;
        
        // Ensure unread tracking exists
        if (!window.unreadChatCounts) window.unreadChatCounts = {};

        currentChatSessions.forEach(s => {
            if (typeof s.unreadCount === 'number') {
                window.unreadChatCounts[s.id] = s.unreadCount;
            }
        });

        // Update rail badge with fresh counts
        if (typeof updateRailBadge === 'function') updateRailBadge();

        // Sort by Pinned (true first), then by LastMessageDate (newest first)
        currentChatSessions.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;

            const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
            const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
            return dateB - dateA;
        });

        const filtered = currentChatSessions.filter(s => s.type === typeFilter);
        
        if (filtered.length === 0) {
            sidebarList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-top: 20px;">Sohbet bulunamadı.</div>';
            return;
        }

        const myUserId = (window.currentUserId) ? window.currentUserId : 0; // We might need to expose this from _Layout

        let html = '';
        filtered.forEach(s => {
            let title = s.title;
            let subtitle = s.description || '';
            let avatarHtml = '';
            let initials = '?';
            let iconColor = 'var(--text-muted)';
            
            if (s.type === 1) { // DM
                const otherUsers = s.participants.filter(p => p.userId !== myUserId);
                if (otherUsers.length > 1) {
                    // Group DM
                    const allSortedUsers = [...s.participants].sort((a, b) => (a.rawName || a.username || '').localeCompare(b.rawName || b.username || ''));
                    title = s.title || allSortedUsers.map(u => (u.rawName || u.name || u.username || '').split(' ')[0]).join(', ');
                    subtitle = s.description || `${s.participants.length} kişi`;
                    
                    if (s.imageUrl) {
                        avatarHtml = `<img src="${getValidAvatarUrl(s.imageUrl)}" alt="${escapeHtml(title)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
                    } else {
                        const getAvatarContent = (u) => {
                            if (u && u.avatarUrl) return `<img src="${getValidAvatarUrl(u.avatarUrl)}" style="width: 100%; height: 100%; object-fit: cover;" />`;
                            const init = u ? escapeHtml(((u.rawName||u.name||u.username||'U').charAt(0) + (u.rawSurname||'').charAt(0)).toUpperCase()) : 'U';
                            return `<div style="width: 100%; height: 100%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: bold;">${init}</div>`;
                        };
                        avatarHtml = `
                            <div style="width: 40px; height: 40px; position: relative; flex-shrink: 0;">
                                <div style="position: absolute; top: 0; left: 0; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--bg-surface); overflow: hidden; z-index: 2;">
                                    ${getAvatarContent(allSortedUsers[0])}
                                </div>
                                <div style="position: absolute; bottom: 0; right: 0; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--bg-surface); overflow: hidden; z-index: 1;">
                                    ${getAvatarContent(allSortedUsers[1])}
                                </div>
                            </div>
                        `;
                    }
                } else {
                    const otherUser = otherUsers[0] || s.participants[0];
                    if (otherUser) {
                        title = s.title || otherUser.name;
                        subtitle = s.description || `@${otherUser.username}`;
                        const name = otherUser.rawName || otherUser.name || '';
                        const surname = otherUser.rawSurname || '';
                        initials = escapeHtml((name.charAt(0) + surname.charAt(0)).toUpperCase() || 'U');
                        iconColor = 'var(--color-primary)';
                        
                        if (otherUser.avatarUrl) {
                            const safeUrl = getValidAvatarUrl(otherUser.avatarUrl);
                            avatarHtml = `<img src="${safeUrl}" alt="${escapeHtml(title)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
                        }
                    }
                }
            } else {
                initials = '<i class="bi bi-people-fill"></i>';
            }
            
            if (!avatarHtml) {
                avatarHtml = `<div style="width: 40px; height: 40px; border-radius: 50%; background: ${iconColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">${initials}</div>`;
            }

            const timeStr = s.lastMessageDate ? new Date(s.lastMessageDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit' }) : '';
            let lastMsg = s.lastMessage || 'Yeni sohbet oluşturuldu';
            if (s.lastMessageSenderId && s.lastMessageSenderId === myUserId && s.lastMessage) {
                lastMsg = 'Siz: ' + lastMsg;
            }
            
            lastMsg = escapeHtml(lastMsg);
            lastMsg = lastMsg.replace(/\[([^\]]+)\]\([^)]+\)/g, (match, p1) => {
                const isImage = p1.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
                const icon = isImage ? '<i class="bi bi-image"></i>' : '<i class="bi bi-paperclip"></i>';
                return `${icon} ${p1}`;
            }).replace(/\n/g, ' ');
            
            const unreadCount = window.unreadChatCounts[s.id] || 0;
            const unreadBadge = unreadCount > 0 ? `<div id="unread-badge-${s.id}" style="background: var(--color-danger); color: white; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 12px; line-height: 1; margin-left: auto;">${unreadCount}</div>` : '';

            let rightClickOtherUser = '';
            if (s.type === 1) {
                const otherUser = s.participants.find(p => p.userId !== myUserId) || s.participants[0];
                if (otherUser) {
                    rightClickOtherUser = otherUser.username || '';
                }
            }

            html += `
                <div class="chat-list-item ${activeChatSessionId === s.id ? 'active-chat' : ''}" onclick="openChatSession(${s.id}, '${escapeHtml(title)}', '${escapeHtml(subtitle)}')" oncontextmenu="showChatSessionCtxMenu(event, ${s.id}, ${s.type}, '${escapeHtml(rightClickOtherUser)}')" style="padding: 12px 20px; border-radius: 0; margin: 0 -8px; cursor: pointer; display: flex; gap: 12px; align-items: center; transition: background 0.2s; background-color: ${activeChatSessionId === s.id ? 'rgba(255, 255, 255, 0.12)' : 'transparent'}; position: relative;">
                    ${avatarHtml}
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; align-items: center;">
                            <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">
                                ${s.isPinned ? '<i class="bi bi-pin-angle-fill" style="color: var(--text-muted); font-size: 0.8rem; margin-right: 6px;"></i>' : ''}
                                ${s.isMuted ? '<i class="bi bi-bell-slash-fill" style="color: var(--text-muted); font-size: 0.8rem; margin-right: 6px;"></i>' : ''}
                                ${escapeHtml(title)}
                            </span>
                            <span id="chat-time-${s.id}" style="font-size: 0.75rem; color: ${unreadCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}; font-weight: ${unreadCount > 0 ? 'bold' : 'normal'}; flex-shrink: 0; margin-left: 8px;">${timeStr}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div id="chat-lastmsg-${s.id}" style="font-size: 0.8rem; color: ${unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight: ${unreadCount > 0 ? '600' : 'normal'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${lastMsg}</div>
                            ${unreadBadge}
                        </div>
                    </div>
                </div>
            `;
        });
        
        sidebarList.innerHTML = html;
        updateRailBadge();
        
        // Add hover effects via JS
        document.querySelectorAll('.chat-list-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (!item.classList.contains('active-chat')) {
                    item.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
            });
            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('active-chat')) {
                    item.style.backgroundColor = 'transparent';
                } else {
                    item.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }
            });
        });

    } catch (e) {
        console.error('loadChatSessions Error:', e);
        sidebarList.innerHTML = '<div style="color: var(--color-danger); font-size: 0.85rem; text-align: center; margin-top: 20px;">Hata oluştu: ' + e.message + '</div>';
    }
}

window.toggleChatDetailsDrawer = function() {
    const drawer = document.getElementById('chat-details-drawer');
    if (drawer) {
        if (drawer.style.display === 'none') {
            drawer.style.display = 'flex';
        } else {
            drawer.style.display = 'none';
        }
    }
};

window.closeChatDetailsDrawer = function() {
    const drawer = document.getElementById('chat-details-drawer');
    if (drawer) {
        drawer.style.display = 'none';
    }
};

window.openChatSession = async function(id, title, subtitle) {
    activeChatSessionId = id;
    
    // Clear unread count when opening the chat
    if (window.unreadChatCounts && window.unreadChatCounts[id]) {
        window.unreadChatCounts[id] = 0;
        updateRailBadge();
        const bndg = document.getElementById('unread-badge-' + id);
        if (bndg) bndg.style.display = 'none';
        
        const timeEl = document.getElementById('chat-time-' + id);
        if (timeEl) {
            timeEl.style.color = 'var(--text-muted)';
            timeEl.style.fontWeight = 'normal';
        }
        
        const lastMsgEl = document.getElementById('chat-lastmsg-' + id);
        if (lastMsgEl) {
            lastMsgEl.style.color = 'var(--text-secondary)';
            lastMsgEl.style.fontWeight = 'normal';
        }
    }
    
    if (typeof window.joinChatSessionGroup === 'function') {
        window.joinChatSessionGroup(id);
    }
    
    // Update Active Styling
    document.querySelectorAll('.chat-list-item').forEach(item => {
        item.classList.remove('active-chat');
        item.style.backgroundColor = 'transparent';
    });
    
    // Try to find the item in the DOM by its onclick attribute pointing to this id
    let clickedItem = null;
    const sidebarList = document.getElementById('chat-sidebar-list');
    if (sidebarList) {
        const items = sidebarList.querySelectorAll('.chat-list-item');
        for (let item of items) {
            const attr = item.getAttribute('onclick') || '';
            if (attr.includes(`openChatSession(${id},`)) {
                clickedItem = item;
                break;
            }
        }
    }
    
    // Fallback to event if not found
    if (!clickedItem && window.event) {
        if (window.event.currentTarget && window.event.currentTarget.classList && window.event.currentTarget.classList.contains('chat-list-item')) {
            clickedItem = window.event.currentTarget;
        } else if (window.event.target) {
            clickedItem = window.event.target.closest('.chat-list-item');
        }
    }
    
    if (clickedItem) {
        clickedItem.classList.add('active-chat');
        clickedItem.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
    }

    // Update Header
    document.getElementById('chat-main-title').innerText = title;
    const subEl = document.getElementById('chat-main-subtitle');
    const divEl = document.getElementById('chat-main-divider');
    subEl.innerText = subtitle;
    
    if (subtitle && subtitle.trim() !== '') {
        subEl.style.display = 'block';
        if (divEl) divEl.style.display = 'block';
    } else {
        subEl.style.display = 'none';
        if (divEl) divEl.style.display = 'none';
    }
    
    // Update Header Avatar
    const session = currentChatSessions.find(s => s.id === id);
    const avatarContainer = document.getElementById('chat-main-avatar');
    if (session && avatarContainer) {
        const myUserId = window.currentUserId ? window.currentUserId : 0;
        let avatarHtml = '';
        let initials = '?';
        let iconColor = 'var(--text-muted)';
        
        if (session.type === 1) { // DM
            const otherUsers = session.participants.filter(p => p.userId !== myUserId);
            if (otherUsers.length > 1) {
                // Group DM
                const allSortedUsers = [...session.participants].sort((a, b) => (a.rawName || a.username || '').localeCompare(b.rawName || b.username || ''));
                if (session.imageUrl) {
                    avatarHtml = `<img src="${getValidAvatarUrl(session.imageUrl)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
                } else {
                    const getAvatarContent = (u) => {
                        if (u && u.avatarUrl) return `<img src="${getValidAvatarUrl(u.avatarUrl)}" style="width: 100%; height: 100%; object-fit: cover;" />`;
                        const init = u ? escapeHtml(((u.rawName||u.name||u.username||'U').charAt(0) + (u.rawSurname||'').charAt(0)).toUpperCase()) : 'U';
                        return `<div style="width: 100%; height: 100%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.55rem; font-weight: bold;">${init}</div>`;
                    };
                    avatarHtml = `
                        <div style="width: 32px; height: 32px; position: relative; flex-shrink: 0;">
                            <div style="position: absolute; top: 0; left: 0; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--bg-surface); overflow: hidden; z-index: 2;">
                                ${getAvatarContent(allSortedUsers[0])}
                            </div>
                            <div style="position: absolute; bottom: 0; right: 0; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--bg-surface); overflow: hidden; z-index: 1;">
                                ${getAvatarContent(allSortedUsers[1])}
                            </div>
                        </div>
                    `;
                }
            } else {
                const otherUser = otherUsers[0] || session.participants[0];
                if (otherUser) {
                    const name = otherUser.rawName || otherUser.name || '';
                    const surname = otherUser.rawSurname || '';
                    initials = escapeHtml((name.charAt(0) + surname.charAt(0)).toUpperCase() || 'U');
                    iconColor = 'var(--color-primary)';
                    
                    if (otherUser.avatarUrl) {
                        const safeUrl = getValidAvatarUrl(otherUser.avatarUrl);
                        avatarHtml = `<img src="${safeUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
                    }
                }
            }
        } else {
            initials = '<i class="bi bi-people-fill"></i>';
        }
        
        if (!avatarHtml) {
            avatarHtml = `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${iconColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem; flex-shrink: 0;">${initials}</div>`;
        }
        avatarContainer.innerHTML = avatarHtml;
    }
    
    // Show Input Area and Header
    document.getElementById('chat-main-input-area').style.display = 'block';
    document.getElementById('chat-main-header-wrapper').style.display = 'block';
    
    // Hide connections dashboard if open and switch active tab UI
    if (window.currentChatTab === 'connections') {
        const connDash = document.getElementById('chat-connections-dashboard');
        if (connDash) connDash.style.display = 'none';
        
        window.currentChatTab = (session && session.type === 2) ? 'groups' : 'dm';
        document.querySelectorAll('.chat-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-secondary)';
            btn.style.fontWeight = '500';
        });
        const activeBtn = document.getElementById('btn-tab-' + window.currentChatTab);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.background = 'var(--bg-surface-elevated)';
            activeBtn.style.color = 'var(--text-primary)';
            activeBtn.style.fontWeight = '600';
        }
    }
    
    // Close details drawer if it was open
    closeChatDetailsDrawer();
    
    // Populate drawer data
    if (session && session.type === 1) { // DM
        const otherUser = session.participants.find(p => p.userId !== window.currentUserId) || session.participants[0];
        if (otherUser) {
            document.getElementById('chat-header-info-email').innerText = otherUser.email || 'Belirtilmemiş';
            document.getElementById('chat-header-info-phone').innerText = otherUser.phoneNumber || 'Belirtilmemiş';
            
            const name = otherUser.rawName || otherUser.name || '';
            const surname = otherUser.rawSurname || '';
            const fullName = (name + ' ' + surname).trim();
            const initials = escapeHtml((name.charAt(0) + surname.charAt(0)).toUpperCase() || 'U');
            
            document.getElementById('chat-details-name').innerText = escapeHtml(fullName) || 'Kullanıcı';
            document.getElementById('chat-details-username').innerText = otherUser.username ? '@' + escapeHtml(otherUser.username) : '';
            
            const avatarContainer = document.getElementById('chat-details-avatar');
            if (otherUser.avatarUrl) {
                const safeUrl = getValidAvatarUrl(otherUser.avatarUrl);
                avatarContainer.innerHTML = `<img src="${safeUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />`;
                avatarContainer.style.background = 'transparent';
            } else {
                avatarContainer.innerHTML = initials;
                avatarContainer.style.background = 'var(--color-primary)';
            }
        }
    } else {
        document.getElementById('chat-header-info-email').innerText = 'Grup Sohbeti';
        document.getElementById('chat-header-info-phone').innerText = '-';
        document.getElementById('chat-details-name').innerText = escapeHtml(title || 'Grup Sohbeti');
        document.getElementById('chat-details-username').innerText = '';
        
        const avatarContainer = document.getElementById('chat-details-avatar');
        avatarContainer.innerHTML = '<i class="bi bi-people-fill"></i>';
        avatarContainer.style.background = 'var(--text-muted)';
    }
    
    const messagesArea = document.getElementById('chat-main-messages');
    messagesArea.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: auto; margin-bottom: auto;">Mesajlar yükleniyor...</div>';
    
    try {
        let url = '/api/ChatApi/messages/' + id;
        let skipMarkRead = false;
        if (window.skipMarkReadNextTime) {
            url += '?markRead=false';
            skipMarkRead = true;
            window.skipMarkReadNextTime = false;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error();
        
        const messages = await res.json();
        
        if (messages.length === 0) {
            messagesArea.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: auto; margin-bottom: auto;">Henüz mesaj yok.</div>';
            return;
        }

        messagesArea.innerHTML = '';
        const myUserId = window.currentUserId ? window.currentUserId : 0;
        
        window.hasInsertedUnreadDivider = false;
        const unreadCountForDivider = messages.filter(m => m.isUnreadForMe).length;

        messages.forEach(m => {
            appendMessageToDOM(m, myUserId, unreadCountForDivider);
        });
        
        const divider = messagesArea.querySelector('.chat-unread-divider');
        if (divider) {
            divider.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
        
        // Notify others that we read the messages (only if we didn't explicitly skip marking as read)
        if (!skipMarkRead && window.chatConnection && window.chatConnection.state === 'Connected') {
            window.chatConnection.invoke("MarkAsRead", id).catch(console.error);
        }

    } catch (e) {
        console.error("Chat loading error:", e);
        messagesArea.innerHTML = '<div style="text-align: center; color: var(--color-danger); margin-top: auto; margin-bottom: auto;">Mesajlar yüklenemedi: ' + escapeHtml(e.toString()) + '</div>';
    }
};

function getValidAvatarUrl(url) {
    if (!url) return '';
    
    // Temizlik: Bazen DB'den tırnak veya boşlukla gelebilir
    url = url.trim().replace(/^["']|["']$/g, '');
    
    if (url === 'default-avatar.png' || url === '/default-avatar.png') {
        return ''; // Baş harflere fallback yapması için
    }
    
    // Eğer veritabanında 'pub-xxx.r2.dev/...' gibi https olmadan Cloudflare linki kaldıysa düzelt:
    if ((url.includes('.r2.dev') || url.includes('cloudflare')) && !url.startsWith('http')) {
        url = 'https://' + url;
    }
    
    // Eğer R2 URL'i ise proxy üzerinden çek (ERR_CONNECTION_RESET / Block sorunlarını aşmak için)
    if (url.includes('.r2.dev')) {
        return '/api/UserApi/avatar-proxy?url=' + encodeURIComponent(url);
    }
    
    // Zaten http veya mutlak/göreli geçerli bir yolsa
    if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/')) return url;
    
    if (url.startsWith('~/')) return url.substring(1);
    
    return '/' + url;
}

function getFileIconData(ext) {
    ext = (ext || '').toLowerCase();
    switch (ext) {
        case 'pdf': return { icon: 'bi-file-earmark-pdf', color: 'var(--text-muted)' };
        case 'doc': case 'docx': return { icon: 'bi-file-earmark-word', color: 'var(--text-muted)' };
        case 'xls': case 'xlsx': case 'csv': return { icon: 'bi-file-earmark-excel', color: 'var(--text-muted)' };
        case 'ppt': case 'pptx': return { icon: 'bi-file-earmark-ppt', color: 'var(--text-muted)' };
        case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return { icon: 'bi-file-earmark-zip', color: 'var(--text-muted)' };
        case 'mp3': case 'wav': case 'ogg': return { icon: 'bi-file-earmark-music', color: 'var(--text-muted)' };
        case 'mp4': case 'avi': case 'mkv': case 'mov': return { icon: 'bi-file-earmark-play', color: 'var(--text-muted)' };
        case 'txt': case 'rtf': case 'md': return { icon: 'bi-file-earmark-text', color: 'var(--text-muted)' };
        case 'js': case 'cs': case 'html': case 'css': case 'json': case 'xml': return { icon: 'bi-file-earmark-code', color: 'var(--text-muted)' };
        default: return { icon: 'bi-file-earmark', color: 'var(--text-muted)' };
    }
}

function appendMessageToDOM(m, myUserId, unreadCountForDivider = 0) {
    const messagesArea = document.getElementById('chat-main-messages');
    if (!messagesArea) return;
    
    // Find last message element that has date data
    const elements = Array.from(messagesArea.children);
    let lastMsgEl = null;
    for (let i = elements.length - 1; i >= 0; i--) {
        if (elements[i].hasAttribute('data-created-at')) {
            lastMsgEl = elements[i];
            break;
        }
    }
    
    const currentDate = new Date(m.createdAt);
    const currentDateStr = currentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    let lastDateStr = null;
    let insertedDivider = false;
    
    if (lastMsgEl) {
        const prevAt = lastMsgEl.getAttribute('data-created-at');
        if (prevAt) lastDateStr = new Date(prevAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    
    if (lastDateStr !== null && lastDateStr !== currentDateStr) {
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-date-divider" style="display: flex; align-items: center; text-align: center; margin: 16px 24px 8px 24px; color: var(--text-muted); font-size: 0.75rem; font-weight: 500; user-select: none;">
                <div style="flex: 1; border-bottom: 1px solid var(--border-color);"></div>
                <span style="padding: 0 12px;">${currentDateStr}</span>
                <div style="flex: 1; border-bottom: 1px solid var(--border-color);"></div>
            </div>
        `);
        insertedDivider = true;
    } else if (lastDateStr === null && !messagesArea.querySelector('.chat-date-divider')) {
         messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-date-divider" style="display: flex; align-items: center; text-align: center; margin: 16px 24px 8px 24px; color: var(--text-muted); font-size: 0.75rem; font-weight: 500; user-select: none;">
                <div style="flex: 1; border-bottom: 1px solid var(--border-color);"></div>
                <span style="padding: 0 12px;">${currentDateStr}</span>
                <div style="flex: 1; border-bottom: 1px solid var(--border-color);"></div>
            </div>
        `);
        insertedDivider = true;
    }
    
    if (m.isUnreadForMe && !window.hasInsertedUnreadDivider && unreadCountForDivider > 0) {
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-unread-divider" style="display: flex; align-items: center; text-align: center; margin: 16px 24px 8px 24px; color: var(--color-danger); font-size: 0.75rem; font-weight: 500; user-select: none;">
                <div style="flex: 1; border-bottom: 1px solid var(--color-danger);"></div>
                <span style="padding: 0 12px;">${unreadCountForDivider} okunmamış ileti</span>
                <div style="flex: 1; border-bottom: 1px solid var(--color-danger);"></div>
            </div>
        `);
        window.hasInsertedUnreadDivider = true;
        insertedDivider = true;
    }
    
    if (m.isSystemMessage) {
        let lastEl = messagesArea.lastElementChild;
        let senderName = escapeHtml(m.senderName && m.senderName !== "Bilinmiyor" ? m.senderName : "Sistem");
        let contentHtml = escapeHtml(m.content);
        
        if (lastEl && lastEl.classList.contains('chat-system-group') && !insertedDivider && lastEl.getAttribute('data-sender-id') == m.senderId) {
            let count = parseInt(lastEl.getAttribute('data-count')) + 1;
            lastEl.setAttribute('data-count', count);
            
            const summarySpan = lastEl.querySelector('.chat-system-summary-text');
            const detailsDiv = lastEl.querySelector('.chat-system-details');
            const chevron = lastEl.querySelector('.bi-chevron-expand');
            
            summarySpan.innerText = `${senderName}, ${count} işlem gerçekleştirdi`;
            if (chevron) chevron.style.display = 'inline-block';
            
            const borderTop = detailsDiv.children.length > 0 ? 'border-top: 1px solid var(--border-color);' : '';
            detailsDiv.insertAdjacentHTML('beforeend', `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 6px 12px; ${borderTop}">${contentHtml}</div>
            `);
        } else {
            messagesArea.insertAdjacentHTML('beforeend', `
                <div class="chat-system-group" data-sender-id="${m.senderId}" data-count="1" data-created-at="${m.createdAt}" style="text-align: center; margin: 12px 24px;">
                    <div class="chat-system-summary" onclick="const d = this.nextElementSibling; if(d.children.length > 1) { d.style.display = d.style.display === 'none' ? 'block' : 'none'; }" style="display: inline-flex; align-items: center; justify-content: center; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.75rem; padding: 4px 12px; border-radius: 12px; cursor: pointer; user-select: none; transition: background-color 0.2s;" onmouseover="if(this.nextElementSibling.children.length > 1) this.style.backgroundColor='var(--bg-surface-hover)';" onmouseout="this.style.backgroundColor='var(--bg-surface-elevated)';">
                        <span class="chat-system-summary-text">${contentHtml}</span>
                        <i class="bi bi-chevron-expand" style="margin-left: 4px; display: none;"></i>
                    </div>
                    <div class="chat-system-details" style="display: none; margin-top: 8px; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: 8px; text-align: left; overflow: hidden; max-width: 450px; margin-left: auto; margin-right: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <div style="font-size: 0.75rem; color: var(--text-muted); padding: 6px 12px;">${contentHtml}</div>
                    </div>
                </div>
            `);
        }
        return;
    }

    const timeStr = new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit' });
    const isMe = (m.senderId === myUserId);
    const initials = (m.senderName && m.senderName !== "Bilinmiyor") ? m.senderName.substring(0, 2).toUpperCase() : "??";
    
    const session = currentChatSessions.find(s => s.id === activeChatSessionId);
    const isGroup = session ? session.type === 2 : false;
    let lastRow = messagesArea.lastElementChild;
    
    if (insertedDivider) {
        lastRow = null;
    }
    
    let shouldGroup = false;
    if (lastRow && lastRow.classList.contains('chat-message-row')) {
        const lastSender = lastRow.getAttribute('data-sender-id');
        const lastTime = lastRow.getAttribute('data-created-at');
        if (lastSender == m.senderId && lastTime) {
            const diffMs = new Date(m.createdAt) - new Date(lastTime);
            if (diffMs >= 0 && diffMs <= 120000) {
                shouldGroup = true;
            }
        }
    }

    // Check if avatar exists
    let avatarHtml = '';
    const tooltipAttrs = m.senderUsername ? `onmouseenter="showMentionTooltip(event, '${escapeHtml(m.senderUsername)}')" onmouseleave="hideMentionTooltip()"` : '';
    
    if (shouldGroup) {
        avatarHtml = `<div class="hover-timestamp" style="width: 32px; height: 1.26rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.65rem; color: var(--text-muted); cursor: default; user-select: none;">${timeStr}</div>`;
    } else {
        if (m.avatarUrl) {
            const safeUrl = getValidAvatarUrl(m.avatarUrl);
            avatarHtml = `<img src="${safeUrl}" alt="${escapeHtml(m.senderName)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; cursor: pointer; user-select: none;" ${tooltipAttrs} />`;
        } else {
            avatarHtml = `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${isMe ? 'var(--color-primary)' : '#6366f1'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; flex-shrink: 0; cursor: pointer; user-select: none;" ${tooltipAttrs}>${initials}</div>`;
        }
    }
    
    let isTaggedMessage = false;
    let contentHTML = escapeHtml(m.content || '');
    let isOnlyImageMessage = false;
    let hasNonImageFile = false;
    let isOnlyEmojiMessage = false;
    
    let rawTextForEmoji = (m.content || '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '').trim();
    if (rawTextForEmoji.length > 0 && rawTextForEmoji.length <= 50) {
        const stripped = rawTextForEmoji.replace(/[\s\uFE0F\u200D]/g, '');
        if (stripped.length > 0) {
            try {
                isOnlyEmojiMessage = new RegExp('^[\\p{Extended_Pictographic}]+$', 'u').test(stripped);
            } catch (e) {
                // Ignore regex errors in older browsers
            }
        }
    }
    
    contentHTML = contentHTML.replace(/(?:\r?\n)*\[([^\]]+)\]\(([^)]+)\)(?:\r?\n)*/g, (match, fileName, url) => {
        let cleanFileName = fileName.trim();
        let fileSize = null;
        if (cleanFileName.includes('|')) {
            const parts = cleanFileName.split('|');
            cleanFileName = parts[0];
            fileSize = parseInt(parts[1], 10);
        }
        
        const cleanUrl = url.trim().split('?')[0]; // Query parametrelerini yoksay
        const isImage = cleanFileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || cleanUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
        
        let safeUrl = url;
        let safeFileUrl = url;
        
        if (url.includes('.r2.dev')) {
            if (!url.includes('avatar-proxy')) safeUrl = '/api/UserApi/avatar-proxy?url=' + encodeURIComponent(url);
            if (!url.includes('file-proxy')) safeFileUrl = '/api/UserApi/file-proxy?url=' + encodeURIComponent(url) + '&filename=' + encodeURIComponent(cleanFileName);
        }
        
        if (isImage) {
            if ((m.content || '').trim() === match.trim()) {
                isOnlyImageMessage = true;
            }
            return `<div style="margin-top: 6px; margin-bottom: 4px; position: relative; display: block; width: fit-content; line-height: 0; font-size: 0; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); max-width: 100%; user-select: none;"><img src="${safeUrl}" style="max-width: 100%; max-height: 220px; cursor: pointer; object-fit: contain; display: block; margin: 0; padding: 0;" onclick="openChatImageModal('${safeUrl}')" title="${escapeHtml(cleanFileName)}" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding:6px; border:1px solid var(--border-color); border-radius:6px; color:var(--text-muted); line-height: 1.4; font-size: 0.9rem;\\'><i class=\\'bi bi-image\\'></i> Yüklenemedi: '+escapeHtml('${cleanFileName}')+'</div>';" /></div>`;
        } else {
            hasNonImageFile = true;
            
            let sizeStr = '';
            if (fileSize !== null && !isNaN(fileSize)) {
                if (fileSize < 1024) sizeStr = fileSize + ' B';
                else if (fileSize < 1024 * 1024) sizeStr = (fileSize / 1024).toFixed(1) + ' KB';
                else sizeStr = (fileSize / (1024 * 1024)).toFixed(1) + ' MB';
            }
            
            const extMatch = cleanFileName.match(/\.([^.]+)$/);
            const ext = extMatch ? extMatch[1].toUpperCase() : 'BİLİNMEYEN';
            const typeStr = `${ext} Dosyası`;
            const subText = sizeStr ? `${sizeStr} • ${typeStr}` : typeStr;
            
            const fileIconData = getFileIconData(extMatch ? extMatch[1] : '');
            const iconClass = fileIconData.icon;
            const iconColor = fileIconData.color;
            
            return `<div style="margin-top: 6px; margin-bottom: 4px; display: flex; justify-content: flex-start;"><a href="${safeFileUrl}" target="_blank" style="display: inline-flex; flex-direction: row; align-items: center; gap: 12px; padding: 8px 14px; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); text-decoration: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background-color 0.2s; user-select: none;" onmouseover="this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="this.style.backgroundColor='var(--bg-surface-elevated)'">
                        <i class="bi ${iconClass}" style="font-size: 1.6rem; color: ${iconColor};"></i>
                        <div style="display: flex; flex-direction: column; justify-content: center; text-align: left;">
                            <span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; font-weight: 600; line-height: 1.2;">${escapeHtml(cleanFileName)}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500; margin-top: 4px; line-height: 1;">${escapeHtml(subText)}</span>
                        </div>
                    </a></div>`;
        }
    });
    
    contentHTML = contentHTML.replace(/@([\w.]+)/g, (match, username) => {
        let isMentionMe = false;
        let foundName = username;
        if (session && session.participants) {
            const p = session.participants.find(part => part.username && part.username.toLowerCase() === username.toLowerCase());
            if (p) {
                foundName = (p.rawName || p.name || '') + ' ' + (p.rawSurname || '');
                if (p.userId === myUserId) isMentionMe = true;
            }
        }
        
        if (isMentionMe) isTaggedMessage = true;
        const isMentionColor = isMe || isMentionMe;
        const tagColor = isMentionColor ? 'var(--chat-tag, #0d6efd)' : 'inherit';
        const bgClass = isMe ? 'chat-mention-tag-me' : 'chat-mention-tag-other';
        return `<span class="chat-mention-tag ${bgClass}" style="color: ${tagColor}; font-weight: 600; cursor: pointer;" onmouseenter="showMentionTooltip(event, '${escapeHtml(username)}')" onmouseleave="hideMentionTooltip()">@${escapeHtml(foundName.trim())}</span>`;
    });

    const isHighlighted = isTaggedMessage && !isMe;
    let prevIsHighlighted = false;
    if (lastRow && lastRow.classList.contains('chat-message-row')) {
        if (lastRow.getAttribute('data-is-highlighted') === 'true') {
            prevIsHighlighted = true;
        }
    }

    const rowBg = isHighlighted ? 'var(--chat-tagged-bg, rgba(13, 110, 253, 0.1))' : 'transparent';
    let rowBorderTop = isHighlighted ? '1px solid var(--chat-tagged-border, rgba(13, 110, 253, 0.2))' : '1px solid transparent';
    let rowBorderBottom = isHighlighted ? '1px solid var(--chat-tagged-border, rgba(13, 110, 253, 0.2))' : '1px solid transparent';
    let rowMarginTop = shouldGroup ? '0' : (lastRow ? '24px' : '4px');

    // Art arda gelen etiketlenmiş mesajları birleştir
    if (isHighlighted && prevIsHighlighted) {
        rowBorderTop = '1px solid transparent';
        rowMarginTop = '0';
        if (lastRow) {
            lastRow.style.borderBottom = '1px solid transparent';
        }
    }

    let replyHtml = '';
    if (m.replyToId) {
        let replyUser = m.replyToUser || 'Bilinmiyor';
        let replyContent = m.replyToContent || '[Resim/Dosya]';
        
        if (!m.replyToContent && window.currentDMMessages && window.currentDMMessages[m.replyToId]) {
            const rMsg = window.currentDMMessages[m.replyToId];
            replyContent = rMsg.content || '[Resim/Dosya]';
            if (!m.replyToUser) {
                const myUserId = window.currentUserId ? window.currentUserId : 0;
                replyUser = rMsg.senderName || 'Bilinmiyor';
            }
        }
        
        if (replyContent) {
            replyContent = escapeHtml(replyContent);
            replyContent = replyContent.replace(/\[([^\]]+)\]\([^)]+\)/g, (match, p1) => {
                let cleanFileName = p1.trim();
                if (cleanFileName.includes('|')) {
                    cleanFileName = cleanFileName.split('|')[0];
                }
                const extMatch = cleanFileName.match(/\.([^.]+)$/);
                const ext = extMatch ? extMatch[1] : '';
                const isImage = cleanFileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
                
                let iconClass = 'bi-paperclip';
                if (isImage) {
                    iconClass = 'bi-image';
                } else if (ext) {
                    iconClass = getFileIconData(ext).icon;
                }
                
                return `<i class="bi ${iconClass}"></i> ${cleanFileName}`;
            }).replace(/\n/g, ' ');
        }
        
        replyHtml = `
            <div onclick="const row = document.querySelector('.chat-message-time[data-message-id=\\'${m.replyToId}\\']'); if(row) { const r = row.closest('.chat-message-row'); if(r) { r.scrollIntoView({ behavior: 'smooth', block: 'center' }); const bg = r.style.backgroundColor; r.style.backgroundColor = 'var(--color-primary-light)'; r.style.transition = 'background-color 0.5s'; setTimeout(() => r.style.backgroundColor = bg, 1500); } }" style="display: flex; flex-direction: row; align-items: center; gap: 6px; border-left: 3px solid var(--border-color); padding: 2px 8px; margin-bottom: 4px; border-radius: 2px; font-size: 0.75rem; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; max-width: 100%; overflow: hidden; white-space: nowrap;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                <span style="color: var(--text-primary); font-weight: 600; flex-shrink: 0;">${escapeHtml(replyUser)}</span>
                <span style="color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${replyContent}</span>
            </div>
        `;
    }
    const editedHtml = m.updatedAt ? `<span class="chat-edited-tag" style="font-size: 0.65rem; color: var(--text-muted); margin-left: 4px; vertical-align: middle; user-select: none; cursor: default;" title="Düzenlendi">(düzenlendi)</span>` : '';
    if (contentHTML) {
        contentHTML += editedHtml;
    } else if (editedHtml) {
        contentHTML = editedHtml;
    }
    const getActionBarHtml = (isSenderMe) => {
        let btnHtml = '';
        if (isSenderMe) {
            btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('react', ${m.id}, event)" title="Tepki Ekle"><i class="bi bi-emoji-smile"></i></button>`;
            btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('edit', ${m.id}, event)" title="Düzenle"><i class="bi bi-pencil"></i></button>`;
            btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('forward', ${m.id}, event)" title="İlet"><i class="bi bi-share"></i></button>`;
        } else {
            btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('react', ${m.id}, event)" title="Tepki Ekle"><i class="bi bi-emoji-smile"></i></button>`;
            btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('forward', ${m.id}, event)" title="İlet"><i class="bi bi-share"></i></button>`;
            btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('reply', ${m.id}, event)" title="Yanıtla"><i class="bi bi-reply"></i></button>`;
        }
        
        btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); window.showDMCtxMenu(event, ${m.id}, ${isSenderMe}, false, ${m.isPinned ? 'true' : 'false'})" title="Daha Fazla"><i class="bi bi-three-dots"></i></button>`;
        
        return `<div class="chat-action-bar" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: absolute; right: 24px; top: -12px; z-index: 10;">${btnHtml}</div>`;
    };

    const textFontSize = isOnlyEmojiMessage ? '2.5rem' : '0.9rem';
    const textLineHeight = isOnlyEmojiMessage ? '1.2' : '1.4';

    if (isMe) {
        const senderNameHtmlMe = (!shouldGroup) ? `<div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; display: flex; justify-content: flex-start; align-items: center; gap: 6px; user-select: none;">
            <span ${m.senderUsername ? `style="cursor: pointer; color: var(--text-primary);" onmouseenter="showMentionTooltip(event, '${escapeHtml(m.senderUsername)}')" onmouseleave="hideMentionTooltip()"` : ''}>${escapeHtml(m.senderName)}</span>
            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal;">${timeStr}</span>
        </div>` : '';
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-message-row" data-sender-id="${m.senderId}" data-created-at="${m.createdAt}" data-is-highlighted="${isHighlighted}" style="position: relative; background-color: ${rowBg}; border-top: ${rowBorderTop}; border-bottom: ${rowBorderBottom}; margin: ${rowMarginTop} -24px 0 -24px; padding: 2px 24px; transition: background-color 0.1s;" oncontextmenu="showDMCtxMenu(event, ${m.id}, true, ${m.isRead}, ${m.isPinned || false})">
                ${getActionBarHtml(true)}
                ${replyHtml ? `<div style="margin-left: 48px; margin-bottom: 4px;">${replyHtml}</div>` : ''}
                <div class="chat-bubble-wrapper" style="position: relative; display: flex; justify-content: flex-start; align-items: center; gap: 16px; width: 100%;">
                    <i id="chat-pin-icon-${m.id}" class="bi bi-pin-fill" style="position: absolute; left: -18px; top: 50%; transform: translateY(-50%); font-size: 0.7rem; color: var(--color-warning); display: ${m.isPinned ? 'inline-block' : 'none'}; z-index: 5;" title="Sabitlenmiş Mesaj"></i>
                    ${avatarHtml}
                    <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: 0; max-width: calc(100% - 88px);">
                        ${senderNameHtmlMe}
                        <div class="chat-message-bubble-inner" style="position: relative; background: transparent; padding: 0; border-radius: 0; box-shadow: none; display: flex; flex-direction: column; min-width: 70px;">
                            <span data-message-id="${m.id}" class="chat-message-time" data-created-at="${m.createdAt}" style="display: none;">${timeStr}</span>
                            <div style="display: flex; ${hasNonImageFile ? 'flex-direction: column; align-items: stretch; gap: 0;' : 'flex-wrap: wrap; align-items: flex-end; gap: 6px;'}">
                                <div style="font-size: ${textFontSize}; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; text-align: left; flex: 1 1 auto; line-height: ${textLineHeight};">${contentHTML}</div>
                            </div>
                        </div>
                        <div id="chat-reactions-${m.id}" class="chat-reactions-container" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;"></div>
                    </div>
                </div>
            </div>
        `);
    } else {
        const senderNameHtmlOther = (!shouldGroup) ? `<div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; display: flex; justify-content: flex-start; align-items: center; gap: 6px; user-select: none;">
            <span ${m.senderUsername ? `style="cursor: pointer; color: var(--text-primary);" onmouseenter="showMentionTooltip(event, '${escapeHtml(m.senderUsername)}')" onmouseleave="hideMentionTooltip()"` : ''}>${escapeHtml(m.senderName)}</span>
            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal;">${timeStr}</span>
        </div>` : '';
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-message-row" data-sender-id="${m.senderId}" data-created-at="${m.createdAt}" data-is-highlighted="${isHighlighted}" style="position: relative; background-color: ${rowBg}; border-top: ${rowBorderTop}; border-bottom: ${rowBorderBottom}; margin: ${rowMarginTop} -24px 0 -24px; padding: 2px 24px; transition: background-color 0.1s;" oncontextmenu="showDMCtxMenu(event, ${m.id}, false, ${m.isRead}, ${m.isPinned || false})">
                ${getActionBarHtml(false)}
                ${replyHtml ? `<div style="margin-left: 48px; margin-bottom: 4px;">${replyHtml}</div>` : ''}
                <div class="chat-bubble-wrapper" style="position: relative; display: flex; justify-content: flex-start; align-items: center; gap: 16px; width: 100%;">
                    <i id="chat-pin-icon-${m.id}" class="bi bi-pin-fill" style="position: absolute; left: -18px; top: 50%; transform: translateY(-50%); font-size: 0.7rem; color: var(--color-warning); display: ${m.isPinned ? 'inline-block' : 'none'}; z-index: 5;" title="Sabitlenmiş Mesaj"></i>
                    ${avatarHtml}
                    <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: 0; max-width: calc(100% - 88px);">
                        ${senderNameHtmlOther}
                        <div class="chat-message-bubble-inner" style="position: relative; background: transparent; padding: 0; border-radius: 0; border: none; display: flex; flex-direction: column; min-width: 70px; box-shadow: none;">
                            <span data-message-id="${m.id}" class="chat-message-time" data-created-at="${m.createdAt}" style="display: none;">${timeStr}</span>
                            <div style="display: flex; ${hasNonImageFile ? 'flex-direction: column; align-items: stretch; gap: 0;' : 'flex-wrap: wrap; align-items: flex-end; gap: 6px;'}">
                                <div style="font-size: ${textFontSize}; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; text-align: left; flex: 1 1 auto; line-height: ${textLineHeight};">${contentHTML}</div>
                            </div>
                        </div>
                        <div id="chat-reactions-${m.id}" class="chat-reactions-container" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;"></div>
                    </div>
                </div>
            </div>
        `);
    }
    
    if (window.renderReactions) {
        window.renderReactions(m.id, m.reactions || []);
    }
    
    // Store message in global dictionary for reply/forward lookups
    window.currentDMMessages = window.currentDMMessages || {};
    window.currentDMMessages[m.id] = m;
}

window.updateRailBadge = function() {
    if (!window.unreadChatCounts) return;
    let total = 0;
    Object.values(window.unreadChatCounts).forEach(c => total += c);
    
    const badge = document.getElementById('rail-chat-badge');
    if (badge) {
        if (total > 0) {
            badge.innerText = total > 9 ? '9+' : total;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
};

window.receiveChatMessage = function(message) {
    if (!window.unreadChatCounts) window.unreadChatCounts = {};
    
    const chatDashboard = document.getElementById('chat-dashboard-view');
    const isChatVisible = chatDashboard && chatDashboard.style.display !== 'none';
    
    if (message.chatSessionId === activeChatSessionId) {
        const myUserId = window.currentUserId ? window.currentUserId : 0;
        
        const messagesArea = document.getElementById('chat-main-messages');
        if (messagesArea && messagesArea.innerHTML.includes("Henüz mesaj yok.")) {
            messagesArea.innerHTML = '';
        }
        
        appendMessageToDOM(message, myUserId);
        
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
        
        // If chat is active and visible, mark as read
        if (isChatVisible) {
            if (typeof clearUnreadState === 'function') {
                clearUnreadState(activeChatSessionId);
            } else if (window.chatConnection && window.chatConnection.state === 'Connected') {
                window.chatConnection.invoke("MarkAsRead", activeChatSessionId).catch(console.error);
            }
        } else {
            window.unreadChatCounts[message.chatSessionId] = (window.unreadChatCounts[message.chatSessionId] || 0) + 1;
        }
    } else {
        // Increment unread count if it's not the active session
        window.unreadChatCounts[message.chatSessionId] = (window.unreadChatCounts[message.chatSessionId] || 0) + 1;
    }
    
    updateRailBadge();
    
    // Refresh sidebar list to update last message and sorting
    loadChatSessions();
};

window.handleMessagesRead = function(chatSessionId, userId, timestamp) {
    // If the read receipt is for the currently active chat, refetch messages to update ticks
    if (activeChatSessionId === chatSessionId) {
        // Debounce or just call openChatSession without resetting scroll if possible
        // For simplicity, we just fetch and update ticks in the DOM without full redraw
        fetch('/api/ChatApi/messages/' + chatSessionId)
            .then(res => res.json())
            .then(messages => {
                messages.forEach(m => {
                    if (m.isRead) {
                        const tickSpan = document.getElementById('chat-tick-' + m.id);
                        if (tickSpan) {
                            tickSpan.innerHTML = '<i class="bi bi-check-all" style="color: #60a5fa; font-size: 1rem; margin-left: 4px;" title="Okundu"></i>';
                        }
                    }
                });
            })
            .catch(console.error);
    }
};

window.handleUserAvatarUpdated = function(updatedUserId, newAvatarUrl) {
    if (typeof loadProjectMembersForMentions === 'function') {
        loadProjectMembersForMentions();
    }
    
    // If the sidebar is populated, update the list
    if (typeof loadChatSessions === 'function') {
        // Wait for the backend to possibly update its DB before fetching again, or we can just fetch now.
        loadChatSessions().then(() => {
            // After fetching new chat sessions, if we are in a chat with that user, update header and DOM
            if (activeChatSessionId) {
                const session = currentChatSessions.find(s => s.id === activeChatSessionId);
                if (session) {
                    const participant = session.participants.find(p => p.userId === updatedUserId);
                    if (participant || window.currentUserId === updatedUserId) {
                        // Re-render the chat messages without losing scroll or input by fetching messages again
                        // But to prevent wiping input:
                        const messagesArea = document.getElementById('chat-main-messages');
                        const scrollTop = messagesArea ? messagesArea.scrollTop : 0;
                        
                        // We can just call openChatSession but it would clear input? 
                        // No, openChatSession doesn't clear chat-main-input.
                        // Let's just update the header manually:
                        if (session.type === 1 && participant) { // DM
                            const safeUrl = getValidAvatarUrl(newAvatarUrl);
                            const avatarContainer = document.getElementById('chat-main-avatar');
                            if (avatarContainer) {
                                avatarContainer.innerHTML = `<img src="${safeUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
                            }
                        }
                        
                        // Let's re-fetch the messages and re-render them to update avatars in bubbles!
                        if (messagesArea) {
                            fetch('/api/ChatApi/messages/' + activeChatSessionId)
                                .then(res => res.json())
                                .then(messages => {
                                    messagesArea.innerHTML = '';
                                    const myUserId = window.currentUserId ? window.currentUserId : 0;
                                    messages.forEach(m => appendMessageToDOM(m, myUserId));
                                    // restore scroll position approximately
                                    messagesArea.scrollTop = scrollTop;
                                })
                                .catch(console.error);
                        }
                    }
                }
            }
        });
    }
};

window.clearUnreadState = function(sessionId) {
    if (!sessionId) return;
    
    if (activeChatSessionId === sessionId) {
        const dividers = document.querySelectorAll('#chat-main-messages .chat-unread-divider');
        dividers.forEach(d => d.remove());
    }
    
    if (window.unreadChatCounts && window.unreadChatCounts[sessionId]) {
        window.unreadChatCounts[sessionId] = 0;
        if (typeof updateRailBadge === 'function') updateRailBadge();
        const bndg = document.getElementById('unread-badge-' + sessionId);
        if (bndg) bndg.style.display = 'none';
        
        const timeEl = document.getElementById('chat-time-' + sessionId);
        if (timeEl) {
            timeEl.style.color = 'var(--text-muted)';
            timeEl.style.fontWeight = 'normal';
        }
        
        const lastMsgEl = document.getElementById('chat-lastmsg-' + sessionId);
        if (lastMsgEl) {
            lastMsgEl.style.color = 'var(--text-secondary)';
            lastMsgEl.style.fontWeight = 'normal';
        }
    }
    
    if (window.chatConnection && window.chatConnection.state === 'Connected') {
        window.chatConnection.invoke("MarkAsRead", sessionId).catch(console.error);
    }
};

window.sendMainChatMessage = async function() {
    const input = document.getElementById('chat-main-input');
    let content = input.value.trim();
    
    const hasAttachments = window.chatPendingAttachments && window.chatPendingAttachments.length > 0;
    
    if ((!content && !hasAttachments) || !activeChatSessionId) return;
    
    window.clearUnreadState(activeChatSessionId);
    
    input.value = ''; // Clear immediately for UX
    
    // Geçici çözüm: Backend'de ChatMessage için Attachments tablosu yok.
    // Dosyaları CommentApi/Upload ile yükleyip, linkleri mesaj içeriğine ekliyoruz.
    if (hasAttachments) {
        try {
            const formData = new FormData();
            window.chatPendingAttachments.forEach(f => formData.append('files', f));
            
            // UI'ı temizle
            window.chatPendingAttachments = [];
            if (window.renderChatAttachments) window.renderChatAttachments();
            
            const upRes = await fetch("/api/CommentApi/Upload", {
                method: "POST",
                body: formData
            });
            
            if (!upRes.ok) throw new Error("Dosya yüklenemedi");
            const uploadedFiles = await upRes.json();
            
            let links = uploadedFiles.map(f => `[${f.fileName}|${f.fileSize}](${f.fileUrl})`).join('\n');
            if (!content) {
                content = links;
            } else {
                content += "\n\n" + links;
            }
        } catch (err) {
            showToast("Dosyalar yüklenirken hata oluştu: " + err.message, "danger");
            return;
        }
    }
    
    if (window.dmEditingMessageId) {
        const editId = window.dmEditingMessageId;
        const msg = window.currentDMMessages[editId];
        window.cancelDMEdit();
        
        if (msg && msg.content === content) {
            input.focus();
            return;
        }
        
        try {
            const res = await fetch(`/api/ChatApi/messages/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content })
            });
            if (!res.ok) {
                const err = await res.text();
                showToast("Mesaj düzenlenemedi: " + err, "danger");
            }
        } catch (err) {
            showToast("Hata: " + err, "danger");
        }
        input.focus();
        return;
    }
    
    let replyToId = null;
    if (window.dmReplyToMessage) {
        replyToId = window.dmReplyToMessage.id;
        window.cancelDMReply();
    }
    
    try {
        if (window.chatConnection && window.chatConnection.state === signalR.HubConnectionState.Connected) {
            await window.chatConnection.invoke("SendMessage", activeChatSessionId, content, replyToId);
        } else {
            showToast("Bağlantı koptu. Lütfen sayfayı yenileyin.", "danger");
        }
    } catch (err) {
        showToast("Mesaj gönderilemedi: " + err, "danger");
    }
    
    input.focus();
};

window.handleNewDmSubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('new-dm-username').value.trim();
    if (!username) return;

    try {
        const res = await fetch('/api/ChatApi/sessions/dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(username)
        });
        
        if (!res.ok) {
            const err = await res.text();
            throw new Error(err || "Sohbet başlatılamadı.");
        }
        
        const newSession = await res.json();
        closeModal('new-dm-modal');
        document.getElementById('new-dm-username').value = '';
        
        // Yeniden yükle ve yeni sohbete geç
        await loadChatSessions();
        if (newSession && newSession.id) {
            openChatSession(newSession.id, username, "Kişisel");
        }
        
        showToast("Sohbet başarıyla başlatıldı.", "success");
    } catch (err) {
        showToast(err.message, "danger");
    }
};

window.startDMReply = function(messageId) {
    const msg = window.currentDMMessages[messageId];
    if (!msg) return;
    
    window.dmReplyToMessage = msg;
    
    const wrapper = document.getElementById('chat-dm-reply-preview-wrapper');
    const preview = document.getElementById('chat-dm-reply-preview');
    const author = document.getElementById('chat-dm-reply-author');
    const text = document.getElementById('chat-dm-reply-text');
    
    const myUserId = window.currentUserId ? window.currentUserId : 0;
    const authorName = (msg.senderId === myUserId) ? 'Siz' : (msg.senderName || 'Bilinmiyor');
    if (author) author.innerText = authorName;
    
    let previewText = escapeHtml(msg.content || '');
    if (previewText) {
        previewText = previewText.replace(/\[([^\]]+)\]\([^)]+\)/g, (match, p1) => {
            const isImage = p1.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
            const icon = isImage ? '<i class="bi bi-image"></i>' : '<i class="bi bi-paperclip"></i>';
            return `${icon} ${p1}`;
        }).replace(/\n/g, ' ');
    }
    if (!previewText && msg.attachments && msg.attachments.length > 0) {
        previewText = '<i class="bi bi-paperclip"></i> [Dosya/Resim Eki]';
    }
    if (text) text.innerHTML = previewText;
    
    if (wrapper && preview) {
        wrapper.style.gridTemplateRows = '1fr';
        wrapper.style.borderBottomColor = 'var(--border-color)';
        
        const headerLabel = document.getElementById('chat-dm-reply-header-label');
        if (headerLabel) headerLabel.innerText = 'Yanıtlanıyor:';
        
        const innerBox = document.getElementById('chat-dm-reply-inner-box');
        if (innerBox) innerBox.style.borderLeftColor = 'var(--color-primary)';
        
        const authorWrapper = document.getElementById('chat-dm-reply-author-wrapper');
        if (authorWrapper) authorWrapper.style.color = 'var(--color-primary)';
        
        preview.style.opacity = '1';
        preview.style.transform = 'translateY(0)';
    }
    
    const input = document.getElementById('chat-main-input');
    if (input) input.focus();
};

window.cancelDMReply = function() {
    if (window.dmEditingMessageId) {
        window.cancelDMEdit();
        return;
    }
    window.dmReplyToMessage = null;
    const wrapper = document.getElementById('chat-dm-reply-preview-wrapper');
    const preview = document.getElementById('chat-dm-reply-preview');
    if (wrapper && preview) {
        wrapper.style.gridTemplateRows = '0fr';
        wrapper.style.borderBottomColor = 'transparent';
        preview.style.opacity = '0';
        preview.style.transform = 'translateY(5px)';
    }
};

window.openDMForwardPanel = function(messageId) {
    const msg = window.currentDMMessages[messageId];
    if (!msg) return;
    
    window.dmForwardMessageId = messageId;
    
    let previewText = msg.content;
    if (!previewText && msg.attachments && msg.attachments.length > 0) {
        previewText = '[Dosya/Resim Eki]';
    }
    
    const fwPreview = document.getElementById('forward-message-preview');
    if (fwPreview) fwPreview.innerText = previewText;
    
    const fwPanel = document.getElementById('drawer-forward-panel');
    if (fwPanel) fwPanel.style.display = 'flex';
};

window.startDMEdit = function(messageId) {
    const msg = window.currentDMMessages[messageId];
    if (!msg) return;
    
    window.dmEditingMessageId = messageId;
    
    const wrapper = document.getElementById('chat-dm-reply-preview-wrapper');
    const preview = document.getElementById('chat-dm-reply-preview');
    const author = document.getElementById('chat-dm-reply-author');
    const text = document.getElementById('chat-dm-reply-text');
    
    if (author) author.innerText = 'Siz';
    if (text) text.innerText = msg.content;
    if (wrapper && preview) {
        wrapper.style.gridTemplateRows = '1fr';
        wrapper.style.borderBottomColor = 'var(--border-color)';
        
        const headerLabel = document.getElementById('chat-dm-reply-header-label');
        if (headerLabel) headerLabel.innerText = 'Mesaj Düzenleniyor:';
        
        const innerBox = document.getElementById('chat-dm-reply-inner-box');
        if (innerBox) innerBox.style.borderLeftColor = 'var(--color-warning, #f59e0b)';
        
        const authorWrapper = document.getElementById('chat-dm-reply-author-wrapper');
        if (authorWrapper) authorWrapper.style.color = 'var(--color-warning, #f59e0b)';
        
        preview.style.opacity = '1';
        preview.style.transform = 'translateY(0)';
    }
    
    const messagesArea = document.getElementById('chat-main-messages');
    if (messagesArea) {
        messagesArea.classList.add('chat-editing-active');
        const timeSpan = messagesArea.querySelector(`.chat-message-time[data-message-id="${messageId}"]`);
        if (timeSpan) {
            const row = timeSpan.closest('.chat-message-row');
            if (row) row.classList.add('chat-message-editing');
        }
    }
    
    const input = document.getElementById('chat-main-input');
    if (input) {
        input.value = msg.content;
        input.focus();
    }
};

window.cancelDMEdit = function() {
    window.dmEditingMessageId = null;
    const wrapper = document.getElementById('chat-dm-reply-preview-wrapper');
    const preview = document.getElementById('chat-dm-reply-preview');
    if (wrapper && preview) {
        wrapper.style.gridTemplateRows = '0fr';
        wrapper.style.borderBottomColor = 'transparent';
        preview.style.opacity = '0';
        preview.style.transform = 'translateY(5px)';
    }
    
    const messagesArea = document.getElementById('chat-main-messages');
    if (messagesArea) {
        messagesArea.classList.remove('chat-editing-active');
        const rows = messagesArea.querySelectorAll('.chat-message-editing');
        rows.forEach(r => r.classList.remove('chat-message-editing'));
    }
    
    const input = document.getElementById('chat-main-input');
    if (input) {
        input.value = '';
    }
};

window.deleteDMMessage = async function(messageId) {
    if (!confirm("Mesajı silmek istediğinize emin misiniz?")) return;
    try {
        const res = await fetch(`/api/ChatApi/messages/${messageId}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.text();
            showToast("Silinemedi: " + err, "danger");
        }
    } catch (err) {
        showToast("Hata: " + err, "danger");
    }
};


        
        
window.handleMessageEdited = function(message) {
    if (window.currentDMMessages) {
        window.currentDMMessages[message.id] = message;
    }
    
    // Refresh messages
    if (activeChatSessionId == message.chatSessionId) {
        const messagesArea = document.getElementById('chat-main-messages');
        if (messagesArea) {
            fetch('/api/ChatApi/messages/' + activeChatSessionId)
                .then(res => res.json())
                .then(messages => {
                    const scrollTop = messagesArea.scrollTop;
                    messagesArea.innerHTML = '';
                    const myUserId = window.currentUserId ? window.currentUserId : 0;
                    messages.forEach(m => appendMessageToDOM(m, myUserId));
                    messagesArea.scrollTop = scrollTop;
                })
                .catch(console.error);
        }
    }
};

window.handleMessageDeleted = function(messageId) {
    if (window.currentDMMessages) {
        delete window.currentDMMessages[messageId];
    }
    
    const messagesArea = document.getElementById('chat-main-messages');
    if (messagesArea) {
        const row = messagesArea.querySelector(`.chat-message-time[data-message-id="${messageId}"]`);
        if (row) {
            const messageRow = row.closest('.chat-message-row');
            if (messageRow) {
                messageRow.remove();
            }
        }
    }
};

window.handleMessagePinnedToggled = function(messageId, isPinned) {
    if (window.currentDMMessages && window.currentDMMessages[messageId]) {
        window.currentDMMessages[messageId].isPinned = isPinned;
    }
    
    const pinIcon = document.getElementById(`chat-pin-icon-${messageId}`);
    if (pinIcon) {
        pinIcon.style.display = isPinned ? 'inline-block' : 'none';
    }
    
    const actionPinBar = document.getElementById(`chat-action-pin-bar-${messageId}`);
    if (actionPinBar) {
        actionPinBar.className = isPinned ? 'bi bi-pin-fill' : 'bi bi-pin';
    }
    
    // Yandaki sidebar'da pinlenmiş oturumların sıralamasını güncellemek için
    if (typeof loadChatSessions === 'function') {
        loadChatSessions();
    }
};

window.renderReactions = function(messageId, reactions) {
    const container = document.getElementById(`chat-reactions-${messageId}`);
    if (!container) return;
    
    if (!reactions || reactions.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const myUserId = (typeof currentUserId !== 'undefined' && currentUserId) ? parseInt(currentUserId) : 0;
    
    let html = '';
    reactions.forEach(r => {
        const hasMyReaction = r.userIds && r.userIds.includes(myUserId);
        const bg = hasMyReaction ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface-elevated)';
        const border = hasMyReaction ? '1px solid var(--color-primary)' : '1px solid var(--border-color)';
        
        html += `
            <div class="chat-reaction-badge" data-emoji="${r.emoji}" onclick="window.toggleReaction(${messageId}, '${r.emoji}')" style="display: flex; align-items: center; gap: 4px; background: ${bg}; border: ${border}; border-radius: 6px; padding: 2px 6px; font-size: 0.85rem; cursor: pointer; user-select: none;">
                <span>${r.emoji}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${r.count}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
};

window.openEmojiPicker = function(messageId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
     const currentRow = document.querySelector(`.chat-message-time[data-message-id="${messageId}"]`)?.closest('.chat-message-row');
    if (currentRow) {
        currentRow.classList.add('force-hover');
    }
    
    const emojis = window.getRecentEmojis().slice(0, 6);
    let html = '<div class="chat-reaction-picker" id="chat-reaction-picker" data-message-id="' + messageId + '" style="position: fixed; z-index: 1050; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 4px; display: flex; gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">';
    emojis.forEach(e => {
        html += `<div onclick="window.toggleReaction(${messageId}, '${e}'); document.querySelectorAll('.chat-reaction-picker').forEach(el => el.remove()); const r = document.querySelector('.chat-message-row.force-hover'); if(r) r.classList.remove('force-hover');" style="cursor: pointer; padding: 4px; font-size: 1.25rem; border-radius: 4px; transition: background 0.1s;" onmouseover="this.style.background='var(--bg-surface-hover)'" onmouseout="this.style.background='transparent'">${e}</div>`;
    });
    // Add three dots for existing picker
    html += `<div class="chat-emoji-more" onclick="
        const rect = event.target.getBoundingClientRect();
        document.querySelectorAll('.chat-reaction-picker').forEach(el => el.remove());
        window.reactionTargetMessageId = ${messageId};
        const bigPicker = document.getElementById('chat-emoji-picker');
        if (bigPicker) {
            bigPicker.style.position = 'fixed';
            
            let bx = rect.right + 5;
            let by = rect.top - 100;
            
            const pWidth = bigPicker.offsetWidth || 320;
            const pHeight = bigPicker.offsetHeight || 350;
            
            if (bx + pWidth > window.innerWidth) bx = window.innerWidth - pWidth - 10;
            if (bx < 10) bx = 10;
            
            if (by + pHeight > window.innerHeight) by = window.innerHeight - pHeight - 10;
            if (by < 10) by = 10;
            
            bigPicker.style.left = bx + 'px';
            bigPicker.style.top = by + 'px';
            bigPicker.style.bottom = 'auto';
            bigPicker.style.right = 'auto';
            bigPicker.style.zIndex = '9999';
            window.toggleEmojiPicker(event);
        }
    " title="Diğer emojiler..." style="cursor: pointer; padding: 4px; font-size: 1.25rem; border-radius: 4px; transition: background 0.1s; color: var(--text-muted); display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='var(--bg-surface-hover)'; this.style.color='var(--text-primary)';" onmouseout="this.style.background='transparent'; this.style.color='var(--text-muted)';"><i class="bi bi-three-dots"></i></div>`;
    
    html += '</div>';
    
    document.body.insertAdjacentHTML('beforeend', html);
    const picker = document.body.lastElementChild;
    
    // Position picker
    const btn = event && event.target ? event.target.closest('button') || event.target.closest('.chat-ctx-btn') || event.target.closest('.chat-emoji-more') : null;
    let top = 0;
    let left = 0;
    
    if (btn) {
        const rect = btn.getBoundingClientRect();
        top = rect.top - 50;
        left = rect.left - 40;
    } else if (event && event.clientY) {
        top = event.clientY - 50;
        left = event.clientX - 40;
    } else {
        top = window.innerHeight / 2;
        left = window.innerWidth / 2;
    }
    
    // Get picker dimensions
    const pickerRect = picker.getBoundingClientRect();
    const pickerWidth = pickerRect.width || 250;
    const pickerHeight = pickerRect.height || 50;
    
    if (left + pickerWidth > window.innerWidth) {
        left = window.innerWidth - pickerWidth - 10;
    }
    if (left < 10) left = 10;
    
    if (top + pickerHeight > window.innerHeight) {
        top = window.innerHeight - pickerHeight - 10;
    }
    if (top < 10) top = 10;
    
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
    
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                if (currentRow && !window.reactionTargetMessageId) currentRow.classList.remove('force-hover');
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 10);
};

window.openFullEmojiPicker = function(messageId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    document.querySelectorAll('.chat-reaction-picker').forEach(el => el.remove());
    window.reactionTargetMessageId = messageId;
    
    const currentRow = document.querySelector(`.chat-message-time[data-message-id="${messageId}"]`)?.closest('.chat-message-row');
    if (currentRow) {
        currentRow.classList.add('force-hover');
    }
    
    const bigPicker = document.getElementById('chat-emoji-picker');
    if (bigPicker) {
        bigPicker.style.position = 'fixed';
        let bx = window.innerWidth / 2;
        let by = window.innerHeight / 2;
        
        if (event && event.target) {
            const btn = event.target.closest('button') || event.target.closest('.chat-ctx-btn') || event.target;
            const dmMenu = event.target.closest('#dm-context-menu');
            const rect = (dmMenu || btn).getBoundingClientRect();
            
            // Position to the left or right of the menu/button
            if (rect.right + 300 < window.innerWidth) {
                bx = rect.right + 5; // Right side
            } else {
                bx = rect.left - 305; // Left side
            }
            by = rect.top - 100; // Aligned somewhat
        }
        
        if (bx < 0) bx = 10;
        if (by < 0) by = 10;
        if (by + 400 > window.innerHeight) by = window.innerHeight - 400;
        bigPicker.style.left = bx + 'px';
        bigPicker.style.top = by + 'px';
        bigPicker.style.bottom = 'auto';
        bigPicker.style.right = 'auto';
        bigPicker.style.zIndex = '9999';
        if (typeof window.toggleEmojiPicker === 'function') {
            window.toggleEmojiPicker(event);
        }
    }
};

window.toggleReaction = function(messageId, emoji) {
    window.addRecentEmoji(emoji);
    fetch(`/api/ChatApi/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: emoji })
    }).catch(e => console.error(e));
};

window.handleMessageReactionToggled = function(messageId, userId, emoji, isAdded) {
    if (window.currentDMMessages && window.currentDMMessages[messageId]) {
        const m = window.currentDMMessages[messageId];
        m.reactions = m.reactions || [];
        
        let r = m.reactions.find(x => x.emoji === emoji);
        if (isAdded) {
            if (r) {
                if (!r.userIds.includes(userId)) {
                    r.userIds.push(userId);
                    r.count++;
                }
            } else {
                m.reactions.push({ emoji: emoji, count: 1, userIds: [userId] });
            }
        } else {
            if (r) {
                const idx = r.userIds.indexOf(userId);
                if (idx !== -1) {
                    r.userIds.splice(idx, 1);
                    r.count--;
                }
                if (r.count <= 0) {
                    m.reactions = m.reactions.filter(x => x.emoji !== emoji);
                }
            }
        }
        
        window.renderReactions(messageId, m.reactions);
    }
};

window.toggleChatAttachmentMenu = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const menu = document.getElementById('chat-attachment-menu');
    if (!menu) return;
    
    if (menu.style.display === 'none' || !menu.style.display) {
        menu.style.display = 'flex';
        // Trigger reflow for transition
        void menu.offsetWidth;
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
    } else {
        menu.style.opacity = '0';
        menu.style.transform = 'translateY(10px)';
        setTimeout(() => {
            menu.style.display = 'none';
        }, 200);
    }
};

// Close attachment menu if clicking outside
document.addEventListener('click', function(e) {
    const menu = document.getElementById('chat-attachment-menu');
    if (menu && menu.style.display === 'flex') {
        const btn = document.querySelector('button[title="Ekle"]');
        if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.style.opacity = '0';
            menu.style.transform = 'translateY(10px)';
            setTimeout(() => {
                menu.style.display = 'none';
            }, 200);
        }
    }
});

window.chatPendingAttachments = window.chatPendingAttachments || [];

window.handleChatAttachments = function(files) {
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
        window.chatPendingAttachments.push(files[i]);
    }
    
    // Clear inputs so same file can be selected again if removed
    const fileInput = document.getElementById("chat-file-input");
    const imgInput = document.getElementById("chat-image-input");
    if (fileInput) fileInput.value = "";
    if (imgInput) imgInput.value = "";
    
    if (window.renderChatAttachments) window.renderChatAttachments();
};

window.removeChatAttachment = function(index) {
    window.chatPendingAttachments.splice(index, 1);
    if (window.renderChatAttachments) window.renderChatAttachments();
};

window.renderChatAttachments = function() {
    const wrapper = document.getElementById("chat-attachments-preview-wrapper");
    const container = document.getElementById("chat-attachments-container");
    
    if (!wrapper || !container) return;
    
    if (window.chatPendingAttachments.length === 0) {
        wrapper.style.gridTemplateRows = "0fr";
        setTimeout(() => { container.innerHTML = ""; }, 300);
        return;
    }
    
    wrapper.style.gridTemplateRows = "1fr";
    
    let html = "";
    window.chatPendingAttachments.forEach((file, index) => {
        const isImage = file.type.startsWith("image/");
        const icon = isImage ? "bi-image" : "bi-file-earmark-text";
        html += `
            <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-surface); padding: 4px 10px; border-radius: 16px; border: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <i class="bi ${icon}" style="color: var(--color-primary); flex-shrink: 0;"></i>
                <span style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-grow: 1;">${typeof escapeHtml === 'function' ? escapeHtml(file.name) : file.name}</span>
                <button onclick="removeChatAttachment(${index})" style="background: transparent; border: none; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); flex-shrink: 0;">
                    <i class="bi bi-x-circle-fill" style="font-size: 0.9rem;"></i>
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
};

// Drag & Drop for Chat Attachments
document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('chat-main-area-wrapper');
    const dragOverlay = document.getElementById('chat-drag-overlay');
    
    if (dropArea && dragOverlay) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        let dragCounter = 0;

        dropArea.addEventListener('dragenter', (e) => {
            dragCounter++;
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                dragOverlay.style.display = 'flex';
            }
        }, false);

        dropArea.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter === 0) {
                dragOverlay.style.display = 'none';
            }
        }, false);

        dropArea.addEventListener('drop', (e) => {
            dragCounter = 0;
            dragOverlay.style.display = 'none';
            
            let dt = e.dataTransfer;
            let files = dt.files;
            
            if (files && files.length > 0) {
                if (window.handleChatAttachments) {
                    window.handleChatAttachments(files);
                }
            }
        }, false);
    }
});

window.toggleChatSearch = function() {
    const wrapper = document.getElementById('chat-search-wrapper');
    const input = document.getElementById('chat-search-input');
    
    if (wrapper.classList.contains('chat-search-active')) {
        if (input.value.trim() === '') {
            closeChatSearch();
        } else {
            window.performChatSearch(input.value);
        }
    } else {
        wrapper.classList.add('chat-search-active');
        wrapper.style.background = 'var(--bg-surface-elevated)';
        wrapper.style.borderColor = 'var(--border-color)';
        
        input.style.width = '180px';
        input.style.padding = '4px 0 4px 12px';
        input.style.opacity = '1';
        
        setTimeout(() => input.focus(), 100);
    }
};

window.closeChatSearch = function() {
    const wrapper = document.getElementById('chat-search-wrapper');
    const input = document.getElementById('chat-search-input');
    
    wrapper.classList.remove('chat-search-active');
    wrapper.style.background = 'transparent';
    wrapper.style.borderColor = 'transparent';
    
    input.style.width = '0';
    input.style.padding = '0';
    input.style.opacity = '0';
    input.value = '';
    input.blur();
    
    if (window.performChatSearch) {
        window.performChatSearch('');
    }
};

window.closeChatSearchIfEmpty = function() {
    const input = document.getElementById('chat-search-input');
    if (input && input.value.trim() === '') {
        closeChatSearch();
    }
};

window.performChatSearch = function(query) {
    const q = (query || '').toLowerCase().trim();
    const messagesArea = document.getElementById('chat-main-messages');
    if (!messagesArea) return;
    
    const rows = messagesArea.querySelectorAll('.chat-message-row');
    const extraElements = messagesArea.querySelectorAll('.chat-unread-divider, .chat-system-group');
    let hasMatches = false;
    
    let noResultsMsg = document.getElementById('chat-search-no-results');
    
    extraElements.forEach(el => {
        if (q === '') {
            if (el.classList.contains('chat-system-group')) {
                el.style.display = 'block';
            } else {
                el.style.display = 'flex';
            }
        } else {
            el.style.display = 'none';
        }
    });
    
    rows.forEach(row => {
        const bubble = row.querySelector('.chat-message-bubble-inner');
        if (!bubble) return;
        
        if (q === '') {
            row.style.display = '';
            row.style.opacity = '1';
            hasMatches = true;
            // Remove highlight class if we had one (for future)
            row.classList.remove('chat-search-match');
        } else {
            const text = bubble.innerText.toLowerCase();
            if (text.includes(q)) {
                row.style.display = '';
                row.style.opacity = '1';
                row.classList.add('chat-search-match');
                hasMatches = true;
            } else {
                row.style.display = 'none';
                row.classList.remove('chat-search-match');
            }
        }
    });
    
    // Clean up empty date dividers
    const dateDividers = messagesArea.querySelectorAll('.chat-date-divider');
    if (q === '') {
        dateDividers.forEach(el => el.style.display = 'flex');
    } else {
        dateDividers.forEach(divider => {
            let hasVisibleMessage = false;
            let nextEl = divider.nextElementSibling;
            while (nextEl) {
                if (nextEl.classList.contains('chat-date-divider')) {
                    break;
                }
                if (nextEl.classList.contains('chat-message-row') && nextEl.style.display !== 'none') {
                    hasVisibleMessage = true;
                    break;
                }
                nextEl = nextEl.nextElementSibling;
            }
            divider.style.display = hasVisibleMessage ? 'flex' : 'none';
        });
    }
    
    if (!hasMatches && q !== '') {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'chat-search-no-results';
            noResultsMsg.style.textAlign = 'center';
            noResultsMsg.style.color = 'var(--text-muted)';
            noResultsMsg.style.marginTop = '20px';
            noResultsMsg.style.fontSize = '0.9rem';
            messagesArea.appendChild(noResultsMsg);
        }
        noResultsMsg.innerText = '"' + query + '" ile eşleşen mesaj bulunamadı.';
        noResultsMsg.style.display = 'block';
    } else {
        if (noResultsMsg) {
            noResultsMsg.style.display = 'none';
        }
        if (q !== '') {
            const firstMatch = Array.from(rows).find(r => r.style.display !== 'none');
            if (firstMatch) {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }
};

// Bind Enter key to search input
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('chat-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.performChatSearch(this.value);
            }
        });
    }
});

// Pinned Messages Menu Logic
window.togglePinnedMessagesMenu = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const menu = document.getElementById('pinned-messages-menu');
    if (!menu) return;
    
    if (menu.style.display === 'none' || !menu.style.display) {
        menu.style.display = 'flex';
        window.refreshPinnedMessagesPanel();
    } else {
        menu.style.display = 'none';
    }
};

window.refreshPinnedMessagesPanel = function() {
    const list = document.getElementById('pinned-messages-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (!window.currentDMMessages) {
        list.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Mesajlar yüklenemedi.</div>';
        return;
    }
    
    // Convert object to array and filter pinned
    const pinnedMsgs = Object.values(window.currentDMMessages)
        .filter(m => m.isPinned && !m.isDeleted)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // latest first
        
    if (pinnedMsgs.length === 0) {
        list.innerHTML = `
            <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <i class="bi bi-pin" style="font-size: 2rem; opacity: 0.5;"></i>
                Bu sohbette sabitlenmiş mesaj yok.
            </div>
        `;
        return;
    }
    
    pinnedMsgs.forEach(m => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background-color 0.2s; display: flex; flex-direction: column; gap: 4px;';
        item.onmouseover = () => item.style.backgroundColor = 'var(--bg-surface-hover)';
        item.onmouseout = () => item.style.backgroundColor = 'transparent';
        
        // When clicked, scroll to the message in the chat
        item.onclick = () => {
            const row = document.querySelector(`.chat-message-time[data-message-id="${m.id}"]`);
            if (row) {
                const messageRow = row.closest('.chat-message-row');
                if (messageRow) {
                    messageRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Flash effect
                    const originalBg = messageRow.style.backgroundColor;
                    messageRow.style.backgroundColor = 'var(--color-primary-light)';
                    messageRow.style.transition = 'background-color 0.5s';
                    setTimeout(() => {
                        messageRow.style.backgroundColor = originalBg;
                    }, 1500);
                }
            }
            document.getElementById('pinned-messages-menu').style.display = 'none';
        };
        
        const senderName = m.senderName || 'Bilinmiyor';
        const dateObj = new Date(m.createdAt);
        const timeStr = dateObj.toLocaleDateString() + ' ' + dateObj.getHours().toString().padStart(2, '0') + ':' + dateObj.getMinutes().toString().padStart(2, '0');
        
        let rawContent = m.content || '';
        let textContent = rawContent;
        let attachmentsHtml = '';
        
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = linkRegex.exec(rawContent)) !== null) {
            let fileName = match[1];
            const url = match[2];
            
            let cleanFileName = fileName.trim();
            if (cleanFileName.includes('|')) cleanFileName = cleanFileName.split('|')[0];
            const cleanUrl = url.trim().split('?')[0];
            const isImage = cleanFileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || cleanUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
            
            let safeUrl = url;
            if (url.includes('.r2.dev') && !url.includes('avatar-proxy') && !url.includes('file-proxy')) {
                 safeUrl = '/api/UserApi/avatar-proxy?url=' + encodeURIComponent(url);
            }
            
            if (isImage) {
                attachmentsHtml += `<div style="margin-top: 6px; user-select: none;"><img src="${safeUrl}" style="max-height: 80px; max-width: 100%; border-radius: 6px; object-fit: contain; border: 1px solid var(--border-color); background: var(--bg-surface);" /></div>`;
            } else {
                const extMatch = cleanFileName.match(/\.([^.]+)$/);
                const fileIconData = window.getFileIconData ? window.getFileIconData(extMatch ? extMatch[1] : '') : { icon: 'bi-file-earmark', color: 'var(--text-muted)' };
                
                attachmentsHtml += `<div style="margin-top: 6px; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: 6px; user-select: none;">
                            <i class="bi ${fileIconData.icon}" style="font-size: 1.2rem; color: ${fileIconData.color};"></i>
                            <span style="font-size: 0.85rem; font-weight: 600; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);">${window.escapeHtml ? window.escapeHtml(cleanFileName) : cleanFileName}</span>
                        </div>`;
            }
        }
        
        textContent = textContent.replace(linkRegex, '').trim();
        if (textContent.length > 80) textContent = textContent.substring(0, 80) + '...';
        textContent = window.escapeHtml ? window.escapeHtml(textContent) : textContent;
        
        const finalPreviewHtml = (textContent ? `<div style="margin-bottom: 2px;">${textContent}</div>` : '') + attachmentsHtml;
        
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div style="flex: 1; min-width: 0; pointer-events: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; margin-bottom: 4px;">
                        <span style="font-weight: 600; color: var(--text-primary);">${window.escapeHtml ? window.escapeHtml(senderName) : senderName}</span>
                        <span style="color: var(--text-muted);">${timeStr}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-primary); word-break: break-word;">
                        ${finalPreviewHtml || '<span style="color: var(--text-muted); font-style: italic;">Boş mesaj</span>'}
                    </div>
                </div>
                <button class="chat-input-action-btn unpin-btn" title="Sabitlemeyi Kaldır" style="font-size: 1.4rem; padding: 0; width: 28px; height: 28px; color: var(--text-muted); flex-shrink: 0; line-height: 1; display: flex; align-items: center; justify-content: center;">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;
        
        const unpinBtn = item.querySelector('.unpin-btn');
        unpinBtn.onmouseover = (e) => { e.currentTarget.style.color = 'var(--color-danger)'; };
        unpinBtn.onmouseout = (e) => { e.currentTarget.style.color = 'var(--text-muted)'; };
        unpinBtn.onclick = (e) => {
            e.stopPropagation();
            fetch('/api/ChatApi/messages/' + m.id + '/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).then(r => r.json()).then(res => {
                if(window.handleMessagePinnedToggled) window.handleMessagePinnedToggled(m.id, res.isPinned);
            }).catch(err => console.error(err));
        };
        
        list.appendChild(item);
    });
};

// Close pinned menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('pinned-messages-menu');
    if (menu && menu.style.display === 'flex') {
        const btn = document.querySelector('button[title="Sabitlenmiş Mesajlar"]');
        if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.style.display = 'none';
        }
    }
});
// Emoji Picker Logic

window.getRecentEmojis = function() {
    try {
        let recents = JSON.parse(localStorage.getItem('meridian_recent_emojis'));
        if (Array.isArray(recents) && recents.length > 0) return recents;
    } catch(e) {}
    return ['👍', '❤️', '😂', '😮', '😢', '👏'];
};

window.addRecentEmoji = function(emoji) {
    let recents = window.getRecentEmojis();
    recents = recents.filter(e => e !== emoji);
    recents.unshift(emoji);
    if (recents.length > 20) recents = recents.slice(0, 20);
    localStorage.setItem('meridian_recent_emojis', JSON.stringify(recents));
};
const emojiCategories = [
  {
    category: "Yüzler & İnsanlar",
    emojis: [
      { char: "😀", name: "sırıtma mutlu gülümseme grin" },
      { char: "😂", name: "gözünden yaş gelmek gülmek laugh tears" },
      { char: "🤣", name: "krize girmek gülmek rofl" },
      { char: "🥲", name: "gözyaşı gülümseme tear smile" },
      { char: "😊", name: "mutlu tebessüm blush smile" },
      { char: "😇", name: "melek angel halo" },
      { char: "🥰", name: "aşık sevgi kalpli kalp in love" },
      { char: "😍", name: "kalp göz heart eyes" },
      { char: "😘", name: "öpücük kiss" },
      { char: "😋", name: "lezzetli dil yum" },
      { char: "😜", name: "dil çıkarma göz kırpma wink tongue" },
      { char: "🤪", name: "çılgın deli zany crazy" },
      { char: "🤨", name: "şüpheli kaş kalkık sus" },
      { char: "😎", name: "havalı gözlük cool glasses" },
      { char: "🤓", name: "inek nerd glasses" },
      { char: "🥳", name: "parti kutlama party" },
      { char: "😏", name: "sinsi smug" },
      { char: "😒", name: "bıkkın unamused" },
      { char: "😞", name: "üzgün sad" },
      { char: "😔", name: "düşünceli pensive" },
      { char: "🥺", name: "masum yalvaran pleading" },
      { char: "😢", name: "ağlamak cry" },
      { char: "😭", name: "hıçkırarak ağlamak sob" },
      { char: "😤", name: "sinirli öfkeli burnundan soluyan triumph" },
      { char: "😡", name: "kızgın öfkeli rage mad" },
      { char: "🤬", name: "küfür sansür curse" },
      { char: "🤯", name: "beyin patlaması şok mind blown" },
      { char: "😳", name: "kızarmış şaşkın flushed" },
      { char: "😱", name: "korkunç çığlık scream" },
      { char: "🥶", name: "soğuk üşümüş donmuş cold" },
      { char: "🥵", name: "sıcak terlemiş hot" },
      { char: "🤔", name: "düşünen thinking" },
      { char: "🤫", name: "şşşt sessiz shush" },
      { char: "🙄", name: "göz deviren roll eyes" },
      { char: "😬", name: "sırıtan dişler yansıma grimace" },
      { char: "😴", name: "uyuyan zzz sleep" },
      { char: "🥴", name: "sarhoş woozy" },
      { char: "🤢", name: "kusacak iğrenmiş nauseated" },
      { char: "🤮", name: "kusan puke vomit" },
      { char: "🤡", name: "palyaço clown" },
      { char: "💩", name: "kaka poop" },
      { char: "👻", name: "hayalet ghost" },
      { char: "👽", name: "uzaylı alien" }
    ]
  },
  {
    category: "El Hareketleri",
    emojis: [
      { char: "👋", name: "el sallama merhaba wave hello" },
      { char: "🤚", name: "el dur durak raised back of hand" },
      { char: "🖐", name: "beş parmak splayed hand" },
      { char: "✋", name: "dur el raised hand" },
      { char: "👌", name: "tamam ok perfect" },
      { char: "✌️", name: "barış zafer peace v" },
      { char: "🤞", name: "şans dilerim parmak çapraz crossed fingers" },
      { char: "🤟", name: "seni seviyorum love you" },
      { char: "🤘", name: "rock boynuz horns" },
      { char: "👈", name: "sol işaret parmağı point left" },
      { char: "👉", name: "sağ işaret parmağı point right" },
      { char: "👆", name: "yukarı işaret parmağı point up" },
      { char: "👇", name: "aşağı işaret parmağı point down" },
      { char: "👍", name: "beğen thumbs up" },
      { char: "👎", name: "beğenme thumbs down" },
      { char: "✊", name: "yumruk fist" },
      { char: "👊", name: "yumruk atma punch" },
      { char: "👏", name: "alkış clap" },
      { char: "🙌", name: "eller havaya kutlama raise hands" },
      { char: "🤲", name: "dua eden eller palms up" },
      { char: "🤝", name: "tokalaşma el sıkışma handshake" },
      { char: "🙏", name: "dua lütfen teşekkürler pray please thanks" },
      { char: "💪", name: "kas güçlü flex muscle" },
      { char: "🧠", name: "beyin akıl brain" },
      { char: "👀", name: "gözler bakmak eyes" }
    ]
  },
  {
    category: "Semboller",
    emojis: [
      { char: "❤️", name: "kırmızı kalp red heart love sevgi" },
      { char: "🧡", name: "turuncu kalp orange heart" },
      { char: "💛", name: "sarı kalp yellow heart" },
      { char: "💚", name: "yeşil kalp green heart" },
      { char: "💙", name: "mavi kalp blue heart" },
      { char: "💜", name: "mor kalp purple heart" },
      { char: "🖤", name: "siyah kalp black heart" },
      { char: "🤍", name: "beyaz kalp white heart" },
      { char: "💔", name: "kırık kalp broken heart" },
      { char: "✨", name: "yıldızlar parıltı sparkles" },
      { char: "🔥", name: "ateş yangın fire hot lit" },
      { char: "🎉", name: "parti konfeti party popper" },
      { char: "✅", name: "onay evet check mark yes" },
      { char: "❌", name: "çarpı hayır cross mark no" },
      { char: "❓", name: "soru işareti question" },
      { char: "❗️", name: "ünlem exclamation" },
      { char: "💯", name: "yüz puan 100 hundred perfect" }
    ]
  }
];

window.renderEmojiList = function(searchTerm = "") {
    const list = document.getElementById('chat-emoji-list');
    if (!list) return;
    
    const searchLower = searchTerm.toLowerCase().trim();
    let html = '';
    
    if (searchLower === "") {
        const recents = window.getRecentEmojis().slice(0, 20);
        if (recents.length > 0) {
            html += `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin: 8px 0 4px 4px;">Son Kullanılanlar</div>`;
            html += `<div style="display: flex; flex-wrap: wrap; gap: 4px;">`;
            recents.forEach(char => {
                let name = "";
                for (let cat of emojiCategories) {
                    const found = cat.emojis.find(e => e.char === char);
                    if (found) { name = found.name; break; }
                }
                const tooltip = name ? name.split(' ')[0] : "Emoji";
                
                html += `<div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; cursor: pointer; border-radius: 6px; transition: background-color 0.2s; user-select: none;" 
                              title="${tooltip}"
                              onmouseover="this.style.backgroundColor='var(--bg-surface-hover)'" 
                              onmouseout="this.style.backgroundColor='transparent'" 
                              onclick="insertEmoji('${char}')">${char}</div>`;
            });
            html += `</div>`;
        }
    }
    
    emojiCategories.forEach(cat => {
        const filtered = cat.emojis.filter(e => e.name.toLowerCase().includes(searchLower) || searchLower === "");
        
        if (filtered.length > 0) {
            html += `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin: 8px 0 4px 4px;">${cat.category}</div>`;
            html += `<div style="display: flex; flex-wrap: wrap; gap: 4px;">`;
            filtered.forEach(e => {
                html += `<div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; cursor: pointer; border-radius: 6px; transition: background-color 0.2s; user-select: none;" 
                              title="${e.name.split(' ')[0]}"
                              onmouseover="this.style.backgroundColor='var(--bg-surface-hover)'" 
                              onmouseout="this.style.backgroundColor='transparent'" 
                              onclick="insertEmoji('${e.char}')">${e.char}</div>`;
            });
            html += `</div>`;
        }
    });
    
    if (html === '') {
        html = `<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Sonuç bulunamadı</div>`;
    }
    
    list.innerHTML = html;
};

window.searchEmojis = function(term) {
    renderEmojiList(term);
};

window.toggleEmojiPicker = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const picker = document.getElementById('chat-emoji-picker');
    if (!picker) return;
    
    // Reset styling if it's NOT a reaction
    if (!window.reactionTargetMessageId) {
        picker.style.position = 'absolute';
        picker.style.left = 'auto';
        picker.style.top = 'auto';
        picker.style.bottom = 'calc(100% + 16px)';
        picker.style.right = '-16px';
        picker.style.zIndex = '100'; // original z-index
        picker.style.marginBottom = '0';
    } else {
        picker.style.marginBottom = '0';
    }
    
    if (picker.style.display === 'none' || !picker.style.display) {
        renderEmojiList("");
        const searchInput = document.getElementById('chat-emoji-search');
        if (searchInput) searchInput.value = "";
        picker.style.display = 'flex';
        if (searchInput) setTimeout(() => searchInput.focus(), 50);
    } else {
        picker.style.display = 'none';
        window.reactionTargetMessageId = null;
        const hoveredRow = document.querySelector('.chat-message-row.force-hover');
        if (hoveredRow) hoveredRow.classList.remove('force-hover');
    }
};

window.insertEmoji = function(emoji) {
    window.addRecentEmoji(emoji);
    
    if (window.reactionTargetMessageId) {
        window.toggleReaction(window.reactionTargetMessageId, emoji);
        window.reactionTargetMessageId = null;
        const picker = document.getElementById('chat-emoji-picker');
        if (picker) picker.style.display = 'none';
        
        // Close context menu if open
        const dmMenu = document.getElementById('dm-context-menu');
        if (dmMenu) dmMenu.style.display = 'none';
        
        // Remove hover state from message row if it exists
        const hoveredRow = document.querySelector('.chat-message-row.force-hover');
        if (hoveredRow) hoveredRow.classList.remove('force-hover');
        
        const msgArea = document.getElementById('chat-main-messages');
        if (msgArea) msgArea.classList.remove('ctx-open');
        
        return;
    }

    const input = document.getElementById('chat-main-input');
    if (!input) return;
    
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const val = input.value;
    
    input.value = val.substring(0, start) + emoji + val.substring(end);
    
    const newPos = start + emoji.length;
    input.setSelectionRange(newPos, newPos);
    
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

document.addEventListener('click', (e) => {
    const picker = document.getElementById('chat-emoji-picker');
    if (picker && picker.style.display === 'flex') {
        const btn = document.querySelector('button[title="Emoji"]');
        if (!picker.contains(e.target) && (!btn || !btn.contains(e.target))) {
            picker.style.display = 'none';
            window.reactionTargetMessageId = null;
            const hoveredRow = document.querySelector('.chat-message-row.force-hover');
            if (hoveredRow) hoveredRow.classList.remove('force-hover');
        }
    }
});

window.handleNewDmSubmit = async function(e) {
    e.preventDefault();
    const input = document.getElementById('new-dm-username').value;
    if (!input) return;
    
    try {
        const res = await fetch(`/api/ConnectionsApi/request/${encodeURIComponent(input)}`, {
            method: 'POST'
        });
        const data = await res.json();
        
        if (res.ok) {
            closeModal('new-dm-modal');
            document.getElementById('new-dm-username').value = '';
            showToast('Bağlantı isteği gönderildi!', 'success');
            
            // Switch to Connections tab if we are in chat dashboard, and load outgoing requests
            const connDash = document.getElementById('chat-connections-dashboard');
            if (connDash && connDash.style.display !== 'none') {
                if (typeof switchConnTab === 'function') {
                    switchConnTab('outgoing');
                }
            }
        } else {
            showToast(data.message || 'İstek gönderilemedi', 'danger');
        }
    } catch (err) {
        showToast('Bağlantı isteği gönderilirken hata oluştu', 'danger');
    }
};

window.updateConnectionsBadge = async function() {
    try {
        const res = await fetch('/api/ConnectionsApi/incoming');
        if (!res.ok) return;
        const data = await res.json();
        
        const count = data.length;
        const badgeText = count > 9 ? '9+' : count;
        
        const incomingBadge = document.getElementById('incoming-requests-badge');
        if (incomingBadge) {
            if (count > 0) {
                incomingBadge.style.display = 'flex';
                incomingBadge.innerText = badgeText;
            } else {
                incomingBadge.style.display = 'none';
            }
        }
        
        const sidebarBadge = document.getElementById('sidebar-connections-badge');
        if (sidebarBadge) {
            if (count > 0) {
                sidebarBadge.style.display = 'flex';
                sidebarBadge.innerText = badgeText;
            } else {
                sidebarBadge.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Failed to update connections badge', err);
    }
};

window.handleConnectionUpdated = function() {
    window.updateConnectionsBadge();
    
    // Refresh the current active connections tab if the dashboard is open
    const connDash = document.getElementById('chat-connections-dashboard');
    if (connDash && connDash.style.display !== 'none') {
        const activeBtn = document.querySelector('.conn-tab-btn.active');
        if (activeBtn) {
            let tabName = 'all';
            if (activeBtn.id === 'btn-conn-tab-incoming') tabName = 'incoming';
            else if (activeBtn.id === 'btn-conn-tab-outgoing') tabName = 'outgoing';
            loadConnections(tabName);
        }
    }
};

// Load chat sessions in the background on initial page load to update rail badges
const initChatSessions = () => {
    if (typeof loadChatSessions === 'function') {
        loadChatSessions();
    }
    if (typeof updateConnectionsBadge === 'function') {
        updateConnectionsBadge();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatSessions);
} else {
    initChatSessions();
}

window.filterConnections = function(query, tabName) {
    query = query.toLowerCase().trim();
    const rows = document.querySelectorAll('#conn-tab-' + tabName + ' .connection-row');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const searchData = row.getAttribute('data-search') || '';
        if (searchData.includes(query)) {
            row.style.display = 'flex';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    const countLabel = document.querySelector('#conn-tab-' + tabName + ' .conn-count-label');
    if (countLabel) {
        let suffix = tabName === 'all' ? 'bağlantı' : 'istek';
        countLabel.innerText = visibleCount + ' ' + suffix;
    }
    
    const noResultsEl = document.getElementById('conn-no-results-' + tabName);
    if (noResultsEl) {
        noResultsEl.style.display = visibleCount === 0 ? 'block' : 'none';
    }
};

window.openAddUserToChatModal = async function() {
    if (typeof activeChatSessionId === 'undefined' || !activeChatSessionId) return;
    
    let modal = document.getElementById('add-user-to-chat-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-user-to-chat-modal';
        modal.className = 'tm-modal-overlay';
        modal.innerHTML = `
            <div class="tm-modal" style="max-width: 450px;">
                <div class="tm-modal-header">
                    <h5 style="margin:0; font-weight: 600;">Sohbete Kişi Ekle</h5>
                    <button class="btn btn-icon btn-sm" onclick="closeModal('add-user-to-chat-modal')"><i class="bi bi-x"></i></button>
                </div>
                <div class="tm-modal-body" style="padding: 16px;">
                    <input type="text" class="form-control" placeholder="Bağlantılarda ara..." style="margin-bottom: 12px; width: 100%; box-sizing: border-box;" oninput="filterAddUserList(this.value)" />
                    <div id="add-user-list" style="max-height: 300px; overflow-y: auto;">
                        <div style="text-align: center; color: var(--text-muted); padding: 20px;">Yükleniyor...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    if (typeof openModal === 'function') {
        openModal('add-user-to-chat-modal');
    } else {
        modal.classList.add('active');
    }
    
    try {
        const res = await fetch('/api/ConnectionsApi/all');
        if (!res.ok) throw new Error();
        const connections = await res.json();
        
        const listDiv = document.getElementById('add-user-list');
        if (connections.length === 0) {
            listDiv.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Hiç bağlantınız yok.</div>';
            return;
        }
        
        let html = '';
        connections.forEach(c => {
            let u = c.otherUser || c.requester || c.receiver;
            let avatar = u.avatarUrl 
                ? `<img src="${getValidAvatarUrl(u.avatarUrl)}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" />` 
                : `<div style="width:32px; height:32px; border-radius:50%; background:var(--color-primary); color:white; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold;">${(u.name.charAt(0)+u.surname.charAt(0)).toUpperCase()}</div>`;
                
            html += `
                <div class="add-user-item" data-name="${(u.name + ' ' + u.surname + ' ' + u.username).toLowerCase()}" style="display:flex; align-items:center; justify-content:space-between; padding: 10px; border-radius: 6px; cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-surface-hover)'" onmouseout="this.style.background='transparent'" onclick="submitAddUserToChat(${u.id})">
                    <div style="display:flex; align-items:center; gap: 12px;">
                        ${avatar}
                        <div>
                            <div style="font-weight:600; font-size:0.9rem; color:var(--text-primary); line-height:1.2;">${u.name} ${u.surname}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary);">@${u.username}</div>
                        </div>
                    </div>
                    <i class="bi bi-person-plus" style="color:var(--color-primary);"></i>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
        
    } catch (e) {
        document.getElementById('add-user-list').innerHTML = '<div style="text-align: center; color: var(--color-danger); padding: 20px;">Bağlantılar yüklenemedi.</div>';
    }
};

window.filterAddUserList = function(q) {
    q = q.toLowerCase();
    const items = document.querySelectorAll('.add-user-item');
    items.forEach(item => {
        if (item.getAttribute('data-name').includes(q)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};

window.submitAddUserToChat = async function(userId) {
    if (typeof activeChatSessionId === 'undefined' || !activeChatSessionId) return;
    try {
        // Hata Düzeltildi: \` ve \$ işaretleri normal template literal'a (` ve $) çevrildi
        const res = await fetch(`/api/ChatApi/sessions/${activeChatSessionId}/add-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userId)
        });

        if (!res.ok) {
            let msg = 'Kişi eklenemedi.';
            try { const err = await res.json(); msg = err.error || err.message || msg; } catch(e){}
            throw new Error(msg);
        }

        const data = await res.json();
        if (typeof closeModal === 'function') {
            closeModal('add-user-to-chat-modal');
        } else {
            const mod = document.getElementById('add-user-to-chat-modal');
            if(mod) mod.classList.remove('active');
        }
        showToast('Kişi başarıyla eklendi.', 'success');

        await loadChatSessions();

        const session = currentChatSessions.find(s => s.id === data.sessionId);
        if (session) {
            let title = session.title;
            let subtitle = session.description || '';
            const myUserId = window.currentUserId ? window.currentUserId : 0;
            const otherUsers = session.participants.filter(p => p.userId !== myUserId);

            if (otherUsers.length > 1) {
                const allSortedUsers = [...session.participants].sort((a, b) => (a.rawName || a.username || '').localeCompare(b.rawName || b.username || ''));
                title = title || allSortedUsers.map(u => (u.rawName || u.name || u.username || '').split(' ')[0]).join(', ');
                subtitle = subtitle || `${session.participants.length} kişi`;
            } else if (otherUsers.length === 1) {
                const otherUser = otherUsers[0];
                const name = otherUser.rawName || otherUser.name || '';
                const surname = otherUser.rawSurname || '';
                title = title || (name + ' ' + surname).trim() || otherUser.username;

                // Hata Düzeltildi
                subtitle = subtitle || `@${otherUser.username}`;
            }
            openChatSession(data.sessionId, title, subtitle);
        } else {
            openChatSession(data.sessionId, 'Grup Sohbeti', '');
        }

    } catch (e) {
        showToast(e.message, 'error');
    }
};