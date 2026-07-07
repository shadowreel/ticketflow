/* =========================================================
   App.services.auditService
   -----------------------------------------------------------
   Registro automático de auditoría: se suscribe a los eventos
   de negocio que ya emite el resto de la app (eventBus) y guarda
   un registro normalizado por cada uno. No modifica ninguno de
   los servicios que ya emiten esos eventos (solo escucha).
   ========================================================= */
(function (App) {
  'use strict';

  const repo = App.data.auditRepository;
  const bus = App.core.eventBus;

  async function log(entry) {
    if (!entry.actorId) return; // eventos sin autor identificable (defensivo) no se registran
    await repo.create(entry);
  }

  function fromIncident(action, incident) {
    return {
      actorId: action.by.id, actorName: action.by.name, actorRole: action.by.role,
      action: action.action, entityType: 'incident', entityId: incident.id,
      detail: `${incident.folio} · ${incident.title}`,
    };
  }

  function lastHistoryEvent(incident) {
    const last = incident.history[incident.history.length - 1];
    return fromIncident(last, incident);
  }

  function fromPerson(actionLabel, entityType, payload) {
    const actor = payload.actor;
    const name = (payload.record && payload.record.name) || payload.name || null;
    return {
      actorId: actor ? actor.id : null,
      actorName: actor ? actor.name : 'Sistema',
      actorRole: actor ? actor.role : null,
      action: name ? `${actionLabel} a ${name}` : actionLabel,
      entityType,
      entityId: (payload.record && payload.record.id) || payload.id || null,
      detail: name,
    };
  }

  function wireAuditEvents() {
    bus.on('incident:created', (incident) => log(lastHistoryEvent(incident)));
    bus.on('incident:updated', (incident) => log(lastHistoryEvent(incident)));
    bus.on('incident:status-changed', (incident) => log(lastHistoryEvent(incident)));
    bus.on('incident:resolved', (incident) => log(lastHistoryEvent(incident)));
    bus.on('incident:assigned', ({ incident }) => log(lastHistoryEvent(incident)));
    bus.on('incident:reassigned', ({ incident }) => log(lastHistoryEvent(incident)));
    bus.on('incident:comment', ({ incident, comment }) => log({
      actorId: comment.authorId, actorName: comment.authorName, actorRole: comment.role,
      action: comment.internal ? 'agregó un comentario interno' : 'agregó un comentario',
      entityType: 'incident', entityId: incident.id, detail: `${incident.folio}: ${comment.text}`,
    }));
    bus.on('incident:deleted', ({ id, by }) => log({
      actorId: by.id, actorName: by.name, actorRole: by.role,
      action: 'eliminó la incidencia', entityType: 'incident', entityId: id, detail: null,
    }));

    bus.on('technician:created', (p) => log(fromPerson('creó al técnico', 'technician', p)));
    bus.on('technician:updated', (p) => log(fromPerson('editó al técnico', 'technician', p)));
    bus.on('technician:deleted', (p) => log(fromPerson('eliminó al técnico', 'technician', p)));

    bus.on('admin:created', (p) => log(fromPerson('creó al administrador', 'admin', p)));
    bus.on('admin:updated', (p) => log(fromPerson('editó al administrador', 'admin', p)));
    bus.on('admin:deleted', (p) => log(fromPerson('eliminó al administrador', 'admin', p)));

    bus.on('user:registered', (session) => log({
      actorId: session.id, actorName: session.name, actorRole: session.role,
      action: 'se registró en el sistema', entityType: 'auth', entityId: session.id, detail: null,
    }));
    bus.on('auth:login', (session) => log({
      actorId: session.id, actorName: session.name, actorRole: session.role,
      action: 'inició sesión', entityType: 'auth', entityId: session.id, detail: null,
    }));
    bus.on('auth:logout', (session) => {
      if (!session || !session.id) return;
      log({
        actorId: session.id, actorName: session.name, actorRole: session.role,
        action: 'cerró sesión', entityType: 'auth', entityId: session.id, detail: null,
      });
    });
    bus.on('profile:updated', (session) => log({
      actorId: session.id, actorName: session.name, actorRole: session.role,
      action: 'actualizó su perfil', entityType: 'profile', entityId: session.id, detail: null,
    }));
  }

  async function list({ actorQuery, entityType, actorRole, from, to, textQuery } = {}) {
    let all = (await repo.getAll()).slice().sort((a, b) => b.createdAt - a.createdAt);
    if (actorQuery && actorQuery.trim()) {
      const q = actorQuery.trim().toLowerCase();
      all = all.filter((e) => (e.actorName || '').toLowerCase().includes(q));
    }
    if (entityType && entityType !== 'Todas') all = all.filter((e) => e.entityType === entityType);
    if (actorRole && actorRole !== 'Todos') all = all.filter((e) => e.actorRole === actorRole);
    if (from) all = all.filter((e) => e.createdAt >= from);
    if (to) all = all.filter((e) => e.createdAt <= to);
    if (textQuery && textQuery.trim()) {
      const q = textQuery.trim().toLowerCase();
      all = all.filter((e) => (e.action || '').toLowerCase().includes(q) || (e.detail || '').toLowerCase().includes(q));
    }
    return all;
  }

  async function recentActivity(sinceMs) {
    const since = Date.now() - sinceMs;
    return (await repo.getAll()).filter((e) => e.createdAt >= since).sort((a, b) => b.createdAt - a.createdAt);
  }

  App.services = App.services || {};
  App.services.auditService = { wireAuditEvents, list, recentActivity };

})(window.App = window.App || {});
