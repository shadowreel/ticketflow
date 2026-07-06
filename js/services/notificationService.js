/* =========================================================
   App.services.notificationService
   -----------------------------------------------------------
   Consulta de notificaciones por destinatario. La generación
   automática de notificaciones reales a partir de eventos del
   ciclo de vida de una incidencia se conecta en incidentService
   (incident:created/assigned/status-changed/resolved -> aquí).
   ========================================================= */
(function (App) {
  'use strict';

  const repo = App.data.notificationRepository;
  const bus = App.core.eventBus;

  async function listForCurrent(session) {
    return repo.getForRecipient(session.id);
  }

  async function unreadCountForCurrent(session) {
    return repo.unreadCount(session.id);
  }

  async function markRead(id) {
    const updated = await repo.markRead(id);
    bus.emit('notification:changed', {});
    return updated;
  }

  async function markAllReadForCurrent(session) {
    await repo.markAllRead(session.id);
    bus.emit('notification:changed', {});
  }

  async function notify({ recipientId, type, title, message, relatedIncidentId }) {
    const record = await repo.create({ recipientId, type, title, message, relatedIncidentId: relatedIncidentId || null });
    bus.emit('notification:changed', {});
    return record;
  }

  async function getAdminIds() {
    const admins = await App.data.adminRepository.getAll();
    return admins.map((a) => a.id);
  }

  function lastActor(incident) {
    const last = incident.history[incident.history.length - 1];
    return last ? last.by : null;
  }

  /**
   * Conecta el ciclo de vida de una incidencia (eventBus) con la
   * generación de notificaciones reales. Se llama una sola vez al
   * iniciar la aplicación.
   */
  function wireIncidentEvents() {
    const T = App.config.notificationTypes;

    bus.on('incident:created', async (incident) => {
      const adminIds = await getAdminIds();
      for (const adminId of adminIds) {
        await notify({
          recipientId: adminId, type: T.INCIDENT_CREATED,
          title: 'Nueva incidencia reportada', message: `${incident.folio} · ${incident.title}`,
          relatedIncidentId: incident.id,
        });
      }
    });

    bus.on('incident:assigned', async ({ incident }) => {
      await notify({
        recipientId: incident.assignedTo.id, type: T.INCIDENT_ASSIGNED,
        title: 'Nueva tarea asignada', message: `${incident.folio} · ${incident.title}`,
        relatedIncidentId: incident.id,
      });
      await notify({
        recipientId: incident.reportedBy.id, type: T.INCIDENT_ASSIGNED,
        title: 'Tu incidencia fue asignada', message: `${incident.folio} está siendo atendida por ${incident.assignedTo.name}.`,
        relatedIncidentId: incident.id,
      });
    });

    bus.on('incident:reassigned', async ({ incident, previousTechnicianId }) => {
      await notify({
        recipientId: incident.assignedTo.id, type: T.INCIDENT_REASSIGNED,
        title: 'Nueva tarea asignada', message: `${incident.folio} · ${incident.title}`,
        relatedIncidentId: incident.id,
      });
      if (previousTechnicianId && previousTechnicianId !== incident.assignedTo.id) {
        await notify({
          recipientId: previousTechnicianId, type: T.INCIDENT_REASSIGNED,
          title: 'Tarea reasignada', message: `Ya no estás a cargo de ${incident.folio}.`,
          relatedIncidentId: incident.id,
        });
      }
    });

    bus.on('incident:status-changed', async (incident) => {
      const actor = lastActor(incident);
      if (actor && actor.id === incident.reportedBy.id) return;
      await notify({
        recipientId: incident.reportedBy.id, type: T.INCIDENT_STATUS_CHANGED,
        title: `Tu incidencia está "${incident.status}"`, message: `${incident.folio} · ${incident.title}`,
        relatedIncidentId: incident.id,
      });
    });

    bus.on('incident:resolved', async (incident) => {
      const adminIds = await getAdminIds();
      for (const adminId of adminIds) {
        await notify({
          recipientId: adminId, type: T.INCIDENT_RESOLVED,
          title: 'Incidencia resuelta', message: `${incident.folio} · ${incident.title}`,
          relatedIncidentId: incident.id,
        });
      }
      await notify({
        recipientId: incident.reportedBy.id, type: T.INCIDENT_RESOLVED,
        title: 'Tu incidencia fue resuelta', message: `${incident.folio} · ${incident.title}`,
        relatedIncidentId: incident.id,
      });
    });

    bus.on('incident:comment', async ({ incident, comment }) => {
      if (comment.internal) {
        const adminIds = await getAdminIds();
        for (const adminId of adminIds) {
          if (adminId === comment.authorId) continue;
          await notify({
            recipientId: adminId, type: T.INCIDENT_COMMENT,
            title: 'Nuevo comentario interno', message: `${incident.folio}: ${comment.text}`,
            relatedIncidentId: incident.id,
          });
        }
        return;
      }
      const recipients = new Set();
      if (comment.authorId !== incident.reportedBy.id) recipients.add(incident.reportedBy.id);
      if (incident.assignedTo && comment.authorId !== incident.assignedTo.id) recipients.add(incident.assignedTo.id);
      for (const recipientId of recipients) {
        await notify({
          recipientId, type: T.INCIDENT_COMMENT,
          title: 'Nuevo comentario', message: `${incident.folio}: ${comment.text}`,
          relatedIncidentId: incident.id,
        });
      }
    });
  }

  App.services = App.services || {};
  App.services.notificationService = {
    listForCurrent, unreadCountForCurrent, markRead, markAllReadForCurrent, notify, wireIncidentEvents,
  };

})(window.App = window.App || {});
