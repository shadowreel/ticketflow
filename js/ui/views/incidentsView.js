/* =========================================================
   App.ui.views.incidentsView — listado de incidencias
   (creación para usuario, gestión completa para admin,
   tareas asignadas para técnico)
   ========================================================= */
(function (App) {
  'use strict';

  const auth = App.services.authService;
  const incidentService = App.services.incidentService;
  const storage = App.data.storageAdapter;
  const technicianRepo = App.data.technicianRepository;
  const { escapeHtml, formatDate, statusSlug, slug, compressImage } = App.core.utils;
  const { roles, priorities, maxAttachments, maxAttachmentDimension, attachmentQuality } = App.config;

  const TICKET_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V9z"/></svg>';
  const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
  const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>';

  let state = { statusFilter: 'Todas', search: '', priorityFilter: 'Todas' };
  let pendingAttachments = [];

  function presetSearch(query) {
    state = { statusFilter: 'Todas', search: query, priorityFilter: 'Todas' };
  }

  function statusChip(status) { return `<button type="button" class="chip ${state.statusFilter === status ? 'active' : ''}" data-status="${status}">${status}</button>`; }

  async function render() {
    const session = auth.getCurrentSession();
    const container = document.getElementById('viewContainer');
    if (!container.querySelector('.data-table')) container.innerHTML = App.ui.skeleton.table(5);
    const all = await incidentService.listForSession(session);
    const categories = await storage.getSetting('categories', App.config.defaultCategories);
    const activeLocations = await App.services.locationService.listActive();
    const technicians = session.role === roles.ADMIN ? await technicianRepo.getActive() : [];

    const statuses = session.role === roles.TECHNICIAN
      ? ['Todas', 'Asignada', 'En Proceso', 'Resuelta']
      : ['Todas', 'Pendiente', 'Asignada', 'En Proceso', 'Resuelta'];

    let filtered = all;
    if (state.statusFilter !== 'Todas') filtered = filtered.filter((i) => i.status === state.statusFilter);
    if (state.priorityFilter !== 'Todas') {
      filtered = state.priorityFilter === '__unassigned__'
        ? filtered.filter((i) => !i.priority)
        : filtered.filter((i) => i.priority === state.priorityFilter);
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      filtered = filtered.filter((i) => i.folio.toLowerCase().includes(q) || i.title.toLowerCase().includes(q));
    }
    filtered = filtered.slice().sort((a, b) => b.createdAt - a.createdAt);

    container.innerHTML = `
      <div class="content-header">
        <div>
          <h1>${session.role === roles.USER ? 'Mis incidencias' : session.role === roles.TECHNICIAN ? 'Mis tareas' : 'Incidencias'}</h1>
          <p>${session.role === roles.USER ? 'Reporta y da seguimiento a tus incidencias.' : session.role === roles.TECHNICIAN ? 'Incidencias que el administrador te ha asignado.' : 'Gestión completa de incidencias del sistema.'}</p>
        </div>
        ${session.role === roles.USER ? `<button type="button" class="btn btn-primary" id="newIncidentBtn">${TICKET_ICON}<span>Nueva incidencia</span></button>` : ''}
      </div>

      <div class="toolbar">
        <div class="chip-group" id="statusChips">${statuses.map(statusChip).join('')}</div>
        ${session.role === roles.ADMIN ? `
          <select class="input" id="priorityFilter" style="width:auto;height:32px;">
            <option value="Todas">Toda prioridad</option>
            <option value="__unassigned__" ${state.priorityFilter === '__unassigned__' ? 'selected' : ''}>Sin asignar</option>
            ${priorities.map((p) => `<option value="${p}" ${state.priorityFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>` : ''}
        <div class="search-inline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="search" class="input" id="incidentSearch" placeholder="Buscar por folio o título..." value="${escapeHtml(state.search)}">
        </div>
      </div>

      <div class="card">
        ${filtered.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Folio</th><th>Título</th>
              ${session.role === roles.ADMIN ? '<th>Usuario</th>' : ''}
              <th>Categoría</th><th>Ubicación</th><th>Prioridad</th><th>Estado</th>
              ${session.role !== roles.USER ? '' : '<th>Técnico</th>'}
              ${session.role === roles.ADMIN ? '<th>Técnico</th>' : ''}
              <th>Fecha</th><th></th>
            </tr></thead>
            <tbody>
              ${filtered.map((inc) => rowHtml(inc, session, technicians)).join('')}
            </tbody>
          </table>
        </div>` : `
        <div class="empty-state">
          ${TICKET_ICON}
          <h4>No hay incidencias para mostrar</h4>
          <p>${session.role === roles.USER ? 'Crea tu primera incidencia con el botón "Nueva incidencia".' : 'Ajusta los filtros o espera nuevas incidencias.'}</p>
        </div>`}
      </div>
    `;

    wireToolbar(container, session);
    wireRowActions(container, session);

    if (session.role === roles.USER) {
      document.getElementById('newIncidentBtn').addEventListener('click', () => openCreateModal(session, categories, activeLocations));
    }
  }

  function rowHtml(inc, session, technicians) {
    return `
      <tr data-id="${inc.id}">
        <td class="cell-id">${inc.folio}</td>
        <td class="cell-title" title="${escapeHtml(inc.title)}">${escapeHtml(inc.title)}</td>
        ${session.role === roles.ADMIN ? `<td>${escapeHtml(inc.reportedBy.name)}</td>` : ''}
        <td>${escapeHtml(inc.category)}</td>
        <td>${escapeHtml(inc.location || '—')}</td>
        <td><span class="pill ${inc.priority ? 'priority-' + slug(inc.priority) : 'tone-neutral'}">${escapeHtml(inc.priority || 'Sin asignar')}</span></td>
        <td>
          ${session.role === roles.ADMIN ? `
          <select class="input status-select" data-id="${inc.id}" style="height:30px;padding:0 8px;">
            ${App.config.statusFlow.map((s) => `<option value="${s}" ${inc.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>` : `<span class="pill status-${statusSlug(inc.status)}">${inc.status}</span>`}
        </td>
        ${session.role !== roles.USER ? '' : `<td>${inc.assignedTo ? escapeHtml(inc.assignedTo.name) : '<span class="text-tertiary">Sin asignar</span>'}</td>`}
        ${session.role === roles.ADMIN ? `
        <td>
          <select class="input assign-select" data-id="${inc.id}" style="height:30px;padding:0 8px;">
            <option value="">Sin asignar</option>
            ${technicians.map((t) => `<option value="${t.id}" ${inc.assignedTo && inc.assignedTo.id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
        </td>` : ''}
        <td class="text-tertiary">${formatDate(inc.createdAt)}</td>
        <td>
          <div class="row-actions">
            <a class="action-btn" href="#/incidencias/${inc.id}" title="Ver detalle">${EYE_ICON}</a>
            ${session.role === roles.ADMIN ? `<button type="button" class="action-btn danger" data-delete="${inc.id}" title="Eliminar">${TRASH_ICON}</button>` : ''}
          </div>
        </td>
      </tr>`;
  }

  function wireToolbar(container, session) {
    container.querySelectorAll('#statusChips [data-status]').forEach((btn) => {
      btn.addEventListener('click', () => { state.statusFilter = btn.dataset.status; render(); });
    });
    const search = container.querySelector('#incidentSearch');
    if (search) search.addEventListener('input', App.core.utils.debounce((ev) => { state.search = ev.target.value; render(); }, 250));
    const prio = container.querySelector('#priorityFilter');
    if (prio) prio.addEventListener('change', (ev) => { state.priorityFilter = ev.target.value; render(); });
  }

  function wireRowActions(container, session) {
    container.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta incidencia de forma permanente?')) return;
        await incidentService.remove(btn.dataset.delete, session);
        App.ui.toast.show({ type: 'success', title: 'Incidencia eliminada' });
        render();
      });
    });
    container.querySelectorAll('.status-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        await incidentService.updateStatus(sel.dataset.id, sel.value, session);
        App.ui.toast.show({ type: 'success', title: 'Estado actualizado' });
        render();
      });
    });
    container.querySelectorAll('.assign-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        if (!sel.value) return;
        await incidentService.assign(sel.dataset.id, sel.value, session);
        App.ui.toast.show({ type: 'success', title: 'Técnico asignado' });
        render();
      });
    });
  }

  function attachmentsPreviewHtml() {
    return pendingAttachments.map((a, i) => `
      <div class="attachment-thumb">
        <img src="${a}" alt="">
        <button type="button" class="remove-attachment" data-remove-att="${i}">${CLOSE_ICON}</button>
      </div>`).join('');
  }

  function openCreateModal(session, categories, activeLocations) {
    pendingAttachments = [];
    const { close } = App.ui.modal.open({
      title: 'Nueva incidencia',
      size: 'lg',
      bodyHtml: `
        <form id="createIncidentForm">
          <div class="form-group">
            <label for="incTitle">Título</label>
            <input type="text" id="incTitle" class="input" placeholder="Ej. No enciende la impresora del área de ventas" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="incCategory">Categoría</label>
              <select id="incCategory" class="input">${categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
            </div>
            <div class="form-group">
              <label for="incLocation">📍 Ubicación de la incidencia</label>
              <select id="incLocation" class="input" required>
                <option value="" disabled selected>Selecciona una ubicación...</option>
                ${activeLocations.map((l) => `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="incDescription">Descripción detallada</label>
            <textarea id="incDescription" class="input" placeholder="Describe el problema con el mayor detalle posible..." required></textarea>
          </div>
          <div class="form-group">
            <label>Imágenes del problema (máx. ${maxAttachments})</label>
            <label class="file-drop" id="fileDrop">
              ${UPLOAD_ICON}
              <span>Haz clic para adjuntar una imagen</span>
              <input type="file" id="attachmentInput" accept="image/*" hidden>
            </label>
            <div class="attachment-list" id="attachmentList"></div>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="createIncidentForm" class="btn btn-primary" id="createIncidentSubmit">Crear incidencia</button>
      `,
    });

    const modalEl = document.querySelector('.modal-overlay:last-child');
    const fileInput = modalEl.querySelector('#attachmentInput');
    const submitBtn = modalEl.querySelector('#createIncidentSubmit');
    let pendingUpload = null; // Promise de la compresión en curso, o null si no hay ninguna

    // #fileDrop es un <label> que envuelve este <input>: el navegador ya abre el
    // selector de archivos al hacer clic en cualquier parte de la etiqueta, sin JS.
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (pendingAttachments.length >= maxAttachments) {
        App.ui.toast.show({ type: 'danger', title: `Máximo ${maxAttachments} imágenes` });
        return;
      }
      fileInput.value = '';
      submitBtn.disabled = true;
      pendingUpload = compressImage(file, maxAttachmentDimension, attachmentQuality)
        .then((dataUrl) => {
          pendingAttachments.push(dataUrl);
          modalEl.querySelector('#attachmentList').innerHTML = attachmentsPreviewHtml();
          wireAttachmentRemoval(modalEl);
        })
        .catch((err) => {
          App.ui.toast.show({ type: 'danger', title: 'No se pudo procesar la imagen', text: err.message });
        })
        .finally(() => {
          pendingUpload = null;
          submitBtn.disabled = false;
        });
    });

    modalEl.querySelector('#createIncidentForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      // Si el usuario envía el formulario justo después de elegir una imagen, se
      // espera a que termine de comprimirse antes de guardar (evita crear la
      // incidencia sin el adjunto por una condición de carrera).
      if (pendingUpload) await pendingUpload;
      const title = modalEl.querySelector('#incTitle').value;
      const category = modalEl.querySelector('#incCategory').value;
      const location = modalEl.querySelector('#incLocation').value;
      const description = modalEl.querySelector('#incDescription').value;
      try {
        await incidentService.create({ title, category, location, description, attachments: pendingAttachments }, session);
        App.ui.toast.show({ type: 'success', title: 'Incidencia creada', text: 'El administrador la revisará pronto.' });
        close();
        render();
      } catch (err) {
        App.ui.toast.show({ type: 'danger', title: 'No se pudo crear la incidencia', text: err.message });
      }
    });
  }

  function wireAttachmentRemoval(modalEl) {
    modalEl.querySelectorAll('[data-remove-att]').forEach((btn) => {
      btn.addEventListener('click', () => {
        pendingAttachments.splice(Number(btn.dataset.removeAtt), 1);
        modalEl.querySelector('#attachmentList').innerHTML = attachmentsPreviewHtml();
        wireAttachmentRemoval(modalEl);
      });
    });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.incidentsView = { render, presetSearch };

})(window.App = window.App || {});
