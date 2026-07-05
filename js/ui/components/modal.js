/* =========================================================
   App.ui.modal — modal genérico reutilizable
   ========================================================= */
(function (App) {
  'use strict';

  const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  function open({ title, bodyHtml, footerHtml = '', size = 'md', persistent = false, onClose } = {}) {
    const root = document.getElementById('modalRoot');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${size === 'lg' ? 'modal-lg' : ''}" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>${title}</h2>
          ${persistent ? '' : '<button class="icon-btn" data-modal-close aria-label="Cerrar">' + CLOSE_ICON + '</button>'}
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>`;
    root.appendChild(overlay);

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener('keydown', onKeydown);
      if (onClose) onClose();
    }

    function onKeydown(ev) {
      if (ev.key === 'Escape' && !persistent) close();
    }

    if (!persistent) {
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', close);
      document.addEventListener('keydown', onKeydown);
    }

    requestAnimationFrame(() => overlay.classList.add('open'));

    return { el: overlay, close };
  }

  App.ui = App.ui || {};
  App.ui.modal = { open };

})(window.App = window.App || {});
