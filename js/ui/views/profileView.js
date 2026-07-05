/* =========================================================
   App.ui.views.profileView — perfil del usuario/técnico/admin
   ========================================================= */
(function (App) {
  'use strict';

  const auth = App.services.authService;
  const { escapeHtml, initials, compressImage } = App.core.utils;
  const { maxAttachmentDimension, attachmentQuality, roles } = App.config;

  function repoForRole(role) {
    if (role === roles.ADMIN) return { get: async () => (await App.data.storageAdapter.getAll('admin'))[0], update: (id, patch) => App.data.storageAdapter.update('admin', id, patch) };
    if (role === roles.TECHNICIAN) return { get: (id) => App.data.technicianRepository.getById(id), update: (id, patch) => App.data.technicianRepository.update(id, patch) };
    return { get: (id) => App.data.userRepository.getById(id), update: (id, patch) => App.data.userRepository.update(id, patch) };
  }

  async function render() {
    const session = auth.getCurrentSession();
    const container = document.getElementById('viewContainer');
    const repo = repoForRole(session.role);
    const record = await repo.get(session.id);

    container.innerHTML = `
      <div class="content-header">
        <div><h1>Mi perfil</h1><p>Gestiona tu información personal y tu contraseña.</p></div>
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:16px;">Información personal</h3>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
              <div style="position:relative;">
                ${record.avatar ? `<img class="avatar avatar-lg" id="profileAvatarImg" src="${record.avatar}" alt="">` : `<span class="avatar avatar-lg" id="profileAvatarImg">${initials(record.name)}</span>`}
              </div>
              <div>
                <button type="button" class="btn btn-secondary btn-sm" id="changePhotoBtn">Cambiar foto</button>
                <input type="file" id="avatarInput" accept="image/*" hidden>
              </div>
            </div>
            <form id="profileForm">
              <div class="form-group">
                <label for="profileName">Nombre completo</label>
                <input type="text" id="profileName" class="input" value="${escapeHtml(record.name)}" required>
              </div>
              <div class="form-group">
                <label for="profileEmail">Correo</label>
                <input type="email" id="profileEmail" class="input" value="${escapeHtml(record.email)}" disabled>
                <span class="input-hint">El correo es tu identificador de inicio de sesión y no se puede cambiar.</span>
              </div>
              ${session.role === roles.TECHNICIAN ? `
              <div class="form-group">
                <label>Cargo</label>
                <input type="text" class="input" value="${escapeHtml(record.position || '')}" disabled>
                <span class="input-hint">Solo el administrador puede cambiar tu cargo.</span>
              </div>` : ''}
              <button type="submit" class="btn btn-primary">Guardar cambios</button>
            </form>
          </div>
        </div>
        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:16px;">Cambiar contraseña</h3>
            <form id="passwordForm">
              <div class="form-group">
                <label for="curPass">Contraseña actual</label>
                <input type="password" id="curPass" class="input" required>
              </div>
              <div class="form-group">
                <label for="newPass">Nueva contraseña</label>
                <input type="password" id="newPass" class="input" minlength="6" required>
              </div>
              <div class="form-group">
                <label for="newPass2">Confirmar nueva contraseña</label>
                <input type="password" id="newPass2" class="input" minlength="6" required>
              </div>
              <button type="submit" class="btn btn-secondary btn-block">Actualizar contraseña</button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('changePhotoBtn').addEventListener('click', () => document.getElementById('avatarInput').click());
    document.getElementById('avatarInput').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const dataUrl = await compressImage(file, maxAttachmentDimension, attachmentQuality);
      await repo.update(record.id, { avatar: dataUrl });
      auth.updateSessionProfile({ avatar: dataUrl });
      App.core.eventBus.emit('profile:updated', auth.getCurrentSession());
      App.ui.toast.show({ type: 'success', title: 'Foto de perfil actualizada' });
      render();
    });

    document.getElementById('profileForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = document.getElementById('profileName').value.trim();
      await repo.update(record.id, { name });
      auth.updateSessionProfile({ name });
      App.core.eventBus.emit('profile:updated', auth.getCurrentSession());
      App.ui.toast.show({ type: 'success', title: 'Perfil actualizado' });
    });

    document.getElementById('passwordForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const current = document.getElementById('curPass').value;
      const next = document.getElementById('newPass').value;
      const next2 = document.getElementById('newPass2').value;
      if (next !== next2) { App.ui.toast.show({ type: 'danger', title: 'Las contraseñas no coinciden' }); return; }
      const ok = await auth.verifyCurrentPassword(current);
      if (!ok) { App.ui.toast.show({ type: 'danger', title: 'Contraseña actual incorrecta' }); return; }
      await auth.changePassword(next);
      App.ui.toast.show({ type: 'success', title: 'Contraseña actualizada' });
      ev.target.reset();
    });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.profileView = { render };

})(window.App = window.App || {});
