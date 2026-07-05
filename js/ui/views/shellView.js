/* =========================================================
   App.ui.views.shellView — sidebar, topbar, notificaciones y
   menú de usuario. Se monta una vez al iniciar sesión.
   ========================================================= */
(function (App) {
  'use strict';

  const { escapeHtml, initials, formatRelativeTime } = App.core.utils;
  const bus = App.core.eventBus;
  const notificationService = App.services.notificationService;

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V9z"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 10-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.8 2.8-2-2z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.56V21a2 2 0 01-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1H3a2 2 0 010-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.56V3a2 2 0 014 0v.09a1.7 1.7 0 001 1.56 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.56 1H21a2 2 0 010 4h-.09a1.7 1.7 0 00-1.56 1z"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
  };

  const NAV_BY_ROLE = {
    admin: [
      { path: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
      { path: '/incidencias', label: 'Incidencias', icon: ICONS.ticket },
      { path: '/tecnicos', label: 'Técnicos', icon: ICONS.wrench },
      { path: '/usuarios', label: 'Usuarios', icon: ICONS.users },
      { path: '/configuracion', label: 'Configuración', icon: ICONS.settings },
      { path: '/perfil', label: 'Mi perfil', icon: ICONS.profile },
    ],
    technician: [
      { path: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
      { path: '/incidencias', label: 'Mis tareas', icon: ICONS.ticket },
      { path: '/perfil', label: 'Mi perfil', icon: ICONS.profile },
    ],
    user: [
      { path: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
      { path: '/incidencias', label: 'Mis incidencias', icon: ICONS.ticket },
      { path: '/perfil', label: 'Mi perfil', icon: ICONS.profile },
    ],
  };

  let currentSession = null;
  let wired = false; // evita re-adjuntar listeners si mount() se llama más de una vez (logout -> login sin recargar la página)

  function updateThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = App.core.theme.getTheme() === 'dark' ? ICONS.sun : ICONS.moon;
  }

  function initThemeToggle() {
    document.getElementById('themeToggle').addEventListener('click', () => {
      const next = App.core.theme.getTheme() === 'dark' ? 'light' : 'dark';
      App.core.theme.applyTheme(next);
      updateThemeIcon();
    });
  }

  function renderNav() {
    const nav = document.getElementById('sidebarNav');
    const items = NAV_BY_ROLE[currentSession.role] || [];
    nav.innerHTML = items.map((item) => `
      <a href="#${item.path}" class="nav-item" data-path="${item.path}">
        ${item.icon}<span>${item.label}</span>
      </a>`).join('');
  }

  function highlightActiveNav(activePath) {
    document.querySelectorAll('#sidebarNav .nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.path === activePath);
    });
  }

  function renderUserBadge() {
    const avatarEl = document.getElementById('topbarAvatar');
    avatarEl.outerHTML = currentSession.avatar
      ? `<img class="avatar" id="topbarAvatar" src="${currentSession.avatar}" alt="">`
      : `<span class="avatar" id="topbarAvatar">${initials(currentSession.name)}</span>`;
    document.getElementById('topbarUserName').textContent = currentSession.name;
    document.getElementById('topbarUserRole').textContent = App.config.roleLabels[currentSession.role];
  }

  function renderUserMenu() {
    const panel = document.getElementById('userMenuPanel');
    panel.innerHTML = `
      <a href="#/perfil" class="dropdown-menu-item" data-close-menu>${ICONS.profile}<span>Mi perfil</span></a>
      ${currentSession.role === 'admin' ? `<a href="#/configuracion" class="dropdown-menu-item" data-close-menu>${ICONS.settings}<span>Configuración</span></a>` : ''}
      <div class="dropdown-divider"></div>
      <button type="button" class="dropdown-menu-item danger" id="menuLogoutBtn">${ICONS.logout}<span>Cerrar sesión</span></button>
    `;
    panel.querySelectorAll('[data-close-menu]').forEach((el) => el.addEventListener('click', () => App.ui.dropdown.close()));
    panel.querySelector('#menuLogoutBtn').addEventListener('click', doLogout);
  }

  function notifIcon(type) {
    if (type && type.includes('resolved')) return ICONS.check;
    if (type && type.includes('assigned')) return ICONS.wrench;
    return ICONS.bell;
  }

  async function renderNotifPanel() {
    const panel = document.getElementById('notifPanel');
    const items = await notificationService.listForCurrent(currentSession);
    const unread = items.filter((n) => !n.read).length;
    document.getElementById('notifDot').hidden = unread === 0;

    panel.innerHTML = `
      <div class="dropdown-header">
        <span>Notificaciones</span>
        ${unread ? '<button type="button" id="markAllReadBtn">Marcar todas leídas</button>' : ''}
      </div>
      <div class="dropdown-list">
        ${items.length ? items.slice(0, 20).map((n) => `
          <a href="${n.relatedIncidentId ? `#/incidencias/${n.relatedIncidentId}` : '#/dashboard'}" class="dropdown-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}">
            <span class="item-icon" style="background:color-mix(in srgb, var(--accent-500) 16%, transparent); color:var(--accent-400);">${notifIcon(n.type)}</span>
            <span>
              <div class="item-title">${escapeHtml(n.title)}</div>
              <div class="item-text">${escapeHtml(n.message)}</div>
              <div class="item-time">${formatRelativeTime(n.createdAt)}</div>
            </span>
          </a>`).join('') : `
          <div class="empty-state" style="padding:32px 16px;">
            ${ICONS.bell}
            <p>No tienes notificaciones todavía.</p>
          </div>`}
      </div>
    `;

    panel.querySelectorAll('[data-notif-id]').forEach((el) => {
      el.addEventListener('click', async () => {
        await notificationService.markRead(el.dataset.notifId);
        App.ui.dropdown.close();
      });
    });
    const markAllBtn = panel.querySelector('#markAllReadBtn');
    if (markAllBtn) markAllBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await notificationService.markAllReadForCurrent(currentSession);
    });
  }

  function wireDropdowns() {
    document.getElementById('notifBell').addEventListener('click', (ev) => {
      ev.stopPropagation();
      App.ui.dropdown.toggle(document.getElementById('notifDropdown'), document.getElementById('notifPanel'));
    });
    document.getElementById('userMenuBtn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      App.ui.dropdown.toggle(document.getElementById('userDropdown'), document.getElementById('userMenuPanel'));
    });
  }

  function wireSidebarToggles() {
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
    });
    document.getElementById('menuBtn').addEventListener('click', () => {
      document.body.classList.add('sidebar-mobile-open');
    });
    document.getElementById('sidebarOverlay').addEventListener('click', () => {
      document.body.classList.remove('sidebar-mobile-open');
    });
    document.getElementById('sidebarNav').addEventListener('click', () => {
      document.body.classList.remove('sidebar-mobile-open');
    });
    document.getElementById('logoutBtn').addEventListener('click', doLogout);
  }

  function wireGlobalSearch() {
    const input = document.getElementById('globalSearch');
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const query = input.value.trim();
      if (!query) return;
      if (App.ui.views.incidentsView) App.ui.views.incidentsView.presetSearch(query);
      App.ui.router.navigate('/incidencias');
      input.blur();
    });
    document.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  function doLogout(ev) {
    if (ev) ev.preventDefault();
    App.services.authService.logout();
    bus.emit('auth:logout', {});
  }

  async function mount(session) {
    currentSession = session;
    renderNav();
    renderUserBadge();
    renderUserMenu();
    await renderNotifPanel();
    updateThemeIcon();

    if (wired) return; // el resto de esta función solo debe correr una vez por carga de página
    wired = true;

    initThemeToggle();
    wireDropdowns();
    wireSidebarToggles();
    wireGlobalSearch();

    bus.on('router:navigated', ({ activePath }) => highlightActiveNav(activePath));
    bus.on('notification:changed', () => renderNotifPanel());
    bus.on('data:changed', ({ collection }) => {
      if (collection === 'notifications') renderNotifPanel();
    });
    bus.on('profile:updated', (session) => {
      currentSession = session;
      renderUserBadge();
    });
    bus.on('theme:changed', updateThemeIcon);
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.shellView = { mount };

})(window.App = window.App || {});
