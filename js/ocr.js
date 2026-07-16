/* LocalStatement — OCR 100% local para extractos escaneados.
   Tesseract (WASM) servido desde este mismo dominio: la imagen del extracto
   jamás sale del navegador. Se usa bajo demanda (lazy) porque pesa ~15 MB. */
'use strict';

const LS_OCR = (() => {
  let workerPromise = null;

  const LANG_BY_UI = { es: 'spa', en: 'eng', it: 'ita', de: 'deu' };

  function loadScript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function getWorker(lang, onProgress) {
    if (!workerPromise) {
      workerPromise = (async () => {
        if (typeof Tesseract === 'undefined') await loadScript('lib/tesseract/tesseract.min.js');
        // rutas ABSOLUTAS: el worker resuelve las relativas contra su propia URL y fallan
        const abs = p => new URL(p, location.href).href;
        return Tesseract.createWorker(lang, 1, {
          workerPath: abs('lib/tesseract/worker.min.js'),
          corePath: abs('lib/tesseract/core'),
          langPath: abs('lib/tesseract/lang'),
          gzip: true,
          logger: m => {
            if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
          },
          errorHandler: e => console.error('tesseract:', e),
        });
      })();
    }
    return workerPromise;
  }

  // renderiza una página de pdf.js a canvas a ~300 DPI aprox (A4)
  async function pageToCanvas(page) {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 2200 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }

  // palabras OCR -> líneas por coordenada Y (misma idea que la capa de texto)
  function wordsToLines(words) {
    const rows = [];
    for (const w of words) {
      if (!w.text.trim() || w.confidence < 30) continue;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      const h = Math.max(8, w.bbox.y1 - w.bbox.y0);
      let row = rows.find(r => Math.abs(r.cy - cy) < h * 0.6);
      if (!row) { row = { cy, items: [] }; rows.push(row); }
      row.items.push({ x: w.bbox.x0, s: w.text });
    }
    return rows
      .sort((a, b) => a.cy - b.cy)
      .map(r => ({
        y: -r.cy,
        cells: r.items.sort((a, b) => a.x - b.x),
        text: r.items.sort((a, b) => a.x - b.x).map(i => i.s).join(' '),
      }));
  }

  /* OCR de un documento completo: devuelve páginas con líneas, mismo formato
     que extractPages() del motor. onStatus(pagina, total, progreso01). */
  async function extractPagesOCR(arrayBuffer, uiLang, onStatus) {
    const lang = LANG_BY_UI[uiLang] || 'eng';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let pageProgress = 0;
    const worker = await getWorker(lang, p => {
      if (onStatus) onStatus(pageProgress + 1, pdf.numPages, p);
    });
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      pageProgress = p - 1;
      if (onStatus) onStatus(p, pdf.numPages, 0);
      const page = await pdf.getPage(p);
      const canvas = await pageToCanvas(page);
      // v7: la estructura detallada (blocks->...->words) hay que pedirla explícitamente
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      const words = (data.words) ||
        (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(pa => (pa.lines || []).flatMap(l => l.words || [])));
      pages.push({ num: p, lines: wordsToLines(words) });
      canvas.width = 0; canvas.height = 0;   // liberar memoria
    }
    return pages;
  }

  return { extractPagesOCR };
})();
