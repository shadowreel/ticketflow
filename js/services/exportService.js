/* =========================================================
   App.services.exportService
   -----------------------------------------------------------
   Exportación de reportes a CSV (sin dependencias), Excel
   (SheetJS) y PDF (jsPDF + jspdf-autotable, cargados vía CDN
   en index.html). El "Informe Ejecutivo" lista todas las
   incidencias del período seleccionado, agrupadas por estado.
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
    doc.text('Reporte de incidencias', 14, 16);
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

  function dateLabel(ts) { return new Date(ts).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function timeLabel(ts) { return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }); }

  const INCIDENT_COLUMNS = [
    { key: 'folio', label: 'Folio' },
    { key: 'title', label: 'Título' },
    { key: 'location', label: 'Ubicación' },
    { key: 'category', label: 'Categoría' },
    { key: 'priority', label: 'Prioridad' },
    { key: 'technician', label: 'Técnico' },
    { key: 'dateLabel', label: 'Fecha' },
    { key: 'timeLabel', label: 'Hora' },
  ];

  const SECTIONS = [
    { status: 'Pendiente', title: 'Sin asignar (pendientes)' },
    { status: 'Asignada', title: 'Asignadas' },
    { status: 'En Proceso', title: 'En proceso' },
    { status: 'Resuelta', title: 'Resueltas' },
  ];

  /** Informe técnico completo: todas las incidencias del período seleccionado, agrupadas por estado. */
  function generateExecutivePDF(summary, rows, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 18;

    doc.setFontSize(16);
    doc.text('Informe Técnico de Incidencias', 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generado el ${dateLabel(summary.generatedAt)}, ${timeLabel(summary.generatedAt)}`, 14, y);
    doc.setTextColor(0);
    y += 10;

    doc.setFontSize(11);
    const lines = [
      `Total de incidencias en el período: ${summary.total}`,
      `Resueltas: ${summary.resolved} (${summary.resolvedPercentage ?? '—'}%)   ·   Pendientes: ${summary.pending}   ·   En proceso: ${summary.inProgress}`,
      `Tiempo promedio de resolución: ${App.core.utils.formatMinutes(summary.avgResolutionMinutes)}`,
    ];
    lines.forEach((l) => { doc.text(l, 14, y); y += 7; });
    y += 4;

    const withLabels = rows.map((r) => ({ ...r, dateLabel: dateLabel(r.createdAt), timeLabel: timeLabel(r.createdAt) }));

    SECTIONS.forEach((section) => {
      const sectionRows = withLabels.filter((r) => r.status === section.status).sort((a, b) => b.createdAt - a.createdAt);
      if (y > 260) { doc.addPage(); y = 18; }
      doc.setFontSize(12);
      doc.setTextColor(14, 116, 144);
      doc.text(`${section.title} (${sectionRows.length})`, 14, y);
      doc.setTextColor(0);
      y += 3;

      if (!sectionRows.length) {
        doc.setFontSize(9);
        doc.setTextColor(140);
        doc.text('Sin incidencias en esta categoría.', 14, y + 5);
        doc.setTextColor(0);
        y += 12;
        return;
      }

      doc.autoTable({
        startY: y + 2,
        head: [INCIDENT_COLUMNS.map((c) => c.label)],
        body: sectionRows.map((r) => INCIDENT_COLUMNS.map((c) => r[c.key] ?? '')),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [14, 116, 144] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    });

    if (summary.topTechnicians.length) {
      if (y > 250) { doc.addPage(); y = 18; }
      doc.setFontSize(12);
      doc.text('Técnicos con mejor rendimiento en el período', 14, y);
      doc.autoTable({
        startY: y + 4,
        head: [['Técnico', 'Incidencias resueltas']],
        body: summary.topTechnicians.slice(0, 8).map((t) => [t.label, String(t.value)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [14, 116, 144] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(filename);
  }

  App.services = App.services || {};
  App.services.exportService = { toCSV, toExcel, toPDF, generateExecutivePDF };

})(window.App = window.App || {});
