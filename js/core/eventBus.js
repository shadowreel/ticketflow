/* =========================================================
   App.core.eventBus — pub/sub interno para desacoplar
   servicios de negocio de la UI.
   ========================================================= */
(function (App) {
  'use strict';

  function createEventBus() {
    const listeners = new Map();

    function on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => off(event, handler);
    }

    function off(event, handler) {
      if (listeners.has(event)) listeners.get(event).delete(handler);
    }

    function emit(event, payload) {
      if (listeners.has(event)) {
        for (const handler of Array.from(listeners.get(event))) {
          try { handler(payload); } catch (err) { console.error(`[eventBus] error en handler de "${event}"`, err); }
        }
      }
    }

    return { on, off, emit };
  }

  App.core = App.core || {};
  App.core.eventBus = createEventBus();

})(window.App = window.App || {});
