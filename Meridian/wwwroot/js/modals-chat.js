// Inject CSS for chat editing mode
const chatEditStyle = document.createElement('style');
chatEditStyle.innerHTML = `
#chat-main-messages.chat-editing-active .chat-message-row {
    opacity: 0.3 !important;
    pointer-events: none;
    filter: blur(1px);
    transition: opacity 0.3s ease, filter 0.3s ease;
}
#chat-main-messages.chat-editing-active .chat-message-row.chat-message-editing {
    opacity: 1 !important;
    pointer-events: auto;
    filter: none;
    z-index: 10;
    position: relative;
}
#chat-main-messages.chat-editing-active .chat-message-row.chat-message-editing .chat-message-bubble-inner {
    box-shadow: 0 0 15px rgba(0,0,0,0.2) !important;
}
`;
document.head.appendChild(chatEditStyle);

async function loadProjectMembersForMentions() {
    if (!activeProjectId) return;
    try {
        const res = await fetch(`/api/ProjectMemberApi/${activeProjectId}`);
        if (res.ok) {
            activeProjectMembers = await res.json();
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadComments(entityType, entityId, quiet = false) {
    const list = document.getElementById('drawer-comments-list');
    if (!list) return;
    
    if (activeProjectMembers.length === 0) {
        await loadProjectMembersForMentions();
    }
    
    if (!quiet) {
        list.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Yorumlar yükleniyor...</div>';
    }

    try {
        const res = await fetch(`/api/CommentApi/${entityType}/${entityId}`);
        if (!res.ok) {
            const errText = await res.text();
            console.error("Yorumlar yüklenemedi, sunucu yanıtı:", res.status, errText);
            throw new Error(errText);
        }
        const comments = await res.json();
        window.currentLoadedComments = comments;
        renderComments(comments, list, entityType, entityId);
    } catch (err) {
        console.error("Fetch hatası:", err);
        list.innerHTML = '<div style="color: var(--color-danger); font-size: 0.85rem;">Yorumlar yüklenemedi.</div>';
    }
}

function renderComments(comments, container, entityType, entityId) {
    if (comments.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Henüz yorum yapılmamış. İlk yorumu siz yapın!</div>';
        return;
    }

    let lastDateString = null;
    let htmlParts = [];
    
    comments.forEach(c => {
        const dateObj = new Date(c.createdAt);
        const dateString = dateObj.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeString = dateObj.toLocaleString('tr-TR', { hour: '2-digit', minute:'2-digit' });
        
        if (dateString !== lastDateString) {
            htmlParts.push(`
                <div style="display: flex; align-items: center; justify-content: center; margin: 24px 0 16px 0;">
                    <div style="flex: 1; height: 1px; background-color: var(--border-color);"></div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); margin: 0 16px; font-weight: 500; letter-spacing: 0.5px;">${dateString}</span>
                    <div style="flex: 1; height: 1px; background-color: var(--border-color);"></div>
                </div>
            `);
            lastDateString = dateString;
        }

        const author = c.isCurrentUser ? 'Siz' : escapeHtml(c.user.name + " " + c.user.surname);
        const initials = escapeHtml((c.user.name.charAt(0) + c.user.surname.charAt(0)).toUpperCase());
        const isMe = c.isCurrentUser;
        const align = isMe ? 'flex-end' : 'flex-start';
        const bgColor = isMe ? 'var(--color-primary)' : 'var(--bg-surface-elevated)';
        const textColor = isMe ? '#ffffff' : 'var(--text-secondary)';
        const authorColor = isMe ? 'rgba(255, 255, 255, 0.95)' : 'var(--text-primary)';
        const dateColor = isMe ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-muted)';
        const borderRadius = isMe ? '12px 12px 0 12px' : '12px 12px 12px 0';
        const border = isMe ? 'none' : '1px solid var(--border-color)';
        
        const avatarBg = isMe ? 'var(--color-primary)' : 'var(--bg-surface-elevated)';
        const avatarColor = isMe ? '#ffffff' : 'var(--text-primary)';
        const avatarBorder = isMe ? 'none' : '1px solid var(--border-color)';
        const avatarShadow = isMe ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
        const avatarHtml = `<div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${avatarBg}; color: ${avatarColor}; border: ${avatarBorder}; box-shadow: ${avatarShadow}; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; flex-shrink: 0; line-height: 1;">${initials}</div>`;
        
        let leftAvatar = isMe ? '' : avatarHtml;
        let rightAvatar = isMe ? avatarHtml : '';
        
        const quoteBgColor = isMe ? 'rgba(255,255,255,0.15)' : 'rgba(128,128,128,0.15)';
        const quoteBorderColor = isMe ? 'rgba(255,255,255,0.4)' : 'var(--color-primary)';
        const quoteTitleColor = isMe ? 'rgba(255,255,255,0.95)' : 'var(--color-primary)';
        const quoteTextColor = isMe ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)';
        
        let isTaggedMessage = false;
        let contentHTML = escapeHtml(c.content);
        contentHTML = contentHTML.replace(/@([\w.]+)/g, (match, username) => {
            const member = activeProjectMembers.find(m => m.user && m.user.username.toLowerCase() === username.toLowerCase());
            if (member) {
                if (member.isCurrentUser) isTaggedMessage = true;
                const isMentionColor = c.isCurrentUser || member.isCurrentUser;
                const tagColor = isMentionColor ? 'var(--chat-tag)' : 'inherit';
                const bgClass = c.isCurrentUser ? 'chat-mention-tag-me' : 'chat-mention-tag-other';
                return `<span class="chat-mention-tag ${bgClass}" style="color: ${tagColor};" onmouseenter="showMentionTooltip(event, '${escapeHtml(member.user.username)}')" onmouseleave="hideMentionTooltip()">@${escapeHtml(member.user.name)} ${escapeHtml(member.user.surname)}</span>`;
            }
            return match;
        });

        const rowBg = isTaggedMessage ? 'var(--chat-tagged-bg, rgba(var(--color-primary-rgb, 0, 123, 255), 0.1))' : 'transparent';
        const rowBorder = isTaggedMessage ? '1px solid var(--chat-tagged-border, rgba(var(--color-primary-rgb, 0, 123, 255), 0.2))' : '1px solid transparent';
        const rowPadding = isTaggedMessage ? '12px 16px' : '0 16px';

        htmlParts.push(`
            <div style="background-color: ${rowBg}; border-top: ${rowBorder}; border-bottom: ${rowBorder}; margin: 0 -16px 12px -16px; padding: ${rowPadding}; transition: background-color 0.3s;" oncontextmenu="showChatContextMenu(event, ${c.id}, ${isMe ? 'true' : 'false'}, '${entityType}', ${entityId})">
                <div style="display: flex; justify-content: ${align}; align-items: flex-end; width: 100%; gap: 8px;">
                    ${leftAvatar}
                    <div style="background: ${bgColor}; padding: 10px 14px; border-radius: ${borderRadius}; border: ${border}; max-width: 80%; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; gap: 16px; align-items: center;">
                            <span style="font-weight: 600; font-size: 0.75rem; color: ${authorColor}; ${!isMe ? 'cursor: pointer;' : ''}" ${!isMe ? `onmouseenter="showMentionTooltip(event, '${escapeHtml(c.user.username)}')" onmouseleave="hideMentionTooltip()"` : ''}>${author}</span>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                ${c.isForwarded ? `<span style="font-size: 0.7rem; color: ${dateColor}; font-style: italic; margin-right: 8px;"><i class="bi bi-share"></i> İletildi</span>` : ''}
                                <span style="font-size: 0.7rem; color: ${dateColor};">${timeString}</span>
                            </div>
                        </div>
                        ${c.replyToId ? `
                        <div style="background: ${quoteBgColor}; border-left: 3px solid ${quoteBorderColor}; padding: 6px 10px; margin-bottom: 8px; border-radius: var(--radius-sm); font-size: 0.75rem; display: flex; gap: 8px;">
                            ${(c.replyToAttachments && c.replyToAttachments.some(a => a.fileType === 'image')) 
                                ? `<img src="${c.replyToAttachments.find(a => a.fileType === 'image').fileUrl}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1); cursor: pointer;" onclick="openChatImageModal('${c.replyToAttachments.find(a => a.fileType === 'image').fileUrl}')" />` 
                                : ''}
                            <div style="flex: 1; min-width: 0;">
                                <div style="color: ${quoteTitleColor}; font-weight: 600; margin-bottom: 2px;">${escapeHtml(c.replyToUser || '')}</div>
                                <div style="color: ${quoteTextColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 3em; white-space: pre-wrap;">${escapeHtml(c.replyToContent || ((c.replyToAttachments && c.replyToAttachments.length > 0) ? '[Dosya/Resim Eki]' : ''))}</div>
                            </div>
                        </div>` : ''}
                        ${(() => {
                        let attachmentsHTML = '';
                        if (c.attachments && c.attachments.length > 0) {
                            attachmentsHTML = '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
                            c.attachments.forEach(a => {
                                if (a.fileType === 'image') {
                                    attachmentsHTML += `<img src="${a.fileUrl}" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); cursor: pointer;" onclick="openChatImageModal('${a.fileUrl}')" title="${escapeHtml(a.fileName)}" />`;
                                } else {
                                    attachmentsHTML += `
                                        <a href="${a.fileUrl}" target="_blank" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: ${textColor}; text-decoration: none; font-size: 0.8rem;">
                                            <i class="bi bi-file-earmark-arrow-down" style="font-size: 1.1rem; color: ${dateColor};"></i>
                                            <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(a.fileName)}</span>
                                        </a>
                                    `;
                                }
                            });
                            attachmentsHTML += '</div>';
                        }

                        return `<div style="font-size: 0.85rem; color: ${textColor}; white-space: pre-wrap; word-break: break-word; line-height: 1.4;">${contentHTML}</div>${attachmentsHTML}`;
                    })()}
                    </div>
                    ${rightAvatar}
                </div>
            </div>
        `);
    });

    container.innerHTML = htmlParts.join('');
    container.scrollTop = container.scrollHeight;
}

window.openChatImageModal = function(url) {
    const img = document.getElementById('image-preview-modal-img');
    if (img) {
        img.src = url;
        openModal('image-preview-modal');
    }
}

window.closeChatImageModal = function() {
    closeModal('image-preview-modal');
}

window.postDrawerComment = async function() {
    if (!currentDrawerEntityId || !currentDrawerEntityType) return;
    
    const input = document.getElementById('drawer-comment-input');
    const content = input.value.trim();
    
    if (!content && chatPendingFiles.length === 0) return;

    let uploadedAttachments = [];

    try {
        if (chatPendingFiles.length > 0) {
            const formData = new FormData();
            chatPendingFiles.forEach(f => formData.append('files', f));
            
            const upRes = await fetch("/api/CommentApi/Upload", {
                method: "POST",
                body: formData
            });
            
            if (!upRes.ok) throw new Error("Dosya yüklenemedi");
            uploadedAttachments = await upRes.json();
        }

        let payload = {
            entityType: currentDrawerEntityType,
            entityId: currentDrawerEntityId,
            content: content,
            attachments: uploadedAttachments
        };

        if (window.chatReplyTo) {
            payload.replyToId = window.chatReplyTo.id;
        }

        const res = await fetch("/api/CommentApi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error();

        input.value = "";
        chatPendingFiles = [];
        renderChatFilePreview();
        if (window.cancelChatReply) window.cancelChatReply();
        
        // Drawer açık olduğu için
        loadComments(currentDrawerEntityType, currentDrawerEntityId, true);
    } catch (err) {
        showToast("Yorum gönderilemedi.", "danger");
    }
};

window.handleMentionInput = function(input, context = 'comment') {
    window.mentionContext = context;
    const val = input.value;
    const cursorPos = input.selectionStart;
    const lastAt = val.lastIndexOf('@', cursorPos - 1);
    
    if (lastAt !== -1) {
        const isStart = lastAt === 0 || /\s/.test(val[lastAt - 1]);
        if (isStart) {
            const searchStr = val.substring(lastAt + 1, cursorPos);
            if (!/\s/.test(searchStr)) {
                isMentioning = true;
                mentionSearchIndex = lastAt;
                renderMentionDropdown(searchStr.toLowerCase());
                return;
            }
        }
    }
    closeMentionDropdown();
};

window.handleMentionKeyDown = function(e, context = 'comment') {
    if (e.key === 'Enter' || e.key === 'Tab') {
        if (isMentioning && filteredMembers.length > 0) {
            e.preventDefault();
            insertMention(selectedMentionIndex);
            return;
        }
        if (e.key === 'Enter' && !isMentioning) {
            if (context === 'comment') {
                e.preventDefault();
                postDrawerComment();
            } else if (context === 'chat') {
                e.preventDefault();
                if (e.shiftKey) {
                    // allow new line if shift is held
                    return;
                }
                sendMainChatMessage();
            }
        }
    } else if (e.key === 'ArrowDown') {
        if (isMentioning && filteredMembers.length > 0) {
            e.preventDefault();
            selectedMentionIndex = (selectedMentionIndex + 1) % filteredMembers.length;
            renderMentionDropdown(null, true);
        }
    } else if (e.key === 'ArrowUp') { 
        if (isMentioning && filteredMembers.length > 0) {
            e.preventDefault();
            selectedMentionIndex = (selectedMentionIndex - 1 + filteredMembers.length) % filteredMembers.length;
            renderMentionDropdown(null, true);
        }
    } else if (e.key === 'Escape') {
        if (isMentioning) {
            e.preventDefault();
            closeMentionDropdown();
        }
    }
};

function renderMentionDropdown(searchStr = null, skipFilter = false) {
    const dropdownId = window.mentionContext === 'chat' ? 'chat-mention-dropdown' : 'mention-dropdown';
    const dropdown = document.getElementById(dropdownId);
    
    let availableMembers = [];
    if (window.mentionContext === 'chat') {
        const session = currentChatSessions.find(s => s.id === activeChatSessionId);
        if (session && session.participants) {
            availableMembers = session.participants.map(p => ({
                user: {
                    name: p.rawName || p.name || '',
                    surname: p.rawSurname || '',
                    username: p.username || '',
                    email: p.email || ''
                }
            }));
        }
    } else {
        availableMembers = activeProjectMembers || [];
    }

    if (!skipFilter && searchStr !== null) {
        filteredMembers = availableMembers.filter(m => 
            m.user && m.user.username && (
                m.user.username.toLowerCase().includes(searchStr) || 
                (m.user.name && m.user.name.toLowerCase().includes(searchStr)) || 
                (m.user.surname && m.user.surname.toLowerCase().includes(searchStr))
            )
        );
        selectedMentionIndex = 0;
    }

    if (filteredMembers.length === 0) {
        closeMentionDropdown();
        return;
    }

    dropdown.innerHTML = filteredMembers.map((m, idx) => {
        const isActive = idx === selectedMentionIndex;
        const initials = escapeHtml(( (m.user.name ? m.user.name.charAt(0) : '') + (m.user.surname ? m.user.surname.charAt(0) : '') ).toUpperCase() || 'U');
        return `
            <div style="padding: 8px 12px; display: flex; align-items: center; cursor: pointer; background: ${isActive ? 'var(--bg-surface)' : 'transparent'}; border-bottom: 1px solid var(--border-color);"
                 onmouseover="selectedMentionIndex = ${idx}; renderMentionDropdown(null, true);"
                 onmousedown="event.preventDefault(); insertMention(${idx})">
                <div style="width: 24px; height: 24px; border-radius: 50%; background-color: var(--bg-base); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; flex-shrink: 0; border: 1px solid var(--border-color); margin-right: 8px;">${initials}</div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">${escapeHtml(m.user.name || '')} ${escapeHtml(m.user.surname || '')}</span>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">@${escapeHtml(m.user.username || '')}</span>
                </div>
            </div>
        `;
    }).join('');
    
    dropdown.style.display = 'block';
}

window.insertMention = function(index) {
    if (index < 0 || index >= filteredMembers.length) return;
    const member = filteredMembers[index];
    const inputId = window.mentionContext === 'chat' ? 'chat-main-input' : 'drawer-comment-input';
    const input = document.getElementById(inputId);
    const val = input.value;
    const beforeMention = val.substring(0, mentionSearchIndex);
    const afterMention = val.substring(input.selectionStart);
    
    input.value = beforeMention + '@' + member.user.username + ' ' + afterMention;
    closeMentionDropdown();
    
    // Put cursor right after the inserted mention
    input.focus();
    const newCursorPos = mentionSearchIndex + member.user.username.length + 2;
    input.setSelectionRange(newCursorPos, newCursorPos);
};

function closeMentionDropdown() {
    isMentioning = false;
    const drop1 = document.getElementById('mention-dropdown');
    if (drop1) drop1.style.display = 'none';
    const drop2 = document.getElementById('chat-mention-dropdown');
    if (drop2) drop2.style.display = 'none';
    filteredMembers = [];
}

let mentionHoverTimeout = null;

window.showMentionTooltip = function(event, username) {
    clearTimeout(mentionHoverTimeout);
    
    const rect = event.target.getBoundingClientRect();
    
    mentionHoverTimeout = setTimeout(() => {
        const tooltip = document.getElementById('mention-hover-tooltip');
        if (!tooltip) return;
        
        let member = activeProjectMembers.find(m => m.user && m.user.username === username);
        if (!member) {
            // Check chat sessions if not in project
            for (let s of currentChatSessions) {
                if (s.participants) {
                    let p = s.participants.find(part => part.username === username);
                    if (p) {
                        member = { user: { name: p.rawName || p.name, surname: p.rawSurname || '', username: p.username, email: p.email, avatarUrl: p.avatarUrl } };
                        break;
                    }
                }
            }
        }
        
        if (!member) return;
        
        const initials = escapeHtml(( (member.user.name ? member.user.name.charAt(0) : '') + (member.user.surname ? member.user.surname.charAt(0) : '') ).toUpperCase() || 'U');
        
        let tooltipAvatarHtml = `<div style="width: 40px; height: 40px; border-radius: 50%; background-color: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${initials}</div>`;
        if (member.user.avatarUrl) {
            const safeUrl = typeof getValidAvatarUrl === 'function' ? getValidAvatarUrl(member.user.avatarUrl) : member.user.avatarUrl;
            tooltipAvatarHtml = `<img src="${safeUrl}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.2);" />`;
        }
        
        tooltip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                ${tooltipAvatarHtml}
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); line-height: 1.2;">${escapeHtml(member.user.name || '')} ${escapeHtml(member.user.surname || '')}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">@${escapeHtml(member.user.username || '')}</span>
                </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                <i class="bi bi-envelope"></i>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(member.user.email || '')}</span>
            </div>
        `;
        
        let top = rect.top - 8;
        let left = rect.left + (rect.width / 2);
        
        tooltip.style.transform = "translate(-50%, -100%)";
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        tooltip.style.display = 'block';
        
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
        });
    }, 500);
};

window.hideMentionTooltip = function() {
    clearTimeout(mentionHoverTimeout);
    const tooltip = document.getElementById('mention-hover-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.display = 'none';
    }
};

window.handleTaskCommentKeyPress = function(e, entityId) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        postTaskComment(entityId);
    }
};

window.deleteComment = async function(commentId, entityType, entityId) {
    if (!confirm("Yorumu silmek istediğinize emin misiniz?")) return;

    try {
        const res = await fetch(`/api/CommentApi/${commentId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        
        // Drawer açık olduğu için
        loadComments(entityType, entityId, true);
    } catch (err) {
        alert("Yorum silinemedi.");
    }
};

// --- CHAT DASHBOARD LOGIC ---
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
                <div class="chat-list-item ${activeChatSessionId === s.id ? 'active-chat' : ''}" onclick="openChatSession(${s.id}, '${escapeHtml(title)}', '${s.type === 1 ? 'Kişisel' : 'Grup'}')" oncontextmenu="showChatSessionCtxMenu(event, ${s.id}, ${s.type}, '${escapeHtml(rightClickOtherUser)}')" style="padding: 12px 20px; border-radius: 0; margin: 0 -8px; cursor: pointer; display: flex; gap: 12px; align-items: center; transition: background 0.2s; background-color: ${activeChatSessionId === s.id ? 'rgba(255, 255, 255, 0.12)' : 'transparent'}; position: relative;">
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
                            <div id="chat-lastmsg-${s.id}" style="font-size: 0.8rem; color: ${unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight: ${unreadCount > 0 ? '600' : 'normal'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${escapeHtml(lastMsg)}</div>
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
    document.getElementById('chat-main-subtitle').innerText = subtitle;
    
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
                    avatarHtml = `<img src="${safeUrl}" alt="${escapeHtml(title)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
                }
            }
        } else {
            initials = '<i class="bi bi-people-fill"></i>';
        }
        
        if (!avatarHtml) {
            avatarHtml = `<div style="width: 40px; height: 40px; border-radius: 50%; background: ${iconColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">${initials}</div>`;
        }
        avatarContainer.innerHTML = avatarHtml;
    }
    
    // Show Input Area
    document.getElementById('chat-main-input-area').style.display = 'block';
    
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

    const rowBg = isTaggedMessage && !isMe ? 'var(--chat-tagged-bg, rgba(13, 110, 253, 0.1))' : 'transparent';
    const rowBorder = isTaggedMessage && !isMe ? '1px solid var(--chat-tagged-border, rgba(13, 110, 253, 0.2))' : '1px solid transparent';

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
        
        const quoteBg = isMe ? 'rgba(255,255,255,0.1)' : 'var(--bg-surface-hover)';
        const quoteBorder = isMe ? 'rgba(255,255,255,0.4)' : 'var(--color-primary)';
        const quoteTextColor = isMe ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)';
        const quoteTitleColor = isMe ? '#ffffff' : 'var(--color-primary)';
        
        replyHtml = `
            <div style="background-color: ${quoteBg}; border-left: 3px solid ${quoteBorder}; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                <div style="color: ${quoteTitleColor}; font-weight: 600; margin-bottom: 2px;">${escapeHtml(replyUser)}</div>
                <div style="color: ${quoteTextColor}; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; word-break: break-word;">${escapeHtml(replyContent)}</div>
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

    const rowMarginTop = shouldGroup ? '1px' : '8px';
    const borderRadius = isMe 
        ? (shouldGroup ? '12px 0 12px 12px' : '12px 12px 0 12px') 
        : (shouldGroup ? '0 12px 12px 12px' : '12px 12px 12px 0'); // Simple tail logic

    const editedHtmlMe = m.updatedAt ? `<span class="chat-edited-tag" onclick="showOriginalMessage(${m.id})" style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.7); cursor: pointer; text-decoration: underline; margin-right: 4px;" title="Orijinali görmek için tıklayın">düzenlendi</span>` : '';
    const editedHtmlOther = m.updatedAt ? `<span class="chat-edited-tag" onclick="showOriginalMessage(${m.id})" style="font-size: 0.65rem; color: var(--text-muted); cursor: pointer; text-decoration: underline; margin-right: 4px;" title="Orijinali görmek için tıklayın">düzenlendi</span>` : '';

    if (isMe) {
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-message-row" data-sender-id="${m.senderId}" data-created-at="${m.createdAt}" style="background-color: ${rowBg}; border-top: ${rowBorder}; border-bottom: ${rowBorder}; margin: ${rowMarginTop} -24px 0 -24px; padding: 2px 24px; transition: background-color 0.3s;" oncontextmenu="showDMCtxMenu(event, ${m.id}, true, ${m.isRead})">
                <div id="ghost-bubble-container-${m.id}" style="display: none; margin-bottom: 4px;"></div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <div class="chat-message-bubble-inner" style="background: var(--chat-message-bg); padding: 4px 8px 4px 10px; border-radius: 12px 0 12px 12px; max-width: 75%; box-shadow: 0 1px 2px rgba(0,0,0,0.15); display: flex; flex-direction: column; min-width: 70px;">
                        ${replyHtml}
                        <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px;">
                            <div style="font-size: 0.9rem; color: #ffffff; white-space: pre-wrap; word-break: break-word; text-align: left; flex: 1 1 auto; line-height: 1.4;">${contentHTML}</div>
                            <div style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.7); display: flex; align-items: center; gap: 2px; margin-left: auto; margin-bottom: -2px; white-space: nowrap;">
                                <span data-message-id="${m.id}" class="chat-message-time" data-created-at="${m.createdAt}">${editedHtmlMe}${timeStr}</span>
                                <span id="chat-tick-${m.id}" style="line-height: 1; display: inline-flex; align-items: center;">${tickHtml}</span>
                            </div>
                        </div>
                    </div>
                    ${avatarHtml}
                </div>
            </div>
        `);
    } else {
        const senderNameHtml = (isGroup && !shouldGroup) ? `<div style="font-size: 0.75rem; font-weight: 600; color: #6366f1; margin-bottom: 2px; cursor: pointer;" ${m.senderUsername ? `onmouseenter="showMentionTooltip(event, '${escapeHtml(m.senderUsername)}')" onmouseleave="hideMentionTooltip()"` : ''}>${escapeHtml(m.senderName)}</div>` : '';
        messagesArea.insertAdjacentHTML('beforeend', `
            <div class="chat-message-row" data-sender-id="${m.senderId}" data-created-at="${m.createdAt}" style="background-color: ${rowBg}; border-top: ${rowBorder}; border-bottom: ${rowBorder}; margin: ${rowMarginTop} -24px 0 -24px; padding: 2px 24px; transition: background-color 0.3s;" oncontextmenu="showDMCtxMenu(event, ${m.id}, false, ${m.isRead})">
                <div id="ghost-bubble-container-${m.id}" style="display: none; margin-bottom: 4px;"></div>
                <div style="display: flex; justify-content: flex-start; gap: 8px;">
                    ${avatarHtml}
                    <div class="chat-message-bubble-inner" style="background: var(--bg-surface-elevated); padding: 4px 10px 4px 10px; border-radius: ${shouldGroup ? '0 12px 12px 12px' : '0 12px 12px 12px'}; border: 1px solid var(--border-color); max-width: 75%; display: flex; flex-direction: column; min-width: 70px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        ${senderNameHtml}
                        ${replyHtml}
                        <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px;">
                            <div style="font-size: 0.9rem; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; text-align: left; flex: 1 1 auto; line-height: 1.4;">${contentHTML}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); display: flex; align-items: center; margin-left: auto; margin-bottom: -2px; white-space: nowrap;">
                                <span data-message-id="${m.id}" class="chat-message-time" data-created-at="${m.createdAt}">${editedHtmlOther}${timeStr}</span>
                            </div>
                        </div>
                    </div>
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
                                avatarContainer.innerHTML = `<img src="${safeUrl}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
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
    const content = input.value.trim();
    if (!content || !activeChatSessionId) return;
    
    input.value = ''; // Clear immediately for UX
    
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
    
    const preview = document.getElementById('chat-dm-reply-preview');
    const author = document.getElementById('chat-dm-reply-author');
    const text = document.getElementById('chat-dm-reply-text');
    
    const myUserId = window.currentUserId ? window.currentUserId : 0;
    const authorName = (msg.senderId === myUserId) ? 'Siz' : (msg.senderName || 'Bilinmiyor');
    if (author) author.innerText = authorName;
    
    let previewText = msg.content;
    if (!previewText && msg.attachments && msg.attachments.length > 0) {
        previewText = '[Dosya/Resim Eki]';
    }
    if (text) text.innerText = previewText;
    if (preview) preview.style.display = 'block';
    
    const input = document.getElementById('chat-main-input');
    if (input) input.focus();
};

window.cancelDMReply = function() {
    if (window.dmEditingMessageId) {
        window.cancelDMEdit();
        return;
    }
    window.dmReplyToMessage = null;
    const preview = document.getElementById('chat-dm-reply-preview');
    if (preview) preview.style.display = 'none';
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
    
    // We can reuse the reply UI structure for showing what is being edited
    const preview = document.getElementById('chat-dm-reply-preview');
    const author = document.getElementById('chat-dm-reply-author');
    const text = document.getElementById('chat-dm-reply-text');
    
    if (author) author.innerText = 'Mesaj Düzenleniyor';
    if (text) text.innerText = msg.content;
    if (preview) {
        preview.style.display = 'block';
        preview.style.borderLeftColor = 'var(--color-warning, #f59e0b)';
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
    const preview = document.getElementById('chat-dm-reply-preview');
    if (preview) {
        preview.style.display = 'none';
        preview.style.borderLeftColor = 'var(--color-primary)';
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
                    <div style="background: ${bg}; border: ${border}; border-radius: 8px; padding: 4px 10px; max-width: 70%; font-size: 0.8rem; color: ${color}; position: relative;">
                        <div style="font-size: 0.65rem; margin-bottom: 2px; opacity: 0.8;"><i class="bi bi-clock-history"></i> Düzenlenmeden Önce:</div>
                        <div style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(msg.originalContent)}</div>
                    </div>
                </div>
            `;
            container.style.display = 'block';
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

