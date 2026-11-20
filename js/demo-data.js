/**
 * ZENRO Wrist & Co. — sample data for client previews ("demo mode").
 *
 * Switched on and off by `demoMode` in js/config.js. Nothing here is real, and nothing here
 * is written into js/config.js or js/products.js:
 *  - demoMode: true  -> every setting that is still 'TODO_OWNER' (or empty) is filled with the
 *    sample value below. A real value in config.js or products.js always wins.
 *    Every page shows a "Demo preview" banner, sample prices carry a "Sample" tag, payment
 *    numbers read 01XXXXXXXXX with "Do not send money", order IDs start with ZW-DEMO- and
 *    the WhatsApp message starts with "DEMO ORDER".
 *  - demoMode: false -> this file has no effect at all: DEMO.active is false and DEMO.config
 *    is STORE_CONFIG itself.
 *
 * Loaded after js/config.js and before js/products.js on every page (see tools/stamp.mjs).
 */
'use strict';

const DEMO = (() => {
  const OFF = Object.freeze({
    active: false,
    config: STORE_CONFIG,
    price: () => null,
    isDemo: () => false,
    condition: () => null,
  });
  if (STORE_CONFIG.demoMode !== true) return OFF;

  /* ---------- Sample values (BDT) ---------- */
  const DEMO_NUMBER = '01XXXXXXXXX';
  const SAMPLE = {
    prices: {
      'rolex-datejust-01': 6500,
      'rolex-datejust-collection': 6500,
      'rolex-day-date-stone-01': 8500,
      'rolex-land-dweller-01': 7500,
      'patek-philippe-cubitus-01': 7000,
      'patek-philippe-grand-complications-01': 9500,
      'omega-aqua-terra-automatic-01': 5500,
      'jacob-and-co-godfather-01': 12500,
    },
    delivery: { insideDhaka: 80, outsideDhaka: 150, estimatedDays: '2 to 4 days' },
    cod: { advanceRequired: 'deliveryCharge' },
    payments: {
      bkash: { number: DEMO_NUMBER, accountType: 'Merchant' },
      nagad: { number: DEMO_NUMBER, accountType: 'Personal' },
      rocket: { number: DEMO_NUMBER, accountType: 'Personal' },
      bank: { bankName: 'Demo Bank Ltd', accountName: 'ZENRO Wrist & Co. (demo)', accountNumber: '0000000000000' },
    },
    condition: 'Sample listing',
  };

  /* ---------- Fill only what the owner has not set ---------- */
  const CFG = STORE_CONFIG;
  const unset = (v) => v === null || v === undefined || (typeof v === 'string' && (v.trim() === '' || v.trim() === 'TODO_OWNER'));
  const demoPaths = new Set();

  const fill = (real, sample, path) => {
    const out = { ...real };
    Object.entries(sample).forEach(([key, value]) => {
      if (unset(out[key])) {
        out[key] = value;
        demoPaths.add(`${path}.${key}`);
      }
    });
    return out;
  };

  const delivery = fill(CFG.delivery, SAMPLE.delivery, 'delivery');
  const cod = fill(CFG.cod, SAMPLE.cod, 'cod');

  // A payment method only gets demo details while its own number / account number is unset,
  // so a real number is never shown with a made-up account type (or the other way round).
  const payments = { ...CFG.payments };
  ['bkash', 'nagad', 'rocket'].forEach((key) => {
    const real = CFG.payments[key] || { enabled: true };
    if (!unset(real.number)) return;
    payments[key] = fill(real, SAMPLE.payments[key], `payments.${key}`);
    demoPaths.add(`payments.${key}`);
  });
  const bank = CFG.payments.bank || { enabled: true };
  if (unset(bank.accountNumber)) {
    payments.bank = fill(bank, SAMPLE.payments.bank, 'payments.bank');
    demoPaths.add('payments.bank');
  }

  const deepFreeze = (obj) => {
    Object.values(obj).forEach((v) => {
      if (v && typeof v === 'object') deepFreeze(v);
    });
    return Object.freeze(obj);
  };
  const config = deepFreeze({ ...CFG, delivery, cod, payments });

  /* ---------- Banner at the top of every page ---------- */
  function showBanner() {
    if (document.querySelector('.demo-banner')) return;
    const bar = document.createElement('div');
    bar.className = 'demo-banner';
    bar.setAttribute('role', 'note');
    bar.textContent = 'Demo preview. Prices and payment details are samples. Please do not send money.';
    const skip = document.querySelector('.skip-link');
    if (skip) skip.after(bar);
    else document.body.prepend(bar);
    const root = document.documentElement;
    root.classList.add('is-demo');
    // The fixed header sits below the banner; --demo-h follows the banner's height as it wraps.
    const setHeight = () => root.style.setProperty('--demo-h', `${bar.offsetHeight}px`);
    setHeight();
    if ('ResizeObserver' in window) new ResizeObserver(setHeight).observe(bar);
  }
  if (typeof document !== 'undefined' && document.body) showBanner();

  return Object.freeze({
    active: true,
    /** STORE_CONFIG with the sample values filled in where the owner has not set a value. */
    config,
    /** Sample price of a product id, or null. Use priceOf() / isDemoPrice() from products.js instead. */
    price: (id) => (Object.hasOwn(SAMPLE.prices, id) ? SAMPLE.prices[id] : null),
    /** True when a config value (e.g. 'delivery.insideDhaka' or 'payments.bkash') is a demo sample. */
    isDemo: (path) => demoPaths.has(path),
    /** Sample condition label for a product whose own condition is not set yet. */
    condition: (product) => (product && unset(product.condition) ? SAMPLE.condition : null),
    ORDER_PREFIX: 'ZW-DEMO-',
    WHATSAPP_HEADER: 'DEMO ORDER (not real, no payment made)',
    PAYMENT_NOTE: 'Demo number. Do not send money.',
    TAG: 'Sample',
  });
})();
