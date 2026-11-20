/**
 * Order rules shared by checkout.html and order-confirmation.html:
 * validation of every customer and payment field, configured payment methods,
 * totals (always recomputed from js/products.js and js/config.js), the order ID
 * and the WhatsApp message.
 */
'use strict';

const ZWOrder = (() => {
  const CFG = ZW.CFG; // STORE_CONFIG, with demo samples filled in while demo mode is on
  const { sanitizeLine, sanitizeMultiline, sanitizeEmail, isValidEmail, normalizeBDMobile, isValidBDMobile } = ZW;

  // Demo orders are ZW-DEMO-YYMMDD-XXXX, and are only accepted while demo mode is on.
  const ORDER_PREFIX = ZW.IS_DEMO ? DEMO.ORDER_PREFIX : 'ZW-';
  const ORDER_ID_RE = ZW.IS_DEMO ? /^ZW-DEMO-\d{6}-[A-HJ-NP-Z2-9]{4}$/ : /^ZW-\d{6}-[A-HJ-NP-Z2-9]{4}$/;
  const TRXID_RE = /^[A-Z0-9]{6,20}$/;
  const BANKREF_RE = /^[A-Z0-9/-]{4,30}$/;
  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;
  const MOBILE_METHODS = ['bkash', 'nagad', 'rocket'];
  const METHOD_NAMES = Object.freeze({ cod: 'Cash on Delivery', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank transfer' });
  const ZONES = Object.freeze({ inside: 'Inside Dhaka', outside: 'Outside Dhaka' });
  const STATUS_LABELS = Object.freeze({
    pending_verification: 'Pending verification',
    pay_on_delivery: 'Pay on delivery',
    advance_pending_verification: 'Advance pending verification, rest on delivery',
    advance_to_arrange: 'Pay on delivery (we will arrange the advance on WhatsApp)',
  });

  /* ---------- Order ID: ZW-YYMMDD-XXXX ---------- */
  function newOrderId(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = `${String(date.getFullYear()).slice(2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters, no 0/O or 1/I
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return `${ORDER_PREFIX}${ymd}-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
  }

  /* ---------- Payment methods from config ---------- */
  /** A mobile wallet method, only when its number and account type are filled in and valid. */
  function mobileMethod(key) {
    const m = CFG.payments[key];
    if (!MOBILE_METHODS.includes(key) || !m || m.enabled !== true) return null;
    // Demo mode: the placeholder number 01XXXXXXXXX is shown as is, marked as a demo number.
    const demo = ZW.isDemoValue(`payments.${key}`);
    const number = demo ? m.number : normalizeBDMobile(m.number);
    if ((!demo && !isValidBDMobile(number)) || !['Merchant', 'Personal'].includes(m.accountType)) return null;
    return { key, name: METHOD_NAMES[key], number, accountType: m.accountType, demo };
  }

  function bankDetails() {
    const b = CFG.payments.bank;
    if (!b || b.enabled !== true || ![b.bankName, b.accountName, b.accountNumber].every(isSet)) return null;
    const line = (v) => (isSet(v) ? sanitizeLine(v, 120) : null);
    return {
      bankName: line(b.bankName), accountName: line(b.accountName), accountNumber: line(b.accountNumber), branch: line(b.branch), routingNumber: line(b.routingNumber),
      demo: ZW.isDemoValue('payments.bank'),
    };
  }

  function availableMethods() {
    const list = [];
    if (CFG.cod.enabled === true) list.push('cod');
    MOBILE_METHODS.forEach((k) => {
      if (mobileMethod(k)) list.push(k);
    });
    if (bankDetails()) list.push('bank');
    return list;
  }

  function availableMobileMethods() {
    return MOBILE_METHODS.map(mobileMethod).filter(Boolean);
  }

  /** COD advance for a zone: { required, amount } (amount null = not known yet, arrange on WhatsApp). */
  function advanceInfo(zone) {
    const rule = CFG.cod.advanceRequired;
    if (rule === 'deliveryCharge') {
      const charge = ZW.deliveryCharge(zone);
      if (charge === 0) return { required: false, amount: null };
      return { required: true, amount: charge };
    }
    if (Number.isInteger(rule) && rule > 0) return { required: true, amount: rule };
    return { required: false, amount: null }; // 0 or not set yet
  }

  /* ---------- Totals (never from storage) ---------- */
  function lineItems(items) {
    return items
      .map(({ id, qty }) => {
        const product = getProduct(id);
        if (!ZW.isBuyable(product)) return null;
        const q = ZW.clampQty(qty);
        return { product, qty: q, unit: priceOf(product), total: priceOf(product) * q };
      })
      .filter(Boolean);
  }

  function totals(items, zone) {
    const lines = lineItems(items);
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const delivery = ZONES[zone] ? ZW.deliveryCharge(zone) : null;
    // Demo flags: show the "Sample" tag next to amounts built from demo prices or charges.
    const demoPrices = lines.some((l) => isDemoPrice(l.product));
    const demoDelivery = delivery !== null && ZW.isDemoDelivery(zone);
    return { lines, subtotal, delivery, total: subtotal + (delivery || 0), demoPrices, demoDelivery, demoTotal: demoPrices || demoDelivery };
  }

  /** What the customer pays before delivery for a given method. null = nothing / not known. */
  function amountDue(method, zone, items) {
    if (method === 'cod') {
      const adv = advanceInfo(zone);
      return adv.required ? adv.amount : null;
    }
    return totals(items, zone).total;
  }

  /* ---------- Field validation (returns an error message or '') ---------- */
  const clean = {
    name: (v) => sanitizeLine(v, 81),
    phone: (v) => normalizeBDMobile(v),
    email: (v) => sanitizeEmail(v),
    district: (v) => sanitizeLine(v, 40),
    area: (v) => sanitizeLine(v, 81),
    address: (v) => sanitizeMultiline(v, 251),
    note: (v) => sanitizeMultiline(v, 301),
    sender: (v) => normalizeBDMobile(v),
    trxId: (v) => sanitizeLine(v, 40).replace(/\s+/g, '').toUpperCase(),
    depositor: (v) => sanitizeLine(v, 81),
    bankRef: (v) => sanitizeLine(v, 40).replace(/\s+/g, '').toUpperCase(),
  };

  const rules = {
    name(v) {
      if (!v) return 'Please enter your full name.';
      if (v.length < 2) return 'Name must be at least 2 characters.';
      if (v.length > 80) return 'Name must be 80 characters or fewer.';
      if (!NAME_RE.test(v)) return 'Name can only contain letters, spaces, apostrophes, hyphens and full stops.';
      return '';
    },
    phone(v) {
      if (!v) return 'Please enter your mobile number.';
      return isValidBDMobile(v) ? '' : 'Please enter a Bangladeshi mobile number, for example 01712345678.';
    },
    email(v) {
      if (!v) return '';
      return isValidEmail(v) ? '' : 'Please enter a valid email address, or leave it empty.';
    },
    district(v) {
      return BD_DISTRICTS.includes(v) ? '' : 'Please choose your district.';
    },
    area(v) {
      if (!v) return 'Please enter your upazila, thana or area.';
      if (v.length < 2) return 'Area must be at least 2 characters.';
      return v.length > 80 ? 'Area must be 80 characters or fewer.' : '';
    },
    address(v) {
      if (!v) return 'Please enter your full address.';
      if (v.length < 10) return 'Address must be at least 10 characters so the courier can find you.';
      return v.length > 250 ? 'Address must be 250 characters or fewer.' : '';
    },
    note(v) {
      return v.length > 300 ? 'Note must be 300 characters or fewer.' : '';
    },
    sender(v) {
      if (!v) return 'Please enter the number you paid from.';
      return isValidBDMobile(v) ? '' : 'Please enter a Bangladeshi mobile number, for example 01712345678.';
    },
    trxId(v) {
      if (!v) return 'Please enter the transaction ID (TrxID).';
      return TRXID_RE.test(v) ? '' : 'The TrxID should be 6 to 20 letters and numbers, as shown in your confirmation SMS.';
    },
    depositor(v) {
      if (!v) return 'Please enter the depositor name.';
      if (v.length < 2 || v.length > 80) return 'Depositor name must be 2 to 80 characters.';
      return NAME_RE.test(v) ? '' : 'Depositor name can only contain letters, spaces, apostrophes, hyphens and full stops.';
    },
    bankRef(v) {
      if (!v) return 'Please enter the transaction or reference number.';
      return BANKREF_RE.test(v) ? '' : 'The reference should be 4 to 30 letters, numbers, hyphens or slashes.';
    },
  };

  /** Sanitises then validates one field. Returns { value, error }. */
  function check(field, raw) {
    const value = clean[field](raw);
    return { value, error: rules[field](value) };
  }

  /** Which payment fields a method needs. */
  function requiredPaymentFields(method, zone) {
    if (MOBILE_METHODS.includes(method)) return ['sender', 'trxId'];
    if (method === 'bank') return ['depositor', 'bankRef'];
    if (method === 'cod') {
      const adv = advanceInfo(zone);
      if (adv.required && adv.amount && availableMobileMethods().length) return ['advanceMethod', 'sender', 'trxId'];
    }
    return [];
  }

  /* ---------- Restoring a stored order (sessionStorage is never trusted) ---------- */
  const STORAGE_KEY = 'zw-last-order';

  function restore(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
    if (typeof raw.id !== 'string' || !ORDER_ID_RE.test(raw.id)) return null;
    const created = new Date(raw.createdAt);
    if (Number.isNaN(created.getTime())) return null;
    if (!Array.isArray(raw.items)) return null;
    const items = raw.items
      .slice(0, 50)
      .filter((i) => i && typeof i.id === 'string' && Number.isInteger(i.qty) && i.qty >= 1 && ZW.isBuyable(getProduct(i.id)))
      .map((i) => ({ id: i.id, qty: ZW.clampQty(i.qty) }));
    if (!items.length) return null;
    if (!Object.hasOwn(ZONES, raw.zone)) return null;

    const c = raw.customer && typeof raw.customer === 'object' ? raw.customer : {};
    const customer = {};
    for (const field of ['name', 'phone', 'email', 'district', 'area', 'address', 'note']) {
      const { value, error } = check(field, typeof c[field] === 'string' ? c[field] : '');
      if (error) return null;
      customer[field] = value;
    }

    const p = raw.payment && typeof raw.payment === 'object' ? raw.payment : {};
    if (!Object.hasOwn(METHOD_NAMES, p.method)) return null;
    const payment = { method: p.method };
    for (const field of ['sender', 'trxId', 'depositor', 'bankRef']) {
      if (typeof p[field] === 'string' && p[field]) {
        const { value, error } = check(field, p[field]);
        if (error) return null;
        payment[field] = value;
      }
    }
    if (p.advanceMethod) {
      if (!MOBILE_METHODS.includes(p.advanceMethod)) return null;
      payment.advanceMethod = p.advanceMethod;
    }
    const paymentStatus = Object.hasOwn(STATUS_LABELS, raw.paymentStatus) ? raw.paymentStatus : 'pending_verification';
    return { v: 1, id: raw.id, createdAt: created.toISOString(), items, zone: raw.zone, customer, payment, paymentStatus };
  }

  function load() {
    try {
      return restore(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'));
    } catch {
      return null;
    }
  }

  function save(order) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }

  /* ---------- WhatsApp message ---------- */
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function whatsappMessage(order) {
    const t = totals(order.items, order.zone);
    const c = order.customer;
    const p = order.payment;
    const lines = [
      ZW.IS_DEMO ? DEMO.WHATSAPP_HEADER : null,
      `*New order ${order.id}*`,
      `Date: ${formatDate(order.createdAt)}`,
      '',
      '*Items*',
      ...t.lines.map((l, i) => {
        const variant = isSet(l.product.variant) ? ` (${l.product.variant})` : '';
        return `${i + 1}. ${l.product.name}${variant} x ${l.qty} = ${formatBDT(l.total)}`;
      }),
      '',
      `Subtotal: ${formatBDT(t.subtotal)}`,
      `Delivery (${ZONES[order.zone]}): ${t.delivery === null ? 'please confirm' : formatBDT(t.delivery)}`,
      `Total: ${formatBDT(t.total)}${t.delivery === null ? ' + delivery' : ''}`,
      '',
      '*Customer*',
      `Name: ${c.name}`,
      `Phone: ${c.phone}`,
      c.email ? `Email: ${c.email}` : null,
      `Address: ${c.address.replace(/\n/g, ', ')}, ${c.area}, ${c.district}`,
      c.note ? `Note: ${c.note.replace(/\n/g, ' ')}` : null,
      '',
      '*Payment*',
      `Method: ${METHOD_NAMES[p.method]}`,
      `Status: ${STATUS_LABELS[order.paymentStatus]}`,
    ];
    const due = amountDue(p.method, order.zone, order.items);
    if (p.method === 'cod' && p.advanceMethod) {
      lines.push(`Advance: ${due ? formatBDT(due) : ''} by ${METHOD_NAMES[p.advanceMethod]}`);
    } else if (p.method !== 'cod' && due) {
      lines.push(`Amount paid: ${formatBDT(due)}`);
    }
    if (p.sender) lines.push(`Sender number: ${p.sender}`);
    if (p.trxId) lines.push(`TrxID: ${p.trxId}`);
    if (p.depositor) lines.push(`Depositor: ${p.depositor}`);
    if (p.bankRef) lines.push(`Bank reference: ${p.bankRef}`);
    if (p.method === 'bank') lines.push('I will send the deposit slip photo in this chat.');
    return lines.filter((l) => l !== null).join('\n');
  }

  return {
    ORDER_ID_RE,
    MOBILE_METHODS,
    METHOD_NAMES,
    ZONES,
    STATUS_LABELS,
    newOrderId,
    mobileMethod,
    bankDetails,
    availableMethods,
    availableMobileMethods,
    advanceInfo,
    totals,
    amountDue,
    check,
    requiredPaymentFields,
    restore,
    load,
    save,
    formatDate,
    whatsappMessage,
  };
})();
