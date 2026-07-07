/* =========================================================
   App.ui.views.auditView — historial de auditoría (solo admin)
   ========================================================= */
(function (App) {
  'use strict';

  const auditService = App.services.auditService;
  const { escapeHtml, formatDate } = App.core.utils;

  const AUDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6M9 16h6M9 8h6M5 21h14a2 2 0 002-2V7l-5-5H5a2 2 0 00-2 2v15a2 2 0 002 2z"/></svg>';

  const ENTITY_LABELS = { incident: 'Incidencias', technician: 'Técnicos', admin: 'Administradores', auth: 'Sesión', profile: 'Perfil' };
  const ROLE_LABELS = { admin: 'Administrador', technician: 'Técnico', user: 'Usuario' };

  let state = { actorQuery: '', entityType: 'Todas', actorRole: 'Todos', from: '', to: '' };

  async function render() {
    const container = document.getElementById('viewContainer');
    if (!container.querySelector('.data-table')) container.innerHTML = App.ui.skeleton.table(6);

    const entries = await auditService.list({
      actorQuery: state.actorQuery,
      entityType: state.entityType,
      actorRole: state.actorRole,
      from: state.from ? new Date(state.from).getTime() : null,
      to: state.to ? new Date(state.to).getTime() + 86399999 : null,
    });

    container.innerHTML = `
      <div class="content-header">
        <div><h1>Auditoría</h1><p>Registro histórico de acciones realizadas en el sistema. Nunca se elimina automáticamente.</p></div>
      </div>

      <div class="toolbar">
        <div class="search-inline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="search" class="input" id="auditActorSearch" placeholder="Buscar por usuario o técnico..." value="${escapeHtml(state.actorQuery)}">
        </div>
        <select class="input" id="auditEntityFilter" style="width:auto;height:32px;">
          <option value="Todas" ${state.entityType === 'Todas' ? 'selected' : ''}>Todo tipo de acción</option>
          ${Object.entries(ENTITY_LABELS).map(([k, label]) => `<option value="${k}" ${state.entityType === k ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <select class="input" id="auditRoleFilter" style="width:auto;height:32px;">
          <option value="Todos" ${state.actorRole === 'Todos' ? 'selected' : ''}>Todos los roles</option>
          ${Object.entries(ROLE_LABELS).map(([k, label]) => `<option value="${k}" ${state.actorRole === k ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <input type="date" class="input" id="auditFromDate" style="width:auto;height:32px;" value="${state.from}">
        <input type="date" class="input" id="auditToDate" style="width:auto;height:32px;" value="${state.to}">
      </div>

      <div class="card">
        ${entries.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              ${entries.map(rowHtml).join('')}
            </tbody>
          </table>
        </div>` : `
        <div class="empty-state">
          ${AUDIT_ICON}
          <h4>Sin registros para estos filtros</h4>
          <p>Ajusta los filtros o espera nueva actividad en el sistema.</p>
        </div>`}
      </div>
    `;

    wireFilters(container);
  }

  function rowHtml(e) {
    return `
      <tr>
        <td class="text-tertiary">${formatDate(e.createdAt)}</td>
        <td>${escapeHtml(e.actorName || '—')}</td>
        <td><span class="pill tone-neutral">${escapeHtml(ROLE_LABELS[e.actorRole] || e.actorRole || '—')}</span></td>
        <td>${escapeHtml(e.action || '—')}</td>
        <td class="text-tertiary">${escapeHtml(e.detail || '—')}</td>
      </tr>`;
  }

  function wireFilters(container) {
    const search = container.querySelector('#auditActorSearch');
    search.addEventListener('input', App.core.utils.debounce((ev) => { state.actorQuery = ev.target.value; render(); }, 250));
    container.querySelector('#auditEntityFilter').addEventListener('change', (ev) => { state.entityType = ev.target.value; render(); });
    container.querySelector('#auditRoleFilter').addEventListener('change', (ev) => { state.actorRole = ev.target.value; render(); });
    container.querySelector('#auditFromDate').addEventListener('change', (ev) => { state.from = ev.target.value; render(); });
    container.querySelector('#auditToDate').addEventListener('change', (ev) => { state.to = ev.target.value; render(); });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.auditView = { render };

})(window.App = window.App || {});
