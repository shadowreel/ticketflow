/* =========================================================
   App.ui.views.dashboardView — KPIs y gráficos reales por rol
   ========================================================= */
(function (App) {
  'use strict';

  const auth = App.services.authService;
  const statsService = App.services.statsService;
  const charts = App.ui.charts;
  const { escapeHtml, formatRelativeTime, formatMinutes } = App.core.utils;
  const { roles } = App.config;

  const ICONS = {
    total: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V9z"/></svg>',
    pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-3.5-7.13"/><path d="M21 3v6h-6"/></svg>',
    resolved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 10-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.8 2.8-2-2z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
    critical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  };

  const STATUS_COLORS = { 'Pendiente': 'var(--warning-500)', 'Asignada': 'var(--info-500)', 'En Proceso': 'var(--accent-500)', 'Resuelta': 'var(--success-500)' };
  const PRIORITY_COLORS = { 'Baja': 'var(--priority-baja)', 'Media': 'var(--priority-media)', 'Alta': 'var(--priority-alta)', 'Crítica': 'var(--priority-critica)' };

  function statCard(icon, tone, label, value) {
    return `
      <div class="stat-card">
        <div class="stat-card-top">
          <span class="stat-label">${label}</span>
          <span class="stat-icon tone-${tone}">${icon}</span>
        </div>
        <span class="stat-value">${value}</span>
      </div>`;
  }

  function activityIcon(action) {
    if (action.includes('resuelta')) return ICONS.resolved;
    if (action.includes('asignó') || action.includes('reasignó')) return ICONS.wrench;
    if (action.includes('creó')) return ICONS.total;
    return ICONS.progress;
  }

  function activityListHtml(items) {
    if (!items.length) return '<div class="empty-state" style="padding:32px 16px;"><p>Sin actividad todavía.</p></div>';
    return `<div class="activity-list">${items.map((h) => `
      <div class="activity-item">
        <span class="item-icon" style="background:color-mix(in srgb, var(--accent-500) 16%, transparent); color:var(--accent-400);">${activityIcon(h.action)}</span>
        <div>
          <div class="item-title"><strong>${escapeHtml(h.by.name)}</strong> ${escapeHtml(h.action)} <span class="text-tertiary">· ${h.folio}</span></div>
          <div class="item-time">${formatRelativeTime(h.at)}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  function controlCenterActivityItem(e) {
    return `
      <div class="activity-item">
        <span class="item-icon" style="background:color-mix(in srgb, var(--accent-500) 16%, transparent); color:var(--accent-400);">${ICONS.pulse}</span>
        <div>
          <div class="item-title"><strong>${escapeHtml(e.actorName)}</strong> ${escapeHtml(e.action)} ${e.detail ? `<span class="text-tertiary">· ${escapeHtml(e.detail)}</span>` : ''}</div>
          <div class="item-time">${formatRelativeTime(e.createdAt)}</div>
        </div>
      </div>`;
  }

  async function render() {
    const session = auth.getCurrentSession();
    const container = document.getElementById('viewContainer');
    container.innerHTML = `
      <div class="content-header"><div><h1>Dashboard</h1></div></div>
      ${App.ui.skeleton.statsGrid(session.role === roles.ADMIN ? 6 : 4)}
    `;
    const stats = await statsService.getForSession(session);

    if (session.role === roles.ADMIN) {
      const [performance, recentAudit] = await Promise.all([
        statsService.getPerformanceStats(),
        App.services.auditService.recentActivity(10 * 60 * 1000),
      ]);
      return renderAdmin(container, stats, performance, recentAudit);
    }
    if (session.role === roles.TECHNICIAN) return renderTechnician(container, stats);
    return renderUser(container, stats);
  }

  function renderAdmin(container, s, perf, recentAudit) {
    container.innerHTML = `
      <div class="content-header"><div><h1>Dashboard</h1><p>Panorama general del sistema de incidencias.</p></div></div>
      <div class="stats-grid">
        ${statCard(ICONS.total, 'accent', 'Total incidencias', s.total)}
        ${statCard(ICONS.pending, 'warning', 'Pendientes', s.pending)}
        ${statCard(ICONS.progress, 'info', 'En proceso', s.inProgress)}
        ${statCard(ICONS.resolved, 'success', 'Resueltas', s.resolved)}
        ${statCard(ICONS.wrench, 'accent', 'Técnicos activos', s.activeTechnicians)}
        ${statCard(ICONS.users, 'info', 'Usuarios registrados', s.totalUsers)}
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:14px;">Incidencias por estado</h3>
            ${charts.donut(Object.entries(s.byStatus).map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] })))}
          </div>
          <div class="card card-pad">
            <h3 style="margin-bottom:14px;">Incidencias por categoría</h3>
            ${s.byCategory.some((c) => c.value > 0) ? charts.barList(s.byCategory) : '<p class="text-tertiary" style="font-size:var(--fs-sm);">Aún no hay datos.</p>'}
          </div>
          <div class="card card-pad">
            <h3 style="margin-bottom:14px;">Incidencias por prioridad</h3>
            ${charts.barList(Object.entries(s.byPriority).map(([label, value]) => ({ label, value, color: PRIORITY_COLORS[label] })))}
          </div>
        </div>
        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:14px;">Rendimiento</h3>
            <div class="kpi-row">
              <div class="kpi-item"><div class="kpi-value">${formatMinutes(s.avgResolutionMinutes)}</div><div class="kpi-label">Tiempo promedio de resolución</div></div>
              <div class="kpi-item"><div class="kpi-value">${s.slaCompliance == null ? '—' : s.slaCompliance + '%'}</div><div class="kpi-label">Cumplimiento de SLA</div></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Técnico con más resueltas</h3></div>
            ${s.topTechnician ? `<div class="leaderboard-item"><span class="leaderboard-rank gold">1</span><span class="leaderboard-name">${escapeHtml(s.topTechnician.label)}</span><span class="leaderboard-value">${s.topTechnician.value} resueltas</span></div>` : '<div class="empty-state" style="padding:24px 16px;"><p>Aún no hay incidencias resueltas.</p></div>'}
          </div>
          <div class="card">
            <div class="card-header"><h3>Usuario con más incidencias</h3></div>
            ${s.topUser ? `<div class="leaderboard-item"><span class="leaderboard-rank gold">1</span><span class="leaderboard-name">${escapeHtml(s.topUser.label)}</span><span class="leaderboard-value">${s.topUser.value} reportadas</span></div>` : '<div class="empty-state" style="padding:24px 16px;"><p>Aún no hay incidencias reportadas.</p></div>'}
          </div>
          <div class="card">
            <div class="card-header"><h3>Actividad reciente</h3></div>
            ${activityListHtml(s.recentActivity)}
          </div>
        </div>
      </div>

      <div class="card card-pad" style="margin-top:var(--space-5);">
        <h3 style="margin-bottom:14px;">Panel de Rendimiento</h3>
        <div class="dashboard-grid">
          <div class="dashboard-col">
            <h4 class="text-tertiary" style="font-size:var(--fs-sm);font-weight:var(--fw-medium);margin-bottom:8px;">Incidencias por ubicación</h4>
            ${perf.byLocation.some((l) => l.value > 0) ? charts.barList(perf.byLocation) : '<p class="text-tertiary" style="font-size:var(--fs-sm);">Aún no hay datos.</p>'}
          </div>
          <div class="dashboard-col">
            <h4 class="text-tertiary" style="font-size:var(--fs-sm);font-weight:var(--fw-medium);margin-bottom:8px;">Usuarios con más incidencias reportadas</h4>
            ${perf.byUser.length ? perf.byUser.slice(0, 5).map((u, i) => `
              <div class="leaderboard-item"><span class="leaderboard-rank ${i === 0 ? 'gold' : ''}">${i + 1}</span><span class="leaderboard-name">${escapeHtml(u.label)}</span><span class="leaderboard-value">${u.value} reportadas</span></div>
            `).join('') : '<div class="empty-state" style="padding:16px;"><p>Aún no hay datos.</p></div>'}
          </div>
        </div>
        <div class="kpi-row" style="margin-top:var(--space-4);">
          <div class="kpi-item"><div class="kpi-value">${perf.topLocation ? escapeHtml(perf.topLocation.label) : '—'}</div><div class="kpi-label">Ubicación con más incidencias</div></div>
          <div class="kpi-item"><div class="kpi-value">${perf.activeTechnicians}</div><div class="kpi-label">Técnicos activos</div></div>
          <div class="kpi-item"><div class="kpi-value">${perf.inactiveTechnicians}</div><div class="kpi-label">Técnicos inactivos</div></div>
          <div class="kpi-item"><div class="kpi-value">${perf.resolvedPercentage == null ? '—' : perf.resolvedPercentage + '%'}</div><div class="kpi-label">% Incidencias resueltas</div></div>
        </div>
      </div>

      <div class="card card-pad" style="margin-top:var(--space-5);">
        <h3 style="margin-bottom:14px;">Centro de Control</h3>
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
          ${statCard(ICONS.pending, 'warning', 'Incidencias pendientes', s.pending)}
          ${statCard(ICONS.critical, 'danger', 'Incidencias críticas', s.byPriority['Crítica'] || 0)}
          ${statCard(ICONS.wrench, 'accent', 'Técnicos activos', perf.activeTechnicians)}
          ${statCard(ICONS.resolved, 'success', 'Estado del sistema', App.data.storageAdapter.isCollaborative() ? 'Colaborativo' : 'Local')}
        </div>
        <h4 class="text-tertiary" style="font-size:var(--fs-sm);font-weight:var(--fw-medium);margin:var(--space-4) 0 8px;">Actividad reciente (últimos 10 min)</h4>
        ${recentAudit.length ? `<div class="activity-list">${recentAudit.map(controlCenterActivityItem).join('')}</div>` : '<div class="empty-state" style="padding:16px;"><p>Sin actividad en los últimos minutos.</p></div>'}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:var(--space-4);">
          <a href="#/reportes" class="btn btn-secondary btn-sm">Reportes</a>
          <a href="#/auditoria" class="btn btn-secondary btn-sm">Auditoría</a>
          <a href="#/tecnicos" class="btn btn-secondary btn-sm">Técnicos</a>
          <a href="#/usuarios" class="btn btn-secondary btn-sm">Usuarios</a>
          <a href="#/configuracion" class="btn btn-secondary btn-sm">Configuración</a>
          <a href="#/dashboard" class="btn btn-secondary btn-sm">Dashboard</a>
        </div>
      </div>
    `;
  }

  function renderTechnician(container, s) {
    container.innerHTML = `
      <div class="content-header"><div><h1>Dashboard</h1><p>Tu actividad como técnico de soporte.</p></div></div>
      <div class="stats-grid">
        ${statCard(ICONS.total, 'accent', 'Asignadas', s.assigned)}
        ${statCard(ICONS.progress, 'info', 'En proceso', s.inProgress)}
        ${statCard(ICONS.resolved, 'success', 'Resueltas', s.resolved)}
        ${statCard(ICONS.clock, 'warning', 'Tiempo promedio', formatMinutes(s.avgResolutionMinutes))}
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:14px;">Tus tareas por prioridad</h3>
            ${s.byPriority.some((p) => p.value > 0) ? charts.barList(s.byPriority.map((p) => ({ ...p, color: PRIORITY_COLORS[p.label] }))) : '<p class="text-tertiary" style="font-size:var(--fs-sm);">Aún no tienes incidencias asignadas.</p>'}
          </div>
        </div>
        <div class="dashboard-col">
          <div class="card">
            <div class="card-header"><h3>Actividad reciente</h3></div>
            ${activityListHtml(s.recentActivity)}
          </div>
        </div>
      </div>
    `;
  }

  function renderUser(container, s) {
    container.innerHTML = `
      <div class="content-header"><div><h1>Dashboard</h1><p>Resumen de tus incidencias reportadas.</p></div></div>
      <div class="stats-grid">
        ${statCard(ICONS.total, 'accent', 'Total', s.total)}
        ${statCard(ICONS.pending, 'warning', 'Pendientes', s.pending)}
        ${statCard(ICONS.progress, 'info', 'En proceso', s.inProgress)}
        ${statCard(ICONS.resolved, 'success', 'Resueltas', s.resolved)}
      </div>
      <div class="dashboard-grid">
        <div class="dashboard-col">
          <div class="card card-pad">
            <h3 style="margin-bottom:14px;">Tus incidencias por estado</h3>
            ${s.total ? charts.barList(s.byStatus.map((b) => ({ ...b, color: STATUS_COLORS[b.label] }))) : '<p class="text-tertiary" style="font-size:var(--fs-sm);">Aún no has reportado incidencias.</p>'}
          </div>
        </div>
        <div class="dashboard-col">
          <div class="card">
            <div class="card-header"><h3>Actividad reciente</h3></div>
            ${activityListHtml(s.recentActivity)}
          </div>
        </div>
      </div>
    `;
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.dashboardView = { render };

})(window.App = window.App || {});
