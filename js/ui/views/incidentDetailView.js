/* =========================================================
   App.ui.views.incidentDetailView — detalle completo de una
   incidencia: descripción, adjuntos, comentarios, historial,
   y acciones según el rol (asignar, cambiar estado/prioridad,
   resolver, eliminar).
   ========================================================= */
(function (App) {
  'use strict';

  const auth = App.services.authService;
  const incidentService = App.services.incidentService;
  const technicianRepo = App.data.technicianRepository;
  const storage = App.data.storageAdapter;
  const { escapeHtml, formatDate, formatRelativeTime, formatMinutes, statusSlug, slug, initials } = App.core.utils;
  const { roles, priorities, statusFlow } = App.config;

  const BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

  function canView(incident, session) {
    if (session.role === roles.ADMIN) return true;
    if (session.role === roles.USER) return incident.reportedBy.id === session.id;
    return incident.assignedTo && incident.assignedTo.id === session.id;
  }

  async function render({ id }) {
    const session = auth.getCurrentSession();
    const container = document.getElementById('viewContainer');
    const incident = await incidentService.getById(id);

    if (!incident || !canView(incident, session)) {
      container.innerHTML = `
        <div class="empty-state">
          <h4>Incidencia no encontrada</h4>
          <p>Puede que haya sido eliminada o no tengas acceso a ella.</p>
          <a href="#/incidencias" class="btn btn-secondary" style="margin-top:8px;">Volver al listado</a>
        </div>`;
      return;
    }

    const technicians = session.role === roles.ADMIN ? await technicianRepo.getActive() : [];
    const categories = session.role === roles.ADMIN ? await storage.getSetting('categories', App.config.defaultCategories) : [];
    const visibleComments = incident.comments.filter((c) => !c.internal || session.role !== roles.USER);
    const canResolve = session.role === roles.TECHNICIAN && incident.assignedTo && incident.assignedTo.id === session.id && incident.status !== 'Resuelta';

    container.innerHTML = `
      <div class="content-header">
        <div>
          <a href="#/incidencias" class="btn btn-ghost btn-sm" style="margin-bottom:8px;">${BACK_ICON}<span>Volver</span></a>
          <h1 class="mono" style="display:flex;align-items:center;gap:10px;">${incident.folio}
            <span class="pill status-${statusSlug(incident.status)}">${incident.status}</span>
            <span class="pill ${incident.priority ? 'priority-' + slug(incident.priority) : 'tone-neutral'}">${escapeHtml(incident.priority || 'Sin asignar')}</span>
          </h1>
          <p>${escapeHtml(incident.title)}</p>
        </div>
        <div style="display:flex;gap:8px;">
          ${canResolve ? '<button type="button" class="btn btn-primary" id="resolveBtn">Marcar como resuelta</button>' : ''}
          ${session.role === roles.ADMIN ? '<button type="button" class="btn btn-secondary" id="editIncidentBtn">Editar</button><button type="button" class="btn btn-danger" id="deleteIncidentBtn">Eliminar</button>' : ''}
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:12px;">Descripción</h3>
            <p style="font-size:var(--fs-sm);color:var(--text-secondary);line-height:1.6;">${escapeHtml(incident.description) || '<span class="text-tertiary">Sin descripción.</span>'}</p>
            ${incident.attachments.length ? `
              <div class="attachment-list" style="margin-top:16px;">
                ${incident.attachments.map((a, i) => `<button type="button" class="attachment-thumb" data-view-attachment="${i}" style="width:96px;height:96px;"><img src="${a}" alt="Adjunto ${i + 1}"></button>`).join('')}
              </div>` : ''}
          </div>

          ${incident.resolution ? `
          <div class="card card-pad">
            <h3 style="margin-bottom:12px;">Resolución</h3>
            <div class="detail-meta-grid">
              <div class="detail-meta-item"><div class="label">Causa</div><div class="value">${escapeHtml(incident.resolution.cause)}</div></div>
              <div class="detail-meta-item"><div class="label">Solución aplicada</div><div class="value">${escapeHtml(incident.resolution.solution)}</div></div>
              <div class="detail-meta-item"><div class="label">Materiales utilizados</div><div class="value">${escapeHtml(incident.resolution.materials) || '—'}</div></div>
              <div class="detail-meta-item"><div class="label">Tiempo empleado</div><div class="value">${formatMinutes(incident.resolution.timeSpentMinutes)}</div></div>
            </div>
          </div>` : ''}

          <div class="card">
            <div class="card-header"><h3>Comentarios</h3></div>
            <div style="padding:0 20px;">
              ${visibleComments.length ? visibleComments.map(commentHtml).join('') : '<p class="text-tertiary" style="padding:16px 0;font-size:var(--fs-sm);">Aún no hay comentarios.</p>'}
            </div>
            <div style="padding:16px 20px;border-top:1px solid var(--border-subtle);">
              <form id="commentForm">
                <div class="form-group">
                  <textarea id="commentText" class="input" placeholder="Escribe un comentario..." style="min-height:64px;" required></textarea>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  ${session.role !== roles.USER ? `
                  <label class="checkbox-row"><input type="checkbox" id="commentInternal"> Comentario interno (solo staff)</label>` : '<span></span>'}
                  <button type="submit" class="btn btn-secondary btn-sm">Comentar</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:14px;">Información</h3>
            <div class="detail-meta-grid">
              <div class="detail-meta-item"><div class="label">Reportado por</div><div class="value">${escapeHtml(incident.reportedBy.name)}</div></div>
              <div class="detail-meta-item"><div class="label">Categoría</div><div class="value">${escapeHtml(incident.category)}</div></div>
              <div class="detail-meta-item"><div class="label">Ubicación</div><div class="value">${escapeHtml(incident.location || '—')}</div></div>
              <div class="detail-meta-item"><div class="label">Creada</div><div class="value">${formatDate(incident.createdAt)}</div></div>
              <div class="detail-meta-item"><div class="label">Última actualización</div><div class="value">${formatRelativeTime(incident.updatedAt)}</div></div>
              <div class="detail-meta-item"><div class="label">Asignada el</div><div class="value">${formatDate(incident.assignedAt)}</div></div>
              <div class="detail-meta-item"><div class="label">Resuelta el</div><div class="value">${formatDate(incident.resolvedAt)}</div></div>
            </div>

            ${session.role === roles.ADMIN ? `
              <form id="triageForm" style="margin-top:4px;">
                <div class="form-group">
                  <label for="priorityAdminSelect">Prioridad</label>
                  <select id="priorityAdminSelect" class="input">
                    <option value="" ${!incident.priority ? 'selected' : ''}>Sin asignar</option>
                    ${priorities.map((p) => `<option value="${p}" ${incident.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label for="assignAdminSelect">Técnico asignado</label>
                  <select id="assignAdminSelect" class="input">
                    <option value="">Sin asignar</option>
                    ${technicians.map((t) => `<option value="${t.id}" ${incident.assignedTo && incident.assignedTo.id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label for="statusAdminSelect">Estado</label>
                  <select id="statusAdminSelect" class="input">${statusFlow.map((s) => `<option value="${s}" ${incident.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Guardar cambios</button>
              </form>
            ` : `
              <div class="detail-meta-item" style="margin-top:8px;"><div class="label">Técnico asignado</div><div class="value">${incident.assignedTo ? escapeHtml(incident.assignedTo.name) : 'Sin asignar'}</div></div>
            `}
            ${session.role === roles.TECHNICIAN && incident.status !== 'Resuelta' && incident.assignedTo && incident.assignedTo.id === session.id ? `
              <div class="form-group" style="margin-top:8px;">
                <label for="statusTechSelect">Actualizar progreso</label>
                <select id="statusTechSelect" class="input">
                  ${['Asignada', 'En Proceso'].map((s) => `<option value="${s}" ${incident.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>` : ''}
          </div>

          <div class="card">
            <div class="card-header"><h3>Historial</h3></div>
            <div class="card-pad">
              <div class="timeline">
                ${incident.history.slice().reverse().map((h) => `
                  <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div>
                      <div class="timeline-text"><strong>${escapeHtml(h.by.name)}</strong> ${escapeHtml(h.action)}</div>
                      <div class="timeline-time">${formatDate(h.at)}</div>
                    </div>
                  </div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    wireActions(container, incident, session);
  }

  function commentHtml(c) {
    return `
      <div class="comment-item">
        <span class="avatar">${initials(c.authorName)}</span>
        <div class="comment-bubble">
          <div class="comment-head"><strong>${escapeHtml(c.authorName)}</strong> <span class="comment-time">${formatRelativeTime(c.at)}</span> ${c.internal ? '<span class="pill tone-neutral">Interno</span>' : ''}</div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
      </div>`;
  }

  function wireActions(container, incident, session) {
    container.querySelectorAll('[data-view-attachment]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = incident.attachments[Number(btn.dataset.viewAttachment)];
        App.ui.modal.open({
          title: 'Adjunto de la incidencia',
          bodyHtml: `<img src="${src}" alt="" style="width:100%;border-radius:var(--radius-md);display:block;">`,
        });
      });
    });

    container.querySelector('#commentForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const text = container.querySelector('#commentText').value.trim();
      if (!text) return;
      const internalEl = container.querySelector('#commentInternal');
      await incidentService.addComment(incident.id, { text, internal: internalEl ? internalEl.checked : false }, session);
      render({ id: incident.id });
    });

    const resolveBtn = container.querySelector('#resolveBtn');
    if (resolveBtn) resolveBtn.addEventListener('click', () => openResolveModal(incident, session));

    const deleteBtn = container.querySelector('#deleteIncidentBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta incidencia de forma permanente?')) return;
      await incidentService.remove(incident.id, session);
      App.ui.toast.show({ type: 'success', title: 'Incidencia eliminada' });
      App.ui.router.navigate('/incidencias');
    });

    const editBtn = container.querySelector('#editIncidentBtn');
    if (editBtn) editBtn.addEventListener('click', () => openEditModal(incident, session));

    const triageForm = container.querySelector('#triageForm');
    if (triageForm) triageForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const submitBtn = triageForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const newPriority = container.querySelector('#priorityAdminSelect').value || null;
        const newTechId = container.querySelector('#assignAdminSelect').value;
        const newStatus = container.querySelector('#statusAdminSelect').value;

        if (newPriority !== (incident.priority || null)) {
          await incidentService.updatePriority(incident.id, newPriority, session);
        }
        if (newTechId && (!incident.assignedTo || incident.assignedTo.id !== newTechId)) {
          await incidentService.assign(incident.id, newTechId, session);
        }
        const latest = await incidentService.getById(incident.id);
        if (newStatus !== latest.status) {
          await incidentService.updateStatus(incident.id, newStatus, session);
        }

        App.ui.toast.show({ type: 'success', title: 'Cambios guardados', text: 'El técnico asignado recibirá una notificación.' });
        render({ id: incident.id });
      } catch (err) {
        App.ui.toast.show({ type: 'danger', title: 'No se pudo guardar', text: err.message });
        submitBtn.disabled = false;
      }
    });

    const statusTechSelect = container.querySelector('#statusTechSelect');
    if (statusTechSelect) statusTechSelect.addEventListener('change', async () => {
      await incidentService.updateStatus(incident.id, statusTechSelect.value, session);
      App.ui.toast.show({ type: 'success', title: 'Estado actualizado' });
      render({ id: incident.id });
    });
  }

  function openResolveModal(incident, session) {
    const { close } = App.ui.modal.open({
      title: 'Resolver incidencia',
      bodyHtml: `
        <form id="resolveForm">
          <div class="form-group"><label for="resCause">Causa raíz</label><textarea id="resCause" class="input" required></textarea></div>
          <div class="form-group"><label for="resSolution">Solución aplicada</label><textarea id="resSolution" class="input" required></textarea></div>
          <div class="form-group"><label for="resMaterials">Materiales utilizados (opcional)</label><input type="text" id="resMaterials" class="input"></div>
          <div class="form-group"><label for="resTime">Tiempo empleado (minutos)</label><input type="number" min="1" id="resTime" class="input" required></div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="resolveForm" class="btn btn-primary">Confirmar resolución</button>
      `,
    });
    const modalEl = document.querySelector('.modal-overlay:last-child');
    modalEl.querySelector('#resolveForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await incidentService.resolve(incident.id, {
        cause: modalEl.querySelector('#resCause').value,
        solution: modalEl.querySelector('#resSolution').value,
        materials: modalEl.querySelector('#resMaterials').value,
        timeSpentMinutes: modalEl.querySelector('#resTime').value,
      }, session);
      App.ui.toast.show({ type: 'success', title: 'Incidencia resuelta' });
      close();
      render({ id: incident.id });
    });
  }

  async function openEditModal(incident, session) {
    const categories = await storage.getSetting('categories', App.config.defaultCategories);
    const { close } = App.ui.modal.open({
      title: 'Editar incidencia',
      bodyHtml: `
        <form id="editForm">
          <div class="form-group"><label for="editTitle">Título</label><input type="text" id="editTitle" class="input" value="${escapeHtml(incident.title)}" required></div>
          <div class="form-group"><label for="editCategory">Categoría</label>
            <select id="editCategory" class="input">${categories.map((c) => `<option value="${escapeHtml(c)}" ${incident.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label for="editDescription">Descripción</label><textarea id="editDescription" class="input">${escapeHtml(incident.description)}</textarea></div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>
        <button type="submit" form="editForm" class="btn btn-primary">Guardar cambios</button>
      `,
    });
    const modalEl = document.querySelector('.modal-overlay:last-child');
    modalEl.querySelector('#editForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await incidentService.update(incident.id, {
        title: modalEl.querySelector('#editTitle').value,
        category: modalEl.querySelector('#editCategory').value,
        description: modalEl.querySelector('#editDescription').value,
      }, session);
      App.ui.toast.show({ type: 'success', title: 'Incidencia actualizada' });
      close();
      render({ id: incident.id });
    });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.incidentDetailView = { render };

})(window.App = window.App || {});
