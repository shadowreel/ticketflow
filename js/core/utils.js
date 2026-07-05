/* =========================================================
   App.core.utils — helpers puros compartidos por toda la app
   ========================================================= */
(function (App) {
  'use strict';

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  /** Contraseña temporal legible (sin caracteres ambiguos) para "restablecer contraseña". */
  function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function slug(text) {
    return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatRelativeTime(ts) {
    if (!ts) return '—';
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'justo ahora';
    if (s < 60) return `hace ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `hace ${d} d`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `hace ${mo} mes${mo > 1 ? 'es' : ''}`;
    return `hace ${Math.floor(mo / 12)} año(s)`;
  }

  function formatMinutes(mins) {
    if (mins == null) return '—';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  /** Hash simulado con Web Crypto nativa (SHA-256). No sustituye un backend real. */
  async function hashPassword(plain) {
    const data = new TextEncoder().encode(String(plain));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Redimensiona y comprime una imagen (File) a dataURL JPEG para no agotar la cuota de localStorage. */
  function compressImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, maxDimension / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function statusSlug(status) { return slug(status); }

  function byNewestFirst(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }

  const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a21.8 21.8 0 015.06-6.06M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 7 11 7a21.8 21.8 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  /** Botón de "mostrar/ocultar contraseña" (mismo estilo que los demás controles) para insertar junto a un input de contraseña. */
  function passwordToggleHtml(targetId) {
    return `<button type="button" class="password-toggle-btn" data-password-toggle="${targetId}" aria-label="Mostrar contraseña">${EYE_ICON}</button>`;
  }

  /** Activa todos los botones de mostrar/ocultar contraseña dentro de root (o todo el documento). */
  function wirePasswordToggles(root) {
    (root || document).querySelectorAll('[data-password-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.passwordToggle);
        if (!input) return;
        const willShow = input.type === 'password';
        input.type = willShow ? 'text' : 'password';
        btn.innerHTML = willShow ? EYE_OFF_ICON : EYE_ICON;
        btn.setAttribute('aria-label', willShow ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
    });
  }

  App.core = App.core || {};
  App.core.utils = {
    escapeHtml, uuid, slug, debounce, formatDate, formatRelativeTime,
    formatMinutes, initials, hashPassword, compressImage, statusSlug, byNewestFirst,
    generateTempPassword, passwordToggleHtml, wirePasswordToggles,
  };

})(window.App = window.App || {});
