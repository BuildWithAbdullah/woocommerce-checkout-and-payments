// Tax and shipping. Three of these are read out of PHP and six out of a small
// JSON description of the store settings, because the settings are where most
// of this goes wrong and no amount of reading the theme will show them. The
// shape of that JSON is documented in docs/store-description.md and every
// field it reads is optional: a key that is absent is not a finding, because
// an operator filling the file in by hand will not have every value to hand.

import { matchLines, codeText, codeLines } from '../php.mjs';

export const area = 'tax-and-shipping';
export const kinds = ['php', 'config'];

const ROUND_CALL = /\bround\s*\(/;
const LINE_SCOPED = /line|item|unit|per_?product/i;
const TOTAL_SCOPED = /total|order|cart|basket/i;
const TAX_WORD = /tax|vat/i;
const GATEWAY_AMOUNT = /['"]amount['"]\s*=>/;
const NET_EXPRESSION = /get_subtotal\s*\(\s*\)|get_total\s*\(\s*\)\s*-|->get_total_tax\s*\(/;
const DISPLAY_TOTAL = /wc_price\s*\(\s*\$?\w*->get_total\s*\(|get_formatted_order_total\s*\(|->get_total\s*\(\s*\)\s*\)/;
const VAT_FIELD = /vat_?(number|id)|billing_vat|tax_?number/i;
const VAT_CHECKED = /preg_match\s*\(|validate_vat|vies|check_vat|vat_?valid/i;

function fromPhp(doc) {
  const src = doc.text;
  const all = codeText(src);
  const lines = codeLines(src);
  const out = [];
  const add = (id, severity, line, detail) => out.push({ id, severity, line, detail });

  const rounds = matchLines(src, ROUND_CALL).filter((h) => TAX_WORD.test(h.text) || TOTAL_SCOPED.test(h.text));
  const perLine = rounds.filter((h) => LINE_SCOPED.test(h.text) && TAX_WORD.test(h.text));
  const perTotal = rounds.filter((h) => TOTAL_SCOPED.test(h.text) && !LINE_SCOPED.test(h.text));
  if (perLine.length && perTotal.length) {
    add('tax-rounded-twice', 'serious', perTotal[0].no,
      'tax is rounded at line ' + perLine[0].no + ' and the total is rounded again here');
  }

  const displaysInclusive = DISPLAY_TOTAL.test(all);
  for (const hit of matchLines(src, GATEWAY_AMOUNT)) {
    const window = lines.slice(hit.no - 1, hit.no + 2).map((l) => l.text).join('\n');
    if (displaysInclusive && NET_EXPRESSION.test(window)) {
      add('display-and-charge-tax-mismatch', 'critical', hit.no,
        'the page shows the gross total and the gateway is sent a net figure');
    }
  }

  if (VAT_FIELD.test(all) && !VAT_CHECKED.test(all)) {
    const at = matchLines(src, VAT_FIELD);
    add('vat-number-accepted-unchecked', 'minor', at.length ? at[0].no : 1,
      'a VAT number is taken and never checked, not even for shape');
  }

  return out;
}

function zoneCoversRestOfWorld(zone) {
  const regions = Array.isArray(zone.regions) ? zone.regions : [];
  if (zone.rest_of_world === true) return true;
  return regions.some((r) => String(r) === '*' || /everywhere|rest of world/i.test(String(r)));
}

function fromConfig(doc) {
  const out = [];
  const add = (id, severity, detail) => out.push({ id, severity, line: 1, detail });
  let store;
  try {
    store = JSON.parse(doc.text);
  } catch {
    return out; // a file that is not the store description is not this checker's business
  }
  if (!store || typeof store !== 'object') return out;

  const tax = store.tax && typeof store.tax === 'object' ? store.tax : {};
  const shipping = store.shipping && typeof store.shipping === 'object' ? store.shipping : {};
  const zones = Array.isArray(shipping.zones) ? shipping.zones : null;
  const classes = Array.isArray(shipping.classes) ? shipping.classes : [];

  if (zones && zones.length && !zones.some(zoneCoversRestOfWorld)) {
    add('shipping-zone-no-fallback', 'serious',
      zones.length + ' zones and none of them covers an address outside the others');
  }

  if (tax.digital_tax_location === 'base' && store.sells_digital_goods === true) {
    add('digital-goods-taxed-at-shop-base', 'serious',
      'downloadable goods are taxed where the shop is rather than where the customer is');
  }

  if (tax.based_on === 'billing' && zones && zones.length) {
    add('tax-from-billing-while-shipping-elsewhere', 'serious',
      'tax comes from the billing address on a store that ships goods');
  }

  if (tax.zero_rate_handling === 'exempt') {
    add('zero-rate-treated-as-exempt', 'moderate',
      'zero rated goods are recorded as exempt, so they leave the tax report');
  }

  if (classes.length >= 2 && zones) {
    for (const zone of zones) {
      for (const method of (Array.isArray(zone.methods) ? zone.methods : [])) {
        if (method && method.type === 'flat_rate' && method.calculation_type === 'order' && method.class_costs) {
          add('shipping-class-cost-applied-once', 'moderate',
            'the ' + (zone.name || 'unnamed') + ' zone charges per order across ' + classes.length + ' shipping classes');
        }
      }
    }
  }

  const free = shipping.free_shipping && typeof shipping.free_shipping === 'object' ? shipping.free_shipping : null;
  if (free && typeof free.min_amount === 'number' && free.before_discount === true) {
    add('free-shipping-evaluated-before-coupon', 'moderate',
      'the free shipping threshold is tested before coupons are applied');
  }

  return out;
}

export function check(doc) {
  if (doc.kind === 'config') return fromConfig(doc);
  return fromPhp(doc);
}
