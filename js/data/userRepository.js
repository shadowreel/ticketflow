/* =========================================================
   App.data.userRepository — usuarios finales
   ========================================================= */
(function (App) {
  'use strict';

  const COLLECTION = 'users';
  const storage = App.data.storageAdapter;

  async function getAll() { return storage.getAll(COLLECTION); }
  async function getById(id) { return storage.getById(COLLECTION, id); }

  async function getByEmail(email) {
    const all = await getAll();
    const target = String(email).trim().toLowerCase();
    return all.find((u) => u.email.toLowerCase() === target) || null;
  }

  async function create(user) {
    return storage.insert(COLLECTION, { ...user, createdAt: Date.now() });
  }

  async function update(id, patch) { return storage.update(COLLECTION, id, patch); }
  async function remove(id) { return storage.remove(COLLECTION, id); }

  App.data.userRepository = { getAll, getById, getByEmail, create, update, remove };

})(window.App = window.App || {});
