window.openProfileModal = async function() {
    try {
        const res = await fetch('/api/userapi/profile');
        if (res.ok) {
            const user = await res.json();
            document.getElementById('profile-name').value = user.name;
            document.getElementById('profile-surname').value = user.surname;
            document.getElementById('profile-username').value = user.username;
            document.getElementById('profile-email').value = user.email;
            if (user.avatarUrl && user.avatarUrl !== 'default-avatar.png' && user.avatarUrl !== '/default-avatar.png') {
                let safeUrl = user.avatarUrl;
                if (safeUrl.includes('.r2.dev')) {
                    safeUrl = '/api/UserApi/avatar-proxy?url=' + encodeURIComponent(safeUrl);
                }
                const previewEl = document.getElementById('profile-avatar-preview');
                if (previewEl.tagName === 'IMG') {
                    previewEl.src = safeUrl;
                }
            }
            openModal('profile-modal');
        } else {
            showToast("Profil bilgileri yüklenemedi.", "danger");
        }
    } catch (err) {
        console.error(err);
        showToast("Profil bilgileri yüklenemedi.", "danger");
    }
};

window.openPasswordModal = function() {
    document.getElementById('password-form').reset();
    openModal('password-modal');
};

window.handleAvatarSelect = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
        showToast("Fotoğraf yükleniyor...", "info");
        const res = await fetch('/api/userapi/avatar', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            const safeUrl = data.url;
            document.getElementById('profile-avatar-preview').outerHTML = `<img id="profile-avatar-preview" src="${safeUrl}" alt="Avatar" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);" />`;
            
            // Update global rail avatar
            const railContainer = document.getElementById('global-rail-avatar-container');
            if (railContainer) {
                railContainer.innerHTML = `<img src="${safeUrl}" alt="Avatar" class="rail-avatar-circle" style="object-fit: cover; border: 1px solid var(--border-color); padding: 0;" />`;
            }
            
            // Update profile panel avatar
            const panelContainer = document.getElementById('global-panel-avatar-container');
            if (panelContainer) {
                panelContainer.innerHTML = `<img src="${safeUrl}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" /><span style="position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; background-color: var(--color-success); border-radius: 50%; border: 2px solid var(--bg-surface-elevated);"></span>`;
            }
            
            showToast("Profil fotoğrafı başarıyla güncellendi.");
        } else {
            showToast("Fotoğraf yüklenirken hata oluştu.", "danger");
        }
    } catch (err) {
        console.error(err);
        showToast("Fotoğraf yüklenirken hata oluştu.", "danger");
    }
};

window.handleProfileSubmit = async function(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('profile-name').value,
        surname: document.getElementById('profile-surname').value,
        username: document.getElementById('profile-username').value,
        email: document.getElementById('profile-email').value
    };

    try {
        const res = await fetch('/api/userapi/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Profil bilgileri güncellendi.");
            closeModal('profile-modal');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            const error = await res.text();
            showToast(error || "Profil güncellenirken hata oluştu.", "danger");
        }
    } catch (err) {
        console.error(err);
        showToast("Bağlantı hatası.", "danger");
    }
};

window.handlePasswordSubmit = async function(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('password-current').value;
    const newPassword = document.getElementById('password-new').value;
    const confirmPassword = document.getElementById('password-confirm').value;

    if (newPassword !== confirmPassword) {
        showToast("Yeni şifreler eşleşmiyor.", "warning");
        return;
    }

    try {
        const res = await fetch('/api/userapi/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (res.ok) {
            showToast("Şifreniz başarıyla güncellendi.");
            closeModal('password-modal');
        } else {
            const error = await res.text();
            showToast(error || "Şifre güncellenirken hata oluştu.", "danger");
        }
    } catch (err) {
        console.error(err);
        showToast("Bağlantı hatası.", "danger");
    }
};

