/* =========================================================
   App.services.reportService
   -----------------------------------------------------------
   Construye reportes filtrados sobre las incidencias reales
   (sin datos de ejemplo), con un resumen agregado listo para
   mostrar en pantalla o exportar (exportService.js).
   ========================================================= */
(function (App) {
  'use strict';

  const incidentRepo = App.data.incidentRepository;
  const technicianRepo = App.data.technicianRepository;

  function average(nums) {
    if (!nums.length) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }

  function rangePreset(preset) {
    const now = Date.now();
    const day = 86400000;
    if (preset === 'diario') return { from: now - day, to: now };
    if (preset === 'semanal') return { from: now - day * 7, to: now };
    if (preset === 'mensual') return { from: now - day * 30, to: now };
    if (preset === 'anual') return { from: now - day * 365, to: now };
    return { from: null, to: null };
  }

  async function buildReport({ from, to, location, category, technician, status, priority } = {}) {
    const all = await incidentRepo.getAll();

    let filtered = all;
    if (from) filtered = filtered.filter((i) => i.createdAt >= from);
    if (to) filtered = filtered.filter((i) => i.createdAt <= to);
    if (location && location !== 'Todas') filtered = filtered.filter((i) => i.location === location);
    if (category && category !== 'Todas') filtered = filtered.filter((i) => i.category === category);
    if (technician && technician !== 'Todos') filtered = filtered.filter((i) => i.assignedTo && i.assignedTo.id === technician);
    if (status && status !== 'Todas') filtered = filtered.filter((i) => i.status === status);
    if (priority && priority !== 'Todas') {
      filtered = priority === '__unassigned__' ? filtered.filter((i) => !i.priority) : filtered.filter((i) => i.priority === priority);
    }
    filtered = filtered.slice().sort((a, b) => b.createdAt - a.createdAt);

    const resolved = filtered.filter((i) => i.status === 'Resuelta' && i.resolution);
    const byTechnicianResolved = {};
    resolved.forEach((i) => {
      if (!i.assignedTo) return;
      byTechnicianResolved[i.assignedTo.name] = (byTechnicianResolved[i.assignedTo.name] || 0) + 1;
    });
    const topTechnicians = Object.entries(byTechnicianResolved)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const summary = {
      total: filtered.length,
      pending: filtered.filter((i) => i.status === 'Pendiente').length,
      inProgress: filtered.filter((i) => i.status === 'Asignada' || i.status === 'En Proceso').length,
      resolved: resolved.length,
      resolvedPercentage: filtered.length ? Math.round((resolved.length / filtered.length) * 100) : null,
      avgResolutionMinutes: average(resolved.map((i) => i.resolution.timeSpentMinutes || 0)),
      topTechnicians,
      generatedAt: Date.now(),
    };

    const rows = filtered.map((i) => ({
      folio: i.folio,
      title: i.title,
      category: i.category,
      location: i.location || '—',
      priority: i.priority || 'Sin asignar',
      status: i.status,
      reportedBy: i.reportedBy.name,
      technician: i.assignedTo ? i.assignedTo.name : 'Sin asignar',
      createdAt: i.createdAt,
      solution: i.resolution ? i.resolution.solution : '',
      observations: i.description || '',
    }));

    return { summary, rows };
  }

  async function listTechnicians() { return technicianRepo.getAll(); }

  App.services = App.services || {};
  App.services.reportService = { buildReport, rangePreset, listTechnicians };

})(window.App = window.App || {});
