/* =========================================================
   App.data.adminRepository — administradores (varios, gestionados
   entre sí desde el panel de Técnicos → pestaña Administradores)
   ========================================================= */
(function (App) {
  'use strict';

  const COLLECTION = 'admin';
  const storage = App.data.storageAdapter;

  async function getAll() { return storage.getAll(COLLECTION); }
  async function getById(id) { return storage.getById(COLLECTION, id); }

  async function getByEmail(email) {
    const all = await getAll();
    const target = String(email).trim().toLowerCase();
    return all.find((a) => a.email.toLowerCase() === target) || null;
  }

  async function getByUsername(username) {
    const all = await getAll();
    const target = String(username).trim().toLowerCase();
    return all.find((a) => a.username && a.username.toLowerCase() === target) || null;
  }

  async function create(admin) {
    return storage.insert(COLLECTION, { ...admin, createdAt: Date.now() });
  }

  async function update(id, patch) { return storage.update(COLLECTION, id, patch); }
  async function remove(id) { return storage.remove(COLLECTION, id); }

  App.data.adminRepository = { getAll, getById, getByEmail, getByUsername, create, update, remove };

})(window.App = window.App || {});
