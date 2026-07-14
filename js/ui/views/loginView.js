/* =========================================================
   App.ui.views.loginView — pantalla de autenticación
   ========================================================= */
(function (App) {
  'use strict';

  const auth = App.services.authService;
  const { escapeHtml, passwordToggleHtml, wirePasswordToggles } = App.core.utils;
  const bus = App.core.eventBus;

  const root = () => document.getElementById('loginScreen');

  let state = {
    tab: 'staff',        // 'staff' | 'user'
    dniStep: 'enter',    // 'enter' | 'password'
    dniValue: '',
    dniNombre: '',
    dniMode: 'login',    // 'login' | 'register' (solo aplica en dniStep 'password')
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
          <input type="text" id="staffUsername" class="input" placeholder="Usuario" required autofocus autocapitalize="off" autocorrect="off">
        </div>
        <div class="form-group">
          <label for="staffPassword">Contraseña</label>
          <div class="password-field">
            <input type="password" id="staffPassword" class="input" placeholder="Tu contraseña" required>
            ${passwordToggleHtml('staffPassword')}
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '<span class="spinner"></span>' : 'Ingresar'}
        </button>
      </form>
      <p class="login-hint">El administrador crea y gestiona las cuentas de los técnicos desde el panel de Técnicos.</p>
    `;
    wirePasswordToggles(container);

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
    if (state.dniStep === 'enter') {
      container.innerHTML = `
        ${alertHtml()}
        <form id="dniCheckForm">
          <div class="form-group">
            <label for="dniInput">DNI</label>
            <input type="text" id="dniInput" class="input" placeholder="Ej. 12345678" required autofocus
              inputmode="numeric" maxlength="8" autocomplete="off" value="${escapeHtml(state.dniValue)}">
          </div>
          <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>
            ${state.loading ? '<span class="spinner"></span>' : 'Continuar'}
          </button>
        </form>
        <p class="login-hint">Solo el personal autorizado por el administrador puede registrarse aquí.</p>
      `;
      container.querySelector('#dniCheckForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const dni = container.querySelector('#dniInput').value.trim();
        setState({ loading: true, error: '' });
        try {
          const result = await auth.checkDni(dni);
          if (result.status === 'not_found') {
            setState({ loading: false, error: 'Este DNI no está autorizado. Contacta al administrador.' });
            return;
          }
          setState({
            loading: false,
            error: '',
            dniValue: dni,
            dniNombre: result.nombre,
            dniMode: result.status === 'has_account' ? 'login' : 'register',
            dniStep: 'password',
          });
        } catch (err) {
          setState({ loading: false, error: err.message });
        }
      });
      return;
    }

    const isRegister = state.dniMode === 'register';
    container.innerHTML = `
      <div class="dni-greeting">¡Hola, ${escapeHtml(state.dniNombre)}!</div>
      ${alertHtml()}
      <form id="dniPasswordForm">
        ${isRegister ? `
        <div class="form-group">
          <label for="dniEmail">Correo</label>
          <input type="email" id="dniEmail" class="input" placeholder="tu@correo.com" required>
        </div>` : ''}
        <div class="form-group">
          <label for="dniPassword">${isRegister ? 'Crea tu contraseña' : 'Contraseña'}</label>
          <div class="password-field">
            <input type="password" id="dniPassword" class="input"
              placeholder="${isRegister ? 'Mínimo 6 caracteres' : 'Tu contraseña'}"
              ${isRegister ? 'minlength="6"' : ''} required autofocus>
            ${passwordToggleHtml('dniPassword')}
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '<span class="spinner"></span>' : (isRegister ? 'Crear cuenta' : 'Ingresar')}
        </button>
      </form>
      <div class="login-switch"><button type="button" id="dniBack">← Usar otro DNI</button></div>
    `;
    wirePasswordToggles(container);
    container.querySelector('#dniPasswordForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const password = container.querySelector('#dniPassword').value;
      const email = isRegister ? container.querySelector('#dniEmail').value.trim() : null;
      setState({ loading: true, error: '' });
      try {
        const session = isRegister
          ? await auth.registerUserDni(state.dniValue, password, email)
          : await auth.loginUserDni(state.dniValue, password);
        await finishLogin(session);
      } catch (err) {
        setState({ loading: false, error: err.message });
      }
    });
    container.querySelector('#dniBack').addEventListener('click', () => {
      setState({ dniStep: 'enter', dniValue: '', dniNombre: '', error: '' });
    });
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
            <div class="password-field">
              <input type="password" id="newPass1" class="input" minlength="6" required>
              ${passwordToggleHtml('newPass1')}
            </div>
          </div>
          <div class="form-group">
            <label for="newPass2">Confirmar contraseña</label>
            <div class="password-field">
              <input type="password" id="newPass2" class="input" minlength="6" required>
              ${passwordToggleHtml('newPass2')}
            </div>
          </div>
          <div id="forcedPassError" class="form-alert" hidden></div>
          <button type="button" id="forcedPassSubmit" class="btn btn-primary btn-block">Guardar y continuar</button>
        `,
      });
      wirePasswordToggles(document.getElementById('modalRoot'));
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
          <div class="login-logo">
            <span class="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="12" rx="2"/>
                <path d="M8 20h8M12 16v4"/>
              </svg>
            </span>
            <span>SISTEMA DE REGISTRO DE INCIDENTES TI</span>
          </div>
          <h1>Bienvenido</h1>
          <div class="auth-tabs">
            <button type="button" class="auth-tab ${state.tab === 'staff' ? 'active' : ''}" data-tab="staff">Personal TI</button>
            <button type="button" class="auth-tab ${state.tab === 'user' ? 'active' : ''}" data-tab="user">Usuario final</button>
          </div>
          <div id="authPanel"></div>
          <p class="login-hint">
            ¿No puedes entrar con ninguna cuenta? <button type="button" id="resetLocalDataBtn" style="color:var(--accent-400);font-weight:600;">Reiniciar datos de prueba</button>
          </p>
        </div>
      </div>
    `;
    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setState({
        tab: btn.dataset.tab, error: '', dniStep: 'enter', dniValue: '', dniNombre: '',
      }));
    });
    const panel = container.querySelector('#authPanel');
    if (state.tab === 'staff') renderStaffPanel(panel);
    else renderUserPanel(panel);

    container.querySelector('#resetLocalDataBtn').addEventListener('click', () => {
      const ok = confirm(
        'Esto borra todas las incidencias, usuarios y técnicos guardados en este navegador y vuelve a crear las cuentas de ejemplo (admin y los 3 técnicos) con las contraseñas actuales del sistema.\n\n¿Continuar?'
      );
      if (!ok) return;
      localStorage.clear();
      sessionStorage.clear();
      location.reload();
    });
  }

  function mount() {
    state = {
      tab: 'staff', dniStep: 'enter', dniValue: '', dniNombre: '', dniMode: 'login',
      error: '', loading: false,
    };
    render();
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.loginView = { mount };

})(window.App = window.App || {});
