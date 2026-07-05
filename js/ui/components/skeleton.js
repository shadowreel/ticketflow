/* =========================================================
   App.ui.skeleton — placeholders de carga (shimmer) para las
   vistas que dependen de datos asíncronos (ahora más notorio
   con Firestore, cuya latencia de red es real, a diferencia
   de localStorage que resolvía instantáneo).
   ========================================================= */
(function (App) {
  'use strict';

  function statsGrid(count = 4) {
    return `<div class="stats-grid">${Array.from({ length: count }, () => `
      <div class="stat-card">
        <div class="stat-card-top">
          <span class="skeleton" style="width:70px;height:11px;"></span>
          <span class="skeleton" style="width:34px;height:34px;border-radius:var(--radius-md);"></span>
        </div>
        <span class="skeleton" style="width:50px;height:26px;"></span>
      </div>`).join('')}</div>`;
  }

  function table(rows = 5) {
    return `<div class="card"><div class="table-wrap"><table class="data-table"><tbody>
      ${Array.from({ length: rows }, () => `
        <tr>
          <td><span class="skeleton" style="width:64px;height:14px;"></span></td>
          <td><span class="skeleton" style="width:220px;height:14px;"></span></td>
          <td><span class="skeleton" style="width:80px;height:14px;"></span></td>
          <td><span class="skeleton" style="width:60px;height:20px;border-radius:var(--radius-full);"></span></td>
          <td><span class="skeleton" style="width:90px;height:20px;border-radius:var(--radius-full);"></span></td>
        </tr>`).join('')}
    </tbody></table></div></div>`;
  }

  function cards(count = 3) {
    return `<div class="people-grid">${Array.from({ length: count }, () => `
      <div class="person-card">
        <span class="skeleton" style="width:64px;height:64px;border-radius:50%;margin:0 auto 12px;"></span>
        <span class="skeleton" style="width:100px;height:14px;margin:0 auto 8px;"></span>
        <span class="skeleton" style="width:70px;height:11px;margin:0 auto;"></span>
      </div>`).join('')}</div>`;
  }

  App.ui = App.ui || {};
  App.ui.skeleton = { statsGrid, table, cards };

})(window.App = window.App || {});
