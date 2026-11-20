/**
 * ZENRO Wrist & Co. — demo mode tests
 * -----------------------------------
 *   npm test          (or: node tools/test-demo.mjs)
 *
 * Loads js/config.js, js/demo-data.js and js/products.js the way a page does (one shared
 * global scope) and checks that:
 *  - with demoMode: false, js/demo-data.js has no effect at all
 *  - with demoMode: true, sample values fill only the settings that are still unset,
 *    a real value always wins, and nothing is written into the real settings
 *  - every page loads js/demo-data.js after js/config.js and before js/products.js
 * No dependencies: plain Node (18 or newer).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(ROOT, file), 'utf8');

/** Runs the scripts in one context (like <script> tags on a page) and returns the named globals. */
function load({ demoMode, withDemoFile = true, edit = (s) => s, editProducts = (s) => s }) {
  let config = read('js/config.js');
  assert.match(config, /demoMode: (true|false),/, 'js/config.js must contain demoMode: true or false');
  config = edit(config.replace(/demoMode: (true|false),/, `demoMode: ${demoMode},`));
  const context = vm.createContext({ console });
  vm.runInContext(config, context, { filename: 'config.js' });
  if (withDemoFile) vm.runInContext(read('js/demo-data.js'), context, { filename: 'demo-data.js' });
  vm.runInContext(editProducts(read('js/products.js')), context, { filename: 'products.js' });
  return vm.runInContext(
    `({ STORE_CONFIG, PRODUCTS, priceOf, isDemoPrice, DEMO: typeof DEMO === 'undefined' ? undefined : DEMO })`,
    context
  );
}

const SAMPLE_PRICES = {
  'rolex-datejust-01': 6500,
  'rolex-datejust-collection': 6500,
  'rolex-day-date-stone-01': 8500,
  'rolex-land-dweller-01': 7500,
  'patek-philippe-cubitus-01': 7000,
  'patek-philippe-grand-complications-01': 9500,
  'omega-aqua-terra-automatic-01': 5500,
  'jacob-and-co-godfather-01': 12500,
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ---------- demoMode: false ---------- */
test('demoMode false: DEMO is inactive and its config is STORE_CONFIG itself', () => {
  const g = load({ demoMode: false });
  assert.equal(g.DEMO.active, false);
  assert.equal(g.DEMO.config, g.STORE_CONFIG);
  assert.equal(g.DEMO.isDemo('payments.bkash'), false);
  assert.equal(g.DEMO.isDemo('delivery.insideDhaka'), false);
  g.PRODUCTS.forEach((p) => assert.equal(g.DEMO.condition(p), null));
});

test('demoMode false: prices are exactly what they are without demo-data.js', () => {
  const off = load({ demoMode: false });
  const none = load({ demoMode: false, withDemoFile: false });
  off.PRODUCTS.forEach((p, i) => {
    assert.equal(off.priceOf(p), none.priceOf(none.PRODUCTS[i]), p.id);
    assert.equal(off.isDemoPrice(p), false, p.id);
  });
});

test('demoMode false: no sample value appears anywhere in the config', () => {
  const g = load({ demoMode: false });
  const json = JSON.stringify(g.DEMO.config);
  ['01XXXXXXXXX', 'Demo Bank', 'Sample listing'].forEach((s) => assert.ok(!json.includes(s), s));
});

/* ---------- demoMode: true ---------- */
test('demoMode true: sample prices for every product without a real price', () => {
  const g = load({ demoMode: true });
  assert.equal(g.DEMO.active, true);
  g.PRODUCTS.forEach((p) => {
    assert.equal(p.price, null, `${p.id} has a real price; update this test`);
    assert.equal(g.priceOf(p), SAMPLE_PRICES[p.id], p.id);
    assert.equal(g.isDemoPrice(p), true, p.id);
  });
});

test('demoMode true: sample delivery, COD and payment details fill the unset settings', () => {
  const { DEMO } = load({ demoMode: true });
  const c = DEMO.config;
  assert.equal(c.delivery.insideDhaka, 80);
  assert.equal(c.delivery.outsideDhaka, 150);
  assert.equal(c.delivery.estimatedDays, '2 to 4 days');
  assert.equal(c.cod.advanceRequired, 'deliveryCharge');
  assert.deepEqual([c.payments.bkash.number, c.payments.bkash.accountType], ['01XXXXXXXXX', 'Merchant']);
  assert.deepEqual([c.payments.nagad.number, c.payments.nagad.accountType], ['01XXXXXXXXX', 'Personal']);
  assert.deepEqual([c.payments.rocket.number, c.payments.rocket.accountType], ['01XXXXXXXXX', 'Personal']);
  assert.equal(c.payments.bank.bankName, 'Demo Bank Ltd');
  assert.equal(c.payments.bank.accountName, 'ZENRO Wrist & Co. (demo)');
  assert.equal(c.payments.bank.accountNumber, '0000000000000');
  ['payments.bkash', 'payments.nagad', 'payments.rocket', 'payments.bank', 'delivery.insideDhaka', 'cod.advanceRequired']
    .forEach((path) => assert.equal(DEMO.isDemo(path), true, path));
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.payments.bkash));
});

test('demoMode true: the real settings object is left untouched', () => {
  const g = load({ demoMode: true });
  assert.notEqual(g.DEMO.config, g.STORE_CONFIG);
  assert.equal(g.STORE_CONFIG.delivery.insideDhaka, 'TODO_OWNER');
  assert.equal(g.STORE_CONFIG.payments.bkash.number, 'TODO_OWNER');
  assert.equal(g.STORE_CONFIG.cod.advanceRequired, 'TODO_OWNER');
  assert.equal(g.PRODUCTS[0].price, null);
});

test('demoMode true: a real value always wins over a demo value', () => {
  const g = load({
    demoMode: true,
    edit: (s) => s
      .replace("insideDhaka: 'TODO_OWNER'", 'insideDhaka: 100')
      .replace("cod: { enabled: true, advanceRequired: 'TODO_OWNER' }", 'cod: { enabled: true, advanceRequired: 0 }')
      .replace("bkash: { enabled: true, number: 'TODO_OWNER', accountType: 'TODO_OWNER' }", "bkash: { enabled: true, number: '01712345678', accountType: 'TODO_OWNER' }"),
    editProducts: (s) => s.replace("name: 'Rolex Datejust',\n    variant: 'TODO_OWNER', // e.g. dial colour / bracelet\n    price: null,", "name: 'Rolex Datejust',\n    variant: 'TODO_OWNER', // e.g. dial colour / bracelet\n    price: 9999,"),
  });
  const c = g.DEMO.config;
  assert.equal(c.delivery.insideDhaka, 100);
  assert.equal(g.DEMO.isDemo('delivery.insideDhaka'), false);
  assert.equal(c.delivery.outsideDhaka, 150);
  assert.equal(c.cod.advanceRequired, 0, 'a real 0 is a value, not "unset"');
  // A real number is never paired with a made-up account type.
  assert.equal(c.payments.bkash.number, '01712345678');
  assert.equal(c.payments.bkash.accountType, 'TODO_OWNER');
  assert.equal(g.DEMO.isDemo('payments.bkash'), false);
  const datejust = g.PRODUCTS.find((p) => p.id === 'rolex-datejust-01');
  assert.equal(datejust.price, 9999, 'test setup: real price was not applied');
  assert.equal(g.priceOf(datejust), 9999);
  assert.equal(g.isDemoPrice(datejust), false);
});

test('demoMode true: sample condition only for products without their own condition', () => {
  const { DEMO, PRODUCTS } = load({ demoMode: true });
  assert.equal(DEMO.condition(PRODUCTS[0]), 'Sample listing');
  assert.equal(DEMO.condition({ ...PRODUCTS[0], condition: 'Pre-owned' }), null);
});

/* ---------- Pages ---------- */
test('every page loads demo-data.js after config.js and before products.js', () => {
  const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length > 5);
  pages.forEach((page) => {
    const html = read(page);
    const at = (src) => html.indexOf(`<script src="${src}" defer></script>`);
    assert.ok(at('js/config.js') > -1, `${page}: config.js`);
    assert.ok(at('js/config.js') < at('js/demo-data.js') && at('js/demo-data.js') < at('js/products.js'), `${page}: script order (run npm run stamp)`);
  });
});

test('pages carry noindex exactly when they should (run npm run stamp after changing demoMode)', () => {
  const { STORE_CONFIG } = load({ demoMode: /demoMode: true,/.test(read('js/config.js')) });
  const alwaysNoindex = ['cart.html', 'checkout.html', 'order-confirmation.html', '404.html'];
  readdirSync(ROOT).filter((f) => f.endsWith('.html')).forEach((page) => {
    const has = read(page).includes('<meta name="robots" content="noindex">');
    assert.equal(has, STORE_CONFIG.demoMode === true || alwaysNoindex.includes(page), page);
  });
});

/* ---------- Run ---------- */
let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`✗ ${name}\n    ${err.message.split('\n').join('\n    ')}`);
  }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
