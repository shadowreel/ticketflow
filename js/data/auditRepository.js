/* =========================================================
   App.data.auditRepository — historial de auditoría del sistema
   (nunca se elimina automáticamente; solo lectura + inserción)
   ========================================================= */
(function (App) {
  'use strict';

  const COLLECTION = 'audit_log';
  const storage = App.data.storageAdapter;

  async function getAll() { return storage.getAll(COLLECTION); }

  async function create(entry) {
    return storage.insert(COLLECTION, { ...entry, createdAt: entry.createdAt || Date.now() });
  }

  App.data.auditRepository = { getAll, create };

})(window.App = window.App || {});
