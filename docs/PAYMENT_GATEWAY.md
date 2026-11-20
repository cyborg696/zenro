# Payments: today (Phase A) and the upgrade path (Phase B)

## Phase A: what the site does now

GitHub Pages only serves static files. There is no server, so the site **cannot take or check payments by itself**.

1. The customer checks out and picks one of:
   - Cash on Delivery
   - bKash
   - Nagad
   - Rocket
   - Bank transfer
2. For bKash, Nagad, Rocket and bank transfer, checkout shows your receiving number or bank details from `js/config.js`. The customer pays in their own app, then types in the sender number and the transaction ID (TrxID), or the depositor name and reference.
3. On the confirmation page the customer taps **Send order on WhatsApp**. This opens WhatsApp with the full order ready to send to `01960520872`. **That message is how you receive the order.** Nothing reaches you if the customer does not send it.
4. You check the payment in your bKash, Nagad, Rocket or bank statement, then confirm the order on WhatsApp.

The code for this lives in `js/payments/manual.js` (the "manual" provider) and `js/checkout.js`.

### Optional: a second copy of every order (webhook)

You can also have each order sent automatically to a form service, so you keep a record even if a customer forgets to send the WhatsApp message.

Before you set this up:

- The copy is sent from the confirmation page, so it is only sent when the customer reaches that page.
- The browser sends it. Treat it as a record of what the customer entered, **not** as proof that they paid.

**Formspree (recommended, simplest):**

1. Create a form at formspree.io. You get an endpoint like `https://formspree.io/f/abcdwxyz`.
2. In `js/config.js`:
   ```js
   orderWebhookUrl: 'https://formspree.io/f/abcdwxyz',
   webhookAllowedOrigins: ['https://formspree.io'],
   ```
3. Run `npm run stamp`. This adds the origin to `connect-src` in the Content-Security-Policy of `order-confirmation.html`, and only that page:
   ```
   connect-src 'self' https://formspree.io;
   ```
   Formspree receives the order as JSON.

**Google Apps Script (writes each order to a Google Sheet):**

1. Deploy a script as a web app that is accessible by "Anyone". In `doPost(e)`, read the order with `JSON.parse(e.postData.contents)` and append a row.
2. A request to `script.google.com` is redirected to `script.googleusercontent.com`, so **both** origins must be allowed. Set them in `js/config.js`, then run `npm run stamp`. That writes the `connect-src` line below:
   ```js
   orderWebhookUrl: 'https://script.google.com/macros/s/XXXX/exec',
   webhookAllowedOrigins: ['https://script.google.com', 'https://script.googleusercontent.com'],
   ```
   ```
   connect-src 'self' https://script.google.com https://script.googleusercontent.com;
   ```
3. The site sends Apps Script requests with `Content-Type: text/plain`. This avoids a CORS "preflight" request, which Apps Script does not answer.

**Safety checks the site applies:**

- The site sends nothing unless the URL is `https`.
- Its origin must be listed in `webhookAllowedOrigins`.
- Every origin in that list must also appear in the page's `connect-src`.
- Each order is sent at most once per browser tab.

Add only the exact origins you need. Never add a wildcard.

---

## Phase B: live online payments (not built yet)

**Do not put Store IDs, passwords, API keys or app secrets in this website.** Everything in the site is public. Anyone can read `js/config.js`.

A live gateway always needs **a small server** that you control. A serverless function is enough:

- Cloudflare Workers
- Netlify Functions
- Vercel Functions

The server:

1. Keeps the gateway credentials (Store ID, Store password, app key or secret) as environment variables.
2. Receives the order from the website. It recomputes the total from its own copy of the catalogue and delivery charges, and **never trusts prices sent by the browser**.
3. Creates the payment session with the gateway and returns the gateway's hosted payment URL.
4. Receives the gateway's server-to-server notification (IPN or callback). It calls the gateway's **validation API** to confirm the amount, currency and transaction status.
5. Only then marks the order as paid and notifies you, for example by WhatsApp Business API, email or a Google Sheet.

**The browser must never be trusted to say a payment succeeded.** A "success" redirect back to the website can be faked. Only the server-side validation counts.

### Option 1: SSLCommerz hosted payment page (recommended)

- One integration covers bKash, Nagad, Rocket, Visa/Mastercard/Amex and internet banking.
- The customer pays on SSLCommerz's own page, so card data never touches your site.
- **You need a merchant account.** SSLCommerz asks for a trade licence, the owner's NID and bank account details. A sandbox (test) account is available for development.
- **The flow:**
  1. Your server calls the session API with the order and amount.
  2. The customer is redirected to `GatewayPageURL`.
  3. SSLCommerz posts the result to your IPN URL.
  4. Your server calls the validation API with the `val_id`.

### Option 2: bKash Tokenized Checkout (direct API)

- This needs a **bKash merchant account** and API credentials (app key, app secret, username and password). bKash issues these after approval.
- **The flow:**
  1. Your server gets a grant token.
  2. Your server creates a payment and redirects the customer to the bKash URL.
  3. The customer approves the payment in bKash.
  4. Your server executes the payment and queries its status before marking it paid.
- This option covers bKash only. Nagad and Rocket each need their own merchant agreement and integration.

### How the website side will change

The site already has a provider interface in `js/payments/provider.js`:

```js
{
  id: 'sslcommerz',
  startPayment(order) { /* POST order to your server, get { status, redirectUrl } */ },
  getStatus(orderId)  { /* ask your server for the verified status */ },
}
```

To switch over:

1. Add `js/payments/sslcommerz.js` (or `bkash.js`) that implements this interface and talks **only to your own server**.
2. Load it on `checkout.html` and `order-confirmation.html`.
3. Add your server's exact origin to `connect-src` in the CSP of those pages.
4. Set `paymentProvider: 'sslcommerz'` in `js/config.js`.

`checkout.js` already follows `redirectUrl` when a provider returns one. You can keep the manual methods (COD, and WhatsApp-verified transfers) alongside the gateway.
