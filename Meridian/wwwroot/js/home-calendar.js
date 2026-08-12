    let plannerCalendar = null;
    
    // --- Now Indicator Dinamik Saat Güncelleyici ve Tüm Günlere Çizgi ---
    function updateNowIndicatorTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.body.style.setProperty('--current-time-str', `"${timeStr}"`);
        
        // Orijinal çizginin top pozisyonunu al
        const originalLine = document.querySelector('.fc-timegrid-now-indicator-line, .fc-now-indicator-line');
        if (originalLine) {
            const topVal = originalLine.style.top;
            
            // Tüm grid kolonlarını gez (Sadece zaman çizelgesi kolonlarını al)
            const cols = document.querySelectorAll('td.fc-timegrid-col');
            cols.forEach(col => {
                // Bugünün kolonuysa orijinal çizgi var, ekleme yapma
                if (col.classList.contains('fc-day-today')) return;
                
                // Diğer günler için custom çizgiyi bul veya oluştur
                let customLine = col.querySelector('.custom-now-line');
                if (!customLine) {
                    // .fc-timegrid-col-frame veya bg içine ekleyebiliriz
                    const frame = col.querySelector('.fc-timegrid-col-frame') || col;
                    customLine = document.createElement('div');
                    customLine.className = 'custom-now-line';
                    frame.appendChild(customLine);
                }
                
                // Top pozisyonunu orijinal çizgiyle aynı yap
                customLine.style.top = topVal;
            });
        }
    }
    setInterval(updateNowIndicatorTime, 50); // Mümkün olan en minimal (50ms) gecikmeyle anında eşitle
    // -----------------------------------------------
    
    function initPlannerCalendar() {
        const calendarEl = document.getElementById('planner-calendar');
        if (!calendarEl) return;
        
        if (!plannerCalendar) {
            plannerCalendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'timeGridWeek',
                locale: 'tr', 
                customButtons: {
                    addEventBtn: {
                        text: '+ Yeni',
                        click: function() {
                            if (typeof openCalendarEventModal === 'function') {
                                openCalendarEventModal();
                            } else {
                                alert("Etkinlik ekleme ekranı yakında entegre edilecek.");
                            }
                        }
                    }
                },
                headerToolbar: {
                    left: 'prev,next today addEventBtn',
                    center: 'title',
                    right: 'timeGridWeek,timeGridDay'
                },
                footerToolbar: false,
                titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
                dayHeaderFormat: { weekday: 'long', month: 'long', day: 'numeric', omitCommas: true },
                slotMinTime: '06:00:00',
                slotMaxTime: '24:00:00',
                slotDuration: '01:00:00',
                slotLabelInterval: '01:00',
                snapDuration: '00:15:00',
                slotLabelFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    omitZeroMinute: false,
                    meridiem: false
                },
                allDaySlot: false,
                editable: true,
                selectable: false, // Etkinlik ekleme şimdilik kapalı
                height: 'auto',
                nowIndicator: true,
                slotEventOverlap: false,
                
                eventDragStart: function(info) { window.isCalendarEventDragging = true; },
                eventDrop: async function(info) { 
                    setTimeout(() => window.isCalendarEventDragging = false, 200);
                    await handleEventCalendarUpdate(info); 
                },
                eventResizeStart: function(info) { window.isCalendarEventDragging = true; },
                eventResize: async function(info) { 
                    setTimeout(() => window.isCalendarEventDragging = false, 200);
                    await handleEventCalendarUpdate(info); 
                },
                
                eventContent: function(arg) {
                    const title = arg.event.title;
                    const desc = arg.event.extendedProps.description || '';
                    
                    const startTime = arg.event.start ? arg.event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    const endTime = arg.event.end ? arg.event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    
                    // Rengi al (backgroundColor veya default mavi)
                    const color = arg.event.backgroundColor || '#3788d8';
                    
                    let html = `
                        <div class="fc-custom-event" style="border-top: 2px solid ${color}; border-bottom: 2px solid ${color};">
                            ${startTime ? `<div class="fc-custom-time-top">${startTime}</div>` : ''}
                            <div class="fc-custom-title">${title}</div>
                            ${desc ? `<div class="fc-custom-desc">${desc}</div>` : ''}
                            ${endTime ? `<div class="fc-custom-time-bottom">${endTime}</div>` : ''}
                        </div>
                    `;
                    return { html: html };
                },

                eventClassNames: function(arg) {
                    if (window.selectedCalendarEvents && window.selectedCalendarEvents.some(e => e.id === arg.event.id)) {
                        return ['fc-event-selected'];
                    }
                    return [];
                },
                
                eventClick: function(info) {
                    // Anında seçim işlemi (Delay olmadan)
                    if (!window.selectedCalendarEvents) window.selectedCalendarEvents = [];
                    
                    if (info.jsEvent.shiftKey) {
                        // Çoklu seçim: Zaten seçiliyse çıkar, değilse ekle
                        const existingIdx = window.selectedCalendarEvents.findIndex(e => e.id === info.event.id);
                        if (existingIdx > -1) {
                            window.selectedCalendarEvents.splice(existingIdx, 1);
                            info.el.classList.remove('fc-event-selected');
                        } else {
                            window.selectedCalendarEvents.push(info.event);
                            info.el.classList.add('fc-event-selected');
                        }
                    } else {
                        // Tekli seçim
                        window.selectedCalendarEvents = [info.event];
                        document.querySelectorAll('.fc-event-selected').forEach(el => el.classList.remove('fc-event-selected'));
                        info.el.classList.add('fc-event-selected');
                    }

                    // Çift tıklama algılayıcısı (Sadece modal açmak için)
                    if (window.fcClickTimer === undefined) window.fcClickTimer = null;
                    if (window.fcClickTimer === null) {
                        window.fcClickTimer = setTimeout(() => {
                            window.fcClickTimer = null;
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

        const isClone = info.jsEvent && info.jsEvent.altKey;

        if (props.type === 'project') {
            const payload = {
                title: ev.title,
                description: props.description || "",
                startDate: startVal,
                deadline: endVal || startVal
            };
            try {
                let res;
                if (isClone) {
                    // Klonlama (ALT tuşuna basılarak sürüklendiğinde)
                    res = await fetch(`/api/dashboard/project`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Normal Taşıma/Güncelleme
                    res = await fetch(`/api/dashboard/project/${props.projectId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (res.ok) {
                    if (isClone) {
                        info.revert(); // Orijinal kartı eski yerine geri gönder
                        const data = await res.json();
                        if (data.success && data.id) {
                            // Yeni kartı anında takvime ekle
                            plannerCalendar.addEvent({
                                id: 'project_' + data.id,
                                title: ev.title,
                                start: startVal,
                                end: endVal || startVal,
                                backgroundColor: ev.backgroundColor,
                                borderColor: ev.borderColor,
                                textColor: ev.textColor,
                                extendedProps: {
                                    type: 'project',
                                    projectId: data.id,
                                    description: props.description || "",
                                    startDate: startVal,
                                    deadline: endVal || startVal
                                }
                            });
                        }
                    } else {
                        ev.setExtendedProp('startDate', startVal);
                        ev.setExtendedProp('deadline', endVal || startVal);
                    }
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
                let res;
                if (isClone) {
                    res = await fetch(`/api/calendar`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    res = await fetch(`/api/calendar/${props.calendarEventId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (res.ok) {
                    if (isClone) {
                        info.revert();
                        const data = await res.json();
                        if (data.success && data.id) {
                            plannerCalendar.addEvent({
                                id: 'calev_' + data.id,
                                title: ev.title,
                                start: startVal,
                                end: endVal || startVal,
                                backgroundColor: ev.backgroundColor,
                                borderColor: ev.borderColor,
                                textColor: ev.textColor,
                                extendedProps: {
                                    type: 'calendar',
                                    calendarEventId: data.id,
                                    description: props.description || "",
                                    startDate: startVal,
                                    endDate: endVal || startVal
                                }
                            });
                        }
                    } else {
                        ev.setExtendedProp('startDate', startVal);
                        ev.setExtendedProp('endDate', endVal || startVal);
                    }
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

// ALT tuşuna basıldığında görsel kopyalama hissi vermek için body sınıfını tetikle
document.addEventListener('keydown', function(e) {
    if (e.altKey) document.body.classList.add('alt-pressed');
});
document.addEventListener('keyup', function(e) {
    if (!e.altKey) document.body.classList.remove('alt-pressed');
});
// Sürükleme esnasında basılıp bırakılırsa diye mouse hareketinde de kontrol et
document.addEventListener('mousemove', function(e) {
    if (e.altKey) document.body.classList.add('alt-pressed');
    else document.body.classList.remove('alt-pressed');
});

// Global sürükleme durumu takibi
window.isCalendarEventDragging = false;

// Takvim kartı seçimi iptali
document.addEventListener('click', function(e) {
    // Eğer az önce bir sürükle bırak yapıldıysa veya kartın kendisine tıklandıysa iptal etme
    if (window.isCalendarEventDragging || e.target.closest('.fc-event') || e.target.closest('.fc-event-mirror')) return;
    
    if (window.selectedCalendarEvents && window.selectedCalendarEvents.length > 0) {
        window.selectedCalendarEvents = [];
        document.querySelectorAll('.fc-event-selected').forEach(el => el.classList.remove('fc-event-selected'));
    }
});

// Delete veya Backspace ile seçili kartları silme
document.addEventListener('keydown', async function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && window.selectedCalendarEvents && window.selectedCalendarEvents.length > 0) {
        // Eğer kullanıcı bir input'a yazı yazıyorsa silmeyi engelle
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        
        e.preventDefault();
        
        const count = window.selectedCalendarEvents.length;
        const msg = count > 1 ? `${count} adet etkinliği silmek istiyor musunuz?` : "Etkinliği silmek istiyor musunuz?";
        const isConfirmed = confirm(msg);
        
        if (isConfirmed) {
            const eventsToDelete = [...window.selectedCalendarEvents];
            let allSuccess = true;
            
            for (const ev of eventsToDelete) {
                const props = ev.extendedProps;
                if (props.type === 'project') {
                    try {
                        const res = await fetch(`/api/dashboard/project/${props.projectId}`, { method: 'DELETE' });
                        if (res.ok) {
                            ev.remove();
                        } else {
                            allSuccess = false;
                        }
                    } catch(err) {
                        console.error(err);
                        allSuccess = false;
                    }
                } else if (props.type === 'calendar') {
                    try {
                        const res = await fetch(`/api/calendar/${props.calendarEventId}`, { method: 'DELETE' });
                        if (res.ok) {
                            ev.remove();
                        } else {
                            allSuccess = false;
                        }
                    } catch(err) {
                        console.error(err);
                        allSuccess = false;
                    }
                }
            }
            
            window.selectedCalendarEvents = [];
            
            if (!allSuccess) {
                alert("Bazı silme işlemleri başarısız oldu.");
            }
            
            if (typeof triggerGlobalRefresh === 'function') triggerGlobalRefresh();
        }
    }
});

