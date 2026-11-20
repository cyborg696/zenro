/**
 * Order confirmation (Phase A).
 * Nothing reaches the owner until the customer sends the order on WhatsApp, so this
 * page puts the "Send order on WhatsApp" button first. The cart is cleared only after
 * that button is used. The order comes from sessionStorage (never from the URL) and is
 * re-validated against the catalogue before anything is shown.
 * Optional: a copy of the order is POSTed to STORE_CONFIG.orderWebhookUrl.
 */
'use strict';

(() => {
  const root = document.getElementById('confirm-root');
  const actions = document.getElementById('confirm-actions');
  const title = document.getElementById('page-title');
  const banner = document.getElementById('leave-banner');
  if (!root || !actions || !title || !banner) return;

  const { el, svgIcon, ICONS } = ZW;
  const O = ZWOrder;
  const CFG = STORE_CONFIG;
  const SENT_KEY = 'zw-order-sent';
  const WEBHOOK_KEY = 'zw-webhook-sent';

  const order = O.load();
  if (!order) {
    title.textContent = 'No order to show';
    root.replaceChildren(
      el('div', { class: 'notice' }, [
        el('h2', { text: 'We could not find a recent order in this tab' }),
        el('p', { text: 'If you already sent your order on WhatsApp, we will confirm it there.' }),
        el('div', { class: 'notice__actions' }, [
          el('a', { class: 'btn btn--dark', href: 'shop.html', text: 'Shop the Collection' }),
          ZW.externalLink(ZW.waLink('Hi ZENRO Wrist & Co., I have a question about my order.'), 'Message us on WhatsApp', 'btn btn--outline'),
        ]),
      ])
    );
    return;
  }

  const readFlag = (key) => {
    try {
      return sessionStorage.getItem(key) === order.id;
    } catch {
      return false;
    }
  };
  const setFlag = (key) => {
    try {
      sessionStorage.setItem(key, order.id);
    } catch {
      /* storage blocked */
    }
  };

  /* ---------- The main action: send the order on WhatsApp ---------- */
  const waHref = ZW.waLink(O.whatsappMessage(order));
  const waBtn = el('a', { class: 'btn btn--wa btn--xl', href: waHref, target: '_blank', rel: 'noopener noreferrer' }, [
    svgIcon(ICONS.whatsapp), 'Send order on WhatsApp',
  ]);
  const note = el('p', { class: 'confirm-note', role: 'status', 'aria-live': 'polite', text: 'Your order is not confirmed until we receive this message.' });
  actions.replaceChildren(waBtn, note);

  let sent = readFlag(SENT_KEY);

  function showSentState() {
    title.textContent = 'Order sent. We will confirm on WhatsApp shortly.';
    note.textContent = 'Did WhatsApp not open, or did you not tap send? Tap the button again to send your order.';
    banner.hidden = true;
  }

  function markSent() {
    if (!sent) {
      sent = true;
      setFlag(SENT_KEY);
      ZW.Cart.clear(); // only now, once the order has gone to WhatsApp
    }
    showSentState();
  }

  waBtn.addEventListener('click', markSent);
  waBtn.addEventListener('auxclick', markSent);
  if (sent) showSentState();

  /* ---------- Order summary ---------- */
  const t = O.totals(order.items, order.zone);
  const c = order.customer;
  const p = order.payment;
  const due = O.amountDue(p.method, order.zone, order.items);

  const dl = (rows) => el('dl', { class: 'info-list info-list--compact' },
    rows.filter(([, v]) => v).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));

  const paymentRows = [
    ['Method', O.METHOD_NAMES[p.method]],
    ['Payment status', O.STATUS_LABELS[order.paymentStatus]],
  ];
  if (p.method === 'cod' && p.advanceMethod && due) paymentRows.push(['Advance', `${formatBDT(due)} by ${O.METHOD_NAMES[p.advanceMethod]}`]);
  if (p.method !== 'cod' && due) paymentRows.push(['Amount', formatBDT(due)]);
  paymentRows.push(['Sender number', p.sender], ['TrxID', p.trxId], ['Depositor', p.depositor], ['Bank reference', p.bankRef]);

  root.replaceChildren(
    el('div', { class: 'confirm' }, [
      el('section', { class: 'confirm__card', 'aria-labelledby': 'order-heading' }, [
        el('h2', { id: 'order-heading', text: `Order ${order.id}` }),
        el('p', { class: 'form-note', text: `Placed ${O.formatDate(order.createdAt)}` }),
        el('ul', { class: 'summary__items' }, t.lines.map((l) =>
          el('li', {}, [
            el('span', { text: `${l.product.name}${isSet(l.product.variant) ? ` (${l.product.variant})` : ''} × ${l.qty}` }),
            el('span', { text: formatBDT(l.total) }),
          ]))),
        dl([
          ['Subtotal', formatBDT(t.subtotal)],
          [`Delivery (${O.ZONES[order.zone]})`, t.delivery === null ? 'Confirmed on WhatsApp' : formatBDT(t.delivery)],
          ['Total', `${formatBDT(t.total)}${t.delivery === null ? ' + delivery' : ''}`],
        ]),
      ]),
      el('section', { class: 'confirm__card', 'aria-labelledby': 'delivery-heading' }, [
        el('h2', { id: 'delivery-heading', text: 'Delivery' }),
        dl([
          ['Name', c.name], ['Mobile', c.phone], ['Email', c.email],
          ['Address', `${c.address}, ${c.area}, ${c.district}`], ['Note', c.note],
        ]),
      ]),
      el('section', { class: 'confirm__card', 'aria-labelledby': 'payment-heading' }, [
        el('h2', { id: 'payment-heading', text: 'Payment' }),
        dl(paymentRows),
        p.method === 'bank' ? el('p', { class: 'form-note', text: 'Please also send a photo of your deposit slip in the WhatsApp chat.' }) : null,
        p.method !== 'cod' || p.advanceMethod
          ? el('p', { class: 'form-note', text: 'We check every payment by hand before we confirm your order.' })
          : null,
      ]),
      el('div', { class: 'notice__actions' }, [el('a', { class: 'btn btn--outline', href: 'shop.html', text: 'Continue shopping' })]),
    ])
  );

  /* ---------- Gentle reminder if the customer leaves without sending ---------- */
  let reminded = false;
  function remind() {
    if (sent || reminded) return false;
    reminded = true;
    const sendNow = el('a', { class: 'btn btn--wa', href: waHref, target: '_blank', rel: 'noopener noreferrer', text: 'Send order on WhatsApp' });
    sendNow.addEventListener('click', markSent);
    const close = el('button', { type: 'button', class: 'leave-banner__close', 'aria-label': 'Dismiss reminder', text: '×' });
    close.addEventListener('click', () => {
      banner.hidden = true;
    });
    banner.replaceChildren(el('div', { class: 'container leave-banner__inner' }, [
      el('p', {}, [el('strong', { text: 'Your order has not been sent yet. ' }), 'We only receive it when you send it on WhatsApp.']),
      sendNow,
      close,
    ]));
    banner.hidden = false;
    return true;
  }
  // First click on a link that leaves this page shows the reminder instead; a second click leaves.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || link.target === '_blank' || actions.contains(link) || banner.contains(link)) return;
    if (remind()) e.preventDefault();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') remind(); // seen when they come back to the tab
  });

  /* ---------- Optional webhook (second copy of the order) ---------- */
  function sendWebhook() {
    const url = CFG.orderWebhookUrl;
    if (typeof url !== 'string' || !url || readFlag(WEBHOOK_KEY)) return;
    let endpoint;
    try {
      endpoint = new URL(url);
    } catch {
      return;
    }
    const allowed = Array.isArray(CFG.webhookAllowedOrigins) ? CFG.webhookAllowedOrigins : [];
    if (endpoint.protocol !== 'https:' || !allowed.includes(endpoint.origin)) return;
    // Every allowed origin must also be in this page's CSP connect-src, or the browser blocks the request.
    const csp = (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '';
    const connect = ((csp.match(/connect-src([^;]*)/) || [])[1] || '').trim().split(/\s+/);
    if (!allowed.every((origin) => connect.includes(origin))) return;

    const payload = {
      _subject: `New order ${order.id}`,
      source: 'zenro-website',
      orderId: order.id,
      createdAt: order.createdAt,
      items: t.lines.map((l) => ({ id: l.product.id, name: l.product.name, variant: isSet(l.product.variant) ? l.product.variant : '', qty: l.qty, unitPrice: l.unit, lineTotal: l.total })),
      subtotal: t.subtotal,
      deliveryZone: O.ZONES[order.zone],
      deliveryCharge: t.delivery,
      total: t.total,
      currency: 'BDT',
      customer: { ...c },
      payment: { method: O.METHOD_NAMES[p.method], status: O.STATUS_LABELS[order.paymentStatus], amountDue: due, advanceMethod: p.advanceMethod ? O.METHOD_NAMES[p.advanceMethod] : '', sender: p.sender || '', trxId: p.trxId || '', depositor: p.depositor || '', bankRef: p.bankRef || '' },
    };
    // Google Apps Script: text/plain avoids a CORS preflight. Others (e.g. Formspree): JSON.
    const appsScript = endpoint.origin === 'https://script.google.com';
    fetch(endpoint.href, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      headers: appsScript ? { 'Content-Type': 'text/plain;charset=utf-8' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) setFlag(WEBHOOK_KEY);
      })
      .catch(() => {
        /* silent: WhatsApp is the main channel */
      });
  }
  sendWebhook();
})();
