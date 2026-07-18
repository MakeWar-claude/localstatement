/* LocalStatement — exportación contable: Norma 43 (cuaderno AEB/CECA 43, junio 2012)
   y CSV de diario Debe/Haber. Módulo puro: entrada objetos, salida strings.
   Nada de este fichero toca el DOM ni hace peticiones de red. */
'use strict';

const LS_CONTABLE = (() => {

  // ---------- texto: el cuaderno 43 exige ASCII en mayúsculas y ancho fijo en BYTES,
  // así que transliteramos (á→A, ñ→N, ç→C…) y suprimimos todo lo no imprimible ----------
  function ascii(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[€]/g, 'EUR')
      .replace(/[^\x20-\x7E]/g, ' ')
      .toUpperCase();
  }
  const padN = (v, len) => String(v == null ? '' : v).replace(/\D/g, '').slice(-len).padStart(len, '0');
  const padA = (s, len) => ascii(s).slice(0, len).padEnd(len, ' ');
  // importe: 14 posiciones (12 enteros + 2 decimales), sin coma, valor absoluto
  const amt14 = n => String(Math.round(Math.abs(n) * 100)).padStart(14, '0');
  const yymmdd = iso => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  const r2 = n => Math.round(n * 100) / 100;

  // ---------- cuenta: extraer entidad/oficina/cuenta de un IBAN español o CCC ----------
  // IBAN ES: ES + 2 DC + 4 entidad + 4 oficina + 2 DC + 10 cuenta (24 chars)
  function accountFromText(text) {
    if (!text) return null;
    const t = String(text);
    const iban = t.match(/\bES\d{2}(?:[ .-]?\d){20}\b/);
    if (iban) {
      const d = iban[0].replace(/[^0-9]/g, '');            // 22 dígitos tras quitar 'ES'
      return { entidad: d.slice(2, 6), oficina: d.slice(6, 10), cuenta: d.slice(12, 22) };
    }
    const ccc = t.match(/\b(\d{4})[ .-](\d{4})[ .-](\d{2})[ .-](\d{10})\b/);
    if (ccc) return { entidad: ccc[1], oficina: ccc[2], cuenta: ccc[4] };
    return null;
  }

  // ---------- concepto común (anexo 2 del cuaderno): heurística por texto ----------
  // El orden importa: lo más específico primero ("devolucion recibo" es 14, no 03).
  const CONCEPTOS = [
    [/devoluci|impagad/i, '14'],
    [/nomina|seg\.?\s?soc|seguros sociales|pension|tgss/i, '15'],
    [/prestamo|amortiza|hipotec/i, '05'],
    [/tarjeta|debito compra|pago movil/i, '12'],
    [/cajero|reintegro/i, '11'],
    [/recibo|domicili|adeudo/i, '03'],
    [/transferencia|transf|traspaso|giro|bizum/i, '04'],
    [/comision|interes|mantenim|custodia|impuesto|gasto/i, '17'],
    [/cheque|talon/i, '01'],
    [/ingreso efectivo|entrega|abonare/i, '02'],
  ];
  function conceptoComun(concept) {
    const c = ascii(concept);
    for (const [re, code] of CONCEPTOS) if (re.test(c)) return code;
    return '99';
  }

  // ---------- preparación común: orden cronológico + saldo inicial derivado ----------
  function prepare(txs) {
    const list = txs.filter(t => t.amount !== null && t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
      .slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);   // sort estable
    let saldoInicial = null;
    let acc = 0;
    for (const t of list) {
      acc = r2(acc + t.amount);
      if (t.balance !== null && t.balance !== undefined) {
        saldoInicial = r2(t.balance - acc);                 // saldo antes del primer movimiento
        break;
      }
    }
    const derived = saldoInicial === null;                  // el extracto no imprime saldos
    if (derived) saldoInicial = 0;
    const total = r2(list.reduce((s, t) => r2(s + t.amount), 0));
    return { list, saldoInicial, saldoFinal: r2(saldoInicial + total), derived };
  }

  // ---------- Norma 43 ----------
  // meta opcional: { entidad, oficina, cuenta, nombre } (si no, ceros/espacios:
  // los importadores piden asociar la cuenta al importar, así que no es bloqueante).
  function norma43(txs, meta) {
    const m = meta || {};
    const { list, saldoInicial, saldoFinal, derived } = prepare(txs);
    if (!list.length) throw new Error('no transactions');
    const ent = padN(m.entidad || '0', 4);
    const ofi = padN(m.oficina || '0', 4);
    const cta = padN(m.cuenta || '0', 10);
    const f0 = yymmdd(list[0].date);
    const f1 = yymmdd(list[list.length - 1].date);

    const lines = [];
    // 11 — cabecera de cuenta: fechas del periodo, saldo inicial, divisa 978, modalidad 1
    lines.push('11' + ent + ofi + cta + f0 + f1 +
      (saldoInicial < 0 ? '1' : '2') + amt14(saldoInicial) + '978' + '1' +
      padA(m.nombre || '', 26) + '   ');

    let nDebe = 0, nHaber = 0, tDebe = 0, tHaber = 0;
    for (const t of list) {
      const debe = t.amount < 0;
      if (debe) { nDebe++; tDebe = r2(tDebe + Math.abs(t.amount)); }
      else { nHaber++; tHaber = r2(tHaber + t.amount); }
      const f = yymmdd(t.date);
      // 22 — movimiento: libre(4)=espacios, oficina origen, fecha operación=fecha valor,
      // concepto común por heurística, concepto propio 000, documento/ref1 a ceros
      lines.push('22' + '    ' + ofi + f + f + conceptoComun(t.concept) + '000' +
        (debe ? '1' : '2') + amt14(t.amount) + '0'.repeat(10) + '0'.repeat(12) + ' '.repeat(16));
      // 23/01 — el texto del concepto viaja en el complementario (76 posiciones útiles)
      const c = ascii(t.concept).replace(/\s+/g, ' ').trim();
      if (c) lines.push('23' + '01' + padA(c.slice(0, 38), 38) + padA(c.slice(38, 76), 38));
    }

    // 33 — final de cuenta: contadores, totales y saldo final derivado (cuadre garantizado)
    lines.push('33' + ent + ofi + cta +
      padN(String(nDebe), 5) + amt14(tDebe) + padN(String(nHaber), 5) + amt14(tHaber) +
      (saldoFinal < 0 ? '1' : '2') + amt14(saldoFinal) + '978' + '    ');
    // 88 — fin de fichero: nº total de registros excluyéndose a sí mismo
    lines.push('88' + '9'.repeat(18) + padN(String(lines.length), 6) + ' '.repeat(54));

    return { content: lines.join('\r\n') + '\r\n', derived, saldoInicial, saldoFinal };
  }

  // ---------- validador Norma 43 (se ejecuta antes de cada descarga) ----------
  function validate43(content) {
    const errors = [];
    const lines = content.split(/\r\n/).filter(l => l.length);
    lines.forEach((l, i) => { if (l.length !== 80) errors.push(`linea ${i + 1}: ${l.length} chars`); });
    if (!lines.length || lines[0].slice(0, 2) !== '11') errors.push('falta registro 11');
    if (lines[lines.length - 1].slice(0, 2) !== '88') errors.push('falta registro 88');
    const h = lines[0], f = lines[lines.length - 1];
    const saldoIni = (h[32] === '1' ? -1 : 1) * parseInt(h.slice(33, 47), 10) / 100;
    let sum = 0, nD = 0, nH = 0, tD = 0, tH = 0;
    let reg33 = null;
    for (const l of lines) {
      const code = l.slice(0, 2);
      if (!['11', '22', '23', '24', '33', '88'].includes(code)) errors.push('registro desconocido ' + code);
      if (code === '22') {
        const v = parseInt(l.slice(28, 42), 10) / 100;
        const debe = l[27] === '1';
        sum = r2(sum + (debe ? -v : v));
        if (debe) { nD++; tD = r2(tD + v); } else { nH++; tH = r2(tH + v); }
      }
      if (code === '33') reg33 = l;
    }
    if (!reg33) errors.push('falta registro 33');
    else {
      if (parseInt(reg33.slice(20, 25), 10) !== nD || parseInt(reg33.slice(39, 44), 10) !== nH)
        errors.push('contadores debe/haber no cuadran');
      if (parseInt(reg33.slice(25, 39), 10) !== Math.round(tD * 100) ||
          parseInt(reg33.slice(44, 58), 10) !== Math.round(tH * 100))
        errors.push('totales debe/haber no cuadran');
      const saldoFin = (reg33[58] === '1' ? -1 : 1) * parseInt(reg33.slice(59, 73), 10) / 100;
      if (Math.abs(r2(saldoIni + sum) - saldoFin) > 0.005) errors.push('cadena de saldos no cuadra');
    }
    if (parseInt(f.slice(20, 26), 10) !== lines.length - 1) errors.push('nº de registros del 88 no cuadra');
    return { ok: !errors.length, errors, records: lines.length };
  }

  // ---------- CSV de diario Debe/Haber (partida doble, importable/mapeable) ----------
  // opts: { cuentaBanco: '572000000', contrapartida: '555000000' }
  // Cargo en banco (importe negativo) → banco al Haber, contrapartida al Debe; y viceversa.
  function diario(txs, opts) {
    const o = opts || {};
    const banco = (o.cuentaBanco || '572000000').replace(/[^\dA-Za-z.]/g, '');
    const contra = (o.contrapartida || '555000000').replace(/[^\dA-Za-z.]/g, '');
    const { list } = prepare(txs);
    if (!list.length) throw new Error('no transactions');
    const eu = n => n.toFixed(2).replace('.', ',');
    const cell = s => {
      s = String(s == null ? '' : s);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = ['Asiento;Fecha;Cuenta;Concepto;Debe;Haber'];
    list.forEach((t, i) => {
      const [y, mo, d] = t.date.split('-');
      const fecha = `${d}/${mo}/${y}`;
      const abs = eu(Math.abs(t.amount));
      const con = cell(t.concept);
      const n = i + 1;
      if (t.amount >= 0) {
        rows.push([n, fecha, banco, con, abs, ''].join(';'));
        rows.push([n, fecha, contra, con, '', abs].join(';'));
      } else {
        rows.push([n, fecha, contra, con, abs, ''].join(';'));
        rows.push([n, fecha, banco, con, '', abs].join(';'));
      }
    });
    return rows.join('\r\n') + '\r\n';
  }

  return { norma43, validate43, diario, accountFromText, conceptoComun, ascii };
})();

/* para tests en Node */
if (typeof module !== 'undefined' && module.exports) module.exports = LS_CONTABLE;
