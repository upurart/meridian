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

window.handleMentionInput = function(input) {
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

window.handleMentionKeyDown = function(e) {
    if (e.key === 'Enter') {
        if (isMentioning && filteredMembers.length > 0) {
            e.preventDefault();
            insertMention(selectedMentionIndex);
            return;
        }
        if (!isMentioning) {
            e.preventDefault();
            postDrawerComment();
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
    const dropdown = document.getElementById('mention-dropdown');
    if (!skipFilter && searchStr !== null) {
        filteredMembers = activeProjectMembers.filter(m => 
            m.user && (
                m.user.username.toLowerCase().includes(searchStr) || 
                m.user.name.toLowerCase().includes(searchStr) || 
                m.user.surname.toLowerCase().includes(searchStr)
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
        const initials = escapeHtml((m.user.name.charAt(0) + m.user.surname.charAt(0)).toUpperCase());
        return `
            <div style="padding: 8px 12px; display: flex; align-items: center; cursor: pointer; background: ${isActive ? 'var(--bg-surface)' : 'transparent'}; border-bottom: 1px solid var(--border-color);"
                 onmouseover="selectedMentionIndex = ${idx}; renderMentionDropdown(null, true);"
                 onmousedown="event.preventDefault(); insertMention(${idx})">
                <div style="width: 24px; height: 24px; border-radius: 50%; background-color: var(--bg-base); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; flex-shrink: 0; border: 1px solid var(--border-color); margin-right: 8px;">${initials}</div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">${escapeHtml(m.user.name)} ${escapeHtml(m.user.surname)}</span>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">@${escapeHtml(m.user.username)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    dropdown.style.display = 'block';
}

window.insertMention = function(index) {
    if (index < 0 || index >= filteredMembers.length) return;
    const member = filteredMembers[index];
    const input = document.getElementById('drawer-comment-input');
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
    document.getElementById('mention-dropdown').style.display = 'none';
    filteredMembers = [];
}

let mentionHoverTimeout = null;

window.showMentionTooltip = function(event, username) {
    clearTimeout(mentionHoverTimeout);
    
    const rect = event.target.getBoundingClientRect();
    
    mentionHoverTimeout = setTimeout(() => {
        const tooltip = document.getElementById('mention-hover-tooltip');
        if (!tooltip) return;
        
        const member = activeProjectMembers.find(m => m.user && m.user.username === username);
        if (!member) return;
        
        const initials = escapeHtml((member.user.name.charAt(0) + member.user.surname.charAt(0)).toUpperCase());
        
        tooltip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${initials}</div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); line-height: 1.2;">${escapeHtml(member.user.name)} ${escapeHtml(member.user.surname)}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">@${escapeHtml(member.user.username)}</span>
                </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                <i class="bi bi-envelope"></i>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(member.user.email)}</span>
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
}
