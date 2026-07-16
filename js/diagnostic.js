/* LocalStatement — modo diagnóstico: "ayúdanos a soportar tu banco" SIN romper la privacidad.
   Extrae solo la ESTRUCTURA del PDF (posiciones de columna, formato de fecha/número,
   longitudes) anonimizando todo dato real: dígitos -> 9, letras -> x. El usuario copia
   el resultado y nos lo manda por email; nosotros vemos el layout, nunca su dinero ni su nombre. */
'use strict';

const LS_DIAGNOSTIC = (() => {

  // enmascara preservando forma: importes/fechas quedan como patrón, texto como longitud
  function mask(s) {
    return s.replace(/[0-9]/g, '9')
            .replace(/[A-Za-zÀ-ÿ]/g, 'x');
  }

  async function buildReport(arrayBuffer, meta) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const lines = [];
    lines.push('=== LocalStatement — informe de formato (anonimizado) ===');
    lines.push('banco declarado: ' + (meta.bank || '(no detectado)'));
    lines.push('idioma navegador: ' + (meta.lang || '?'));
    lines.push('páginas: ' + pdf.numPages);
    lines.push('nota: dígitos->9, letras->x. Ningún dato real sale de tu equipo.');
    lines.push('');

    const maxPages = Math.min(pdf.numPages, 2);
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      lines.push(`--- página ${p} (primeras filas, con posición X) ---`);
      // agrupar por Y como el motor
      const rows = new Map();
      for (const it of tc.items) {
        if (!it.str.trim()) continue;
        const y = Math.round(it.transform[5] / 2) * 2;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x: Math.round(it.transform[4]), s: it.str });
      }
      const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0]).slice(0, 22);
      for (const [, cells] of ordered) {
        const parts = cells.sort((a, b) => a.x - b.x)
          .map(c => `[x${c.x}] ${mask(c.s).slice(0, 40)}`);
        lines.push(parts.join('  '));
      }
      lines.push('');
    }
    lines.push('=== fin del informe · envíalo a hello@localstatement.com ===');
    return lines.join('\n');
  }

  return { buildReport };
})();
