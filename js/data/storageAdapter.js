/* =========================================================
   App.data.storageAdapter
   -----------------------------------------------------------
   Único punto de contacto con la persistencia física. Expone
   siempre la misma firma async (getAll/getById/insert/update/
   remove/replaceAll/getSetting/setSetting/nextSequence/exportAll/
   importAll) sin importar el motor real:

   - Si js/core/firebaseConfig.js tiene credenciales reales,
     usa Firebase Firestore (colaborativo, tiempo real, varias
     computadoras viendo los mismos datos).
   - Si no hay credenciales (o Firebase falla al iniciar), cae
     en silencio a localStorage — el mismo comportamiento de la
     Fase 1, para que la app nunca se quede sin funcionar.

   Fase 3 (Google Sheets): el reemplazo vuelve a ser SOLO este
   archivo — repositories/services/views no se tocan.
   ========================================================= */
(function (App) {
  'use strict';

  const PREFIX = App.config.storagePrefix;
  const bus = App.core.eventBus;
  const fbConfig = App.config.firebase || {};

  const WATCHED_COLLECTIONS = ['admin', 'technicians', 'users', 'incidents', 'notifications'];

  /* ---------------------------------------------------------
     Motor local (localStorage) — idéntico a la Fase 1
     --------------------------------------------------------- */
  const channel = ('BroadcastChannel' in window) ? new BroadcastChannel('ticketflow-sync') : null;

  function key(collection) { return `${PREFIX}${collection}`; }

  function readRaw(collection) {
    try {
      const raw = localStorage.getItem(key(collection));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error(`[storageAdapter] error leyendo "${collection}"`, err);
      return null;
    }
  }

  function writeRaw(collection, value) {
    localStorage.setItem(key(collection), JSON.stringify(value));
  }

  function notifyChange(collection, origin) {
    bus.emit('data:changed', { collection });
    if (channel && origin !== 'remote') channel.postMessage({ collection });
  }

  if (channel) {
    channel.onmessage = (ev) => {
      if (ev && ev.data && ev.data.collection) bus.emit('data:changed', { collection: ev.data.collection, remote: true });
    };
  }

  window.addEventListener('storage', (ev) => {
    if (!ev.key || !ev.key.startsWith(PREFIX)) return;
    bus.emit('data:changed', { collection: ev.key.slice(PREFIX.length), remote: true });
  });

  const BACKUP_COLLECTIONS = ['admin', 'technicians', 'users', 'incidents', 'notifications', 'settings', 'counters'];

  const localEngine = {
    async getAll(collection) { return readRaw(collection) || []; },
    async getById(collection, id) {
      const items = readRaw(collection) || [];
      return items.find((it) => it.id === id) || null;
    },
    async insert(collection, item) {
      const items = readRaw(collection) || [];
      const record = { ...item, id: item.id || App.core.utils.uuid() };
      items.push(record);
      writeRaw(collection, items);
      notifyChange(collection);
      return record;
    },
    async update(collection, id, patch) {
      const items = readRaw(collection) || [];
      const idx = items.findIndex((it) => it.id === id);
      if (idx === -1) return null;
      items[idx] = { ...items[idx], ...patch };
      writeRaw(collection, items);
      notifyChange(collection);
      return items[idx];
    },
    async remove(collection, id) {
      const items = readRaw(collection) || [];
      const next = items.filter((it) => it.id !== id);
      const changed = next.length !== items.length;
      if (changed) { writeRaw(collection, next); notifyChange(collection); }
      return changed;
    },
    async replaceAll(collection, items) { writeRaw(collection, items); notifyChange(collection); },
    async getSetting(k, defaultValue) {
      const all = readRaw('settings') || {};
      return Object.prototype.hasOwnProperty.call(all, k) ? all[k] : defaultValue;
    },
    async setSetting(k, value) {
      const all = readRaw('settings') || {};
      all[k] = value;
      writeRaw('settings', all);
      notifyChange('settings');
    },
    async nextSequence(name) {
      const counters = readRaw('counters') || {};
      const next = (counters[name] || 0) + 1;
      counters[name] = next;
      writeRaw('counters', counters);
      return next;
    },
    async exportAll() {
      const data = {};
      BACKUP_COLLECTIONS.forEach((c) => { data[c] = readRaw(c) || (c === 'settings' || c === 'counters' ? {} : []); });
      return { exportedAt: Date.now(), data };
    },
    async importAll(backup) {
      const data = (backup && backup.data) || {};
      BACKUP_COLLECTIONS.forEach((c) => { if (data[c] !== undefined) writeRaw(c, data[c]); });
      BACKUP_COLLECTIONS.forEach((c) => notifyChange(c));
    },
  };

  /* ---------------------------------------------------------
     Motor Firestore — colaborativo, se activa solo con config real
     --------------------------------------------------------- */
  const firestoreConfigured = !!(fbConfig.apiKey && fbConfig.projectId && fbConfig.apiKey !== 'TU_API_KEY');
  let db = null;

  if (firestoreConfigured) {
    try {
      firebase.initializeApp(fbConfig);
      db = firebase.firestore();
    } catch (err) {
      console.error('[storageAdapter] No se pudo inicializar Firebase, usando almacenamiento local.', err);
      db = null;
    }
  }

  const META_DOC = { settings: db && db.collection('meta').doc('settings'), counters: db && db.collection('meta').doc('counters') };

  const firestoreEngine = db ? {
    async getAll(collection) {
      const snap = await db.collection(collection).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async getById(collection, id) {
      const doc = await db.collection(collection).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async insert(collection, item) {
      const id = item.id || App.core.utils.uuid();
      const record = { ...item, id };
      await db.collection(collection).doc(id).set(record);
      notifyChange(collection);
      return record;
    },
    async update(collection, id, patch) {
      await db.collection(collection).doc(id).set(patch, { merge: true });
      notifyChange(collection);
      return firestoreEngine.getById(collection, id);
    },
    async remove(collection, id) {
      await db.collection(collection).doc(id).delete();
      notifyChange(collection);
      return true;
    },
    async replaceAll(collection, items) {
      const batch = db.batch();
      const existing = await db.collection(collection).get();
      existing.docs.forEach((d) => batch.delete(d.ref));
      items.forEach((item) => {
        const id = item.id || App.core.utils.uuid();
        batch.set(db.collection(collection).doc(id), { ...item, id });
      });
      await batch.commit();
      notifyChange(collection);
    },
    async getSetting(k, defaultValue) {
      const doc = await META_DOC.settings.get();
      const all = doc.exists ? doc.data() : {};
      return Object.prototype.hasOwnProperty.call(all, k) ? all[k] : defaultValue;
    },
    async setSetting(k, value) {
      await META_DOC.settings.set({ [k]: value }, { merge: true });
      notifyChange('settings');
    },
    async nextSequence(name) {
      return db.runTransaction(async (tx) => {
        const doc = await tx.get(META_DOC.counters);
        const counters = doc.exists ? doc.data() : {};
        const next = (counters[name] || 0) + 1;
        tx.set(META_DOC.counters, { [name]: next }, { merge: true });
        return next;
      });
    },
    async exportAll() {
      const data = {};
      for (const c of BACKUP_COLLECTIONS) {
        if (c === 'settings' || c === 'counters') {
          const doc = await META_DOC[c].get();
          data[c] = doc.exists ? doc.data() : {};
        } else {
          data[c] = await firestoreEngine.getAll(c);
        }
      }
      return { exportedAt: Date.now(), data };
    },
    async importAll(backup) {
      const data = (backup && backup.data) || {};
      for (const c of BACKUP_COLLECTIONS) {
        if (data[c] === undefined) continue;
        if (c === 'settings' || c === 'counters') await META_DOC[c].set(data[c]);
        else await firestoreEngine.replaceAll(c, data[c]);
      }
    },
  } : null;

  // Listeners en tiempo real: cualquier escritura (propia o de otra computadora)
  // vuelve a emitir el mismo 'data:changed' que ya escucha el resto de la app.
  if (firestoreEngine) {
    WATCHED_COLLECTIONS.forEach((collection) => {
      db.collection(collection).onSnapshot(
        () => bus.emit('data:changed', { collection, remote: true }),
        (err) => console.error(`[storageAdapter] listener de "${collection}" falló`, err),
      );
    });
    db.collection('meta').onSnapshot(
      (snap) => snap.docChanges().forEach((change) => bus.emit('data:changed', { collection: change.doc.id, remote: true })),
      (err) => console.error('[storageAdapter] listener de "meta" falló', err),
    );
  }

  const engine = firestoreEngine || localEngine;
  if (!firestoreEngine && firestoreConfigured) {
    console.warn('[storageAdapter] Firebase configurado pero no disponible; usando almacenamiento local.');
  }

  App.data = App.data || {};
  App.data.storageAdapter = {
    getAll: engine.getAll,
    getById: engine.getById,
    insert: engine.insert,
    update: engine.update,
    remove: engine.remove,
    replaceAll: engine.replaceAll,
    getSetting: engine.getSetting,
    setSetting: engine.setSetting,
    nextSequence: engine.nextSequence,
    exportAll: engine.exportAll,
    importAll: engine.importAll,
    isCollaborative: () => !!firestoreEngine,
  };

})(window.App = window.App || {});
