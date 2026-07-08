/* =========================================================
   App.ui.views.locationManagementView — administración de
   ubicaciones (solo admin): alta, edición, activar/desactivar,
   reordenar y eliminar. Interfaz propia, con su ítem en el menú.
   ========================================================= */
(function (App) {
  'use strict';

  const locationService = App.services.locationService;
  const { escapeHtml } = App.core.utils;

  const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
  const UP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>';
  const DOWN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  const POWER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>';
  const EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

  async function render() {
    const container = document.getElementById('viewContainer');
    if (!container.querySelector('.data-table')) container.innerHTML = App.ui.skeleton.table(4);
    const locations = await locationService.listAll();

    container.innerHTML = `
      <div class="content-header">
        <div><h1>Ubicaciones</h1><p>Lugares donde puede ocurrir una incidencia (no se limita a laboratorios).</p></div>
      </div>

      <div class="card card-pad" style="margin-bottom:var(--space-5);">
        <form id="addLocationForm" style="display:flex;gap:8px;flex-wrap:wrap;max-width:420px;">
          <input type="text" id="newLocation" class="input" style="flex:1;min-width:180px;" placeholder="Ej. Biblioteca, Aula 101, Dirección...">
          <button type="submit" class="btn btn-primary">Agregar ubicación</button>
        </form>
      </div>

      <div class="card">
        ${locations.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Ubicación</th><th>Estado</th><th></th></tr></thead>
            <tbody id="locationTableBody"></tbody>
          </table>
        </div>` : `
        <div class="empty-state"><h4>Sin ubicaciones registradas</h4><p>Agrega la primera con el formulario de arriba.</p></div>`}
      </div>
    `;

    if (locations.length) renderRows(locations);
    wireAddForm();
  }

  function renderRows(locations) {
    const body = document.getElementById('locationTableBody');
    body.innerHTML = locations.map((l, i) => `
      <tr>
        <td id="loc-name-${l.id}">${escapeHtml(l.name)}</td>
        <td><span class="pill ${l.active === false ? 'tone-neutral' : 'priority-baja'}">${l.active === false ? 'Inactiva' : 'Activa'}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" class="action-btn" data-edit-loc="${l.id}" title="Renombrar">${EDIT_ICON}</button>
            <button type="button" class="action-btn" data-move-loc="${l.id}" data-dir="-1" title="Subir" ${i === 0 ? 'disabled' : ''}>${UP_ICON}</button>
            <button type="button" class="action-btn" data-move-loc="${l.id}" data-dir="1" title="Bajar" ${i === locations.length - 1 ? 'disabled' : ''}>${DOWN_ICON}</button>
            <button type="button" class="action-btn" data-toggle-loc="${l.id}" data-next-active="${l.active === false}" title="${l.active === false ? 'Activar' : 'Desactivar'}">${POWER_ICON}</button>
            <button type="button" class="action-btn danger" data-remove-loc="${l.id}" title="Eliminar">${TRASH_ICON}</button>
          </div>
        </td>
      </tr>`).join('');

    body.querySelectorAll('[data-edit-loc]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const current = locations.find((l) => l.id === btn.dataset.editLoc);
        const next = prompt('Nuevo nombre de la ubicación:', current.name);
        if (!next || !next.trim() || next.trim() === current.name) return;
        await locationService.rename(current.id, next.trim());
        render();
      });
    });
    body.querySelectorAll('[data-remove-loc]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta ubicación? Las incidencias ya creadas conservan el nombre que tenían.')) return;
        await locationService.remove(btn.dataset.removeLoc);
        render();
      });
    });
    body.querySelectorAll('[data-toggle-loc]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await locationService.setActive(btn.dataset.toggleLoc, btn.dataset.nextActive === 'true');
        render();
      });
    });
    body.querySelectorAll('[data-move-loc]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await locationService.move(btn.dataset.moveLoc, Number(btn.dataset.dir));
        render();
      });
    });
  }

  function wireAddForm() {
    document.getElementById('addLocationForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const input = document.getElementById('newLocation');
      const value = input.value.trim();
      if (!value) return;
      try {
        await locationService.create(value);
        input.value = '';
        App.ui.toast.show({ type: 'success', title: 'Ubicación agregada' });
        render();
      } catch (err) {
        App.ui.toast.show({ type: 'danger', title: 'No se pudo agregar', text: err.message });
      }
    });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.locationManagementView = { render };

})(window.App = window.App || {});
