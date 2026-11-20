/**
 * Contact page: validates and sanitises the enquiry, then prepares a WhatsApp
 * message (GitHub Pages has no server, so WhatsApp is how messages reach us).
 */
'use strict';

(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const { el, sanitizeLine, sanitizeMultiline, sanitizeEmail, isValidEmail, normalizeBDMobile, isValidBDMobile, setFieldError } = ZW;
  const fields = {
    name: form.elements.namedItem('name'),
    phone: form.elements.namedItem('phone'),
    email: form.elements.namedItem('email'),
    subject: form.elements.namedItem('subject'),
    message: form.elements.namedItem('message'),
  };
  const honeypot = form.elements.namedItem('website');
  const status = document.getElementById('form-status');
  const counter = document.getElementById('message-count');
  const sendBox = document.getElementById('contact-send');

  const LIMITS = { nameMin: 2, nameMax: 80, messageMin: 10, messageMax: 1000 };
  const SUBJECTS = { general: 'General question', product: 'A specific watch', price: 'Price and availability', order: 'An existing order' };
  // Letters (any language, including Bangla), spaces, apostrophes, hyphens and full stops
  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;

  const validators = {
    name(value) {
      const v = sanitizeLine(value, LIMITS.nameMax + 1);
      if (!v) return 'Please enter your name.';
      if (v.length < LIMITS.nameMin) return `Name must be at least ${LIMITS.nameMin} characters.`;
      if (v.length > LIMITS.nameMax) return `Name must be ${LIMITS.nameMax} characters or fewer.`;
      if (!NAME_RE.test(v)) return 'Name can only contain letters, spaces, apostrophes, hyphens and full stops.';
      return '';
    },
    phone(value) {
      const v = normalizeBDMobile(value);
      if (!v) return 'Please enter your mobile number.';
      if (!isValidBDMobile(v)) return 'Please enter a Bangladeshi mobile number, for example 01712345678.';
      return '';
    },
    email(value) {
      const v = sanitizeEmail(value);
      if (!v) return '';
      if (!isValidEmail(v)) return 'Please enter a valid email address, for example name@example.com, or leave it empty.';
      return '';
    },
    subject(value) {
      return Object.hasOwn(SUBJECTS, value) ? '' : 'Please choose a topic.';
    },
    message(value) {
      const v = sanitizeMultiline(value, LIMITS.messageMax + 1);
      if (!v) return 'Please enter a message.';
      if (v.length < LIMITS.messageMin) return `Message must be at least ${LIMITS.messageMin} characters.`;
      if (v.length > LIMITS.messageMax) return `Message must be ${LIMITS.messageMax} characters or fewer.`;
      return '';
    },
  };

  const validateField = (key) => setFieldError(fields[key], validators[key](fields[key].value));
  const updateCounter = () => {
    counter.textContent = `${fields.message.value.length} / ${LIMITS.messageMax}`;
  };

  Object.keys(fields).forEach((key) => {
    const input = fields[key];
    input.addEventListener('blur', () => {
      if (input.value) validateField(key);
    });
    input.addEventListener(key === 'subject' ? 'change' : 'input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validateField(key);
      sendBox.hidden = true; // the prepared message is out of date
    });
  });
  fields.message.addEventListener('input', updateCounter);
  updateCounter();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.className = 'form-status';
    status.textContent = '';
    sendBox.hidden = true;

    const results = Object.keys(fields).map((key) => [key, validateField(key)]);
    const invalid = results.filter(([, ok]) => !ok);
    if (invalid.length) {
      status.classList.add('is-error');
      status.textContent = `Please fix ${invalid.length} ${invalid.length === 1 ? 'field' : 'fields'} highlighted below.`;
      fields[invalid[0][0]].focus();
      return;
    }

    // Bots fill the hidden honeypot field: pretend it worked and do nothing.
    if (honeypot && honeypot.value !== '') {
      status.classList.add('is-success');
      status.textContent = 'Thank you.';
      return;
    }

    const clean = {
      name: sanitizeLine(fields.name.value, LIMITS.nameMax),
      phone: normalizeBDMobile(fields.phone.value),
      email: sanitizeEmail(fields.email.value),
      subject: SUBJECTS[fields.subject.value],
      message: sanitizeMultiline(fields.message.value, LIMITS.messageMax),
    };
    const text = [
      'Hi ZENRO Wrist & Co.,',
      '',
      clean.message,
      '',
      `Topic: ${clean.subject}`,
      `Name: ${clean.name}`,
      `Mobile: ${clean.phone}`,
      clean.email ? `Email: ${clean.email}` : null,
    ].filter((line) => line !== null).join('\n');

    sendBox.replaceChildren(
      ZW.externalLink(ZW.waLink(text), 'Send on WhatsApp', 'btn btn--wa'),
      el('p', { class: 'form-note', text: 'WhatsApp opens with your message ready. Tap send to reach us.' })
    );
    sendBox.hidden = false;
    status.classList.add('is-success');
    status.textContent = `Thank you, ${clean.name.split(' ')[0]}. Your message is ready. Tap "Send on WhatsApp" below to send it.`;
    sendBox.querySelector('a').focus();
  });
})();
