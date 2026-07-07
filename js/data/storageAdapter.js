/* =========================================================
   App.data.storageAdapter
   -----------------------------------------------------------
   Único punto de contacto con la persistencia física. Expone
   siempre la misma firma async (getAll/getById/insert/update/
   remove/replaceAll/getSetting/setSetting/nextSequence/exportAll/
   importAll) sin importar el motor real:

   - Si js/core/supabaseConfig.js tiene credenciales reales,
     usa Supabase (Postgres + tiempo real, colaborativo: varias
     computadoras viendo los mismos datos). Ver supabase/schema.sql
     para la tabla y función que la app necesita.
   - Si no hay credenciales (o Supabase falla al iniciar), cae
     en silencio a localStorage — el mismo comportamiento de la
     Fase 1, para que la app nunca se quede sin funcionar.

   Fase 3 (Google Sheets): el reemplazo vuelve a ser SOLO este
   archivo — repositories/services/views no se tocan.
   ========================================================= */
(function (App) {
  'use strict';

  const PREFIX = App.config.storagePrefix;
  const bus = App.core.eventBus;
  const sbConfig = App.config.supabase || {};

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

  const BACKUP_COLLECTIONS = ['admin', 'technicians', 'users', 'incidents', 'notifications', 'settings', 'counters', 'audit_log'];

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
     Motor Supabase — colaborativo, se activa solo con config real
     --------------------------------------------------------- */
  const TABLE = 'ticketflow_data';
  const META_SETTINGS_ID = '00000000-0000-0000-0000-000000000002';
  const META_COUNTERS_ID = '00000000-0000-0000-0000-000000000001';

  const supabaseConfigured = !!(sbConfig.url && sbConfig.anonKey
    && sbConfig.url !== 'https://TU_PROYECTO.supabase.co' && sbConfig.anonKey !== 'TU_ANON_KEY');
  let sb = null;

  if (supabaseConfigured) {
    try {
      sb = window.supabase.createClient(sbConfig.url, sbConfig.anonKey);
    } catch (err) {
      console.error('[storageAdapter] No se pudo inicializar Supabase, usando almacenamiento local.', err);
      sb = null;
    }
  }

  function metaRowId(collection) {
    if (collection === 'settings') return META_SETTINGS_ID;
    if (collection === 'counters') return META_COUNTERS_ID;
    return null;
  }

  const supabaseEngine = sb ? {
    async getAll(collection) {
      const { data, error } = await sb.from(TABLE).select('record').eq('collection', collection);
      if (error) throw error;
      return data.map((row) => row.record);
    },
    async getById(collection, id) {
      const { data, error } = await sb.from(TABLE).select('record').eq('collection', collection).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? data.record : null;
    },
    async insert(collection, item) {
      const id = item.id || App.core.utils.uuid();
      const record = { ...item, id };
      const { error } = await sb.from(TABLE).insert({ id, collection, record });
      if (error) throw error;
      notifyChange(collection);
      return record;
    },
    async update(collection, id, patch) {
      const current = await supabaseEngine.getById(collection, id);
      if (!current) return null;
      const merged = { ...current, ...patch };
      const { error } = await sb.from(TABLE).update({ record: merged, updated_at: new Date().toISOString() }).eq('collection', collection).eq('id', id);
      if (error) throw error;
      notifyChange(collection);
      return merged;
    },
    async remove(collection, id) {
      const { error } = await sb.from(TABLE).delete().eq('collection', collection).eq('id', id);
      if (error) throw error;
      notifyChange(collection);
      return true;
    },
    async replaceAll(collection, items) {
      const { error: delErr } = await sb.from(TABLE).delete().eq('collection', collection);
      if (delErr) throw delErr;
      if (items.length) {
        const rows = items.map((item) => ({ id: item.id || App.core.utils.uuid(), collection, record: item }));
        const { error } = await sb.from(TABLE).insert(rows);
        if (error) throw error;
      }
      notifyChange(collection);
    },
    async getSetting(k, defaultValue) {
      const all = (await supabaseEngine.getById('meta', META_SETTINGS_ID)) || {};
      return Object.prototype.hasOwnProperty.call(all, k) ? all[k] : defaultValue;
    },
    async setSetting(k, value) {
      const current = (await supabaseEngine.getById('meta', META_SETTINGS_ID)) || {};
      const merged = { ...current, [k]: value };
      const { error } = await sb.from(TABLE).upsert({ id: META_SETTINGS_ID, collection: 'meta', record: merged, updated_at: new Date().toISOString() });
      if (error) throw error;
      notifyChange('settings');
    },
    async nextSequence(name) {
      const { data, error } = await sb.rpc('ticketflow_next_sequence', { seq_name: name });
      if (error) throw error;
      return data;
    },
    async exportAll() {
      const data = {};
      for (const c of BACKUP_COLLECTIONS) {
        const metaId = metaRowId(c);
        data[c] = metaId ? ((await supabaseEngine.getById('meta', metaId)) || {}) : await supabaseEngine.getAll(c);
      }
      return { exportedAt: Date.now(), data };
    },
    async importAll(backup) {
      const data = (backup && backup.data) || {};
      for (const c of BACKUP_COLLECTIONS) {
        if (data[c] === undefined) continue;
        const metaId = metaRowId(c);
        if (metaId) {
          const { error } = await sb.from(TABLE).upsert({ id: metaId, collection: 'meta', record: data[c], updated_at: new Date().toISOString() });
          if (error) throw error;
          notifyChange(c);
        } else {
          await supabaseEngine.replaceAll(c, data[c]);
        }
      }
    },
  } : null;

  // Tiempo real: cualquier escritura (propia o de otra computadora) vuelve a
  // emitir el mismo 'data:changed' que ya escucha el resto de la app.
  if (supabaseEngine) {
    sb.channel('ticketflow-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        const row = (payload.new && Object.keys(payload.new).length) ? payload.new : payload.old;
        if (!row) return;
        let collection = row.collection;
        if (collection === 'meta') {
          if (row.id === META_SETTINGS_ID) collection = 'settings';
          else if (row.id === META_COUNTERS_ID) collection = 'counters';
        }
        bus.emit('data:changed', { collection, remote: true });
      })
      .subscribe((status, err) => {
        if (err) console.error('[storageAdapter] error en el canal de tiempo real de Supabase', err);
      });
  }

  const engine = supabaseEngine || localEngine;
  if (!supabaseEngine && supabaseConfigured) {
    console.warn('[storageAdapter] Supabase configurado pero no disponible; usando almacenamiento local.');
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
    isCollaborative: () => !!supabaseEngine,
  };

})(window.App = window.App || {});
