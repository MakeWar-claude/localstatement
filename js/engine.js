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
  // regex tolerantes a fallos de OCR: espacios sueltos dentro del número
  const NUM = {
    eu: { re: /-?\d{1,3}(?:[.\s]\d{3})*,\s?\d{2}(?!\d)|-?\d+,\s?\d{2}(?!\d)/g,
          parse: s => parseFloat(s.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')) },
    en: { re: /-?\d{1,3}(?:[,\s]\d{3})*\.\s?\d{2}(?!\d)|-?\d+\.\s?\d{2}(?!\d)/g,
          parse: s => parseFloat(s.replace(/\s+/g, '').replace(/,/g, '')) },
  };
  const RE_FECHA_EU = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  const RE_RUIDO = /^(saldo|balance|total|fecha|date|p[áa]gina|page|extracto|statement|kontostand|kontoauszug|solde|saldo iniziale|saldo finale|alter kontostand|neuer kontostand|übertrag|uebertrag|summe|beginning balance|ending balance|opening balance|closing balance)\b/i;
  const RE_IBANISH = /(?:\d{4}[\s.]){3,}/;   // cabeceras con nº de cuenta/IBAN no son movimientos

  // limpieza de artefactos típicos de OCR dentro de cifras: "1, ,50"→"1,50", "3O4"→"304"
  function cleanText(t) {
    return t
      .replace(/(\d)\s*,\s*,\s*(\d)/g, '$1,$2')
      .replace(/(\d)[Oo](\d)/g, '$10$2')
      .replace(/(\d)[l|](\d)/g, '$11$2');
  }

  // ---------- modelo de columnas: signo por posición x (Ingreso/Cargo/Saldo) ----------
  const HDR_CREDIT = /^(ingresos?|abonos?|haber|avere|accrediti?|gutschrift(en)?|cr[eé]dit)/i;
  const HDR_DEBIT = /^(cargos?|debe|adeudos?|dare|addebiti?|lastschrift(en)?|d[eé]bit|pagos?)/i;
  const HDR_AMOUNT = /^(importes?|betrag|importo|amount|montant)/i;
  const HDR_BALANCE = /^(saldos?|balance|kontostand|solde)/i;

  function detectColumns(pages) {
    for (const pg of pages.slice(0, 3)) {
      for (const line of pg.lines) {
        const bands = {};
        for (const c of line.cells) {
          const s = c.s.trim();
          if (HDR_BALANCE.test(s)) bands.balance = c.x;
          else if (HDR_CREDIT.test(s)) bands.credit = c.x;
          else if (HDR_DEBIT.test(s)) bands.debit = c.x;
          else if (HDR_AMOUNT.test(s)) bands.amount = c.x;
        }
        // solo sirve si distingue el saldo de al menos otra columna numérica
        if (bands.balance !== undefined && Object.keys(bands).length >= 2 &&
            (bands.credit !== undefined || bands.debit !== undefined || bands.amount !== undefined)) {
          return bands;
        }
      }
    }
    return null;
  }

  function columnParse(line, cols, num) {
    const text = cleanText(line.text);
    const f = text.match(RE_FECHA_EU);
    if (!f) return null;
    // celdas numéricas puras con su posición x
    const nums = [];
    for (const c of line.cells) {
      const cs = cleanText(c.s).trim();
      const m = cs.match(num.re);
      if (m && m.length === 1 && m[0].replace(/\s/g, '').length >= cs.replace(/\s/g, '').length - 1) {
        nums.push({ x: c.x, v: num.parse(m[0]) });
      }
    }
    if (!nums.length) return null;
    const bands = Object.entries(cols);
    let amount = null, balance = null;
    for (const nb of nums) {
      let best = null, bd = Infinity;
      for (const [k, x] of bands) {
        const d = Math.abs(nb.x - x);
        if (d < bd) { bd = d; best = k; }
      }
      if (best === 'balance') balance = nb.v;
      else if (best === 'credit') amount = Math.abs(nb.v);
      else if (best === 'debit') amount = -Math.abs(nb.v);
      else if (best === 'amount') amount = nb.v;
    }
    if (amount === null && balance === null) return null;
    let concept = text.replace(f[0], '');
    const f2 = concept.match(RE_FECHA_EU);
    if (f2) concept = concept.replace(f2[0], '');
    concept = concept.replace(num.re, '').replace(/\s+/g, ' ').replace(/\bEUR\b/g, '').trim();
    if (RE_RUIDO.test(concept) || RE_IBANISH.test(concept)) return null;
    return { date: normDate(f[0]), concept, amount, balance, rawAmount: '', rawBalance: '' };
  }

  // ---------- autocuadre: la cadena de saldos impresa corrige importes y signos ----------
  function chainFix(txs) {
    const wb = txs.map((t, idx) => ({ t, idx })).filter(e => e.t.balance !== null);
    if (wb.length < 2) return 0;
    let dir = 0;                                  // orden cronológico del documento
    for (let i = 1; i < wb.length; i++) {
      if (wb[i].t.date > wb[i - 1].t.date) dir++;
      else if (wb[i].t.date < wb[i - 1].t.date) dir--;
    }
    const seq = dir >= 0 ? wb : [...wb].reverse();
    let fixed = 0;
    for (let i = 1; i < seq.length; i++) {
      // solo entre filas consecutivas del extracto: si hay un movimiento sin
      // saldo entre medias, la diferencia mezclaría dos importes
      if (Math.abs(seq[i].idx - seq[i - 1].idx) !== 1) continue;
      const prev = seq[i - 1].t;                  // seq ya está en orden cronológico
      const cur = seq[i].t;
      const diff = Math.round((cur.balance - prev.balance) * 100) / 100;
      if (!diff) continue;
      const a = cur.amount;
      if (a === null || Math.abs(Math.abs(a) - Math.abs(diff)) > 0.005 || Math.sign(a) !== Math.sign(diff)) {
        cur.amount = diff;
        fixed++;
      }
    }
    return fixed;
  }

  // ---------- heurística genérica (validada: Santander app 19/19 coherencia) ----------
  function genericParse(line, num) {
    const text = cleanText(line.text);
    const f = text.match(RE_FECHA_EU);
    if (!f) return null;
    const amounts = [...text.matchAll(num.re)].map(m => m[0]);
    if (!amounts.length) return null;
    const amount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    const balance = amounts.length >= 2 ? amounts[amounts.length - 1] : '';
    let concept = text.replace(f[0], '');
    const f2 = concept.match(RE_FECHA_EU);           // fecha valor fuera del concepto
    if (f2) concept = concept.replace(f2[0], '');
    for (const a of amounts) concept = concept.replace(a, '');
    concept = concept.replace(/\s+/g, ' ').replace(/\bEUR\b/g, '').trim();
    if (RE_RUIDO.test(concept) || RE_IBANISH.test(concept)) return null;
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
    { id: 'bnp', name: 'BNP Paribas', detect: t => /bnp\s*paribas/i.test(t), num: 'eu' },
    { id: 'ca', name: 'Crédit Agricole', detect: t => /cr[eé]dit\s*agricole/i.test(t), num: 'eu' },
    { id: 'sg', name: 'Société Générale', detect: t => /soci[eé]t[eé]\s*g[eé]n[eé]rale/i.test(t), num: 'eu' },
    { id: 'lcl', name: 'LCL', detect: t => /\bLCL\b/.test(t), num: 'eu' },
    { id: 'cm', name: 'Crédit Mutuel', detect: t => /cr[eé]dit\s*mutuel/i.test(t), num: 'eu' },
    { id: 'lbp', name: 'La Banque Postale', detect: t => /banque\s*postale/i.test(t), num: 'eu' },
    { id: 'bourso', name: 'BoursoBank', detect: t => /bourso(bank|rama)/i.test(t), num: 'eu' },
    { id: 'fortuneo', name: 'Fortuneo', detect: t => /fortuneo/i.test(t), num: 'eu' },
    { id: 'cic', name: 'CIC', detect: t => /\bCIC\b/.test(t), num: 'eu' },
    { id: 'bcp', name: 'Millennium bcp', detect: t => /millennium|\bbcp\b/i.test(t), num: 'eu' },
    { id: 'cgd', name: 'Caixa Geral de Depósitos', detect: t => /caixa\s*geral/i.test(t), num: 'eu' },
    { id: 'novobanco', name: 'Novo Banco', detect: t => /novo\s*banco/i.test(t), num: 'eu' },
    { id: 'bpi', name: 'Banco BPI', detect: t => /\bBPI\b/.test(t), num: 'eu' },
    { id: 'abnamro', name: 'ABN AMRO', detect: t => /abn\s*amro/i.test(t), num: 'eu' },
    { id: 'rabobank', name: 'Rabobank', detect: t => /rabobank/i.test(t), num: 'eu' },
    { id: 'bunq', name: 'bunq', detect: t => /\bbunq\b/i.test(t), num: 'eu' },
    { id: 'evo', name: 'EVO Banco', detect: t => /evo\s*banco/i.test(t), num: 'eu' },
    { id: 'imagin', name: 'imagin', detect: t => /\bimagin\b/i.test(t), num: 'eu' },
    { id: 'laboral', name: 'Laboral Kutxa', detect: t => /laboral\s*kutxa/i.test(t), num: 'eu' },
    { id: 'cajarural', name: 'Caja Rural', detect: t => /caja\s*rural|ruralv[ií]a/i.test(t), num: 'eu' },
    { id: 'march', name: 'Banca March', detect: t => /banca\s*march/i.test(t), num: 'eu' },
    { id: 'mps', name: 'Monte dei Paschi', detect: t => /monte\s*dei\s*paschi|\bMPS\b/.test(t), num: 'eu' },
    { id: 'bnl', name: 'BNL', detect: t => /\bBNL\b/.test(t), num: 'eu' },
    { id: 'bancoposta', name: 'BancoPosta', detect: t => /bancoposta|poste\s*italiane/i.test(t), num: 'eu' },
    { id: 'credem', name: 'Credem', detect: t => /credem/i.test(t), num: 'eu' },
    { id: 'postbank', name: 'Postbank', detect: t => /postbank/i.test(t), num: 'eu' },
    { id: 'targobank', name: 'Targobank', detect: t => /targobank/i.test(t), num: 'eu' },
    { id: 'consorsbank', name: 'Consorsbank', detect: t => /consorsbank/i.test(t), num: 'eu' },
    { id: 'hvb', name: 'HypoVereinsbank', detect: t => /hypovereinsbank|unicredit\s*bank\s*(gmbh|ag)/i.test(t), num: 'eu' },
    { id: 'erste', name: 'Erste Bank', detect: t => /erste\s*bank|sparkasse\s*[öo]sterreich/i.test(t), num: 'eu' },
    { id: 'raiffeisen', name: 'Raiffeisen', detect: t => /raiffeisen/i.test(t), num: 'eu' },
    { id: 'ubs', name: 'UBS', detect: t => /\bUBS\b/.test(t), num: 'eu' },
    { id: 'postfinance', name: 'PostFinance', detect: t => /postfinance/i.test(t), num: 'eu' },
    { id: 'monzo', name: 'Monzo', detect: t => /monzo/i.test(t), num: 'en' },
    { id: 'starling', name: 'Starling Bank', detect: t => /starling/i.test(t), num: 'en' },
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
    const cols = detectColumns(pages);

    const txs = [];
    for (const pg of pages) {
      for (const line of pg.lines) {
        const t = (cols && columnParse(line, cols, num)) || genericParse(line, num);
        if (t) { t.page = pg.num; txs.push(t); }
      }
    }

    // autocuadre solo si la extracción directa no cuadra ya
    let fixed = 0;
    let coh = coherence(txs);
    if (coh.checked > 0 && coh.ok < coh.checked) {
      fixed = chainFix(txs);
      if (fixed) coh = coherence(txs);
    }

    return {
      pages: pages.length,
      textPages,
      scanned: textPages === 0,
      bank: profile.name,
      method: cols ? 'columns' : 'generic',
      fixed,
      transactions: txs,
      coherence: coh,
    };
  }

  async function convert(arrayBuffer) {
    return parsePages(await extractPages(arrayBuffer));
  }

  return { convert, parsePages };
})();
