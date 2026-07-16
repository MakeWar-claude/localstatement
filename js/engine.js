/* LocalStatement — motor de parseo 100% client-side.
   Nada de este fichero hace peticiones de red: entrada ArrayBuffer, salida objetos. */
'use strict';

const LS_ENGINE = (() => {

  // ---------- extracción de líneas (agrupar items de pdf.js por coordenada Y) ----------
  async function extractPages(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const rows = new Map();
      for (const it of tc.items) {
        if (!it.str.trim()) continue;
        const y = Math.round(it.transform[5] / 2) * 2;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x: it.transform[4], s: it.str });
      }
      const lines = [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([y, items]) => {
          const cells = items.sort((a, b) => a.x - b.x);
          return { y, cells, text: cells.map(i => i.s).join(' ') };
        });
      pages.push({ num: p, lines });
    }
    return pages;
  }

  // ---------- utilidades numéricas por convención ----------
  const NUM = {
    eu: { re: /-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)|-?\d+,\d{2}(?!\d)/g,
          parse: s => parseFloat(s.replace(/\./g, '').replace(',', '.')) },
    en: { re: /-?\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)|-?\d+\.\d{2}(?!\d)/g,
          parse: s => parseFloat(s.replace(/,/g, '')) },
  };
  const RE_FECHA_EU = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  const RE_RUIDO = /^(saldo|balance|total|fecha|date|p[áa]gina|page|extracto|statement)\b/i;

  // ---------- heurística genérica (validada: Santander app 19/19 coherencia) ----------
  function genericParse(line, num) {
    const f = line.text.match(RE_FECHA_EU);
    if (!f) return null;
    const amounts = [...line.text.matchAll(num.re)].map(m => m[0]);
    if (!amounts.length) return null;
    const amount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    const balance = amounts.length >= 2 ? amounts[amounts.length - 1] : '';
    let concept = line.text.replace(f[0], '');
    const f2 = concept.match(RE_FECHA_EU);           // fecha valor fuera del concepto
    if (f2) concept = concept.replace(f2[0], '');
    for (const a of amounts) concept = concept.replace(a, '');
    concept = concept.replace(/\s+/g, ' ').replace(/\bEUR\b/g, '').trim();
    if (RE_RUIDO.test(concept)) return null;
    return {
      date: normDate(f[0]),
      concept,
      amount: num.parse(amount),
      balance: balance ? num.parse(balance) : null,
      rawAmount: amount, rawBalance: balance,
    };
  }

  function normDate(s) {
    const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return s;
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? '20' + y : y;
    return `${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;   // ISO, día-primero (convención UE)
  }

  // ---------- perfiles por banco ----------
  // detect(): recibe el texto de la primera página; parse por defecto = genérico.
  const PROFILES = [
    { id: 'santander', name: 'Santander',
      detect: t => /santander/i.test(t) || /transacci[óo]n contactless/i.test(t), num: 'eu' },
    { id: 'caixabank', name: 'CaixaBank',
      detect: t => /caixabank/i.test(t), num: 'eu' },
    { id: 'bbva', name: 'BBVA', detect: t => /bbva/i.test(t), num: 'eu' },
    { id: 'sabadell', name: 'Banco Sabadell', detect: t => /sabadell/i.test(t), num: 'eu' },
    { id: 'bankinter', name: 'Bankinter', detect: t => /bankinter/i.test(t), num: 'eu' },
    { id: 'ing', name: 'ING', detect: t => /\bing\b|cuenta naranja/i.test(t), num: 'eu' },
    { id: 'intesa', name: 'Intesa Sanpaolo', detect: t => /intesa\s*sanpaolo/i.test(t), num: 'eu' },
    { id: 'unicredit', name: 'UniCredit', detect: t => /unicredit/i.test(t), num: 'eu' },
    { id: 'n26', name: 'N26', detect: t => /\bn26\b/i.test(t), num: 'eu' },
    { id: 'revolut', name: 'Revolut', detect: t => /revolut/i.test(t), num: 'en' },
    { id: 'sparkasse', name: 'Sparkasse', detect: t => /sparkasse/i.test(t), num: 'eu' },
    { id: 'volksbank', name: 'Volksbank', detect: t => /volksbank/i.test(t), num: 'eu' },
    { id: 'openbank', name: 'Openbank', detect: t => /openbank/i.test(t), num: 'eu' },
    { id: 'kutxabank', name: 'Kutxabank', detect: t => /kutxabank/i.test(t), num: 'eu' },
    { id: 'unicaja', name: 'Unicaja', detect: t => /unicaja/i.test(t), num: 'eu' },
    { id: 'ibercaja', name: 'Ibercaja', detect: t => /ibercaja/i.test(t), num: 'eu' },
    { id: 'abanca', name: 'ABANCA', detect: t => /abanca/i.test(t), num: 'eu' },
    { id: 'cajamar', name: 'Cajamar', detect: t => /cajamar/i.test(t), num: 'eu' },
    { id: 'bancobpm', name: 'Banco BPM', detect: t => /banco\s*bpm/i.test(t), num: 'eu' },
    { id: 'bper', name: 'BPER Banca', detect: t => /\bbper\b/i.test(t), num: 'eu' },
    { id: 'fineco', name: 'FinecoBank', detect: t => /fineco/i.test(t), num: 'eu' },
    { id: 'mediolanum', name: 'Banca Mediolanum', detect: t => /mediolanum/i.test(t), num: 'eu' },
    { id: 'dkb', name: 'DKB', detect: t => /\bdkb\b|deutsche kreditbank/i.test(t), num: 'eu' },
    { id: 'commerzbank', name: 'Commerzbank', detect: t => /commerzbank/i.test(t), num: 'eu' },
    { id: 'comdirect', name: 'comdirect', detect: t => /comdirect/i.test(t), num: 'eu' },
    { id: 'wise', name: 'Wise', detect: t => /\bwise\b|transferwise/i.test(t), num: 'en' },
    { id: 'generic', name: null, detect: () => true, num: 'eu' },
  ];

  // ---------- chequeo de coherencia contable: saldo(i±1) ± importe = saldo ----------
  function coherence(txs) {
    const withBal = txs.filter(t => t.balance !== null);
    if (withBal.length < 2) return { checked: 0, ok: 0 };
    let ok = 0, checked = 0;
    // probar ambos órdenes cronológicos y quedarse con el mejor
    for (const dir of [1, -1]) {
      let o = 0, c = 0;
      for (let i = 0; i < withBal.length - 1; i++) {
        const [a, b] = dir === 1 ? [withBal[i], withBal[i + 1]] : [withBal[i + 1], withBal[i]];
        c++;
        if (Math.abs(a.balance + b.amount - b.balance) < 0.005) o++;
      }
      if (o > ok) { ok = o; checked = c; }
      if (!checked) checked = c;
    }
    return { checked, ok };
  }

  // ---------- API pública ----------
  function parsePages(pages) {
    const textPages = pages.filter(p => p.lines.length > 3).length;
    const firstText = pages.map(p => p.lines.map(l => l.text).join('\n')).join('\n').slice(0, 4000);
    const profile = PROFILES.find(p => p.detect(firstText));
    const num = NUM[profile.num] || NUM.eu;

    const txs = [];
    for (const pg of pages) {
      for (const line of pg.lines) {
        const t = genericParse(line, num);
        if (t) { t.page = pg.num; txs.push(t); }
      }
    }
    return {
      pages: pages.length,
      textPages,
      scanned: textPages === 0,
      bank: profile.name,
      transactions: txs,
      coherence: coherence(txs),
    };
  }

  async function convert(arrayBuffer) {
    return parsePages(await extractPages(arrayBuffer));
  }

  return { convert, parsePages };
})();
