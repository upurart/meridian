    function applyGridFilters() {
        if (!gridProjectsData) return;

        const btnClear = document.getElementById("btn-clear-filters");
        if (btnClear) {
            btnClear.disabled = (gridSearchQuery === "" && gridFilterStatus === "all" && gridSortStatus === "none");
        }

        let filtered = [...gridProjectsData];
        

        // 1. Arama sorgusuna göre filtrele
        if (gridSearchQuery) {
            filtered = filtered.filter(p =>
                (p.title && p.title.toLowerCase().includes(gridSearchQuery)) ||
                (p.name && p.name.toLowerCase().includes(gridSearchQuery)) ||
                (p.description && p.description.toLowerCase().includes(gridSearchQuery))
            );
        }

        if (gridSortStatus === 'none') {
            filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || a.id - b.id);
        } else {
            filtered.sort((a, b) => {
                if (gridSortStatus === 'closest-deadline') {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                } else if (gridSortStatus === 'farthest-deadline') {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(b.deadline) - new Date(a.deadline);
                } else if (gridSortStatus === 'highest-completion') {
                    return (b.progress || 0) - (a.progress || 0);
                } else if (gridSortStatus === 'lowest-completion') {
                    return (a.progress || 0) - (b.progress || 0);
                }
                return 0;
            });
        }

        const grid = document.getElementById("projects-grid");
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Sonuç bulunamadı.</p>
                </div>
            `;
            return;
        }

        if (currentProjectViewMode === 'list') {
            grid.style.display = "flex";
            grid.style.flexDirection = "column";
            grid.style.gap = "8px";
        } else if (currentProjectViewMode === 'compact') {
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(250px, 1fr))";
            grid.style.gap = "20px";
        } else {
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";
            grid.style.gap = "24px";
        }

        grid.innerHTML = filtered.map(item => {
            // Workspace Card Render
            const w = item;
            if (currentProjectViewMode === 'list') {
                return `
                    <div class="tm-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; border-radius: var(--radius-md); gap: 16px; margin: 0;" onclick="loadWorkspaceView(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}')">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex: 2; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="bi bi-briefcase text-primary"></i>
                                <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(w.name)}</div>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0;">${w.projectsCount} Proje</div>
                        </div>
                        
                        <div style="flex: 4; padding: 0 24px; color: var(--text-secondary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
                            ${escapeHtml(w.description || 'Açıklama yok')}
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 150px; justify-content: flex-end;">
                            <span class="badge" style="background-color: var(--bg-surface-hover); color: var(--text-secondary); font-size: 0.75rem;">${w.rolePreset}</span>
                            ${w.rolePreset === 'Owner' ? `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); deleteWorkspace(${w.id})" title="Sil"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                `;
            }

            if (currentProjectViewMode === 'compact') {
                return `
                    <div class="tm-card" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0;" onclick="loadWorkspaceView(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}')">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                            <i class="bi bi-briefcase text-primary"></i>
                            <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(w.name)}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                            <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">${w.projectsCount} Proje</div>
                            ${w.rolePreset === 'Owner' ? `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); deleteWorkspace(${w.id})" title="Sil" style="padding: 2px 6px;"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="tm-card" onclick="loadWorkspaceView(${w.id}, '${escapeHtml(w.name).replace(/'/g, "\\'")}')" style="cursor: pointer; display: flex; flex-direction: column; height: 100%;">
                    <div class="tm-card-title" style="display: flex; align-items: center; gap: 8px;">
                        <i class="bi bi-briefcase text-primary"></i> ${escapeHtml(w.name)}
                    </div>
                    <div class="tm-card-desc" style="flex: 1; min-height: 40px; margin-bottom: 12px;">${escapeHtml(truncateString(w.description || 'Açıklama yok', 100))}</div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: auto;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                            <i class="bi bi-kanban"></i> ${w.projectsCount} Proje
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="badge" style="background-color: var(--bg-surface-hover); color: var(--text-secondary); font-size: 0.75rem;">
                                ${w.rolePreset}
                            </span>
                            ${w.rolePreset === 'Owner' ? `<button class="btn btn-icon btn-danger-soft btn-sm" onclick="event.stopPropagation(); deleteWorkspace(${w.id})" title="Sil"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function countWeeklyCompletedTasks(project, startOfWeek) {
        let count = 0;
        
        (project.tasks || []).forEach(t => {
            if (t.isCompleted && t.completedAt && new Date(t.completedAt) >= startOfWeek) count++;
        });

        (project.mainGoals || []).forEach(mg => {
            (mg.tasks || []).forEach(t => {
                if (t.isCompleted && t.completedAt && new Date(t.completedAt) >= startOfWeek) count++;
            });

            (mg.subGoals || []).forEach(sg => {
                (sg.tasks || []).forEach(t => {
                    if (t.isCompleted && t.completedAt && new Date(t.completedAt) >= startOfWeek) count++;
                });
            });
        });
        
        return count;
    }

    async function loadHomeStatsAndGrid() {
        try {
            // Devamlı dashboard ağacından istatistik kartları için veri çek
            const statsRes = await fetch("/api/dashboard/tree");
            let projects = await statsRes.json();
            
            if (typeof activeTeamId !== 'undefined' && activeTeamId) {
                projects = projects.filter(p => p.teamGroupId === activeTeamId);
            } else {
                projects = projects.filter(p => !p.teamGroupId);
            }

            // İstatistikleri hesapla
            let totalProjects = projects.length;

            // Izgara/grid için workspaceleri çek
            const wsRes = await fetch("/api/WorkspaceApi");
            const workspaces = await wsRes.json();
            
            if (typeof activeTeamId !== 'undefined' && activeTeamId) {
                gridProjectsData = workspaces.filter(w => w.teamGroupId === activeTeamId);
            } else {
                gridProjectsData = workspaces.filter(w => !w.teamGroupId);
            }
            
            applyGridFilters();

        } catch (err) {
            console.error(err);
            showToast("Dashboard verileri yüklenirken hata oluştu.", "danger");
        }
    }

    function showWorkspacesDashboard(skipRailUpdate = false) {
        activeTeamId = null;
        activeTeamName = null;
        activeWorkspaceId = null;
        activeWorkspaceName = null;

        updateBreadcrumb(null, null, null);

        document.getElementById("home-view").style.display = "none";
        const calView = document.getElementById("calendar-view");
        if (calView) calView.style.display = "none";
        document.getElementById("workspaces-dashboard-view").style.display = "block";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";

        document.getElementById("home-view-title").innerText = "Kişisel Çalışma Alanları";
        const subEl = document.getElementById("home-view-subtitle");
        if (subEl) subEl.innerText = "Kişisel çalışma alanlarınızı ve projelerinizi buradan yönetin.";
        
        document.getElementById('btn-create-workspace-home').style.display = 'inline-block';
        document.getElementById('btn-create-project-home').style.display = 'none';
        document.getElementById('btn-join-project-home').style.display = 'none';
        
        document.getElementById('project-filters-group').style.display = 'none';
        document.getElementById('grid-search').placeholder = 'Çalışma alanı ara...';

        loadSidebarTree();
        loadHomeStatsAndGrid();
        if (!skipRailUpdate) {
            updateRailActive('rail-btn-workspaces');
            collapseSidebar();
        }
    }

    function getGreetingsPool(nameStr) {
        const n = nameStr ? ` ${nameStr}` : "";
        const nComma = nameStr ? ` ${nameStr},` : "";
        
        const general = [
            `Hoş geldin${n}.`,
            `Hedeflerine odaklanmanın tam zamanı${n}.`,
            `Nasılsın${n}?`,
            `İyi günler,${n}.`,
        ];
        
        const morning = [
            `Günaydın${n}! Verimli bir gün geçirmeni dileriz.`,
            `Erken kalkan yol alır, harika bir sabaha hoş geldin${n}.`,
            `Güne enerjik başla${nComma} projelerin seni bekliyor.`,
            `Sabah kahven hazırsa üretmeye başlayabiliriz${n}.`
        ];
        
        const noon = [
            `Tünaydın${n}! Günü yarıladık bile.`,
            `Öğle molası bittiyse çalışmalara dönme vakti${n}.`,
            `Günün bu saatinde odaklanmak harikalar yaratır${n}.`,
            `Enerjini yüksek tut${nComma} projelerini başarıyla tamamla.`
        ];
        
        const evening = [
            `İyi akşamlar${n}. Bugün harika işler başardın.`,
            `Günün son saatleri, kalan görevlerini toparla${n}.`,
            `Gece sessizliği, en iyi fikirlerin doğduğu zamandır${n}.`,
            `Yarın için planlarını yap${nComma} huzurla dinlen.`
        ];

        return { general, morning, noon, evening };
    }
    
    function updateGreeting() {
        const greetingEl = document.getElementById("home-greeting-msg");
        if (!greetingEl) return;
        
        const name = window.currentUserGivenName || "";
        const pools = getGreetingsPool(name);
        
        let pool = [...pools.general];
        const hour = new Date().getHours();
        
        if (hour >= 5 && hour < 12) {
            pool = pool.concat(pools.morning);
        } else if (hour >= 12 && hour < 18) {
            pool = pool.concat(pools.noon);
        } else {
            pool = pool.concat(pools.evening);
        }
        
        const randomIndex = Math.floor(Math.random() * pool.length);
        greetingEl.innerText = pool[randomIndex];
    }

    let plannerCalendar = null;
    
    function initPlannerCalendar() {
        const calendarEl = document.getElementById('planner-calendar');
        if (!calendarEl) return;
        
        if (!plannerCalendar) {
            plannerCalendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'timeGridWeek',
                locale: 'tr', 
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'timeGridWeek,timeGridDay'
                },
                dayHeaderFormat: { weekday: 'long', month: 'long', day: 'numeric', omitCommas: true },
                slotMinTime: '06:00:00',
                slotMaxTime: '24:00:00',
                slotDuration: '01:00:00',
                slotLabelInterval: '01:00',
                slotLabelFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    omitZeroMinute: false,
                    meridiem: false
                },
                allDaySlot: false,
                editable: true,
                selectable: false, // Etkinlik ekleme şimdilik kapalı
                height: '100%',
                nowIndicator: true,
                slotEventOverlap: false,
                
                eventDrop: async function(info) { await handleEventCalendarUpdate(info); },
                eventResize: async function(info) { await handleEventCalendarUpdate(info); },
                
                eventContent: function(arg) {
                    const title = arg.event.title;
                    const desc = arg.event.extendedProps.description || '';
                    
                    const startTime = arg.event.start ? arg.event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    const endTime = arg.event.end ? arg.event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    
                    let html = `
                        <div class="fc-custom-event">
                            ${startTime ? `<div class="fc-custom-time-top">${startTime}</div>` : ''}
                            <div class="fc-custom-title">${title}</div>
                            ${desc ? `<div class="fc-custom-desc">${desc}</div>` : ''}
                            ${endTime ? `<div class="fc-custom-time-bottom">${endTime}</div>` : ''}
                        </div>
                    `;
                    return { html: html };
                },
                
                eventClick: function(info) {
                    // Çift tıklama algılayıcısı
                    if (window.fcClickTimer === undefined) window.fcClickTimer = null;
                    if (window.fcClickTimer === null) {
                        window.fcClickTimer = setTimeout(() => {
                            window.fcClickTimer = null;
                            // Tek tıklama işlemi buraya eklenebilir
                        }, 300);
                    } else {
                        clearTimeout(window.fcClickTimer);
                        window.fcClickTimer = null;
                        
                        // Çift Tıklandı!
                        const props = info.event.extendedProps;
                        if (props.type === 'project') {
                            const projectData = {
                                id: props.projectId,
                                title: info.event.title,
                                description: props.description,
                                startDate: props.startDate,
                                deadline: props.deadline
                            };
                            if (typeof openProjectModal === 'function') {
                                openProjectModal(projectData);
                            }
                        } else if (props.type === 'calendar') {
                            if (typeof openCalendarEventModal === 'function') {
                                openCalendarEventModal({
                                    id: props.calendarEventId,
                                    title: info.event.title,
                                    description: props.description,
                                    startDate: props.startDate,
                                    endDate: props.endDate,
                                    color: info.event.backgroundColor
                                });
                            }
                        }
                    }
                },

                events: async function(fetchInfo, successCallback, failureCallback) {
                    try {
                        const responseProjects = await fetch('/api/dashboard/tree');
                        const responseCalendar = await fetch('/api/calendar');
                        
                        if (!responseProjects.ok || !responseCalendar.ok) throw new Error("Veriler getirilemedi");
                        
                        const projectData = await responseProjects.json();
                        const calendarData = await responseCalendar.json();
                        
                        const calendarEvents = [];
                        
                        projectData.forEach(p => {
                            if (p.deadline || p.startDate) {
                                let startVal = p.startDate || p.deadline;
                                let endVal = p.deadline;
                                // Eğer sadece start varsa, end'e +1 saat ekle
                                if (!p.deadline && p.startDate) {
                                    endVal = new Date(new Date(p.startDate).getTime() + 60 * 60 * 1000).toISOString();
                                }
                                
                                calendarEvents.push({
                                    id: 'proj_' + p.id,
                                    title: p.title,
                                    start: startVal,
                                    end: endVal,
                                    allDay: false, 
                                    extendedProps: {
                                        type: 'project',
                                        projectId: p.id,
                                        description: p.description,
                                        startDate: p.startDate,
                                        deadline: p.deadline
                                    }
                                });
                            }
                        });

                        calendarData.forEach(ev => {
                            calendarEvents.push({
                                id: 'calev_' + ev.id,
                                title: ev.title,
                                start: ev.startDate,
                                end: ev.endDate,
                                color: ev.color || '#3788d8',
                                allDay: false,
                                extendedProps: {
                                    type: 'calendar',
                                    calendarEventId: ev.id,
                                    description: ev.description,
                                    startDate: ev.startDate,
                                    endDate: ev.endDate
                                }
                            });
                        });
                        
                        successCallback(calendarEvents);
                    } catch (error) {
                        console.error(error);
                        failureCallback(error);
                    }
                }
            });
            plannerCalendar.render();
        } else {
            // Need a slight timeout to let DOM unhide completely before resizing
            setTimeout(() => {
                plannerCalendar.render();
                plannerCalendar.refetchEvents(); // Önemli: Yeni eklenen kartların düşmesi için
            }, 10);
        }
    }

    async function handleEventCalendarUpdate(info) {
        const ev = info.event;
        const props = ev.extendedProps;
        let startVal = ev.start ? new Date(ev.start.getTime() - ev.start.getTimezoneOffset() * 60000).toISOString().substring(0, 16) : null;
        let endVal = ev.end ? new Date(ev.end.getTime() - ev.end.getTimezoneOffset() * 60000).toISOString().substring(0, 16) : null;

        if (props.type === 'project') {
            const payload = {
                title: ev.title,
                description: props.description || "",
                startDate: startVal,
                deadline: endVal || startVal
            };
            try {
                const res = await fetch(`/api/dashboard/project/${props.projectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    ev.setExtendedProp('startDate', startVal);
                    ev.setExtendedProp('deadline', endVal || startVal);
                    if (typeof triggerGlobalRefresh === 'function') triggerGlobalRefresh();
                } else {
                    info.revert();
                }
            } catch(e) {
                console.error(e);
                info.revert();
            }
        } else if (props.type === 'calendar') {
            const payload = {
                title: ev.title,
                description: props.description || "",
                startDate: startVal,
                endDate: endVal || startVal,
                color: ev.backgroundColor
            };
            try {
                const res = await fetch(`/api/calendar/${props.calendarEventId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    ev.setExtendedProp('startDate', startVal);
                    ev.setExtendedProp('endDate', endVal || startVal);
                } else {
                    info.revert();
                }
            } catch(e) {
                console.error(e);
                info.revert();
            }
        }
    }

    function showDashboardHome(skipRailUpdate = false) {
        activeTeamId = null;
        activeTeamName = null;
        activeWorkspaceId = null;
        activeWorkspaceName = null;
        
        updateBreadcrumb(null, null, null);
        
        updateGreeting();

        document.getElementById("home-view").style.display = "block";
        const calView = document.getElementById("calendar-view");
        if (calView) calView.style.display = "none";
        
        document.getElementById("workspaces-dashboard-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";

        if (!skipRailUpdate) {
            updateRailActive('rail-btn-home');
            collapseSidebar();
        }
    }

    function showCalendarView(skipRailUpdate = false) {
        activeTeamId = null;
        activeTeamName = null;
        activeWorkspaceId = null;
        activeWorkspaceName = null;
        
        updateBreadcrumb(null, "Takvim", null);
        
        // Since we are showing calendar, hide everything else
        document.getElementById("home-view").style.display = "none";
        document.getElementById("workspaces-dashboard-view").style.display = "none";
        document.getElementById("workspace-view").style.display = "none";
        document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "none";
        document.getElementById("activities-view").style.display = "none";
        document.getElementById("teams-dashboard-view").style.display = "none";
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";

        const calView = document.getElementById("calendar-view");
        if (calView) calView.style.display = "flex";

        initPlannerCalendar();

        if (!skipRailUpdate) {
            updateRailActive('rail-btn-calendar');
            collapseSidebar();
        }
    }

    window.showDashboardHome = showDashboardHome;
    window.showCalendarView = showCalendarView;
    window.showWorkspacesDashboard = showWorkspacesDashboard;
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
            
            const wsRes = await fetch("/api/WorkspaceApi");
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
        if(document.getElementById("workspaces-dashboard-view")) document.getElementById("workspaces-dashboard-view").style.display = "none";
        if(document.getElementById("workspace-view")) document.getElementById("workspace-view").style.display = "none";
        if(document.getElementById("teams-dashboard-view")) document.getElementById("teams-dashboard-view").style.display = "none";
        if(document.getElementById("deleted-view")) document.getElementById("deleted-view").style.display = "none";
        if(document.getElementById("teams-dashboard-view")) document.getElementById("teams-dashboard-view").style.display = "none";
        
        const wsProjView = document.getElementById("workspace-projects-view");
        if(wsProjView) wsProjView.style.display = "none";

        if(document.getElementById("profile-page-view")) document.getElementById("profile-page-view").style.display = "block";

        collapseSidebar();
        
        await loadProfilePageData();
    }

    let searchTimeout = null;
    let currentSearchState = 'recent';
    let cmdSelectedIndex = -1;
    let cmdOriginalQuery = '';
    
    let allCmdTeams = [];
    let allCmdWorkspaces = [];
    let isCmdDataFetched = false;

    async function prefetchCommandData() {
        if (isCmdDataFetched) return;
        try {
            const [teamRes, wsRes] = await Promise.all([
                fetch('/api/teams/teams'),
                fetch('/api/WorkspaceApi')
            ]);
            if (teamRes.ok) allCmdTeams = await teamRes.json();
            if (wsRes.ok) allCmdWorkspaces = await wsRes.json();
            isCmdDataFetched = true;
        } catch (e) { console.error("Komut verileri alınamadı", e); }
    }

    window.handleHomeSearchKeydown = function(e) {
        const input = document.getElementById('home-search-input');
        const dropdown = document.getElementById('command-suggestions-dropdown');
        if (!input) return;

        const isDropdownVisible = dropdown && dropdown.style.display === 'flex';
        const items = isDropdownVisible ? dropdown.querySelectorAll('.cmd-suggestion-item') : [];

        if (e.key === 'ArrowDown') {
            if (!isDropdownVisible || items.length === 0) return;
            e.preventDefault();
            if (cmdSelectedIndex === -1) cmdOriginalQuery = input.value;
            cmdSelectedIndex++;
            if (cmdSelectedIndex >= items.length) cmdSelectedIndex = -1;
            updateCmdSelection(items, input);
        } else if (e.key === 'ArrowUp') {
            if (!isDropdownVisible || items.length === 0) return;
            e.preventDefault();
            if (cmdSelectedIndex === -1) {
                cmdOriginalQuery = input.value;
                cmdSelectedIndex = items.length - 1;
            } else {
                cmdSelectedIndex--;
            }
            updateCmdSelection(items, input);
        } else if (e.key === 'Tab') {
            if (!isDropdownVisible || items.length === 0) return;
            e.preventDefault();
            const idx = cmdSelectedIndex >= 0 ? cmdSelectedIndex : 0;
            const fill = items[idx].getAttribute('data-fill');
            if (fill) {
                input.value = fill + ' ';
                window.handleHomeSearch(input.value, false);
            }
        } else if (e.key === 'Enter') {
            const query = input.value.trim();
            if (query.startsWith('/')) {
                e.preventDefault();
                if (isDropdownVisible && cmdSelectedIndex >= 0 && cmdSelectedIndex < items.length) {
                    items[cmdSelectedIndex].click();
                } else if (isDropdownVisible && items.length > 0) {
                    items[0].click();
                } else {
                    window.executeSlashCommand(query);
                }
            }
        }
    };
    
    function updateCmdSelection(items, input) {
        if (cmdSelectedIndex === -1) {
            input.value = cmdOriginalQuery;
        }
        items.forEach((item, index) => {
            if (index === cmdSelectedIndex) {
                item.classList.add('active');
                const fill = item.getAttribute('data-fill');
                if (fill) input.value = fill;
            } else {
                item.classList.remove('active');
            }
        });
    }

    window.executeSlashCommand = function(cmd) {
        const query = cmd.trim();
        const parts = query.split(' ');
        const main = parts[0];
        const arg = parts.length > 1 ? parts[1] : null;

        if (main === '/theme' && arg) {
            if (typeof setTheme === 'function') setTheme(arg);
            if (typeof localStorage !== 'undefined') localStorage.setItem('theme', arg);
            document.documentElement.setAttribute('data-theme', arg);
        } else if (main === '/goto') {
            if (query.startsWith('/goto teams ')) {
                const tName = query.substring('/goto teams '.length).trim();
                if (tName === '') {
                    if (typeof switchSidebarPanel === 'function') switchSidebarPanel('teams');
                } else {
                    const team = allCmdTeams.find(t => t.name.toLowerCase() === tName.toLowerCase());
                    if (team && typeof loadTeamWorkspace === 'function') {
                        loadTeamWorkspace(team.id, team.name);
                    }
                }
            } else if (query.startsWith('/goto workspaces ')) {
                const wsStr = query.substring('/goto workspaces '.length).trim();
                if (wsStr === '') {
                    if (typeof switchSidebarPanel === 'function') switchSidebarPanel('workspaces');
                } else {
                    const ws = allCmdWorkspaces.find(w => {
                        const tName = w.teamGroupId ? (allCmdTeams.find(t => t.id === w.teamGroupId)?.name || 'Bilinmeyen') : 'Kişisel';
                        const full = (tName + ' ' + w.name).toLowerCase();
                        return full === wsStr.toLowerCase();
                    });
                    if (ws && typeof loadWorkspaceView === 'function') {
                        loadWorkspaceView(ws.id, ws.name);
                    }
                }
            } else if (arg) {
                const viewMap = {
                    'home': 'home',
                    'calendar': 'calendar',
                    'workspaces': 'workspaces',
                    'teams': 'teams',
                    'trash': 'trash',
                    'profile': 'profile'
                };
                if (viewMap[arg]) {
                    if (typeof switchSidebarPanel === 'function') switchSidebarPanel(viewMap[arg]);
                }
            }
        }
        
        // Hide dropdown and clear search
        const dropdown = document.getElementById('command-suggestions-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        const input = document.getElementById('home-search-input');
        if (input) {
            input.value = '';
            input.blur();
        }
        window.handleHomeSearch('', false);
    };

    window.handleHomeSearch = async function(query, isFocus = false) {
        clearTimeout(searchTimeout);
        cmdSelectedIndex = -1; // Reset selection on input
        
        const dropdown = document.getElementById('command-suggestions-dropdown');
        if (query && query.startsWith('/')) {
            await prefetchCommandData();
            if (dropdown) {
                dropdown.style.display = 'flex';
                dropdown.innerHTML = '';
                
                const q = query.trim().toLowerCase();
                let html = '';
                
                if (q === '/' || q === '/t' || q === '/g' || q === '/th' || q === '/go') {
                    // Show main commands
                    if ('/theme'.startsWith(q)) {
                        html += `<div class="cmd-suggestion-item" data-fill="/theme" onclick="document.getElementById('home-search-input').value = '/theme '; window.handleHomeSearch('/theme '); document.getElementById('home-search-input').focus();"><i class="bi bi-palette"></i><span class="cmd-name">/theme</span><span class="cmd-desc">Temayı değiştirir</span></div>`;
                    }
                    if ('/goto'.startsWith(q)) {
                        html += `<div class="cmd-suggestion-item" data-fill="/goto" onclick="document.getElementById('home-search-input').value = '/goto '; window.handleHomeSearch('/goto '); document.getElementById('home-search-input').focus();"><i class="bi bi-box-arrow-in-right"></i><span class="cmd-name">/goto</span><span class="cmd-desc">Bir sekmeye hızlı geçiş yapar</span></div>`;
                    }
                } else if (q.startsWith('/theme')) {
                    const arg = q.split(' ')[1] || '';
                    if ('light'.startsWith(arg)) {
                        html += `<div class="cmd-suggestion-item" data-fill="/theme light" onclick="window.executeSlashCommand('/theme light')"><i class="bi bi-sun"></i><span class="cmd-name">light</span><span class="cmd-desc">Açık tema</span></div>`;
                    }
                    if ('dark'.startsWith(arg)) {
                        html += `<div class="cmd-suggestion-item" data-fill="/theme dark" onclick="window.executeSlashCommand('/theme dark')"><i class="bi bi-moon-stars"></i><span class="cmd-name">dark</span><span class="cmd-desc">Koyu tema</span></div>`;
                    }
                } else if (q.startsWith('/goto teams ')) {
                    const arg = query.substring('/goto teams '.length).toLowerCase();
                    const matchedTeams = allCmdTeams.filter(t => t.name.toLowerCase().includes(arg));
                    matchedTeams.forEach(t => {
                        html += `<div class="cmd-suggestion-item" data-fill="/goto teams ${t.name}" onclick="window.executeSlashCommand('/goto teams ${t.name}')"><i class="bi bi-people"></i><span class="cmd-name">${t.name}</span><span class="cmd-desc">Takım Görünümüne Git</span></div>`;
                    });
                } else if (q.startsWith('/goto workspaces ')) {
                    const arg = query.substring('/goto workspaces '.length).toLowerCase();
                    allCmdWorkspaces.forEach(w => {
                        const tName = w.teamGroupId ? (allCmdTeams.find(t => t.id === w.teamGroupId)?.name || 'Bilinmeyen') : 'Kişisel';
                        const fullStr = tName + ' ' + w.name;
                        if (fullStr.toLowerCase().includes(arg)) {
                            html += `<div class="cmd-suggestion-item" data-fill="/goto workspaces ${fullStr}" onclick="window.executeSlashCommand('/goto workspaces ${fullStr}')"><i class="bi bi-folder2-open"></i><span class="cmd-name">${fullStr}</span><span class="cmd-desc">Çalışma Alanına Git</span></div>`;
                        }
                    });
                } else if (q.startsWith('/goto')) {
                    const arg = q.split(' ')[1] || '';
                    const views = [
                        { name: 'home', icon: 'bi-house', desc: 'Ana Sayfa' },
                        { name: 'calendar', icon: 'bi-calendar4-week', desc: 'Takvim' },
                        { name: 'workspaces', icon: 'bi-folder2-open', desc: 'Çalışma Alanları' },
                        { name: 'teams', icon: 'bi-people', desc: 'Takımlar' },
                        { name: 'trash', icon: 'bi-trash', desc: 'Çöp Kutusu' },
                        { name: 'profile', icon: 'bi-person', desc: 'Profil' }
                    ];
                    views.forEach(v => {
                        if (v.name.startsWith(arg)) {
                            const fillTarget = `/goto ${v.name}`;
                            const clickAction = `window.executeSlashCommand('/goto ${v.name}')`;
                            html += `<div class="cmd-suggestion-item" data-fill="${fillTarget}" onclick="${clickAction}"><i class="bi ${v.icon}"></i><span class="cmd-name">${v.name}</span><span class="cmd-desc">${v.desc}</span></div>`;
                        }
                    });
                }
                
                if (html === '') {
                    html = '<div style="padding: 12px 16px; color: var(--text-muted); font-size: 0.9rem;">Bilinmeyen komut veya argüman... Yükleniyor olabilir.</div>';
                }
                dropdown.innerHTML = html;
            }
            return; // Komut yazılırken normal aramayı çalıştırma
        } else {
            if (dropdown) dropdown.style.display = 'none';
        }

        const intendedState = (query && query.trim().length > 0) ? 'search' : 'recent';
        
        if (isFocus) {
            currentSearchState = intendedState;
            const titleEl = document.getElementById("recent-projects-title");
            if (intendedState === 'search') {
                if (titleEl) titleEl.innerText = "Arama Sonuçları";
                window.fetchRecentProjects(query.trim(), true);
            } else {
                if (titleEl) titleEl.innerText = "Son Çalışılan Projeler";
                window.fetchRecentProjects(null, true);
            }
            return;
        }

        searchTimeout = setTimeout(async () => {
            const container = document.getElementById('recent-projects-container');
            const titleEl = document.getElementById("recent-projects-title");
            
            if (currentSearchState !== intendedState) {
                // Mod değişimi var, animasyonlu fade-out yap
                container.style.opacity = '0';
                await new Promise(r => setTimeout(r, 300));
                
                if (intendedState === 'search') {
                    if (titleEl) titleEl.innerText = "Arama Sonuçları";
                    await window.fetchRecentProjects(query.trim(), true);
                } else {
                    if (titleEl) titleEl.innerText = "Son Çalışılan Projeler";
                    await window.fetchRecentProjects(null, true);
                }
                
                currentSearchState = intendedState;
                container.style.opacity = '1';
            } else {
                // Mod aynı (örneğin sadece arama sorgusu değişti), fade-out yapmadan arka planda sessizce güncelle
                if (intendedState === 'search') {
                    await window.fetchRecentProjects(query.trim(), false);
                } else {
                    await window.fetchRecentProjects(null, false);
                }
            }
        }, 200);
    };

    window.fetchRecentProjects = async function(query = null, showLoadingText = true) {
        const gridEl = document.getElementById("recent-projects-grid");
        if (!gridEl) return;
        
        try {
            if (showLoadingText) {
                gridEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; grid-column: span 5; text-align: center;">Yükleniyor...</div>';
            }
            
            let url = "/api/dashboard/recent-projects";
            const filterVal = document.getElementById("home-search-filter") ? document.getElementById("home-search-filter").value : 'all';
            
            if (query) {
                url = `/api/dashboard/search?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filterVal)}`;
            }
            
            const res = await fetch(url);
            if (!res.ok) throw new Error("Ağ hatası");
            const data = await res.json();
            
            if (data.length === 0) {
                gridEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem; grid-column: span 5; text-align: center;">${query ? 'Aradığınız kriterlere uygun sonuç bulunamadı.' : 'Yakın zamanda çalışılan proje bulunamadı.'}</div>`;
                return;
            }
            
            let html = "";
            data.forEach(p => {
                const desc = p.description ? truncateString(p.description, 90) : "Açıklama yok.";
                
                if (p.type === 'workspace') {
                    html += `
                    <div class="tm-card" style="display: flex; flex-direction: column; width: 100%; height: 180px; box-sizing: border-box; padding: 16px; cursor: pointer; margin: 0;" onclick="switchSidebarPanel('workspaces'); if(typeof loadWorkspaceView === 'function') loadWorkspaceView(${p.id}, '${escapeHtml(p.title)}');">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem; flex: 1; margin-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="bi bi-grid" style="margin-right: 6px; color: var(--color-primary);"></i>${escapeHtml(p.title)}</div>
                            <div style="font-size: 0.7rem; padding: 2px 6px; background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); border-radius: 4px; font-weight: 600;">ÇALIŞMA ALANI</div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${escapeHtml(desc)}</div>
                    </div>
                    `;
                } else if (p.type === 'team') {
                    html += `
                    <div class="tm-card" style="display: flex; flex-direction: column; width: 100%; height: 180px; box-sizing: border-box; padding: 16px; cursor: pointer; margin: 0;" onclick="switchSidebarPanel('teams'); if(typeof loadTeamWorkspace === 'function') loadTeamWorkspace(${p.id}, '${escapeHtml(p.title)}');">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem; flex: 1; margin-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="bi bi-diagram-3" style="margin-right: 6px; color: var(--color-success);"></i>${escapeHtml(p.title)}</div>
                            <div style="font-size: 0.7rem; padding: 2px 6px; background: rgba(var(--color-success-rgb), 0.1); color: var(--color-success); border-radius: 4px; font-weight: 600;">TAKIM</div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${escapeHtml(desc)}</div>
                    </div>
                    `;
                } else {
                    const prog = Math.round(p.progress || 0);
                    html += `
                    <div class="tm-card" style="display: flex; flex-direction: column; width: 100%; height: 180px; box-sizing: border-box; padding: 16px; cursor: pointer; margin: 0;" onclick="loadProjectWorkspace(${p.id})">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem; flex: 1; margin-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.title)}</div>
                            <div style="font-size: 0.85rem; font-weight: 600; color: ${prog === 100 ? 'var(--color-success)' : 'var(--color-primary)'};">%${prog}</div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${escapeHtml(desc)}</div>
                        
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border-color); opacity: 0.7;">
                            <i class="bi bi-diagram-3"></i> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%;">${escapeHtml(p.teamGroupName)}</span> <span style="margin: 0 2px; color: var(--border-color);">\\</span> <i class="bi bi-grid"></i> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%;">${escapeHtml(p.workspaceName)}</span>
                        </div>
                    </div>
                    `;
                }
            });
            gridEl.innerHTML = html;
        } catch (e) {
            console.error("Projeler yüklenemedi", e);
            gridEl.innerHTML = '<div style="color: var(--color-danger); font-size: 0.9rem; grid-column: span 5; text-align: center;">Yükleme sırasında bir hata oluştu.</div>';
        }
    }

    window.showProfilePage = showProfilePage;
