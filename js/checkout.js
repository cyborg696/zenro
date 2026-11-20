/**
 * Checkout (Phase A: manual payment verification).
 * Four steps in one form: delivery details, delivery zone, payment, review.
 * Every value is sanitised and validated on each step and again before the order
 * is placed. Prices and charges always come from js/products.js and js/config.js.
 * The finished order is kept in sessionStorage only (never in the URL), then
 * order-confirmation.html asks the customer to send it to us on WhatsApp.
 */
'use strict';

(() => {
  const wrap = document.getElementById('checkout');
  const root = document.getElementById('checkout-root');
  if (!wrap || !root) return;

  const { el, Cart, setFieldError } = ZW;
  const O = ZWOrder;
  const CFG = STORE_CONFIG;
  const ORDER_ID_KEY = 'zw-checkout-order-id';
  const LAST_ORDER_AT_KEY = 'zw-last-order-at';
  const RATE_LIMIT_MS = 30000;

  function emptyNotice() {
    return el('div', { class: 'notice' }, [
      el('h2', { text: 'Your cart is empty' }),
      el('p', { text: 'Add a watch to your cart before checking out, or order directly on WhatsApp.' }),
      el('div', { class: 'notice__actions' }, [
        el('a', { class: 'btn btn--dark', href: 'shop.html', text: 'Shop the Collection' }),
        ZW.externalLink(ZW.waLink('Hi ZENRO Wrist & Co., I would like to order a watch.'), 'Order on WhatsApp', 'btn btn--outline'),
      ]),
    ]);
  }

  if (!Cart.items().length) {
    root.replaceChildren(emptyNotice());
    return;
  }
  wrap.hidden = false;

  /* ---------- Elements ---------- */
  const form = document.getElementById('checkout-form');
  const status = document.getElementById('checkout-status');
  const summaryEl = document.getElementById('checkout-summary');
  const sections = [...form.querySelectorAll('[data-step]')];
  const indicators = [...form.querySelectorAll('[data-step-indicator]')];
  const zoneSet = document.getElementById('co-zone');
  const methodSet = document.getElementById('co-method');
  const advanceSet = document.getElementById('co-advance');
  const advanceIntro = document.getElementById('co-advance-intro');
  const payPanel = document.getElementById('pay-panel');
  const mobileFields = document.getElementById('mobile-fields');
  const bankFields = document.getElementById('bank-fields');
  const pinWarning = document.getElementById('pin-warning');
  const orderIdEl = document.getElementById('co-order-id');
  const review = document.getElementById('review');
  const confirmBox = document.getElementById('co-confirm');
  const placeBtn = document.getElementById('place-order');
  const honeypot = document.getElementById('co-website');

  const inputs = {
    name: document.getElementById('co-name'),
    phone: document.getElementById('co-phone'),
    email: document.getElementById('co-email'),
    district: document.getElementById('co-district'),
    area: document.getElementById('co-area'),
    address: document.getElementById('co-address'),
    note: document.getElementById('co-note'),
    sender: document.getElementById('co-sender'),
    trxId: document.getElementById('co-trxid'),
    depositor: document.getElementById('co-depositor'),
    bankRef: document.getElementById('co-bankref'),
  };
  const STEP1_FIELDS = ['name', 'phone', 'email', 'district', 'area', 'address', 'note'];
  const PAYMENT_FIELDS = ['sender', 'trxId', 'depositor', 'bankRef'];

  /* ---------- Districts ---------- */
  BD_DIVISIONS.forEach((division) => {
    inputs.district.append(el('optgroup', { label: `${division.name} Division` },
      division.districts.map((d) => el('option', { value: d, text: d }))));
  });

  /* ---------- Payment methods: only those fully configured are offered ---------- */
  const available = O.availableMethods();
  const mobiles = O.availableMobileMethods();
  methodSet.querySelectorAll('[data-method]').forEach((label) => {
    const ok = available.includes(label.dataset.method);
    label.hidden = !ok;
    label.querySelector('input').disabled = !ok;
  });
  if (available.length === 1) methodSet.querySelector(`input[value="${available[0]}"]`).checked = true;

  // Official logos only if the owner adds the files and lists them in config
  const LOGO_RE = /^images\/payments\/[a-z0-9-]+\.(svg|png|webp)$/;
  Object.entries(CFG.paymentLogos || {}).forEach(([key, src]) => {
    if (!O.MOBILE_METHODS.includes(key) || typeof src !== 'string' || !LOGO_RE.test(src)) return;
    form.querySelectorAll(`[data-pay-label="${key}"]`).forEach((span) => {
      span.replaceChildren(el('img', { class: 'pay-logo', src, alt: O.METHOD_NAMES[key], width: 96, height: 32 }));
    });
  });

  // Advance (COD) can be paid with any configured mobile method
  mobiles.forEach((m) => {
    advanceSet.append(el('label', { class: 'choice choice--compact' }, [
      el('input', { type: 'radio', name: 'advanceMethod', value: m.key }),
      el('span', { class: 'choice__body' }, el('span', { class: `choice__title pay-name pay-name--${m.key}`, text: m.name })),
    ]));
  });

  /* ---------- Current selections ---------- */
  const checked = (name) => {
    const node = form.querySelector(`input[name="${name}"]:checked`);
    return node ? node.value : null;
  };
  const getZone = () => (Object.hasOwn(O.ZONES, checked('zone')) ? checked('zone') : null);
  const getMethod = () => (available.includes(checked('method')) ? checked('method') : null);
  const getAdvanceMethod = () => (mobiles.some((m) => m.key === checked('advanceMethod')) ? checked('advanceMethod') : null);

  function orderId() {
    let id = null;
    try {
      id = sessionStorage.getItem(ORDER_ID_KEY);
    } catch {
      /* storage blocked */
    }
    if (!id || !O.ORDER_ID_RE.test(id)) {
      id = O.newOrderId();
      try {
        sessionStorage.setItem(ORDER_ID_KEY, id);
      } catch {
        /* storage blocked: the id lives for this page view */
      }
    }
    return id;
  }

  /* ---------- Delivery zone ---------- */
  let zoneTouched = false;
  form.querySelectorAll('[data-zone-charge]').forEach((span) => {
    const charge = ZW.deliveryCharge(span.dataset.zoneCharge);
    span.textContent = charge !== null ? `Delivery charge ${formatBDT(charge)}` : 'Delivery charge confirmed on WhatsApp';
  });

  inputs.district.addEventListener('change', () => {
    if (zoneTouched || !BD_DISTRICTS.includes(inputs.district.value)) return;
    const zone = BD_INSIDE_DHAKA_DISTRICTS.includes(inputs.district.value) ? 'inside' : 'outside';
    zoneSet.querySelector(`input[value="${zone}"]`).checked = true;
    setFieldError(zoneSet, '');
    updateSummary();
  });
  zoneSet.addEventListener('change', () => {
    zoneTouched = true;
    setFieldError(zoneSet, '');
    updateSummary();
    updatePaymentPanel();
  });

  /* ---------- Copy to clipboard ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => ZW.toast(`Copied ${text}`),
        () => ZW.toast(`Could not copy. The number is ${text}`)
      );
    } else {
      ZW.toast(`Please copy the number by hand: ${text}`);
    }
  }

  /* ---------- Payment panel ---------- */
  function mobileInstructions(m, amount, note) {
    const action = m.accountType === 'Merchant' ? 'Payment' : 'Send Money';
    const copyBtn = el('button', { type: 'button', class: 'btn-copy', 'aria-label': `Copy ${m.name} number ${m.number}`, text: 'Copy number' });
    copyBtn.addEventListener('click', () => copyText(m.number));
    return el('div', { class: `pay-box pay-box--${m.key}` }, [
      el('p', { class: 'pay-box__title' }, [el('span', { class: `pay-name pay-name--${m.key}`, text: m.name }), ` ${m.accountType} number`]),
      el('p', { class: 'pay-box__number' }, [el('span', { class: 'mono', text: m.number }), copyBtn]),
      el('p', { class: 'pay-box__hint', text: `This is a ${m.accountType.toLowerCase()} account, so use “${action}”.` }),
      el('p', { class: 'pay-box__amount' }, ['Amount to pay: ', el('strong', { text: formatBDT(amount) })]),
      note ? el('p', { class: 'pay-box__hint', text: note }) : null,
      el('ol', { class: 'pay-steps' }, [
        el('li', { text: `Open the ${m.name} app.` }),
        el('li', { text: `Tap “${action}”.` }),
        el('li', { text: `Enter our number: ${m.number}.` }),
        el('li', { text: `Enter the amount: ${formatBDT(amount)}.` }),
        el('li', { text: `Reference: ${orderId()}.` }),
        el('li', { text: `Confirm with your ${m.name} PIN.` }),
      ]),
      el('p', { class: 'pay-box__hint', text: 'Then enter the number you paid from and the TrxID from your confirmation SMS below.' }),
    ]);
  }

  function bankInstructions(b, amount, note) {
    const rows = [
      ['Bank', b.bankName], ['Account name', b.accountName], ['Account number', b.accountNumber],
      ['Branch', b.branch], ['Routing number', b.routingNumber], ['Reference', orderId()],
    ].filter(([, v]) => v);
    const copyBtn = el('button', { type: 'button', class: 'btn-copy', 'aria-label': `Copy account number ${b.accountNumber}`, text: 'Copy account number' });
    copyBtn.addEventListener('click', () => copyText(b.accountNumber));
    return el('div', { class: 'pay-box' }, [
      el('p', { class: 'pay-box__title', text: 'Bank transfer details' }),
      el('dl', { class: 'info-list info-list--compact' }, rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { class: k.includes('number') || k === 'Reference' ? 'mono' : null, text: v })])),
      copyBtn,
      el('p', { class: 'pay-box__amount' }, ['Amount to pay: ', el('strong', { text: formatBDT(amount) })]),
      note ? el('p', { class: 'pay-box__hint', text: note }) : null,
      el('p', { class: 'pay-box__hint', text: 'After paying, enter the depositor name and reference below, and send a photo of the deposit slip to us on WhatsApp.' }),
    ]);
  }

  function updatePaymentPanel() {
    const method = getMethod();
    const zone = getZone();
    const t = O.totals(Cart.items(), zone);
    const deliveryNote = t.delivery === null ? 'The delivery charge is not included. We will confirm it on WhatsApp.' : null;
    let showMobile = false;
    let showBank = false;
    let showAdvance = false;
    const panel = [];

    if (!available.length) {
      panel.push(el('p', {}, ['Online checkout is not available right now. ', ZW.askOnWhatsApp('Hi ZENRO Wrist & Co., I would like to place an order.')]));
    } else if (method === 'cod') {
      const adv = O.advanceInfo(zone);
      if (!adv.required) {
        panel.push(el('p', { text: `Pay ${formatBDT(t.total)}${t.delivery === null ? ' plus the delivery charge' : ''} in cash to the courier when your watch arrives.` }));
      } else if (adv.amount && mobiles.length) {
        showAdvance = true;
        advanceIntro.textContent = `Cash on Delivery needs an advance of ${formatBDT(adv.amount)}. Pay it now, then pay the rest (${formatBDT(Math.max(0, t.total - adv.amount))}) to the courier.`;
        const adm = getAdvanceMethod();
        if (adm) {
          panel.push(mobileInstructions(O.mobileMethod(adm), adv.amount, null));
          showMobile = true;
        }
      } else {
        panel.push(el('p', { text: 'Cash on Delivery needs a small advance payment. We will contact you on WhatsApp to arrange it.' }));
      }
    } else if (O.MOBILE_METHODS.includes(method)) {
      panel.push(mobileInstructions(O.mobileMethod(method), t.total, deliveryNote));
      showMobile = true;
    } else if (method === 'bank') {
      panel.push(bankInstructions(O.bankDetails(), t.total, deliveryNote));
      showBank = true;
    }

    payPanel.replaceChildren(...panel);
    payPanel.hidden = panel.length === 0;
    advanceSet.hidden = !showAdvance;
    if (!showAdvance) setFieldError(advanceSet, '');
    mobileFields.hidden = !showMobile;
    bankFields.hidden = !showBank;
    pinWarning.hidden = !(showMobile || showBank);
  }

  methodSet.addEventListener('change', () => {
    setFieldError(methodSet, '');
    PAYMENT_FIELDS.forEach((f) => setFieldError(inputs[f], ''));
    updatePaymentPanel();
    updateSummary();
  });
  advanceSet.addEventListener('change', () => {
    setFieldError(advanceSet, '');
    updatePaymentPanel();
  });

  /* ---------- Order summary (always recomputed) ---------- */
  function updateSummary() {
    const items = Cart.items();
    const zone = getZone();
    const method = getMethod();
    const t = O.totals(items, zone);
    const rows = [
      el('dt', { text: 'Subtotal' }), el('dd', { text: formatBDT(t.subtotal) }),
      el('dt', { text: zone ? `Delivery (${O.ZONES[zone]})` : 'Delivery' }),
      el('dd', { text: !zone ? 'Choose a zone' : t.delivery === null ? 'Confirmed on WhatsApp' : formatBDT(t.delivery) }),
      el('dt', { class: 'summary__total', text: 'Total' }),
      el('dd', { class: 'summary__total', text: `${formatBDT(t.total)}${zone && t.delivery !== null ? '' : ' + delivery'}` }),
    ];
    if (method) {
      const due = O.amountDue(method, zone, items);
      if (method === 'cod') {
        if (due) rows.push(el('dt', { text: 'Advance to pay now' }), el('dd', { text: formatBDT(due) }));
        rows.push(el('dt', { text: 'Pay on delivery' }), el('dd', { text: formatBDT(Math.max(0, t.total - (due || 0))) }));
      } else if (due) {
        rows.push(el('dt', { text: `Pay now by ${O.METHOD_NAMES[method]}` }), el('dd', { text: formatBDT(due) }));
      }
    }
    summaryEl.replaceChildren(
      el('h2', { id: 'summary-title', text: 'Your order' }),
      el('ul', { class: 'summary__items' }, t.lines.map((l) =>
        el('li', {}, [
          el('span', { text: `${l.product.name} × ${l.qty}` }),
          el('span', { text: formatBDT(l.total) }),
        ]))),
      el('dl', {}, rows),
      el('a', { class: 'btn-text', href: 'cart.html', text: 'Edit cart' }),
      el('p', { class: 'visually-hidden', 'aria-live': 'polite', text: `Order total ${formatBDT(t.total)}${t.delivery === null ? ' plus delivery' : ''}.` })
    );
  }

  /* ---------- Validation ---------- */
  function validateFields(fields) {
    let first = null;
    fields.forEach((f) => {
      const { error } = O.check(f, inputs[f].value);
      setFieldError(inputs[f], error);
      if (error && !first) first = inputs[f];
    });
    return first;
  }

  /** Validates a step. Returns the first invalid control, or null when the step is valid. */
  function validateStep(n) {
    if (n === 1) return validateFields(STEP1_FIELDS);
    if (n === 2) {
      if (getZone()) return null;
      setFieldError(zoneSet, 'Please choose a delivery zone.');
      return zoneSet.querySelector('input');
    }
    if (n === 3) {
      const method = getMethod();
      if (!method) {
        setFieldError(methodSet, available.length ? 'Please choose a payment method.' : 'Online checkout is not available right now. Please order on WhatsApp.');
        return methodSet.querySelector('input:not([disabled])') || methodSet;
      }
      setFieldError(methodSet, '');
      const required = O.requiredPaymentFields(method, getZone());
      if (required.includes('advanceMethod') && !getAdvanceMethod()) {
        setFieldError(advanceSet, 'Please choose how you will pay the advance.');
        return advanceSet.querySelector('input');
      }
      return validateFields(required.filter((f) => f !== 'advanceMethod'));
    }
    return null;
  }

  function countErrors() {
    return form.querySelectorAll('[aria-invalid="true"]:not([hidden])').length;
  }

  function reportInvalid(target) {
    const n = Math.max(1, countErrors());
    status.className = 'form-status is-error';
    status.textContent = `Please fix ${n} ${n === 1 ? 'field' : 'fields'} highlighted below.`;
    target.focus();
  }

  // Re-validate a field as soon as the customer fixes it
  Object.entries(inputs).forEach(([field, input]) => {
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (input.getAttribute('aria-invalid') === 'true') setFieldError(input, O.check(field, input.value).error);
    });
    input.addEventListener('blur', () => {
      if (!input.value) return;
      if (field === 'trxId' || field === 'bankRef') input.value = O.check(field, input.value).value;
      setFieldError(input, O.check(field, input.value).error);
    });
  });

  /* ---------- Steps ---------- */
  function showStep(n, { focus = true } = {}) {
    sections.forEach((s) => {
      s.hidden = Number(s.dataset.step) !== n;
    });
    indicators.forEach((li) => {
      const k = Number(li.dataset.stepIndicator);
      if (k === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
      li.classList.toggle('is-done', k < n);
    });
    if (n === 3) {
      orderIdEl.textContent = orderId();
      updatePaymentPanel();
    }
    if (n === 4) renderReview();
    status.className = 'form-status';
    status.textContent = '';
    if (focus) {
      const heading = document.getElementById(`step-${n}-title`);
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  form.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    const prev = e.target.closest('[data-prev]');
    const edit = e.target.closest('[data-edit]');
    if (next) {
      const current = Number(next.dataset.next) - 1;
      const bad = validateStep(current);
      if (bad) reportInvalid(bad);
      else showStep(current + 1);
    } else if (prev) {
      showStep(Number(prev.dataset.prev));
    } else if (edit) {
      showStep(Number(edit.dataset.edit));
    }
  });

  /* ---------- Review ---------- */
  function reviewBlock(title, step, rows, extra) {
    return el('section', { class: 'review-block', 'aria-label': title }, [
      el('div', { class: 'review-block__head' }, [
        el('h3', { text: title }),
        step ? el('button', { type: 'button', class: 'btn-text', 'data-edit': step, 'aria-label': `Edit ${title.toLowerCase()}`, text: 'Edit' }) : null,
      ]),
      rows.length ? el('dl', { class: 'info-list info-list--compact' }, rows.filter(([, v]) => v).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])) : null,
      extra || null,
    ]);
  }

  function renderReview() {
    const items = Cart.items();
    const zone = getZone();
    const method = getMethod();
    const t = O.totals(items, zone);
    const v = (f) => O.check(f, inputs[f].value).value;
    const due = method ? O.amountDue(method, zone, items) : null;
    const required = method ? O.requiredPaymentFields(method, zone) : [];
    const adv = getAdvanceMethod();

    const paymentRows = [['Method', method ? O.METHOD_NAMES[method] : '']];
    if (method === 'cod' && required.includes('advanceMethod')) paymentRows.push(['Advance', `${formatBDT(due)} by ${O.METHOD_NAMES[adv] || ''}`]);
    if (method && method !== 'cod' && due) paymentRows.push(['Amount', formatBDT(due)]);
    if (required.includes('sender')) paymentRows.push(['Sender number', v('sender')], ['TrxID', v('trxId')]);
    if (required.includes('depositor')) paymentRows.push(['Depositor', v('depositor')], ['Reference', v('bankRef')]);
    paymentRows.push(['Order reference', orderId()]);

    const itemList = el('ul', { class: 'summary__items' }, t.lines.map((l) =>
      el('li', {}, [el('span', { text: `${l.product.name}${isSet(l.product.variant) ? ` (${l.product.variant})` : ''} × ${l.qty}` }), el('span', { text: formatBDT(l.total) })])));

    review.replaceChildren(
      reviewBlock('Items', 0, [], el('div', {}, [itemList, el('a', { class: 'btn-text', href: 'cart.html', text: 'Edit cart' })])),
      reviewBlock('Delivery details', 1, [
        ['Name', v('name')], ['Mobile', v('phone')], ['Email', v('email')],
        ['Address', v('address')], ['Area', v('area')], ['District', v('district')], ['Note', v('note')],
      ]),
      reviewBlock('Delivery zone', 2, [
        ['Zone', zone ? O.ZONES[zone] : ''],
        ['Delivery charge', t.delivery === null ? 'Confirmed on WhatsApp' : formatBDT(t.delivery)],
        ['Total', `${formatBDT(t.total)}${t.delivery === null ? ' + delivery' : ''}`],
      ]),
      reviewBlock('Payment', 3, paymentRows)
    );
  }

  /* ---------- Place order ---------- */
  let submitting = false;
  confirmBox.addEventListener('change', () => {
    if (confirmBox.checked) setFieldError(confirmBox, '');
  });

  function buildOrder() {
    const customer = {};
    STEP1_FIELDS.forEach((f) => {
      customer[f] = O.check(f, inputs[f].value).value;
    });
    const zone = getZone();
    const method = getMethod();
    const payment = { method };
    const required = O.requiredPaymentFields(method, zone);
    if (required.includes('advanceMethod')) payment.advanceMethod = getAdvanceMethod();
    PAYMENT_FIELDS.forEach((f) => {
      if (required.includes(f)) payment[f] = O.check(f, inputs[f].value).value;
    });
    return { v: 1, id: orderId(), createdAt: new Date().toISOString(), items: Cart.items(), zone, customer, payment, paymentStatus: 'pending_verification' };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!Cart.items().length) {
      root.replaceChildren(emptyNotice());
      return;
    }
    // Re-validate every step before placing the order
    for (const n of [1, 2, 3]) {
      const bad = validateStep(n);
      if (bad) {
        showStep(n, { focus: false });
        validateStep(n); // showStep cleared the status, re-mark the fields
        reportInvalid(bad);
        return;
      }
    }
    renderReview();
    if (!confirmBox.checked) {
      setFieldError(confirmBox, 'Please confirm that your details are correct.');
      reportInvalid(confirmBox);
      return;
    }

    // Bots fill the hidden honeypot field: pretend it worked, store and send nothing.
    if (honeypot && honeypot.value !== '') {
      status.className = 'form-status is-success';
      status.textContent = 'Thank you.';
      return;
    }

    // Simple client-side rate limit: one order every 30 seconds
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_ORDER_AT_KEY)) || 0;
    } catch {
      /* storage blocked */
    }
    const wait = RATE_LIMIT_MS - (Date.now() - last);
    if (last && wait > 0 && wait <= RATE_LIMIT_MS) {
      status.className = 'form-status is-error';
      status.textContent = `You just placed an order. Please wait ${Math.ceil(wait / 1000)} seconds before placing another one.`;
      status.focus();
      return;
    }

    submitting = true;
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order…';
    try {
      const draft = buildOrder();
      const result = await PaymentProviders.get(CFG.paymentProvider).startPayment(draft);
      draft.paymentStatus = result.status;
      const order = O.restore(draft); // same strict check the confirmation page uses
      if (!order) throw new Error('Order failed validation');
      O.save(order);
      try {
        localStorage.setItem(LAST_ORDER_AT_KEY, String(Date.now()));
        sessionStorage.removeItem(ORDER_ID_KEY);
        sessionStorage.removeItem('zw-order-sent');
        sessionStorage.removeItem('zw-webhook-sent');
      } catch {
        /* storage blocked */
      }
      const next = result.redirectUrl && /^https:\/\//.test(result.redirectUrl) ? result.redirectUrl : 'order-confirmation.html';
      window.location.assign(next);
    } catch {
      submitting = false;
      placeBtn.disabled = false;
      placeBtn.textContent = 'Place order';
      status.className = 'form-status is-error';
      status.textContent = 'Sorry, something went wrong. Please try again, or send us your order on WhatsApp.';
      status.focus();
    }
  });

  document.addEventListener('cart:change', () => {
    if (!Cart.items().length) root.replaceChildren(emptyNotice());
    else updateSummary();
  });

  updateSummary();
  showStep(1, { focus: false });
})();
