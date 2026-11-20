/**
 * Payment provider registry.
 *
 * Every provider implements the same small interface, so checkout does not need to
 * change when a live gateway is added (see docs/PAYMENT_GATEWAY.md):
 *
 *   {
 *     id: 'manual',
 *     // Starts payment for a validated order. Resolves with
 *     //   { status: 'pending_verification' | 'pay_on_delivery' | 'advance_pending_verification' | 'advance_to_arrange',
 *     //     redirectUrl: null | 'https://...' }   // a gateway would return its hosted payment page here
 *     startPayment(order) => Promise<{ status, redirectUrl }>,
 *     // Looks up the latest known status of an order (a gateway would ask its own server).
 *     getStatus(orderId) => Promise<string>,
 *   }
 *
 * SECURITY: providers run in the browser. They must never contain store passwords, API keys
 * or app secrets, and must never mark an order as paid on their own. A live gateway's
 * provider only talks to the store's own server, which verifies every payment.
 */
'use strict';

const PaymentProviders = (() => {
  const registry = new Map();
  return Object.freeze({
    register(provider) {
      if (!provider || typeof provider.id !== 'string' || typeof provider.startPayment !== 'function' || typeof provider.getStatus !== 'function') {
        throw new TypeError('Invalid payment provider');
      }
      registry.set(provider.id, Object.freeze(provider));
    },
    /** The configured provider, falling back to the manual one. */
    get(id) {
      return registry.get(id) || registry.get('manual');
    },
  });
})();
