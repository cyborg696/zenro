/** Home page: featured watches, "Shop by brand" cards and customer reviews from config. */
'use strict';

(() => {
  const { el } = ZW;

  /* ---------- Hero watch: live Bangladesh time and date ----------
   * Bangladesh Standard Time is UTC+6 all year (no daylight saving), so the time is worked out
   * from UTC directly and does not depend on the visitor's own time zone. The second hand sweeps
   * smoothly; with "reduce motion" switched on it ticks once a second instead. */
  const watchHands = ['hour', 'minute', 'second'].map((k) => document.getElementById(`hw-${k}`));
  const watchDate = document.getElementById('hw-date');
  if (watchHands.every(Boolean)) {
    const BST_OFFSET_MS = 6 * 60 * 60 * 1000;
    // Keep each hand's translate(...) and replace only its rotate(...)
    const bases = watchHands.map((g) => g.getAttribute('transform').replace(/\s*rotate\([^)]*\)/, ''));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const render = () => {
      const t = new Date(Date.now() + BST_OFFSET_MS);
      const sec = t.getUTCSeconds() + (reduceMotion.matches ? 0 : t.getUTCMilliseconds() / 1000);
      const min = t.getUTCMinutes() + sec / 60;
      const hour = (t.getUTCHours() % 12) + min / 60;
      [hour * 30, min * 6, sec * 6].forEach((deg, i) => {
        watchHands[i].setAttribute('transform', `${bases[i]} rotate(${deg.toFixed(2)})`);
      });
      // Date window: today's day of the month in Bangladesh
      const day = String(t.getUTCDate());
      if (watchDate && watchDate.textContent !== day) watchDate.textContent = day;
    };

    // Smooth sweep only while the hero is on screen; otherwise once a second is plenty.
    let onScreen = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
      }).observe(watchHands[0].ownerSVGElement);
    }
    const loop = () => {
      render();
      if (onScreen && !reduceMotion.matches) requestAnimationFrame(loop);
      else setTimeout(loop, 1000 - (Date.now() % 1000));
    };
    loop();
  }

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
