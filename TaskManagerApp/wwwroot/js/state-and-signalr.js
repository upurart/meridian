    let activeProjectId = null;
    let commentConnection = null;
    let currentHubProjectId = null;
    let currentDrawerEntityId = null;
    let currentDrawerEntityType = null;
    
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

        try {
            await commentConnection.start();
            if (activeProjectId) {
                joinCommentProject(activeProjectId);
            }
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

