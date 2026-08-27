
// --- BAŞLIK İÇİN HIZLI TARİH SEÇİCİ ---
document.addEventListener('click', function(e) {
    const titleEl = e.target.closest('.fc-toolbar-title');
    if (titleEl) {
        let picker = document.getElementById('fc-title-native-picker');
        if (!picker) {
            picker = document.createElement('input');
            picker.type = 'date';
            picker.id = 'fc-title-native-picker';
            picker.style.position = 'absolute';
            picker.style.opacity = '0';
            picker.style.width = '1px';
            picker.style.height = '1px';
            picker.style.border = 'none';
            picker.style.padding = '0';
            picker.style.pointerEvents = 'none';
            
            titleEl.style.position = 'relative';
            titleEl.appendChild(picker);
            
            picker.addEventListener('change', function() {
                if(this.value && typeof plannerCalendar !== 'undefined' && plannerCalendar) {
                    plannerCalendar.gotoDate(this.value);
                }
            });
        }
        try {
            picker.showPicker();
        } catch(ex) {
            picker.focus();
        }
    }
});
// --------------------------------------
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

        
    
        // --- Sürükle Bırak (Draggable) Listesi Başlatma ---
        let containerEl = document.getElementById("external-events-list");
        if (containerEl && typeof FullCalendar !== "undefined" && FullCalendar.Draggable && !window.calendarDraggableInit) {
            new FullCalendar.Draggable(containerEl, {
                itemSelector: ".external-task-item",
                eventData: function(eventEl) {
                      let tType = eventEl.dataset.itemType || "calendar";
                      
                      if (tType === "project") {
                          return {
                              title: eventEl.dataset.title || eventEl.innerText.trim(),
                              backgroundColor: eventEl.dataset.color || "var(--bs-purple)",
                              borderColor: "transparent",
                              extendedProps: {
                                  type: "project",
                                  projectId: eventEl.dataset.id,
                                  description: ""
                              }
                          };
                      }
                      
                      return {
                          title: eventEl.dataset.title || eventEl.innerText.trim(),
                          backgroundColor: eventEl.dataset.color || "#3788d8",
                          borderColor: "transparent",
                          duration: eventEl.dataset.duration || "01:00",
                          extendedProps: {
                              type: "calendar",
                              calendarEventId: eventEl.dataset.id,
                              description: ""
                          }
                      };
                  }
            });
            window.calendarDraggableInit = true;
        }
        // ---------------------------------------------------

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
                allDaySlot: true,
                allDayText: 'Teslimler',
                editable: true,
                droppable: true,
                businessHours: {
                    daysOfWeek: [ 1, 2, 3, 4, 5 ],
                    startTime: '09:00',
                    endTime: '18:00',
                },
                selectable: false, // Etkinlik ekleme şimdilik kapalı
                height: 'auto',
                nowIndicator: true,
                slotEventOverlap: false,
                eventOrder: function(a, b) {
                    let aOrder = a.extendedProps ? (a.extendedProps.orderIndex || 0) : 0;
                    let bOrder = b.extendedProps ? (b.extendedProps.orderIndex || 0) : 0;
                    if (aOrder !== bOrder) {
                        return aOrder - bOrder;
                    }
                    return a.id.localeCompare(b.id);
                },
                
                
                eventDragStop: async function(info) {
                    const trashEl = document.getElementById('calendar-external-events');
                    if (trashEl) {
                        const rect = trashEl.getBoundingClientRect();
                        // Fare sürükleme işlemini bu div üzerinde mi bıraktı?
                        if (
                            info.jsEvent.clientX >= rect.left &&
                            info.jsEvent.clientX <= rect.right &&
                            info.jsEvent.clientY >= rect.top &&
                            info.jsEvent.clientY <= rect.bottom
                        ) {
                            // Sadece normal takvim görevleri iade edilebilir (Projeler hariç)
                            if (info.event.extendedProps && info.event.extendedProps.type === 'calendar') {
                                if (confirm("Görevi takvimden çıkarıp tekrar 'Bekleyen Görevler'e almak istiyor musunuz?")) {
                                    
                                    const calEventId = info.event.extendedProps.calendarEventId;
                                    if (!calEventId) return;
                                    
                                    // Takvimden anında sil
                                    info.event.remove();
                                    
                                    // Veritabanında tarihi null'a çek (Update)
                                    const payload = {
                                        title: info.event.title,
                                        description: info.event.extendedProps.description || "",
                                        startDate: null,
                                        endDate: null,
                                        color: info.event.backgroundColor || '#3788d8'
                                    };
                                    
                                    try {
                                        const res = await fetch(`/api/calendar/${calEventId}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        });
                                        if (res.ok) {
                                            if (typeof window.loadBacklogTasks === 'function') {
                                                window.loadBacklogTasks();
                                            }
                                        }
                                    } catch (e) {
                                        console.error("Geri yükleme hatası: ", e);
                                    }
                                }
                            }
                        }
                    }
                },
eventDrop: async function(info) { 
                    await handleEventCalendarUpdate(info); 
                },
                eventResize: async function(info) { 
                    await handleEventCalendarUpdate(info); 
                },
                eventReceive: async function(info) {
                      let ev = info.event;
                      let startVal = ev.start ? new Date(ev.start.getTime() - ev.start.getTimezoneOffset() * 60000).toISOString().substring(0, 16) : null;
                      let endVal = ev.end ? new Date(ev.end.getTime() - ev.end.getTimezoneOffset() * 60000).toISOString().substring(0, 16) : null;

                      if (ev.extendedProps && ev.extendedProps.type === 'project') {
                          const payload = {
                              title: ev.title,
                              description: ev.extendedProps.description || "",
                              startDate: startVal,
                              deadline: endVal || startVal
                          };
                          try {
                              const res = await fetch(`/api/dashboard/project/${ev.extendedProps.projectId}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(payload)
                              });
                              if (res.ok) {
                                  ev.setProp("id", "project_" + ev.extendedProps.projectId);
                                  ev.setExtendedProp("projectId", ev.extendedProps.projectId);
                                  if (info.draggedEl && info.draggedEl.parentNode) info.draggedEl.remove();
                              } else {
                                  info.revert();
                              }
                          } catch(e) {
                              console.error(e);
                              info.revert();
                          }
                      } else {
                          const payload = {
                              title: ev.title,
                              description: ev.extendedProps.description || "",
                              startDate: startVal,
                              endDate: endVal || startVal,
                              color: ev.backgroundColor || "#3788d8"
                          };
                          
                          try {
                              const isExisting = ev.extendedProps && ev.extendedProps.calendarEventId;
                              const reqUrl = isExisting ? `/api/calendar/${ev.extendedProps.calendarEventId}` : `/api/calendar`;
                              const reqMethod = isExisting ? "PUT" : "POST";
                              
                              const res = await fetch(reqUrl, {
                                  method: reqMethod,
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(payload)
                              });
                              
                              if (res.ok) {
                                  const data = await res.json();
                                  if (data.success) {
                                      if (data.id) {
                                          ev.setProp("id", "calev_" + data.id);
                                          ev.setExtendedProp("calendarEventId", data.id);
                                      } else if (isExisting) {
                                          ev.setProp("id", "calev_" + ev.extendedProps.calendarEventId);
                                      }
                                      ev.setExtendedProp("type", "calendar");
                                      if (info.draggedEl && info.draggedEl.parentNode) info.draggedEl.remove();
                                  }
                              } else {
                                  info.revert();
                              }
                          } catch(e) {
                              console.error(e);
                              info.revert();
                          }
                      }
                  },

                
                eventContent: function(arg) {
                      const title = arg.event.title;
                      const desc = arg.event.extendedProps.description || '';
                      
                      const startTime = arg.event.start ? arg.event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                      const endTime = arg.event.end ? arg.event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                      
                      let durationMin = 60;
                      if (arg.event.start && arg.event.end) {
                          durationMin = (arg.event.end - arg.event.start) / 60000;
                      } else {
                          durationMin = 60;
                      }

                      let displayMode = 'normal';
                      if (durationMin <= 30) {
                          displayMode = 'compact';
                      } else if (durationMin <= 90) {
                          displayMode = 'medium';
                      }

                      let html = '';
                      const isProject = arg.event.extendedProps && arg.event.extendedProps.type === 'project';
                      const isAllDay = arg.event.allDay;
                      const colorFallback = arg.event.backgroundColor || (isProject ? 'var(--bs-purple, #6f42c1)' : '#3788d8');
                      const projectIcon = isProject ? '<i class="bi bi-briefcase" style="opacity:0.8; margin-top:2px; flex-shrink:0;"></i>' : '';

                      if (isProject && isAllDay) {
                          html = `
                              <div data-event-id="${arg.event.id}" title="Proje Teslimi: ${title}" class="fc-custom-allday-badge" style="background-color: ${colorFallback}; border-left-color: rgba(0,0,0,0.2);">
                                  <div class="badge-flag"></div>
                                  <i class="bi bi-briefcase"></i> <span style="font-weight:600;">${title}</span>
                              </div>
                          `;
                      } else if (!isProject && isAllDay) {
                          html = `
                              <div data-event-id="${arg.event.id}" title="${title}" style="background-color: ${colorFallback}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; box-shadow: var(--shadow-sm);">
                                  <i class="bi bi-check2-circle"></i> ${title}
                              </div>
                          `;
                      } else if (displayMode === 'compact') {
                          html = `
                              <div data-event-id="${arg.event.id}" class="fc-custom-event-compact" style="border-left: 3px solid ${colorFallback}; position: absolute; top: 0; bottom: 0; left: 0; right: 0; padding: 0 10px 0 7px; box-sizing: border-box; overflow: hidden; color: var(--text-primary); display: flex; align-items: center; background-color: var(--bg-surface-elevated); border-radius: 6px;">
                                  <div style="display: flex; align-items: center; width: 100%; font-size: 0.75rem; font-weight: 600; white-space: nowrap; line-height: 1;">
                                      <span style="flex-shrink: 0; max-width: 50%; overflow: hidden; text-overflow: ellipsis; display: inline-block;">${projectIcon}${title}</span>
                                      <div style="flex-grow: 1; height: 2px; background-color: ${colorFallback}; margin: 0 8px; opacity: 0.6; border-radius: 1px;"></div>
                                      <span style="flex-shrink: 0; opacity: 0.8; font-weight: 500; display: inline-block;">${startTime} - ${endTime}</span>
                                  </div>
                              </div>
                          `;
                      } else if (displayMode === 'medium') {
                          html = `
                              <div data-event-id="${arg.event.id}" class="fc-custom-event-medium" style="position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: var(--bg-surface); padding: 0 10px; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; justify-content: space-between; color: var(--text-primary); border-radius: 6px;">
                                  <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background-color: ${colorFallback}; z-index: 1;"></div>
                                  <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background-color: ${colorFallback}; z-index: 1;"></div>
                                  <div class="fc-custom-title" style="flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;">${projectIcon}${title}</div>
                                  <div style="font-size: 0.75rem; opacity: 0.8; color: var(--text-muted); padding-left: 8px; white-space: nowrap;">${startTime} - ${endTime}</div>
                              </div>
                          `;
                      } else {
                          let projectStartIcon = isProject ? `<i class="bi bi-briefcase" style="font-size: 0.85rem; opacity: 0.8; margin-top: 4px;"></i>` : ``;
                          html = `
                              <div data-event-id="${arg.event.id}" class="fc-custom-event" style="position: absolute; top: 0; bottom: 0; left: 0; right: 0; background-color: var(--bg-surface); padding: 6px 10px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; color: var(--text-primary); border-radius: 6px;">
                                  <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background-color: ${colorFallback}; z-index: 1;"></div>
                                  <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background-color: ${colorFallback}; z-index: 1;"></div>
                                  
                                  <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500; display: flex; flex-direction: column; align-items: center; width: 100%;">
                                      <span>${startTime}</span>
                                      ${projectStartIcon}
                                  </div>
                                  
                                  <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: left; padding: 4px 0;">
                                      <div class="fc-custom-title" style="font-weight: 600; margin-bottom: 2px; width: 100%; padding-right: 4px; padding-left: 2px; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${title}">${title}</div>
                                      ${desc ? `<div class="fc-custom-desc" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; width: 100%; padding-right: 4px; padding-left: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${desc}">${desc}</div>` : ''}
                                  </div>

                                  <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500; display: flex; justify-content: center; width: 100%;">
                                      ${endTime}
                                  </div>
                              </div>
                          `;
                      }
                      
                      return { html: html };
                  },

                eventClassNames: function(arg) {
                    if (window.selectedCalendarEvents && window.selectedCalendarEvents.some(e => e.id === arg.event.id)) {
                        return ['fc-event-selected'];
                    }
                    return [];
                },
                
                eventDidMount: function(arg) {
                      // Custom didMount placeholder
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

                    // Çift tıklama algılayıcısı (Sadece modal açmak için - Id korumalı)
                    if (window.fcClickTimer === undefined) window.fcClickTimer = null;
                    if (window.fcLastClickedEventId === undefined) window.fcLastClickedEventId = null;

                    if (window.fcClickTimer === null || window.fcLastClickedEventId !== info.event.id) {
                        clearTimeout(window.fcClickTimer); // Varsa önceki tıklamanın timer'ını durdur
                        window.fcLastClickedEventId = info.event.id;
                        window.fcClickTimer = setTimeout(() => {
                            window.fcClickTimer = null;
                            window.fcLastClickedEventId = null;
                        }, 300);
                    } else {
                        // Aynı karta belirtilen süre içinde tıklandı (GERÇEK ÇİFT TIK)
                        clearTimeout(window.fcClickTimer);
                        window.fcClickTimer = null;
                        window.fcLastClickedEventId = null;
                        
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
                        const calendarEvents = [];
                        
                        const responseProjects = await fetch('/api/dashboard/tree');
                        const responseCalendar = await fetch('/api/calendar');
                        
                        if (responseProjects.ok) {
                            const projectData = await responseProjects.json();
                            projectData.forEach(p => {
                                if (p.deadline || p.startDate) {
                                    let startVal = p.deadline || p.startDate;
                                    let endVal = p.deadline || startVal;
                                      let isAllDayProj = window.checkAllDay(startVal, endVal);
                                      
                                      // Yalnizca startDate ve deadline esit degilse endVal atayalim.
                                      // Projeler eskiden 0 dakika saniyordu, simdi 1 saat (veya ne atandiysa) alacak!
                                      if (startVal === endVal && !isAllDayProj) {
                                          let d = new Date(startVal);
                                          d.setHours(d.getHours() + 1);
                                          endVal = d.toISOString().substring(0, 16);
                                      }

                                      calendarEvents.push({
                                          id: 'proj_' + p.id,
                                          title: p.title,
                                          start: startVal,
                                          end: endVal,
                                          allDay: isAllDayProj,
                                          orderIndex: p.orderIndex || 0,
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
                        }

                        if (responseCalendar.ok) {
                            const calendarData = await responseCalendar.json();
                            calendarData.forEach(ev => {
                                if (!ev.startDate) return; // Sadece tarihi olanları takvime ekle
                                let evEnd = ev.endDate || ev.startDate;
                                  let isAllDayCal = window.checkAllDay(ev.startDate, evEnd);
                                  
                                  if (ev.startDate === evEnd && !isAllDayCal) {
                                      let d2 = new Date(ev.startDate);
                                      d2.setHours(d2.getHours() + 1);
                                      evEnd = d2.toISOString().substring(0, 16);
                                  }

                                  calendarEvents.push({
                                      id: 'calev_' + ev.id,
                                      title: ev.title,
                                      start: ev.startDate,
                                      end: evEnd,
                                      color: ev.color || '#3788d8',
                                      allDay: isAllDayCal,
                                      orderIndex: ev.orderIndex || 0,
                                      extendedProps: {
                                          type: 'calendar',
                                          calendarEventId: ev.id,
                                          description: ev.description,
                                          startDate: ev.startDate,
                                          endDate: ev.endDate
                                      }
                                  });
                            });
                        }
                        
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
                        // plannerCalendar.refetchEvents(); // Engellendi (Ghost kart bug fix)
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
                        // plannerCalendar.refetchEvents(); // Engellendi (Ghost kart bug fix)
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
        if(document.getElementById("chat-dashboard-view")) document.getElementById("chat-dashboard-view").style.display = "none";
        
        if(document.getElementById("files-view")) document.getElementById("files-view").style.display = "none";

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

// Takvim kartı seçimi iptali
document.addEventListener('click', function(e) {
    // Eğer kartın kendisine tıklandıysa iptal etme
    if (e.target.closest('.fc-event') || e.target.closest('.fc-event-mirror')) return;
    
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





// Global helper function for All-Day checks
window.checkAllDay = function(startStr, endStr) {
    if (!startStr) return false;
    let checkTime = (str) => {
        if (!str) return true;
        let tIdx = str.indexOf('T');
        if (tIdx === -1) return true; // No time part
        return str.substring(tIdx + 1, tIdx + 6) === '00:00';
    };
    return checkTime(startStr) && checkTime(endStr);
};

// --- DINAMIK BEKLEYEN GÖREVLER (BACKLOG) ---
window.loadBacklogTasks = async function() {
    try {
        const [resCal, resProj] = await Promise.all([
            fetch('/api/calendar'),
            fetch('/api/dashboard/tree')
        ]);
        
        const container = document.getElementById('external-events-list');
        if (!container) return;
        container.innerHTML = '';
        
        let pendingTasks = [];
        
        if (resCal.ok) {
            const data = await resCal.json();
            pendingTasks.push(...data.filter(x => !x.startDate).map(x => ({...x, _itemType: 'calendar'})));
        }
        if (resProj.ok) {
            const dataProj = await resProj.json();
            pendingTasks.push(...dataProj.filter(x => !x.startDate && !x.deadline).map(x => ({...x, _itemType: 'project'})));
        }
        
        if (pendingTasks.length === 0) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 180px; text-align: center; color: var(--text-muted); opacity: 0.8; padding: 0 10px;">
                    <i class="bi bi-calendar2-check" style="font-size: 2.5rem; color: var(--color-success); margin-bottom: 12px; opacity: 0.7;"></i>
                    <h5 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Harika İş!</h5>
                    <p style="font-size: 0.8rem; margin: 0; line-height: 1.4;">Tüm görevlerini ve projelerini başarıyla planladın.<br>Bekleyen hiçbir işin yok.</p>
                </div>
            `;
            return;
        }
        
        pendingTasks.forEach(ev => {
            let div = document.createElement('div');
            div.className = 'fc-event external-task-item';
            div.dataset.id = ev.id;
            div.dataset.itemType = ev._itemType;
            div.dataset.title = ev.title;
            // Project duration will be 01:00 or all-day when dropped
            div.dataset.duration = ev._itemType === 'project' ? "01:00" : "01:00"; 
            
            let colorFallback = ev._itemType === 'project' ? 'var(--bs-purple, #6f42c1)' : (ev.color || '#3788d8');
            div.dataset.color = colorFallback;
            
            div.style.cssText = `padding: 12px 14px; border-radius: 8px; cursor: grab; background-color: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-left: 4px solid ${colorFallback}; color: var(--text-primary); font-size: 0.9rem; font-weight: 500; transition: box-shadow 0.2s ease-in-out, filter 0.2s ease-in-out; position: relative;`;
            div.onmouseover = function() { this.style.boxShadow='0 4px 10px rgba(0,0,0,0.1)'; this.style.filter='brightness(1.05)'; };
            div.onmouseout = function() { this.style.boxShadow='var(--shadow-sm)'; this.style.filter='brightness(1)'; };
            
            let iconCode = ev._itemType === 'project' ? '<i class="bi bi-briefcase"></i> Tarihsiz Proje' : '<i class="bi bi-clock"></i> Planlanmamış Görev';
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <span style="white-space: normal; line-height: 1.3;">${ev.title}</span>
                    <i class="bi bi-grip-vertical" style="color: var(--text-muted); opacity: 0.5;"></i>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px; font-weight: normal; display: flex; gap: 4px; align-items: center;">${iconCode}</div>
                <button class="delete-backlog-btn" style="position: absolute; right: 10px; bottom: 8px; background: var(--bg-surface); border: none; color: var(--bs-danger); font-size: 0.9rem; padding: 2px 6px; border-radius: 4px; cursor: pointer; display: none; box-shadow: var(--shadow-sm);"><i class="bi bi-trash"></i></button>
            `;
            
            div.addEventListener('mouseenter', () => div.querySelector('.delete-backlog-btn').style.display = 'block');
            div.addEventListener('mouseleave', () => div.querySelector('.delete-backlog-btn').style.display = 'none');
            
            div.querySelector('.delete-backlog-btn').onclick = async function(e) {
                 e.stopPropagation();
                 if (confirm('Silmek istediğinize emin misiniz?')) {
                     if (ev._itemType === 'project') {
                         await fetch('/api/dashboard/project/' + ev.id, { method: 'DELETE' });
                     } else {
                         await fetch('/api/calendar/' + ev.id, { method: 'DELETE' });
                     }
                     div.remove();
                 }
            };
            
            container.appendChild(div);
        });
    } catch(e) { console.error("Backlog yükleme hatası", e); }
};



document.addEventListener('DOMContentLoaded', () => {
    // Ilk yukleme
    setTimeout(loadBacklogTasks, 500);
    
    // Yeni görev butonu
    const btnCreate = document.getElementById('btn-create-backlog');
    if (btnCreate) {
        btnCreate.onclick = async function() {
            let title = prompt("Yeni görev başlığını girin:");
            if (!title) return;
            
            try {
                await fetch('/api/calendar', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ title: title, startDate: null, endDate: null, color: '#3788d8' })
                });
                loadBacklogTasks();
                if(typeof showToast === 'function') showToast("Görev oluşturuldu", "success");
            } catch(e) {
                console.error(e);
                if(typeof showToast === 'function') showToast("Hata oluştu", "danger");
            }
        };
    }
});

// Update draggable properties
