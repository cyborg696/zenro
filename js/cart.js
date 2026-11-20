/** Cart page: lists cart items from localStorage with quantity controls and the order summary. */
'use strict';

(() => {
  const root = document.getElementById('cart-root');
  if (!root) return;

  const { el, svgIcon, Cart } = ZW;
  const BAG_ICON = 'M6 7h12l1 13H5L6 7zM9 7a3 3 0 0 1 6 0';

  function emptyState() {
    return el('div', { class: 'notice' }, [
      svgIcon(BAG_ICON, 'notice__icon'),
      el('h2', { text: 'Your cart is empty' }),
      el('p', { text: 'Browse the collection by brand and model, or ask us about any watch on WhatsApp.' }),
      el('div', { class: 'notice__actions' }, [
        el('a', { class: 'btn btn--dark', href: 'shop.html', text: 'Shop the Collection' }),
        ZW.externalLink(ZW.waLink('Hi ZENRO Wrist & Co., I would like to order a watch.'), 'Order on WhatsApp', 'btn btn--outline'),
      ]),
    ]);
  }

  function itemRow({ id, qty }) {
    const product = getProduct(id);
    const price = priceOf(product);
    const href = ZW.productHref(product);
    const input = el('input', {
      type: 'number', id: `qty-${product.id}`, min: 1, max: Cart.MAX_QTY, value: qty, inputmode: 'numeric', 'aria-label': `Quantity for ${product.name}`,
    });
    const minus = el('button', { type: 'button', 'aria-label': `Decrease quantity of ${product.name}`, text: '−', disabled: qty <= 1 });
    const plus = el('button', { type: 'button', 'aria-label': `Increase quantity of ${product.name}`, text: '+', disabled: qty >= Cart.MAX_QTY });

    minus.addEventListener('click', () => Cart.setQty(product.id, qty - 1));
    plus.addEventListener('click', () => Cart.setQty(product.id, qty + 1));
    input.addEventListener('change', () => Cart.setQty(product.id, input.value));

    const remove = el('button', { type: 'button', class: 'cart-item__remove', 'aria-label': `Remove ${product.name} from cart`, text: 'Remove' });
    remove.addEventListener('click', () => {
      Cart.remove(product.id);
      ZW.toast(`${product.name} removed from your cart.`);
    });

    const meta = [ZW.modelLabel(product), isSet(product.variant) ? product.variant : null, `${formatBDT(price)} each`].filter(Boolean).join(' · ');

    return el('li', { class: 'cart-item', 'data-id': product.id }, [
      el('a', { class: 'cart-item__media', href, tabindex: '-1', 'aria-hidden': 'true' }, ZW.productMedia(product, { sizes: '120px' })),
      el('div', {}, [
        el('h2', { class: 'cart-item__name' }, el('a', { href, text: product.name })),
        el('p', { class: 'cart-item__meta', text: meta }),
      ]),
      el('div', { class: 'cart-item__controls' }, [
        el('div', { class: 'qty' }, [minus, input, plus]),
        el('p', { class: 'cart-item__total', text: formatBDT(price * qty) }),
        remove,
      ]),
    ]);
  }

  function deliveryText() {
    const inside = ZW.deliveryCharge('inside');
    const outside = ZW.deliveryCharge('outside');
    if (inside === null || outside === null) return 'Confirmed on WhatsApp';
    if (inside === outside) return formatBDT(inside);
    return `${formatBDT(inside)} inside Dhaka, ${formatBDT(outside)} outside`;
  }

  function summary(items) {
    const subtotal = Cart.subtotal();
    const count = items.reduce((s, i) => s + i.qty, 0);
    return el('aside', { class: 'summary', 'aria-labelledby': 'summary-title' }, [
      el('h2', { id: 'summary-title', text: 'Order summary' }),
      el('dl', {}, [
        el('dt', { text: `Subtotal (${count} ${count === 1 ? 'item' : 'items'})` }),
        el('dd', { text: formatBDT(subtotal) }),
        el('dt', { text: 'Delivery charge' }),
        el('dd', { text: deliveryText() }),
        el('dt', { class: 'summary__total', text: 'Total' }),
        el('dd', { class: 'summary__total', text: `${formatBDT(subtotal)} + delivery` }),
      ]),
      el('p', { class: 'form-note', text: 'The delivery charge depends on your zone and is added at checkout.' }),
      el('a', { class: 'btn btn--gold btn--block', href: 'checkout.html', text: 'Proceed to checkout' }),
      el('a', { class: 'btn btn--outline btn--block', href: 'shop.html', text: 'Continue shopping' }),
      el('p', { class: 'form-note', text: 'Cash on Delivery, bKash, Nagad, Rocket or bank transfer.' }),
    ]);
  }

  function render() {
    const items = Cart.items();
    if (!items.length) {
      root.replaceChildren(emptyState());
      return;
    }
    // Remember which control had focus so keyboard users keep their place after re-render
    const active = document.activeElement;
    const focusKey = active && active.closest('.cart-item')
      ? [active.closest('.cart-item').dataset.id, active.getAttribute('aria-label')]
      : null;

    root.replaceChildren(
      el('div', { class: 'cart' }, [
        el('section', { 'aria-label': 'Items in your cart' }, el('ul', { class: 'cart-list' }, items.map(itemRow))),
        summary(items),
      ])
    );

    if (focusKey) {
      const row = root.querySelector(`.cart-item[data-id="${CSS.escape(focusKey[0])}"]`);
      const target = row && [...row.querySelectorAll('button, input')].find((n) => n.getAttribute('aria-label') === focusKey[1]);
      if (target && !target.disabled) target.focus();
      else if (row) row.querySelector('input').focus();
      else {
        const firstRow = root.querySelector('.cart-item input');
        if (firstRow) firstRow.focus();
        else root.querySelector('.summary a').focus();
      }
    }
  }

  document.addEventListener('cart:change', render);
  render();
})();
