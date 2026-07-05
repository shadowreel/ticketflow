/* =========================================================
   App.ui.dropdown — comportamiento genérico de menús flotantes
   ========================================================= */
(function (App) {
  'use strict';

  let openState = null; // { container, panel }

  function close() {
    if (openState) {
      openState.panel.classList.remove('open');
      openState = null;
    }
  }

  function toggle(container, panel) {
    if (openState && openState.panel === panel) { close(); return; }
    close();
    panel.classList.add('open');
    openState = { container, panel };
  }

  document.addEventListener('click', (ev) => {
    if (openState && !openState.container.contains(ev.target)) close();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });

  App.ui = App.ui || {};
  App.ui.dropdown = { toggle, close };

})(window.App = window.App || {});
