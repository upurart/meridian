    async function loadTeamWorkspace(teamId, teamName) {
        activeProjectId = null;
        activeWorkspaceId = null;
        activeWorkspaceName = null;
        activeTeamId = teamId;
        if (teamName) {
            activeTeamName = teamName;
        }
        
        const btnCreateWs = document.getElementById('btn-create-workspace-home');
        if (btnCreateWs) btnCreateWs.style.display = 'inline-block';
        
        const btnCreateProj = document.getElementById('btn-create-project-home');
        if (btnCreateProj) btnCreateProj.style.display = 'none';
        
        
        updateBreadcrumb(teamName, null, null);

        document.getElementById("home-view").style.display = "none";
        const calView = document.getElementById("calendar-view");
        if (calView) calView.style.display = "none";
        if(document.getElementById("files-view")) document.getElementById("files-view").style.display = "none";
        document.getElementById("workspaces-dashboard-view").style.display = "block";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        if(document.getElementById("workspace-projects-view")) document.getElementById("workspace-projects-view").style.display = "none";

        document.getElementById("home-view-title").innerText = teamName + " Çalışma Alanları";
        const subEl = document.getElementById("home-view-subtitle");
        if (subEl) subEl.innerText = `${teamName} Takımına ait çalışma alanları.`;
        
        const filtersGroup = document.getElementById("project-filters-group");
        if (filtersGroup) {
            filtersGroup.style.display = "none";
        }
        
        updateRailActive('rail-btn-teams');
        collapseSidebar();

        // Fetch Workspaces for this team to display in the grid
        try {
            const wsRes = await fetch(window.WORKSPACE_API);
            if (wsRes.ok) {
                const workspaces = await wsRes.json();
                gridProjectsData = workspaces.filter(w => w.teamGroupId === teamId);
            } else {
                gridProjectsData = [];
            }
        } catch (err) {
            console.error(err);
            gridProjectsData = [];
        }
        
        // Filter projects for stats calculation
        const teamProjects = treeData.filter(p => p.teamGroupId === teamId);
        
        // Re-calculate stats for this team
        let totalProjects = teamProjects.length;
        let completedProjects = 0;
        let totalGoals = 0;
        
        teamProjects.forEach(p => {
            const roundProgress = Math.round(p.progress);
            if (roundProgress === 100) {
                completedProjects++;
            }
            p.mainGoals.forEach(mg => {
                totalGoals++;
            });
        });

        applyGridFilters();
    }

    async function triggerGlobalRefresh() {
        const scrollPositions = new Map();
        document.querySelectorAll('.task-list-container').forEach(container => {
            if (container.id) {
                scrollPositions.set(container.id, container.scrollTop);
            }
        });
        const windowScrollY = window.scrollY;

        loadSidebarTree();
        loadHomeStatsAndGrid();
        if (typeof activeProjectId !== 'undefined' && activeProjectId) {
            await refreshWorkspaceData();
        } else if (typeof activeWorkspaceId !== 'undefined' && activeWorkspaceId) {
            const wsView = document.getElementById("workspace-projects-view");
            if (wsView && wsView.style.display === "block") {
                await loadWorkspaceView(activeWorkspaceId, typeof activeWorkspaceName !== 'undefined' ? activeWorkspaceName : null);
            }
        }
        if (document.getElementById("deleted-view").style.display === "block") {
            await loadDeletedProjects();
        }
        // Eğer aktiviteler sekmesi açıksa orayı da yenile
        if (document.getElementById("activities-view").style.display === "block") {
            await loadFullActivitiesView();
        }

        requestAnimationFrame(() => {
            scrollPositions.forEach((scrollTop, id) => {
                const el = document.getElementById(id);
                if (el) el.scrollTop = scrollTop;
            });
            window.scrollTo(0, windowScrollY);
        });
    }

    function showTeamsDashboard() {
        activeProjectId = null;
        activeTeamId = null;
        
        
        updateBreadcrumb(null, "Takımlar", null);

        document.getElementById("home-view").style.display = "none";
        const calView = document.getElementById("calendar-view");
        if (calView) calView.style.display = "none";
        if(document.getElementById("files-view")) document.getElementById("files-view").style.display = "none";
        document.getElementById("workspaces-dashboard-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "block";
        updateRailActive('rail-btn-teams');
        collapseSidebar();

        renderTeamsDashboardGrid(currentTeamsData);
    }

    function renderTeamsDashboardGrid(teams) {
        const grid = document.getElementById("teams-dashboard-grid");
        
        if (!teams || teams.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">Henüz bir takımınız yok. Takım kurabilir veya mevcut bir takıma ID ile katılabilirsiniz.</p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="tm-btn tm-btn-secondary" onclick="openJoinTeamModal()">+ Takıma Katıl</button>
                        <button class="tm-btn tm-btn-primary" onclick="openCreateTeamModal()">+ Yeni Takım Kur</button>
                    </div>
                </div>
            `;
            return;
        }

        grid.innerHTML = teams.map(t => {
            const isManager = t.myRole === 'Owner' || t.myRole === 'Admin';
            const manageBtn = isManager ? 
                `<button class="tm-btn tm-btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); openManageTeamModal(${t.id})"><i class="bi bi-gear"></i> Yönet${t.pendingRequestsCount > 0 ? ` <span style="color:var(--color-danger);font-weight:bold;">(${t.pendingRequestsCount})</span>` : ''}</button>` : '';

            return `
                <div class="tm-card" onclick="loadTeamWorkspace(${t.id}, '${escapeHtml(t.name)}')">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div class="tm-card-title" style="margin-bottom: 0;">${escapeHtml(t.name)}</div>
                        <span style="font-size: 0.75rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 12px; color: var(--text-secondary);">ID: ${t.id}</span>
                    </div>
                    <div class="tm-card-desc" style="min-height: 40px;">${escapeHtml(truncateString(t.description || '', 100))}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 16px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
                        <div style="display: flex; gap: 8px;">
                            <span><i class="bi bi-people"></i> ${t.memberCount || 1} Üye</span>
                            <span><i class="bi bi-folder2"></i> ${t.projectCount || 0} Proje</span>
                        </div>
                        ${manageBtn}
                    </div>
                </div>
            `;
        }).join("");
    }

    function openCreateTeamModal() {
        document.getElementById('create-team-form').reset();
        openModal('create-team-modal');
    }

    function openJoinTeamModal() {
        document.getElementById('join-team-form').reset();
        openModal('join-team-modal');
    }

    window.openJoinProjectModal = function() {
        document.getElementById('join-project-form').reset();
        document.getElementById('join-project-password-group').style.display = 'none';
        document.getElementById('join-project-status').style.display = 'none';
        document.getElementById('join-project-submit-btn').disabled = true;
        openModal('join-project-modal');
    };

    let inviteCodeTimeout = null;
    window.checkProjectInviteCode = function() {
        const code = document.getElementById('join-project-code').value.trim();
        const statusEl = document.getElementById('join-project-status');
        const passGroup = document.getElementById('join-project-password-group');
        const btn = document.getElementById('join-project-submit-btn');
        const passInput = document.getElementById('join-project-password');

        if (inviteCodeTimeout) clearTimeout(inviteCodeTimeout);
        
        if (code.length < 5) {
            statusEl.style.display = 'none';
            passGroup.style.display = 'none';
            btn.disabled = true;
            passInput.removeAttribute('required');
            return;
        }

        inviteCodeTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/ProjectMemberApi/CheckInviteCode?code=${encodeURIComponent(code)}`);
                if (!res.ok) {
                    statusEl.innerText = "Geçersiz davet kodu.";
                    statusEl.style.color = "var(--color-danger)";
                    statusEl.style.display = 'block';
                    passGroup.style.display = 'none';
                    btn.disabled = true;
                    passInput.removeAttribute('required');
                    return;
                }
                const data = await res.json();
                
                if (data.isMember) {
                    statusEl.innerText = "Zaten bu projede yer alıyorsunuz.";
                    statusEl.style.color = "var(--color-warning, #f59e0b)";
                    statusEl.style.display = 'block';
                    passGroup.style.display = 'none';
                    btn.disabled = true;
                    passInput.removeAttribute('required');
                } else {
                    statusEl.innerText = "Proje bulundu.";
                    statusEl.style.color = "var(--color-success)";
                    statusEl.style.display = 'block';
                    btn.disabled = false;
                    
                    if (data.hasPassword) {
                        passGroup.style.display = 'block';
                        passInput.setAttribute('required', 'required');
                    } else {
                        passGroup.style.display = 'none';
                        passInput.removeAttribute('required');
                    }
                }
            } catch (error) {
                console.error(error);
            }
        }, 500);
    };

    window.handleJoinProjectSubmit = async function(event) {
        event.preventDefault();
        const code = document.getElementById('join-project-code').value.trim();
        const password = document.getElementById('join-project-password').value.trim();

        try {
            const res = await fetch("/api/ProjectMemberApi/Join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteCode: code, password: password })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Projeye katılım başarısız.");
            }

            const data = await res.json();
            showToast(data.message, "success");
            closeModal('join-project-modal');
            await loadSidebarTree();
            await loadHomeStatsAndGrid();
        } catch (error) {
            showToast(error.message, "danger");
        }
    };

    async function handleCreateTeamSubmit(event) {
        event.preventDefault();
        const name = document.getElementById('team-name').value.trim();
        const desc = document.getElementById('team-desc').value.trim();
        const departmentId = document.getElementById('team-department').value;
        const isOpen = document.getElementById('team-is-open').checked;
        const password = document.getElementById('team-password').value.trim();

        try {
            const payload = { 
                name: name, 
                description: desc, 
                isOpenToJoin: isOpen, 
                password: password,
                departmentId: departmentId ? parseInt(departmentId) : null
            };

            const res = await fetch("/api/teams/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Takım oluşturulamadı.");
            }
            const data = await res.json();
            showToast(`Takım başarıyla oluşturuldu. Davet Kodu: ${data.inviteCode}`, "success");
            closeModal('create-team-modal');
            await loadSidebarTree(); 
        } catch (error) {
            showToast(error.message, "danger");
        }
    }

    async function handleJoinTeamSubmit(event) {
        event.preventDefault();
        const teamIdStr = document.getElementById('join-team-id').value.trim();
        const inviteCode = document.getElementById('join-team-code').value.trim();
        const password = document.getElementById('join-team-password').value.trim();
        
        if (!teamIdStr && !inviteCode) {
            showToast("Lütfen Takım ID'sini veya Davet Kodunu girin.", "warning");
            return;
        }

        const teamId = teamIdStr ? parseInt(teamIdStr) : 0;

        try {
            const res = await fetch("/api/teams/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId: teamId, inviteCode: inviteCode, password: password })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Takıma katılım başarısız.");
            }

            const data = await res.json();
            if (data.requiresApproval) {
                showToast("Katılım isteğiniz Takım yöneticisine iletildi.", "success");
            } else {
                showToast("Takıma başarıyla katıldınız.", "success");
            }
            closeModal('join-team-modal');
            await loadSidebarTree(); 
        } catch (error) {
            showToast(error.message, "danger");
        }
    }

    // --- TEAM MANAGEMENT ---
    function switchManageTab(tab) {
        document.getElementById('manage-content-members').style.display = tab === 'members' ? 'block' : 'none';
        document.getElementById('manage-content-requests').style.display = tab === 'requests' ? 'block' : 'none';
        
        document.getElementById('tab-members').classList.toggle('tm-btn-primary', tab === 'members');
        document.getElementById('tab-members').classList.toggle('tm-btn-secondary', tab !== 'members');
        document.getElementById('tab-requests').classList.toggle('tm-btn-primary', tab === 'requests');
        document.getElementById('tab-requests').classList.toggle('tm-btn-secondary', tab !== 'requests');
    }

    async function openManageTeamModal(teamId) {
        document.getElementById('manage-team-id').value = teamId;
        switchManageTab('members');
        openModal('manage-team-modal');
        await loadTeamMembers(teamId);
        await loadTeamRequests(teamId);
    }

    async function loadTeamMembers(teamId) {
        const list = document.getElementById('members-list');
        list.innerHTML = 'Yükleniyor...';
        try {
            const res = await fetch(`/api/teams/${teamId}/members`);
            if (!res.ok) throw new Error();
            const members = await res.json();
            
            list.innerHTML = members.map(m => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:var(--radius-md);">
                    <div>
                        <div style="font-weight:600;">${escapeHtml(m.name)}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(m.email)}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <select class="form-control" style="width:120px; font-size:0.85rem;" onchange="updateTeamRole(${teamId}, ${m.userId}, this.value)" ${m.role === 'Owner' ? 'disabled' : ''}>
                            <option value="Member" ${m.role === 'Member' ? 'selected' : ''}>Üye</option>
                            <option value="Admin" ${m.role === 'Admin' ? 'selected' : ''}>Yönetici</option>
                            <option value="Owner" ${m.role === 'Owner' ? 'selected' : ''}>Kurucu (Devret)</option>
                        </select>
                        ${m.role !== 'Owner' ? `<button class="tm-btn-icon-only" style="color:var(--color-danger);" onclick="kickTeamMember(${teamId}, ${m.userId})" title="Üyeyi Çıkar">✕</button>` : ''}
                    </div>
                </div>
            `).join("");
        } catch (e) {
            list.innerHTML = 'Üyeler yüklenemedi.';
        }
    }

    async function loadTeamRequests(teamId) {
        const list = document.getElementById('requests-list');
        const badge = document.getElementById('requests-badge');
        list.innerHTML = 'Yükleniyor...';
        try {
            const res = await fetch(`/api/teams/${teamId}/requests`);
            if (!res.ok) throw new Error();
            const requests = await res.json();
            
            if (requests.length > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = requests.length;
            } else {
                badge.style.display = 'none';
            }

            if (requests.length === 0) {
                list.innerHTML = '<div style="color:var(--text-muted); padding:12px;">Bekleyen katılım isteği bulunmuyor.</div>';
                return;
            }

            list.innerHTML = requests.map(r => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:var(--radius-md);">
                    <div>
                        <div style="font-weight:600;">${escapeHtml(r.name)}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(r.email)}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="tm-btn tm-btn-primary" style="padding:4px 12px; font-size:0.8rem;" onclick="respondTeamRequest(${teamId}, ${r.id}, 'Approve')">Onayla</button>
                        <button class="tm-btn tm-btn-danger" style="padding:4px 12px; font-size:0.8rem;" onclick="respondTeamRequest(${teamId}, ${r.id}, 'Reject')">Reddet</button>
                    </div>
                </div>
            `).join("");
        } catch (e) {
            list.innerHTML = 'İstekler yüklenemedi.';
        }
    }

    async function updateTeamRole(teamId, userId, role) {
        if (role === 'Owner') {
            if (!confirm("Takım sahipliğini devretmek istediğinizden emin misiniz? Bu işlemi geri alamazsınız.")) {
                loadTeamMembers(teamId);
                return;
            }
        }
        try {
            const res = await fetch(`/api/teams/${teamId}/members/${userId}/role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: role })
            });
            if (!res.ok) throw new Error();
            showToast("Üye rolü güncellendi.", "success");
            await loadTeamMembers(teamId);
            if (role === 'Owner') {
                closeModal('manage-team-modal');
                await loadSidebarTree();
            }
        } catch (e) {
            showToast("Rol güncellenirken hata oluştu veya yetkiniz yok.", "danger");
            loadTeamMembers(teamId);
        }
    }

    async function kickTeamMember(teamId, userId) {
        if (!confirm("Bu üyeyi takımdan çıkarmak istediğinizden emin misiniz?")) return;
        try {
            const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            showToast("Üye takımdan çıkarıldı.", "success");
            await loadTeamMembers(teamId);
            await loadSidebarTree();
        } catch (e) {
            showToast("Üye çıkarılırken hata oluştu.", "danger");
        }
    }

    async function respondTeamRequest(teamId, requestId, action) {
        try {
            const res = await fetch(`/api/teams/${teamId}/requests/${requestId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: action })
            });
            if (!res.ok) throw new Error();
            showToast(action === 'Approve' ? "İstek onaylandı." : "İstek reddedildi.", "success");
            await loadTeamRequests(teamId);
            if (action === 'Approve') {
                await loadTeamMembers(teamId);
                await loadSidebarTree();
            }
        } catch (e) {
            showToast("İşlem sırasında hata oluştu.", "danger");
        }
    }





