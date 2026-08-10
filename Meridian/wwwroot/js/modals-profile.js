window.openProfileModal = async function() {
    try {
        const res = await fetch('/api/userapi/profile');
        if (res.ok) {
            const user = await res.json();
            document.getElementById('profile-name').value = user.name;
            document.getElementById('profile-surname').value = user.surname;
            document.getElementById('profile-username').value = user.username;
            document.getElementById('profile-email').value = user.email;
            if (user.avatarUrl) {
                document.getElementById('profile-avatar-preview').src = user.avatarUrl;
            } else {
                document.getElementById('profile-avatar-preview').src = "/img/default-avatar.png";
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
            document.getElementById('profile-avatar-preview').src = data.url;
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
