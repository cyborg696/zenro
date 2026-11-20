/**
 * Shop page, three levels driven by validated URL parameters:
 *   shop.html                          -> all watches, grouped by brand
 *   shop.html?brand=rolex              -> brand landing: model cards + that brand's watches
 *   shop.html?brand=rolex&model=datejust -> only that model's watches
 * Optional: &price=<range key>&sort=<featured|price-asc|price-desc>.
 * Every URL value is checked against the catalogue or an allow-list before use.
 */
'use strict';

(() => {
  const results = document.getElementById('shop-results');
  if (!results) return;

  const { el } = ZW;
  const titleEl = document.getElementById('page-title');
  const eyebrowEl = document.getElementById('shop-eyebrow');
  const ledeEl = document.getElementById('shop-lede');
  const crumbs = document.getElementById('shop-breadcrumb');
  const tree = document.getElementById('brand-tree');
  const priceSelect = document.getElementById('price-filter');
  const sortSelect = document.getElementById('sort');
  const countEl = document.getElementById('result-count');
  const resetBtn = document.getElementById('reset-filters');
  const panel = document.getElementById('shop-panel');
  const panelToggle = document.getElementById('shop-toggle');

  /* ---------- Price ranges from config (validated) ---------- */
  const bounds = (() => {
    const b = STORE_CONFIG.priceRanges;
    const ok = Array.isArray(b) && b.length > 0 && b.length <= 8 && b.every((n, i) => Number.isInteger(n) && n > 0 && (i === 0 || n > b[i - 1]));
    return ok ? b : [5000, 10000, 20000];
  })();
  const PRICE_RANGES = new Map([['all', { label: 'All prices', min: 0, max: Infinity }]]);
  PRICE_RANGES.set(`under-${bounds[0]}`, { label: `Under ${formatBDT(bounds[0])}`, min: 0, max: bounds[0] - 1 });
  for (let i = 0; i < bounds.length - 1; i += 1) {
    PRICE_RANGES.set(`${bounds[i]}-${bounds[i + 1]}`, {
      label: `${formatBDT(bounds[i])} to ${formatBDT(bounds[i + 1])}`, min: bounds[i], max: bounds[i + 1],
    });
  }
  PRICE_RANGES.set(`over-${bounds[bounds.length - 1]}`, { label: `Over ${formatBDT(bounds[bounds.length - 1])}`, min: bounds[bounds.length - 1] + 1, max: Infinity });
  priceSelect.replaceChildren(...[...PRICE_RANGES].map(([key, r]) => el('option', { value: key, text: r.label })));

  const SORTS = ['featured', 'price-asc', 'price-desc'];
  const DEFAULTS = { price: 'all', sort: 'featured' };

  /* ---------- Read and validate the URL ---------- */
  const params = new URLSearchParams(window.location.search);
  const rawBrand = params.get('brand');
  const rawModel = params.get('model');
  let brand = rawBrand !== null ? getBrand(rawBrand) : null;
  let model = null;
  let notFound = rawBrand !== null && !brand;
  if (!notFound && rawModel !== null) {
    if (brand) {
      model = getModel(brand.slug, rawModel);
    } else if (isValidSlug(rawModel)) {
      // ?model= without a brand: accept it only if exactly one brand has that model
      const matches = getModels().filter((m) => m.slug === rawModel);
      if (matches.length === 1) {
        model = matches[0];
        brand = getBrand(model.brand);
      }
    }
    if (!model) notFound = true;
  }

  const state = {
    price: PRICE_RANGES.has(params.get('price') || '') ? params.get('price') : DEFAULTS.price,
    sort: SORTS.includes(params.get('sort')) ? params.get('sort') : DEFAULTS.sort,
  };
  priceSelect.value = state.price;
  sortSelect.value = state.sort;

  const brandHref = (b) => `shop.html?brand=${b.slug}`;
  const modelHref = (m) => `shop.html?brand=${m.brand}&model=${m.slug}`;

  /* ---------- Heading, title, breadcrumb ---------- */
  function setCrumbs(items) {
    crumbs.replaceChildren(
      ...items.map(([label, href], i) =>
        el('li', {}, i === items.length - 1 ? el('span', { 'aria-current': 'page', text: label }) : el('a', { href, text: label })))
    );
  }

  function setHeading(title, eyebrow, lede) {
    titleEl.textContent = title;
    eyebrowEl.textContent = eyebrow;
    if (lede) {
      ledeEl.textContent = lede;
      ledeEl.hidden = false;
    } else {
      ledeEl.hidden = true;
    }
  }

  if (notFound) {
    document.title = 'Not found | ZENRO Wrist & Co.';
    setHeading('We could not find that', 'The Collection', 'The brand or model in this link is not in our collection.');
    setCrumbs([['Home', 'index.html'], ['Not found']]);
  } else if (model) {
    document.title = `${brand.name} ${model.name} | ZENRO Wrist & Co.`;
    setHeading(`${brand.name} ${model.name}`, brand.name, 'Cash on Delivery all over Bangladesh.');
    setCrumbs([['Home', 'index.html'], [brand.name, brandHref(brand)], [model.name]]);
  } else if (brand) {
    document.title = `${brand.name} watches | ZENRO Wrist & Co.`;
    setHeading(`${brand.name} watches`, 'Brand', isSet(brand.intro) ? ZW.sanitizeMultiline(brand.intro, 600) : 'Cash on Delivery all over Bangladesh.');
    setCrumbs([['Home', 'index.html'], [brand.name]]);
  }

  /* ---------- Sidebar tree: brand -> model with counts ---------- */
  function buildTree() {
    const isAll = !brand && !notFound;
    const items = [
      el('li', {}, el('a', { href: 'shop.html', 'aria-current': isAll ? 'page' : null }, ['All watches ', ZW.countBadge(PRODUCTS.length)])),
      ...getBrands().map((b) => {
        const activeBrand = brand && brand.slug === b.slug;
        return el('li', {}, [
          el('a', { href: brandHref(b), 'aria-current': activeBrand && !model ? 'page' : null }, [b.name, ' ', ZW.countBadge(b.count)]),
          el('ul', {}, getModels(b.slug).map((m) =>
            el('li', {}, el('a', { href: modelHref(m), 'aria-current': model && model.slug === m.slug && activeBrand ? 'page' : null }, [m.name, ' ', ZW.countBadge(m.count)])))),
        ]);
      }),
    ];
    tree.replaceChildren(el('h2', { class: 'filters__label', text: 'Brands' }), el('ul', { class: 'tree__list' }, items));
  }

  /* ---------- Filtering & sorting ---------- */
  function applyFilters(list) {
    const range = PRICE_RANGES.get(state.price);
    let out = list;
    if (state.price !== 'all') {
      out = out.filter((p) => {
        const price = priceOf(p);
        return price !== null && price >= range.min && price <= range.max; // "Ask for price" items have no price to filter on
      });
    }
    const featuredRank = (p) => (p.featured ? 0 : 1);
    const byPrice = (dir) => (a, b) => {
      const pa = priceOf(a);
      const pb = priceOf(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1; // "Ask for price" always last
      if (pb === null) return -1;
      return dir * (pa - pb);
    };
    if (state.sort === 'price-asc') return [...out].sort(byPrice(1));
    if (state.sort === 'price-desc') return [...out].sort(byPrice(-1));
    return [...out].sort((a, b) => featuredRank(a) - featuredRank(b) || byPrice(1)(a, b));
  }

  function grid(products, headingLevel) {
    const cards = products.map((p) => ZW.productCard(p, { headingLevel }));
    ZW.stagger(cards, 0.08);
    return el('div', { class: 'product-grid' }, cards);
  }

  function emptyState() {
    return el('div', { class: 'empty-state' }, [
      el('h2', { text: 'No watches match these filters' }),
      el('p', { text: 'Many of our watches are "Ask for price". Try "All prices", or ask us on WhatsApp.' }),
      el('button', { type: 'button', class: 'btn btn--outline', text: 'Reset filters', onclick: reset }),
    ]);
  }

  function notFoundState() {
    return el('div', { class: 'notice' }, [
      el('h2', { text: 'Not in our collection' }),
      el('p', { text: 'This link may be out of date. Browse all watches or choose a brand.' }),
      el('div', { class: 'notice__actions' }, [
        el('a', { class: 'btn btn--dark', href: 'shop.html', text: 'All watches' }),
        brand ? el('a', { class: 'btn btn--outline', href: brandHref(brand), text: `${brand.name} watches` }) : null,
      ]),
    ]);
  }

  function modelCards() {
    const models = getModels(brand.slug);
    return el('section', { class: 'shop-group', 'aria-labelledby': 'models-title' }, [
      el('h2', { class: 'shop-group__title', id: 'models-title', text: `${brand.name} models` }),
      el('ul', { class: 'model-grid' }, models.map((m) => {
        const first = getProducts({ brand: m.brand, model: m.slug })[0];
        return el('li', { class: 'model-card reveal' }, el('a', { href: modelHref(m) }, [
          el('span', { class: 'model-card__media', 'aria-hidden': 'true' },
            first ? ZW.productMedia(first, { sizes: '(min-width: 1000px) 200px, 45vw' }) : null),
          el('span', { class: 'model-card__name', text: m.name }),
          el('span', { class: 'model-card__count', text: `${m.count} ${m.count === 1 ? 'watch' : 'watches'}` }),
        ]));
      })),
    ]);
  }

  /* ---------- Render ---------- */
  function syncUrl() {
    const next = new URLSearchParams();
    if (brand) next.set('brand', brand.slug);
    if (model) next.set('model', model.slug);
    for (const key of Object.keys(DEFAULTS)) {
      if (state[key] !== DEFAULTS[key]) next.set(key, state[key]);
    }
    const query = next.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }

  function render() {
    resetBtn.hidden = Object.keys(DEFAULTS).every((k) => state[k] === DEFAULTS[k]);

    if (notFound) {
      countEl.textContent = '';
      results.replaceChildren(notFoundState());
      return;
    }

    let total = 0;
    const blocks = [];

    if (model) {
      const list = applyFilters(getProducts({ brand: brand.slug, model: model.slug }));
      total = list.length;
      blocks.push(list.length ? grid(list, 'h2') : emptyState());
    } else if (brand) {
      blocks.push(modelCards());
      const list = applyFilters(getProducts({ brand: brand.slug }));
      total = list.length;
      blocks.push(el('section', { class: 'shop-group', 'aria-labelledby': 'brand-all-title' }, [
        el('h2', { class: 'shop-group__title', id: 'brand-all-title', text: `All ${brand.name} watches` }),
        list.length ? grid(list, 'h3') : emptyState(),
      ]));
    } else {
      getBrands().forEach((b) => {
        const list = applyFilters(getProducts({ brand: b.slug }));
        if (!list.length) return;
        total += list.length;
        const id = `group-${b.slug}`;
        blocks.push(el('section', { class: 'shop-group', 'aria-labelledby': id }, [
          el('div', { class: 'shop-group__head' }, [
            el('h2', { class: 'shop-group__title', id, text: b.name }),
            el('a', { class: 'link-arrow', href: brandHref(b), text: `All ${b.name}` }),
          ]),
          grid(list, 'h3'),
        ]));
      });
      if (!total) blocks.push(emptyState());
    }

    countEl.textContent = `Showing ${total} ${total === 1 ? 'watch' : 'watches'}`;
    results.replaceChildren(...blocks);
    ZW.observeReveals(results);
  }

  function reset() {
    Object.assign(state, DEFAULTS);
    priceSelect.value = state.price;
    sortSelect.value = state.sort;
    syncUrl();
    render();
  }

  priceSelect.addEventListener('change', () => {
    state.price = PRICE_RANGES.has(priceSelect.value) ? priceSelect.value : DEFAULTS.price;
    syncUrl();
    render();
  });
  sortSelect.addEventListener('change', () => {
    state.sort = SORTS.includes(sortSelect.value) ? sortSelect.value : DEFAULTS.sort;
    syncUrl();
    render();
  });
  resetBtn.addEventListener('click', reset);

  // Mobile: the brand tree and filters sit in a collapsible panel
  panelToggle.addEventListener('click', () => {
    const open = panelToggle.getAttribute('aria-expanded') !== 'true';
    panelToggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
  });

  buildTree();
  render();
})();
