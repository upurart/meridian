    async function loadProfilePageData() {
        try {
            const res = await fetch("/api/UserApi/profile");
            if (res.ok) {
                const user = await res.json();
                const nameEl = document.getElementById("profile-page-name");
                if (nameEl) nameEl.innerText = user.name + " " + user.surname;
                const unEl = document.getElementById("profile-page-username");
                if (unEl) unEl.innerText = user.username;
                const emEl = document.getElementById("profile-page-email");
                if (emEl) emEl.innerText = user.email;
                if (user.avatarUrl && user.avatarUrl.trim() !== '') {
                    const avEl = document.getElementById("profile-page-avatar");
                    const inEl = document.getElementById("profile-page-initials");
                    if (avEl) { avEl.src = user.avatarUrl; avEl.style.display = "block"; }
                    if (inEl) inEl.style.display = "none";
                } else {
                    const avEl = document.getElementById("profile-page-avatar");
                    const inEl = document.getElementById("profile-page-initials");
                    if (avEl) avEl.style.display = "none";
                    if (inEl) {
                        let initials = "";
                        if (user.name) initials += user.name.charAt(0);
                        if (user.surname) initials += user.surname.charAt(0);
                        inEl.innerText = initials || "U";
                        inEl.style.display = "flex";
                    }
                }
            }
            
            const wsRes = await fetch(window.WORKSPACE_API);
            if (wsRes.ok) {
                const workspaces = await wsRes.json();
                const wsStatEl = document.getElementById("profile-stat-workspaces");
                if (wsStatEl) wsStatEl.innerText = workspaces.length;
            }
            
            const projRes = await fetch("/api/dashboard/tree");
            if (projRes.ok) {
                const projects = await projRes.json();
                const activeCount = projects.filter(p => !p.isCompleted).length;
                const completedCount = projects.filter(p => p.isCompleted).length;
                const actStatEl = document.getElementById("profile-stat-active");
                if (actStatEl) actStatEl.innerText = activeCount;
                const cmpStatEl = document.getElementById("profile-stat-completed");
                if (cmpStatEl) cmpStatEl.innerText = completedCount;
            }
        } catch (e) {
            console.error("Profil bilgileri yüklenirken hata:", e);
        }
    }

    async function showProfilePage() {
        if (typeof activeProjectId !== 'undefined') activeProjectId = null;
        if (typeof activeTeamId !== 'undefined') activeTeamId = null;
        if (typeof activeWorkspaceId !== 'undefined') activeWorkspaceId = null;

        updateBreadcrumb(null, "Kullanıcı Profili", null);

        if(document.getElementById("home-view")) document.getElementById("home-view").style.display = "none";
        if(document.getElementById("calendar-view")) document.getElementById("calendar-view").style.display = "none";
        if(document.getElementById("files-view")) document.getElementById("files-view").style.display = "none";
        if(document.getElementById("workspaces-dashboard-view")) document.getElementById("workspaces-dashboard-view").style.display = "none";
        if(document.getElementById("workspace-view")) document.getElementById("workspace-view").style.display = "none";
        if(document.getElementById("teams-dashboard-view")) document.getElementById("teams-dashboard-view").style.display = "none";
        if(document.getElementById("deleted-view")) document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("teams-dashboard-view")) document.getElementById("teams-dashboard-view").style.display = "none";
        
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";

        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "block";
        const sv = document.getElementById("settings-view");
        if(sv) sv.style.display = "none";

        collapseSidebar();
        
        await loadProfilePageData();
    }

    window.showProfilePage = showProfilePage;

