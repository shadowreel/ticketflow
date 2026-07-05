/* =========================================================
   App.services.authService
   -----------------------------------------------------------
   Sesión simulada (sin backend): credenciales con hash SHA-256
   nativo del navegador. La sesión vive en sessionStorage para
   permitir abrir distintos roles en distintas pestañas del
   mismo navegador (útil para probar el flujo completo).
   ========================================================= */
(function (App) {
  'use strict';

  const SESSION_KEY = 'ticketflow:session';
  const { hashPassword } = App.core.utils;
  const { roles } = App.config;
  const adminStorage = App.data.storageAdapter;
  const technicianRepo = App.data.technicianRepository;
  const userRepo = App.data.userRepository;

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function toSessionFromAdmin(record) {
    return {
      id: record.id, role: roles.ADMIN, name: record.name, email: record.email,
      avatar: record.avatar, mustChangePassword: !!record.mustChangePassword,
    };
  }

  function toSessionFromTechnician(record) {
    return {
      id: record.id, role: roles.TECHNICIAN, name: record.name, email: record.email,
      avatar: record.avatar, position: record.position, mustChangePassword: !!record.mustChangePassword,
    };
  }

  function toSessionFromUser(record) {
    return { id: record.id, role: roles.USER, name: record.name, email: record.email, avatar: record.avatar };
  }

  async function loginStaff(username, password) {
    const target = String(username).trim().toLowerCase();
    const passwordHash = await hashPassword(password);

    const [admin] = await adminStorage.getAll('admin');
    if (admin && admin.username.toLowerCase() === target) {
      if (admin.passwordHash !== passwordHash) throw new Error('Contraseña incorrecta.');
      const session = toSessionFromAdmin(admin);
      writeSession(session);
      return session;
    }

    const tech = await technicianRepo.getByUsername(target);
    if (!tech) throw new Error('No existe una cuenta con ese usuario.');
    if (tech.active === false) throw new Error('Esta cuenta ya no está disponible.');
    if (tech.passwordHash !== passwordHash) throw new Error('Contraseña incorrecta.');
    const session = toSessionFromTechnician(tech);
    writeSession(session);
    return session;
  }

  async function registerUser({ name, email, password }) {
    const existing = await userRepo.getByEmail(email);
    if (existing) throw new Error('Ya existe una cuenta con ese correo. Inicia sesión.');
    const passwordHash = await hashPassword(password);
    const record = await userRepo.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash, avatar: null });
    const session = toSessionFromUser(record);
    writeSession(session);
    return session;
  }

  async function loginUser(email, password) {
    const record = await userRepo.getByEmail(email);
    if (!record) throw new Error('No existe una cuenta con ese correo.');
    const passwordHash = await hashPassword(password);
    if (record.passwordHash !== passwordHash) throw new Error('Contraseña incorrecta.');
    const session = toSessionFromUser(record);
    writeSession(session);
    return session;
  }

  async function getCurrentRecord() {
    const session = readSession();
    if (!session) return null;
    if (session.role === roles.ADMIN) return (await adminStorage.getAll('admin'))[0];
    if (session.role === roles.TECHNICIAN) return technicianRepo.getById(session.id);
    return userRepo.getById(session.id);
  }

  async function verifyCurrentPassword(password) {
    const record = await getCurrentRecord();
    if (!record) return false;
    const passwordHash = await hashPassword(password);
    return record.passwordHash === passwordHash;
  }

  async function changePassword(newPassword) {
    const session = readSession();
    if (!session) throw new Error('No hay sesión activa.');
    const passwordHash = await hashPassword(newPassword);
    if (session.role === roles.ADMIN) {
      await adminStorage.update('admin', session.id, { passwordHash, mustChangePassword: false });
    } else if (session.role === roles.TECHNICIAN) {
      await technicianRepo.update(session.id, { passwordHash, mustChangePassword: false });
    } else {
      await userRepo.update(session.id, { passwordHash });
    }
    session.mustChangePassword = false;
    writeSession(session);
    return session;
  }

  function updateSessionProfile(patch) {
    const session = readSession();
    if (!session) return null;
    const next = { ...session, ...patch };
    writeSession(next);
    return next;
  }

  function getCurrentSession() { return readSession(); }

  function logout() { sessionStorage.removeItem(SESSION_KEY); }

  App.services = App.services || {};
  App.services.authService = {
    loginStaff, registerUser, loginUser,
    changePassword, verifyCurrentPassword, getCurrentRecord,
    updateSessionProfile, getCurrentSession, logout,
  };

})(window.App = window.App || {});
