/* LocalStatement — generación de ficheros de salida, todo en memoria. */
'use strict';

const LS_EXPORTS = (() => {

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  const fmtEu = n => n === null ? '' : n.toFixed(2).replace('.', ',');

  // celda CSV segura: neutraliza inyección de fórmulas (=,+,-,@,tab,CR al inicio)
  // y escapa comillas. Excel/LibreOffice ejecutan =CMD() aunque esté entre comillas.
  function cell(s) {
    s = String(s == null ? '' : s);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  // CSV separado por ; (convención Excel europeo), BOM para tildes
  function csv(txs, name) {
    const head = 'fecha;concepto;importe;saldo\n';
    const body = txs.map(t =>
      [t.date, cell(t.concept), fmtEu(t.amount), fmtEu(t.balance)].join(';')
    ).join('\r\n');
    download(new Blob(['﻿' + head.replace('\n', '\r\n') + body], { type: 'text/csv;charset=utf-8' }), name + '.csv');
  }

  // Excel de verdad (SheetJS): fechas como fecha, importes como número
  function xlsx(txs, name) {
    const rows = txs.map(t => ({
      Fecha: t.date, Concepto: t.concept, Importe: t.amount, Saldo: t.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 11 }, { wch: 52 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, name + '.xlsx');
  }

  // Plantilla de importación de Holded (gestorías ES): Fecha, Concepto, Debe/Haber
  function holded(txs, name) {
    const head = 'Fecha;Concepto;Debe;Haber\n';
    const body = txs.map(t => {
      const debe = t.amount < 0 ? fmtEu(Math.abs(t.amount)) : '';
      const haber = t.amount >= 0 ? fmtEu(t.amount) : '';
      const [y, m, d] = t.date.split('-');
      return [`${d}/${m}/${y}`, cell(t.concept), debe, haber].join(';');
    }).join('\r\n');
    download(new Blob(['﻿' + head.replace('\n', '\r\n') + body], { type: 'text/csv;charset=utf-8' }), name + '_holded.csv');
  }

  // Norma 43 (cuaderno AEB 43): lo importan A3, Sage 50/ContaPlus, ContaSol, Odoo…
  // Valida el fichero antes de descargarlo; si no cuadra, no se entrega.
  function norma43(txs, meta, name) {
    const out = LS_CONTABLE.norma43(txs, meta);
    const check = LS_CONTABLE.validate43(out.content);
    if (!check.ok) throw new Error('N43: ' + check.errors.join('; '));
    download(new Blob([out.content], { type: 'text/plain;charset=utf-8' }), name + '.n43');
    return out;
  }

  // CSV de diario en partida doble (Debe/Haber) con cuentas configurables
  function diario(txs, opts, name) {
    const content = LS_CONTABLE.diario(txs, opts);
    download(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }), name + '_diario.csv');
  }

  // Excel con categorías + hoja resumen (informe premium)
  function xlsxAnalysis(txs, agg, T) {
    const rows = txs.map(t => ({
      Fecha: t.date, Concepto: t.concept, Categoria: t.category || '',
      Importe: t.amount, Saldo: t.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 11 }, { wch: 48 }, { wch: 22 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    const resumen = [
      { A: T('anaIncome'), B: agg.income },
      { A: T('anaExpense'), B: -agg.expense },
      { A: T('anaNet'), B: agg.net },
      { A: '', B: '' },
      ...agg.topCats.map(([k, v]) => ({ A: k.startsWith('custom:') ? k.slice(7) : (agg.names[k] || k), B: -v })),
      { A: '', B: '' },
      { A: 'localstatement.com', B: '' },
    ];
    const ws2 = XLSX.utils.json_to_sheet(resumen, { skipHeader: true });
    ws2['!cols'] = [{ wch: 28 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, T('anaTitle').slice(0, 28));
    XLSX.writeFile(wb, 'localstatement_informe.xlsx');
  }

  return { csv, xlsx, holded, norma43, diario, xlsxAnalysis };
})();
