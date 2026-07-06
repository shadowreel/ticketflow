/* =========================================================
   App.data.bootstrap — siembra inicial real del sistema
   (1 admin fijo + 3 técnicos reales), solo si aún no existen.
   No siembra incidencias ni usuarios finales de ejemplo.
   ========================================================= */
(function (App) {
  'use strict';

  const storage = App.data.storageAdapter;
  const { hashPassword } = App.core.utils;
  const { defaultAdmin, initialTechnicians, defaultCategories, defaultSla } = App.config;

  async function ensureAdmin() {
    const existing = await App.data.adminRepository.getAll();
    if (existing.length) return;
    const passwordHash = await hashPassword(defaultAdmin.password);
    await App.data.adminRepository.create({
      id: 'admin',
      username: defaultAdmin.username,
      name: defaultAdmin.name,
      email: defaultAdmin.email,
      passwordHash,
      mustChangePassword: true,
      avatar: null,
    });
  }

  async function ensureTechnicians() {
    const existing = await App.data.technicianRepository.getAll();
    if (existing.length) return;
    for (const tech of initialTechnicians) {
      const passwordHash = await hashPassword(tech.password);
      await App.data.technicianRepository.create({
        name: tech.name,
        username: tech.username,
        email: tech.email,
        position: tech.position,
        passwordHash,
        mustChangePassword: true,
        avatar: null,
        active: true,
      });
    }
  }

  async function ensureSettings() {
    const categories = await storage.getSetting('categories', null);
    if (!categories) await storage.setSetting('categories', defaultCategories);
    const sla = await storage.getSetting('sla', null);
    if (!sla) await storage.setSetting('sla', defaultSla);
    const theme = await storage.getSetting('theme', null);
    if (!theme) await storage.setSetting('theme', 'dark');
  }

  async function run() {
    await ensureAdmin();
    await ensureTechnicians();
    await ensureSettings();
  }

  App.data.bootstrap = { run };

})(window.App = window.App || {});
