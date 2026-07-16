/* LocalStatement — pegamento de UI. */
'use strict';

(() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  const $ = id => document.getElementById(id);
  let lastResult = null;
  let lastName = 'movimientos';
  let lastFile = null;
  let consumedForFile = false;

  // ---- idioma ----
  const sel = $('lang');
  LS_I18N.langs.forEach(l => {
    const o = document.createElement('option');
    o.value = l; o.textContent = LS_I18N.name(l);
    if (l === LS_I18N.lang) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => { LS_I18N.apply(sel.value); showCredits(); });
  LS_I18N.apply();

  // ---- contador del bono comprado (lo acredita billing.js al completar el pago) ----
  function showCredits() {
    const n = parseInt(localStorage.getItem('ls_credits') || '0', 10);
    let el = $('creditsBadge');
    if (!n) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('span');
      el.id = 'creditsBadge';
      el.className = 'privacy';
      document.querySelector('#drop .privacy').after(el);
    }
    el.textContent = '★ ' + LS_I18N.t('creditsLeft').replace('{n}', n.toLocaleString());
  }
  showCredits();

  // ---- cuota gratuita (20 págs/mes) + bono comprado (ls_credits, lo acredita billing.js) ----
  const QUOTA = 20;
  function quotaState() {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}`;
    let st = {};
    try { st = JSON.parse(localStorage.getItem('ls_quota') || '{}'); } catch (e) {}
    if (st.key !== key) st = { key, used: 0 };
    return st;
  }
  const credits = () => parseInt(localStorage.getItem('ls_credits') || '0', 10);
  const freeLeft = () => Math.max(0, QUOTA - quotaState().used);
  const pagesLeft = () => freeLeft() + credits();
  function consume(pages) {
    const st = quotaState();
    const fromFree = Math.min(pages, Math.max(0, QUOTA - st.used));
    st.used += fromFree;
    localStorage.setItem('ls_quota', JSON.stringify(st));
    const rest = pages - fromFree;
    if (rest > 0) localStorage.setItem('ls_credits', String(Math.max(0, credits() - rest)));
  }

  // ---- conversión ----
  async function handle(file) {
    if (!file || file.type !== 'application/pdf') return;
    if (pagesLeft() <= 0) {
      $('result').hidden = false;
      $('stats').innerHTML = ''; $('tbl').innerHTML = ''; $('dl').hidden = true;
      $('msg').textContent = LS_I18N.t('quotaOver');
      $('msg').className = 'warn';
      document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    lastName = file.name.replace(/\.pdf$/i, '') || 'movimientos';
    lastFile = file;
    consumedForFile = false;
    $('result').hidden = false;
    $('msg').textContent = '…';
    $('msg').className = '';
    $('stats').innerHTML = '';
    $('tbl').innerHTML = '';
    $('dl').hidden = true;
    $('ocrBtn').hidden = true;
    try {
      const buf = await file.arrayBuffer();
      const r = await LS_ENGINE.convert(buf);
      lastResult = r;
      render(r);
      if (r.transactions.length) { consume(r.pages); consumedForFile = true; }
      showCredits();
      // ofrecer OCR local si es un escaneo o si la extracción no cuadra
      const bad = r.scanned || !r.transactions.length ||
                  (r.coherence.checked > 1 && r.coherence.ok < r.coherence.checked);
      $('ocrBtn').hidden = r.scanned ? false : true;
      // ofrecer "ayúdanos con tu banco" cuando saca pocos/ningún movimiento y NO es escaneo
      $('diagBtn').hidden = !( !r.scanned && (r.transactions.length === 0 || r.transactions.length < r.pages * 2) );
      $('diagBox').hidden = true;
    } catch (e) {
      $('msg').textContent = 'Error: ' + e.message;
      $('msg').className = 'warn';
    }
  }

  async function handleOCR() {
    if (!lastFile) return;
    $('ocrBtn').disabled = true;
    $('msg').className = '';
    try {
      const buf = await lastFile.arrayBuffer();   // buffer nuevo: pdf.js consume el anterior
      const pages = await LS_OCR.extractPagesOCR(buf, LS_I18N.lang, (p, total, prog) => {
        $('msg').textContent = LS_I18N.t('ocrRunning')
          .replace('{p}', p).replace('{total}', total) + ' ' + Math.round(prog * 100) + '%';
      });
      const r = LS_ENGINE.parsePages(pages);
      r.scanned = false;                          // ya viene del OCR
      lastResult = r;
      render(r);
      if (r.transactions.length && !consumedForFile) { consume(r.pages); consumedForFile = true; }
      showCredits();
    } catch (e) {
      $('msg').textContent = 'OCR: ' + ((e && (e.message || (e.data && e.data.message))) || String(e));
      $('msg').className = 'warn';
    } finally {
      $('ocrBtn').disabled = false;
      $('ocrBtn').hidden = true;
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
    if (r.fixed > 0) {
      chips.push(`<span class="stat" title="${t('fixedTip')}">${t('fixedChip').replace('{n}', r.fixed)}</span>`);
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

  $('ocrBtn').addEventListener('click', handleOCR);

  async function handleDiag() {
    if (!lastFile) return;
    $('diagBtn').disabled = true;
    try {
      const buf = await lastFile.arrayBuffer();
      const report = await LS_DIAGNOSTIC.buildReport(buf, { bank: lastResult && lastResult.bank, lang: LS_I18N.lang });
      const box = $('diagBox');
      box.hidden = false;
      box.innerHTML = `<p class="diag-intro">${LS_I18N.t('diagIntro')}</p>` +
        `<textarea id="diagText" readonly rows="10"></textarea>` +
        `<div class="diag-actions"><button id="diagCopy">${LS_I18N.t('diagCopy')}</button>` +
        `<a id="diagMail" class="ghost-link">${LS_I18N.t('diagMail')}</a></div>`;
      document.getElementById('diagText').value = report;
      document.getElementById('diagCopy').addEventListener('click', () => {
        navigator.clipboard.writeText(report).then(() => {
          document.getElementById('diagCopy').textContent = LS_I18N.t('diagCopied');
        });
      });
      const subject = encodeURIComponent('Soporte de banco: ' + (lastResult && lastResult.bank || lastFile.name));
      document.getElementById('diagMail').href =
        `mailto:hello@localstatement.com?subject=${subject}&body=${encodeURIComponent(LS_I18N.t('diagBody') + '\n\n' + report)}`;
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      $('msg').textContent = 'Diag: ' + e.message; $('msg').className = 'warn';
    } finally { $('diagBtn').disabled = false; }
  }
  $('diagBtn').addEventListener('click', handleDiag);

  // análisis: 2 gratis/mes; ilimitado con bono activo
  const ANA_FREE = 2;
  let anaCountedFile = null;
  function anaState() {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}`;
    let st = {};
    try { st = JSON.parse(localStorage.getItem('ls_ana_quota') || '{}'); } catch (e) {}
    if (st.key !== key) st = { key, used: 0 };
    return st;
  }

  $('anaBtn').addEventListener('click', () => {
    if (!lastResult || !lastResult.transactions.length) return;
    const st = anaState();
    const isNewFile = anaCountedFile !== lastFile;
    if (isNewFile && credits() <= 0 && st.used >= ANA_FREE) {
      $('msg').textContent = LS_I18N.t('anaQuotaOver');
      $('msg').className = 'warn';
      document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (isNewFile) {
      st.used += 1;
      localStorage.setItem('ls_ana_quota', JSON.stringify(st));
      anaCountedFile = lastFile;
    }
    const rep = $('anaReport');
    rep.hidden = false;
    LS_ANALYSIS.render(rep, lastResult, LS_I18N.lang, k => LS_I18N.t(k));
    rep.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const drop = $('drop');
  $('file').addEventListener('change', e => handle(e.target.files[0]));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('over');
    handle(e.dataTransfer.files[0]);
  });
})();
