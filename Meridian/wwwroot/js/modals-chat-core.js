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
        .chat-bubble-wrapper:hover .chat-action-bar {
            opacity: 1;
            visibility: visible;
            transition: opacity 0.2s ease 0.2s, visibility 0.2s ease 0.2s;
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
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--text-secondary)';
        btn.style.fontWeight = '500';
    });
    
    const activeBtn = document.getElementById('btn-tab-' + tabName);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottomColor = 'var(--color-primary)';
        activeBtn.style.color = 'var(--text-primary)';
        activeBtn.style.fontWeight = '600';
    }
    
    loadChatSessions();
};

async function loadChatSessions() {
    const sidebarList = document.getElementById('chat-sidebar-list');
    if (!sidebarList) return;
    
    // Always update rail badge when sessions load
    if (typeof updateRailBadge === 'function') updateRailBadge();
    
    sidebarList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; margin-top: 20px;">Yükleniyor...</div>';
    
    try {
        const res = await fetch('/api/ChatApi/sessions');
        if (!res.ok) throw new Error("Oturumlar çekilemedi");
        
        currentChatSessions = await res.json();
        
        const typeFilter = window.currentChatTab === 'dm' ? 1 : 2; // 1: DM, 2: Group
        
        // Ensure unread tracking exists
        if (!window.unreadChatCounts) window.unreadChatCounts = {};

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
                const otherUser = s.participants.find(p => p.userId !== myUserId) || s.participants[0];
                if (otherUser) {
                    title = otherUser.name;
                    subtitle = `@${otherUser.username}`;
                    const name = otherUser.rawName || otherUser.name || '';
                    const surname = otherUser.rawSurname || '';
                    initials = escapeHtml((name.charAt(0) + surname.charAt(0)).toUpperCase() || 'U');
                    iconColor = 'var(--color-primary)';
                    
                    if (otherUser.avatarUrl) {
                        const safeUrl = getValidAvatarUrl(otherUser.avatarUrl);
                        avatarHtml = `<img src="${safeUrl}" alt="${escapeHtml(title)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
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
        sidebarList.innerHTML = '<div style="color: var(--color-danger); font-size: 0.85rem; text-align: center; margin-top: 20px;">Hata oluştu.</div>';
    }
}

window.toggleChatHeaderAccordion = function() {
    const accordion = document.getElementById('chat-header-accordion');
    const content = document.getElementById('chat-header-accordion-content');
    if (!accordion || !content) return;
    
    // Check if currently closed (0fr)
    if (accordion.style.gridTemplateRows === '0fr' || !accordion.style.gridTemplateRows) {
        accordion.style.gridTemplateRows = '1fr';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    } else {
        accordion.style.gridTemplateRows = '0fr';
        content.style.opacity = '0';
        content.style.transform = 'translateY(-5px)';
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
    
    // Safely get the clicked item
    let clickedItem = null;
    if (window.event && window.event.currentTarget) {
        clickedItem = window.event.currentTarget;
    } else if (window.event && window.event.target) {
        clickedItem = window.event.target.closest('.chat-list-item');
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
            const otherUser = session.participants.find(p => p.userId !== myUserId) || session.participants[0];
            if (otherUser) {
                const name = otherUser.rawName || otherUser.name || '';
                const surname = otherUser.rawSurname || '';
                initials = escapeHtml((name.charAt(0) + surname.charAt(0)).toUpperCase() || 'U');
                iconColor = 'var(--color-primary)';
                
                if (otherUser.avatarUrl) {
                    const safeUrl = getValidAvatarUrl(otherUser.avatarUrl);
                    avatarHtml = `<img src="${safeUrl}" alt="${escapeHtml(title)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
                }
            }
        } else {
            initials = '<i class="bi bi-people-fill"></i>';
        }
        
        if (!avatarHtml) {
            avatarHtml = `<div style="width: 36px; height: 36px; border-radius: 50%; background: ${iconColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem; flex-shrink: 0;">${initials}</div>`;
        }
        avatarContainer.innerHTML = avatarHtml;
    }
    
    // Show Input Area and Header
    document.getElementById('chat-main-input-area').style.display = 'block';
    document.getElementById('chat-main-header-wrapper').style.display = 'block';
    
    // Reset and hide accordion if it was open
    const accordion = document.getElementById('chat-header-accordion');
    const content = document.getElementById('chat-header-accordion-content');
    if (accordion && content) {
        accordion.style.gridTemplateRows = '0fr';
        content.style.opacity = '0';
        content.style.transform = 'translateY(-5px)';
    }
    
    // Populate accordion data
    if (session && session.type === 1) { // DM
        const otherUser = session.participants.find(p => p.userId !== window.currentUserId) || session.participants[0];
        if (otherUser) {
            document.getElementById('chat-header-info-email').innerText = otherUser.email || 'Belirtilmemiş';
            document.getElementById('chat-header-info-phone').innerText = otherUser.phoneNumber || '+90 555 000 0000';
        }
    } else {
        document.getElementById('chat-header-info-email').innerText = 'Grup Sohbeti';
        document.getElementById('chat-header-info-phone').innerText = '-';
    }
    
    const messagesArea = document.getElementById('chat-main-messages');
    messagesArea.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: auto; margin-bottom: auto;">Mesajlar yükleniyor...</div>';
    
    try {
        const res = await fetch('/api/ChatApi/messages/' + id);
        if (!res.ok) throw new Error();
        
        const messages = await res.json();
        
        if (messages.length === 0) {
            messagesArea.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: auto; margin-bottom: auto;">Henüz mesaj yok.</div>';
            return;
        }

        messagesArea.innerHTML = '';
        const myUserId = window.currentUserId ? window.currentUserId : 0;

        messages.forEach(m => {
            appendMessageToDOM(m, myUserId);
        });
        
        messagesArea.scrollTop = messagesArea.scrollHeight;
        
        // Notify others that we read the messages
        if (window.chatConnection && window.chatConnection.state === 'Connected') {
            window.chatConnection.invoke("MarkAsRead", id).catch(console.error);
        }

    } catch (e) {
        messagesArea.innerHTML = '<div style="text-align: center; color: var(--color-danger); margin-top: auto; margin-bottom: auto;">Mesajlar yüklenemedi.</div>';
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

function appendMessageToDOM(m, myUserId) {
    const messagesArea = document.getElementById('chat-main-messages');
    if (!messagesArea) return;

    if (m.isSystemMessage) {
        messagesArea.insertAdjacentHTML('beforeend', `
            <div style="text-align: center; margin: 12px 0;">
                <span style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.75rem; padding: 4px 12px; border-radius: 12px;">${escapeHtml(m.content)}</span>
            </div>
        `);
        return;
    }

    const timeStr = new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit' });
    const isMe = (m.senderId === myUserId);
    const initials = (m.senderName && m.senderName !== "Bilinmiyor") ? m.senderName.substring(0, 2).toUpperCase() : "??";
    
    const session = currentChatSessions.find(s => s.id === activeChatSessionId);
    const isGroup = session ? session.type === 2 : false;
    
    let shouldGroup = false;
    const lastRow = messagesArea.lastElementChild;
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
        avatarHtml = `<div style="width: 32px; height: 0; flex-shrink: 0;"></div>`;
    } else {
        if (m.avatarUrl) {
            const safeUrl = getValidAvatarUrl(m.avatarUrl);
            avatarHtml = `<img src="${safeUrl}" alt="${escapeHtml(m.senderName)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; cursor: pointer;" ${tooltipAttrs} />`;
        } else {
            avatarHtml = `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${isMe ? 'var(--color-primary)' : '#6366f1'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; flex-shrink: 0; cursor: pointer;" ${tooltipAttrs}>${initials}</div>`;
        }
    }
    
    let isTaggedMessage = false;
    let contentHTML = escapeHtml(m.content || '');
    let isOnlyImageMessage = false;
    let hasNonImageFile = false;
    
    // Parse markdown links: [text](url)
    contentHTML = contentHTML.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, fileName, url) => {
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
            let overlayHtml = '';
            if (isOnlyImageMessage) {
                const oTick = isMe ? (m.isRead ? '<i class="bi bi-check-all" style="color: #60a5fa; font-size: 1rem; margin-left: 4px;" title="Okundu"></i>' : '<i class="bi bi-check" style="color: rgba(255,255,255,0.7); font-size: 1rem; margin-left: 4px;" title="Gönderildi"></i>') : '';
                const oEdit = m.updatedAt ? `<span class="chat-edited-tag" onclick="showOriginalMessage(${m.id})" style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.7); cursor: pointer; text-decoration: none; margin-right: 4px;">düzenlendi</span>` : '';
                overlayHtml = `
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 8px 6px 8px; background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%); color: #fff; font-size: 0.65rem; display: flex; justify-content: flex-end; align-items: center; gap: 2px; z-index: 2; white-space: nowrap; pointer-events: none;">
                        <span data-message-id="${m.id}" class="chat-message-time" data-created-at="${m.createdAt}" style="color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${oEdit}${timeStr}</span>
                        <span id="chat-tick-${m.id}" style="line-height: 1; display: inline-flex; align-items: center; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${oTick}</span>
                    </div>
                `;
            }
            return `<div style="margin-top: 6px; margin-bottom: 4px; position: relative; display: inline-block; line-height: 0; font-size: 0; border-radius: 6px; overflow: hidden; border: 1px solid ${isMe ? 'rgba(255,255,255,0.2)' : 'var(--border-color)'}; max-width: 100%;"><img src="${safeUrl}" style="max-width: 100%; max-height: 220px; cursor: pointer; object-fit: contain; display: block; margin: 0; padding: 0;" onclick="openChatImageModal('${safeUrl}')" title="${escapeHtml(cleanFileName)}" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding:6px; border:1px solid var(--border-color); border-radius:6px; color:var(--text-muted); line-height: 1.4; font-size: 0.9rem;\\'><i class=\\'bi bi-image\\'></i> Yüklenemedi: '+escapeHtml('${cleanFileName}')+'</div>';" />${overlayHtml}</div>`;
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
            const iconColor = isMe ? '#fff' : fileIconData.color;
            
            return `<div style="margin-top: 6px; margin-bottom: 4px;"><a href="${safeFileUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px; background: ${isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-surface)'}; border: 1px solid ${isMe ? 'rgba(255,255,255,0.2)' : 'var(--border-color)'}; border-radius: 8px; color: ${isMe ? '#fff' : 'var(--text-primary)'}; text-decoration: none;">
                        <i class="bi ${iconClass}" style="font-size: 1.6rem; color: ${iconColor};"></i>
                        <div style="display: flex; flex-direction: column; justify-content: center;">
                            <span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; font-weight: 600; line-height: 1.2;">${escapeHtml(cleanFileName)}</span>
                            <span style="font-size: 0.7rem; color: ${isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'}; font-weight: 500; margin-top: 4px; line-height: 1;">${escapeHtml(subText)}</span>
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
    let rowMarginTop = shouldGroup ? '1px' : '8px';

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
                replyUser = (rMsg.senderId === myUserId) ? 'Siz' : (rMsg.senderName || 'Bilinmiyor');
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
        
        const quoteBg = isMe ? 'rgba(255,255,255,0.1)' : 'var(--bg-surface-hover)';
        const quoteBorder = isMe ? 'rgba(255,255,255,0.4)' : 'var(--color-primary)';
        const quoteTextColor = isMe ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)';
        const quoteTitleColor = isMe ? '#ffffff' : 'var(--color-primary)';
        
        replyHtml = `
            <div style="background-color: ${quoteBg}; border-left: 3px solid ${quoteBorder}; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                <div style="color: ${quoteTitleColor}; font-weight: 600; margin-bottom: 2px;">${escapeHtml(replyUser)}</div>
                <div style="color: ${quoteTextColor}; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; word-break: break-word;">${replyContent}</div>
            </div>
        `;
    }

    let tickHtml = '';
    if (isMe) {
        if (m.isRead) {
            tickHtml = '<i class="bi bi-check-all" style="color: #60a5fa; font-size: 1rem; margin-left: 4px;" title="Okundu"></i>';
        } else {
            tickHtml = '<i class="bi bi-check" style="color: rgba(255,255,255,0.7); font-size: 1rem; margin-left: 4px;" title="Gönderildi"></i>';
        }
    }

    const editedHtmlMe = m.updatedAt ? `<span class="chat-edited-tag" onclick="showOriginalMessage(${m.id})" style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.7); cursor: pointer; text-decoration: none; margin-right: 4px;" title="Orijinali görmek için tıklayın">düzenlendi</span>` : '';
    const editedHtmlOther = m.updatedAt ? `<span class="chat-edited-tag" onclick="showOriginalMessage(${m.id})" style="font-size: 0.65rem; color: var(--text-muted); cursor: pointer; text-decoration: none; margin-right: 4px;" title="Orijinali görmek için tıklayın">düzenlendi</span>` : '';

    const getActionBarHtml = (isSenderMe) => {
        let btnHtml = `
            <button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('reply', ${m.id})" title="Yanıtla"><i class="bi bi-reply"></i></button>
            <button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('forward', ${m.id})" title="İlet"><i class="bi bi-share"></i></button>
            <button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('pin', ${m.id})" title="Sabitle/Kaldır"><i id="chat-action-pin-bar-${m.id}" class="bi bi-pin-angle${m.isPinned ? '-fill' : ''}"></i></button>
        `;
        if (isSenderMe) {
            btnHtml += `<button class="chat-action-bar-btn" onclick="event.stopPropagation(); handleDMAction('edit', ${m.id})" title="Düzenle"><i class="bi bi-pencil"></i></button>`;
            if (m.isRead) {
                btnHtml += `<button class="chat-action-bar-btn" style="color: var(--text-muted); cursor: not-allowed;" title="Mesaj görüldüğü için silinemez" onclick="event.stopPropagation();"><i class="bi bi-trash"></i></button>`;
            } else {
                btnHtml += `<button class="chat-action-bar-btn" style="color: var(--color-danger);" onclick="event.stopPropagation(); handleDMAction('delete', ${m.id})" title="Sil"><i class="bi bi-trash"></i></button>`;
            }
        }
        return `<div class="chat-action-bar" style="align-self: center;">${btnHtml}</div>`;
    };

    if (isMe) {
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-message-row" data-sender-id="${m.senderId}" data-created-at="${m.createdAt}" data-is-highlighted="${isHighlighted}" style="background-color: ${rowBg}; border-top: ${rowBorderTop}; border-bottom: ${rowBorderBottom}; margin: ${rowMarginTop} -24px 0 -24px; padding: 2px 24px; transition: background-color 0.3s;" oncontextmenu="showDMCtxMenu(event, ${m.id}, true, ${m.isRead}, ${m.isPinned || false})">
                <div id="ghost-bubble-container-${m.id}" style="display: none; margin-bottom: 4px;"></div>
                <div class="chat-bubble-wrapper" style="display: flex; justify-content: flex-end; align-items: flex-start; gap: 8px; width: fit-content; margin-left: auto;">
                    ${getActionBarHtml(true)}
                    <div class="chat-message-bubble-inner" style="position: relative; background: var(--chat-message-bg); padding: 4px 8px 4px 10px; border-radius: 12px 0 12px 12px; max-width: 75%; box-shadow: 0 1px 2px rgba(0,0,0,0.15); display: flex; flex-direction: column; min-width: 70px;">
                        <i id="chat-pin-icon-${m.id}" class="bi bi-pin-angle-fill" style="position: absolute; top: -6px; right: -6px; font-size: 0.85rem; color: #fff; background: var(--color-warning); border-radius: 50%; padding: 2px 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); display: ${m.isPinned ? 'inline-block' : 'none'}; z-index: 5;" title="Sabitlenmiş Mesaj"></i>
                        ${replyHtml}
                        <div style="display: flex; ${hasNonImageFile ? 'flex-direction: column; align-items: stretch; gap: 0;' : 'flex-wrap: wrap; align-items: flex-end; gap: 6px;'}">
                            <div style="font-size: 0.9rem; color: #ffffff; white-space: pre-wrap; word-break: break-word; text-align: left; flex: 1 1 auto; line-height: 1.4;">${contentHTML}</div>
                            ${!isOnlyImageMessage ? `
                            <div style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.7); display: flex; align-items: center; gap: 2px; margin-left: auto; margin-bottom: -2px; white-space: nowrap;">
                                <span data-message-id="${m.id}" class="chat-message-time" data-created-at="${m.createdAt}">${editedHtmlMe}${timeStr}</span>
                                <span id="chat-tick-${m.id}" style="line-height: 1; display: inline-flex; align-items: center;">${tickHtml}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ${avatarHtml}
                </div>
            </div>
        `);
    } else {
        const senderNameHtml = (isGroup && !shouldGroup) ? `<div style="font-size: 0.75rem; font-weight: 600; color: #6366f1; margin-bottom: 2px; cursor: pointer;" ${m.senderUsername ? `onmouseenter="showMentionTooltip(event, '${escapeHtml(m.senderUsername)}')" onmouseleave="hideMentionTooltip()"` : ''}>${escapeHtml(m.senderName)}</div>` : '';
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-message-row" data-sender-id="${m.senderId}" data-created-at="${m.createdAt}" data-is-highlighted="${isHighlighted}" style="background-color: ${rowBg}; border-top: ${rowBorderTop}; border-bottom: ${rowBorderBottom}; margin: ${rowMarginTop} -24px 0 -24px; padding: 2px 24px; transition: background-color 0.3s;" oncontextmenu="showDMCtxMenu(event, ${m.id}, false, ${m.isRead}, ${m.isPinned || false})">
                <div id="ghost-bubble-container-${m.id}" style="display: none; margin-bottom: 4px;"></div>
                <div class="chat-bubble-wrapper" style="display: flex; justify-content: flex-start; align-items: flex-start; gap: 8px; width: fit-content;">
                    ${avatarHtml}
                    <div class="chat-message-bubble-inner" style="position: relative; background: var(--bg-surface-elevated); padding: 4px 10px 4px 10px; border-radius: ${shouldGroup ? '0 12px 12px 12px' : '0 12px 12px 12px'}; border: 1px solid var(--border-color); max-width: 75%; display: flex; flex-direction: column; min-width: 70px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <i id="chat-pin-icon-${m.id}" class="bi bi-pin-angle-fill" style="position: absolute; top: -6px; right: -6px; font-size: 0.85rem; color: #fff; background: var(--color-warning); border-radius: 50%; padding: 2px 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); display: ${m.isPinned ? 'inline-block' : 'none'}; z-index: 5;" title="Sabitlenmiş Mesaj"></i>
                        ${senderNameHtml}
                        ${replyHtml}
                        <div style="display: flex; ${hasNonImageFile ? 'flex-direction: column; align-items: stretch; gap: 0;' : 'flex-wrap: wrap; align-items: flex-end; gap: 6px;'}">
                            <div style="font-size: 0.9rem; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; text-align: left; flex: 1 1 auto; line-height: 1.4;">${contentHTML}</div>
                            ${!isOnlyImageMessage ? `
                            <div style="font-size: 0.65rem; color: var(--text-muted); display: flex; align-items: center; gap: 2px; margin-left: auto; margin-bottom: -2px; white-space: nowrap;">
                                <span data-message-id="${m.id}" class="chat-message-time" data-created-at="${m.createdAt}">${editedHtmlOther}${timeStr}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ${getActionBarHtml(false)}
                </div>
            </div>
        `);
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
            if (window.chatConnection && window.chatConnection.state === 'Connected') {
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
                                avatarContainer.innerHTML = `<img src="${safeUrl}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
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

window.sendMainChatMessage = async function() {
    const input = document.getElementById('chat-main-input');
    let content = input.value.trim();
    
    const hasAttachments = window.chatPendingAttachments && window.chatPendingAttachments.length > 0;
    
    if ((!content && !hasAttachments) || !activeChatSessionId) return;
    
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
        const ghostContainer = document.getElementById('ghost-bubble-container-' + messageId);
        if (ghostContainer) {
            const row = ghostContainer.closest('.chat-message-row');
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

window.showOriginalMessage = function(messageId) {
    const msg = window.currentDMMessages[messageId];
    if (!msg || !msg.originalContent) {
        showToast("Orijinal mesaj bulunamadı.", "warning");
        return;
    }
    
    const container = document.getElementById(`ghost-bubble-container-${messageId}`);
    if (container) {
        const messagesArea = document.getElementById('chat-main-messages');
        const bubble = container.nextElementSibling;
        let bubbleBeforeY = 0;
        if (bubble) bubbleBeforeY = bubble.getBoundingClientRect().top;
        
        if (container.style.display === 'block') {
            container.style.display = 'none';
        } else {
            const isMe = (msg.senderId === window.currentUserId);
            const align = isMe ? 'flex-end' : 'flex-start';
            const padding = isMe ? 'padding-right: 40px;' : 'padding-left: 40px;';
            const bg = 'rgba(150, 150, 150, 0.15)';
            const color = 'var(--text-muted)';
            const border = '1px dashed var(--border-color)';
            
            container.innerHTML = `
                <div style="display: flex; justify-content: ${align}; width: 100%; ${padding} box-sizing: border-box;">
                    <div style="background: ${bg}; border: ${border}; border-radius: 8px; padding: 4px 10px; max-width: 70%; font-size: 0.8rem; color: ${color}; position: relative; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="font-size: 0.65rem; margin-bottom: 2px; opacity: 0.8;"><i class="bi bi-clock-history"></i> Düzenlenmeden Önce:</div>
                        <div style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(msg.originalContent)}</div>
                    </div>
                </div>
            `;
            container.style.display = 'block';
        }
        
        if (bubble && messagesArea) {
            const bubbleAfterY = bubble.getBoundingClientRect().top;
            messagesArea.scrollTop += (bubbleAfterY - bubbleBeforeY);
        }
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
    
    const icon = document.getElementById(`chat-pin-icon-${messageId}`);
    if (icon) {
        icon.style.display = isPinned ? 'inline-block' : 'none';
    }
    
    const barIcon = document.getElementById(`chat-action-pin-bar-${messageId}`);
    if (barIcon) {
        if (isPinned) {
            barIcon.classList.remove('bi-pin-angle');
            barIcon.classList.add('bi-pin-angle-fill');
        } else {
            barIcon.classList.remove('bi-pin-angle-fill');
            barIcon.classList.add('bi-pin-angle');
        }
    }
    
    // Yalnızca pin menüsü açıksa onu da güncelle
    if (window.refreshPinnedMessagesPanel) {
        window.refreshPinnedMessagesPanel();
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
                showToast("Orijinal mesaj bulunamadı.", "warning");
                return;
            }
        })
    }
    const container = document.getElementById(`ghost-bubble-container-${messageId}`);
    if (container) {
        const messagesArea = document.getElementById('chat-main-messages');
        const bubble = container.nextElementSibling;
        let bubbleBeforeY = 0;
        if (bubble) bubbleBeforeY = bubble.getBoundingClientRect().top;
        
        if (container.style.display === 'block') {
            container.style.display = 'none';
        } else {
            const isMe = (msg.senderId === window.currentUserId);
            const align = isMe ? 'flex-end' : 'flex-start';
            const padding = isMe ? 'padding-right: 40px;' : 'padding-left: 40px;';
            const bg = 'rgba(150, 150, 150, 0.15)';
            const color = 'var(--text-muted)';
            const border = '1px dashed var(--border-color)';
            
            container.innerHTML = `
                <div style="display: flex; justify-content: ${align}; width: 100%; ${padding} box-sizing: border-box;">
                    <div style="background: ${bg}; border: ${border}; border-radius: 8px; padding: 4px 10px; max-width: 70%; font-size: 0.8rem; color: ${color}; position: relative; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="font-size: 0.65rem; margin-bottom: 2px; opacity: 0.8;"><i class="bi bi-clock-history"></i> Düzenlenmeden Önce:</div>
                        <div style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(msg.originalContent)}</div>
                    </div>
                </div>
            `;
            container.style.display = 'block';
        }
        
        if (bubble && messagesArea) {
            const bubbleAfterY = bubble.getBoundingClientRect().top;
            messagesArea.scrollTop += (bubbleAfterY - bubbleBeforeY);
        }
    }
});
        
        
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
    let hasMatches = false;
    
    let noResultsMsg = document.getElementById('chat-search-no-results');
    
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
        
        const senderName = m.senderName || (m.senderId === window.currentUserId ? 'Siz' : 'Bilinmiyor');
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
                attachmentsHtml += `<div style="margin-top: 6px;"><img src="${safeUrl}" style="max-height: 80px; max-width: 100%; border-radius: 6px; object-fit: contain; border: 1px solid var(--border-color); background: var(--bg-surface);" /></div>`;
            } else {
                const extMatch = cleanFileName.match(/\.([^.]+)$/);
                const fileIconData = window.getFileIconData ? window.getFileIconData(extMatch ? extMatch[1] : '') : { icon: 'bi-file-earmark', color: 'var(--text-muted)' };
                
                attachmentsHtml += `<div style="margin-top: 6px; display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
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
                        <span style="font-weight: 600; color: var(--color-primary);">${window.escapeHtml ? window.escapeHtml(senderName) : senderName}</span>
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
