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

    window.showCalendarView = showCalendarView;
