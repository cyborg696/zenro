/**
 * Structured data (JSON-LD) for search engines, built from the catalogue.
 * It lives in this same-origin file, not in an inline <script>, so the strict CSP
 * still applies. A JSON data block is never executed.
 */
'use strict';

(() => {
  function addJsonLd(data) {
    const node = document.createElement('script');
    node.type = 'application/ld+json';
    node.textContent = JSON.stringify(data);
    document.head.append(node);
  }

  const here = (path) => new URL(path, window.location.href).href;
  const socials = [STORE_CONFIG.instagram, STORE_CONFIG.facebook].filter((u) => typeof u === 'string' && u.startsWith('https://'));

  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (page === 'index.html' || page === '') {
    addJsonLd({
      '@context': 'https://schema.org',
      '@type': 'OnlineStore',
      name: 'ZENRO Wrist & Co.',
      url: here('index.html'),
      logo: here('images/favicon.svg'),
      foundingDate: '2026',
      address: { '@type': 'PostalAddress', addressLocality: 'Chandpur', addressCountry: 'BD' },
      areaServed: { '@type': 'Country', name: 'Bangladesh' },
      currenciesAccepted: 'BDT',
      paymentAccepted: 'Cash, bKash, Nagad, Rocket, Bank transfer',
      sameAs: socials,
    });
    return;
  }

  if (page === 'product.html') {
    const product = getProduct(new URLSearchParams(window.location.search).get('id') || '');
    if (!product) return;
    const brand = getBrand(product.brand);
    const price = priceOf(product);
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      url: here(`product.html?id=${encodeURIComponent(product.id)}`),
      sku: product.id,
    };
    // Only state the maker as the product's brand when the owner has marked the watch 'Original'.
    if (brand && product.condition === 'Original' && STORE_CONFIG.conditions.includes('Original')) {
      data.brand = { '@type': 'Brand', name: brand.name };
    }
    if (isSet(product.description)) data.description = product.description;
    const images = productImages(product).map(here);
    if (images.length) data.image = images;
    // No offer for a demo sample price (demo mode): search engines must never see it as real.
    if (price !== null && !isDemoPrice(product)) {
      data.offers = {
        '@type': 'Offer',
        price: String(price),
        priceCurrency: 'BDT',
        availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: data.url,
        seller: { '@type': 'Organization', name: 'ZENRO Wrist & Co.' },
      };
    }
    addJsonLd(data);
  }
})();
