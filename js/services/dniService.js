/* =========================================================
   App.services.dniService
   -----------------------------------------------------------
   Única capa que habla con la función serverless de Python
   (/api/dni_auth). authService la usa para check/register/login
   de "Usuario final"; la vista de administración de DNIs la usa
   directo para agregar/listar/eliminar DNIs autorizados.
   ========================================================= */
(function (App) {
  'use strict';

  const ENDPOINT = '/api/dni_auth';

  async function call(action, body) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor. Intenta de nuevo.');
    }
    let data = {};
    try { data = await response.json(); } catch { /* respuesta vacía */ }
    if (!response.ok) throw new Error(data.error || 'Ocurrió un error inesperado.');
    return data;
  }

  async function check(dni) { return call('check', { dni }); }
  async function register(dni, password) { return call('register', { dni, password }); }
  async function login(dni, password) { return call('login', { dni, password }); }
  async function changePassword(dni, currentPassword, newPassword) {
    return call('change_password', { dni, currentPassword, newPassword });
  }

  async function addDni(dni, nombre) { return call('add_dni', { dni, nombre }); }
  async function listDni() {
    const { items } = await call('list_dni', {});
    return items || [];
  }
  async function removeDni(id) { return call('remove_dni', { id }); }

  App.services = App.services || {};
  App.services.dniService = { check, register, login, changePassword, addDni, listDni, removeDni };

})(window.App = window.App || {});
