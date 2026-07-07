/* =========================================================
   App.services.locationService
   -----------------------------------------------------------
   Gestión de ubicaciones donde puede ocurrir una incidencia
   (laboratorios, oficinas, aulas...). Se guardan como un
   setting (igual que las categorías), pero con más estructura
   para soportar activar/desactivar y reordenar.
   ========================================================= */
(function (App) {
  'use strict';

  const storage = App.data.storageAdapter;
  const bus = App.core.eventBus;
  const KEY = 'locations';

  function normalize(raw) {
    const list = raw || App.config.defaultLocations;
    // Compatibilidad: si alguna vez la lista quedó como strings planos, se normaliza al vuelo.
    return list.map((item, i) => (typeof item === 'string'
      ? { id: App.core.utils.uuid(), name: item, active: true, order: i }
      : item))
      .slice()
      .sort((a, b) => a.order - b.order);
  }

  async function listAll() {
    return normalize(await storage.getSetting(KEY, null));
  }

  async function listActive() {
    return (await listAll()).filter((l) => l.active !== false);
  }

  async function save(list) {
    await storage.setSetting(KEY, list);
    bus.emit('locations:changed', {});
  }

  async function create(name) {
    const clean = name.trim();
    if (!clean) throw new Error('El nombre de la ubicación no puede estar vacío.');
    const current = await listAll();
    if (current.some((l) => l.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Ya existe una ubicación con ese nombre.');
    }
    const next = [...current, { id: App.core.utils.uuid(), name: clean, active: true, order: current.length }];
    await save(next);
    return next;
  }

  async function rename(id, name) {
    const current = await listAll();
    const next = current.map((l) => (l.id === id ? { ...l, name: name.trim() } : l));
    await save(next);
    return next;
  }

  async function setActive(id, active) {
    const current = await listAll();
    const next = current.map((l) => (l.id === id ? { ...l, active } : l));
    await save(next);
    return next;
  }

  async function remove(id) {
    const current = await listAll();
    const next = current.filter((l) => l.id !== id).map((l, i) => ({ ...l, order: i }));
    await save(next);
    return next;
  }

  async function move(id, direction) {
    const current = await listAll();
    const idx = current.findIndex((l) => l.id === id);
    const swapWith = idx + direction;
    if (idx === -1 || swapWith < 0 || swapWith >= current.length) return current;
    const next = current.slice();
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    next.forEach((l, i) => { l.order = i; });
    await save(next);
    return next;
  }

  App.services = App.services || {};
  App.services.locationService = { listAll, listActive, create, rename, setActive, remove, move };

})(window.App = window.App || {});
