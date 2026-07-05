/* =========================================================
   App.ui.views.settingsView — configuración del sistema (solo admin)
   ========================================================= */
(function (App) {
  'use strict';

  const storage = App.data.storageAdapter;
  const { escapeHtml } = App.core.utils;

  const TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  async function render() {
    const container = document.getElementById('viewContainer');
    const categories = await storage.getSetting('categories', App.config.defaultCategories);
    const sla = await storage.getSetting('sla', App.config.defaultSla);

    const collaborative = storage.isCollaborative();

    const theme = App.core.theme.getTheme();
    const accent = App.core.theme.getAccent();
    const accentLabels = { cyan: 'Cian', emerald: 'Esmeralda', purple: 'Morado', orange: 'Naranja' };

    container.innerHTML = `
      <div class="content-header"><div><h1>Configuración</h1><p>Ajustes globales del sistema de incidencias.</p></div></div>

      <div class="card card-pad settings-section">
        <h3>Apariencia</h3>
        <p>Personaliza cómo se ve TicketFlow para ti en este navegador.</p>
        <div class="form-group">
          <label>Tema</label>
          <div class="tab-group" id="themeTabs">
            <button type="button" class="tab-btn ${theme === 'dark' ? 'active' : ''}" data-theme-option="dark">Oscuro</button>
            <button type="button" class="tab-btn ${theme === 'light' ? 'active' : ''}" data-theme-option="light">Claro</button>
          </div>
        </div>
        <div class="form-group">
          <label>Color de acento</label>
          <div class="accent-swatch-row" id="accentSwatches">
            ${App.core.theme.ACCENTS.map((a) => `
              <button type="button" class="accent-swatch accent-swatch-${a} ${accent === a ? 'selected' : ''}" data-accent-option="${a}" title="${accentLabels[a]}" aria-label="${accentLabels[a]}"></button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card card-pad settings-section">
        <h3>Estado de sincronización</h3>
        <p>
          <span class="pill ${collaborative ? 'tone-neutral' : 'tone-neutral'}" style="${collaborative ? 'color:var(--success-500);background:color-mix(in srgb, var(--success-500) 15%, transparent);' : ''}">
            ${collaborative ? '● Colaborativo (Firebase)' : '● Local (solo este navegador)'}
          </span>
        </p>
        <p>${collaborative
          ? 'Los datos se sincronizan en tiempo real entre todas las computadoras conectadas a este mismo proyecto de Firebase.'
          : 'No hay credenciales de Firebase configuradas en js/core/firebaseConfig.js — los datos solo viven en este navegador. Completa ese archivo para habilitar la colaboración entre varias computadoras.'}</p>
      </div>

      <div class="card card-pad settings-section">
        <h3>Categorías de incidencia</h3>
        <p>Estas categorías aparecen al reportar una incidencia.</p>
        <div class="tag-editable-list" id="categoryList"></div>
        <form id="addCategoryForm" style="display:flex;gap:8px;margin-top:16px;max-width:360px;">
          <input type="text" id="newCategory" class="input" placeholder="Nueva categoría">
          <button type="submit" class="btn btn-secondary">Agregar</button>
        </form>
      </div>

      <div class="card card-pad settings-section">
        <h3>Tiempo objetivo de resolución (SLA)</h3>
        <p>Minutos esperados de resolución según prioridad. Se usa para medir el cumplimiento en las estadísticas.</p>
        <div id="slaForm" class="form-row" style="grid-template-columns:repeat(4,1fr);"></div>
        <button type="button" class="btn btn-secondary" id="saveSlaBtn" style="margin-top:12px;">Guardar SLA</button>
      </div>

      <div class="card card-pad settings-section">
        <h3>Respaldo de datos</h3>
        <p>Toda la información vive en este navegador (localStorage). Exporta una copia de seguridad periódicamente.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" id="exportBtn">Exportar copia (JSON)</button>
          <button type="button" class="btn btn-secondary" id="importTriggerBtn">Importar copia</button>
          <input type="file" id="importInput" accept="application/json" hidden>
        </div>
      </div>
    `;

    renderCategories(categories);
    renderSlaInputs(sla);

    container.querySelectorAll('[data-theme-option]').forEach((btn) => {
      btn.addEventListener('click', () => {
        App.core.theme.applyTheme(btn.dataset.themeOption);
        container.querySelectorAll('[data-theme-option]').forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
    container.querySelectorAll('[data-accent-option]').forEach((btn) => {
      btn.addEventListener('click', () => {
        App.core.theme.applyAccent(btn.dataset.accentOption);
        container.querySelectorAll('[data-accent-option]').forEach((b) => b.classList.toggle('selected', b === btn));
      });
    });

    document.getElementById('addCategoryForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const input = document.getElementById('newCategory');
      const value = input.value.trim();
      if (!value) return;
      const current = await storage.getSetting('categories', App.config.defaultCategories);
      if (current.includes(value)) { App.ui.toast.show({ type: 'danger', title: 'Esa categoría ya existe' }); return; }
      await storage.setSetting('categories', [...current, value]);
      input.value = '';
      renderCategories(await storage.getSetting('categories', App.config.defaultCategories));
      App.ui.toast.show({ type: 'success', title: 'Categoría agregada' });
    });

    document.getElementById('saveSlaBtn').addEventListener('click', async () => {
      const updated = {};
      App.config.priorities.forEach((p) => {
        const el = document.getElementById(`sla-${p}`);
        updated[p] = Math.max(1, parseInt(el.value, 10) || App.config.defaultSla[p]);
      });
      await storage.setSetting('sla', updated);
      App.ui.toast.show({ type: 'success', title: 'SLA actualizado' });
    });

    document.getElementById('exportBtn').addEventListener('click', async () => {
      const backup = await storage.exportAll();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticketflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      App.ui.toast.show({ type: 'success', title: 'Copia de seguridad descargada' });
    });

    document.getElementById('importTriggerBtn').addEventListener('click', () => document.getElementById('importInput').click());
    document.getElementById('importInput').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (!confirm('Esto reemplazará todos los datos actuales con los del archivo. ¿Continuar?')) return;
        await storage.importAll(parsed);
        App.ui.toast.show({ type: 'success', title: 'Datos restaurados', text: 'Recargando la aplicación...' });
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        App.ui.toast.show({ type: 'danger', title: 'Archivo inválido', text: err.message });
      }
    });
  }

  function renderCategories(categories) {
    const wrap = document.getElementById('categoryList');
    wrap.innerHTML = categories.map((c) => `
      <span class="tag-editable">${escapeHtml(c)}<button type="button" data-remove-cat="${escapeHtml(c)}">${TRASH_ICON}</button></span>
    `).join('');
    wrap.querySelectorAll('[data-remove-cat]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const current = await storage.getSetting('categories', App.config.defaultCategories);
        await storage.setSetting('categories', current.filter((c) => c !== btn.dataset.removeCat));
        renderCategories(await storage.getSetting('categories', App.config.defaultCategories));
      });
    });
  }

  function renderSlaInputs(sla) {
    const wrap = document.getElementById('slaForm');
    wrap.innerHTML = App.config.priorities.map((p) => `
      <div class="form-group">
        <label for="sla-${p}">${p}</label>
        <input type="number" min="1" id="sla-${p}" class="input" value="${sla[p] || App.config.defaultSla[p]}">
      </div>
    `).join('');
  }

  App.ui.views = App.ui.views || {};
  App.ui.views.settingsView = { render };

})(window.App = window.App || {});
