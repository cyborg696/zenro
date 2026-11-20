/** Home page: featured watches, "Shop by brand" cards and customer reviews from config. */
'use strict';

(() => {
  const { el } = ZW;

  /* ---------- Featured watches ---------- */
  const grid = document.getElementById('featured-grid');
  if (grid) {
    const featured = getProducts().filter((p) => p.featured).slice(0, 6);
    const list = featured.length ? featured : getProducts().slice(0, 3);
    const cards = list.map((p) => ZW.productCard(p));
    ZW.stagger(cards);
    grid.replaceChildren(...cards);
  }

  /* ---------- Shop by brand ---------- */
  const brandGrid = document.getElementById('brand-grid');
  if (brandGrid) {
    const cards = getBrands().map((brand) => {
      const models = getModels(brand.slug).map((m) => m.name).join(' · ');
      return el('li', { class: 'brand-card reveal' },
        el('a', { href: `shop.html?brand=${brand.slug}` }, [
          el('span', { class: 'brand-card__name', text: brand.name }),
          el('span', { class: 'brand-card__models', text: models }),
          el('span', { class: 'brand-card__count', text: `${brand.count} ${brand.count === 1 ? 'watch' : 'watches'}` }),
        ]));
    });
    ZW.stagger(cards);
    brandGrid.replaceChildren(...cards);
  }

  /* ---------- Reviews (only real ones from STORE_CONFIG.reviews) ---------- */
  const reviewsSection = document.getElementById('reviews');
  const reviewsGrid = document.getElementById('reviews-grid');
  const REVIEW_IMAGE_RE = /^images\/reviews\/[a-z0-9-]+\.(webp|jpg|png)$/;
  if (reviewsSection && reviewsGrid && Array.isArray(STORE_CONFIG.reviews)) {
    const reviews = STORE_CONFIG.reviews
      .filter((r) => r && typeof r === 'object')
      .map((r) => ({
        name: ZW.sanitizeLine(r.name, 60),
        city: ZW.sanitizeLine(r.city, 60),
        text: ZW.sanitizeMultiline(r.text, 600),
        image: typeof r.image === 'string' && REVIEW_IMAGE_RE.test(r.image) ? r.image : null,
      }))
      .filter((r) => r.name && r.text)
      .slice(0, 12);

    if (reviews.length) {
      const cards = reviews.map((r) =>
        el('figure', { class: 'testimonial reveal' }, [
          r.image ? el('img', { class: 'testimonial__image', src: r.image, alt: `Message from ${r.name}`, width: 600, height: 750, loading: 'lazy', decoding: 'async' }) : null,
          el('blockquote', {}, el('p', { text: `“${r.text}”` })),
          el('figcaption', {}, [el('strong', { text: r.name }), r.city ? r.city : null]),
        ])
      );
      ZW.stagger(cards);
      reviewsGrid.replaceChildren(...cards);
      reviewsSection.hidden = false;
    }
  }

  ZW.observeReveals();
})();
