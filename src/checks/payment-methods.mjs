// Choosing a payment method, and operating the fields that appear once one is
// chosen. Most of what goes wrong here is a theme or a page builder replacing
// the markup WooCommerce ships with something that looks the same.

import { attr, hasAttr, textOf, byTag, idMap, tokens } from '../html.mjs';
import {
  accessibleName, formControls, controlType, hasClassMatching, isLiveRegion,
  ancestorOfTag,
} from '../a11y.mjs';

export const area = 'payment-methods';
export const kinds = ['html'];

const PAYMENT_LIST = /payment[_-]?methods?|wc[_-]payment|gateway[_-]list/;
const PAYMENT_BOX = /payment[_-]box|payment[_-]panel|gateway[_-]fields/;
const SAVED_CARD = /saved[_-]card|payment[_-]token|wc[_-]saved/;
const GATEWAY_FRAME = /card|payment|stripe|braintree|adyen|checkout|hosted/i;
const TERMS = /terms|privacy[_-]policy/;

function clickable(el) {
  if (hasAttr(el, 'onclick')) return true;
  const cls = attr(el, 'class') || '';
  const data = Object.keys(el.attrs).some((k) => k.startsWith('data-') && /method|gateway|payment/.test(k));
  return /clickable|js-|selectable/.test(cls) || data;
}

export function check(doc) {
  const source = doc.text;
  const els = doc.elements;
  const ids = idMap(els);
  const out = [];
  const add = (id, severity, line, detail) => out.push({ id, severity, line, detail });

  const radios = formControls(els).filter((el) => controlType(el) === 'radio');
  const paymentRadios = radios.filter((el) => {
    const name = (attr(el, 'name') || '') + ' ' + (attr(el, 'id') || '') + ' ' + (attr(el, 'class') || '');
    return /payment/.test(name.toLowerCase());
  });

  // WooCommerce ships the methods as a ul, a theme usually replaces it with a
  // div, and a fieldset is the right container for a group of radios. Leaving
  // fieldset out meant the checks that read this list silently skipped the
  // markup this repository's own corrected examples use.
  const LIST_TAGS = ['ul', 'ol', 'div', 'fieldset', 'section'];
  const lists = els.filter((el) => LIST_TAGS.includes(el.tag) && hasClassMatching(el, PAYMENT_LIST));

  // ---- is the choice a choice? --------------------------------------------
  for (const list of lists) {
    const inside = els.filter((el) => el.ancestors.includes(list.index));
    const radiosInside = inside.filter((el) => controlType(el) === 'radio');
    const clickableItems = inside.filter((el) => ['li', 'div', 'a', 'span'].includes(el.tag) && clickable(el));
    if (!radiosInside.length && clickableItems.length >= 2) {
      add('payment-list-not-radiogroup', 'critical', list.line,
        clickableItems.length + ' clickable payment items and no radio inputs');
    }
  }

  // The radios that are alternatives to each other are the ones inside the
  // payment methods list. A saved card token group is a different group on
  // purpose, and an earlier version of this check demanded that every radio
  // with "payment" in its name share one name attribute, which reported every
  // store that offers both a method choice and a saved card as broken.
  for (const list of lists) {
    const inside = els.filter((el) => el.ancestors.includes(list.index));
    const choices = inside.filter((el) => controlType(el) === 'radio');
    if (choices.length < 2) continue;
    const names = new Set(choices.map((el) => attr(el, 'name') || ''));
    if (names.size !== 1 || names.has('')) {
      add('payment-radio-no-name', 'serious', choices[0].line,
        choices.length + ' payment radios in one list across ' + names.size + ' name groups');
    }
  }

  // ---- the gateway's own frame -------------------------------------------
  for (const frame of byTag(els, 'iframe')) {
    const src = attr(frame, 'src') || '';
    const name = attr(frame, 'name') || '';
    const cls = attr(frame, 'class') || '';
    const looksPayment = GATEWAY_FRAME.test(src + ' ' + name + ' ' + cls) || hasClassMatching(frame, /card|payment/);
    if (!looksPayment) continue;

    const title = attr(frame, 'title');
    if (!title || !title.trim()) {
      add('gateway-iframe-untitled', 'serious', frame.line, 'payment iframe with no title');
    }
    const tabindex = Number(attr(frame, 'tabindex'));
    const hidden = (attr(frame, 'aria-hidden') || '').toLowerCase() === 'true';
    if ((hasAttr(frame, 'tabindex') && Number.isFinite(tabindex) && tabindex < 0) || hidden) {
      add('gateway-iframe-not-reachable', 'critical', frame.line,
        'the frame holding the card fields is out of the tab order');
    }
  }

  // ---- the panel that appears -------------------------------------------
  const boxes = els.filter((el) => hasClassMatching(el, PAYMENT_BOX));
  for (const box of boxes) {
    const named = !!(attr(box, 'aria-label') || attr(box, 'aria-labelledby'));
    const controlled = els.some((el) => tokens(attr(el, 'aria-controls')).includes(attr(box, 'id') || '\u0000'));
    if (!isLiveRegion(box) && !hasAttr(box, 'tabindex') && !(named && controlled)) {
      add('payment-box-not-announced', 'serious', box.line,
        'the panel for this method is neither focus managed nor announced');
    }
  }

  // ---- saved cards -------------------------------------------------------
  // Walk the token radios themselves rather than their wrappers. Walking
  // wrappers reported the same card once for the list and once for the row,
  // because "saved-cards" and "saved-card" both match the class pattern.
  const tokenRadios = formControls(els).filter((el) => {
    if (controlType(el) !== 'radio') return false;
    const key = ((attr(el, 'name') || '') + ' ' + (attr(el, 'id') || '') + ' ' + (attr(el, 'class') || '')).toLowerCase();
    if (SAVED_CARD.test(key)) return true;
    return els.some((a) => el.ancestors.includes(a.index) && hasClassMatching(a, SAVED_CARD));
  });
  for (const radio of tokenRadios) {
    const { name } = accessibleName(source, els, radio);
    const digits = name ? /\d{4}/.test(name) : false;
    if (!name || !digits) {
      add('saved-card-not-distinguishable', 'serious', radio.line,
        'the saved card is named "' + (name || '') + '", which does not identify the card');
    }
  }

  // ---- the terms checkbox -----------------------------------------------
  for (const box of formControls(els).filter((el) => controlType(el) === 'checkbox')) {
    const key = ((attr(box, 'name') || '') + ' ' + (attr(box, 'id') || '')).toLowerCase();
    if (!TERMS.test(key)) continue;
    const { name } = accessibleName(source, els, box);
    const described = tokens(attr(box, 'aria-describedby')).some((id) => {
      const target = ids.get(id);
      return target && textOf(source, target).length > 20;
    });
    if ((!name || name.length < 8) && !described) {
      add('terms-checkbox-unlabelled', 'serious', box.line,
        'the terms checkbox is named "' + (name || '') + '" and describes nothing');
    }
  }

  // ---- what happens without JavaScript ----------------------------------
  const placeOrder = els.find((el) => {
    const text = textOf(source, el).toLowerCase();
    return ['button', 'a', 'input'].includes(el.tag) && /place order|pay now|complete order/.test(text + ' ' + (attr(el, 'value') || '').toLowerCase());
  });
  if (placeOrder) {
    const form = ancestorOfTag(els, placeOrder, 'form');
    const action = form ? (attr(form, 'action') || '') : '';
    const isSubmit = placeOrder.tag === 'input'
      ? ['submit', 'image'].includes((attr(placeOrder, 'type') || '').toLowerCase())
      : (attr(placeOrder, 'type') || '').toLowerCase() === 'submit' || placeOrder.tag === 'button' && !hasAttr(placeOrder, 'type');
    if (!form || !action.trim() || !isSubmit) {
      add('payment-form-js-only', 'moderate', placeOrder.line,
        'the place order control does not submit a form with an action');
    }
  }

  return out;
}
