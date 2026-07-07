/* =========================================================
   App.services.technicianService
   -----------------------------------------------------------
   CRUD de técnicos con las reglas de negocio (contraseña inicial,
   protección contra eliminar/desactivar técnicos con incidencias
   abiertas) que el administrador utiliza para gestionar su equipo.
   ========================================================= */
(function (App) {
  'use strict';

  const techRepo = App.data.technicianRepository;
  const incidentRepo = App.data.incidentRepository;
  const { hashPassword, generateTempPassword } = App.core.utils;
  const bus = App.core.eventBus;

  async function listWithStats() {
    const [technicians, incidents] = await Promise.all([techRepo.getAll(), incidentRepo.getAll()]);
    return technicians.map((t) => {
      const assigned = incidents.filter((i) => i.assignedTo && i.assignedTo.id === t.id);
      const resolved = assigned.filter((i) => i.status === 'Resuelta');
      const openCount = assigned.length - resolved.length;
      return { ...t, assignedCount: assigned.length, resolvedCount: resolved.length, openCount };
    });
  }

  async function create({ name, username, email, position, password }) {
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,20}$/.test(cleanUsername)) {
      throw new Error('El usuario debe tener 3-20 caracteres (letras, números, punto, guion).');
    }
    const [existingUsername, existingEmail] = await Promise.all([
      techRepo.getByUsername(cleanUsername),
      techRepo.getByEmail(email),
    ]);
    if (existingUsername) throw new Error('Ya existe un técnico con ese usuario.');
    if (existingEmail) throw new Error('Ya existe un técnico con ese correo.');
    const passwordHash = await hashPassword(password);
    const record = await techRepo.create({
      name: name.trim(), username: cleanUsername, email: email.trim().toLowerCase(), position: position.trim(),
      passwordHash, mustChangePassword: true, avatar: null,
    });
    bus.emit('technician:created', { record, actor: App.services.authService.getCurrentSession() });
    return record;
  }

  async function update(id, patch) {
    const updated = await techRepo.update(id, patch);
    bus.emit('technician:updated', { record: updated, actor: App.services.authService.getCurrentSession() });
    return updated;
  }

  /** Genera una contraseña temporal y fuerza su cambio en el próximo login. Se muestra una sola vez al admin. */
  async function resetPassword(id) {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await update(id, { passwordHash, mustChangePassword: true });
    return tempPassword;
  }

  async function setActive(id, active) {
    if (!active) {
      const openIncidents = (await incidentRepo.getByTechnician(id)).filter((i) => i.status !== 'Resuelta');
      if (openIncidents.length) throw new Error('Este técnico tiene incidencias sin resolver. Reasígnalas antes de desactivarlo.');
    }
    return update(id, { active });
  }

  async function remove(id) {
    const openIncidents = (await incidentRepo.getByTechnician(id)).filter((i) => i.status !== 'Resuelta');
    if (openIncidents.length) throw new Error('Este técnico tiene incidencias sin resolver. Reasígnalas antes de eliminarlo.');
    const existing = await techRepo.getById(id);
    const ok = await techRepo.remove(id);
    if (ok) bus.emit('technician:deleted', { id, name: existing && existing.name, actor: App.services.authService.getCurrentSession() });
    return ok;
  }

  App.services = App.services || {};
  App.services.technicianService = { listWithStats, create, update, setActive, remove, resetPassword };

})(window.App = window.App || {});
