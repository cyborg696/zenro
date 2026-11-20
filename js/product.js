/**
 * Product page: reads ?id= from the URL, validates it against the catalogue
 * and builds the breadcrumb, gallery, price/condition, purchase controls,
 * specs table and related watches.
 */
'use strict';

(() => {
  const root = document.getElementById('product-root');
  if (!root) return;

  const { el, svgIcon, Cart, ICONS } = ZW;

  const rawId = new URLSearchParams(window.location.search).get('id') || '';
  const product = getProduct(rawId);

  if (!product) {
    document.title = 'Watch not found | ZENRO Wrist & Co.';
    root.replaceChildren(
      el('div', { class: 'notice' }, [
        el('h1', { class: 'product__name', text: 'Watch not found' }),
        el('p', { text: 'We could not find that watch. It may have been sold or the link may be out of date.' }),
        el('div', { class: 'notice__actions' }, [
          el('a', { class: 'btn btn--dark', href: 'shop.html', text: 'Browse the collection' }),
          ZW.externalLink(ZW.waLink('Hi ZENRO Wrist & Co., I am looking for a watch.'), 'Ask on WhatsApp', 'btn btn--outline'),
        ]),
      ])
    );
    root.classList.remove('product');
    root.classList.add('section');
    return;
  }

  const brand = getBrand(product.brand);
  const model = getModel(product.brand, product.model);
  const price = priceOf(product);
  const pageUrl = ZW.absoluteUrl(ZW.productHref(product));
  const variant = isSet(product.variant) ? product.variant : '';
  const fullName = variant ? `${product.name} (${variant})` : product.name;

  /* ---------- Meta ---------- */
  document.title = `${product.name} | ZENRO Wrist & Co.`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const priceText = price !== null && !isDemoPrice(product) ? `${formatBDT(price)}.` : 'Ask for price on WhatsApp.';
    metaDesc.setAttribute('content', `${product.name}. ${priceText} Cash on Delivery all over Bangladesh.`);
  }

  /* ---------- Gallery ---------- */
  const images = productImages(product);
  let gallery;
  if (!images.length) {
    gallery = el('section', { class: 'gallery', 'aria-label': `${product.name} image` },
      el('div', { class: 'gallery__main gallery__main--ph' }, ZW.placeholder(product)));
  } else {
    const SIZES = '(min-width: 900px) 55vw, 100vw';
    const mainImg = ZW.productMedia(product, { index: 0, sizes: SIZES, eager: true });
    const mainFrame = el('div', { class: 'gallery__main' }, mainImg);
    const thumbs = images.map((_, i) =>
      el('button', {
        type: 'button',
        class: 'gallery__thumb',
        'aria-label': `Show image ${i + 1} of ${images.length}`,
        'aria-current': String(i === 0),
        'data-index': i,
      }, (() => {
        const img = ZW.productMedia(product, { index: i, sizes: '120px' });
        img.alt = '';
        return img;
      })())
    );
    let current = 0;
    function showImage(index) {
      if (index === current) return;
      current = index;
      thumbs.forEach((t, i) => t.setAttribute('aria-current', String(i === index)));
      mainFrame.classList.remove('is-zoomed');
      mainImg.classList.add('is-fading');
      const next = ZW.productMedia(product, { index, sizes: SIZES });
      setTimeout(() => {
        mainImg.srcset = next.srcset;
        mainImg.src = next.src;
        mainImg.alt = next.alt;
        mainImg.classList.remove('is-fading');
      }, 200);
    }
    const thumbList = el('ul', { class: 'gallery__thumbs', 'aria-label': 'Product images' }, thumbs.map((t) => el('li', {}, t)));
    thumbList.addEventListener('click', (e) => {
      const btn = e.target.closest('.gallery__thumb');
      if (btn) showImage(Number(btn.dataset.index));
    });
    // Hover zoom that follows the pointer (mouse / trackpad only)
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    mainFrame.addEventListener('mouseenter', () => {
      if (finePointer.matches) mainFrame.classList.add('is-zoomed');
    });
    mainFrame.addEventListener('mouseleave', () => mainFrame.classList.remove('is-zoomed'));
    mainFrame.addEventListener('mousemove', (e) => {
      const rect = mainFrame.getBoundingClientRect();
      mainImg.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
    });
    gallery = el('section', { class: 'gallery', 'aria-label': `${product.name} image gallery` }, [mainFrame, images.length > 1 ? thumbList : null]);
  }

  /* ---------- Purchase area ---------- */
  function buyArea() {
    if (!product.inStock) {
      return el('div', { class: 'purchase-note' }, [
        el('p', { text: 'This watch is sold out right now.' }),
        ZW.externalLink(ZW.waLink(`Hi ZENRO Wrist & Co., please let me know when the ${fullName} is back in stock. ${pageUrl}`),
          'Notify me on WhatsApp', 'btn btn--wa btn--block'),
      ]);
    }
    if (price === null) {
      return el('div', { class: 'purchase-note' }, [
        ZW.externalLink(ZW.waLink(`Hi ZENRO Wrist & Co., what is the price of the ${fullName}? ${pageUrl}`),
          'Ask for price on WhatsApp', 'btn btn--wa btn--block'),
      ]);
    }

    const qtyInput = el('input', {
      type: 'number', id: 'qty', name: 'quantity', min: 1, max: Cart.MAX_QTY, value: 1, inputmode: 'numeric', 'aria-label': 'Quantity',
    });
    const minus = el('button', { type: 'button', 'aria-label': 'Decrease quantity', text: '−' });
    const plus = el('button', { type: 'button', 'aria-label': 'Increase quantity', text: '+' });
    function setQty(value) {
      const q = ZW.clampQty(value);
      qtyInput.value = String(q);
      minus.disabled = q <= 1;
      plus.disabled = q >= Cart.MAX_QTY;
    }
    minus.addEventListener('click', () => setQty(Number(qtyInput.value) - 1));
    plus.addEventListener('click', () => setQty(Number(qtyInput.value) + 1));
    qtyInput.addEventListener('change', () => setQty(qtyInput.value));
    setQty(1);

    const addBtn = el('button', { type: 'submit', class: 'btn btn--dark btn--block', text: 'Add to Cart' });
    const buyBtn = el('button', { type: 'button', class: 'btn btn--gold btn--block purchase__buy', text: 'Buy Now' });
    const form = el('form', { class: 'purchase', 'aria-label': `Buy ${product.name}` }, [el('div', { class: 'qty' }, [minus, qtyInput, plus]), addBtn, buyBtn]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const qty = ZW.clampQty(qtyInput.value);
      const added = Cart.add(product.id, qty);
      if (added === 0) {
        ZW.toast(`You already have the maximum of ${Cart.MAX_QTY} of this watch in your cart.`, { href: 'cart.html', label: 'View cart' });
        return;
      }
      const note = added < qty ? ` (limit of ${Cart.MAX_QTY} per watch)` : '';
      ZW.toast(`Added ${added} × ${product.name} to your cart${note}.`, { href: 'cart.html', label: 'View cart' });
      setQty(1);
    });
    buyBtn.addEventListener('click', () => {
      Cart.add(product.id, ZW.clampQty(qtyInput.value)); // already at the limit is fine: go to checkout anyway
      window.location.assign('checkout.html');
    });
    return form;
  }

  /* ---------- Info column ---------- */
  const condition = ZW.conditionOf(product);
  const conditionLine = el('p', { class: 'product__condition' }, condition
    ? ['Condition: ', el('strong', { text: condition })]
    : ['Condition: ', ZW.askOnWhatsApp(`Hi ZENRO Wrist & Co., what is the condition of the ${fullName}? ${pageUrl}`)]);

  const specRows = Object.entries(SPEC_LABELS)
    .map(([key, label]) => [label, product.specs && product.specs[key]])
    .filter(([, value]) => isSet(value));

  const assurances = [
    el('li', {}, [svgIcon(ICONS.truck), 'Cash on Delivery all over Bangladesh']),
    isSet(STORE_CONFIG.warranty) ? el('li', {}, [svgIcon(ICONS.shield), `Warranty: ${ZW.sanitizeLine(STORE_CONFIG.warranty, 200)}`]) : null,
    isSet(STORE_CONFIG.returnPolicy) ? el('li', {}, [svgIcon(ICONS.returns), `Returns: ${ZW.sanitizeLine(STORE_CONFIG.returnPolicy, 200)}`]) : null,
  ];

  const insta = instagramUrlOf(product);
  const crumbItems = [
    el('li', {}, el('a', { href: 'index.html', text: 'Home' })),
    brand ? el('li', {}, el('a', { href: `shop.html?brand=${brand.slug}`, text: brand.name })) : null,
    model ? el('li', {}, el('a', { href: `shop.html?brand=${model.brand}&model=${model.slug}`, text: model.name })) : null,
    el('li', {}, el('span', { 'aria-current': 'page', text: product.name })),
  ];

  const info = el('div', { class: 'product__info' }, [
    el('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, el('ol', {}, crumbItems)),
    el('p', { class: 'eyebrow', text: ZW.modelLabel(product) }),
    el('h1', { class: 'product__name', text: product.name }),
    variant ? el('p', { class: 'product__variant', text: variant }) : null,
    el('div', { class: 'product__price-row' }, [ZW.priceNode(product, 'product__price'), ZW.badgeList(product)]),
    conditionLine,
    isSet(product.description) ? el('p', { class: 'product__desc', text: product.description }) : null,
    buyArea(),
    insta ? el('p', { class: 'product__insta' }, ZW.externalLink(insta, 'View on Instagram', 'link-arrow')) : null,
    el('ul', { class: 'assurances' }, assurances),
    specRows.length
      ? el('table', { class: 'specs' }, [
        el('caption', { text: 'Specifications' }),
        el('tbody', {}, specRows.map(([label, value]) => el('tr', {}, [el('th', { scope: 'row', text: label }), el('td', { text: value })]))),
      ])
      : null,
  ]);

  root.replaceChildren(gallery, info);

  /* ---------- Related watches: same model, then same brand, then the rest ---------- */
  const relatedGrid = document.getElementById('related-grid');
  const relatedSection = document.getElementById('related-section');
  if (relatedGrid && relatedSection) {
    const others = PRODUCTS.filter((p) => p.id !== product.id);
    const related = [
      ...others.filter((p) => p.brand === product.brand && p.model === product.model),
      ...others.filter((p) => p.brand === product.brand && p.model !== product.model),
      ...others.filter((p) => p.brand !== product.brand),
    ].slice(0, 3);
    if (related.length) {
      const cards = related.map((p) => ZW.productCard(p));
      ZW.stagger(cards);
      relatedGrid.replaceChildren(...cards);
      relatedSection.hidden = false;
      ZW.observeReveals(relatedSection);
    }
  }

  document.dispatchEvent(new CustomEvent('product:ready', { detail: { id: product.id } }));
})();
