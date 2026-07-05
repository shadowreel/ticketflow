/* =========================================================
   App.services.statsService
   -----------------------------------------------------------
   Cálculo de estadísticas 100% derivadas de los datos reales
   almacenados (incidencias, técnicos, usuarios). Nada aleatorio.
   ========================================================= */
(function (App) {
  'use strict';

  const incidentRepo = App.data.incidentRepository;
  const technicianRepo = App.data.technicianRepository;
  const userRepo = App.data.userRepository;
  const storage = App.data.storageAdapter;
  const { roles, priorities, statusFlow, defaultCategories } = App.config;

  function average(nums) {
    if (!nums.length) return 0;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }

  function flattenHistory(incidents) {
    return incidents
      .flatMap((inc) => inc.history.map((h) => ({ ...h, folio: inc.folio, incidentId: inc.id, title: inc.title })))
      .sort((a, b) => b.at - a.at);
  }

  async function getAdminStats() {
    const [incidents, technicians, users] = await Promise.all([incidentRepo.getAll(), technicianRepo.getAll(), userRepo.getAll()]);
    const categories = await storage.getSetting('categories', defaultCategories);
    const sla = await storage.getSetting('sla', App.config.defaultSla);

    const byStatus = Object.fromEntries(statusFlow.map((s) => [s, incidents.filter((i) => i.status === s).length]));
    const byPriority = Object.fromEntries(priorities.map((p) => [p, incidents.filter((i) => i.priority === p).length]));
    const byCategory = categories.map((c) => ({ label: c, value: incidents.filter((i) => i.category === c).length }));

    const resolved = incidents.filter((i) => i.status === 'Resuelta' && i.resolution);
    const avgResolutionMinutes = average(resolved.map((i) => i.resolution.timeSpentMinutes || 0));
    const onTimeCount = resolved.filter((i) => ((i.resolvedAt - i.createdAt) / 60000) <= (sla[i.priority] || Infinity)).length;
    const slaCompliance = resolved.length ? Math.round((onTimeCount / resolved.length) * 100) : null;

    const byTechnician = technicians.map((t) => ({
      label: t.name,
      value: incidents.filter((i) => i.assignedTo && i.assignedTo.id === t.id && i.status === 'Resuelta').length,
    })).sort((a, b) => b.value - a.value);

    const byUser = users.map((u) => ({
      label: u.name,
      value: incidents.filter((i) => i.reportedBy.id === u.id).length,
    })).sort((a, b) => b.value - a.value).filter((u) => u.value > 0);

    return {
      total: incidents.length,
      pending: byStatus['Pendiente'] || 0,
      inProgress: (byStatus['Asignada'] || 0) + (byStatus['En Proceso'] || 0),
      resolved: byStatus['Resuelta'] || 0,
      activeTechnicians: technicians.filter((t) => t.active !== false).length,
      totalUsers: users.length,
      avgResolutionMinutes,
      slaCompliance,
      byStatus, byPriority, byCategory, byTechnician,
      topTechnician: byTechnician[0] && byTechnician[0].value > 0 ? byTechnician[0] : null,
      topUser: byUser[0] || null,
      recentActivity: flattenHistory(incidents).slice(0, 8),
    };
  }

  async function getTechnicianStats(session) {
    const incidents = await incidentRepo.getByTechnician(session.id);
    const resolved = incidents.filter((i) => i.status === 'Resuelta' && i.resolution);
    return {
      assigned: incidents.length,
      inProgress: incidents.filter((i) => i.status === 'En Proceso' || i.status === 'Asignada').length,
      resolved: resolved.length,
      avgResolutionMinutes: average(resolved.map((i) => i.resolution.timeSpentMinutes || 0)),
      byPriority: priorities.map((p) => ({ label: p, value: incidents.filter((i) => i.priority === p).length })),
      recentActivity: flattenHistory(incidents).slice(0, 8),
    };
  }

  async function getUserStats(session) {
    const incidents = await incidentRepo.getByUser(session.id);
    return {
      total: incidents.length,
      pending: incidents.filter((i) => i.status === 'Pendiente').length,
      inProgress: incidents.filter((i) => i.status === 'Asignada' || i.status === 'En Proceso').length,
      resolved: incidents.filter((i) => i.status === 'Resuelta').length,
      byStatus: statusFlow.map((s) => ({ label: s, value: incidents.filter((i) => i.status === s).length })),
      recentActivity: flattenHistory(incidents).slice(0, 8),
    };
  }

  async function getForSession(session) {
    if (session.role === roles.ADMIN) return getAdminStats();
    if (session.role === roles.TECHNICIAN) return getTechnicianStats(session);
    return getUserStats(session);
  }

  App.services = App.services || {};
  App.services.statsService = { getAdminStats, getTechnicianStats, getUserStats, getForSession };

})(window.App = window.App || {});
