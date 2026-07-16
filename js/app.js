/* LocalStatement — pegamento de UI. */
'use strict';

(() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  const $ = id => document.getElementById(id);
  let lastResult = null;
  let lastName = 'movimientos';

  // ---- idioma ----
  const sel = $('lang');
  LS_I18N.langs.forEach(l => {
    const o = document.createElement('option');
    o.value = l; o.textContent = LS_I18N.name(l);
    if (l === LS_I18N.lang) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => LS_I18N.apply(sel.value));
  LS_I18N.apply();

  // ---- cuota gratuita local (20 págs/mes) — se sustituirá por créditos Paddle ----
  const QUOTA = 20;
  function quotaState() {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}`;
    let st = {};
    try { st = JSON.parse(localStorage.getItem('ls_quota') || '{}'); } catch (e) {}
    if (st.key !== key) st = { key, used: 0 };
    return st;
  }
  function quotaUse(pages) {
    const st = quotaState();
    st.used += pages;
    localStorage.setItem('ls_quota', JSON.stringify(st));
  }

  // ---- conversión ----
  async function handle(file) {
    if (!file || file.type !== 'application/pdf') return;
    lastName = file.name.replace(/\.pdf$/i, '') || 'movimientos';
    $('result').hidden = false;
    $('msg').textContent = '…';
    $('msg').className = '';
    $('stats').innerHTML = '';
    $('tbl').innerHTML = '';
    $('dl').hidden = true;
    try {
      const buf = await file.arrayBuffer();
      const r = await LS_ENGINE.convert(buf);
      lastResult = r;
      render(r);
      quotaUse(r.pages);
    } catch (e) {
      $('msg').textContent = 'Error: ' + e.message;
      $('msg').className = 'warn';
    }
  }

  const fmt = n => n === null ? '' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function render(r) {
    const t = LS_I18N.t;
    const chips = [
      `<span class="stat">${r.pages} ${t('pages')}</span>`,
      `<span class="stat">${r.transactions.length} ${t('txs')}</span>`,
    ];
    if (r.bank) chips.push(`<span class="stat">${t('bank')}: <b>${r.bank}</b></span>`);
    if (r.coherence.checked > 0) {
      const all = r.coherence.ok === r.coherence.checked;
      chips.push(`<span class="stat ${all ? 'good' : 'warnc'}" title="${t('coherentTip')}">` +
        `${all ? '✓' : '△'} ${t('coherent')}: ${r.coherence.ok}/${r.coherence.checked}</span>`);
    }
    $('stats').innerHTML = chips.join('');

    if (r.scanned) { $('msg').textContent = t('scanned'); $('msg').className = 'warn'; return; }
    if (!r.transactions.length) { $('msg').textContent = t('few'); $('msg').className = 'warn'; return; }
    $('msg').textContent = '';
    if (r.transactions.length < r.pages * 3) {
      $('msg').textContent = t('few'); $('msg').className = 'warn';
    }

    const rows = r.transactions.map(x =>
      `<tr><td>${x.date}</td><td>${x.concept.replace(/</g, '&lt;')}</td>` +
      `<td class="num ${x.amount < 0 ? 'neg' : 'pos'}">${fmt(x.amount)}</td>` +
      `<td class="num">${fmt(x.balance)}</td></tr>`).join('');
    $('tbl').innerHTML =
      `<table><thead><tr><th>${t('colDate')}</th><th>${t('colConcept')}</th>` +
      `<th>${t('colAmount')}</th><th>${t('colBalance')}</th></tr></thead><tbody>${rows}</tbody></table>`;
    $('dl').hidden = false;
  }

  $('dlCsv').addEventListener('click', () => lastResult && LS_EXPORTS.csv(lastResult.transactions, lastName));
  $('dlXlsx').addEventListener('click', () => lastResult && LS_EXPORTS.xlsx(lastResult.transactions, lastName));
  $('dlHolded').addEventListener('click', () => lastResult && LS_EXPORTS.holded(lastResult.transactions, lastName));

  const drop = $('drop');
  $('file').addEventListener('change', e => handle(e.target.files[0]));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('over');
    handle(e.dataTransfer.files[0]);
  });
})();
