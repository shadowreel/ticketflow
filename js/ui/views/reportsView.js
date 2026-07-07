/* =========================================================
   App.ui.views.reportsView — reportes filtrables + exportación
   (Excel/PDF/CSV) e Informe Ejecutivo (solo admin)
   ========================================================= */
(function (App) {
  'use strict';

  const reportService = App.services.reportService;
  const exportService = App.services.exportService;
  const statsService = App.services.statsService;
  const storage = App.data.storageAdapter;
  const charts = App.ui.charts;
  const { escapeHtml, formatDate, formatMinutes } = App.core.utils;
  const { priorities, statusFlow } = App.config;

  const REPORT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>';

  let state = { preset: 'mensual', from: '', to: '', location: 'Todas', category: 'Todas', technician: 'Todos', status: 'Todas', priority: 'Todas' };
  let lastReport = null;

  function rangeChip(key, label) {
    return `<button type="button" class="chip ${state.preset === key ? 'active' : ''}" data-preset="${key}">${label}</button>`;
  }

  async function render() {
    const container = document.getElementById('viewContainer');
    if (!container.querySelector('.data-table') && !container.querySelector('.empty-state')) container.innerHTML = App.ui.skeleton.table(5);

    const categories = await storage.getSetting('categories', App.config.defaultCategories);
    const locations = await App.services.locationService.listActive();
    const technicians = await reportService.listTechnicians();

    const { from, to } = state.preset === 'custom'
      ? { from: state.from ? new Date(state.from).getTime() : null, to: state.to ? new Date(state.to).getTime() + 86399999 : null }
      : reportService.rangePreset(state.preset);

    const report = await reportService.buildReport({
      from, to,
      location: state.location, category: state.category, technician: state.technician,
      status: state.status, priority: state.priority,
    });
    lastReport = report;

    container.innerHTML = `
      <div class="content-header">
        <div><h1>Reportes</h1><p>Genera reportes filtrados con datos reales del sistema y expórtalos.</p></div>
        <button type="button" class="btn btn-primary" id="execReportBtn">${REPORT_ICON}<span>Generar Informe Ejecutivo</span></button>
      </div>

      <div class="toolbar">
        <div class="chip-group">
          ${rangeChip('diario', 'Diario')}
          ${rangeChip('semanal', 'Semanal')}
          ${rangeChip('mensual', 'Mensual')}
          ${rangeChip('anual', 'Anual')}
          ${rangeChip('custom', 'Rango personalizado')}
        </div>
      </div>
      ${state.preset === 'custom' ? `
      <div class="toolbar">
        <input type="date" class="input" id="repFrom" style="width:auto;height:32px;" value="${state.from}">
        <input type="date" class="input" id="repTo" style="width:auto;height:32px;" value="${state.to}">
      </div>` : ''}

      <div class="toolbar">
        <select class="input" id="repLocation" style="width:auto;height:32px;">
          <option value="Todas">Toda ubicación</option>
          ${locations.map((l) => `<option value="${escapeHtml(l.name)}" ${state.location === l.name ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
        </select>
        <select class="input" id="repCategory" style="width:auto;height:32px;">
          <option value="Todas">Toda categoría</option>
          ${categories.map((c) => `<option value="${escapeHtml(c)}" ${state.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
        <select class="input" id="repTechnician" style="width:auto;height:32px;">
          <option value="Todos">Todo técnico</option>
          ${technicians.map((t) => `<option value="${t.id}" ${state.technician === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
        </select>
        <select class="input" id="repStatus" style="width:auto;height:32px;">
          <option value="Todas">Todo estado</option>
          ${statusFlow.map((s) => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select class="input" id="repPriority" style="width:auto;height:32px;">
          <option value="Todas">Toda prioridad</option>
          <option value="__unassigned__" ${state.priority === '__unassigned__' ? 'selected' : ''}>Sin asignar</option>
          ${priorities.map((p) => `<option value="${p}" ${state.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:var(--space-5);">
        <div class="stat-card"><div class="stat-card-top"><span class="stat-label">Total</span></div><span class="stat-value">${report.summary.total}</span></div>
        <div class="stat-card"><div class="stat-card-top"><span class="stat-label">Resueltas</span></div><span class="stat-value">${report.summary.resolved}</span></div>
        <div class="stat-card"><div class="stat-card-top"><span class="stat-label">% Resueltas</span></div><span class="stat-value">${report.summary.resolvedPercentage == null ? '—' : report.summary.resolvedPercentage + '%'}</span></div>
        <div class="stat-card"><div class="stat-card-top"><span class="stat-label">Tiempo promedio</span></div><span class="stat-value">${formatMinutes(report.summary.avgResolutionMinutes)}</span></div>
      </div>

      <div class="toolbar">
        <button type="button" class="btn btn-secondary btn-sm" id="exportCsvBtn">Exportar CSV</button>
        <button type="button" class="btn btn-secondary btn-sm" id="exportExcelBtn">Exportar Excel</button>
        <button type="button" class="btn btn-secondary btn-sm" id="exportPdfBtn">Exportar PDF</button>
      </div>

      <div class="card">
        ${report.rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Folio</th><th>Título</th><th>Categoría</th><th>Ubicación</th><th>Prioridad</th><th>Estado</th>
              <th>Usuario</th><th>Técnico</th><th>Fecha</th>
            </tr></thead>
            <tbody>
              ${report.rows.map(rowHtml).join('')}
            </tbody>
          </table>
        </div>` : `
        <div class="empty-state">
          ${REPORT_ICON}
          <h4>Sin resultados para estos filtros</h4>
          <p>Ajusta el rango de fechas o los filtros para ver incidencias.</p>
        </div>`}
      </div>
    `;

    wireFilters(container);
    wireExports(container);
  }

  function rowHtml(r) {
    return `
      <tr>
        <td class="cell-id">${r.folio}</td>
        <td class="cell-title" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td>${escapeHtml(r.location)}</td>
        <td>${escapeHtml(r.priority)}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${escapeHtml(r.reportedBy)}</td>
        <td>${escapeHtml(r.technician)}</td>
        <td class="text-tertiary">${formatDate(r.createdAt)}</td>
      </tr>`;
  }

  function wireFilters(container) {
    container.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => { state.preset = btn.dataset.preset; render(); });
    });
    const from = container.querySelector('#repFrom');
    if (from) from.addEventListener('change', (ev) => { state.from = ev.target.value; render(); });
    const to = container.querySelector('#repTo');
    if (to) to.addEventListener('change', (ev) => { state.to = ev.target.value; render(); });

    container.querySelector('#repLocation').addEventListener('change', (ev) => { state.location = ev.target.value; render(); });
    container.querySelector('#repCategory').addEventListener('change', (ev) => { state.category = ev.target.value; render(); });
    container.querySelector('#repTechnician').addEventListener('change', (ev) => { state.technician = ev.target.value; render(); });
    container.querySelector('#repStatus').addEventListener('change', (ev) => { state.status = ev.target.value; render(); });
    container.querySelector('#repPriority').addEventListener('change', (ev) => { state.priority = ev.target.value; render(); });
  }

  function wireExports(container) {
    const stamp = new Date().toISOString().slice(0, 10);
    container.querySelector('#exportCsvBtn').addEventListener('click', () => {
      exportService.toCSV(lastReport.rows, `reporte-ticketflow-${stamp}.csv`);
    });
    container.querySelector('#exportExcelBtn').addEventListener('click', () => {
      exportService.toExcel(lastReport.rows, `reporte-ticketflow-${stamp}.xlsx`);
    });
    container.querySelector('#exportPdfBtn').addEventListener('click', () => {
      exportService.toPDF(lastReport.summary, lastReport.rows, `reporte-ticketflow-${stamp}.pdf`);
    });
    container.querySelector('#execReportBtn').addEventListener('click', async () => {
      const btn = container.querySelector('#execReportBtn');
      btn.disabled = true;
      try {
        const perf = await statsService.getPerformanceStats();
        const STATUS_COLORS = { 'Pendiente': 'var(--warning-500)', 'Asignada': 'var(--info-500)', 'En Proceso': 'var(--accent-500)', 'Resuelta': 'var(--success-500)' };
        const chartsData = [
          { title: 'Incidencias por prioridad', width: 220, html: charts.barList(perf.byPriority) },
          { title: 'Incidencias por ubicación', width: 220, html: charts.barList(perf.byLocation) },
        ];
        await exportService.generateExecutivePDF(lastReport.summary, chartsData, `informe-ejecutivo-ticketflow-${stamp}.pdf`);
        App.ui.toast.show({ type: 'success', title: 'Informe ejecutivo generado' });
      } catch (err) {
        App.ui.toast.show({ type: 'danger', title: 'No se pudo generar el informe', text: err.message });
      } finally {
        btn.disabled = false;
      }
    });
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.reportsView = { render };

})(window.App = window.App || {});
