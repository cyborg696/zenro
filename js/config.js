/**
 * ZENRO Wrist & Co. — store settings (the only file the owner normally needs to edit,
 * together with js/products.js).
 *
 * How placeholders work
 *  - Any value still set to 'TODO_OWNER' (or left empty) counts as "not provided yet".
 *    The site then hides that line, or shows "Ask us on WhatsApp", so visitors never
 *    see invented or empty details.
 *  - Replace a placeholder with the real value and reload the page. No build step.
 *
 * SECURITY: this file is public. Never put passwords, PINs, API keys, merchant
 * secrets or store passwords here. Only put details customers are meant to see.
 */
'use strict';

const STORE_CONFIG = (() => {
  const deepFreeze = (obj) => {
    Object.values(obj).forEach((v) => {
      if (v && typeof v === 'object') deepFreeze(v);
    });
    return Object.freeze(obj);
  };

  return deepFreeze({
    /* ---------- Site address ----------
     * The live address of the website, e.g. 'https://zenrowrist.com/' or
     * 'https://<username>.github.io/<repo>/'. Used by tools/stamp.mjs for link previews
     * (og:url, og:image), sitemap.xml and robots.txt. Run `npm run stamp` after changing it. */
    siteUrl: 'https://cyborg696.github.io/zenro/',

    /* ---------- Contact (confirmed facts) ---------- */
    whatsapp: '8801960520872', // international format, digits only (used for https://wa.me/...)
    whatsappDisplay: '01960520872', // how the number is shown on the site
    instagram: 'https://www.instagram.com/zenro_wrist_co/',
    facebook: 'https://www.facebook.com/profile.php?id=61594772414204',
    location: 'Chandpur, Bangladesh',

    /* ---------- Delivery ----------
     * insideDhaka / outsideDhaka: delivery charge in Taka as a whole number, e.g. 80
     * estimatedDays: short text, e.g. '1–2 days inside Dhaka, 2–4 days outside Dhaka' */
    delivery: {
      insideDhaka: 'TODO_OWNER',
      outsideDhaka: 'TODO_OWNER',
      estimatedDays: 'TODO_OWNER',
    },

    /* ---------- Cash on Delivery ----------
     * advanceRequired:
     *   0                 -> nothing to pay in advance
     *   'deliveryCharge'  -> customer pays the delivery charge first (bKash/Nagad/Rocket)
     *   a number, e.g. 500 -> customer pays that many Taka first
     * While it is 'TODO_OWNER' no advance is asked for at checkout. */
    cod: { enabled: true, advanceRequired: 'TODO_OWNER' },

    /* ---------- Payment numbers ----------
     * number: the 11-digit receiving number, e.g. '01XXXXXXXXX'
     * accountType: 'Merchant' (customer uses "Payment") or 'Personal' (customer uses "Send Money")
     * A method is hidden at checkout until its details are filled in and valid. */
    payments: {
      bkash: { enabled: true, number: 'TODO_OWNER', accountType: 'TODO_OWNER' },
      nagad: { enabled: true, number: 'TODO_OWNER', accountType: 'TODO_OWNER' },
      rocket: { enabled: true, number: 'TODO_OWNER', accountType: 'TODO_OWNER' },
      // bankName, accountName and accountNumber are required; branch and routingNumber are shown if filled in.
      bank: {
        enabled: true,
        bankName: 'TODO_OWNER',
        accountName: 'TODO_OWNER',
        accountNumber: 'TODO_OWNER',
        branch: 'TODO_OWNER',
        routingNumber: 'TODO_OWNER',
      },
    },

    /* Optional official logo files you have permission to use, e.g.
     * { bkash: 'images/payments/bkash.svg' }. Until then the method names are shown as plain text. */
    paymentLogos: {},

    /* ---------- Product condition labels ----------
     * The allowed values for `condition` in js/products.js, e.g.
     * ['Original', 'Pre-owned', 'Homage / Inspired design'].
     * A product only shows a condition badge when its value is in this list. */
    conditions: ['TODO_OWNER'],

    /* ---------- Policies (short text, shown in the footer, product pages and policy pages) ---------- */
    warranty: 'TODO_OWNER', // e.g. '6-month service warranty on the movement'
    returnPolicy: 'TODO_OWNER', // e.g. 'Exchange within 3 days if the watch arrives damaged'

    /* ---------- About page ----------
     * The longer story paragraph on the About page. Hidden until filled in. */
    aboutStory: 'TODO_OWNER',

    /* ---------- Shop price filter ----------
     * Boundaries in Taka. [5000, 10000, 20000] gives:
     * Under ৳5,000 / ৳5,000 to ৳10,000 / ৳10,000 to ৳20,000 / Over ৳20,000 */
    priceRanges: [5000, 10000, 20000],

    /* ---------- Orders ----------
     * paymentProvider: 'manual' = Phase A (payment verified by hand, order sent on WhatsApp).
     * See docs/PAYMENT_GATEWAY.md before changing this. */
    paymentProvider: 'manual',

    /* Optional second copy of every order (besides WhatsApp).
     * orderWebhookUrl: e.g. 'https://formspree.io/f/abcdwxyz' or a Google Apps Script web app URL.
     * webhookAllowedOrigins: the origins the order may be sent to. After changing them run
     *   `npm run stamp`, which adds them to connect-src in order-confirmation.html only, e.g.
     *   Formspree:          ['https://formspree.io']
     *   Google Apps Script: ['https://script.google.com', 'https://script.googleusercontent.com']
     * Leave the URL empty to switch this off. */
    orderWebhookUrl: '',
    webhookAllowedOrigins: [],

    /* ---------- Customer reviews ----------
     * Only add reviews you have the customer's permission to publish. Example:
     * { name: 'Rahim', city: 'Dhaka', text: 'Got my watch in two days.', image: 'images/reviews/rahim.webp' }
     * image is optional and must be inside images/reviews/. The section is hidden while this list is empty. */
    reviews: [],
  });
})();
