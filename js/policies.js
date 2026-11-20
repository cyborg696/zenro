/** Delivery and privacy pages: text that depends on several config values at once. */
'use strict';

(() => {
  const { el } = ZW;
  const CFG = STORE_CONFIG;

  /** COD advance rule in words, or null when the owner has not decided it yet. */
  function advanceSentence() {
    const rule = CFG.cod.advanceRequired;
    if (rule === 0) return 'No advance payment is needed for Cash on Delivery.';
    if (rule === 'deliveryCharge') return 'For Cash on Delivery, please pay the delivery charge in advance by bKash, Nagad or Rocket. You pay the rest to the courier.';
    if (Number.isInteger(rule) && rule > 0) return `For Cash on Delivery, please pay ${formatBDT(rule)} in advance by bKash, Nagad or Rocket. You pay the rest to the courier.`;
    return null;
  }

  const advance = advanceSentence();
  const advanceText = document.getElementById('advance-text');
  if (advanceText && advance) {
    advanceText.textContent = advance;
    advanceText.hidden = false;
  }

  const faqAdvance = document.getElementById('faq-advance');
  if (faqAdvance) {
    faqAdvance.replaceChildren(advance || ZW.askOnWhatsApp('Hi ZENRO Wrist & Co., do I need to pay anything in advance for Cash on Delivery?'));
  }

  const faqCharges = document.getElementById('faq-charges');
  if (faqCharges) {
    const inside = ZW.deliveryCharge('inside');
    const outside = ZW.deliveryCharge('outside');
    faqCharges.replaceChildren(
      inside !== null && outside !== null
        ? `${formatBDT(inside)} inside Dhaka and ${formatBDT(outside)} outside Dhaka.`
        : el('span', {}, ['It depends on where you live. ', ZW.askOnWhatsApp('Hi ZENRO Wrist & Co., what is the delivery charge to my area?')])
    );
  }

  const webhookNote = document.getElementById('privacy-webhook');
  if (webhookNote && typeof CFG.orderWebhookUrl === 'string' && CFG.orderWebhookUrl.startsWith('https://')) {
    webhookNote.hidden = false;
  }
})();
