// Shared naming and control helpers for the checkers that read markup.
//
// The accessible name computation here is a deliberate subset of the real
// algorithm: the four sources a checkout template actually uses, in the order
// the specification gives them. It does not consult CSS, it does not walk into
// a shadow root and it does not resolve a title attribute as a last resort.
// Those omissions are declared in src/limits.mjs, because a name computation
// that quietly disagrees with a browser is worse than one that says what it
// does not do.

import { attr, hasAttr, textOf, tokens } from './html.mjs';

const CONTROL_TAGS = new Set(['input', 'select', 'textarea']);
const NOT_A_FIELD = new Set(['hidden', 'submit', 'button', 'image', 'reset']);

export function isFormControl(el) {
  if (!CONTROL_TAGS.has(el.tag)) return false;
  if (el.tag !== 'input') return true;
  const type = (attr(el, 'type') || 'text').toLowerCase();
  return !NOT_A_FIELD.has(type);
}

export function controlType(el) {
  if (el.tag !== 'input') return el.tag;
  return (attr(el, 'type') || 'text').toLowerCase();
}

export function formControls(elements) {
  return elements.filter(isFormControl);
}

export function ancestorOfTag(elements, el, tag) {
  for (let k = el.ancestors.length - 1; k >= 0; k--) {
    const a = elements[el.ancestors[k]];
    if (a && a.tag === tag) return a;
  }
  return null;
}

// Every label element that points at this control, by for or by wrapping it.
export function labelsFor(source, elements, el) {
  const found = [];
  const id = attr(el, 'id');
  if (id) {
    for (const candidate of elements) {
      if (candidate.tag === 'label' && attr(candidate, 'for') === id) found.push(candidate);
    }
  }
  const wrapper = ancestorOfTag(elements, el, 'label');
  if (wrapper && !found.includes(wrapper)) found.push(wrapper);
  return found;
}

export function labelledByText(source, elements, el) {
  const ids = tokens(attr(el, 'aria-labelledby'));
  if (!ids.length) return null;
  const parts = [];
  for (const id of ids) {
    const target = elements.find((c) => attr(c, 'id') === id);
    if (target) parts.push(textOf(source, target));
  }
  const joined = parts.join(' ').trim();
  return joined.length ? joined : null;
}

// Returns { name, from } where from is one of aria-label, aria-labelledby,
// label, or null when the control has no name at all.
export function accessibleName(source, elements, el) {
  const ariaLabel = attr(el, 'aria-label');
  if (ariaLabel && ariaLabel.trim()) return { name: ariaLabel.trim(), from: 'aria-label' };

  const byIds = labelledByText(source, elements, el);
  if (byIds) return { name: byIds, from: 'aria-labelledby' };

  for (const label of labelsFor(source, elements, el)) {
    const text = textOf(source, label);
    if (text) return { name: text, from: 'label' };
  }

  return { name: null, from: null };
}

export function isRequiredProgrammatically(el) {
  if (hasAttr(el, 'required')) return true;
  return (attr(el, 'aria-required') || '').toLowerCase() === 'true';
}

const REQUIRED_MARKERS = /[*⁎]|\brequired\b/i;

// A visible marker is an asterisk or the word required inside the control's own
// label. Checkout themes render it as an abbr, a span or a bare character, so
// the text of the label is the thing to read.
export function looksRequiredOnScreen(source, elements, el) {
  for (const label of labelsFor(source, elements, el)) {
    if (REQUIRED_MARKERS.test(textOf(source, label))) return true;
  }
  return false;
}

export function classList(el) {
  return tokens(attr(el, 'class')).map((c) => c.toLowerCase());
}

export function hasClassMatching(el, re) {
  return classList(el).some((c) => re.test(c));
}

export function describedByIds(el) {
  return tokens(attr(el, 'aria-describedby'));
}

export function isLiveRegion(el) {
  const role = (attr(el, 'role') || '').toLowerCase();
  if (role === 'alert' || role === 'status') return true;
  const live = (attr(el, 'aria-live') || '').toLowerCase();
  return live === 'polite' || live === 'assertive';
}

export function isFocusable(el) {
  if (hasAttr(el, 'tabindex')) {
    const value = Number(attr(el, 'tabindex'));
    return Number.isFinite(value);
  }
  return ['a', 'button', 'input', 'select', 'textarea', 'iframe'].includes(el.tag);
}
