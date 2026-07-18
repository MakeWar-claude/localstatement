/* Tests del módulo contable (Norma 43 + diario). Ejecutar: node tests/contable.test.js */
'use strict';
const C = require('../js/contable.js');

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { fails++; console.error('  ✗ ' + msg); }
}

// ---------- fixtures ----------
const TXS = [
  { date: '2026-01-05', concept: 'TRANSFERENCIA DE NÓMINA EMPRESA S.L.', amount: 1500.00, balance: 2500.00 },
  { date: '2026-01-07', concept: 'RECIBO LUZ ENDESA', amount: -80.55, balance: 2419.45 },
  { date: '2026-01-07', concept: 'COMPRA TARJETA SUPERMERCADO', amount: -45.10, balance: 2374.35 },
  { date: '2026-01-15', concept: 'DEVOLUCIÓN RECIBO GIMNASIO', amount: 30.00, balance: 2404.35 },
  { date: '2026-01-20', concept: 'BIZUM ENVIADO — CENA AÑOS', amount: -25.00, balance: 2379.35 },
];
// desordenado a propósito: el generador debe ordenar cronológicamente
const SHUFFLED = [TXS[3], TXS[0], TXS[4], TXS[1], TXS[2]];

console.log('norma43:');
const out = C.norma43(SHUFFLED, { entidad: '0049', oficina: '1234', cuenta: '0123456789', nombre: 'Empresa Ñoño S.L.' });
const lines = out.content.split('\r\n').filter(l => l.length);

ok(lines.every(l => l.length === 80), 'todas las lineas tienen 80 caracteres');
ok(lines[0].startsWith('11'), 'empieza con registro 11');
ok(lines[lines.length - 1].startsWith('88'), 'termina con registro 88');
ok(lines.filter(l => l.startsWith('22')).length === 5, '5 registros de movimiento');
ok(lines.filter(l => l.startsWith('23')).length === 5, '5 registros de concepto');
ok(out.saldoInicial === 1000, 'saldo inicial derivado de la cadena de saldos = 1000 (got ' + out.saldoInicial + ')');
ok(out.saldoFinal === 2379.35, 'saldo final = 2379.35 (got ' + out.saldoFinal + ')');
ok(!out.derived, 'saldo inicial NO marcado como inventado');
ok(lines[0].includes('978'), 'divisa EUR 978 en cabecera');
ok(lines[0].slice(20, 26) === '260105' && lines[0].slice(26, 32) === '260120', 'fechas del periodo AAMMDD');
ok(/EMPRESA NONO S\.L\./.test(lines[0]), 'nombre transliterado a ASCII (Ñ->N)');
ok(!/[^\x20-\x7E]/.test(out.content.replace(/\r\n/g, '')), 'fichero 100% ASCII imprimible');

// conceptos comunes del anexo 2
const movs = lines.filter(l => l.startsWith('22'));
ok(movs[0].slice(22, 24) === '15', 'nomina -> concepto 15 (got ' + movs[0].slice(22, 24) + ')');
ok(movs[1].slice(22, 24) === '03', 'recibo -> concepto 03');
ok(movs[2].slice(22, 24) === '12', 'tarjeta -> concepto 12');
ok(movs[3].slice(22, 24) === '14', 'devolucion recibo -> 14 (no 03)');
ok(movs[4].slice(22, 24) === '04', 'bizum -> transferencias 04');

// importes y claves D/H
ok(movs[0].slice(27, 28) === '2' && movs[0].slice(28, 42) === '00000000150000', 'abono 1500.00 clave 2');
ok(movs[1].slice(27, 28) === '1' && movs[1].slice(28, 42) === '00000000008055', 'cargo 80.55 clave 1');

console.log('validador:');
const v = C.validate43(out.content);
ok(v.ok, 'fichero generado pasa el validador (' + v.errors.join('; ') + ')');
ok(v.records === lines.length, 'contador de registros');

// mutaciones que DEBEN fallar
const bad1 = out.content.replace('00000000150000', '00000000150001');
ok(!C.validate43(bad1).ok, 'importe alterado -> validador lo detecta');
const bad2 = out.content.replace(/^88/m, '89');
ok(!C.validate43(bad2).ok, 'registro final alterado -> validador lo detecta');

console.log('sin saldos impresos:');
const noBal = TXS.map(t => ({ ...t, balance: null }));
const out2 = C.norma43(noBal, {});
ok(out2.derived, 'marca saldo inicial como derivado/0');
ok(C.validate43(out2.content).ok, 'fichero sin saldos tambien valida');
ok(out2.saldoFinal === 1379.35, 'saldo final = suma de movimientos (got ' + out2.saldoFinal + ')');

console.log('cuenta desde texto:');
const a1 = C.accountFromText('IBAN: ES91 2100 0418 4502 0005 1332 · Titular');
ok(a1 && a1.entidad === '2100' && a1.oficina === '0418' && a1.cuenta === '0200051332',
  'IBAN ES con espacios -> entidad/oficina/cuenta');
const a2 = C.accountFromText('Cuenta 0049-1234-56-0123456789');
ok(a2 && a2.entidad === '0049' && a2.cuenta === '0123456789', 'CCC con guiones');
ok(C.accountFromText('sin cuenta aqui') === null, 'texto sin cuenta -> null');

console.log('diario:');
const d = C.diario(SHUFFLED, { cuentaBanco: '572000001', contrapartida: '555000000' });
const rows = d.split('\r\n').filter(l => l.length);
ok(rows[0] === 'Asiento;Fecha;Cuenta;Concepto;Debe;Haber', 'cabecera');
ok(rows.length === 1 + 10, 'partida doble: 2 filas por movimiento');
// cuadre global: suma Debe == suma Haber
let debe = 0, haber = 0;
for (const r of rows.slice(1)) {
  const c = r.split(';');
  if (c[4]) debe += parseFloat(c[4].replace(',', '.'));
  if (c[5]) haber += parseFloat(c[5].replace(',', '.'));
}
ok(Math.abs(debe - haber) < 0.005, `diario cuadra: Debe ${debe.toFixed(2)} = Haber ${haber.toFixed(2)}`);
ok(rows[1].startsWith('1;05/01/2026;572000001;'), 'ingreso: banco al Debe, fecha dd/mm/aaaa, orden cronologico');
ok(d.includes('"TRANSFERENCIA DE NÓMINA EMPRESA S.L."'), 'conceptos entrecomillados');

// inyección de fórmulas neutralizada
const evil = [{ date: '2026-02-01', concept: '=CMD()', amount: -1, balance: null }];
ok(C.diario(evil, {}).includes("\"'=CMD()\""), 'concepto =... neutralizado en diario');

console.log('bordes:');
try { C.norma43([], {}); ok(false, 'lista vacia debe lanzar'); }
catch (e) { ok(true, 'lista vacia lanza error'); }
const neg = C.norma43([{ date: '2026-03-01', concept: 'X', amount: -50, balance: -20 }], {});
ok(neg.content.split('\r\n')[0][32] === '2' && neg.saldoInicial === 30, 'saldo inicial positivo antes de cargo que deja saldo negativo');
const vneg = C.validate43(neg.content);
ok(vneg.ok, 'saldo final negativo (clave 1) valida');

console.log(fails ? `\n${fails} TESTS FALLANDO` : '\nTODOS LOS TESTS OK');
process.exit(fails ? 1 : 0);
