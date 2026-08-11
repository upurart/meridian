function openCalendarEventModal(ev = null) {
    const form = document.getElementById("calendar-event-form");
    if(form) form.reset();

    if (ev && ev.id) {
        document.getElementById("calendar-event-modal-title").innerText = "Etkinliği Düzenle";
        document.getElementById("calendar-event-id").value = ev.id;
        document.getElementById("calendar-event-title").value = ev.title;
        document.getElementById("calendar-event-desc").value = ev.description || "";
        document.getElementById("calendar-event-start").value = ev.startDate ? ev.startDate.substring(0, 16) : "";
        document.getElementById("calendar-event-end").value = ev.endDate ? ev.endDate.substring(0, 16) : "";
        document.getElementById("calendar-event-color").value = ev.color || "#3788d8";
        document.getElementById("calendar-event-delete-btn").style.display = "inline-block";
    } else {
        document.getElementById("calendar-event-modal-title").innerText = "Yeni Etkinlik";
        document.getElementById("calendar-event-id").value = "";
        document.getElementById("calendar-event-delete-btn").style.display = "none";
        
        if (ev && ev.startStr) {
            document.getElementById("calendar-event-start").value = ev.startStr.substring(0, 16);
            if (ev.endStr) {
                document.getElementById("calendar-event-end").value = ev.endStr.substring(0, 16);
            } else {
                let st = new Date(ev.startStr);
                st.setHours(st.getHours() + 1);
                document.getElementById("calendar-event-end").value = st.toISOString().substring(0, 16);
            }
        }
    }
    
    const modal = document.getElementById('calendar-event-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('active'); }, 10);
    }
}

async function handleCalendarEventSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = "Kaydediliyor...";

    const id = document.getElementById("calendar-event-id").value;
    const title = document.getElementById("calendar-event-title").value.trim();
    const description = document.getElementById("calendar-event-desc").value.trim();
    const startDate = document.getElementById("calendar-event-start").value;
    const endDate = document.getElementById("calendar-event-end").value;
    const color = document.getElementById("calendar-event-color").value;

    const payload = { title, description, startDate, endDate, color };

    try {
        const url = id ? `/api/calendar/${id}` : '/api/calendar';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeModal('calendar-event-modal');
            showToast(id ? "Etkinlik güncellendi." : "Etkinlik eklendi.");
            if (typeof plannerCalendar !== 'undefined' && plannerCalendar) {
                plannerCalendar.refetchEvents();
            }
        } else {
            showToast("Etkinlik kaydedilirken hata oluştu.", "danger");
        }
    } catch (err) {
        console.error(err);
        showToast("Bağlantı hatası.", "danger");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Kaydet";
    }
}

async function deleteCalendarEvent() {
    if (!confirm("Bu etkinliği silmek istediğinize emin misiniz?")) return;
    
    const id = document.getElementById("calendar-event-id").value;
    if (!id) return;

    try {
        const res = await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
        if (res.ok) {
            closeModal('calendar-event-modal');
            showToast("Etkinlik silindi.");
            if (typeof plannerCalendar !== 'undefined' && plannerCalendar) {
                plannerCalendar.refetchEvents();
            }
        } else {
            showToast("Etkinlik silinirken hata oluştu.", "danger");
        }
    } catch (err) {
        console.error(err);
        showToast("Bağlantı hatası.", "danger");
    }
}

window.openCalendarEventModal = openCalendarEventModal;
window.handleCalendarEventSubmit = handleCalendarEventSubmit;
window.deleteCalendarEvent = deleteCalendarEvent;
