/* =========================================================
   App.data.notificationRepository — notificaciones por usuario
   ========================================================= */
(function (App) {
  'use strict';

  const COLLECTION = 'notifications';
  const storage = App.data.storageAdapter;
  const { byNewestFirst } = App.core.utils;

  async function getAll() { return storage.getAll(COLLECTION); }

  async function getForRecipient(recipientId) {
    const all = await getAll();
    return all.filter((n) => n.recipientId === recipientId).sort(byNewestFirst);
  }

  async function unreadCount(recipientId) {
    const mine = await getForRecipient(recipientId);
    return mine.filter((n) => !n.read).length;
  }

  async function create(notification) {
    return storage.insert(COLLECTION, { read: false, createdAt: Date.now(), ...notification });
  }

  async function markRead(id) { return storage.update(COLLECTION, id, { read: true }); }

  async function markAllRead(recipientId) {
    const mine = await getForRecipient(recipientId);
    await Promise.all(mine.filter((n) => !n.read).map((n) => storage.update(COLLECTION, n.id, { read: true })));
  }

  App.data.notificationRepository = { getAll, getForRecipient, unreadCount, create, markRead, markAllRead };

})(window.App = window.App || {});
