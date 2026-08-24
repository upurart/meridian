    let activeProjectId = null;
    let commentConnection = null;
    let chatConnection = null; // CHAT SIGNALR
    let currentHubProjectId = null;
    let currentDrawerEntityId = null;
    let currentDrawerEntityType = null;
    let activeChatSessionId = null; // CHAT SESSION ID
    
    // Mention state
    let activeProjectMembers = [];
    let mentionSearchIndex = -1;
    let isMentioning = false;
    let selectedMentionIndex = 0;
    let filteredMembers = [];

    async function initSignalR() {
        if (!window.signalR) return;
        
        commentConnection = new signalR.HubConnectionBuilder()
            .withUrl("/commentHub")
            .withAutomaticReconnect()
            .build();

        commentConnection.on("ReceiveComment", (entityType, entityId, comment) => {
            if (currentDrawerEntityId === entityId && currentDrawerEntityType === entityType) {
                if (window.currentLoadedComments) window.currentLoadedComments.push(comment);
                loadComments(entityType, entityId, true);
            }
        });

        commentConnection.on("CommentDeleted", (entityType, entityId, commentId) => {
            if (currentDrawerEntityId === entityId && currentDrawerEntityType === entityType) {
                loadComments(entityType, entityId, true);
            }
        });
        
        chatConnection = new signalR.HubConnectionBuilder()
            .withUrl("/chatHub")
            .withAutomaticReconnect()
            .build();
            
        chatConnection.on("ReceiveMessage", (message) => {
            if (window.receiveChatMessage) {
                window.receiveChatMessage(message);
            }
        });
        
        chatConnection.on("MessageEdited", (message) => {
            if (window.handleMessageEdited) {
                window.handleMessageEdited(message);
            }
        });
        
        chatConnection.on("MessageDeleted", (messageId) => {
            if (window.handleMessageDeleted) {
                window.handleMessageDeleted(messageId);
            }
        });
        
        chatConnection.on("MessagePinnedToggled", (messageId, isPinned) => {
            if (window.handleMessagePinnedToggled) {
                window.handleMessagePinnedToggled(messageId, isPinned);
            }
        });
        
        chatConnection.on("MessageReactionToggled", (messageId, userId, emoji, isAdded) => {
            if (window.handleMessageReactionToggled) {
                window.handleMessageReactionToggled(messageId, userId, emoji, isAdded);
            }
        });
        
        chatConnection.on("MessagesRead", (chatSessionId, userId, timestamp) => {
            if (window.handleMessagesRead) {
                window.handleMessagesRead(chatSessionId, userId, timestamp);
            }
        });
        
        chatConnection.on("UserAvatarUpdated", (updatedUserId, newAvatarUrl) => {
            if (typeof window.handleUserAvatarUpdated === 'function') {
                window.handleUserAvatarUpdated(updatedUserId, newAvatarUrl);
            }
        });
        
        chatConnection.on("UserProfileUpdated", (profileData) => {
            if (typeof window.handleUserProfileUpdated === 'function') {
                window.handleUserProfileUpdated(profileData);
            }
        });

        try {
            await commentConnection.start();
            if (activeProjectId) {
                joinCommentProject(activeProjectId);
            }
            
            await chatConnection.start();
            window.chatConnection = chatConnection; // Expose to global for chat script
        } catch (err) {
            console.error("SignalR Connection Error: ", err);
        }
    }

    function joinCommentProject(projectId) {
        if (commentConnection && commentConnection.state === signalR.HubConnectionState.Connected) {
            if (currentHubProjectId) {
                commentConnection.invoke("LeaveProjectGroup", currentHubProjectId).catch(console.error);
            }
            commentConnection.invoke("JoinProjectGroup", projectId).catch(console.error);
            currentHubProjectId = projectId;
        }
    }

    function joinChatSessionGroup(sessionId) {
        if (chatConnection && chatConnection.state === signalR.HubConnectionState.Connected) {
            if (activeChatSessionId) {
                chatConnection.invoke("LeaveChatSession", activeChatSessionId).catch(console.error);
            }
            chatConnection.invoke("JoinChatSession", sessionId).catch(console.error);
            activeChatSessionId = sessionId;
        }
    }
    
    window.joinChatSessionGroup = joinChatSessionGroup;

    // Call init when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSignalR);
    } else {
        initSignalR();
    }
    let activeProjectHasManageAccess = false;
    let activeProjectIsObserver = false;
    let activeTeamId = null;
    let currentProjectViewMode = 'grid';

    window.setProjectViewMode = function(mode) {
        currentProjectViewMode = mode;
        ['grid', 'list', 'compact'].forEach(m => {
            const btn = document.getElementById(`btn-view-${m}`);
            if (btn) btn.classList.remove("active");
        });
        const activeBtn = document.getElementById(`btn-view-${mode}`);
        if (activeBtn) activeBtn.classList.add("active");
        applyGridFilters();
    };
    let treeData = [];
    let currentTeamsData = [];

    const expandedNodes = new Set();
    const searchExpandedNodes = new Set();
    const expandedAccordions = new Set();


    window.updateBreadcrumb = function(teamName, workspaceName, projectName) {
        const homeEl = document.getElementById('breadcrumb-home');
        
        const sepWsDash = document.getElementById('breadcrumb-sep-ws-dash');
        const wsDashEl = document.getElementById('breadcrumb-workspaces-dash');
        
        const sepOrg = document.getElementById('breadcrumb-sep-org');
        const orgEl = document.getElementById('breadcrumb-org');
        
        const sepTeam = document.getElementById('breadcrumb-sep-team');
        const teamEl = document.getElementById('breadcrumb-team');
        
        const sepWs = document.getElementById('breadcrumb-sep-ws');
        const wsEl = document.getElementById('breadcrumb-workspace');
        
        const sepProj = document.getElementById('breadcrumb-sep-proj');
        const projEl = document.getElementById('breadcrumb-project');
        
        const backBtn = document.getElementById('breadcrumb-back');
        
        const sepCal = document.getElementById('breadcrumb-separator-1');
        const calEl = document.getElementById('breadcrumb-calendar');
        
        // Helper to reset a breadcrumb item
        const resetItem = (el) => {
            if (el) {
                el.style.display = 'none';
                el.style.color = 'var(--text-muted)';
                el.style.fontWeight = 'normal';
                el.classList.add('breadcrumb-link');
                // Avoid !important hover issue by resetting color manually
            }
        };
        const activeItem = (el) => {
            if (el) {
                el.style.display = 'inline';
                el.style.color = 'var(--text-primary)';
                el.style.fontWeight = '600';
                el.classList.remove('breadcrumb-link'); // Remove hover effect for active item
            }
        };
        const inactiveItem = (el) => {
            if (el) {
                el.style.display = 'inline';
                el.style.color = 'var(--text-muted)';
                el.style.fontWeight = 'normal';
                el.classList.add('breadcrumb-link');
            }
        };
        const hideSep = (el) => { if (el) el.style.display = 'none'; };
        const showSep = (el) => { if (el) el.style.display = 'inline'; };

        // Reset all
        resetItem(homeEl);
        resetItem(calEl);
        resetItem(wsDashEl);
        resetItem(orgEl);
        resetItem(teamEl);
        resetItem(wsEl);
        resetItem(projEl);
        hideSep(sepCal);
        hideSep(sepWsDash);
        hideSep(sepOrg);
        hideSep(sepTeam);
        hideSep(sepWs);
        hideSep(sepProj);

        // Always show Home initially as inactive
        inactiveItem(homeEl);

        if (backBtn) {
            backBtn.style.display = (!teamName && !workspaceName && !projectName) ? 'none' : 'inline';
        }

        const isSpecialView = ['Takvim', 'Çöp Kutusu', 'Son Aktiviteler', 'Kullanıcı Profili', 'Takımlar', 'Dosya Gezgini', 'Ayarlar', 'Mesajlar'].includes(workspaceName);

        if (!teamName && !workspaceName && !projectName) {
            activeItem(homeEl);
            return;
        }

        if (isSpecialView) {
            showSep(sepCal);
            activeItem(calEl);
            calEl.innerText = workspaceName;
            return;
        }

        if (workspaceName === 'Çalışma Alanları' && !teamName && !projectName) {
            showSep(sepWsDash);
            activeItem(wsDashEl);
            return;
        }

        // Logic for Workspace & Project paths
        if (teamName) {
            // Team Path: Home \ Organizasyon \ TeamName \ [WorkspaceName] \ [ProjectName]
            showSep(sepOrg);
            inactiveItem(orgEl);
            orgEl.innerText = 'Organizasyon';
            
            showSep(sepTeam);
            if (!workspaceName && !projectName) {
                activeItem(teamEl);
            } else {
                inactiveItem(teamEl);
            }
            teamEl.innerText = teamName;
        } else {
            // Personal Path: Home \ Çalışma Alanları \ [WorkspaceName] \ [ProjectName]
            showSep(sepWsDash);
            if (!workspaceName && !projectName) {
                activeItem(wsDashEl);
            } else {
                inactiveItem(wsDashEl);
            }
        }

        if (workspaceName && workspaceName !== 'Çalışma Alanları') {
            showSep(sepWs);
            if (!projectName) {
                activeItem(wsEl);
            } else {
                inactiveItem(wsEl);
            }
            wsEl.innerText = workspaceName;
        }

        if (projectName) {
            showSep(sepProj);
            activeItem(projEl);
            projEl.innerText = projectName;
        }
    };

    window.navigateBack = function() {
        if (document.getElementById("workspace-view") && document.getElementById("workspace-view").style.display === "block") {
            // We are inside a Project. Go back to Workspace.
            if (activeWorkspaceId) {
                loadWorkspaceView(activeWorkspaceId, activeWorkspaceName);
            } else if (activeTeamId) {
                loadTeamWorkspace(activeTeamId, activeTeamName || "Takım");
            } else {
                showDashboardHome();
            }
        } else if (document.getElementById("workspace-projects-view") && document.getElementById("workspace-projects-view").style.display === "block") {
            // We are inside a Workspace. Go back to Team or Home.
            if (activeTeamId) {
                loadTeamWorkspace(activeTeamId, activeTeamName || "Takım");
            } else {
                showDashboardHome();
            }
        } else if (document.getElementById("home-view") && document.getElementById("home-view").style.display === "block") {
            // We are on Team Dashboard or Personal Dashboard
            if (activeTeamId) {
                // If on Team Dashboard, we could go to Teams List, but usually Home is safer.
                showDashboardHome();
            }
            // If already on Personal Dashboard, do nothing or explicitly go Home.
            showDashboardHome();
        } else {
            // Any other view (Trash, Activity, etc.), go Home.
            showDashboardHome();
        }
    };


