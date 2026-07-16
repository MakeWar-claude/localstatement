/* LocalStatement — integración Paddle (Merchant of Record).
   ACTIVACIÓN: rellenar LS_PADDLE_CONFIG con los datos del panel de Paddle
   (Developer Tools → Authentication → client-side token; Catalog → Products → price IDs)
   y los botones de compra cobran vida. Con token vacío, los botones quedan en "Muy pronto".
   env: 'sandbox' para probar (tarjeta 4242 4242 4242 4242), 'production' para vender. */
'use strict';

const LS_PADDLE_CONFIG = {
  env: 'production',
  token: 'live_fb724f0b625afa856ee34ee98df',
  prices: {
    pack500:  'pri_01kxnb4av36btnjgg7c06spy25',   // 500 páginas · 19 €
    pack2500: 'pri_01kxnb4r60s2frw6m4c599s5nt',   // 2.500 páginas · 59 €
  },
  pages: { pack500: 500, pack2500: 2500 },
};

(() => {
  const cfg = LS_PADDLE_CONFIG;
  const btns = { pack500: document.getElementById('buyPack'), pack2500: document.getElementById('buyPro') };
  if (!cfg.token) return;          // sin configurar: los botones siguen deshabilitados

  // atribución sin rastreadores: si la visita llega con utm (p.ej. Google Ads),
  // se recuerda en local y se adjunta a la compra como customData de Paddle.
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('utm_source')) {
      localStorage.setItem('ls_utm', JSON.stringify({
        source: q.get('utm_source'), campaign: q.get('utm_campaign') || '',
        term: q.get('utm_term') || '', when: new Date().toISOString().slice(0, 10),
      }));
    }
  } catch (e) {}

  // Paddle.js NO se carga al abrir la página (trae su propio tracker de Paddle):
  // se carga solo cuando el usuario pulsa comprar. Mantiene la promesa
  // "convertir = cero peticiones externas".
  let paddleReady = null;
  function loadPaddle() {
    if (!paddleReady) {
      paddleReady = new Promise((ok, ko) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        s.onerror = () => ko(new Error('No se pudo cargar Paddle'));
        s.onload = () => {
          if (cfg.env === 'sandbox') Paddle.Environment.set('sandbox');
          Paddle.Initialize({
            token: cfg.token,
            eventCallback: ev => {
              if (ev.name !== 'checkout.completed') return;
              const txId = ev.data && ev.data.transaction_id;
              // idempotencia: si ya acreditamos esta transacción, no repetir (Paddle puede
              // disparar el evento más de una vez por checkout).
              try {
                const done = JSON.parse(localStorage.getItem('ls_orders') || '[]');
                if (txId && done.includes(txId)) return;
                const item = ev.data && ev.data.items && ev.data.items[0];
                const priceId = item && (item.price_id || (item.price && item.price.id));
                const key = Object.keys(cfg.prices).find(k => cfg.prices[k] === priceId);
                if (!key) { console.warn('LS: compra sin price_id reconocido', priceId); return; }
                const cur = parseInt(localStorage.getItem('ls_credits') || '0', 10);
                localStorage.setItem('ls_credits', String(cur + cfg.pages[key]));
                if (txId) { done.push(txId); localStorage.setItem('ls_orders', JSON.stringify(done.slice(-50))); }
                localStorage.setItem('ls_last_order', JSON.stringify({
                  order: txId, pages: cfg.pages[key],
                }));
                location.reload();
              } catch (e) { console.warn('LS billing', e); }
            },
          });
          ok();
        };
        document.head.appendChild(s);
      });
    }
    return paddleReady;
  }

  for (const [key, btn] of Object.entries(btns)) {
    if (!btn || !cfg.prices[key]) continue;
    btn.disabled = false;
    btn.removeAttribute('data-i18n');          // que el cambio de idioma no pise el precio
    btn.textContent = btn.getAttribute('data-buy-label') || 'Comprar';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await loadPaddle();
        let utm = null;
        try { utm = JSON.parse(localStorage.getItem('ls_utm') || 'null'); } catch (e) {}
        Paddle.Checkout.open({
          items: [{ priceId: cfg.prices[key], quantity: 1 }],
          customData: utm ? { utm_source: utm.source, utm_campaign: utm.campaign, utm_term: utm.term, first_visit: utm.when } : undefined,
        });
      } finally { btn.disabled = false; }
    });
  }
})();
