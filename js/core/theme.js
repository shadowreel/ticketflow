/* =========================================================
   App.core.theme — preferencia de tema (claro/oscuro) y color
   de acento (cian/esmeralda/morado/naranja). Es una preferencia
   de UI por navegador (no una "colección" de negocio), por eso
   vive directo en localStorage y no pasa por storageAdapter.
   Se usa tanto desde el topbar (shellView) como desde
   Configuración (settingsView) para que ambos queden en sync.
   ========================================================= */
(function (App) {
  'use strict';

  const THEME_KEY = 'ticketflow:ui:theme';
  const ACCENT_KEY = 'ticketflow:ui:accent';
  const ACCENTS = ['cyan', 'emerald', 'purple', 'orange'];

  function getTheme() { return localStorage.getItem(THEME_KEY) || 'dark'; }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    App.core.eventBus.emit('theme:changed', { theme });
  }

  function getAccent() { return localStorage.getItem(ACCENT_KEY) || 'cyan'; }

  function applyAccent(accent) {
    if (accent === 'cyan') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem(ACCENT_KEY, accent);
    App.core.eventBus.emit('theme:changed', { accent });
  }

  function init() {
    applyTheme(getTheme());
    applyAccent(getAccent());
  }

  App.core.theme = { getTheme, applyTheme, getAccent, applyAccent, ACCENTS, init };

})(window.App = window.App || {});
