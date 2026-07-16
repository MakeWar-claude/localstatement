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

  // Paddle.js se carga solo si hay token, para mantener la home 100% sin peticiones externas
  const s = document.createElement('script');
  s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
  s.onload = () => {
    if (cfg.env === 'sandbox') Paddle.Environment.set('sandbox');
    Paddle.Initialize({
      token: cfg.token,
      eventCallback: ev => {
        if (ev.name !== 'checkout.completed') return;
        // acreditar páginas en local (fulfilment client-side del MVP)
        const item = ev.data && ev.data.items && ev.data.items[0];
        const priceId = item && item.price_id;
        const key = Object.keys(cfg.prices).find(k => cfg.prices[k] === priceId);
        if (!key) return;
        const cur = parseInt(localStorage.getItem('ls_credits') || '0', 10);
        localStorage.setItem('ls_credits', String(cur + cfg.pages[key]));
        localStorage.setItem('ls_last_order', JSON.stringify({
          order: ev.data.transaction_id, when: new Date().toISOString(), pages: cfg.pages[key],
        }));
        location.reload();
      },
    });
    for (const [key, btn] of Object.entries(btns)) {
      if (!btn || !cfg.prices[key]) continue;
      btn.disabled = false;
      btn.removeAttribute('data-i18n');        // que el cambio de idioma no pise el precio
      btn.textContent = btn.getAttribute('data-buy-label') || 'Comprar';
      btn.addEventListener('click', () =>
        Paddle.Checkout.open({ items: [{ priceId: cfg.prices[key], quantity: 1 }] }));
    }
  };
  document.head.appendChild(s);
})();
