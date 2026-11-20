/**
 * ZENRO Wrist & Co. — product catalogue.
 * Single source of truth: every page builds its product views from the helpers at the
 * bottom of this file. To add a watch, add one object to PRODUCTS (see README.md).
 *
 * Structure: BRANDS -> MODELS (sub-branches) -> PRODUCTS (individual watches).
 *  - slugs and ids: lowercase letters, digits and hyphens only (they are used in URLs)
 *  - price: whole Taka (BDT) number, or null to show "Ask for price"
 *  - any text still set to 'TODO_OWNER' is hidden on the site
 *
 * Brand names are plain text only. Do not add any brand's logo or emblem artwork.
 */
'use strict';

const BRANDS = Object.freeze([
  { slug: 'rolex', name: 'Rolex', order: 1, intro: 'TODO_OWNER' },
  { slug: 'patek-philippe', name: 'Patek Philippe', order: 2, intro: 'TODO_OWNER' },
  { slug: 'omega', name: 'Omega', order: 3, intro: 'TODO_OWNER' },
  { slug: 'jacob-and-co', name: 'Jacob & Co.', order: 4, intro: 'TODO_OWNER' },
].map(Object.freeze));

const MODELS = Object.freeze([
  { slug: 'datejust', brand: 'rolex', name: 'Datejust' },
  { slug: 'day-date', brand: 'rolex', name: 'Day-Date' },
  { slug: 'land-dweller', brand: 'rolex', name: 'Land-Dweller' },
  { slug: 'cubitus', brand: 'patek-philippe', name: 'Cubitus' },
  { slug: 'grand-complications', brand: 'patek-philippe', name: 'Grand Complications' },
  { slug: 'aqua-terra', brand: 'omega', name: 'Aqua Terra' },
  { slug: 'godfather', brand: 'jacob-and-co', name: 'Godfather' },
].map(Object.freeze));

/** Every spec key the product page knows how to show, with its label. Null values are skipped. */
const SPEC_LABELS = Object.freeze({
  caseSize: 'Case size',
  caseMaterial: 'Case',
  movement: 'Movement',
  dial: 'Dial',
  strap: 'Strap',
  waterResistance: 'Water resistance',
  crystal: 'Crystal',
});

const NO_SPECS = { caseSize: null, caseMaterial: null, movement: null, dial: null, strap: null, waterResistance: null, crystal: null };

const PRODUCTS = Object.freeze([
  {
    id: 'rolex-datejust-01',
    brand: 'rolex',
    model: 'datejust',
    name: 'Rolex Datejust',
    variant: 'TODO_OWNER', // e.g. dial colour / bracelet
    price: null, // BDT whole number, null = "Ask for price"
    compareAtPrice: null, // optional old price, shows a "Sale" badge when higher than price
    inStock: true,
    featured: true,
    condition: 'TODO_OWNER', // must be one of STORE_CONFIG.conditions
    images: [], // e.g. ['images/products/rolex/datejust/rolex-datejust-01-1.webp'] (see tools/optimise-images.mjs)
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/p/DfjYDzVskxG/',
    description: 'A statement of class and a symbol of prestige.',
    specs: { ...NO_SPECS },
  },
  {
    // Instagram shows several dial colours. Split this into one entry per colour
    // (rolex-datejust-02, -03, ...) once the photos and colour names are supplied.
    id: 'rolex-datejust-collection',
    brand: 'rolex',
    model: 'datejust',
    name: 'Rolex Datejust Collection',
    variant: 'TODO_OWNER',
    price: null,
    compareAtPrice: null,
    inStock: true,
    featured: false,
    condition: 'TODO_OWNER',
    images: [],
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/p/Dfjmsn1h0DN/',
    description: 'The Datejust in a range of dial colours. Ask us on WhatsApp which colours are available.',
    specs: { ...NO_SPECS },
  },
  {
    id: 'rolex-day-date-stone-01',
    brand: 'rolex',
    model: 'day-date',
    name: 'Rolex Day-Date Stone Edition',
    variant: 'TODO_OWNER',
    price: null,
    compareAtPrice: null,
    inStock: true,
    featured: false,
    condition: 'TODO_OWNER',
    images: [],
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/p/Dfj4a8kmueR/',
    description: 'The Day-Date in a stone-set edition.',
    specs: { ...NO_SPECS },
  },
  {
    id: 'rolex-land-dweller-01',
    brand: 'rolex',
    model: 'land-dweller',
    name: 'Rolex Land-Dweller',
    variant: 'TODO_OWNER',
    price: null,
    compareAtPrice: null,
    inStock: true,
    featured: false,
    condition: 'TODO_OWNER',
    images: [],
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/reel/Df2DFCHuXDY/',
    description: 'The Land-Dweller, as shown in our Instagram reel.',
    specs: { ...NO_SPECS },
  },
  {
    id: 'patek-philippe-cubitus-01',
    brand: 'patek-philippe',
    model: 'cubitus',
    name: 'Patek Philippe Cubitus',
    variant: 'TODO_OWNER',
    price: null,
    compareAtPrice: null,
    inStock: true,
    featured: false,
    condition: 'TODO_OWNER',
    images: [],
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/reel/DfzSd0FhTpn/',
    description: 'Bold geometry in a sporty square case.',
    specs: { ...NO_SPECS },
  },
  {
    id: 'patek-philippe-grand-complications-01',
    brand: 'patek-philippe',
    model: 'grand-complications',
    name: 'Patek Philippe Grand Complications',
    variant: 'Black dial, rose gold finish',
    price: null,
    compareAtPrice: null,
    inStock: true,
    featured: true,
    condition: 'TODO_OWNER',
    images: [],
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/p/DfeP9FeGtnO/',
    description:
      'A black guilloché dial with rose gold markers, a 24-hour day/night subdial, a small seconds subdial and two open-heart apertures. The rose gold finished case has a Clous de Paris bezel and sits on a black croc-embossed leather strap with contrast stitching.',
    specs: {
      ...NO_SPECS,
      caseMaterial: 'Rose gold finish, Clous de Paris bezel',
      dial: 'Black guilloché, rose gold markers, 24-hour day/night and small seconds subdials, dual open-heart apertures',
      strap: 'Black croc-embossed leather with contrast stitching',
    },
  },
  {
    id: 'omega-aqua-terra-automatic-01',
    brand: 'omega',
    model: 'aqua-terra',
    name: 'Omega Aqua Terra Automatic',
    variant: 'TODO_OWNER',
    price: null,
    compareAtPrice: null,
    inStock: true,
    featured: false,
    condition: 'TODO_OWNER',
    images: [],
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/reel/Dfw6ZtQvRkL/',
    description: 'The Aqua Terra Automatic on a premium rubber strap.',
    specs: { ...NO_SPECS, strap: 'Premium rubber' },
  },
  {
    id: 'jacob-and-co-godfather-01',
    brand: 'jacob-and-co',
    model: 'godfather',
    name: 'Jacob & Co. Godfather',
    variant: 'Black theme',
    price: null,
    compareAtPrice: null,
    inStock: true,
    featured: true,
    condition: 'TODO_OWNER',
    images: [],
    instagramUrl: 'https://www.instagram.com/zenro_wrist_co/p/DfmsaP_mvai/',
    description: 'The Godfather in an all-black theme.',
    specs: { ...NO_SPECS },
  },
].map((p) => Object.freeze({ ...p, images: Object.freeze([...p.images]), specs: Object.freeze({ ...p.specs }) })));

/* ==========================================================================
   Helpers: every page reads the catalogue through these functions only.
   ========================================================================== */

/** Slugs and product ids: lowercase letters, digits and hyphens. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_RE = SLUG_RE;
/** Product photos must live in images/products/<brand>/<model>/ and be WebP. */
const PRODUCT_IMAGE_RE = /^images\/products\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/;
const INSTAGRAM_PREFIX = 'https://www.instagram.com/zenro_wrist_co/';

function isValidSlug(value) {
  return typeof value === 'string' && value.length <= 60 && SLUG_RE.test(value);
}

/** True when a value has been filled in (not null, empty or 'TODO_OWNER'). */
function isSet(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== 'TODO_OWNER';
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

/** Price as a whole positive number of Taka, or null. */
function priceOf(product) {
  const p = product && product.price;
  return Number.isInteger(p) && p > 0 ? p : null;
}

/** ৳1,25,000 style (Indian/Bangladeshi lakh grouping, no decimals). Returns '' for missing values. */
function formatBDT(amount) {
  const n = Number(amount);
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(n)) return '';
  return `৳${Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function getProducts({ brand, model } = {}) {
  return PRODUCTS.filter((p) => (!brand || p.brand === brand) && (!model || p.model === model));
}

function getProduct(id) {
  if (!isValidSlug(id)) return null;
  return PRODUCTS.find((p) => p.id === id) || null;
}

function getBrand(slug) {
  if (!isValidSlug(slug)) return null;
  return BRANDS.find((b) => b.slug === slug) || null;
}

/** All brands, sorted by `order`, each with its product count. */
function getBrands() {
  return [...BRANDS]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((b) => ({ ...b, count: getProducts({ brand: b.slug }).length }));
}

/** Models of one brand (or every model), each with its product count, in data order. */
function getModels(brandSlug) {
  return MODELS.filter((m) => !brandSlug || m.brand === brandSlug).map((m) => ({
    ...m,
    count: getProducts({ brand: m.brand, model: m.slug }).length,
  }));
}

function getModel(brandSlug, modelSlug) {
  if (!isValidSlug(brandSlug) || !isValidSlug(modelSlug)) return null;
  return MODELS.find((m) => m.brand === brandSlug && m.slug === modelSlug) || null;
}

/** Validated image paths of a product. */
function productImages(product) {
  return (product.images || []).filter((src) => typeof src === 'string' && PRODUCT_IMAGE_RE.test(src));
}

/** src + srcset for one product photo (the 600px file sits next to the 1200px one as <name>-600.webp). */
function productImageSet(src) {
  const small = src.replace(/\.webp$/, '-600.webp');
  return { src, srcset: `${small} 600w, ${src} 1200w` };
}

function instagramUrlOf(product) {
  const url = product.instagramUrl;
  return typeof url === 'string' && url.startsWith(INSTAGRAM_PREFIX) && !/[\s"'<>]/.test(url) ? url : null;
}

/* Catalogue sanity check, only while developing on this computer. */
if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  const ids = new Set();
  PRODUCTS.forEach((p) => {
    if (!isValidSlug(p.id) || ids.has(p.id)) console.warn(`products.js: invalid or duplicate id "${p.id}"`);
    ids.add(p.id);
    if (!getModel(p.brand, p.model)) console.warn(`products.js: ${p.id} has an unknown brand/model`);
    (p.images || []).forEach((src) => {
      if (!PRODUCT_IMAGE_RE.test(src)) console.warn(`products.js: ${p.id} image path "${src}" is not allowed`);
    });
  });
  MODELS.forEach((m) => {
    if (!getBrand(m.brand)) console.warn(`products.js: model ${m.slug} has unknown brand ${m.brand}`);
  });
}
