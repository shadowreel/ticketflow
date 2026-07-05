/* =========================================================
   App.ui.ripple — ripple sutil al hacer clic en botones (.btn).
   Un único listener delegado en document, nada que wirear por vista.
   ========================================================= */
(function (App) {
  'use strict';

  document.addEventListener('pointerdown', (ev) => {
    const btn = ev.target.closest('.btn');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const span = document.createElement('span');
    span.className = 'btn-ripple';
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.left = `${ev.clientX - rect.left - size / 2}px`;
    span.style.top = `${ev.clientY - rect.top - size / 2}px`;
    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  });

  App.ui = App.ui || {};
  App.ui.ripple = true;

})(window.App = window.App || {});
