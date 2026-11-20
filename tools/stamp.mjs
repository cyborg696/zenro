/**
 * ZENRO Wrist & Co. — page stamper
 * --------------------------------
 * Every page shares the same <head> tags, header, footer and floating WhatsApp button.
 * This script rewrites those shared parts on all pages at once, and rebuilds sitemap.xml
 * and robots.txt. Each page's own content (everything inside <main id="main">…</main>)
 * is read from the existing HTML file and kept exactly as it is.
 *
 *   npm run stamp          (or: node tools/stamp.mjs)
 *
 * Run it after you change:
 *  - the header, footer, social links or <head> tags below (titles, descriptions, scripts, CSP)
 *  - siteUrl in js/config.js (used for og:url, og:image, sitemap.xml and robots.txt)
 *  - demoMode in js/config.js (while it is true every page gets <meta name="robots" content="noindex">)
 *  - brands, models or watches in js/products.js (to update sitemap.xml)
 *
 * To add a new page: create the HTML file with a <main id="main">…</main> block, add an
 * entry to PAGES below, then run the script.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- Site address from js/config.js ---------- */
function loadScript(file, names) {
  const code = readFileSync(join(ROOT, file), 'utf8');
  return vm.runInContext(`${code}\n;({ ${names.join(', ')} })`, vm.createContext({ console }));
}
const { STORE_CONFIG } = loadScript('js/config.js', ['STORE_CONFIG']);
const PLACEHOLDER_SITE = 'https://TODO_OWNER.github.io/zenro/';
const SITE = (() => {
  const raw = STORE_CONFIG.siteUrl;
  if (typeof raw !== 'string' || !raw.trim() || raw.trim() === 'TODO_OWNER') {
    console.warn(`siteUrl is not set in js/config.js, using the placeholder ${PLACEHOLDER_SITE}`);
    return PLACEHOLDER_SITE;
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`siteUrl in js/config.js is not a valid address: ${raw}`);
  }
  if (url.protocol !== 'https:') throw new Error('siteUrl in js/config.js must start with https://');
  return url.href.endsWith('/') ? url.href : `${url.href}/`;
})();
/* Demo mode (js/demo-data.js): sample prices must never be indexed, so every page gets noindex.
 * Set demoMode to false in js/config.js and run this script again to restore normal indexing. */
const DEMO_MODE = STORE_CONFIG.demoMode === true;
if (DEMO_MODE) console.warn('demoMode is on in js/config.js: every page is stamped with noindex. Set it to false before launch.');

const WA = 'https://wa.me/8801960520872';
const IG = 'https://www.instagram.com/zenro_wrist_co/';
const FB = 'https://www.facebook.com/profile.php?id=61594772414204';

const cspFor = (connect) => `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src ${connect}; form-action 'self'; base-uri 'self'; object-src 'none'; frame-src 'none'`;
const CSP = cspFor("'self'");

/* The order webhook (optional) may only reach the exact origins listed in
 * STORE_CONFIG.webhookAllowedOrigins, and only from order-confirmation.html. */
const WEBHOOK_ORIGINS = (() => {
  const list = Array.isArray(STORE_CONFIG.webhookAllowedOrigins) ? STORE_CONFIG.webhookAllowedOrigins : [];
  if (!STORE_CONFIG.orderWebhookUrl) return [];
  return list.map((o) => {
    let url;
    try {
      url = new URL(o);
    } catch {
      throw new Error(`webhookAllowedOrigins: "${o}" is not a valid address`);
    }
    if (url.protocol !== 'https:' || url.origin !== o) throw new Error(`webhookAllowedOrigins: "${o}" must be an https origin with no path, e.g. https://formspree.io`);
    return o;
  });
})();
const CONFIRMATION_CSP = cspFor(["'self'", ...WEBHOOK_ORIGINS].join(' '));

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
const ICON = {
  instagram: `<svg ${SVG_ATTRS}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>`,
  facebook: `<svg ${SVG_ATTRS}><path d="M15.5 3.5h-2.2A4.3 4.3 0 0 0 9 7.8V21M6 11h9"/></svg>`,
  whatsapp: `<svg ${SVG_ATTRS}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.2A8 8 0 1 1 20 12z"/><path d="M9 9.5c.4 2.3 2.2 4.1 4.5 4.5"/></svg>`,
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
};

const ext = (href) => `href="${href}" target="_blank" rel="noopener noreferrer"`;
const social = (cls) => `<ul class="${cls}" aria-label="ZENRO on social media">
          <li><a ${ext(IG)} aria-label="ZENRO on Instagram (opens in a new tab)">${ICON.instagram}</a></li>
          <li><a ${ext(FB)} aria-label="ZENRO on Facebook (opens in a new tab)">${ICON.facebook}</a></li>
          <li><a ${ext(WA)} aria-label="ZENRO on WhatsApp (opens in a new tab)">${ICON.whatsapp}</a></li>
        </ul>`;

const PAGES = [
  { file: 'index.html', current: 'home', title: 'ZENRO Wrist & Co. | Watches with Cash on Delivery all over Bangladesh',
    desc: 'ZENRO Wrist & Co. sells watches online from Chandpur, Bangladesh. Cash on Delivery all over Bangladesh, bKash, Nagad, Rocket or bank transfer, and easy ordering on WhatsApp.',
    scripts: ['js/seo.js', 'js/home.js'], preload: 'images/hero-watch.svg' },
  { file: 'shop.html', current: 'shop', title: 'The Collection | ZENRO Wrist & Co.',
    desc: 'Browse watches by brand and model at ZENRO Wrist & Co. Prices in Taka, Cash on Delivery all over Bangladesh.',
    scripts: ['js/shop.js'] },
  { file: 'product.html', current: 'shop', solid: true, title: 'Watch | ZENRO Wrist & Co.',
    desc: 'Watch details, condition and price in Taka at ZENRO Wrist & Co. Cash on Delivery all over Bangladesh.',
    scripts: ['js/seo.js', 'js/product.js'] },
  { file: 'cart.html', current: 'cart', noindex: true, title: 'Your Cart | ZENRO Wrist & Co.',
    desc: 'Review the watches in your ZENRO Wrist & Co. cart.', scripts: ['js/cart.js'] },
  { file: 'checkout.html', current: 'cart', noindex: true, title: 'Checkout | ZENRO Wrist & Co.',
    desc: 'Checkout at ZENRO Wrist & Co.: Cash on Delivery, bKash, Nagad, Rocket or bank transfer.',
    scripts: ['js/bd-locations.js', 'js/order.js', 'js/payments/provider.js', 'js/payments/manual.js', 'js/checkout.js'] },
  { file: 'order-confirmation.html', current: 'cart', noindex: true, title: 'Send your order | ZENRO Wrist & Co.',
    desc: 'Send your ZENRO Wrist & Co. order to us on WhatsApp.',
    scripts: ['js/bd-locations.js', 'js/order.js', 'js/payments/provider.js', 'js/payments/manual.js', 'js/confirmation.js'] },
  { file: 'about.html', current: 'about', title: 'Our Story | ZENRO Wrist & Co.',
    desc: 'ZENRO Wrist & Co. is an online watch store from Chandpur, Bangladesh, founded in 2026, with Cash on Delivery all over Bangladesh.',
    scripts: [] },
  { file: 'contact.html', current: 'contact', title: 'Contact | ZENRO Wrist & Co.',
    desc: 'Contact ZENRO Wrist & Co. on WhatsApp, Instagram or Facebook. Chandpur, Bangladesh.', scripts: ['js/contact.js'] },
  { file: 'delivery.html', current: 'delivery', title: 'Delivery & Cash on Delivery | ZENRO Wrist & Co.',
    desc: 'Delivery and Cash on Delivery all over Bangladesh with ZENRO Wrist & Co.: charges, payment methods and answers to common questions.',
    scripts: ['js/policies.js'] },
  { file: 'returns.html', current: '', title: 'Returns & Exchange | ZENRO Wrist & Co.',
    desc: 'Returns, exchange and warranty information for watches bought from ZENRO Wrist & Co.', scripts: [] },
  { file: 'privacy.html', current: '', title: 'Privacy | ZENRO Wrist & Co.',
    desc: 'What information ZENRO Wrist & Co. collects at checkout and how it is used.', scripts: ['js/policies.js'] },
  { file: 'terms.html', current: '', title: 'Terms | ZENRO Wrist & Co.',
    desc: 'Terms for ordering watches from ZENRO Wrist & Co.', scripts: [] },
  { file: '404.html', current: '', noindex: true, title: 'Page not found | ZENRO Wrist & Co.',
    desc: 'This page could not be found.', scripts: [] },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const page of PAGES) {
  const current = readFileSync(join(ROOT, page.file), 'utf8');
  const found = current.match(/^[ \t]*<main id="main">[\s\S]*?<\/main>/m);
  if (!found) throw new Error(`${page.file}: no <main id="main">…</main> block found`);
  const main = found[0].trimEnd();
  const cur = (key) => (page.current === key ? ' aria-current="page"' : '');
  const scripts = ['js/config.js', 'js/demo-data.js', 'js/products.js', 'js/main.js', ...page.scripts]
    .map((s) => `  <script src="${s}" defer></script>`).join('\n');
  const url = SITE + (page.file === 'index.html' ? '' : page.file);
  const html = `<!DOCTYPE html>
<html lang="en-BD">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${page.file === 'order-confirmation.html' ? CONFIRMATION_CSP : CSP}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.desc)}">
${page.noindex || DEMO_MODE ? '  <meta name="robots" content="noindex">\n' : ''}  <meta name="theme-color" content="#0b0b0b">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ZENRO Wrist &amp; Co.">
  <meta property="og:locale" content="en_BD">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}images/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="images/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap">
  <link rel="stylesheet" href="css/styles.css">
${page.preload ? `  <link rel="preload" as="image" href="${page.preload}" type="image/svg+xml">\n` : ''}${scripts}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header${page.solid ? ' is-solid' : ''}" data-header${page.solid ? ' data-solid' : ''}>
    <div class="container site-header__inner">
      <a class="logo" href="index.html" aria-label="ZENRO Wrist &amp; Co. home">ZENRO WRIST</a>
      <nav class="site-nav" id="site-nav" aria-label="Primary">
        <ul class="site-nav__list">
          <li><a href="index.html"${cur('home')}>Home</a></li>
          <li class="has-mega" data-mega><a href="shop.html"${cur('shop')}>Collection</a></li>
          <li><a href="about.html"${cur('about')}>Our Story</a></li>
          <li><a href="delivery.html"${cur('delivery')}>Delivery</a></li>
          <li><a href="contact.html"${cur('contact')}>Contact</a></li>
        </ul>
        ${social('social social--nav')}
        <p class="site-nav__meta">Cash on Delivery all over Bangladesh · bKash · Nagad · Rocket · Bank · Order on WhatsApp</p>
      </nav>
      <div class="site-header__actions">
        <a class="cart-link" href="cart.html" aria-label="Cart, 0 items"${cur('cart')} data-cart-link>
          ${ICON.cart}
          <span class="cart-link__count is-empty" data-cart-count aria-hidden="true">0</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
          <span class="visually-hidden">Menu</span>
          <span class="nav-toggle__bar"></span>
          <span class="nav-toggle__bar"></span>
          <span class="nav-toggle__bar"></span>
        </button>
      </div>
    </div>
  </header>

${main}

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="logo" href="index.html" aria-label="ZENRO Wrist &amp; Co. home">ZENRO WRIST</a>
          <p>Watches delivered all over Bangladesh with Cash on Delivery.</p>
          <p class="footer-place">Chandpur, Bangladesh · Est. 2026</p>
          ${social('social')}
        </div>
        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop">Shop</h2>
          <ul class="footer-links" data-footer-brands>
            <li><a href="shop.html">All watches</a></li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-help">
          <h2 id="footer-help">Help</h2>
          <ul class="footer-links">
            <li><a href="delivery.html">Delivery &amp; Cash on Delivery</a></li>
            <li><a href="returns.html">Returns &amp; Exchange</a></li>
            <li><a href="privacy.html">Privacy</a></li>
            <li><a href="terms.html">Terms</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </nav>
        <div>
          <h2>Service</h2>
          <ul class="footer-links">
            <li>Cash on Delivery all over Bangladesh</li>
            <li>bKash · Nagad · Rocket · Bank</li>
            <li><a ${ext(WA)}>Order on WhatsApp</a></li>
            <li hidden><span data-config="warranty" data-config-prefix="Warranty: " data-config-wrap="li"></span></li>
            <li hidden><span data-config="returnPolicy" data-config-prefix="Returns: " data-config-wrap="li"></span></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© <span data-year>2026</span> ZENRO Wrist &amp; Co. All rights reserved.</p>
        <p class="footer-disclaimer">ZENRO Wrist &amp; Co. is an independent seller and is not affiliated with or endorsed by the watch brands listed on this site. Brand names are used only to identify products.</p>
      </div>
    </div>
  </footer>

  <a class="wa-float" ${ext(WA)} aria-label="Chat with ZENRO on WhatsApp">${ICON.whatsapp}</a>
</body>
</html>
`;
  writeFileSync(join(ROOT, page.file), html);
  console.log('stamped', page.file);
}

/* ---------- sitemap.xml and robots.txt ---------- */
const { BRANDS, MODELS, PRODUCTS } = loadScript('js/products.js', ['BRANDS', 'MODELS', 'PRODUCTS']);
const urls = [
  '', 'shop.html', 'about.html', 'contact.html', 'delivery.html', 'returns.html', 'privacy.html', 'terms.html',
  ...BRANDS.map((b) => `shop.html?brand=${b.slug}`),
  ...MODELS.map((m) => `shop.html?brand=${m.brand}&model=${m.slug}`),
  ...PRODUCTS.map((p) => `product.html?id=${p.id}`),
];
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by tools/stamp.mjs from js/config.js (siteUrl) and js/products.js. Do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xmlEsc(SITE + u)}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(ROOT, 'robots.txt'), `# ZENRO Wrist & Co. (generated by tools/stamp.mjs)
# Cart, checkout and order confirmation pages carry <meta name="robots" content="noindex">.
# They are not blocked here so search engines can read that noindex tag.
User-agent: *
Allow: /

Sitemap: ${SITE}sitemap.xml
`);
console.log(`wrote sitemap.xml (${urls.length} URLs) and robots.txt for ${SITE}`);
