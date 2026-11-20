/**
 * ZENRO Wrist & Co. — shared site behaviour.
 * Navigation (collection mega menu, mobile menu), cart storage, config binding,
 * scroll reveal, toasts, form helpers and the product-card builder.
 *
 * Security notes:
 *  - The DOM is always built with createElement + textContent; innerHTML is never
 *    used, so neither product data nor user input can inject markup.
 *  - Cart data read back from localStorage is validated against the catalogue and
 *    prices are always taken from js/products.js, never from storage.
 */
'use strict';

const ZW = (() => {
  const CFG = STORE_CONFIG;
  const WA_NUMBER = /^\d{10,15}$/.test(CFG.whatsapp) ? CFG.whatsapp : '';

  /* ---------- DOM builder (safe: text is always set via textContent) ---------- */
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child); // strings become text nodes, never HTML
    }
    return node;
  }

  function svgIcon(pathData, className = '') {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.4');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (className) svg.setAttribute('class', className);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
    return svg;
  }

  const ICONS = {
    whatsapp: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.2A8 8 0 1 1 20 12z',
    truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zM9 12l2 2 4-4',
    returns: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
    camera: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01',
  };

  /* ---------- Input sanitising & validation ---------- */
  // Control characters, zero-width and bidi-override characters (built from code points
  // so the source file contains no invisible characters).
  const CONTROL_CHARS = new RegExp(
    `[${[[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]]
      .map(([a, b]) => `\\u${a.toString(16).padStart(4, '0')}-\\u${b.toString(16).padStart(4, '0')}`)
      .join('')}]`,
    'g'
  );

  /** Single-line text: strips control/invisible chars and angle brackets, collapses whitespace. */
  function sanitizeLine(value, maxLength = 120) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(CONTROL_CHARS, '')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  /** Multi-line text: like sanitizeLine but keeps (at most two) line breaks. */
  function sanitizeMultiline(value, maxLength = 1000) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL_CHARS, '')
      .replace(/[<>]/g, '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, maxLength);
  }

  const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

  function sanitizeEmail(value) {
    return String(value ?? '').normalize('NFKC').replace(CONTROL_CHARS, '').replace(/\s+/g, '').toLowerCase().slice(0, 254);
  }

  function isValidEmail(email) {
    if (!email || email.length > 254) return false;
    const [local] = email.split('@');
    if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
    return EMAIL_RE.test(email);
  }

  /** Bangladeshi mobile: removes spaces/dashes/brackets, converts Bangla digits, strips +88 / 88. */
  function normalizeBDMobile(value) {
    let v = String(value ?? '')
      .normalize('NFKC')
      .replace(CONTROL_CHARS, '')
      .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
      .replace(/[\s\-().]/g, '');
    if (v.startsWith('+88')) v = v.slice(3);
    else if (v.startsWith('88')) v = v.slice(2);
    return v.slice(0, 20);
  }

  const BD_MOBILE_RE = /^01[3-9]\d{8}$/;
  function isValidBDMobile(normalized) {
    return BD_MOBILE_RE.test(normalized);
  }

  /** Shows (or clears) an inline error for a field; returns true when valid. */
  function setFieldError(input, message) {
    const errorEl = document.getElementById(`${input.id}-error`);
    if (errorEl) errorEl.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !message;
  }

  /* ---------- WhatsApp ---------- */
  function waLink(text) {
    const base = `https://wa.me/${WA_NUMBER}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
  }

  function externalLink(href, text, className) {
    return el('a', { href, class: className, target: '_blank', rel: 'noopener noreferrer', text });
  }

  function askOnWhatsApp(question) {
    return externalLink(waLink(question || 'Hi ZENRO Wrist & Co., I have a question.'), 'Ask us on WhatsApp', 'ask-wa');
  }

  /** Absolute URL of a page on this site (works locally and on GitHub Pages). */
  function absoluteUrl(path) {
    return new URL(path, window.location.href).href;
  }

  /* ---------- Store rules from config ---------- */
  /** Delivery charge in Taka for 'inside' | 'outside' Dhaka, or null when not configured. */
  function deliveryCharge(zone) {
    const key = zone === 'inside' ? 'insideDhaka' : zone === 'outside' ? 'outsideDhaka' : null;
    const v = key ? CFG.delivery[key] : null;
    return Number.isInteger(v) && v >= 0 ? v : null;
  }

  function conditionOf(product) {
    return isSet(product.condition) && CFG.conditions.includes(product.condition) ? product.condition : null;
  }

  function isBuyable(product) {
    return !!product && product.inStock === true && priceOf(product) !== null;
  }

  /* ---------- Cart (localStorage) ---------- */
  const CART_KEY = 'zenro-cart-v1';
  const MAX_QTY = 10;
  try {
    localStorage.removeItem('orvane-cart-v1'); // left over from the old demo
  } catch {
    /* storage blocked */
  }

  function clampQty(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(MAX_QTY, n);
  }

  /** Reads the cart and re-validates every entry against the catalogue. */
  function readCart() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    const merged = new Map();
    for (const item of raw.slice(0, 50)) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue;
      const product = getProduct(item.id);
      if (!isBuyable(product)) continue; // unknown, sold out or no price: drop it
      const qty = item.qty;
      if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) continue;
      merged.set(product.id, Math.min(MAX_QTY, (merged.get(product.id) || 0) + qty));
    }
    return [...merged].map(([id, qty]) => ({ id, qty }));
  }

  function writeCart(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* storage full or blocked (e.g. private mode) — cart stays in memory for this view */
    }
    updateCartBadge(true);
    document.dispatchEvent(new CustomEvent('cart:change'));
  }

  const Cart = {
    MAX_QTY,
    items: readCart,
    count() {
      return readCart().reduce((sum, item) => sum + item.qty, 0);
    },
    /** Always recomputed from js/products.js. */
    subtotal() {
      return readCart().reduce((sum, item) => sum + priceOf(getProduct(item.id)) * item.qty, 0);
    },
    /** Adds qty of a product; returns the quantity actually added (0 if not allowed). */
    add(id, qty = 1) {
      const product = getProduct(id);
      if (!isBuyable(product)) return 0;
      const items = readCart();
      const existing = items.find((i) => i.id === product.id);
      const current = existing ? existing.qty : 0;
      const next = Math.min(MAX_QTY, current + clampQty(qty));
      if (existing) existing.qty = next;
      else items.push({ id: product.id, qty: next });
      writeCart(items);
      return next - current;
    },
    setQty(id, qty) {
      const items = readCart();
      const item = items.find((i) => i.id === id);
      if (!item) return;
      item.qty = clampQty(qty);
      writeCart(items);
    },
    remove(id) {
      writeCart(readCart().filter((i) => i.id !== id));
    },
    clear() {
      writeCart([]);
    },
  };

  function updateCartBadge(animate = false) {
    const count = Cart.count();
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('is-empty', count === 0);
      if (animate && count > 0) {
        badge.classList.remove('is-bumped');
        void badge.offsetWidth; // restart the animation
        badge.classList.add('is-bumped');
      }
    });
    document.querySelectorAll('[data-cart-link]').forEach((link) => {
      link.setAttribute('aria-label', `Cart, ${count} ${count === 1 ? 'item' : 'items'}`);
    });
  }

  /* ---------- Toasts ---------- */
  let toastRegion;
  function toast(message, link) {
    if (!toastRegion) {
      toastRegion = el('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
      document.body.append(toastRegion);
    }
    toastRegion.replaceChildren();
    const node = el('div', { class: 'toast' }, [
      el('span', { text: message }),
      link ? el('a', { href: link.href, text: link.label }) : null,
    ]);
    toastRegion.append(node);
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 400);
    }, 4500);
  }

  /* ---------- Product media, price and badges ---------- */
  function productHref(product) {
    return `product.html?id=${encodeURIComponent(product.id)}`;
  }

  function imageAlt(product, index) {
    const variant = isSet(product.variant) ? `, ${product.variant}` : '';
    return index === 0 ? `${product.name}${variant}, front view` : `${product.name}${variant}, view ${index + 1}`;
  }

  /** Neutral stand-in until a real photo exists: dark card with the ZENRO monogram and the product name. */
  function placeholder(product) {
    return el('div', { class: 'ph', role: 'img', 'aria-label': `${product.name}, photo coming soon` }, [
      el('span', { class: 'ph__mark', 'aria-hidden': 'true', text: 'ZENRO' }),
      el('span', { class: 'ph__name', 'aria-hidden': 'true', text: product.name }),
    ]);
  }

  /** Photo n of a product (responsive srcset), or the placeholder. */
  function productMedia(product, { index = 0, sizes = '(min-width: 760px) 33vw, (min-width: 640px) 50vw, 100vw', eager = false } = {}) {
    const images = productImages(product);
    if (!images[index]) return placeholder(product);
    const { src, srcset } = productImageSet(images[index]);
    return el('img', {
      src,
      srcset,
      sizes,
      width: 1200,
      height: 1500,
      alt: imageAlt(product, index),
      loading: eager ? null : 'lazy',
      decoding: 'async',
      fetchpriority: eager ? 'high' : null,
    });
  }

  function productBadges(product) {
    const badges = [];
    const price = priceOf(product);
    if (!product.inStock) badges.push({ text: 'Sold out', kind: 'soldout' });
    else if (price && Number.isInteger(product.compareAtPrice) && product.compareAtPrice > price) badges.push({ text: 'Sale', kind: 'sale' });
    const condition = conditionOf(product);
    if (condition) badges.push({ text: condition, kind: 'condition' });
    return badges;
  }

  function badgeList(product, className = 'badges') {
    const badges = productBadges(product);
    if (!badges.length) return null;
    return el('ul', { class: className, 'aria-label': 'Labels' },
      badges.map((b) => el('li', { class: `badge badge--${b.kind}`, text: b.text })));
  }

  /** Price element: "৳1,25,000" (with the old price struck through when on sale) or "Ask for price". */
  function priceNode(product, className) {
    const price = priceOf(product);
    if (price === null) return el('p', { class: `${className} is-ask`, text: 'Ask for price' });
    const parts = [formatBDT(price)];
    if (Number.isInteger(product.compareAtPrice) && product.compareAtPrice > price) {
      parts.push(' ', el('s', {}, [el('span', { class: 'visually-hidden', text: 'was ' }), formatBDT(product.compareAtPrice)]));
    }
    return el('p', { class: className }, parts);
  }

  function modelLabel(product) {
    const brand = getBrand(product.brand);
    const model = getModel(product.brand, product.model);
    return [brand && brand.name, model && model.name].filter(Boolean).join(' · ');
  }

  function productCard(product, { headingLevel = 'h3' } = {}) {
    const href = productHref(product);
    return el('article', { class: 'product-card reveal' }, [
      el('a', { class: 'product-card__media', href, tabindex: '-1', 'aria-hidden': 'true' }, productMedia(product)),
      el('div', { class: 'product-card__body' }, [
        el('p', { class: 'product-card__cat', text: modelLabel(product) }),
        el(headingLevel, { class: 'product-card__title' }, el('a', { href, text: product.name })),
        isSet(product.variant) ? el('p', { class: 'product-card__tagline', text: product.variant }) : null,
        badgeList(product, 'badges product-card__badges'),
        el('div', { class: 'product-card__footer' }, [
          priceNode(product, 'product-card__price'),
          el('a', { class: 'btn btn--outline', href, 'aria-label': `View ${product.name}`, text: 'View' }),
        ]),
      ]),
    ]);
  }

  /* ---------- Config binding ----------
   * <span data-config="warranty" data-config-prefix="Warranty: " data-config-wrap="li" data-fallback="hide">
   * fills the element from STORE_CONFIG, or hides it (or shows "Ask us on WhatsApp") when unset. */
  function configValue(path) {
    return path.split('.').reduce((obj, key) => (obj && Object.hasOwn(obj, key) ? obj[key] : undefined), CFG);
  }

  function bindConfig(root = document) {
    root.querySelectorAll('[data-config]').forEach((node) => {
      const path = node.dataset.config || '';
      if (!/^[A-Za-z]+(\.[A-Za-z]+)*$/.test(path)) return;
      const raw = configValue(path);
      let value = null;
      if (node.dataset.configFormat === 'bdt') value = Number.isInteger(raw) && raw >= 0 ? formatBDT(raw) : null;
      else if (typeof raw === 'string' && isSet(raw)) value = sanitizeMultiline(raw, 2000);
      const wrap = node.dataset.configWrap ? node.closest(node.dataset.configWrap) : node;
      if (value) {
        node.textContent = (node.dataset.configPrefix || '') + value;
        node.hidden = false;
        if (wrap) wrap.hidden = false;
      } else if (node.dataset.fallback === 'whatsapp') {
        node.replaceChildren(askOnWhatsApp(node.dataset.configAsk));
        node.hidden = false;
        if (wrap) wrap.hidden = false;
      } else if (wrap) {
        wrap.hidden = true;
      }
    });
  }

  /* ---------- Collection mega menu (desktop) / accordion (mobile) ---------- */
  function countBadge(n) {
    return el('span', { class: 'count' }, [String(n), el('span', { class: 'visually-hidden', text: n === 1 ? ' watch' : ' watches' })]);
  }

  function buildCollectionMenu(desktop) {
    const host = document.querySelector('[data-mega]');
    if (!host) return;

    const brandItems = getBrands().map((brand) => {
      const listId = `mega-${brand.slug}`;
      const models = el('ul', { class: 'mega__models', id: listId, 'data-collapsed': true },
        getModels(brand.slug).map((m) =>
          el('li', {}, el('a', { href: `shop.html?brand=${brand.slug}&model=${m.slug}` }, [m.name, ' ', countBadge(m.count)]))
        ));
      const acc = el('button', { type: 'button', class: 'mega__acc', 'aria-expanded': 'false', 'aria-controls': listId },
        el('span', { class: 'visually-hidden', text: `${brand.name} models` }));
      acc.addEventListener('click', () => {
        const open = acc.getAttribute('aria-expanded') !== 'true';
        acc.setAttribute('aria-expanded', String(open));
        models.toggleAttribute('data-collapsed', !open);
      });
      return el('li', { class: 'mega__brand' }, [
        el('div', { class: 'mega__head' }, [
          el('a', { class: 'mega__brand-link', href: `shop.html?brand=${brand.slug}` }, [brand.name, ' ', countBadge(brand.count)]),
          acc,
        ]),
        models,
      ]);
    });

    const panel = el('div', { class: 'mega', id: 'mega-panel', hidden: true },
      el('div', { class: 'mega__inner' }, [
        el('a', { class: 'mega__all', href: 'shop.html' }, ['All watches ', countBadge(PRODUCTS.length)]),
        el('ul', { class: 'mega__brands' }, brandItems),
      ]));
    const trigger = el('button', { type: 'button', class: 'mega-toggle', 'aria-expanded': 'false', 'aria-controls': 'mega-panel' },
      el('span', { class: 'visually-hidden', text: 'Brands and models' }));
    host.append(trigger, panel);

    const setMega = (open, { focusTrigger = false } = {}) => {
      trigger.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      host.classList.toggle('is-open', open);
      if (!open && focusTrigger) trigger.focus();
    };
    trigger.addEventListener('click', () => setMega(panel.hidden));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden && desktop.matches) setMega(false, { focusTrigger: true });
    });
    document.addEventListener('click', (e) => {
      if (desktop.matches && !panel.hidden && !host.contains(e.target)) setMega(false);
    });
    host.addEventListener('focusout', (e) => {
      if (desktop.matches && e.relatedTarget && !host.contains(e.relatedTarget)) setMega(false);
    });
    desktop.addEventListener('change', () => setMega(false));
  }

  function fillFooterBrands() {
    document.querySelectorAll('[data-footer-brands]').forEach((list) => {
      const items = getBrands().map((b) => el('li', {}, el('a', { href: `shop.html?brand=${b.slug}`, text: b.name })));
      list.prepend(...items);
    });
  }

  /* ---------- Scroll reveal ---------- */
  let revealObserver;
  function observeReveals(root = document) {
    const targets = root.querySelectorAll('.reveal:not(.is-visible)');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('is-visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
    }
    targets.forEach((t) => revealObserver.observe(t));
  }

  /** Staggers reveal animations for a group of sibling elements. */
  function stagger(nodes, step = 0.1) {
    nodes.forEach((node, i) => node.style.setProperty('--reveal-delay', `${(i % 3) * step}s`));
  }

  /* ---------- Header & navigation ---------- */
  function initHeader(desktop) {
    const header = document.querySelector('[data-header]');
    if (!header) return;
    const toggle = header.querySelector('[data-nav-toggle]');
    const nav = header.querySelector('.site-nav');
    const alwaysSolid = header.hasAttribute('data-solid'); // pages without a dark hero

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle('is-solid', alwaysSolid || window.scrollY > 24);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (!toggle || !nav) return;

    const setOpen = (open, { returnFocus = false } = {}) => {
      header.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.visually-hidden').textContent = open ? 'Close menu' : 'Menu';
      if (open) {
        const first = nav.querySelector('a');
        if (first) first.focus();
      } else if (returnFocus) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) setOpen(false, { returnFocus: true });
    });
    // Keep keyboard focus inside the open mobile menu
    header.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !header.classList.contains('is-open')) return;
      const focusables = [...header.querySelectorAll('a[href], button:not([disabled])')].filter(
        (n) => n.offsetParent !== null
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    desktop.addEventListener('change', (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ---------- Boot ---------- */
  function init() {
    const desktop = window.matchMedia('(min-width: 900px)');
    buildCollectionMenu(desktop);
    initHeader(desktop);
    fillFooterBrands();
    bindConfig();
    updateCartBadge();
    document.querySelectorAll('[data-year]').forEach((n) => {
      n.textContent = String(new Date().getFullYear());
    });
    observeReveals();
    // Keep the badge in sync when the cart changes in another tab
    window.addEventListener('storage', (e) => {
      if (e.key === CART_KEY) {
        updateCartBadge();
        document.dispatchEvent(new CustomEvent('cart:change'));
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    CFG,
    ICONS,
    el,
    svgIcon,
    sanitizeLine,
    sanitizeMultiline,
    sanitizeEmail,
    isValidEmail,
    normalizeBDMobile,
    isValidBDMobile,
    setFieldError,
    waLink,
    externalLink,
    askOnWhatsApp,
    absoluteUrl,
    deliveryCharge,
    conditionOf,
    isBuyable,
    Cart,
    clampQty,
    toast,
    productHref,
    productMedia,
    placeholder,
    badgeList,
    priceNode,
    modelLabel,
    productCard,
    countBadge,
    bindConfig,
    observeReveals,
    stagger,
  };
})();
