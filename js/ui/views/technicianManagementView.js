/* =========================================================
   App.ui.views.technicianManagementView — administración de
   técnicos (solo admin): alta, edición, foto, activar/desactivar,
   eliminar.
   ========================================================= */
(function (App) {
  'use strict';

  const technicianService = App.services.technicianService;
  const { escapeHtml, initials, compressImage } = App.core.utils;
  const { maxAttachmentDimension, attachmentQuality } = App.config;

  const EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
  const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
  const PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
  const POWER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>';
  const KEY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="M10.5 12.5L21 2M21 2h-5M21 2v5"/></svg>';

  async function render() {
    const container = document.getElementById('viewContainer');
    if (!container.querySelector('.people-grid')) container.innerHTML = App.ui.skeleton.cards(3);
    const technicians = await technicianService.listWithStats();

    container.innerHTML = `
      <div class="content-header">
        <div><h1>Técnicos</h1><p>Administra el equipo de soporte técnico.</p></div>
        <button type="button" class="btn btn-primary" id="addTechBtn">${PLUS_ICON}<span>Nuevo técnico</span></button>
      </div>
      ${technicians.length ? `
      <div class="people-grid">
        ${technicians.map(personCard).join('')}
      </div>` : `
      <div class="card"><div class="empty-state"><h4>Sin técnicos registrados</h4><p>Agrega tu primer técnico con el botón "Nuevo técnico".</p></div></div>`}
    `;

    document.getElementById('addTechBtn').addEventListener('click', () => openTechModal());
    container.querySelectorAll('[data-edit-tech]').forEach((btn) => btn.addEventListener('click', () => openTechModal(technicians.find((t) => t.id === btn.dataset.editTech))));
    container.querySelectorAll('[data-toggle-tech]').forEach((btn) => btn.addEventListener('click', () => toggleActive(btn.dataset.toggleTech, btn.dataset.nextActive === 'true')));
    container.querySelectorAll('[data-delete-tech]').forEach((btn) => btn.addEventListener('click', () => deleteTech(btn.dataset.deleteTech)));
    container.querySelectorAll('[data-reset-pass]').forEach((btn) => btn.addEventListener('click', () => resetPassword(btn.dataset.resetPass, technicians.find((t) => t.id === btn.dataset.resetPass))));
  }

  function personCard(t) {
    return `
      <div class="person-card ${t.active === false ? 'inactive' : ''}">
        <span class="status-dot" title="${t.active === false ? 'Inactivo' : 'Activo'}"></span>
        ${t.avatar ? `<img class="avatar avatar-lg" src="${t.avatar}" alt="">` : `<span class="avatar avatar-lg">${initials(t.name)}</span>`}
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="role">${escapeHtml(t.position || 'Técnico TI')}</div>
        <div class="text-tertiary mono" style="font-size:var(--fs-xs);margin-top:2px;">@${escapeHtml(t.username || '—')}</div>
        <div class="person-stats">
          <div><div class="n">${t.assignedCount}</div><div class="l">Asignadas</div></div>
          <div><div class="n">${t.resolvedCount}</div><div class="l">Resueltas</div></div>
        </div>
        <div class="person-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-edit-tech="${t.id}" style="flex:1;">${EDIT_ICON}<span>Editar</span></button>
          <button type="button" class="btn btn-secondary btn-sm btn-icon-only" data-reset-pass="${t.id}" title="Restablecer contraseña">${KEY_ICON}</button>
          <button type="button" class="btn btn-secondary btn-sm btn-icon-only" data-toggle-tech="${t.id}" data-next-active="${t.active === false}" title="${t.active === false ? 'Activar' : 'Desactivar'}">${POWER_ICON}</button>
          <button type="button" class="btn btn-secondary btn-sm btn-icon-only" data-delete-tech="${t.id}" title="Eliminar">${TRASH_ICON}</button>
        </div>
      </div>`;
  }

  async function resetPassword(id, tech) {
    if (!confirm(`¿Restablecer la contraseña de ${tech.name}? Se generará una nueva contraseña temporal.`)) return;
    const tempPassword = await technicianService.resetPassword(id);
    App.ui.modal.open({
      title: 'Contraseña restablecida',
      bodyHtml: `
        <p class="text-secondary" style="font-size:var(--fs-sm);margin-bottom:12px;">
          Entrégale esta contraseña temporal a <strong>${escapeHtml(tech.name)}</strong> (usuario <strong>@${escapeHtml(tech.username)}</strong>).
          Se le pedirá crear una contraseña definitiva en su próximo inicio de sesión. Este valor no se volverá a mostrar.
        </p>
        <div class="input mono" style="display:flex;align-items:center;font-size:var(--fs-lg);font-weight:700;letter-spacing:0.04em;height:48px;">${escapeHtml(tempPassword)}</div>
      `,
      footerHtml: `<button type="button" class="btn btn-primary" data-modal-close>Entendido</button>`,
    });
  }

  async function toggleActive(id, nextActive) {
    try {
      await technicianService.setActive(id, nextActive);
      App.ui.toast.show({ type: 'success', title: nextActive ? 'Técnico activado' : 'Técnico desactivado' });
      render();
    } catch (err) {
      App.ui.toast.show({ type: 'danger', title: 'No se pudo actualizar', text: err.message });
    }
  }

  async function deleteTech(id) {
    if (!confirm('¿Eliminar a este técnico de forma permanente?')) return;
    try {
      await technicianService.remove(id);
      App.ui.toast.show({ type: 'success', title: 'Técnico eliminado' });
      render();
    } catch (err) {
      App.ui.toast.show({ type: 'danger', title: 'No se pudo eliminar', text: err.message });
    }
  }

  function openTechModal(existing) {
    let avatarDataUrl = existing ? existing.avatar : null;
    const { close } = App.ui.modal.open({
      title: existing ? 'Editar técnico' : 'Nuevo técnico',
      bodyHtml: `
        <form id="techForm">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
            <div id="techAvatarPreview">${avatarDataUrl ? `<img class="avatar avatar-lg" src="${avatarDataUrl}">` : `<span class="avatar avatar-lg">${initials(existing ? existing.name : '?')}</span>`}</div>
            <div>
              <button type="button" class="btn btn-secondary btn-sm" id="techPhotoBtn">Subir foto</button>
              <input type="file" id="techPhotoInput" accept="image/*" hidden>
            </div>
          </div>
          <div class="form-group"><label for="techName">Nombre completo</label><input type="text" id="techName" class="input" value="${existing ? escapeHtml(existing.name) : ''}" required></div>
          ${existing
            ? `<div class="form-group"><label>Usuario</label><input type="text" class="input mono" value="@${escapeHtml(existing.username || '')}" disabled></div>`
            : `<div class="form-group"><label for="techUsername">Usuario (para iniciar sesión)</label><input type="text" id="techUsername" class="input" placeholder="ej. jperez" pattern="[a-z0-9._-]{3,20}" autocapitalize="off" autocorrect="off" required></div>`}
          <div class="form-group"><label for="techEmail">Correo</label><input type="email" id="techEmail" class="input" value="${existing ? escapeHtml(existing.email) : ''}" required></div>
          <div class="form-group"><label for="techPosition">Cargo</label><input type="text" id="techPosition" class="input" value="${existing ? escapeHtml(existing.position || '') : ''}" placeholder="Ej. Técnico de Redes" required></div>
          ${!existing ? `<div class="form-group"><label for="techPassword">Contraseña inicial</label><input type="password" id="techPassword" class="input" minlength="6" required></div>` : ''}
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="techForm" class="btn btn-primary">${existing ? 'Guardar cambios' : 'Crear técnico'}</button>
      `,
    });
    const modalEl = document.querySelector('.modal-overlay:last-child');

    modalEl.querySelector('#techPhotoBtn').addEventListener('click', () => modalEl.querySelector('#techPhotoInput').click());
    modalEl.querySelector('#techPhotoInput').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      avatarDataUrl = await compressImage(file, maxAttachmentDimension, attachmentQuality);
      modalEl.querySelector('#techAvatarPreview').innerHTML = `<img class="avatar avatar-lg" src="${avatarDataUrl}">`;
    });

    modalEl.querySelector('#techForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = modalEl.querySelector('#techName').value;
      const email = modalEl.querySelector('#techEmail').value;
      const position = modalEl.querySelector('#techPosition').value;
      try {
        if (existing) {
          await technicianService.update(existing.id, { name, email: email.trim().toLowerCase(), position, avatar: avatarDataUrl });
          App.ui.toast.show({ type: 'success', title: 'Técnico actualizado' });
        } else {
          const username = modalEl.querySelector('#techUsername').value;
          const password = modalEl.querySelector('#techPassword').value;
          const record = await technicianService.create({ name, username, email, position, password });
          if (avatarDataUrl) await technicianService.update(record.id, { avatar: avatarDataUrl });
          App.ui.toast.show({ type: 'success', title: 'Técnico creado' });
        }
        close();
        render();
      } catch (err) {
        App.ui.toast.show({ type: 'danger', title: 'No se pudo guardar', text: err.message });
      }
    });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.technicianManagementView = { render };

})(window.App = window.App || {});
