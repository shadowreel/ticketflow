/* =========================================================
   App.services.exportService
   -----------------------------------------------------------
   Exportación de reportes a CSV (sin dependencias), Excel
   (SheetJS) y PDF (jsPDF + jspdf-autotable, cargados vía CDN
   en index.html). El "Informe Ejecutivo" reutiliza los mismos
   gráficos SVG de App.ui.charts, rasterizados a PNG.
   ========================================================= */
(function (App) {
  'use strict';

  const REPORT_COLUMNS = [
    { key: 'folio', label: 'Folio' },
    { key: 'title', label: 'Título' },
    { key: 'category', label: 'Categoría' },
    { key: 'location', label: 'Ubicación' },
    { key: 'priority', label: 'Prioridad' },
    { key: 'status', label: 'Estado' },
    { key: 'reportedBy', label: 'Usuario' },
    { key: 'technician', label: 'Técnico' },
    { key: 'createdAtLabel', label: 'Fecha y hora' },
    { key: 'solution', label: 'Solución aplicada' },
    { key: 'observations', label: 'Observaciones' },
  ];

  function withDateLabel(rows) {
    return rows.map((r) => ({ ...r, createdAtLabel: App.core.utils.formatDate(r.createdAt) }));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const s = value == null ? '' : String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCSV(rows, filename) {
    const data = withDateLabel(rows);
    const lines = [REPORT_COLUMNS.map((c) => csvEscape(c.label)).join(',')];
    data.forEach((r) => lines.push(REPORT_COLUMNS.map((c) => csvEscape(r[c.key])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
  }

  function toExcel(rows, filename) {
    const data = withDateLabel(rows).map((r) => {
      const obj = {};
      REPORT_COLUMNS.forEach((c) => { obj[c.label] = r[c.key]; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, filename);
  }

  function toPDF(summary, rows, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Reporte de incidencias — TicketFlow', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generado: ${App.core.utils.formatDate(summary.generatedAt)} · Total: ${summary.total} · Resueltas: ${summary.resolved} (${summary.resolvedPercentage ?? '—'}%)`, 14, 22);

    doc.autoTable({
      startY: 28,
      head: [REPORT_COLUMNS.map((c) => c.label)],
      body: withDateLabel(rows).map((r) => REPORT_COLUMNS.map((c) => r[c.key] ?? '')),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [14, 116, 144] },
    });

    doc.save(filename);
  }

  /** Rasteriza un HTML de gráfico (generado con App.ui.charts) a PNG, montándolo temporalmente fuera de pantalla. */
  function chartToPng(chartHtml, width, height) {
    return new Promise((resolve, reject) => {
      const holder = document.createElement('div');
      holder.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;background:#fff;padding:8px;`;
      holder.innerHTML = chartHtml;
      document.body.appendChild(holder);
      const svg = holder.querySelector('svg');
      if (!svg) { document.body.removeChild(holder); resolve(null); return; }
      if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Number(svg.getAttribute('width')) || 200;
        canvas.width = size * 2; canvas.height = size * 2;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        document.body.removeChild(holder);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); document.body.removeChild(holder); resolve(null); };
      img.src = url;
    });
  }

  async function generateExecutivePDF(summary, chartsData, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 18;

    doc.setFontSize(16);
    doc.text('Informe Ejecutivo — TicketFlow', 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generado el ${App.core.utils.formatDate(summary.generatedAt)}`, 14, y);
    doc.setTextColor(0);
    y += 10;

    doc.setFontSize(11);
    const lines = [
      `Total de incidencias en el período: ${summary.total}`,
      `Incidencias resueltas: ${summary.resolved} (${summary.resolvedPercentage ?? '—'}%)`,
      `Pendientes: ${summary.pending}   ·   En proceso: ${summary.inProgress}`,
      `Tiempo promedio de resolución: ${App.core.utils.formatMinutes(summary.avgResolutionMinutes)}`,
    ];
    lines.forEach((l) => { doc.text(l, 14, y); y += 7; });
    y += 3;

    if (summary.topTechnicians.length) {
      doc.setFontSize(12);
      doc.text('Técnicos con mejor rendimiento', 14, y);
      y += 2;
      doc.autoTable({
        startY: y + 2,
        head: [['Técnico', 'Incidencias resueltas']],
        body: summary.topTechnicians.slice(0, 8).map((t) => [t.label, String(t.value)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [14, 116, 144] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    for (const chart of chartsData) {
      const png = await chartToPng(chart.html, chart.width || 200, chart.width || 200);
      if (!png) continue;
      if (y > 220) { doc.addPage(); y = 18; }
      doc.setFontSize(11);
      doc.text(chart.title, 14, y);
      y += 4;
      doc.addImage(png, 'PNG', 14, y, 70, 70);
      y += 76;
    }

    doc.save(filename);
  }

  App.services = App.services || {};
  App.services.exportService = { toCSV, toExcel, toPDF, generateExecutivePDF };

})(window.App = window.App || {});
