/* =========================================================
   App.ui.views.userManagementView — administración de usuarios
   finales (solo admin): pestaña "Usuarios registrados" (listado,
   búsqueda, activar/desactivar, eliminar) y pestaña "DNIs
   autorizados" (alta/baja de DNIs habilitados para registrarse).
   ========================================================= */
(function (App) {
  'use strict';

  const userRepo = App.data.userRepository;
  const incidentRepo = App.data.incidentRepository;
  const dniService = App.services.dniService;
  const { escapeHtml, formatDate, initials, debounce } = App.core.utils;

  const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
  const POWER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>';
  const PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

  let state = { tab: 'registered' };
  let search = '';
  let renderId = 0;

  async function render() {
    const myId = ++renderId;
    const container = document.getElementById('viewContainer');
    if (!container.querySelector('.data-table') && !container.querySelector('.view-tabs')) {
      container.innerHTML = App.ui.skeleton.cards(3);
    }

    if (state.tab === 'registered') await renderRegistered(container, myId);
    else await renderWhitelist(container, myId);
  }

  function tabsHtml() {
    return `
      <div class="view-tabs">
        <button type="button" class="view-tab ${state.tab === 'registered' ? 'active' : ''}" data-users-tab="registered">Usuarios registrados</button>
        <button type="button" class="view-tab ${state.tab === 'whitelist' ? 'active' : ''}" data-users-tab="whitelist">DNIs autorizados</button>
      </div>`;
  }

  function wireTabs(container) {
    container.querySelectorAll('[data-users-tab]').forEach((btn) => {
      btn.addEventListener('click', () => { state = { tab: btn.dataset.usersTab }; render(); });
    });
  }

  /* ------------------------- Usuarios registrados ------------------------- */

  async function renderRegistered(container, myId) {
    const [users, incidents] = await Promise.all([userRepo.getAll(), incidentRepo.getAll()]);
    if (myId !== renderId) return;

    const q = search.trim().toLowerCase();
    const rows = users
      .map((u) => {
        const own = incidents.filter((i) => i.reportedBy.id === u.id);
        return { ...u, totalIncidents: own.length, openIncidents: own.filter((i) => i.status !== 'Resuelta').length };
      })
      .filter((u) => !q
        || u.name.toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.dni || '').includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);

    container.innerHTML = `
      <div class="content-header"><div><h1>Usuarios</h1><p>Usuarios finales registrados en el sistema.</p></div></div>
      ${tabsHtml()}
      <div class="toolbar">
        <div class="search-inline" style="max-width:320px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="search" class="input" id="userSearch" placeholder="Buscar por nombre, correo o DNI..." value="${escapeHtml(search)}">
        </div>
      </div>
      <div class="card">
        ${rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Usuario</th><th>DNI</th><th>Correo</th><th>Incidencias creadas</th><th>Sin resolver</th><th>Estado</th><th>Registrado</th><th></th></tr></thead>
            <tbody>
              ${rows.map((u) => `
                <tr>
                  <td class="cell-user">
                    ${u.avatar ? `<img class="avatar" src="${u.avatar}">` : `<span class="avatar">${initials(u.name)}</span>`}
                    <span>${escapeHtml(u.name)}</span>
                  </td>
                  <td class="mono">${escapeHtml(u.dni || '—')}</td>
                  <td>${escapeHtml(u.email || '—')}</td>
                  <td>${u.totalIncidents}</td>
                  <td>${u.openIncidents}</td>
                  <td><span class="pill ${u.active === false ? 'tone-neutral' : 'status-resuelta'}">${u.active === false ? 'Inactivo' : 'Activo'}</span></td>
                  <td class="text-tertiary">${formatDate(u.createdAt)}</td>
                  <td><div class="row-actions">
                    <button type="button" class="action-btn" data-toggle-user="${u.id}" data-next-active="${u.active === false}" title="${u.active === false ? 'Activar' : 'Desactivar'}">${POWER_ICON}</button>
                    <button type="button" class="action-btn danger" data-delete-user="${u.id}" title="Eliminar">${TRASH_ICON}</button>
                  </div></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state"><h4>No hay usuarios que coincidan</h4><p>Ajusta la búsqueda o espera nuevos registros.</p></div>`}
      </div>
    `;

    wireTabs(container);
    container.querySelector('#userSearch').addEventListener('input', debounce((ev) => { search = ev.target.value; render(); }, 250));
    container.querySelectorAll('[data-toggle-user]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nextActive = btn.dataset.nextActive === 'true';
        await userRepo.update(btn.dataset.toggleUser, { active: nextActive });
        App.ui.toast.show({ type: 'success', title: nextActive ? 'Usuario activado' : 'Usuario desactivado' });
        render();
      });
    });
    container.querySelectorAll('[data-delete-user]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const user = rows.find((u) => u.id === btn.dataset.deleteUser);
        if (user.openIncidents > 0) {
          App.ui.toast.show({ type: 'danger', title: 'No se puede eliminar', text: 'Este usuario tiene incidencias sin resolver.' });
          return;
        }
        if (!confirm('¿Eliminar esta cuenta de usuario de forma permanente?')) return;
        await userRepo.remove(btn.dataset.deleteUser);
        App.ui.toast.show({ type: 'success', title: 'Usuario eliminado' });
        render();
      });
    });
  }

  /* ---------------------------- DNIs autorizados ---------------------------- */

  async function renderWhitelist(container, myId) {
    let entries = [];
    let loadError = '';
    try {
      entries = await dniService.listDni();
    } catch (err) {
      loadError = err.message;
    }
    if (myId !== renderId) return;

    container.innerHTML = `
      <div class="content-header"><div><h1>Usuarios</h1><p>DNIs autorizados a registrarse como usuario final.</p></div></div>
      ${tabsHtml()}
      <div class="card" style="margin-bottom:var(--space-4);">
        <form id="addDniForm" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="flex:1;min-width:140px;margin-bottom:0;">
            <label for="newDni">DNI</label>
            <input type="text" id="newDni" class="input" placeholder="Ej. 12345678" inputmode="numeric" maxlength="8" required>
          </div>
          <div class="form-group" style="flex:2;min-width:180px;margin-bottom:0;">
            <label for="newDniName">Nombre completo</label>
            <input type="text" id="newDniName" class="input" placeholder="Ej. María Pérez" required>
          </div>
          <button type="submit" class="btn btn-primary">${PLUS_ICON}<span>Agregar DNI</span></button>
        </form>
      </div>
      <div class="card">
        ${loadError ? `<div class="empty-state"><h4>No se pudo cargar</h4><p>${escapeHtml(loadError)}</p></div>` : (entries.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>DNI</th><th>Nombre</th><th>Agregado</th><th></th></tr></thead>
            <tbody>
              ${entries.map((e) => `
                <tr>
                  <td class="mono">${escapeHtml(e.dni)}</td>
                  <td>${escapeHtml(e.nombre)}</td>
                  <td class="text-tertiary">${formatDate(e.createdAt)}</td>
                  <td><div class="row-actions"><button type="button" class="action-btn danger" data-remove-dni="${e.id}" title="Eliminar">${TRASH_ICON}</button></div></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state"><h4>Sin DNIs autorizados</h4><p>Agrega uno con el formulario de arriba.</p></div>`)}
      </div>
    `;

    wireTabs(container);
    container.querySelector('#addDniForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const dni = container.querySelector('#newDni').value.trim();
      const nombre = container.querySelector('#newDniName').value.trim();
      try {
        await dniService.addDni(dni, nombre);
        App.ui.toast.show({ type: 'success', title: 'DNI agregado' });
        render();
      } catch (err) {
        App.ui.toast.show({ type: 'danger', title: 'No se pudo agregar', text: err.message });
      }
    });
    container.querySelectorAll('[data-remove-dni]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Quitar este DNI de la lista autorizada?')) return;
        try {
          await dniService.removeDni(btn.dataset.removeDni);
          App.ui.toast.show({ type: 'success', title: 'DNI eliminado' });
          render();
        } catch (err) {
          App.ui.toast.show({ type: 'danger', title: 'No se pudo eliminar', text: err.message });
        }
      });
    });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.userManagementView = { render };

})(window.App = window.App || {});
