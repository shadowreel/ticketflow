/* =========================================================
   App.data.incidentRepository — incidencias TI
   ========================================================= */
(function (App) {
  'use strict';

  const COLLECTION = 'incidents';
  const storage = App.data.storageAdapter;

  async function getAll() { return storage.getAll(COLLECTION); }
  async function getById(id) { return storage.getById(COLLECTION, id); }

  async function getByUser(userId) {
    return (await getAll()).filter((inc) => inc.reportedBy && inc.reportedBy.id === userId);
  }

  async function getByTechnician(techId) {
    return (await getAll()).filter((inc) => inc.assignedTo && inc.assignedTo.id === techId);
  }

  async function nextFolio() {
    const n = await storage.nextSequence('incident');
    return `INC-${String(n).padStart(4, '0')}`;
  }

  async function create(incident) { return storage.insert(COLLECTION, incident); }
  async function update(id, patch) { return storage.update(COLLECTION, id, patch); }
  async function remove(id) { return storage.remove(COLLECTION, id); }

  App.data.incidentRepository = {
    getAll, getById, getByUser, getByTechnician, nextFolio, create, update, remove,
  };

})(window.App = window.App || {});
