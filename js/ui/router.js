/* =========================================================
   App.ui.router — hash router liviano (#/ruta/:param)
   ========================================================= */
(function (App) {
  'use strict';

  const routes = [];
  let notFoundHandler = () => {};

  function register(path, render) {
    const paramNames = [];
    const pattern = path
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) { paramNames.push(seg.slice(1)); return '([^/]+)'; }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    routes.push({ regex: new RegExp(`^${pattern}$`), paramNames, render, path });
  }

  function setNotFound(handler) { notFoundHandler = handler; }

  function currentPath() {
    const hash = location.hash.replace(/^#/, '');
    return hash || '/';
  }

  let lastMatch = null; // { render, params } — permite re-renderizar la vista activa sin cambiar de ruta

  /** Fade + slide sutil al entrar una vista por navegación real (no en re-renders silenciosos por sync). */
  function playEnterAnimation() {
    const el = document.getElementById('viewContainer');
    if (!el) return;
    el.classList.remove('view-enter');
    void el.offsetWidth; // fuerza reflow para poder reiniciar la animación
    el.classList.add('view-enter');
  }

  function resolve() {
    const path = currentPath();
    for (const route of routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
        lastMatch = { render: route.render, params };
        playEnterAnimation();
        route.render(params);
        App.core.eventBus.emit('router:navigated', { path, activePath: route.path, params });
        return;
      }
    }
    lastMatch = null;
    notFoundHandler();
  }

  /** Vuelve a invocar la vista actualmente activa (por ejemplo, ante un cambio remoto de datos). */
  function rerenderCurrent() {
    if (lastMatch) lastMatch.render(lastMatch.params);
  }

  function navigate(path) {
    if (currentPath() === path) { resolve(); return; }
    location.hash = `#${path}`;
  }

  function start(defaultPath) {
    window.addEventListener('hashchange', resolve);
    if (!location.hash && defaultPath) location.hash = `#${defaultPath}`;
    else resolve();
  }

  App.ui = App.ui || {};
  App.ui.router = { register, navigate, start, setNotFound, currentPath, rerenderCurrent };

})(window.App = window.App || {});
