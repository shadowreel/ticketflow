/* =========================================================
   App.data.technicianRepository — técnicos (dinámicos, gestionados por el admin)
   ========================================================= */
(function (App) {
  'use strict';

  const COLLECTION = 'technicians';
  const storage = App.data.storageAdapter;

  async function getAll() { return storage.getAll(COLLECTION); }
  async function getActive() { return (await getAll()).filter((t) => t.active !== false); }
  async function getById(id) { return storage.getById(COLLECTION, id); }

  async function getByEmail(email) {
    const all = await getAll();
    const target = String(email).trim().toLowerCase();
    return all.find((t) => t.email.toLowerCase() === target) || null;
  }

  async function getByUsername(username) {
    const all = await getAll();
    const target = String(username).trim().toLowerCase();
    return all.find((t) => t.username && t.username.toLowerCase() === target) || null;
  }

  async function create(tech) {
    return storage.insert(COLLECTION, { active: true, ...tech, createdAt: Date.now() });
  }

  async function update(id, patch) { return storage.update(COLLECTION, id, patch); }
  async function remove(id) { return storage.remove(COLLECTION, id); }

  App.data.technicianRepository = { getAll, getActive, getById, getByEmail, getByUsername, create, update, remove };

})(window.App = window.App || {});
