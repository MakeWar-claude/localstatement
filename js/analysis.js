/* LocalStatement — análisis premium: categorización + informe con gráficas.
   Todo local: reglas de categorización por palabras clave (sin IA, sin red)
   y gráficas SVG dibujadas a mano (cero librerías). El informe lleva la marca
   localstatement.com para que, compartido, haga de publicidad. */
'use strict';

const LS_ANALYSIS = (() => {

  // ---------- categorización por reglas (multiidioma) ----------
  const RULES = [
    ['salary', /n[oó]mina|payroll|salari|gehalt|stipendio|salaire|\bloon\b|pension/i],
    ['bizum', /bizum|env[ií]o a m[oó]vil|envio a movil|cobro envio movil/i],
    ['cash', /cajero|reint|:?\batm\b|efectivo|bargeld|contant|withdrawal|retirada|geldautomat/i],
    ['supermarket', /mercadona|lidl|aldi|carrefour|\bspar\b|hiperdino|eroski|\bdia\b|alcampo|supermerc|supermarkt|supermarch|edeka|rewe|albert heijn|\bjumbo\b|esselunga|conad|\bcoop\b|continente|pingo doce/i],
    ['dining', /restaur|\bbar\b|caf[eé]|mcdonald|burger|\bkfc\b|pizz|tapas|kebab|sushi|ristorante|bistro|panader|bäcker|boulanger/i],
    ['transport', /gasolin|repsol|cepsa|shell|\bbp\b|uber|cabify|\bbolt\b|taxi|renfe|metro|guagua|autobus|parking|peaje|tanken|sncf|trenitalia|\bns\b|ov-chipkaart/i],
    ['subscriptions', /netflix|spotify|\bhbo\b|disney|prime video|apple\.com|icloud|google \w|youtube|microsoft|adobe|openai|chatgpt/i],
    ['utilities', /endesa|iberdrola|naturgy|\bedp\b|vodafone|movistar|orange|\bo2\b|\bdigi\b|masmovil|telef[oó]n|\bagua\b|\bluz\b|\bgas\b|strom|\benel\b|engie|eneco|lowi/i],
    ['health', /farmacia|pharma|cl[ií]nic|m[eé]dic|hospital|dentista|apotheke|apotheek|fisio|[oó]ptica/i],
    ['leisure', /hotel|booking|airbnb|vueling|ryanair|iberia|easyjet|\bcine\b|teatro|\bgym\b|gimnasio|yoga|decathlon|viaje|padel|club/i],
    ['taxes', /agencia tributaria|\baeat\b|seguridad social|impuesto|hacienda|finanzamt|belasting|\btasse\b|ayuntamiento|\bayto\b|\bibi\b/i],
    ['shopping', /amazon|aliexpress|zara|corte ingl[eé]s|ikea|mediamarkt|fnac|shein|etsy|ebay|primark|tickets?\b/i],
    ['fees', /comisi[oó]n|cuota t|mantenimiento|inter[eé]s|geb[uü]hr|commissione|\bfee\b|custodia/i],
    ['transfer', /transf|[uü]berweisung|bonifico|virement|overboeking|traspaso|\bwire\b|\bcro\b/i],
  ];

  const CAT_NAMES = {
    es: { salary: 'Nómina y pensiones', supermarket: 'Supermercado', dining: 'Restauración', transport: 'Transporte', subscriptions: 'Suscripciones', utilities: 'Suministros y telecos', bizum: 'Bizum', transfer: 'Transferencias', cash: 'Efectivo', fees: 'Comisiones', health: 'Salud', leisure: 'Ocio y viajes', taxes: 'Impuestos', shopping: 'Compras', other: 'Otros', income: 'Otros ingresos' },
    en: { salary: 'Salary & pensions', supermarket: 'Groceries', dining: 'Dining out', transport: 'Transport', subscriptions: 'Subscriptions', utilities: 'Utilities & telecom', bizum: 'Instant payments', transfer: 'Transfers', cash: 'Cash', fees: 'Bank fees', health: 'Health', leisure: 'Leisure & travel', taxes: 'Taxes', shopping: 'Shopping', other: 'Other', income: 'Other income' },
    it: { salary: 'Stipendio e pensioni', supermarket: 'Supermercato', dining: 'Ristorazione', transport: 'Trasporti', subscriptions: 'Abbonamenti', utilities: 'Utenze e telefonia', bizum: 'Pagamenti istantanei', transfer: 'Bonifici', cash: 'Contanti', fees: 'Commissioni', health: 'Salute', leisure: 'Tempo libero e viaggi', taxes: 'Tasse', shopping: 'Acquisti', other: 'Altro', income: 'Altre entrate' },
    de: { salary: 'Gehalt & Rente', supermarket: 'Lebensmittel', dining: 'Gastronomie', transport: 'Verkehr', subscriptions: 'Abos', utilities: 'Versorger & Telekom', bizum: 'Sofortzahlungen', transfer: 'Überweisungen', cash: 'Bargeld', fees: 'Gebühren', health: 'Gesundheit', leisure: 'Freizeit & Reisen', taxes: 'Steuern', shopping: 'Einkäufe', other: 'Sonstiges', income: 'Sonstige Einnahmen' },
    fr: { salary: 'Salaire et pensions', supermarket: 'Courses', dining: 'Restauration', transport: 'Transport', subscriptions: 'Abonnements', utilities: 'Énergie et télécoms', bizum: 'Paiements instantanés', transfer: 'Virements', cash: 'Espèces', fees: 'Frais bancaires', health: 'Santé', leisure: 'Loisirs et voyages', taxes: 'Impôts', shopping: 'Achats', other: 'Autres', income: 'Autres revenus' },
    pt: { salary: 'Salário e pensões', supermarket: 'Supermercado', dining: 'Restauração', transport: 'Transportes', subscriptions: 'Subscrições', utilities: 'Serviços e telecom', bizum: 'Pagamentos instantâneos', transfer: 'Transferências', cash: 'Dinheiro', fees: 'Comissões', health: 'Saúde', leisure: 'Lazer e viagens', taxes: 'Impostos', shopping: 'Compras', other: 'Outros', income: 'Outras receitas' },
    nl: { salary: 'Salaris & pensioen', supermarket: 'Boodschappen', dining: 'Uit eten', transport: 'Vervoer', subscriptions: 'Abonnementen', utilities: 'Nutsvoorzieningen', bizum: 'Directe betalingen', transfer: 'Overboekingen', cash: 'Contant', fees: 'Bankkosten', health: 'Gezondheid', leisure: 'Vrije tijd & reizen', taxes: 'Belastingen', shopping: 'Aankopen', other: 'Overig', income: 'Overige inkomsten' },
  };

  // ---------- reglas del usuario y categorías propias (localStorage) ----------
  const norm = s => s.toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const getRules = () => { try { return JSON.parse(localStorage.getItem('ls_cat_rules') || '[]'); } catch (e) { return []; } };
  const getCustom = () => { try { return JSON.parse(localStorage.getItem('ls_custom_cats') || '[]'); } catch (e) { return []; } };

  function saveRule(concept, catKey) {
    const token = norm(concept);
    if (!token) return;
    const rules = getRules().filter(r => r.token !== token);
    rules.push({ token, cat: catKey });
    localStorage.setItem('ls_cat_rules', JSON.stringify(rules.slice(-500)));
  }

  function addCustomCat(name) {
    const cats = getCustom();
    if (!cats.includes(name)) { cats.push(name); localStorage.setItem('ls_custom_cats', JSON.stringify(cats)); }
    return 'custom:' + name;
  }

  function categorize(tx) {
    const n = norm(tx.concept);
    for (const r of getRules()) {
      if (n && (n.startsWith(r.token) || r.token.startsWith(n))) return r.cat;
    }
    for (const [key, re] of RULES) if (re.test(tx.concept)) return key;
    return tx.amount > 0 ? 'income' : 'other';
  }

  const catName = (key, names) => key.startsWith('custom:') ? key.slice(7) : (names[key] || key);

  // colores validados (validate_palette.js, ambos temas): ingreso/gasto
  const COLORS = {
    light: { income: '#1D7A55', expense: '#4A5FA5' },
    dark: { income: '#37A473', expense: '#7C90D6' },
  };
  const theme = () => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  // ---------- agregación ----------
  function aggregate(txs, lang) {
    const names = CAT_NAMES[lang] || CAT_NAMES.en;
    const cats = new Map(), months = new Map();
    let income = 0, expense = 0;
    for (const t of txs) {
      if (t.amount === null) continue;
      const key = t.catKey || categorize(t);
      t.category = catName(key, names);
      t.catKey = key;
      if (t.amount > 0) income += t.amount; else expense += -t.amount;
      if (t.amount < 0) cats.set(key, (cats.get(key) || 0) + -t.amount);
      const m = t.date.slice(0, 7);
      if (!months.has(m)) months.set(m, { income: 0, expense: 0 });
      const mm = months.get(m);
      if (t.amount > 0) mm.income += t.amount; else mm.expense += -t.amount;
    }
    const topCats = [...cats.entries()].sort((a, b) => b[1] - a[1]);
    const byMonth = [...months.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    return { income, expense, net: income - expense, topCats, byMonth, names };
  }

  // ---------- tooltip compartido ----------
  function tooltip(host) {
    const tip = document.createElement('div');
    tip.className = 'ana-tip';
    tip.hidden = true;
    host.appendChild(tip);
    return {
      show(x, y, html) {
        tip.innerHTML = html;
        tip.hidden = false;
        const r = host.getBoundingClientRect();
        tip.style.left = Math.min(x - r.left + 12, r.width - 180) + 'px';
        tip.style.top = (y - r.top - 34) + 'px';
      },
      hide() { tip.hidden = true; },
    };
  }

  // ---------- gráficas SVG ----------
  function barsByCategory(cats, names, total, tip) {
    const top = cats.slice(0, 8);
    const rest = cats.slice(8).reduce((a, c) => a + c[1], 0);
    if (rest > 0) top.push(['other+', rest]);
    const max = Math.max(...top.map(c => c[1]));
    const rowH = 30, w = 560, labelW = 170, valueW = 80;
    const h = top.length * rowH + 6;
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" style="width:100%;height:auto">`;
    top.forEach(([key, v], i) => {
      const y = i * rowH + 4;
      const bw = Math.max(3, (w - labelW - valueW) * v / max);
      const name = key === 'other+' ? (names.other + ' +') : catName(key, names);
      s += `<text x="${labelW - 8}" y="${y + 15}" text-anchor="end" class="ana-lbl">${esc(name)}</text>` +
           `<rect class="ana-bar" data-v="${v}" data-n="${esc(name)}" x="${labelW}" y="${y}" width="${bw}" height="18" rx="4"></rect>` +
           `<text x="${labelW + bw + 8}" y="${y + 14}" class="ana-val">${fmt(v)}</text>`;
    });
    s += '</svg>';
    return s;
  }

  function barsByMonth(byMonth, tIncome, tExpense) {
    const w = 560, h = 190, pad = 34, bottom = 26;
    const max = Math.max(...byMonth.flatMap(m => [m[1].income, m[1].expense]), 1);
    const slot = (w - pad) / byMonth.length;
    const bw = Math.min(22, slot / 3);
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" style="width:100%;height:auto">`;
    // rejilla recesiva
    for (let g = 1; g <= 3; g++) {
      const gy = (h - bottom) * (1 - g / 3) + 6;
      s += `<line x1="${pad}" y1="${gy}" x2="${w}" y2="${gy}" class="ana-grid"></line>`;
    }
    byMonth.forEach(([m, v], i) => {
      const cx = pad + slot * i + slot / 2;
      const hi = (h - bottom - 6) * v.income / max, he = (h - bottom - 6) * v.expense / max;
      s += `<rect class="ana-in" data-m="${m}" data-v="${v.income}" x="${cx - bw - 1}" y="${h - bottom - hi}" width="${bw}" height="${Math.max(2, hi)}" rx="3"></rect>` +
           `<rect class="ana-ex" data-m="${m}" data-v="${v.expense}" x="${cx + 1}" y="${h - bottom - he}" width="${bw}" height="${Math.max(2, he)}" rx="3"></rect>` +
           `<text x="${cx}" y="${h - 8}" text-anchor="middle" class="ana-lbl">${m.slice(2).replace('-', '/')}</text>`;
    });
    s += `</svg><div class="ana-legend"><span><i class="sw in"></i>${esc(tIncome)}</span><span><i class="sw ex"></i>${esc(tExpense)}</span></div>`;
    return s;
  }

  function balanceLine(txs) {
    const pts = txs.filter(t => t.balance !== null).map(t => ({ d: t.date, v: t.balance }));
    if (pts.length < 3) return '';
    if (pts[0].d > pts[pts.length - 1].d) pts.reverse();
    const w = 560, h = 150, pad = 6, bottom = 20;
    const vs = pts.map(p => p.v);
    const min = Math.min(...vs), max = Math.max(...vs), span = (max - min) || 1;
    const x = i => pad + (w - 2 * pad) * i / (pts.length - 1);
    const y = v => 8 + (h - bottom - 12) * (1 - (v - min) / span);
    let d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${w} ${h}" role="img" style="width:100%;height:auto">` +
      `<path d="${d}" class="ana-line" fill="none"></path>` +
      `<circle cx="${x(pts.length - 1)}" cy="${y(last.v)}" r="4" class="ana-dot"></circle>` +
      `<text x="${Math.min(x(pts.length - 1), w - 70)}" y="${Math.max(14, y(last.v) - 10)}" class="ana-val">${fmt(last.v)}</text>` +
      `<text x="${pad}" y="${h - 4}" class="ana-lbl">${pts[0].d}</text>` +
      `<text x="${w - pad}" y="${h - 4}" text-anchor="end" class="ana-lbl">${last.d}</text></svg>`;
  }

  // ---------- informe ----------
  function render(container, result, lang, T, editorOpen) {
    const agg = aggregate(result.transactions, lang);
    const stdKeys = [...Object.keys(CAT_NAMES.en)];
    const allCats = [...stdKeys.map(k => [k, catName(k, agg.names)]),
                     ...getCustom().map(n => ['custom:' + n, n])];
    const editorRows = result.transactions.map((t, i) => {
      const opts = allCats.map(([k, n]) =>
        `<option value="${esc(k)}"${k === t.catKey ? ' selected' : ''}>${esc(n)}</option>`).join('') +
        `<option value="__new__">➕ …</option>`;
      return `<tr><td>${t.date}</td><td class="ana-ed-c">${esc(t.concept.slice(0, 42))}</td>` +
             `<td><select class="ana-ed" data-i="${i}">${opts}</select></td></tr>`;
    }).join('');
    const period = result.transactions.length
      ? [...result.transactions.map(t => t.date)].sort()[0] + ' — ' + [...result.transactions.map(t => t.date)].sort().pop() : '';
    container.innerHTML = `
      <header class="ana-head">
        <div><span class="ana-brand">local<b>statement</b>.com</span>
        <h2>${esc(T('anaTitle'))}</h2>
        <p class="ana-sub">${result.bank ? esc(result.bank) + ' · ' : ''}${period} · ${result.transactions.length} ${esc(T('txs'))}</p></div>
      </header>
      <div class="ana-tiles">
        <div class="ana-tile"><span class="k">${esc(T('anaIncome'))}</span><span class="v pos">+${fmt(agg.income)}</span></div>
        <div class="ana-tile"><span class="k">${esc(T('anaExpense'))}</span><span class="v exp">−${fmt(agg.expense)}</span></div>
        <div class="ana-tile"><span class="k">${esc(T('anaNet'))}</span><span class="v ${agg.net >= 0 ? 'pos' : 'exp'}">${agg.net >= 0 ? '+' : ''}${fmt(agg.net)}</span></div>
      </div>
      ${agg.topCats.length ? `<h3>${esc(T('anaByCat'))}</h3><div class="ana-chart" id="anaCats">${barsByCategory(agg.topCats, agg.names, agg.expense)}</div>` : ''}
      ${agg.byMonth.length > 1 ? `<h3>${esc(T('anaMonthly'))}</h3><div class="ana-chart" id="anaMonths">${barsByMonth(agg.byMonth, T('anaIncome'), T('anaExpense'))}</div>` : ''}
      ${balanceLine(result.transactions) ? `<h3>${esc(T('anaBalance'))}</h3><div class="ana-chart">${balanceLine(result.transactions)}</div>` : ''}
      <details class="ana-editor no-print"${editorOpen ? ' open' : ''}>
        <summary>${esc(T('anaEdit'))}</summary>
        <div class="ana-ed-wrap"><table><tbody>${editorRows}</tbody></table></div>
      </details>
      <div class="ana-actions no-print">
        <button id="anaPdf">${esc(T('anaPdf'))}</button>
        <button id="anaXlsx" class="ghost">${esc(T('anaXlsxCat'))}</button>
      </div>
      <p class="ana-footer">${esc(T('anaFooter'))} · <b>localstatement.com</b></p>`;

    // tooltips
    const tip = tooltip(container);
    container.querySelectorAll('.ana-bar, .ana-in, .ana-ex').forEach(el => {
      el.addEventListener('mousemove', e => {
        const label = el.dataset.n || el.dataset.m;
        tip.show(e.clientX, e.clientY, `<b>${esc(label)}</b> ${fmt(parseFloat(el.dataset.v))}`);
      });
      el.addEventListener('mouseleave', tip.hide);
    });

    container.querySelector('#anaPdf').addEventListener('click', () => window.print());
    container.querySelector('#anaXlsx').addEventListener('click', () => {
      LS_EXPORTS.xlsxAnalysis(result.transactions, agg, T);
    });

    // edición de categorías: aprende la regla y re-dibuja el informe
    container.querySelectorAll('.ana-ed').forEach(sel => {
      sel.addEventListener('change', () => {
        const t = result.transactions[parseInt(sel.dataset.i, 10)];
        let key = sel.value;
        if (key === '__new__') {
          const name = (window.prompt(T('anaNewCat')) || '').trim().slice(0, 24);
          if (!name) { sel.value = t.catKey; return; }
          key = addCustomCat(name);
        }
        t.catKey = key;
        saveRule(t.concept, key);
        render(container, result, lang, T, true);
      });
    });
    return agg;
  }

  return { render, aggregate, categorize };
})();
