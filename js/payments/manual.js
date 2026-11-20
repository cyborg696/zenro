/**
 * Phase A provider: manual verification.
 * Nothing is charged online. The customer pays by Cash on Delivery or sends money by
 * bKash / Nagad / Rocket / bank transfer, then sends the order (with the TrxID) on
 * WhatsApp. The owner checks the payment by hand before confirming the order.
 */
'use strict';

PaymentProviders.register({
  id: 'manual',

  startPayment(order) {
    let status = 'pending_verification';
    if (order.payment.method === 'cod') {
      const advance = ZWOrder.advanceInfo(order.zone);
      if (!advance.required) status = 'pay_on_delivery';
      else if (order.payment.advanceMethod && order.payment.trxId) status = 'advance_pending_verification';
      else status = 'advance_to_arrange';
    }
    return Promise.resolve({ status, redirectUrl: null });
  },

  getStatus(orderId) {
    const order = ZWOrder.load();
    return Promise.resolve(order && order.id === orderId ? order.paymentStatus : 'unknown');
  },
});
