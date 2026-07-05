/* =========================================================
   App.ui.views.loginView — pantalla de autenticación
   ========================================================= */
(function (App) {
  'use strict';

  const auth = App.services.authService;
  const { escapeHtml } = App.core.utils;
  const bus = App.core.eventBus;

  const root = () => document.getElementById('loginScreen');

  let state = {
    tab: 'staff',       // 'staff' | 'user'
    userMode: 'login',  // 'login' | 'register'
    error: '',
    loading: false,
  };

  function setState(patch) {
    state = { ...state, ...patch };
    render();
  }

  function alertHtml() {
    if (!state.error) return '';
    return `<div class="form-alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
      <span>${escapeHtml(state.error)}</span>
    </div>`;
  }

  function renderStaffPanel(container) {
    container.innerHTML = `
      ${alertHtml()}
      <form id="staffLoginForm">
        <div class="form-group">
          <label for="staffUsername">Usuario</label>
          <input type="text" id="staffUsername" class="input" placeholder="Ej. admin o leonel" required autofocus autocapitalize="off" autocorrect="off">
        </div>
        <div class="form-group">
          <label for="staffPassword">Contraseña</label>
          <input type="password" id="staffPassword" class="input" placeholder="Tu contraseña" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '<span class="spinner"></span>' : 'Ingresar'}
        </button>
      </form>
      <p class="login-hint">El administrador crea y gestiona las cuentas de los técnicos desde el panel de Técnicos.</p>
    `;

    container.querySelector('#staffLoginForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const username = container.querySelector('#staffUsername').value;
      const password = container.querySelector('#staffPassword').value;
      setState({ loading: true, error: '' });
      try {
        const session = await auth.loginStaff(username, password);
        await finishLogin(session);
      } catch (err) {
        setState({ loading: false, error: err.message });
      }
    });
  }

  function renderUserPanel(container) {
    if (state.userMode === 'login') {
      container.innerHTML = `
        ${alertHtml()}
        <form id="userLoginForm">
          <div class="form-group">
            <label for="userEmail">Correo</label>
            <input type="email" id="userEmail" class="input" placeholder="tu@correo.com" required autofocus>
          </div>
          <div class="form-group">
            <label for="userPassword">Contraseña</label>
            <input type="password" id="userPassword" class="input" placeholder="Tu contraseña" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>
            ${state.loading ? '<span class="spinner"></span>' : 'Iniciar sesión'}
          </button>
        </form>
        <div class="login-switch">¿No tienes cuenta? <button type="button" id="toRegister">Regístrate</button></div>
      `;
      container.querySelector('#userLoginForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const email = container.querySelector('#userEmail').value.trim();
        const password = container.querySelector('#userPassword').value;
        setState({ loading: true, error: '' });
        try {
          const session = await auth.loginUser(email, password);
          await finishLogin(session);
        } catch (err) {
          setState({ loading: false, error: err.message });
        }
      });
      container.querySelector('#toRegister').addEventListener('click', () => setState({ userMode: 'register', error: '' }));
    } else {
      container.innerHTML = `
        ${alertHtml()}
        <form id="userRegisterForm">
          <div class="form-group">
            <label for="regName">Nombre completo</label>
            <input type="text" id="regName" class="input" placeholder="Ej. María Pérez" required autofocus>
          </div>
          <div class="form-group">
            <label for="regEmail">Correo</label>
            <input type="email" id="regEmail" class="input" placeholder="tu@correo.com" required>
          </div>
          <div class="form-group">
            <label for="regPassword">Contraseña</label>
            <input type="password" id="regPassword" class="input" placeholder="Mínimo 6 caracteres" minlength="6" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>
            ${state.loading ? '<span class="spinner"></span>' : 'Crear cuenta'}
          </button>
        </form>
        <div class="login-switch">¿Ya tienes cuenta? <button type="button" id="toLogin">Inicia sesión</button></div>
      `;
      container.querySelector('#userRegisterForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const name = container.querySelector('#regName').value.trim();
        const email = container.querySelector('#regEmail').value.trim();
        const password = container.querySelector('#regPassword').value;
        setState({ loading: true, error: '' });
        try {
          const session = await auth.registerUser({ name, email, password });
          await finishLogin(session);
        } catch (err) {
          setState({ loading: false, error: err.message });
        }
      });
      container.querySelector('#toLogin').addEventListener('click', () => setState({ userMode: 'login', error: '' }));
    }
  }

  async function finishLogin(session) {
    setState({ loading: false, error: '' });
    if (session.mustChangePassword) {
      await promptForcedPasswordChange();
    }
    bus.emit('auth:login', session);
  }

  function promptForcedPasswordChange() {
    return new Promise((resolve) => {
      const { close } = App.ui.modal.open({
        title: 'Crea tu contraseña definitiva',
        persistent: true,
        bodyHtml: `
          <p class="text-secondary" style="margin-bottom:16px;font-size:var(--fs-sm);">
            Por seguridad debes reemplazar la contraseña temporal antes de continuar.
          </p>
          <div class="form-group">
            <label for="newPass1">Nueva contraseña</label>
            <input type="password" id="newPass1" class="input" minlength="6" required>
          </div>
          <div class="form-group">
            <label for="newPass2">Confirmar contraseña</label>
            <input type="password" id="newPass2" class="input" minlength="6" required>
          </div>
          <div id="forcedPassError" class="form-alert" hidden></div>
          <button type="button" id="forcedPassSubmit" class="btn btn-primary btn-block">Guardar y continuar</button>
        `,
      });
      document.getElementById('forcedPassSubmit').addEventListener('click', async () => {
        const p1 = document.getElementById('newPass1').value;
        const p2 = document.getElementById('newPass2').value;
        const errBox = document.getElementById('forcedPassError');
        if (p1.length < 6) { errBox.hidden = false; errBox.textContent = 'Mínimo 6 caracteres.'; return; }
        if (p1 !== p2) { errBox.hidden = false; errBox.textContent = 'Las contraseñas no coinciden.'; return; }
        await auth.changePassword(p1);
        App.ui.toast.show({ type: 'success', title: 'Contraseña actualizada' });
        close();
        resolve();
      });
    });
  }

  function render() {
    const container = root();
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <div class="login-logo"><span class="logo-icon">◆</span><span>TicketFlow</span></div>
          <h1>Bienvenido</h1>
          <p class="login-subtitle">Sistema de gestión de incidencias TI</p>
          <div class="auth-tabs">
            <button type="button" class="auth-tab ${state.tab === 'staff' ? 'active' : ''}" data-tab="staff">Personal TI</button>
            <button type="button" class="auth-tab ${state.tab === 'user' ? 'active' : ''}" data-tab="user">Usuario final</button>
          </div>
          <div id="authPanel"></div>
        </div>
      </div>
    `;
    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setState({ tab: btn.dataset.tab, error: '' }));
    });
    const panel = container.querySelector('#authPanel');
    if (state.tab === 'staff') renderStaffPanel(panel);
    else renderUserPanel(panel);
  }

  function mount() {
    state = { tab: 'staff', userMode: 'login', error: '', loading: false };
    render();
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.loginView = { mount };

})(window.App = window.App || {});
