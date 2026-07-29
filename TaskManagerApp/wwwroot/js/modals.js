    function openProjectModal(project = null) {
        const form = document.getElementById("project-form");
        form.reset();

        const structSection = document.getElementById("project-initial-structure-section");
        if (project) {
            document.getElementById("project-modal-title").innerText = "Proje Düzenle";
            document.getElementById("project-modal-id").value = project.id;
            document.getElementById("project-title").value = project.title;
            document.getElementById("project-desc").value = project.description;
            document.getElementById("project-deadline").value = project.deadline ? project.deadline.substring(0, 10) : "";
            if (structSection) structSection.style.display = "none";
        } else {
            document.getElementById("project-modal-title").innerText = "Yeni Proje Ekle";
            document.getElementById("project-modal-id").value = "";
            document.getElementById("project-deadline").value = "";
            if (structSection) structSection.style.display = "block";
            const panel = document.getElementById("initial-structure-panel");
            if (panel) panel.style.display = "none";
            const caret = document.getElementById("initial-structure-caret");
            if (caret) caret.innerHTML = '<i class="bi bi-caret-down-fill"></i>';
            const initMg = document.getElementById("init-mg-count"); if (initMg) initMg.value = "0";
            const initSg = document.getElementById("init-sg-count"); if (initSg) initSg.value = "0";
            const initTask = document.getElementById("init-task-count"); if (initTask) initTask.value = "0";
            const slotsContainer = document.getElementById("dynamic-slots-container"); if (slotsContainer) slotsContainer.innerHTML = "";
        }
        openModal("project-modal");
    }

    async function handleProjectSubmit(e) {
        e.preventDefault();

        // BUTONU KİLİTLE (Çift Tıklamayı Engelle)
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Kaydediliyor...";

        const id = document.getElementById("project-modal-id").value;
        const title = document.getElementById("project-title").value.trim();
        const description = document.getElementById("project-desc").value.trim();
        const deadline = document.getElementById("project-deadline").value;

        const payload = { title, description, deadline: deadline || null };
        if (!id && activeTeamId) {
            payload.teamGroupId = activeTeamId;
        }

        if (!id) {
            const mgElements = document.querySelectorAll('#dynamic-slots-container .init-slot-mg');
            const initialGoals = [];
            mgElements.forEach(mgEl => {
                const mgTitle = mgEl.querySelector('.mg-title')?.value.trim();
                if (!mgTitle) return;
                const mgDesc = mgEl.querySelector('.mg-desc')?.value.trim() || "";
                
                const subGoals = [];
                mgEl.querySelectorAll('.sg-container .init-slot-sg').forEach(sgEl => {
                    const sgTitle = sgEl.querySelector('.sg-title')?.value.trim();
                    if (!sgTitle) return;
                    const sgDesc = sgEl.querySelector('.sg-desc')?.value.trim() || "";
                    
                    const sgTasks = [];
                    sgEl.querySelectorAll('.sg-tasks-container .init-slot-task').forEach(tEl => {
                        const tTitle = tEl.querySelector('.task-title')?.value.trim();
                        if (!tTitle) return;
                        const tDesc = tEl.querySelector('.task-desc')?.value.trim() || "";
                        sgTasks.push({ title: tTitle, description: tDesc });
                    });
                    subGoals.push({ title: sgTitle, description: sgDesc, tasks: sgTasks });
                });

                const mgTasks = [];
                mgEl.querySelectorAll('.mg-tasks-container > .init-slot-task').forEach(tEl => {
                    const tTitle = tEl.querySelector('.task-title')?.value.trim();
                    if (!tTitle) return;
                    const tDesc = tEl.querySelector('.task-desc')?.value.trim() || "";
                    mgTasks.push({ title: tTitle, description: tDesc });
                });

                initialGoals.push({ title: mgTitle, description: mgDesc, subGoals: subGoals, tasks: mgTasks });
            });

            const initialTasks = [];
            document.querySelectorAll('#dynamic-slots-container > .init-slot-task').forEach(tEl => {
                const tTitle = tEl.querySelector('.task-title')?.value.trim();
                if (!tTitle) return;
                const tDesc = tEl.querySelector('.task-desc')?.value.trim() || "";
                initialTasks.push({ title: tTitle, description: tDesc });
            });

            if (initialGoals.length > 0) payload.initialGoals = initialGoals;
            if (initialTasks.length > 0) payload.initialTasks = initialTasks;

            const mgCount = parseInt(document.getElementById("init-mg-count")?.value, 10) || 0;
            const sgCount = parseInt(document.getElementById("init-sg-count")?.value, 10) || 0;
            const taskCount = parseInt(document.getElementById("init-task-count")?.value, 10) || 0;
            if (mgCount > 0 && initialGoals.length === 0) {
                payload.initialMainGoalCount = mgCount;
                payload.initialSubGoalCountPerMain = sgCount;
                payload.initialTaskCountPerSub = taskCount;
            }
        }
        
        const url = id ? `/api/dashboard/project/${id}` : "/api/dashboard/project";
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            closeModal("project-modal");
            showToast("Proje başarıyla kaydedildi.");

            if (id) {
                await triggerGlobalRefresh();
            } else {
                const data = await res.json();
                if (activeTeamId) {
                    await triggerGlobalRefresh();
                    loadTeamWorkspace(activeTeamId, document.getElementById("breadcrumb-project").innerText);
                } else {
                    await loadProjectWorkspace(data.id);
                    await triggerGlobalRefresh();
                }
            }
        } catch (err) {
            showToast("Proje kaydedilirken hata oluştu.", "danger");
        } finally {
            // İŞLEM BİTİNCE BUTONU GERİ AÇ
            submitBtn.disabled = false;
            submitBtn.innerText = "Kaydet";
        }
    }

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

    function openTaskModal(subGoalId, task = null, projectId = null, mainGoalId = null) {
        const form = document.getElementById("task-form");
        form.reset();

        document.getElementById("task-subgoal-id").value = subGoalId || "";
        document.getElementById("task-maingoal-id").value = mainGoalId || "";
        document.getElementById("task-project-id").value = projectId || "";

        if (task) {
            document.getElementById("task-modal-title").innerText = "Görevi Düzenle";
            document.getElementById("task-modal-id").value = task.id;
            document.getElementById("task-title").value = task.title;
            document.getElementById("task-desc").value = task.description;
            document.getElementById("task-completed").checked = task.isCompleted;
            document.getElementById("task-completed").parentElement.style.display = "flex";

            document.getElementById("task-subgoal-id").value = task.subGoalId || "";
            document.getElementById("task-maingoal-id").value = task.mainGoalId || "";
            document.getElementById("task-project-id").value = task.projectId || "";
        } else {
            document.getElementById("task-modal-title").innerText = "Yeni Görev Ekle";
            document.getElementById("task-modal-id").value = "";
            document.getElementById("task-completed").checked = false;
            document.getElementById("task-completed").parentElement.style.display = "none";
        }
        openModal("task-modal");
    }

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
            const isStart = lastAt === 0 || /\\s/.test(val[lastAt - 1]);
            if (isStart) {
                const searchStr = val.substring(lastAt + 1, cursorPos);
                if (!/\\s/.test(searchStr)) {
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
            loadComments(entityType, entityId);
        } catch (err) {
            showToast("Yorum silinemedi.", "danger");
        }
    };

    async function handleTaskSubmit(e) {
        e.preventDefault();
        const id = document.getElementById("task-modal-id").value;
        const subGoalVal = document.getElementById("task-subgoal-id").value;
        const mainGoalVal = document.getElementById("task-maingoal-id").value;
        const projectVal = document.getElementById("task-project-id").value;

        const subGoalId = subGoalVal ? parseInt(subGoalVal) : null;
        const mainGoalId = mainGoalVal ? parseInt(mainGoalVal) : null;
        const projectId = projectVal ? parseInt(projectVal) : null;

        const title = document.getElementById("task-title").value.trim();
        const description = document.getElementById("task-desc").value.trim();
        const isCompleted = document.getElementById("task-completed").checked;

        const payload = { subGoalId, mainGoalId, projectId, title, description, isCompleted };
        const url = id ? `/api/dashboard/task/${id}` : "/api/dashboard/task";
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            closeModal("task-modal");
            showToast("Görev başarıyla kaydedildi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Görev kaydedilirken hata oluştu.", "danger");
        }
    }

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

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function truncateString(str, num) {
        if (!str) return "";
        if (str.length <= num) return str;
        return str.slice(0, num) + "...";
    }

    // --- ÇÖP KUTUSU JS LOGİC'LERİ ---

    async function showDeletedView() {
        activeProjectId = null;
        activeTeamId = null;

        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = "Çöp Kutusu";
        document.querySelector(".breadcrumb-separator").style.display = "inline";

        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "block";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        updateRailActive('rail-btn-trash');
        collapseSidebar();

        await loadDeletedProjects();
    }

    async function loadDeletedProjects() {
        try {
            const res = await fetch("/api/dashboard/deleted");
            if (!res.ok) throw new Error();
            const projects = await res.json();

            const grid = document.getElementById("deleted-projects-grid");
            const toolbar = document.getElementById("trash-bulk-toolbar");

            const master = document.getElementById("select-all-deleted-projects");
            if (master) master.checked = false;

            if (projects.length === 0) {
                if (toolbar) toolbar.style.display = "none";
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                        <p style="color: var(--text-secondary); margin-bottom: 0;">Silinmiş bir proje bulunmuyor.</p>
                    </div>
                `;
                return;
            }

            if (toolbar) toolbar.style.display = "flex";

            grid.innerHTML = projects.map(p => {
                const deletedDate = new Date(p.deletedAt).toLocaleDateString("tr-TR");
                return `
                    <div class="tm-card" style="cursor: default; position: relative;">
                        <div style="position: absolute; top: 16px; right: 16px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" class="project-trash-checkbox" data-project-id="${p.id}" onchange="updateTrashSelection()" style="width: 18px; height: 18px; cursor: pointer;" />
                        </div>
                        <div class="tm-card-title" style="padding-right: 32px;">${escapeHtml(p.title)}</div>
                        <div class="tm-card-desc">${escapeHtml(p.description)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 16px;">
                            Silinme Tarihi: ${deletedDate}
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 20px;">
                            <button class="tm-btn tm-btn-success" style="flex: 1; padding: 6px 12px; font-size: 0.85rem;" onclick="restoreProject(${p.id})">Geri Yükle</button>
                            <button class="tm-btn tm-btn-danger" style="flex: 1; padding: 6px 12px; font-size: 0.85rem;" onclick="permanentlyDeleteProject(${p.id})">Kalıcı Sil</button>
                        </div>
                    </div>
                `;
            }).join("");

            updateTrashSelection();
        } catch (err) {
            console.error(err);
            showToast("Silinmiş projeler yüklenirken hata oluştu.", "danger");
        }
    }

    function toggleSelectAllDeletedProjects(masterCheckbox) {
        const checkboxes = document.querySelectorAll(".project-trash-checkbox");
        checkboxes.forEach(cb => {
            cb.checked = masterCheckbox.checked;
        });
        updateTrashSelection();
    }

    function updateTrashSelection() {
        const checkboxes = document.querySelectorAll(".project-trash-checkbox");
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        const totalCount = checkboxes.length;

        const master = document.getElementById("select-all-deleted-projects");
        if (master) {
            master.checked = (checkedCount === totalCount && totalCount > 0);
            master.indeterminate = (checkedCount > 0 && checkedCount < totalCount);
        }

        const selectedCountText = document.getElementById("selected-projects-count");
        const bulkRestoreBtn = document.getElementById("btn-bulk-restore");
        const bulkDeleteBtn = document.getElementById("btn-bulk-delete");
        const allRestoreBtn = document.getElementById("btn-all-restore");
        const allDeleteBtn = document.getElementById("btn-all-delete");

        if (selectedCountText) {
            if (checkedCount > 0) {
                selectedCountText.innerText = `${checkedCount} proje seçildi`;
                selectedCountText.style.display = "inline";
                if (bulkRestoreBtn) bulkRestoreBtn.style.display = "inline-block";
                if (bulkDeleteBtn) bulkDeleteBtn.style.display = "inline-block";
                if (allRestoreBtn) allRestoreBtn.style.display = "none";
                if (allDeleteBtn) allDeleteBtn.style.display = "none";
            } else {
                selectedCountText.style.display = "none";
                if (bulkRestoreBtn) bulkRestoreBtn.style.display = "none";
                if (bulkDeleteBtn) bulkDeleteBtn.style.display = "none";
                if (allRestoreBtn) allRestoreBtn.style.display = "inline-block";
                if (allDeleteBtn) allDeleteBtn.style.display = "inline-block";
            }
        }
    }

    function getSelectedTrashProjectIds() {
        const checkboxes = document.querySelectorAll(".project-trash-checkbox");
        return Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.getAttribute("data-project-id")));
    }

    async function bulkRestoreSelectedProjects() {
        const ids = getSelectedTrashProjectIds();
        if (ids.length === 0) return;

        try {
            const res = await fetch("/api/dashboard/project/bulk-restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ids)
            });
            if (!res.ok) throw new Error();

            showToast("Seçilen projeler başarıyla geri yüklendi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler geri yüklenirken hata oluştu.", "danger");
        }
    }

    async function bulkDeleteSelectedProjects() {
        const ids = getSelectedTrashProjectIds();
        if (ids.length === 0) return;

        if (!confirm(`${ids.length} projeyi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) {
            return;
        }

        try {
            const res = await fetch("/api/dashboard/project/bulk-permanent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ids)
            });
            if (!res.ok) throw new Error();

            showToast("Seçilen projeler kalıcı olarak silindi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler kalıcı silinirken hata oluştu.", "danger");
        }
    }

    async function restoreAllDeletedProjects() {
        if (!confirm("Tüm silinmiş projeleri geri yüklemek istediğinizden emin misiniz?")) {
            return;
        }

        try {
            const res = await fetch("/api/dashboard/project/restore-all", { method: "POST" });
            if (!res.ok) throw new Error();

            showToast("Tüm projeler başarıyla geri yüklendi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler geri yüklenirken hata oluştu.", "danger");
        }
    }

    async function deleteAllDeletedProjects() {
        if (!confirm("Tüm silinmiş projeleri kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            return;
        }

        try {
            const res = await fetch("/api/dashboard/project/permanent-all", { method: "POST" });
            if (!res.ok) throw new Error();

            showToast("Tüm projeler kalıcı olarak silindi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Projeler kalıcı silinirken hata oluştu.", "danger");
        }
    }

    async function restoreProject(id) {
        try {
            const res = await fetch(`/api/dashboard/project/${id}/restore`, { method: 'POST' });
            if (!res.ok) throw new Error();

            showToast("Proje başarıyla geri yüklendi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Proje geri yüklenirken hata oluştu.", "danger");
        }
    }

    async function permanentlyDeleteProject(id) {
        if (!confirm("Bu projeyi ve ilişkili tüm hedefleri kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            return;
        }

        try {
            const res = await fetch(`/api/dashboard/project/${id}/permanent`, { method: 'DELETE' });
            if (!res.ok) throw new Error();

            showToast("Proje kalıcı olarak silindi.");
            await loadDeletedProjects();
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Silme işlemi gerçekleştirilirken hata oluştu.", "danger");
        }
    }

    let currentWorkspaceTab = 'active';

    function switchWorkspaceTab(tab) {
        currentWorkspaceTab = tab;
        const activeTabBtn = document.getElementById('tab-active-goals');
        const deletedTabBtn = document.getElementById('tab-deleted-goals');
        const activeContent = document.getElementById('active-tab-content');
        const deletedContent = document.getElementById('deleted-tab-content');

        if (tab === 'active') {
            activeTabBtn.style.color = 'var(--text-primary)';
            activeTabBtn.style.borderBottomColor = 'var(--color-secondary)';
            activeTabBtn.style.fontWeight = '500'; 

            deletedTabBtn.style.color = 'var(--text-secondary)';
            deletedTabBtn.style.borderBottomColor = 'transparent';
            deletedTabBtn.style.fontWeight = '500';

            activeContent.style.display = 'block';
            deletedContent.style.display = 'none';
        } else {
            deletedTabBtn.style.color = 'var(--text-primary)';
            deletedTabBtn.style.borderBottomColor = 'var(--color-primary)';
            deletedTabBtn.style.fontWeight = '500';

            activeTabBtn.style.color = 'var(--text-secondary)';
            activeTabBtn.style.borderBottomColor = 'transparent';
            activeTabBtn.style.fontWeight = '500';

            activeContent.style.display = 'none';
            deletedContent.style.display = 'block';
            loadDeletedProjectItems();
        }
    }

    async function loadDeletedProjectItems() {
        if (!activeProjectId) return;
        const container = document.getElementById("deleted-items-list");
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem; padding: 10px;">Yükleniyor...</div>`;

        try {
            const res = await fetch(`/api/dashboard/project/${activeProjectId}/deleted-items`);
            if (!res.ok) throw new Error();
            const data = await res.json();

            let html = "";
            const { mainGoals, subGoals, tasks } = data;

            if (mainGoals.length === 0 && subGoals.length === 0 && tasks.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                        <p style="color: var(--text-secondary); margin-bottom: 0;">Bu projede silinmiş bir hedef veya görev bulunmuyor.</p>
                    </div>
                `;
                return;
            }

            if (mainGoals.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 16px;"><i class="bi bi-clipboard" style="color: var(--text-primary);"></i> Silinen Ana Hedefler</h3>`;
                html += renderDeletedMainGoals(mainGoals);
            }

            if (subGoals.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 24px;"><i class="bi bi-lightning-charge-fill" style="color: #f59e0b;"></i> Silinen Alt Hedefler</h3>`;
                html += renderDeletedSubGoals(subGoals, false);
            }

            if (tasks.length > 0) {
                html += `<h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; margin-top: 24px;"><i class="bi bi-check2-square" style="color: var(--text-primary);"></i> Silinen Görevler</h3>`;
                html += renderDeletedTasks(tasks, false);
            }

            container.innerHTML = html;

        } catch (err) {
            console.error(err);
            container.innerHTML = `<div style="color: var(--color-danger); font-size: 0.9rem; padding: 10px;">Silinen ögeler yüklenirken hata oluştu.</div>`;
        }
    }

    function renderDeletedMainGoals(mainGoals) {
        if (!mainGoals || mainGoals.length === 0) return "";
        return mainGoals.map(mg => {
            const mgProgress = Math.round(mg.progress);
            const mgId = `deleted-maingoal-${mg.id}`;
            const isExpanded = expandedAccordions.has(mgId);
            return `
                <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${mgId}">
                    <div class="goal-card-header" onclick="toggleAccordion('${mgId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="bi ${mgProgress === 100 ? 'bi-clipboard-check' : 'bi-clipboard'}" style="font-size: 1.1rem; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-primary)'};"></i>
                                <span style="font-weight: 600; font-size: 1.05rem;">${escapeHtml(mg.title)}</span>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 120px; height: 6px;">
                                    <div class="progress-bar-fill" style="width: ${mgProgress}%; background-color: ${getSmoothProgressColor(mgProgress)};"></div>
                                </div>
                                <span style="font-size: 0.85rem; font-weight: 600; color: ${mgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${mgProgress}</span>
                            </div>
                        </div>
                        
                        <span class="accordion-caret" style="color: var(--text-muted);"><i class="bi bi-caret-down-fill"></i></span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content">
                            <p style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.95rem; line-height: 1.5;">${escapeHtml(mg.description)}</p>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap;">
                                <span><i class="bi bi-calendar-event"></i> Oluşturulma: ${new Date(mg.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                ${mg.changedAt ? `<span><i class="bi bi-arrow-repeat"></i> Değişiklik: ${new Date(mg.changedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                                <span style="color: var(--color-danger);"><i class="bi bi-trash3"></i> Silinme: ${new Date(mg.deletedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            
                            <div style="display: flex; gap: 10px; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
                                ${activeProjectIsObserver ? '' : `
                                <button class="tm-btn tm-btn-success" style="padding: 6px 12px; font-size: 0.8rem;" onclick="restoreProjectItem('maingoal', ${mg.id})">Geri Yükle</button>
                                <button class="tm-btn tm-btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="permanentlyDeleteProjectItem('maingoal', ${mg.id})">Kalıcı Sil</button>
                                `}
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 16px;">
                                ${mg.tasks && mg.tasks.length > 0 ? `
                                    <div class="tm-card" style="border: 1px solid var(--border-color); padding: 12px; background-color: var(--bg-surface-elevated);">
                                        <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;"><i class="bi bi-check2-square" style="color: var(--text-primary);"></i> Ana Hedef Görevleri</h4>
                                        <div style="display: flex; flex-direction: column; gap: 8px;">
                                            ${renderDeletedTasks(mg.tasks, true)}
                                        </div>
                                    </div>
                                ` : ''}
                                ${renderDeletedSubGoals(mg.subGoals, true)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderDeletedSubGoals(subGoals, isParentDeleted) {
        if (!subGoals || subGoals.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">Bu hedefe ait herhangi bir alt hedef bulunmuyor.</div>`;
        }

        return subGoals.map(sg => {
            const sgProgress = Math.round(sg.progress);
            const sgId = `deleted-subgoal-${sg.id}`;
            const isExpanded = expandedAccordions.has(sgId);
            return `
                <div class="goal-card ${isExpanded ? 'expanded' : ''}" id="${sgId}">
                    <div class="goal-card-header" onclick="toggleAccordion('${sgId}')">
                        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="bi bi-lightning-charge-fill" style="font-size: 0.95rem; color: #f59e0b;"></i>
                                <span style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(sg.title)}</span>
                                ${isParentDeleted ? '<span style="font-size: 0.75rem; color: var(--color-danger);">(Üst Hedefle Silindi)</span>' : ''}
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div class="progress-bar-bg" style="width: 100px; height: 6px;">
                                    <div class="progress-bar-fill" style="width: ${sgProgress}%; background-color: ${getSmoothProgressColor(sgProgress)};"></div>
                                </div>
                                <span style="font-size: 0.8rem; font-weight: 600; color: ${sgProgress === 100 ? 'var(--color-success)' : 'var(--text-secondary)'};">%${sgProgress}</span>
                            </div>
                        </div>
                        <span class="accordion-caret" style="color: var(--text-muted); font-size: 0.8rem;"><i class="bi bi-caret-down-fill"></i></span>
                    </div>

                    <div class="goal-card-content-wrapper">
                        <div class="goal-card-content subgoal-content">
                            <p style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem; line-height: 1.5;">${escapeHtml(sg.description)}</p>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px; display: flex; gap: 16px; flex-wrap: wrap;">
                                <span><i class="bi bi-calendar-event"></i> Oluşturulma: ${new Date(sg.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                ${sg.changedAt ? `<span><i class="bi bi-arrow-repeat"></i> Değişiklik: ${new Date(sg.changedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                                ${!isParentDeleted && sg.deletedAt ? `<span style="color: var(--color-danger);"><i class="bi bi-trash3"></i> Silinme: ${new Date(sg.deletedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                            </div>

                            <div style="display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                                ${(isParentDeleted || activeProjectIsObserver) ? '' : `
                                <button class="tm-btn tm-btn-success" style="padding: 4px 10px; font-size: 0.75rem;" onclick="restoreProjectItem('subgoal', ${sg.id})">Geri Yükle</button>
                                <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="permanentlyDeleteProjectItem('subgoal', ${sg.id})">Kalıcı Sil</button>
                                `}
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${renderDeletedTasks(sg.tasks, isParentDeleted || sg.isDeleted)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderDeletedTasks(tasks, isParentDeleted) {
        if (!tasks || tasks.length === 0) {
            return `<div style="color: var(--text-muted); font-size: 0.8rem; padding: 5px 0;">Henüz silinmiş görev bulunmuyor.</div>`;
        }

        return tasks.map(t => {
            return `
                <div class="task-item-row" id="deleted-task-row-${t.id}">
                    <div class="task-item-left">
                        <i class="bi bi-check2-square" style="color: var(--text-primary); font-size: 1.1rem; margin-right: 8px;"></i>
                        <div style="display: flex; flex-direction: column;">
                            <span class="task-title" style="font-size: 0.9rem;">
                                ${escapeHtml(t.title)}
                                ${t.isCompleted ? '<span style="color: var(--color-success); font-size: 0.8rem;"> (Tamamlandı)</span>' : ''}
                                ${isParentDeleted ? '<span style="font-size: 0.75rem; color: var(--color-danger);">(Üst Hedefle Silindi)</span>' : ''}
                            </span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(t.description)}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap;">
                                <span><i class="bi bi-calendar-event"></i> Oluşturulma: ${new Date(t.createdAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                ${t.completedAt ? `<span><i class="bi bi-check-circle-fill text-success"></i> Tamamlanma: ${new Date(t.completedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                                ${!isParentDeleted && t.deletedAt ? `<span style="color: var(--color-danger);"><i class="bi bi-trash3"></i> Silinme: ${new Date(t.deletedAt).toLocaleString("tr-TR", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        ${(isParentDeleted || activeProjectIsObserver) ? '' : `
                        <button class="tm-btn tm-btn-success" style="padding: 4px 10px; font-size: 0.75rem;" onclick="restoreProjectItem('task', ${t.id})">Geri Yükle</button>
                        <button class="tm-btn tm-btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="permanentlyDeleteProjectItem('task', ${t.id})">Kalıcı Sil</button>
                        `}
                    </div>
                </div>
            `;
        }).join("");
    }

    async function restoreProjectItem(type, id) {
        try {
            const res = await fetch(`/api/dashboard/${type}/${id}/restore`, { method: 'POST' });
            if (!res.ok) throw new Error();

            showToast("Öge başarıyla geri yüklendi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Geri yükleme sırasında hata oluştu.", "danger");
        }
    }

    async function permanentlyDeleteProjectItem(type, id) {
        if (!confirm("Bu ögeyi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            return;
        }

        try {
            const res = await fetch(`/api/dashboard/${type}/${id}/permanent`, { method: 'DELETE' });
            if (!res.ok) throw new Error();

            showToast("Öge kalıcı olarak silindi.");
            await triggerGlobalRefresh();
        } catch (err) {
            showToast("Kalıcı silme sırasında hata oluştu.", "danger");
        }
    }

    // --- SON AKTİVİTELER JS LOGİC'LERİ ---

    async function showActivitiesView() {
        activeProjectId = null;
        activeTeamId = null;

        // Üst Bar (Breadcrumb) Ayarları
        document.getElementById("project-progress-badge").style.display = "none";
        document.getElementById("breadcrumb-project").innerText = "Son Aktiviteler";
        document.querySelector(".breadcrumb-separator").style.display = "inline";

        // Tüm ekranları gizle, sadece Aktiviteler ekranını göster
        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        document.getElementById("activities-view").style.display = "block";
        document.getElementById("teams-dashboard-view").style.display = "none";
        updateRailActive('rail-btn-activities');
        collapseSidebar();

        // Verileri çekmeye başla
        await loadFullActivitiesView();
    }

    async function loadFullActivitiesView() {
        const container = document.getElementById("activities-content-container");
        container.innerHTML = `<div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md); color: var(--text-muted);">Veriler yükleniyor...</div>`;

        try {
            const res = await fetch("/api/dashboard/activities");
            if (!res.ok) throw new Error();

            const data = await res.json();

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                        <p style="color: var(--text-secondary); margin-bottom: 0;">Henüz kaydedilmiş bir aktivite bulunmuyor.</p>
                    </div>
                `;
                return;
            }

            let html = "";
            data.forEach(projectLog => {
                const cardId = `full-activity-proj-${projectLog.projectId}`;

                html += `
                    <div class="tm-card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color);">
                        <!-- Proje Başlığı (Akordiyon Tetikleyici) -->
                        <div onclick="toggleFullActivityCard('${cardId}')" style="cursor: pointer; padding: 16px 20px; background-color: var(--bg-surface-elevated); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 1.2rem;">📂</span>
                                <span style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(projectLog.projectTitle)}</span>
                                <span style="font-size: 0.8rem; padding: 4px 8px; background-color: rgba(255,255,255,0.1); border-radius: 12px; color: var(--text-muted);">${projectLog.activities.length} İşlem</span>
                            </div>
                            <span id="arrow-${cardId}" style="transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: var(--text-secondary); font-size: 0.9rem; display: flex; align-items: center; justify-content: center;"><i class="bi bi-caret-down-fill"></i></span>
                        </div>
                        
                        <!-- Log İçerikleri -->
                        <div id="${cardId}" style="display: none; flex-direction: column;">
                            ${projectLog.activities.map((log, index) => {
                    let icon = '<i class="bi bi-file-earmark-text" style="color: #64748b;"></i>';
                    let iconBg = "rgba(100, 116, 139, 0.2)"; // Gri

                    if(log.action === "Oluşturuldu") { icon = '<i class="bi bi-stars" style="color: #10b981;"></i>'; iconBg = "rgba(16, 185, 129, 0.2)"; } // Yeşil
                    if(log.action === "Silindi" || log.action === "Kalıcı Olarak Silindi") { icon = '<i class="bi bi-trash3" style="color: #ef4444;"></i>'; iconBg = "rgba(239, 68, 68, 0.2)"; } // Kırmızı
                    if(log.action === "Güncellendi") { icon = '<i class="bi bi-pencil-square" style="color: #3b82f6;"></i>'; iconBg = "rgba(59, 130, 246, 0.2)"; } // Mavi

                    const timeString = new Date(log.date).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const dateString = new Date(log.date).toLocaleDateString("tr-TR");

                    // Son elemanın alt çizgisini kaldırmak için
                    const borderStyle = index === projectLog.activities.length - 1 ? "" : "border-bottom: 1px solid var(--border-color);";

                    return `
                                    <div style="padding: 16px 20px; display: flex; gap: 16px; align-items: flex-start; ${borderStyle} background-color: var(--bg-base); transition: background-color 0.2s;">
                                        <div style="width: 36px; height: 36px; border-radius: 50%; background-color: ${iconBg}; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
                                            ${icon}
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                                <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">
                                                    ${log.entity === 'Project' ? escapeHtml(projectLog.projectTitle) : (log.entity === 'MainGoal' ? 'Ana Hedef' : (log.entity === 'SubGoal' ? 'Alt Hedef' : 'Görev'))} ${escapeHtml(log.action)}
                                                </span>
                                                <span style="font-size: 0.8rem; color: var(--text-muted);">${dateString} ${timeString}</span>
                                            </div>
                                            <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">
                                                ${escapeHtml(log.details)}
                                            </div>
                                        </div>
                                    </div>
                                `;
                }).join('')}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;

        } catch (err) {
            console.error(err);
            container.innerHTML = `<div style="text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md); color: var(--color-danger);">Aktiviteler yüklenirken bir hata oluştu.</div>`;
        }
    }

    function toggleFullActivityCard(cardId) {
        const contentDiv = document.getElementById(cardId);
        const arrow = document.getElementById(`arrow-${cardId}`);

        if (contentDiv.style.display === "none") {
            contentDiv.style.display = "flex";
            arrow.style.transform = "rotate(180deg)";
        } else {
            contentDiv.style.display = "none";
            arrow.style.transform = "rotate(0deg)";
        }
    }

    window.hideCompletedTasks = false;
    window.expandedTaskContainers = new Set();

    window.toggleCompletedTasksGlobal = function(event) {
        const isChecked = event ? event.target.checked : !window.hideCompletedTasks;
        window.hideCompletedTasks = isChecked;
        
        // Update all checkboxes
        document.querySelectorAll('input[onchange="toggleCompletedTasksGlobal(event)"]').forEach(cb => cb.checked = isChecked);
        
        // Update all task containers
        document.querySelectorAll('.task-list-container').forEach(container => {
            if (isChecked) {
                container.classList.add('hide-completed');
            } else {
                container.classList.remove('hide-completed');
            }
        });
    }

    window.toggleTaskContainerExpand = function(containerId, btnElement) {
        window.expandedTaskContainers = window.expandedTaskContainers || new Set();
        const container = document.getElementById(containerId);
        if (!container) return;

        if (window.expandedTaskContainers.has(containerId)) {
            window.expandedTaskContainers.delete(containerId);
            container.style.maxHeight = "280px";
            if (btnElement) btnElement.innerText = "Tümünü Göster";
        } else {
            window.expandedTaskContainers.add(containerId);
            container.style.maxHeight = "none";
            if (btnElement) btnElement.innerText = "Kapat";
        }
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

