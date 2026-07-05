/* =========================================================
   App.ui.views.userManagementView — administración de usuarios
   finales (solo admin): listado, búsqueda y eliminación.
   ========================================================= */
(function (App) {
  'use strict';

  const userRepo = App.data.userRepository;
  const incidentRepo = App.data.incidentRepository;
  const { escapeHtml, formatDate, initials, debounce } = App.core.utils;

  const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';

  let search = '';

  async function render() {
    const container = document.getElementById('viewContainer');
    const [users, incidents] = await Promise.all([userRepo.getAll(), incidentRepo.getAll()]);

    const rows = users
      .map((u) => {
        const own = incidents.filter((i) => i.reportedBy.id === u.id);
        return { ...u, totalIncidents: own.length, openIncidents: own.filter((i) => i.status !== 'Resuelta').length };
      })
      .filter((u) => !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt);

    container.innerHTML = `
      <div class="content-header"><div><h1>Usuarios</h1><p>Usuarios finales registrados en el sistema.</p></div></div>
      <div class="toolbar">
        <div class="search-inline" style="max-width:320px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="search" class="input" id="userSearch" placeholder="Buscar por nombre o correo..." value="${escapeHtml(search)}">
        </div>
      </div>
      <div class="card">
        ${rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Incidencias creadas</th><th>Sin resolver</th><th>Registrado</th><th></th></tr></thead>
            <tbody>
              ${rows.map((u) => `
                <tr>
                  <td class="cell-user">
                    ${u.avatar ? `<img class="avatar" src="${u.avatar}">` : `<span class="avatar">${initials(u.name)}</span>`}
                    <span>${escapeHtml(u.name)}</span>
                  </td>
                  <td>${escapeHtml(u.email)}</td>
                  <td>${u.totalIncidents}</td>
                  <td>${u.openIncidents}</td>
                  <td class="text-tertiary">${formatDate(u.createdAt)}</td>
                  <td><div class="row-actions"><button type="button" class="action-btn danger" data-delete-user="${u.id}" title="Eliminar">${TRASH_ICON}</button></div></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty-state"><h4>No hay usuarios que coincidan</h4><p>Ajusta la búsqueda o espera nuevos registros.</p></div>`}
      </div>
    `;

    container.querySelector('#userSearch').addEventListener('input', debounce((ev) => { search = ev.target.value; render(); }, 250));
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

  App.ui.views = App.ui.views || {};
  App.ui.views.userManagementView = { render };

})(window.App = window.App || {});
