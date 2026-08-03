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


    window.updateBreadcrumb = function(teamName, workspaceName, projectName) {
        const sepTeam = document.getElementById('breadcrumb-sep-team');
        const teamEl = document.getElementById('breadcrumb-team');
        const sepWs = document.getElementById('breadcrumb-sep-ws');
        const wsEl = document.getElementById('breadcrumb-workspace');
        const sepProj = document.getElementById('breadcrumb-sep-proj');
        const projEl = document.getElementById('breadcrumb-project');
        const backBtn = document.getElementById('breadcrumb-back');
        
        // Reset all to hidden
        if(sepTeam) sepTeam.style.display = 'none';
        if(teamEl) teamEl.style.display = 'none';
        if(sepWs) sepWs.style.display = 'none';
        if(wsEl) wsEl.style.display = 'none';
        if(sepProj) sepProj.style.display = 'none';
        if(projEl) projEl.style.display = 'none';
        
        if (backBtn) {
            if (!teamName && !workspaceName && !projectName) {
                backBtn.style.display = 'none';
            } else {
                backBtn.style.display = 'inline';
            }
        }

        if (teamName) {
            if(sepTeam) sepTeam.style.display = 'inline';
            if(teamEl) {
                teamEl.style.display = 'inline';
                teamEl.innerText = teamName;
                teamEl.style.color = workspaceName ? 'var(--text-muted)' : 'var(--text-primary)';
                teamEl.style.fontWeight = workspaceName ? 'normal' : '600';
            }
        }
        
        if (workspaceName) {
            // If there's no teamName, we might still show a workspace (e.g. Personal workspaces)
            // In that case, we show the first separator before the workspace
            if (!teamName) {
                if(sepTeam) sepTeam.style.display = 'inline'; // Use sepTeam as the first separator
            } else {
                if(sepWs) sepWs.style.display = 'inline';
            }
            if(wsEl) {
                wsEl.style.display = 'inline';
                wsEl.innerText = workspaceName;
                wsEl.style.color = projectName ? 'var(--text-muted)' : 'var(--text-primary)';
                wsEl.style.fontWeight = projectName ? 'normal' : '600';
            }
        }

        if (projectName) {
            if (workspaceName) {
                if(sepProj) sepProj.style.display = 'inline';
            } else if (teamName) {
                if(sepWs) sepWs.style.display = 'inline'; // fallback
            } else {
                if(sepTeam) sepTeam.style.display = 'inline';
            }
            if(projEl) {
                projEl.style.display = 'inline';
                projEl.innerText = projectName;
                projEl.style.color = 'var(--text-primary)';
                projEl.style.fontWeight = '600';
            }
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
