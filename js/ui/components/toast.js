/* =========================================================
   App.ui.toast — notificaciones flotantes efímeras
   ========================================================= */
(function (App) {
  'use strict';

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>',
    danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
  };

  function show({ type = 'info', title, text = '', duration = 3200 } = {}) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <div>
        <div class="toast-title">${App.core.utils.escapeHtml(title)}</div>
        ${text ? `<div class="toast-text">${App.core.utils.escapeHtml(text)}</div>` : ''}
      </div>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
    }, duration);
  }

  App.ui = App.ui || {};
  App.ui.toast = { show };

})(window.App = window.App || {});
