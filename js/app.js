/* =========================================================
   App.app — punto de entrada: bootstrap, sesión, router y shell
   ========================================================= */
(function (App) {
  'use strict';

  const auth = App.services.authService;
  const bus = App.core.eventBus;
  const router = App.ui.router;

  function renderComingSoon(title) {
    document.getElementById('viewContainer').innerHTML = `
      <div class="content-header"><div><h1>${title}</h1></div></div>
      <div class="card"><div class="empty-state">
        <p>Este módulo se está construyendo en la siguiente etapa del proyecto.</p>
      </div></div>`;
  }

  function guardRole(allowedRoles, render) {
    return (params) => {
      const session = auth.getCurrentSession();
      if (!session || !allowedRoles.includes(session.role)) {
        router.navigate('/dashboard');
        return;
      }
      render(params);
    };
  }

  function registerRoutes() {
    const V = App.ui.views;
    const all = [App.config.roles.ADMIN, App.config.roles.TECHNICIAN, App.config.roles.USER];

    router.register('/dashboard', guardRole(all, (p) => (V.dashboardView ? V.dashboardView.render(p) : renderComingSoon('Dashboard'))));
    router.register('/incidencias', guardRole(all, (p) => (V.incidentsView ? V.incidentsView.render(p) : renderComingSoon('Incidencias'))));
    router.register('/incidencias/:id', guardRole(all, (p) => (V.incidentDetailView ? V.incidentDetailView.render(p) : renderComingSoon('Detalle de incidencia'))));
    router.register('/tecnicos', guardRole([App.config.roles.ADMIN], (p) => (V.technicianManagementView ? V.technicianManagementView.render(p) : renderComingSoon('Técnicos'))));
    router.register('/usuarios', guardRole([App.config.roles.ADMIN], (p) => (V.userManagementView ? V.userManagementView.render(p) : renderComingSoon('Usuarios'))));
    router.register('/configuracion', guardRole([App.config.roles.ADMIN], (p) => (V.settingsView ? V.settingsView.render(p) : renderComingSoon('Configuración'))));
    router.register('/perfil', guardRole(all, (p) => (V.profileView ? V.profileView.render(p) : renderComingSoon('Mi perfil'))));

    router.setNotFound(() => router.navigate('/dashboard'));
  }

  function showLogin() {
    document.getElementById('appRoot').hidden = true;
    document.getElementById('loginScreen').hidden = false;
    App.ui.views.loginView.mount();
  }

  async function showApp(session) {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('appRoot').hidden = false;
    document.body.classList.remove('sidebar-mobile-open');
    await App.ui.views.shellView.mount(session);
    router.start('/dashboard');
  }

  async function boot() {
    App.core.theme.init();
    await App.data.bootstrap.run();
    registerRoutes();
    App.services.notificationService.wireIncidentEvents();

    bus.on('auth:login', (session) => { showApp(session); });
    bus.on('auth:logout', () => { showLogin(); });

    // Colaborativo: cuando otra computadora crea/edita datos (Firestore onSnapshot),
    // la vista activa se vuelve a renderizar sola, sin que el usuario recargue la página.
    const LIVE_COLLECTIONS = ['incidents', 'technicians', 'users', 'notifications'];
    bus.on('data:changed', ({ collection, remote }) => {
      if (remote && LIVE_COLLECTIONS.includes(collection) && !document.getElementById('appRoot').hidden) {
        router.rerenderCurrent();
      }
    });

    const session = auth.getCurrentSession();
    if (session) showApp(session);
    else showLogin();
  }

  document.addEventListener('DOMContentLoaded', boot);

})(window.App = window.App || {});
