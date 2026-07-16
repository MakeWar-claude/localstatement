/* LocalStatement — i18n con detección automática del idioma del navegador.
   data-i18n="clave" en el HTML; textos aquí. ES/EN/IT/DE. */
'use strict';

const LS_I18N = (() => {
  const D = {
    es: {
      tagline: 'Convierte extractos bancarios PDF a Excel sin que salgan de tu ordenador',
      sub: 'Todo ocurre en tu navegador: tu extracto nunca se sube a ningún servidor. Compruébalo tú mismo en la pestaña Red de tu navegador — cero peticiones.',
      drop: 'Arrastra aquí tu extracto PDF',
      dropOr: 'o haz clic para elegirlo',
      privacy: '✓ 100% local · sin registro · sin subir nada',
      pages: 'páginas', txs: 'movimientos', bank: 'banco',
      coherent: 'coherencia contable verificada',
      coherentTip: 'Comprobamos que saldo anterior + importe = saldo siguiente en toda la cadena. Si este sello está en verde, la conversión cuadra al céntimo.',
      scanned: 'Este PDF es un escaneo sin capa de texto fiable. El soporte OCR para escaneados llegará pronto — déjanos tu email y te avisamos.',
      few: 'Hemos reconocido pocos movimientos. Si tu banco usa otro formato, envíanos una página de ejemplo (anonimizada) y añadimos el perfil en 48h.',
      dlCsv: 'Descargar CSV', dlXlsx: 'Descargar Excel', dlHolded: 'CSV para Holded',
      colDate: 'Fecha', colConcept: 'Concepto', colAmount: 'Importe', colBalance: 'Saldo',
      howTitle: 'Cómo funciona',
      how1: 'Elige el PDF de tu banco. No se sube: se abre dentro de tu propio navegador.',
      how2: 'El motor reconoce las tablas de movimientos y verifica que los saldos cuadran al céntimo.',
      how3: 'Descarga Excel, CSV o el formato de tu programa contable. Y ya está.',
      whyTitle: '¿Por qué LocalStatement?',
      why1t: 'Privacidad real, no prometida', why1: 'Los demás conversores suben tu extracto a sus servidores y prometen borrarlo. Aquí no hay servidor al que subirlo: el código se ejecuta en tu máquina. Ábrelo en modo avión si quieres.',
      why2t: 'Bancos europeos en su idioma', why2: 'Los líderes del sector solo procesan bien PDFs en inglés. LocalStatement está construido para los formatos nativos de España e Italia, y para N26 y Revolut.',
      why3t: 'Cuadre garantizado', why3: 'Cada conversión pasa un chequeo de coherencia contable (saldo a saldo, movimiento a movimiento). Si algo no cuadra, te lo decimos — no te dejamos descubrirlo en la declaración de impuestos.',
      priceTitle: 'Precios',
      priceFree: 'Gratis', priceFreeDetail: '20 páginas al mes · todos los exports · sin registro',
      pricePack: 'Bono 500 páginas', pricePackPrice: '19 €', pricePackDetail: 'pago único · no caduca · para gestorías y autónomos',
      pricePro: 'Bono 2.500 páginas', priceProPrice: '59 €', priceProDetail: 'pago único · no caduca · soporte prioritario de formatos',
      priceSoon: 'Muy pronto', priceNote: 'Compra segura procesada por Paddle, nuestro vendedor registrado. Los bonos no caducan nunca.',
      creditsLeft: 'Bono activo: quedan {n} páginas',
      faqTitle: 'Preguntas frecuentes',
      faq1q: '¿De verdad no subís mi extracto?', faq1a: 'De verdad. La conversión usa pdf.js (el motor PDF de Firefox) ejecutándose en tu navegador. Puedes verificarlo: abre las herramientas de desarrollador (F12), pestaña Red, y convierte un extracto — verás que no se envía ninguna petición.',
      faq2q: '¿Qué bancos funcionan?', faq2a: 'Cualquier PDF digital con extracto tabular en formato europeo (fecha + concepto + importe + saldo): Santander, BBVA, CaixaBank, Sabadell, Bankinter, ING, Intesa Sanpaolo, UniCredit, N26, Revolut y más. Los PDFs escaneados (foto/papel) aún no: el OCR local está en camino.',
      faq3q: '¿Y si mi banco no sale bien?', faq3a: 'Envíanos una página de ejemplo (tacha lo que quieras) y añadimos el perfil de tu banco, normalmente en 48 horas.',
      langName: 'Español',
    },
    en: {
      tagline: 'Convert bank statement PDFs to Excel — without them ever leaving your computer',
      sub: 'Everything runs in your browser: your statement is never uploaded to any server. Verify it yourself in your browser’s Network tab — zero requests.',
      drop: 'Drop your PDF statement here',
      dropOr: 'or click to choose it',
      privacy: '✓ 100% local · no signup · nothing uploaded',
      pages: 'pages', txs: 'transactions', bank: 'bank',
      coherent: 'accounting coherence verified',
      coherentTip: 'We check that previous balance + amount = next balance across the whole chain. Green badge = the conversion balances to the cent.',
      scanned: 'This PDF is a scan without a reliable text layer. Local OCR support for scans is coming — leave your email and we’ll let you know.',
      few: 'We recognised few transactions. If your bank uses a different layout, send us one (redacted) sample page and we’ll add the profile within 48h.',
      dlCsv: 'Download CSV', dlXlsx: 'Download Excel', dlHolded: 'CSV for Holded',
      colDate: 'Date', colConcept: 'Description', colAmount: 'Amount', colBalance: 'Balance',
      howTitle: 'How it works',
      how1: 'Pick your bank’s PDF. It isn’t uploaded — it opens inside your own browser.',
      how2: 'The engine detects the transaction tables and verifies balances reconcile to the cent.',
      how3: 'Download Excel, CSV or your accounting software’s format. Done.',
      whyTitle: 'Why LocalStatement?',
      why1t: 'Real privacy, not promised privacy', why1: 'Other converters upload your statement to their servers and promise to delete it. Here there is no server to upload to: the code runs on your machine. Use it in airplane mode if you like.',
      why2t: 'European banks, native language', why2: 'The market leaders only process English-language PDFs well. LocalStatement is built for the native formats of Spain and Italy, plus N26 and Revolut.',
      why3t: 'Guaranteed reconciliation', why3: 'Every conversion passes an accounting coherence check (balance to balance, transaction by transaction). If something doesn’t add up, we tell you upfront.',
      priceTitle: 'Pricing',
      priceFree: 'Free', priceFreeDetail: '20 pages per month · all exports · no signup',
      pricePack: '500-page pack', pricePackPrice: '€19', pricePackDetail: 'one-off · never expires · for accountants & freelancers',
      pricePro: '2,500-page pack', priceProPrice: '€59', priceProDetail: 'one-off · never expires · priority format support',
      priceSoon: 'Coming soon', priceNote: 'Secure checkout by Paddle, our Merchant of Record. Packs never expire.',
      creditsLeft: 'Active pack: {n} pages left',
      faqTitle: 'FAQ',
      faq1q: 'You really don’t upload my statement?', faq1a: 'Really. Conversion uses pdf.js (Firefox’s PDF engine) running in your browser. Verify it: open developer tools (F12), Network tab, convert a statement — you’ll see no request is sent.',
      faq2q: 'Which banks work?', faq2a: 'Any digital PDF with a tabular statement in European format (date + description + amount + balance): Santander, BBVA, CaixaBank, Sabadell, Bankinter, ING, Intesa Sanpaolo, UniCredit, N26, Revolut and more. Scanned PDFs aren’t supported yet — local OCR is on the way.',
      faq3q: 'What if my bank doesn’t parse well?', faq3a: 'Send us one sample page (redact whatever you want) and we’ll add your bank’s profile, usually within 48 hours.',
      langName: 'English',
    },
    it: {
      tagline: 'Converti estratti conto PDF in Excel — senza che escano dal tuo computer',
      sub: 'Tutto avviene nel tuo browser: il tuo estratto conto non viene mai caricato su nessun server. Verificalo tu stesso nella scheda Rete — zero richieste.',
      drop: 'Trascina qui il tuo estratto conto PDF',
      dropOr: 'o clicca per sceglierlo',
      privacy: '✓ 100% locale · senza registrazione · nessun upload',
      pages: 'pagine', txs: 'movimenti', bank: 'banca',
      coherent: 'coerenza contabile verificata',
      coherentTip: 'Verifichiamo che saldo precedente + importo = saldo successivo lungo tutta la catena. Badge verde = la conversione quadra al centesimo.',
      scanned: 'Questo PDF è una scansione senza livello di testo affidabile. Il supporto OCR locale è in arrivo — lasciaci la tua email e ti avviseremo.',
      few: 'Abbiamo riconosciuto pochi movimenti. Se la tua banca usa un altro formato, inviaci una pagina di esempio (oscurata) e aggiungeremo il profilo entro 48h.',
      dlCsv: 'Scarica CSV', dlXlsx: 'Scarica Excel', dlHolded: 'CSV per Holded',
      colDate: 'Data', colConcept: 'Descrizione', colAmount: 'Importo', colBalance: 'Saldo',
      howTitle: 'Come funziona',
      how1: 'Scegli il PDF della tua banca. Non viene caricato: si apre dentro il tuo browser.',
      how2: 'Il motore riconosce le tabelle dei movimenti e verifica che i saldi quadrino al centesimo.',
      how3: 'Scarica Excel, CSV o il formato del tuo software contabile. Fatto.',
      whyTitle: 'Perché LocalStatement?',
      why1t: 'Privacy reale, non promessa', why1: 'Gli altri convertitori caricano il tuo estratto sui loro server e promettono di cancellarlo. Qui non c’è nessun server: il codice gira sulla tua macchina.',
      why2t: 'Banche italiane in italiano', why2: 'I leader del settore processano bene solo PDF in inglese, e nessuno copre Intesa Sanpaolo o UniCredit. LocalStatement è costruito per i formati nativi italiani.',
      why3t: 'Quadratura garantita', why3: 'Ogni conversione passa un controllo di coerenza contabile (saldo su saldo, movimento per movimento). Se qualcosa non quadra, te lo diciamo subito.',
      priceTitle: 'Prezzi',
      priceFree: 'Gratis', priceFreeDetail: '20 pagine al mese · tutti gli export · senza registrazione',
      pricePack: 'Pacchetto 500 pagine', pricePackPrice: '19 €', pricePackDetail: 'una tantum · non scade · per commercialisti e partite IVA',
      pricePro: 'Pacchetto 2.500 pagine', priceProPrice: '59 €', priceProDetail: 'una tantum · non scade · supporto prioritario dei formati',
      priceSoon: 'In arrivo', priceNote: 'Pagamento sicuro tramite Paddle, il nostro rivenditore autorizzato. I pacchetti non scadono mai.',
      creditsLeft: 'Pacchetto attivo: {n} pagine rimanenti',
      faqTitle: 'Domande frequenti',
      faq1q: 'Davvero non caricate il mio estratto conto?', faq1a: 'Davvero. La conversione usa pdf.js (il motore PDF di Firefox) in esecuzione nel tuo browser. Verificalo: apri gli strumenti sviluppatore (F12), scheda Rete, converti un estratto — nessuna richiesta viene inviata.',
      faq2q: 'Quali banche funzionano?', faq2a: 'Qualsiasi PDF digitale con estratto tabellare in formato europeo: Intesa Sanpaolo, UniCredit, Santander, BBVA, N26, Revolut e altre. I PDF scansionati non sono ancora supportati — l’OCR locale è in arrivo.',
      faq3q: 'E se la mia banca non viene letta bene?', faq3a: 'Inviaci una pagina di esempio (oscura ciò che vuoi) e aggiungeremo il profilo della tua banca, di solito entro 48 ore.',
      langName: 'Italiano',
    },
    de: {
      tagline: 'Kontoauszüge als PDF in Excel umwandeln — ohne dass sie Ihren Rechner verlassen',
      sub: 'Alles läuft in Ihrem Browser: Ihr Kontoauszug wird nie auf einen Server hochgeladen. Prüfen Sie es selbst im Netzwerk-Tab — null Anfragen.',
      drop: 'Kontoauszug-PDF hier ablegen',
      dropOr: 'oder klicken zum Auswählen',
      privacy: '✓ 100% lokal · ohne Registrierung · kein Upload',
      pages: 'Seiten', txs: 'Buchungen', bank: 'Bank',
      coherent: 'Salden rechnerisch geprüft',
      coherentTip: 'Wir prüfen, dass alter Saldo + Betrag = neuer Saldo über die gesamte Kette. Grünes Siegel = die Umwandlung stimmt auf den Cent.',
      scanned: 'Dieses PDF ist ein Scan ohne zuverlässige Textebene. Lokale OCR-Unterstützung kommt bald — hinterlassen Sie Ihre E-Mail.',
      few: 'Wir haben wenige Buchungen erkannt. Falls Ihre Bank ein anderes Layout nutzt, senden Sie uns eine (geschwärzte) Beispielseite — Profil in 48h.',
      dlCsv: 'CSV herunterladen', dlXlsx: 'Excel herunterladen', dlHolded: 'CSV für Holded',
      colDate: 'Datum', colConcept: 'Verwendungszweck', colAmount: 'Betrag', colBalance: 'Saldo',
      howTitle: 'So funktioniert es',
      how1: 'PDF Ihrer Bank auswählen. Es wird nicht hochgeladen — es öffnet sich in Ihrem Browser.',
      how2: 'Die Engine erkennt die Buchungstabellen und prüft, dass die Salden auf den Cent stimmen.',
      how3: 'Excel, CSV oder das Format Ihrer Buchhaltungssoftware herunterladen. Fertig.',
      whyTitle: 'Warum LocalStatement?',
      why1t: 'Echte Privatsphäre, nicht versprochene', why1: 'Andere Konverter laden Ihren Auszug auf ihre Server und versprechen, ihn zu löschen. Hier gibt es keinen Server: der Code läuft auf Ihrem Rechner.',
      why2t: 'Europäische Banken, native Formate', why2: 'Die Marktführer verarbeiten nur englischsprachige PDFs gut. LocalStatement ist für native europäische Formate gebaut, inklusive N26 und Revolut.',
      why3t: 'Garantierte Abstimmung', why3: 'Jede Umwandlung durchläuft eine Saldenprüfung (Saldo zu Saldo, Buchung für Buchung). Wenn etwas nicht stimmt, sagen wir es Ihnen sofort.',
      priceTitle: 'Preise',
      priceFree: 'Kostenlos', priceFreeDetail: '20 Seiten pro Monat · alle Exporte · ohne Registrierung',
      pricePack: '500-Seiten-Paket', pricePackPrice: '19 €', pricePackDetail: 'einmalig · verfällt nie · für Kanzleien und Selbstständige',
      pricePro: '2.500-Seiten-Paket', priceProPrice: '59 €', priceProDetail: 'einmalig · verfällt nie · priorisierte Formatunterstützung',
      priceSoon: 'Bald verfügbar', priceNote: 'Sichere Zahlung über Paddle, unseren Merchant of Record. Pakete verfallen nie.',
      creditsLeft: 'Aktives Paket: {n} Seiten übrig',
      faqTitle: 'Häufige Fragen',
      faq1q: 'Sie laden meinen Kontoauszug wirklich nicht hoch?', faq1a: 'Wirklich. Die Umwandlung nutzt pdf.js (die PDF-Engine von Firefox) direkt in Ihrem Browser. Prüfen Sie es: Entwicklertools öffnen (F12), Netzwerk-Tab, einen Auszug umwandeln — es wird keine Anfrage gesendet.',
      faq2q: 'Welche Banken funktionieren?', faq2a: 'Jedes digitale PDF mit tabellarischem Auszug im europäischen Format: Sparkasse, Volksbank, N26, Santander, BBVA, Revolut und mehr. Gescannte PDFs noch nicht — lokales OCR ist unterwegs.',
      faq3q: 'Was, wenn meine Bank nicht gut erkannt wird?', faq3a: 'Senden Sie uns eine Beispielseite (schwärzen Sie, was Sie möchten) und wir fügen das Profil Ihrer Bank hinzu, meist innerhalb von 48 Stunden.',
      langName: 'Deutsch',
    },
  };

  function detect() {
    const saved = localStorage.getItem('ls_lang');
    if (saved && D[saved]) return saved;
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return D[nav] ? nav : 'en';
  }

  let current = detect();

  function apply(lang) {
    if (lang) { current = lang; localStorage.setItem('ls_lang', lang); }
    document.documentElement.lang = current;
    const dict = D[current];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (dict[k] !== undefined) el.textContent = dict[k];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const k = el.getAttribute('data-i18n-title');
      if (dict[k] !== undefined) el.title = dict[k];
    });
  }

  return { apply, t: k => D[current][k] || k, get lang() { return current; }, langs: Object.keys(D), name: l => D[l].langName };
})();
