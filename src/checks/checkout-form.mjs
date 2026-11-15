// The checkout form itself: naming, autofill, required state and how failures
// are reported back.

import { attr, hasAttr, textOf, byTag, idMap } from '../html.mjs';
import {
  accessibleName, formControls, controlType, isRequiredProgrammatically,
  looksRequiredOnScreen, hasClassMatching, describedByIds, isLiveRegion,
  isFocusable,
} from '../a11y.mjs';

export const area = 'checkout-form';
export const kinds = ['html'];

// The checkout field names WooCommerce ships, and the autofill token each one
// should carry. The names are matched after stripping a billing_ or shipping_
// prefix, and the prefix is what decides the section token.
const PURPOSE_BY_FIELD = {
  first_name: 'given-name',
  last_name: 'family-name',
  company: 'organization',
  address_1: 'address-line1',
  address_2: 'address-line2',
  city: 'address-level2',
  state: 'address-level1',
  postcode: 'postal-code',
  country: 'country',
  phone: 'tel',
  email: 'email',
};

const CARD_PURPOSE = {
  cardnumber: 'cc-number',
  card_number: 'cc-number',
  cc_number: 'cc-number',
  expiry: 'cc-exp',
  card_expiry: 'cc-exp',
  cvc: 'cc-csc',
  cvv: 'cc-csc',
  card_cvc: 'cc-csc',
  cardholder: 'cc-name',
  card_name: 'cc-name',
};

const ERROR_CLASS = /error|validation-message|field-message/;
const SUMMARY_CLASS = /woocommerce-error|error-summary|checkout-errors|form-errors/;

function fieldKey(el) {
  const raw = (attr(el, 'name') || attr(el, 'id') || '').toLowerCase();
  return raw.replace(/^(billing|shipping)[_-]/, '').replace(/-/g, '_');
}

function sectionPrefix(el) {
  const raw = (attr(el, 'name') || attr(el, 'id') || '').toLowerCase();
  if (raw.startsWith('shipping')) return 'shipping';
  if (raw.startsWith('billing')) return 'billing';
  return null;
}

function expectedToken(el) {
  const key = fieldKey(el);
  if (CARD_PURPOSE[key]) return { token: CARD_PURPOSE[key], payment: true };
  if (PURPOSE_BY_FIELD[key]) return { token: PURPOSE_BY_FIELD[key], payment: false };
  return null;
}

function lastAutocompleteToken(value) {
  const parts = String(value).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  // cc-exp is written as two tokens in some templates; only the trailing
  // purpose token is compared, and a section or address-type prefix is fine.
  return parts[parts.length - 1];
}

export function check(doc) {
  const source = doc.text;
  const els = doc.elements;
  const ids = idMap(els);
  const out = [];
  const add = (id, severity, line, detail) => out.push({ id, severity, line, detail });

  // ---- naming -------------------------------------------------------------
  for (const el of formControls(els)) {
    const { name } = accessibleName(source, els, el);
    const placeholder = attr(el, 'placeholder');
    const label = (attr(el, 'name') || attr(el, 'id') || el.tag);
    if (!name) {
      if (placeholder && placeholder.trim()) {
        add('placeholder-as-label', 'serious', el.line, label + ' is named only by its placeholder');
      } else {
        add('field-without-label', 'serious', el.line, label + ' has no accessible name');
      }
    }
  }

  for (const label of byTag(els, 'label')) {
    const target = attr(label, 'for');
    if (target && !ids.has(target)) {
      add('label-not-associated', 'serious', label.line, 'label for="' + target + '" names no element');
    }
  }

  // ---- autofill -----------------------------------------------------------
  for (const el of formControls(els)) {
    const expected = expectedToken(el);
    if (!expected) continue;
    const given = attr(el, 'autocomplete');
    const field = attr(el, 'name') || attr(el, 'id') || el.tag;
    if (given === null || !given.trim()) {
      add('autocomplete-missing', expected.payment ? 'serious' : 'moderate', el.line,
        field + ' should carry autocomplete="' + expected.token + '"');
      continue;
    }
    if (given.trim().toLowerCase() === 'off') continue; // a deliberate refusal, not a mistake
    const last = lastAutocompleteToken(given);
    if (last !== expected.token) {
      add('autocomplete-token-wrong', 'moderate', el.line,
        field + ' carries "' + given.trim() + '" where the purpose is ' + expected.token);
    }
  }

  // ---- required -----------------------------------------------------------
  for (const el of formControls(els)) {
    if (controlType(el) === 'checkbox' || controlType(el) === 'radio') continue;
    if (isRequiredProgrammatically(el)) continue;
    if (looksRequiredOnScreen(source, els, el)) {
      add('required-not-programmatic', 'serious', el.line,
        (attr(el, 'name') || attr(el, 'id') || el.tag) + ' is marked required on screen only');
    }
  }

  // ---- how failures are reported -----------------------------------------
  const inlineErrors = els.filter((el) =>
    el.tag !== 'input' && hasClassMatching(el, ERROR_CLASS) &&
    !hasClassMatching(el, SUMMARY_CLASS) && textOf(source, el).length > 0);

  const referenced = new Set();
  for (const el of formControls(els)) for (const id of describedByIds(el)) referenced.add(id);

  for (const err of inlineErrors) {
    const id = attr(err, 'id');
    if (!id || !referenced.has(id)) {
      add('error-not-associated', 'serious', err.line,
        'the message "' + textOf(source, err).slice(0, 48) + '" is not referenced from any field');
    }
  }

  for (const el of formControls(els)) {
    const points = describedByIds(el).some((id) => {
      const target = ids.get(id);
      return target && hasClassMatching(target, ERROR_CLASS) && textOf(source, target).length > 0;
    });
    if (points && (attr(el, 'aria-invalid') || '').toLowerCase() !== 'true') {
      add('field-invalid-not-marked', 'serious', el.line,
        (attr(el, 'name') || attr(el, 'id') || el.tag) + ' describes an error but is not marked invalid');
    }
  }

  const summaries = els.filter((el) => hasClassMatching(el, SUMMARY_CLASS) && textOf(source, el).length > 0);
  for (const summary of summaries) {
    if (!isLiveRegion(summary) && !(hasAttr(summary, 'tabindex') && isFocusable(summary))) {
      add('error-summary-not-focusable', 'serious', summary.line,
        'the error summary can neither be focused nor announced');
    }
  }
  if (!summaries.length && inlineErrors.length >= 2) {
    add('error-summary-missing', 'moderate', inlineErrors[0].line,
      inlineErrors.length + ' inline messages and no summary at the top of the form');
  }

  // ---- grouping -----------------------------------------------------------
  for (const fs of byTag(els, 'fieldset')) {
    const hasLegend = els.some((el) => el.tag === 'legend' && el.parent === fs.index);
    if (!hasLegend) add('fieldset-missing-legend', 'moderate', fs.line, 'fieldset with no legend');
  }

  const sections = new Set(formControls(els).map(sectionPrefix).filter(Boolean));
  if (sections.has('billing') && sections.has('shipping')) {
    const grouped = els.some((el) =>
      el.tag === 'fieldset' || (attr(el, 'role') || '').toLowerCase() === 'group');
    if (!grouped) {
      add('address-fields-ungrouped', 'minor', formControls(els)[0].line,
        'billing and shipping fields share one flat group');
    }
  }

  return out;
}
