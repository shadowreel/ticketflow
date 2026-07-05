/* =========================================================
   App.config — constantes globales del sistema
   ========================================================= */
(function (App) {
  'use strict';

  App.config = {
    storagePrefix: 'ticketflow:',

    roles: { ADMIN: 'admin', TECHNICIAN: 'technician', USER: 'user' },

    roleLabels: {
      admin: 'Administrador TI',
      technician: 'Técnico TI',
      user: 'Usuario Final',
    },

    statusFlow: ['Pendiente', 'Asignada', 'En Proceso', 'Resuelta'],

    defaultCategories: ['Hardware', 'Software', 'Red / Conectividad', 'Accesos y Cuentas', 'Otro'],

    priorities: ['Baja', 'Media', 'Alta', 'Crítica'],

    // SLA en minutos por prioridad — usado para medir cumplimiento en las estadísticas
    defaultSla: { Baja: 2880, Media: 1440, Alta: 480, Crítica: 120 },

    maxAttachments: 2,
    maxAttachmentDimension: 900, // px, redimensionado antes de comprimir
    attachmentQuality: 0.7,

    notificationTypes: {
      INCIDENT_CREATED: 'incident_created',
      INCIDENT_ASSIGNED: 'incident_assigned',
      INCIDENT_STATUS_CHANGED: 'incident_status_changed',
      INCIDENT_RESOLVED: 'incident_resolved',
      INCIDENT_REASSIGNED: 'incident_reassigned',
      INCIDENT_COMMENT: 'incident_comment',
    },

    // Credenciales iniciales del único administrador (debe cambiarse en el primer login)
    defaultAdmin: {
      username: 'admin',
      name: 'Administrador Principal',
      email: 'admin@ticketflow.com',
      password: 'admin',
    },

    // Técnicos reales sembrados en el primer arranque (editables/eliminables por el admin)
    initialTechnicians: [
      { name: 'Leonel', username: 'leonel', email: 'leonel@ticketflow.com', position: 'Técnico de Soporte', password: '123456789' },
      { name: 'Nathan', username: 'nathan', email: 'nathan@ticketflow.com', position: 'Técnico de Redes', password: '123456789' },
      { name: 'Sheyla', username: 'sheyla', email: 'sheyla@ticketflow.com', position: 'Técnica de Software', password: '123456789' },
    ],
  };

})(window.App = window.App || {});
