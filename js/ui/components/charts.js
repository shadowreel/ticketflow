/* =========================================================
   App.ui.charts — gráficos SVG minimalistas sin librerías
   (donut + barras horizontales), construidos a partir de
   datos reales calculados por statsService.
   ========================================================= */
(function (App) {
  'use strict';

  const { escapeHtml } = App.core.utils;

  function donut(segments, { size = 168, thickness = 24 } = {}) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const r = (size - thickness) / 2;
    const circumference = 2 * Math.PI * r;
    let cumulative = 0;

    const circles = total === 0
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border-default)" stroke-width="${thickness}"/>`
      : segments.filter((s) => s.value > 0).map((s) => {
        const dash = (s.value / total) * circumference;
        const offset = -(cumulative / total) * circumference;
        cumulative += s.value;
        return `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}"
          stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${offset}" stroke-linecap="butt"/>`;
      }).join('');

    const legend = segments.map((s) => `
      <div class="chart-legend-item">
        <span class="chart-legend-dot" style="background:${s.color}"></span>
        <span class="chart-legend-label">${escapeHtml(s.label)}</span>
        <span class="chart-legend-value">${s.value}</span>
      </div>`).join('');

    return `
      <div class="donut-wrap">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);">
          ${circles}
        </svg>
        <div class="chart-legend">
          ${legend}
          <div class="chart-legend-item" style="border-top:1px solid var(--border-subtle);padding-top:8px;margin-top:2px;">
            <span class="chart-legend-label">Total</span><span class="chart-legend-value">${total}</span>
          </div>
        </div>
      </div>`;
  }

  function barList(segments) {
    const max = Math.max(1, ...segments.map((s) => s.value));
    return segments.map((s) => `
      <div class="bar-chart-row">
        <div class="bar-chart-label" title="${escapeHtml(s.label)}">${escapeHtml(s.label)}</div>
        <div class="bar-chart-track"><div class="bar-chart-fill" style="width:${(s.value / max) * 100}%;background:${s.color || 'var(--accent-500)'};"></div></div>
        <div class="bar-chart-value">${s.value}</div>
      </div>`).join('');
  }

  App.ui = App.ui || {};
  App.ui.charts = { donut, barList };

})(window.App = window.App || {});
