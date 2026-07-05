/* =========================================================
   App.services.incidentService
   -----------------------------------------------------------
   Reglas de negocio del ciclo de vida completo de una incidencia.
   Emite eventos al eventBus en cada paso del flujo; quien genera
   las notificaciones reales a partir de esos eventos es
   notificationService (conectado en la etapa de notificaciones).
   ========================================================= */
(function (App) {
  'use strict';

  const repo = App.data.incidentRepository;
  const technicianRepo = App.data.technicianRepository;
  const bus = App.core.eventBus;
  const { roles, maxAttachments, statusFlow } = App.config;

  function actorRef(session) {
    return { id: session.id, name: session.name, role: session.role };
  }

  function historyEntry(action, session, detail) {
    return { action, by: actorRef(session), at: Date.now(), detail: detail || null };
  }

  async function listForSession(session) {
    if (session.role === roles.USER) return repo.getByUser(session.id);
    if (session.role === roles.TECHNICIAN) return repo.getByTechnician(session.id);
    return repo.getAll();
  }

  async function getById(id) { return repo.getById(id); }

  async function create({ title, description, category, priority, attachments }, session) {
    const folio = await repo.nextFolio();
    const now = Date.now();
    const record = {
      folio,
      title: title.trim(),
      description: (description || '').trim(),
      category,
      priority,
      status: 'Pendiente',
      reportedBy: { id: session.id, name: session.name, email: session.email },
      assignedTo: null,
      attachments: (attachments || []).slice(0, maxAttachments),
      comments: [],
      resolution: null,
      history: [historyEntry('creó la incidencia', session)],
      createdAt: now,
      updatedAt: now,
      assignedAt: null,
      resolvedAt: null,
    };
    const created = await repo.create(record);
    bus.emit('incident:created', created);
    return created;
  }

  async function update(id, patch, session) {
    const current = await repo.getById(id);
    if (!current) throw new Error('Incidencia no encontrada.');
    const updated = await repo.update(id, {
      ...patch,
      updatedAt: Date.now(),
      history: [...current.history, historyEntry('editó los datos de la incidencia', session)],
    });
    bus.emit('incident:updated', updated);
    return updated;
  }

  async function assign(id, technicianId, session) {
    const current = await repo.getById(id);
    if (!current) throw new Error('Incidencia no encontrada.');
    const tech = await technicianRepo.getById(technicianId);
    if (!tech) throw new Error('Técnico no encontrado.');
    const wasAssigned = !!current.assignedTo;
    const now = Date.now();
    const action = wasAssigned ? `reasignó la incidencia a ${tech.name}` : `asignó la incidencia a ${tech.name}`;
    const updated = await repo.update(id, {
      assignedTo: { id: tech.id, name: tech.name },
      status: current.status === 'Pendiente' ? 'Asignada' : current.status,
      assignedAt: now,
      updatedAt: now,
      history: [...current.history, historyEntry(action, session)],
    });
    bus.emit(wasAssigned ? 'incident:reassigned' : 'incident:assigned', { incident: updated, previousTechnicianId: wasAssigned ? current.assignedTo.id : null });
    return updated;
  }

  async function updateStatus(id, status, session) {
    if (!statusFlow.includes(status)) throw new Error('Estado inválido.');
    const current = await repo.getById(id);
    if (!current) throw new Error('Incidencia no encontrada.');
    const updated = await repo.update(id, {
      status,
      updatedAt: Date.now(),
      history: [...current.history, historyEntry(`cambió el estado a "${status}"`, session)],
    });
    bus.emit('incident:status-changed', updated);
    return updated;
  }

  async function updatePriority(id, priority, session) {
    const current = await repo.getById(id);
    if (!current) throw new Error('Incidencia no encontrada.');
    const updated = await repo.update(id, {
      priority,
      updatedAt: Date.now(),
      history: [...current.history, historyEntry(`cambió la prioridad a "${priority}"`, session)],
    });
    bus.emit('incident:updated', updated);
    return updated;
  }

  async function addComment(id, { text, internal }, session) {
    const current = await repo.getById(id);
    if (!current) throw new Error('Incidencia no encontrada.');
    const comment = {
      id: App.core.utils.uuid(), authorId: session.id, authorName: session.name,
      role: session.role, text: text.trim(), internal: !!internal, at: Date.now(),
    };
    const updated = await repo.update(id, {
      comments: [...current.comments, comment],
      updatedAt: Date.now(),
    });
    bus.emit('incident:comment', { incident: updated, comment });
    return updated;
  }

  async function resolve(id, { cause, solution, materials, timeSpentMinutes }, session) {
    const current = await repo.getById(id);
    if (!current) throw new Error('Incidencia no encontrada.');
    const now = Date.now();
    const updated = await repo.update(id, {
      status: 'Resuelta',
      resolution: { cause, solution, materials: materials || '', timeSpentMinutes: Number(timeSpentMinutes) || 0, resolvedAt: now },
      resolvedAt: now,
      updatedAt: now,
      history: [...current.history, historyEntry('marcó la incidencia como resuelta', session)],
    });
    bus.emit('incident:resolved', updated);
    return updated;
  }

  async function remove(id, session) {
    const ok = await repo.remove(id);
    if (ok) bus.emit('incident:deleted', { id, by: actorRef(session) });
    return ok;
  }

  App.services = App.services || {};
  App.services.incidentService = {
    listForSession, getById, create, update, assign, updateStatus,
    updatePriority, addComment, resolve, remove,
  };

})(window.App = window.App || {});
