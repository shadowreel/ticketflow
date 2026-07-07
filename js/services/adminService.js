/* =========================================================
   App.services.adminService
   -----------------------------------------------------------
   CRUD de administradores. Todos los administradores tienen los
   mismos permisos entre sí; las únicas reglas de negocio son de
   seguridad operativa: no puede quedar el sistema sin ningún
   administrador, y nadie puede eliminar su propia cuenta mientras
   la tiene iniciada (para evitar quedar fuera por accidente).
   ========================================================= */
(function (App) {
  'use strict';

  const adminRepo = App.data.adminRepository;
  const technicianRepo = App.data.technicianRepository;
  const { hashPassword, generateTempPassword } = App.core.utils;
  const bus = App.core.eventBus;

  async function listAll() { return adminRepo.getAll(); }

  async function create({ name, username, email, password }) {
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,20}$/.test(cleanUsername)) {
      throw new Error('El usuario debe tener 3-20 caracteres (letras, números, punto, guion).');
    }
    const [existingAdminUsername, existingAdminEmail, existingTechUsername] = await Promise.all([
      adminRepo.getByUsername(cleanUsername),
      adminRepo.getByEmail(email),
      technicianRepo.getByUsername(cleanUsername),
    ]);
    if (existingAdminUsername || existingTechUsername) throw new Error('Ya existe una cuenta con ese usuario.');
    if (existingAdminEmail) throw new Error('Ya existe un administrador con ese correo.');
    const passwordHash = await hashPassword(password);
    const record = await adminRepo.create({
      name: name.trim(), username: cleanUsername, email: email.trim().toLowerCase(),
      passwordHash, mustChangePassword: true, avatar: null,
    });
    bus.emit('admin:created', { record, actor: App.services.authService.getCurrentSession() });
    return record;
  }

  async function update(id, patch) {
    const updated = await adminRepo.update(id, patch);
    bus.emit('admin:updated', { record: updated, actor: App.services.authService.getCurrentSession() });
    return updated;
  }

  /** Genera una contraseña temporal y fuerza su cambio en el próximo login. Se muestra una sola vez. */
  async function resetPassword(id) {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await update(id, { passwordHash, mustChangePassword: true });
    return tempPassword;
  }

  async function remove(id, currentSessionId) {
    if (id === currentSessionId) throw new Error('No puedes eliminar tu propia cuenta mientras tienes la sesión iniciada.');
    const all = await adminRepo.getAll();
    if (all.length <= 1) throw new Error('Debe existir al menos un administrador en el sistema.');
    const existing = await adminRepo.getById(id);
    const ok = await adminRepo.remove(id);
    if (ok) bus.emit('admin:deleted', { id, name: existing && existing.name, actor: App.services.authService.getCurrentSession() });
    return ok;
  }

  App.services = App.services || {};
  App.services.adminService = { listAll, create, update, resetPassword, remove };

})(window.App = window.App || {});
